#!/bin/bash

# Check status of all systems

echo "📊 Gold Price Tracker - System Status"
echo "======================================"
echo ""

# Backend status
if lsof -ti:3001 >/dev/null 2>&1; then
  echo "✅ Backend Server"
  echo "   Port: 3001"
  echo "   URL: http://localhost:3001"
  
  # Try to get health status
  HEALTH=$(curl -s http://localhost:3001/health 2>/dev/null)
  if [ ! -z "$HEALTH" ]; then
    echo "   Status: Healthy"
  else
    echo "   Status: Running (health check failed)"
  fi
else
  echo "❌ Backend Server"
  echo "   Status: Stopped"
fi

echo ""

# Frontend status
if lsof -ti:5173 >/dev/null 2>&1; then
  echo "✅ Frontend Server"
  echo "   Port: 5173"
  echo "   URL: http://localhost:5173"
  echo "   Status: Running"
else
  echo "❌ Frontend Server"
  echo "   Status: Stopped"
fi

echo ""

# System status API (if backend is running)
if lsof -ti:3001 >/dev/null 2>&1; then
  echo "📈 Detailed System Status:"
  curl -s http://localhost:3001/api/system/status 2>/dev/null | python3 -m json.tool 2>/dev/null | head -30 || echo "   Unable to fetch system status"
fi

echo ""
