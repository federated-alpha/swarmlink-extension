#!/bin/bash
# SwarmLink Extension - Developer Install Helper
# Run this script to get install instructions

EXTENSION_PATH="/home/jeff/projects/federated-alpha/apps/extension"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   SwarmLink Extension - Developer Install                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📦 Extension Location:"
echo "   $EXTENSION_PATH"
echo ""
echo "🔧 Install Steps:"
echo ""
echo "1. Open Chrome and go to:"
echo "   chrome://extensions/"
echo ""
echo "2. Enable 'Developer mode' (toggle in top-right)"
echo ""
echo "3. Click 'Load unpacked' (button in top-left)"
echo ""
echo "4. Paste this path and press Enter:"
echo "   $EXTENSION_PATH"
echo ""
echo "5. SwarmLink should appear in your extensions!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Quick Tip: Pin the extension to your toolbar"
echo "   (Click puzzle icon → Find SwarmLink → Click pin)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Try to open Chrome extensions page automatically
if command -v google-chrome &> /dev/null; then
  echo "🚀 Opening Chrome extensions page..."
  google-chrome "chrome://extensions/" 2>/dev/null &
elif command -v chromium &> /dev/null; then
  echo "🚀 Opening Chromium extensions page..."
  chromium "chrome://extensions/" 2>/dev/null &
else
  echo "⚠️  Chrome not found. Please open chrome://extensions/ manually"
fi

echo ""
echo "✅ After installing, your swarms will auto-sync from the website!"
echo ""
