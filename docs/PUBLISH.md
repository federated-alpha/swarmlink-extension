# Publishing SwarmLink Extension

Complete guide to publish SwarmLink to Chrome Web Store and Firefox Add-ons.

---

## 🌐 Chrome Web Store

### 1. Register as Chrome Web Store Developer

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Sign in with Google account
3. Pay **$5 one-time registration fee**
4. Accept developer agreement

### 2. Prepare Assets

#### Required Files:
- ✅ Extension ZIP (already created: `apps/extension.zip`)
- ✅ Icons (already have: 16px, 48px, 128px)

#### Screenshots (Need to create):
- **Small tile:** 440×280 px PNG (shows in search results)
- **Marquee:** 1400×560 px PNG (featured banner, optional)
- **Screenshots:** 1280×800 px or 640×400 px PNG (1-5 images showing extension UI)

#### Store Listing Info:
```
Name: SwarmLink - Federated SwarmLink

Short description (132 chars max):
Join community swarms for collaborative alpha hunting on Solana. Privacy-first swarm intelligence.

Detailed description (see below)

Category: Productivity
Language: English
```

### 3. Create Screenshots

**Screenshot 1 - Home View:**
- Open extension popup
- Take screenshot of "Create Your Hive" / "Browse Hives" view
- Resize to 1280×800 px

**Screenshot 2 - Create Hive:**
- Show create swarm form with icon picker

**Screenshot 3 - My Swarms:**
- Show list of swarms with creator badges

**Screenshot 4 - Success View:**
- Show invite code copy screen

**Tool to create screenshots:**
```bash
# Use Firefox/Chrome screenshot tool (Ctrl+Shift+S)
# Or use GNOME Screenshot on Fedora
gnome-screenshot -w  # Click extension popup window
```

### 4. Upload to Chrome Web Store

