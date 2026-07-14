#!/bin/bash
cd /workspaces/Pixel-Drive
pkill -f "node src/server/index.js" 2>/dev/null
sleep 1
setsid node src/server/index.js > /tmp/server.log 2>&1 < /dev/null &
echo "started pid $!"
sleep 5
echo "=== server log ==="
tail -5 /tmp/server.log