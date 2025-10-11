#!/bin/bash

echo "🛑 Stopping Apify Actor Local Service..."

# Kill process on port 3005
PID=$(lsof -ti:3005 2>/dev/null)

if [ -z "$PID" ]; then
  echo "ℹ️  No service running on port 3005"
  exit 0
fi

echo "📍 Found process: $PID"
kill -15 "$PID" 2>/dev/null

# Wait up to 5 seconds for graceful shutdown
for i in {1..5}; do
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "✅ Service stopped gracefully"
    exit 0
  fi
  sleep 1
done

# Force kill if still running
if kill -0 "$PID" 2>/dev/null; then
  echo "⚠️  Forcing shutdown..."
  kill -9 "$PID" 2>/dev/null
  echo "✅ Service stopped (forced)"
else
  echo "✅ Service stopped"
fi
