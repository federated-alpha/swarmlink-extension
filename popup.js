const { useState, useEffect } = React;

// Icon components mapping (using lucide-react via CDN)
const ICON_MAP = {
  shield: 'Shield',
  coins: 'Coins',
  rocket: 'Rocket',
  zap: 'Zap',
  target: 'Target',
  trophy: 'Trophy',
  crown: 'Crown',
  star: 'Star',
  flame: 'Flame',
  gem: 'Gem',
  heart: 'Heart',
  brain: 'Brain',
  eye: 'Eye',
  bolt: 'Bolt',
  sword: 'Sword',
  shield: 'Shield',
  compass: 'Compass',
  anchor: 'Anchor',
  hexagon: 'Hexagon',
  sparkles: 'Sparkles'
};

// Simple icon component (using emoji fallback)
const Icon = ({ name, size = 24, className = '' }) => {
  const emojiMap = {
    shield: '🛡️',
    coins: '💰',
    rocket: '🚀',
    zap: '⚡',
    target: '🎯',
    trophy: '🏆',
    crown: '👑',
    star: '⭐',
    flame: '🔥',
    gem: '💎',
    heart: '❤️',
    brain: '🧠',
    eye: '👁️',
    bolt: '⚡',
    sword: '⚔️',
    compass: '🧭',
    anchor: '⚓',
    hexagon: '⬢',
    sparkles: '✨',
    sun: '☀️',
    moon: '🌙',
    check: '✓',
    users: '👥',
    share: '📤',
    copy: '📋',
    arrowLeft: '←',
    loader: '⟳'
  };

  return <span className={className} style={{ fontSize: `${size}px` }}>{emojiMap[name] || '○'}</span>;
};

// Utility: Generate UUID
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Utility: Get or create user ID
const getUserId = async () => {
  const result = await chrome.storage.sync.get(['userId']);
  if (result.userId) {
    return result.userId;
  }

  const newUserId = generateUUID();
  await chrome.storage.sync.set({ userId: newUserId });
  return newUserId;
};

// Utility: Get theme
const getTheme = async () => {
  const result = await chrome.storage.sync.get(['theme']);
  return result.theme || 'dark';
};

// Utility: Set theme
const setTheme = async (theme) => {
  await chrome.storage.sync.set({ theme });
  document.documentElement.setAttribute('data-theme', theme);
};

// Utility: Get my swarms
const getMyHives = async () => {
  const result = await chrome.storage.local.get(['mySwarms']);
  return result.mySwarms || [];
};

// Utility: Sync swarms from website API
const syncHivesFromAPI = async (userId) => {
  try {
    const response = await fetch(`${API_BASE}/my-swarms?userId=${userId}`);
    if (!response.ok) return;

    const data = await response.json();
    if (data.success && data.hives && data.hives.length > 0) {
      // Merge with existing swarms (avoid duplicates)
      const existingHives = await getMyHives();
      const existingCodes = new Set(existingHives.map(h => h.code));

      const newHives = data.hives.filter(h => !existingCodes.has(h.code));

      if (newHives.length > 0) {
        const mergedHives = [...existingHives, ...newHives.map(h => ({
          ...h,
          joinedAt: h.createdAt || Date.now()
        }))];
        await saveMyHives(mergedHives);
        return newHives.length;
      }
    }
    return 0;
  } catch (error) {
    console.error('Failed to sync swarms from API:', error);
    return 0;
  }
};

// Utility: Save my swarms
const saveMyHives = async (hives) => {
  await chrome.storage.local.set({ mySwarms: swarms });
  // Update badge
  chrome.runtime.sendMessage({ action: 'updateBadge', count: swarms.length });
};

// API calls
const API_BASE = 'https://www.federatedalpha.com/api';

const createSwarm = async (name, description, icon, creator) => {
  const response = await fetch(`${API_BASE}/create-swarm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, icon, creator })
  });

  if (!response.ok) {
    throw new Error('Failed to create swarm');
  }

  return await response.json();
};

const joinSwarm = async (swarmCode, userId) => {
  const response = await fetch(`${API_BASE}/join-swarm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ swarmCode, userId })
  });

  if (!response.ok) {
    throw new Error('Failed to join swarm');
  }

  return await response.json();
};

