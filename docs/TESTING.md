# SwarmLink Extension - Testing Checklist

## Installation Verification

- [ ] Load extension in Chrome (chrome://extensions/)
- [ ] Extension icon appears in toolbar
- [ ] No console errors in background page
- [ ] Popup opens (400×600px)

## Feature Testing

### Create Hive
- [ ] Click "Create Your Hive"
- [ ] Enter swarm name (test max 50 chars)
- [ ] Enter description (test max 100 chars)
- [ ] Select icon from grid
- [ ] Submit form
- [ ] Success view shows invite code
- [ ] Copy button works
- [ ] Hive appears in "My Swarms"
- [ ] Badge shows "1"
- [ ] Creator badge (👑) appears

### Join Hive
- [ ] Click "Join Hive"
- [ ] Paste valid invite code
- [ ] Submit form
- [ ] Hive appears in "My Swarms"
- [ ] Badge count increments
- [ ] No creator badge for joined swarms

### My Swarms
- [ ] Click "My Swarms"
- [ ] All joined swarms display
- [ ] Creator badge only on created swarms
- [ ] Member count shows
- [ ] Share button copies code
- [ ] Empty state shows when no swarms

### Theme Toggle
- [ ] Click sun/moon icon in header
- [ ] Theme switches dark/light
- [ ] Reopen popup → theme persists
- [ ] CSS variables update correctly

### Cross-Device Sync
- [ ] Install extension on different device (same Google account)
- [ ] userId should be same across devices
- [ ] Theme preference syncs
- [ ] myHives is local (does not sync)

## Error Handling

- [ ] Invalid swarm code format shows error
- [ ] Already joined swarm shows error
- [ ] Network error shows user-friendly message
- [ ] Empty name/description shows validation error
- [ ] Name > 50 chars shows error
- [ ] Description > 100 chars shows error

## API Integration

- [ ] POST /create-swarm returns swarmCode
- [ ] POST /join-swarm returns swarm data
- [ ] Requests include correct headers
- [ ] Responses parsed correctly
- [ ] userId sent in requests

## Storage

- [ ] chrome.storage.sync.userId exists
- [ ] chrome.storage.sync.theme exists
- [ ] chrome.storage.local.myHives is array
- [ ] Badge updates when myHives changes
- [ ] Storage persists after browser restart

## UI/UX

- [ ] Popup size is 400×600px
- [ ] Scrolling works when content overflows
- [ ] Buttons have hover states
- [ ] Forms have focus states
- [ ] Character counters update
- [ ] Icon picker shows selection
- [ ] Loading states show
- [ ] Back buttons work

## Performance

- [ ] Popup opens quickly (<500ms)
- [ ] No memory leaks
- [ ] Badge updates efficiently
- [ ] API calls have reasonable timeouts

## Console Checks

- [ ] No errors in popup console
- [ ] No errors in background page console
- [ ] No CSP violations
- [ ] No CORS errors

## Known Issues

- None yet

## Next Steps

1. Test all checkboxes above
2. Fix any bugs found
3. Create ZIP for Chrome Web Store
4. Submit for review
