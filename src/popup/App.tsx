import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './popup.css';

function App() {
  const [myHives, setMyHives] = useState<any[]>([]);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    // Load hives from chrome.storage
    chrome.storage.local.get(['myHives', 'isActive'], (result) => {
      setMyHives(result.myHives || []);
      setIsActive(result.isActive || false);
    });
  }, []);

  const handleToggleActive = () => {
    const newState = !isActive;
    setIsActive(newState);
    chrome.storage.local.set({ isActive: newState });

    // Notify background script
    chrome.runtime.sendMessage({ type: 'TOGGLE_ACTIVE', isActive: newState });
  };

  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1>🐝 SwarmLink</h1>
        <p>Community Alpha Hunting</p>
      </header>

      <div className="status-section">
        <div className="status-indicator" style={{
          backgroundColor: isActive ? '#00ff88' : '#gray',
        }}>
          {isActive ? '● Active' : '○ Inactive'}
        </div>
        <button
          className="toggle-btn"
          onClick={handleToggleActive}
        >
          {isActive ? 'Pause' : 'Activate'}
        </button>
      </div>

      <div className="hives-section">
        <h3>My Hives ({myHives.length})</h3>
        {myHives.length === 0 ? (
          <div className="empty-state">
            <p>No hives yet</p>
            <a
              href="https://federatedalpha.com/hives"
              target="_blank"
              rel="noopener noreferrer"
              className="manage-link"
            >
              Create or Join a Hive →
            </a>
          </div>
        ) : (
          <div className="hive-list">
            {myHives.map((hive: any) => (
              <div key={hive.code} className="hive-item">
                <div>
                  <div className="hive-name">{hive.name}</div>
                  <div className="hive-code">{hive.code}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="popup-footer">
        <a
          href="https://federatedalpha.com/hives"
          target="_blank"
          rel="noopener noreferrer"
        >
          Manage Hives
        </a>
      </footer>
    </div>
  );
}

// Mount the app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