// Header Component
const Header = ({ theme, onToggleTheme }) => {
  return (
    <div className="header">
      <div className="logo-text">SwarmLink</div>
      <button className="theme-toggle" onClick={onToggleTheme}>
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
      </button>
    </div>
  );
};

// Home View
const HomeView = ({ onNavigate, swarmCount }) => {
  return (
    <div className="home-view">
      <div className="welcome-text">
        <h2>Community Swarms</h2>
        <p>Join or create your own alpha swarm</p>
      </div>

      <div className="action-buttons">
        <button className="btn btn-primary" onClick={() => onNavigate('create')}>
          Create Your Swarm
        </button>
        <button className="btn btn-secondary" onClick={() => onNavigate('join')}>
          Join Swarm
        </button>
        <button className="btn btn-secondary" onClick={() => onNavigate('my-swarms')}>
          My Swarms
          {hiveCount > 0 && <span className="swarm-count">{hiveCount}</span>}
        </button>
      </div>
    </div>
  );
};

// Create Swarm View
const CreateSwarmView = ({ onBack, userId }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('shield');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  const availableIcons = Object.keys(ICON_MAP).slice(0, 20);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || name.length > 50) {
      setError('Name must be 1-50 characters');
      return;
    }

    if (!description.trim() || description.length > 100) {
      setError('Description must be 1-100 characters');
      return;
    }

    setLoading(true);

    try {
      const result = await createSwarm(name, description, selectedIcon, userId);

      if (result.success) {
        // Add to my swarms
        const mySwarms = await getMyHives();
        mySwarms.push({
          code: result.swarmCode,
          name,
          description,
          icon: selectedIcon,
          joinedAt: Date.now(),
          creator: userId,
          isCreator: true,
          members: 1
        });
        await saveMyHives(mySwarms);

        setSuccess(result.swarmCode);
      } else {
        setError(result.error || 'Failed to create swarm');
      }
    } catch (err) {
      setError('Network error. Check your connection.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return <SuccessView swarmCode={success} onBack={onBack} />;
  }

  return (
    <div className="form-view">
      <button className="back-button" onClick={onBack}>
        <Icon name="arrowLeft" size={14} /> Back
      </button>

      <h3>Create Your Swarm</h3>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Swarm Name</label>
          <input
            type="text"
            placeholder="e.g., BONK Army"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
          />
          <div className={`char-count ${name.length > 45 ? 'warning' : ''}`}>
            {name.length}/50
          </div>
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            placeholder="What's your swarm about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={100}
          />
          <div className={`char-count ${description.length > 90 ? 'warning' : ''}`}>
            {description.length}/100
          </div>
        </div>

        <div className="form-group">
          <label>Choose Icon</label>
          <div className="icon-picker">
            {availableIcons.map(icon => (
              <div
                key={icon}
                className={`icon-option ${selectedIcon === icon ? 'selected' : ''}`}
                onClick={() => setSelectedIcon(icon)}
              >
                <Icon name={icon} size={24} />
              </div>
            ))}
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Creating...' : 'Create Swarm'}
        </button>
      </form>
    </div>
  );
};

