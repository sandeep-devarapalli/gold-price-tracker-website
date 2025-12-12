#!/bin/bash

# Start all systems in the background for Gold Price Tracker

echo "🚀 Starting Gold Price Tracker systems in background..."
echo ""

# Check if already running
if lsof -ti:3001 >/dev/null 2>&1 || lsof -ti:5173 >/dev/null 2>&1; then
  echo "⚠️  Some services are already running. Use 'npm run stop' first."
  exit 1
fi

# Start both servers using concurrently in background
echo "📦 Starting backend and frontend servers..."
nohup npm run dev:all > /tmp/gold-tracker.log 2>&1 &
PID=$!

echo "   Started with PID: $PID"
echo "   Logs: tail -f /tmp/gold-tracker.log"
echo ""

# Wait a moment for servers to start
sleep 5

# Check status
echo "📊 System Status:"
if lsof -ti:3001 >/dev/null 2>&1; then
  echo "   ✅ Backend: http://localhost:3001"
else
  echo "   ❌ Backend: Not responding yet (may still be starting)"
fi

if lsof -ti:5173 >/dev/null 2>&1; then
  echo "   ✅ Frontend: http://localhost:5173"
else
  echo "   ❌ Frontend: Not responding yet (may still be starting)"
fi

echo ""
echo "✨ Systems are starting in the background!"
echo "   Use 'npm run stop' to stop all systems."
echo "   Use 'npm run status' to check system status."
