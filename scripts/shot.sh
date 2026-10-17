#!/bin/sh
# Usage: scripts/shot.sh "<url>" out.png [width] [height]
# Headless Chrome screenshot of a page (e.g. http://localhost:5173/#/gallery/art).
URL="$1"; OUT="$2"; W="${3:-1400}"; H="${4:-1000}"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --virtual-time-budget=4000 --window-size="$W,$H" --screenshot="$OUT" "$URL" >/dev/null 2>&1
echo "$OUT"
