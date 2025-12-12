#!/bin/bash

# Start all systems for Gold Price Tracker
# This script starts both the backend and frontend servers

echo "🚀 Starting Gold Price Tracker systems..."
echo ""

# Check if already running
BACKEND_RUNNING=false
FRONTEND_RUNNING=false

if lsof -ti:3001 >/dev/null 2>&1; then
  echo "⚠️  Backend is already running on port 3001"
  BACKEND_RUNNING=true
fi

if lsof -ti:5173 >/dev/null 2>&1; then
  echo "⚠️  Frontend is already running on port 5173"
  FRONTEND_RUNNING=true
fi

if [ "$BACKEND_RUNNING" = true ] && [ "$FRONTEND_RUNNING" = true ]; then
  echo ""
  echo "✅ All systems are already running!"
  echo "   Backend: http://localhost:3001"
  echo "   Frontend: http://localhost:5173"
  exit 0
fi

# Start missing services
if [ "$BACKEND_RUNNING" = false ] && [ "$FRONTEND_RUNNING" = false ]; then
  echo "📦 Starting both backend and frontend servers..."
  echo "   (This will run in the foreground. Press Ctrl+C to stop.)"
  echo ""
  npm run dev:all
elif [ "$BACKEND_RUNNING" = false ]; then
  echo "📦 Starting backend server (port 3001)..."
  npm run dev:server
elif [ "$FRONTEND_RUNNING" = false ]; then
  echo "🌐 Starting frontend server (port 5173)..."
  npm run dev
fi
