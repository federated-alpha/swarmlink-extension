#!/bin/bash
# SwarmLink Extension - Firefox Developer Install Helper

EXTENSION_PATH="/home/jeff/projects/federated-alpha/apps/extension"
MANIFEST_PATH="$EXTENSION_PATH/manifest.json"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   SwarmLink Extension - Firefox Developer Install         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📦 Extension Location:"
echo "   $EXTENSION_PATH"
echo ""
echo "🔧 Install Steps for Firefox:"
echo ""
echo "1. Open Firefox and go to:"
echo "   about:debugging#/runtime/this-firefox"
echo ""
echo "2. Click 'Load Temporary Add-on...'"
echo ""
echo "3. Navigate to and select this file:"
echo "   $MANIFEST_PATH"
echo ""
echo "4. SwarmLink should appear in your extensions!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  IMPORTANT - Firefox Temporary Extensions:"
echo "   - Extension will UNLOAD when Firefox restarts"
echo "   - You'll need to re-load it each time"
echo "   - This is temporary until we publish to addons.mozilla.org"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Quick Tip: Pin the extension to your toolbar"
echo "   (Extensions icon → SwarmLink → Pin to toolbar)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Try to open Firefox debugging page automatically
if command -v firefox &> /dev/null; then
  echo "🚀 Opening Firefox debugging page..."
  firefox "about:debugging#/runtime/this-firefox" 2>/dev/null &
else
  echo "⚠️  Firefox not found. Please open about:debugging manually"
fi

echo ""
echo "✅ After installing, your swarms will auto-sync from the website!"
echo ""
echo "📋 Manifest path (for step 3):"
echo "   $MANIFEST_PATH"
echo ""
