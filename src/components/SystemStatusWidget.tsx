import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, XCircle, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchSystemStatus, type SystemStatus } from '../services/api';

export function SystemStatusWidget() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        setError(null);
        const response = await fetchSystemStatus();
        setStatus(response.data);
      } catch (err) {
        console.error('Failed to fetch system status:', err);
        setError(err instanceof Error ? err.message : 'Failed to load status');
      } finally {
        setLoading(false);
      }
    };

    loadStatus();
    // Refresh every 30 seconds
    const interval = setInterval(loadStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-gray-900/95 backdrop-blur-sm border border-gray-800 rounded-lg shadow-lg px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Activity className="w-4 h-4 animate-pulse" />
          <span>Checking status...</span>
        </div>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-gray-900/95 backdrop-blur-sm border border-red-500/50 rounded-lg shadow-lg px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-red-400">
          <XCircle className="w-4 h-4" />
          <span>Status unavailable</span>
        </div>
      </div>
    );
  }

  const isOperational = status.overall_status === 'operational';
  const scrapersToday = status.scrapers_today;
  const scrapersCount = Object.values(scrapersToday).filter(Boolean).length;
  const totalScrapers = Object.keys(scrapersToday).length;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-gray-900/95 backdrop-blur-sm border border-gray-800 rounded-lg shadow-lg overflow-hidden transition-all duration-300">
      {/* Compact Status Bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center justify-between gap-3 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isOperational ? (
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-yellow-400" />
          )}
          <span className="text-sm font-medium text-white">
            {isOperational ? 'All Systems Up' : 'System Degraded'}
          </span>
          <span className="text-xs text-gray-400">
            ({scrapersCount}/{totalScrapers} scrapers today)
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 py-3 border-t border-gray-800 space-y-3 min-w-[320px]">
          {/* Backend Status */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Backend</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-400">Online</span>
            </div>
          </div>

          {/* Database Status */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Database</span>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  status.components.database.status === 'ok'
                    ? 'bg-green-400 animate-pulse'
                    : 'bg-red-400'
                }`}
              />
              <span
                className={`text-xs ${
                  status.components.database.status === 'ok'
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}
              >
                {status.components.database.status === 'ok' ? 'Connected' : 'Error'}
              </span>
            </div>
          </div>

          {/* Scrapers Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Scrapers Today</span>
              <span className="text-xs text-gray-300">
                {scrapersCount}/{totalScrapers} ran
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    scrapersToday.gold_price ? 'bg-green-400' : 'bg-gray-600'
                  }`}
                />
                <span className="text-xs text-gray-300">Gold</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    scrapersToday.bitcoin ? 'bg-green-400' : 'bg-gray-600'
                  }`}
                />
                <span className="text-xs text-gray-300">Bitcoin</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    scrapersToday.markets ? 'bg-green-400' : 'bg-gray-600'
                  }`}
                />
                <span className="text-xs text-gray-300">Markets</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    scrapersToday.news ? 'bg-green-400' : 'bg-gray-600'
                  }`}
                />
                <span className="text-xs text-gray-300">News</span>
              </div>
            </div>
          </div>

          {/* Next Runs */}
          {status.scheduler && (
            <div className="pt-2 border-t border-gray-800">
              <div className="space-y-1">
                {status.scheduler.schedulers.slice(0, 2).map((scheduler) => (
                  <div key={scheduler.name} className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{scheduler.name}</span>
                    <span className="text-xs text-gray-500">{scheduler.next_run}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Uptime */}
          <div className="pt-2 border-t border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Uptime</span>
              <span className="text-xs text-gray-300">
                {Math.floor(status.components.backend.uptime / 3600)}h{' '}
                {Math.floor((status.components.backend.uptime % 3600) / 60)}m
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

