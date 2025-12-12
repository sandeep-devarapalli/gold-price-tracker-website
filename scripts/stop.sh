#!/bin/bash

# Stop all systems for Gold Price Tracker
# This script gracefully stops both the backend and frontend servers

echo "🛑 Stopping Gold Price Tracker systems..."
echo ""

# Stop processes on specific ports
STOPPED_ANY=false

# Stop backend (port 3001)
if lsof -ti:3001 >/dev/null 2>&1; then
  echo "📦 Stopping backend server (port 3001)..."
  lsof -ti:3001 | xargs kill -TERM 2>/dev/null || true
  STOPPED_ANY=true
  sleep 2
  # Force kill if still running
  if lsof -ti:3001 >/dev/null 2>&1; then
    echo "   Force killing backend..."
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
  fi
  echo "   ✅ Backend stopped"
else
  echo "   ℹ️  Backend was not running"
fi

# Stop frontend (port 5173)
if lsof -ti:5173 >/dev/null 2>&1; then
  echo "🌐 Stopping frontend server (port 5173)..."
  lsof -ti:5173 | xargs kill -TERM 2>/dev/null || true
  STOPPED_ANY=true
  sleep 2
  # Force kill if still running
  if lsof -ti:5173 >/dev/null 2>&1; then
    echo "   Force killing frontend..."
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
  fi
  echo "   ✅ Frontend stopped"
else
  echo "   ℹ️  Frontend was not running"
fi

# Also kill any related processes (vite, tsx watch, concurrently)
if [ "$STOPPED_ANY" = true ]; then
  echo ""
  echo "🧹 Cleaning up related processes..."
  pkill -f "vite" 2>/dev/null || true
  pkill -f "tsx watch server/index.ts" 2>/dev/null || true
  pkill -f "concurrently" 2>/dev/null || true
  sleep 1
fi

# Verify everything is stopped
echo ""
echo "📊 Final Status:"
BACKEND_STILL_RUNNING=false
FRONTEND_STILL_RUNNING=false

if lsof -ti:3001 >/dev/null 2>&1; then
  echo "   ⚠️  Backend still running on port 3001"
  BACKEND_STILL_RUNNING=true
else
  echo "   ✅ Backend stopped"
fi

if lsof -ti:5173 >/dev/null 2>&1; then
  echo "   ⚠️  Frontend still running on port 5173"
  FRONTEND_STILL_RUNNING=true
else
  echo "   ✅ Frontend stopped"
fi

if [ "$BACKEND_STILL_RUNNING" = false ] && [ "$FRONTEND_STILL_RUNNING" = false ]; then
  echo ""
  echo "✨ All systems stopped successfully!"
else
  echo ""
  echo "⚠️  Some processes may still be running. You may need to manually kill them:"
  if [ "$BACKEND_STILL_RUNNING" = true ]; then
    echo "   lsof -ti:3001 | xargs kill -9"
  fi
  if [ "$FRONTEND_STILL_RUNNING" = true ]; then
    echo "   lsof -ti:5173 | xargs kill -9"
  fi
fi
