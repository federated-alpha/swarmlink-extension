# SwarmLink - Cross-Browser & Cross-Platform Compatibility

## ✅ Fully Supported

### Browsers
- **Chrome** 109+ (Windows, Linux, macOS)
- **Edge** 109+ (Windows, Linux, macOS) 
- **Brave** (all platforms)
- **Opera** (all platforms)
- **Firefox** 109+ (Windows, Linux, macOS)

### Operating Systems
- **Windows** 10/11
- **Linux** (all distributions)
- **macOS** 10.15+

## 🔧 Browser-Specific Differences

### Chrome/Edge/Brave
✅ **Full functionality:**
- `chrome.storage.sync` syncs across devices via Google/Microsoft account
- Badge updates work perfectly
- All features work as designed

### Firefox
⚠️ **Works with limitations:**
- `chrome.storage.sync` does NOT sync across devices (acts like local storage)
  - userId will be different on each device
  - Theme preference won't sync
- Badge updates work
- All other features work identically

**Why the limitation?**
Firefox doesn't support cross-device sync for extensions the same way Chrome does. It's a browser limitation, not a bug in our extension.

**Workaround for Firefox:**
Users need to manually copy their userId or recreate swarms on each device. Future versions could add cloud sync via our API.

## 📦 Installation Per Browser

### Chrome
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `apps/extension/` folder

### Firefox
1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `manifest.json` in `apps/extension/` folder

**Note:** Temporary add-ons in Firefox are removed on restart. For permanent install, you need to sign it via addons.mozilla.org

### Edge
1. Go to `edge://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `apps/extension/` folder

## 🧪 Testing Matrix

| Feature | Chrome | Firefox | Edge | Linux | Windows | macOS |
|---------|--------|---------|------|-------|---------|-------|
| Create swarm | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Join swarm | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| My swarms | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Badge count | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Theme toggle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Storage sync | ✅ | ❌ | ✅ | N/A | N/A | N/A |
| API calls | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## 🚀 Publishing

### Chrome Web Store
- Works on: Chrome, Edge, Brave, Opera
- Review time: 1-3 days
- One submission reaches multiple browsers

### Firefox Add-ons (addons.mozilla.org)
- Works on: Firefox only
- Review time: 1-7 days
- Requires separate submission

## 🛠️ Technical Details

### APIs Used
All APIs are part of WebExtensions standard and work cross-browser:
- `chrome.storage.local` ✅ All browsers
- `chrome.storage.sync` ✅ Chrome/Edge (⚠️ Firefox: no sync)
- `chrome.action` ✅ All browsers (Manifest V3)
- `chrome.runtime` ✅ All browsers

### Web Technologies
- React 18 (via CDN) ✅ All browsers
- CSS Variables ✅ All browsers
- Fetch API ✅ All browsers
- Clipboard API ✅ All browsers

### Known Issues
None. The extension uses only standard, well-supported APIs.

## 📝 Development Tips

### Testing on Multiple Browsers
```bash
# Chrome
google-chrome --load-extension=/path/to/apps/extension

# Firefox
web-ext run --source-dir=/path/to/apps/extension

# Install web-ext for Firefox testing:
npm install -g web-ext
```

### Checking Compatibility
```bash
# Validate manifest for Firefox
web-ext lint --source-dir=apps/extension
```

## 🔮 Future Improvements

**v0.2:** Add cloud-based userId sync via API to fix Firefox limitation
**v0.3:** Test on mobile browsers (Chrome Android, Firefox Android)
**v0.4:** Safari extension (requires separate build)

## Summary

**TL;DR:**
- ✅ Works on **all major browsers** (Chrome, Firefox, Edge, Brave, Opera)
- ✅ Works on **all operating systems** (Windows, Linux, macOS)
- ⚠️ Firefox users won't get cross-device sync (browser limitation)
- 🎯 Single codebase for all platforms - no platform-specific code needed
