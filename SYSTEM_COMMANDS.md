# System Management Commands

Simple commands to start, stop, and check the status of all systems.

## Quick Commands

### Start All Systems
```bash
# Start in foreground (recommended for development)
npm run start

# Start in background
npm run start:bg
```

### Stop All Systems
```bash
npm run stop
```

### Check System Status
```bash
npm run status
```

## Current Status

**Backend Server:**
- ✅ Running on port 3001
- URL: http://localhost:3001
- Health: http://localhost:3001/health

**Frontend Server:**
- ❌ Currently stopped
- URL: http://localhost:5173 (when running)

## Details

- **Start**: Starts both backend and frontend servers
- **Stop**: Gracefully stops all running servers
- **Status**: Shows current system status and health

All commands check for running processes and handle cleanup automatically.
