import { DollarSign, Globe, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchMarketCap, type MarketCapData } from '../services/api';

export function MarketCapWidget() {
  const [marketCap, setMarketCap] = useState<MarketCapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMarketCapData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetchMarketCap();
        
        if (response.success && response.data) {
          setMarketCap(response.data);
        } else {
          setError(response.error || 'Failed to load market cap data');
        }
      } catch (err) {
        console.error('Failed to fetch market cap data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load market cap data');
      } finally {
        setLoading(false);
      }
    };

    loadMarketCapData();
    
    // Refresh daily (market cap updates quarterly)
    const interval = setInterval(loadMarketCapData, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatMarketCap = (value: number): string => {
    if (value >= 1_000_000_000_000) {
      return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
    }
    if (value >= 1_000_000_000) {
      return `$${(value / 1_000_000_000).toFixed(2)}B`;
    }
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(2)}M`;
    }
    return `$${value.toFixed(2)}`;
  };

  const formatTonnes = (tonnes: number | null): string => {
    if (!tonnes) return 'N/A';
    if (tonnes >= 1000) {
      return `${(tonnes / 1000).toFixed(1)}K tonnes`;
    }
    return `${tonnes.toFixed(0)} tonnes`;
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-slate-800 rounded-2xl shadow-2xl p-6 border border-slate-700">
      <div className="flex items-center space-x-2 mb-6">
        <DollarSign className="h-6 w-6 text-green-400" />
        <h2 className="text-white text-xl font-bold">Gold Market Cap</h2>
      </div>

      {loading && (
        <div className="text-center py-8 text-slate-400">
          <div className="animate-pulse">Loading market cap data...</div>
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-8 text-red-400">
          <div>Error: {error}</div>
          <div className="text-sm text-slate-400 mt-2">Market cap data may not be available yet</div>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-4">
          {marketCap.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Globe className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>No market cap data available</p>
            </div>
          ) : (
            marketCap.map((cap) => (
              <div key={cap.region} className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    {cap.region === 'Global' ? (
                      <Globe className="h-5 w-5 text-blue-400" />
                    ) : (
                      <TrendingUp className="h-5 w-5 text-yellow-400" />
                    )}
                    <h3 className="text-white font-semibold text-lg">{cap.region}</h3>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-slate-400 text-xs mb-1">Market Capitalization</p>
                    <p className="text-white text-2xl font-bold">{formatMarketCap(cap.market_cap_usd)}</p>
                  </div>

                  {cap.gold_holdings_tonnes && (
                    <div>
                      <p className="text-slate-400 text-xs mb-1">Gold Holdings</p>
                      <p className="text-white font-semibold">{formatTonnes(cap.gold_holdings_tonnes)}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-slate-600">
                    <div>
                      <p className="text-slate-400 text-xs mb-1">Source</p>
                      <p className="text-white text-sm">{cap.source}</p>
                    </div>
                    {cap.report_date && (
                      <div className="text-right">
                        <p className="text-slate-400 text-xs mb-1">Last Updated</p>
                        <p className="text-white text-sm">{formatDate(cap.report_date)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {marketCap.length === 2 && (
            <div className="mt-4 pt-4 border-t border-slate-600">
              <div className="bg-slate-700 rounded-lg p-3">
                <p className="text-slate-400 text-xs mb-2">India vs Global</p>
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm">India Share</span>
                  <span className="text-white font-semibold">
                    {((marketCap.find(c => c.region === 'India')?.market_cap_usd || 0) / 
                      (marketCap.find(c => c.region === 'Global')?.market_cap_usd || 1) * 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

