# Quick Installation Guide

## Chrome / Edge / Brave (Windows / Linux)

1. **Open Extensions Page:**
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Brave: `brave://extensions/`

2. **Enable Developer Mode:**
   - Toggle switch in top-right corner

3. **Load Extension:**
   - Click "Load unpacked"
   - Navigate to: `/home/jeff/projects/federated-alpha/apps/extension/`
   - Click "Select Folder"

4. **Verify:**
   - Extension icon appears in toolbar
   - Badge shows when you join swarms
   - Click icon to open popup

## Firefox (Windows / Linux)

1. **Open Debugging Page:**
   - Navigate to: `about:debugging#/runtime/this-firefox`

2. **Load Temporary Add-on:**
   - Click "Load Temporary Add-on..."
   - Select: `/home/jeff/projects/federated-alpha/apps/extension/manifest.json`

3. **Note:**
   - Temporary add-ons are removed on browser restart
   - For permanent install, publish to addons.mozilla.org

## Troubleshooting

### Extension doesn't load
- Check all required files exist:
  - `manifest.json`
  - `popup.html`
  - `popup.js`
  - `styles.css`
  - `background.js`
  - `icons/icon16.png`
  - `icons/icon48.png`
  - `icons/icon128.png`

### Popup doesn't open
- Check browser console for errors (F12 → Console)
- Verify React CDN loads (check Network tab)
- Try reloading the extension

### API calls fail
- Check CORS settings
- Verify API endpoints are accessible: https://federatedalpha.com/api/create-swarm
- Check browser console for network errors

### Badge doesn't update
- Open background page console
- Chrome: Extensions page → SwarmLink → "Inspect views: service worker"
- Check for errors in badge update code

## Testing Checklist

- [ ] Extension loads without errors
- [ ] Popup opens (400×600px)
- [ ] Can create hive
- [ ] Can join hive
- [ ] Badge shows correct count
- [ ] Theme toggle works
- [ ] All swarms appear in "My Swarms"

## Next Steps

After successful installation:
1. Create your first hive
2. Share invite code with community
3. Join other swarms
4. Check cross-browser compatibility (if using multiple browsers)