1. Go to [Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click **"New Item"**
3. **Upload ZIP:** `apps/extension.zip`
4. Fill out store listing:

**Store Listing:**
```
Name: SwarmLink - Federated SwarmLink

Short description:
Join community swarms for collaborative alpha hunting on Solana. Privacy-first swarm intelligence.

Detailed description:
SwarmLink connects crypto communities through collaborative alpha hunting. Create or join swarms to detect rugs, find yields, and spot momentum together.

🐝 Features:
• Create your own community swarm in 30 seconds
• Join swarms via invite codes
• Manage all your swarms from browser toolbar
• Cross-device sync (Chrome accounts)
• Dark/light theme support
• Privacy-first: no data collection

🚀 How It Works:
1. Create or join a swarm on federatedalpha.com
2. Install extension - your swarms auto-sync
3. Collaborate with your community
4. Earn $ALPHA for contributions

🔒 Security:
• Open source - inspect the code
• No asset custody (safer than wallet extensions)
• No tracking or analytics
• Powered by Federated Alpha

Perfect for Solana communities, DeFi researchers, rug detectors, and alpha hunters.

Category: Productivity
```

**Privacy Practice Disclosure:**
```
Data Usage:
- userId (anonymous UUID) stored locally
- Hive membership data stored locally
- No personal data collected
- No third-party data sharing
- No analytics or tracking

Justification:
User authentication and swarm management only.
```

**Permissions Justification:**
```
"storage" - Required to save user's swarm memberships locally
"host_permissions" - Required to call federatedalpha.com API
```

5. **Upload screenshots** (1-5 images)
6. **Upload promotional images:**
   - Small tile: 440×280 px
   - Optional marquee: 1400×560 px

7. Click **"Submit for Review"**

### 5. Review Process

- **Timeline:** 1-3 days (usually 24 hours)
- **Status:** Check dashboard for updates
- **Email:** Google sends approval/rejection email

### 6. After Approval

Extension URL will be:
```
https://chrome.google.com/webstore/detail/swarmlink/[unique-id]
```

Update website link in `src/pages/hives/HivesHome.jsx`:
```jsx
// Change from:
href="https://github.com/federated-alpha/alpha-sentiment/raw/master/apps/extension.zip"

// To:
href="https://chrome.google.com/webstore/detail/swarmlink/[your-unique-id]"
```

---

## 🦊 Firefox Add-ons (addons.mozilla.org)

### 1. Create Firefox Account

1. Go to [addons.mozilla.org](https://addons.mozilla.org)
2. Sign in or create account (free)

### 2. Prepare for Firefox

Extension is already compatible! `browser_specific_settings` in manifest.json:
```json
"browser_specific_settings": {
  "gecko": {
    "id": "swarmlink@federatedalpha.com",
    "strict_min_version": "109.0"
  }
}
```

### 3. Submit to Firefox

1. Go to [Developer Hub](https://addons.mozilla.org/developers/)
2. Click **"Submit New Add-on"**
3. Upload `apps/extension.zip`
4. Fill out listing (similar to Chrome)

**Listing Info:**
```
Name: SwarmLink - Federated SwarmLink

Summary (250 chars):
Join community swarms for collaborative alpha hunting on Solana. Create swarms, invite communities, detect rugs together. Privacy-first swarm intelligence powered by Federated Alpha.

Description: (same as Chrome detailed description)

Categories:
- Social & Communication
- Privacy & Security

Tags:
solana, crypto, web3, community, privacy, defi, alpha
```

4. Click **"Submit Version"**

### 4. Review Process

- **Timeline:** 1-7 days (average 3 days)
- **More thorough** than Chrome (manual code review)
- **Status:** Check submission dashboard

### 5. After Approval

Extension URL will be:
```
https://addons.mozilla.org/firefox/addon/swarmlink/
```

---

## 📸 Creating Store Assets

### Quick Guide to Screenshots

```bash
# On Fedora Linux:

# 1. Install GIMP (if not installed)
sudo dnf install gimp

# 2. Take screenshots:
# - Open extension popup
# - Press PrtScn or use GNOME Screenshot
# - Save as PNG

# 3. Resize in GIMP:
# - Image → Scale Image
# - Set to 1280×800 px
# - Export as PNG
```

### Promotional Tile (440×280 px)

Create simple tile with:
- SwarmLink logo (gradient icons)
- "Community SwarmLink"
- Dark background matching theme

Can use GIMP, Figma, or Canva.

---

## 🚀 Quick Start Checklist

### Chrome Web Store:
- [ ] Register developer account ($5)
- [ ] Create 3-5 screenshots (1280×800)
- [ ] Create small tile (440×280)
- [ ] Write store description
- [ ] Upload extension.zip
- [ ] Submit for review
- [ ] Wait 1-3 days
- [ ] Update website link after approval

### Firefox Add-ons:
- [ ] Create Firefox account (free)
- [ ] Use same screenshots
- [ ] Upload extension.zip
- [ ] Fill out listing
- [ ] Submit for review
- [ ] Wait 1-7 days
- [ ] Update website link after approval

---

## 💡 Tips

1. **Start with Chrome** - faster review, larger audience
2. **Screenshots matter** - show actual UI, not mockups
3. **Clear description** - explain what it does in first sentence
4. **Privacy disclosure** - be transparent about data usage
5. **Test before submit** - verify extension works perfectly
6. **Respond quickly** - if reviewers ask questions, reply fast

---

## 📊 After Publishing

### Update Website

1. Change download link to store URL
2. Remove manual install instructions
3. Show "Add to Chrome" button instead

### Monitor

- Check reviews daily (first week)
- Respond to user feedback
- Fix bugs quickly
- Update when needed

### Updates

When you push updates:
1. Increment version in manifest.json (0.1.0 → 0.1.1)
2. Create new ZIP
3. Upload to both stores
4. Reviews are faster for updates (~1 day)

---

## ❓ Common Issues

**Chrome rejection reasons:**
- Misleading description
- Missing privacy disclosure
- Excessive permissions
- Poor quality screenshots

**Firefox rejection reasons:**
- Minified/obfuscated code
- External code loading
- Privacy issues
- Incomplete documentation

**Solutions:**
- Our extension is clean (no minification, no external code)
- Clear privacy policy
- Reasonable permissions
- Good documentation

Should pass both reviews easily! ✅

---

## 🎯 Timeline

**Total time to publish:**
- Asset creation: 1-2 hours
- Chrome submission: 15 minutes
- Firefox submission: 15 minutes
- Chrome review: 1-3 days
- Firefox review: 1-7 days

**Realistically:** Live on Chrome in 2 days, Firefox in 3-5 days.

---

## Next Steps

1. Create screenshots (see guide above)
2. Register Chrome developer account
3. Submit to Chrome Web Store
4. Submit to Firefox Add-ons
5. Update website after approval

Good luck! 🚀