// Join Swarm View
const JoinSwarmView = ({ onBack, userId }) => {
  const [swarmCode, setSwarmCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const code = swarmCode.trim().toUpperCase();

    if (!code.startsWith('SWARM-') || code.length !== 17) {
      setError('Invalid swarm code format');
      return;
    }

    setLoading(true);

    try {
      const result = await joinSwarm(code, userId);

      if (result.success) {
        const { swarm } = result;

        // Check if already joined
        const mySwarms = await getMyHives();
        if (mySwarms.some(h => h.code === code)) {
          setError('Already joined this swarm');
          setLoading(false);
          return;
        }

        // Add to my swarms
        mySwarms.push({
          code: swarm.code,
          name: swarm.name,
          description: swarm.description,
          icon: swarm.icon,
          joinedAt: Date.now(),
          creator: swarm.creator,
          isCreator: swarm.creator === userId,
          members: swarm.members || 1
        });
        await saveMyHives(mySwarms);

        // Navigate to my swarms
        onBack();
      } else {
        setError(result.error || 'Failed to join swarm');
      }
    } catch (err) {
      setError('Network error. Check your connection.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-view">
      <button className="back-button" onClick={onBack}>
        <Icon name="arrowLeft" size={14} /> Back
      </button>

      <h3>Join a Swarm</h3>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Swarm Invite Code</label>
          <input
            type="text"
            placeholder="SWARM-XXXXXXXXXXXX"
            value={swarmCode}
            onChange={(e) => setSwarmCode(e.target.value.toUpperCase())}
            style={{ fontFamily: 'monospace' }}
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Joining...' : 'Join Swarm'}
        </button>
      </form>
    </div>
  );
};

// Success View
const SuccessView = ({ swarmCode, onBack }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(swarmCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="success-view">
      <Icon name="check" size={80} className="success-icon" />
      <h3>Swarm Created!</h3>

      <div className="invite-code-box">
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Share this code:
        </div>
        <div className="invite-code">{swarmCode}</div>
        <button
          className={`copy-button ${copied ? 'copied' : ''}`}
          onClick={handleCopy}
        >
          {copied ? '✓ Copied!' : 'Copy Code'}
        </button>
      </div>

      <button className="btn btn-secondary" onClick={onBack}>
        Back to Home
      </button>
    </div>
  );
};

// My Swarms View
const MySwarmsView = ({ onBack }) => {
  const [swarms, setSwarms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSwarms();
  }, []);

  const loadSwarms = async () => {
    const mySwarms = await getMyHives();
    setSwarms(mySwarms.sort((a, b) => b.joinedAt - a.joinedAt));
    setLoading(false);
  };

  const handleShare = (hive) => {
    navigator.clipboard.writeText(hive.code);
    alert(`Copied: ${hive.code}`);
  };

  if (loading) {
    return (
      <div className="loading">
        <Icon name="loader" size={40} />
      </div>
    );
  }

  return (
    <div className="form-view">
      <button className="back-button" onClick={onBack}>
        <Icon name="arrowLeft" size={14} /> Back
      </button>

      <h3>My Swarms ({swarms.length})</h3>

      {hives.length === 0 ? (
        <div className="empty-state">
          <Icon name="sparkles" size={64} />
          <p>No swarms yet. Create or join one!</p>
          <button className="btn btn-primary" onClick={onBack}>
            Get Started
          </button>
        </div>
      ) : (
        <div className="swarms-list">
          {swarms.map(swarm => (
            <div key={hive.code} className="swarm-card">
              <div className="hive-header">
                <Icon name={hive.icon} size={32} className="hive-icon" />
                <div className="hive-name">{hive.name}</div>
                {hive.isCreator && <span className="creator-badge">👑</span>}
              </div>
              <div className="hive-description">{hive.description}</div>
              <div className="hive-footer">
                <div className="hive-members">
                  <Icon name="users" size={14} />
                  {hive.members || 1} members
                </div>
                <button className="share-button" onClick={() => handleShare(hive)}>
                  <Icon name="share" size={12} /> Share
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Main App Component
const App = () => {
  const [view, setView] = useState('home');
  const [theme, setThemeState] = useState('dark');
  const [userId, setUserId] = useState(null);
  const [hiveCount, setHiveCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initialize();
  }, []);

  const initialize = async () => {
    // Get or create user ID
    const id = await getUserId();
    setUserId(id);

    // Get theme
    const savedTheme = await getTheme();
    setThemeState(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Sync swarms from website API (if user created swarms on website)
    await syncHivesFromAPI(id);

    // Get swarm count
    const mySwarms = await getMyHives();
    setHiveCount(mySwarms.length);

    setLoading(false);
  };

  const handleToggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setThemeState(newTheme);
    await setTheme(newTheme);
  };

  const handleNavigate = async (newView) => {
    setView(newView);

    // Update swarm count when returning to home
    if (newView === 'home') {
      const mySwarms = await getMyHives();
      setHiveCount(mySwarms.length);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <Icon name="loader" size={40} />
      </div>
    );
  }

  return (
    <>
      <Header theme={theme} onToggleTheme={handleToggleTheme} />
      <div className="content">
        {view === 'home' && (
          <HomeView onNavigate={handleNavigate} swarmCount={hiveCount} />
        )}
        {view === 'create' && (
          <CreateSwarmView onBack={() => handleNavigate('home')} userId={userId} />
        )}
        {view === 'join' && (
          <JoinSwarmView onBack={() => handleNavigate('home')} userId={userId} />
        )}
        {view === 'my-swarms' && (
          <MySwarmsView onBack={() => handleNavigate('home')} />
        )}
      </div>
    </>
  );
};

// Render the app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
