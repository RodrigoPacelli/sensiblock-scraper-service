#!/bin/bash

echo "🚀 Starting Apify Actor Local Service..."
echo ""

# Diretório do script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ACTOR_DIR="$(cd "$SCRIPT_DIR/../apify-actor" && pwd)"

# Check if service dependencies are installed
cd "$SCRIPT_DIR"
if [ ! -d "node_modules" ]; then
  echo "📦 Installing service dependencies..."
  npm install
  if [ $? -ne 0 ]; then
    echo "❌ Failed to install service dependencies"
    exit 1
  fi
  echo "✅ Service dependencies installed"
  echo ""
fi

# Check if actor dependencies are installed
cd "$ACTOR_DIR"
if [ ! -d "node_modules" ]; then
  echo "📦 Installing actor dependencies..."
  npm install
  if [ $? -ne 0 ]; then
    echo "❌ Failed to install actor dependencies"
    exit 1
  fi
  echo "✅ Actor dependencies installed"
  echo ""
fi

# Check if port 3005 is already in use
if lsof -Pi :3005 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
  echo "⚠️  Port 3005 is already in use"
  echo "Run ./stop.sh to stop the existing service"
  exit 1
fi

# Start service
cd "$SCRIPT_DIR"
echo "🎬 Starting service on port 3005..."
echo ""

# Start in background with nohup (persists after terminal closes)
nohup npm start >> service.log 2>&1 &
PID=$!

# Wait for service to start
sleep 3

# Check if still running
if ps -p $PID > /dev/null 2>&1; then
  echo "✅ Service started successfully (PID: $PID)"
  echo "📋 Logs: tail -f $SCRIPT_DIR/service.log"
  echo "🛑 Stop: ./stop.sh"
else
  echo "❌ Service failed to start - check service.log"
  exit 1
fi
