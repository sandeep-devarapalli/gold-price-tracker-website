import { TrendingUp, TrendingDown, BarChart3, DollarSign } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchLatestETFs, type GoldETFData } from '../services/api';

export function GoldETFWidget() {
  const [etfs, setEtfs] = useState<GoldETFData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadETFData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetchLatestETFs();
        
        if (response.success && response.data) {
          // Sort by AUM (largest first) or by name if AUM not available
          const sorted = [...response.data].sort((a, b) => {
            if (a.aum_crore && b.aum_crore) {
              return b.aum_crore - a.aum_crore;
            }
            return a.etf_name.localeCompare(b.etf_name);
          });
          setEtfs(sorted);
        } else {
          setError(response.error || 'Failed to load ETF data');
        }
      } catch (err) {
        console.error('Failed to fetch ETF data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load ETF data');
      } finally {
        setLoading(false);
      }
    };

    loadETFData();
    
    // Refresh every 5 minutes
    const interval = setInterval(loadETFData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (value: number): string => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatAUM = (aum: number | undefined): string => {
    if (!aum) return 'N/A';
    if (aum >= 1000) {
      return `₹${(aum / 1000).toFixed(2)}K cr`;
    }
    return `₹${aum.toFixed(2)} cr`;
  };

  return (
    <div className="bg-slate-800 rounded-2xl shadow-2xl p-6 border border-slate-700">
      <div className="flex items-center space-x-2 mb-6">
        <DollarSign className="h-6 w-6 text-yellow-400" />
        <h2 className="text-white text-xl font-bold">Gold ETFs (India)</h2>
      </div>

      {loading && (
        <div className="text-center py-8 text-slate-400">
          <div className="animate-pulse">Loading Gold ETF data...</div>
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-8 text-red-400">
          <div>Error: {error}</div>
          <div className="text-sm text-slate-400 mt-2">ETF data may not be available yet</div>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-4">
          {etfs.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>No Gold ETF data available</p>
            </div>
          ) : (
            etfs.map((etf) => {
              const isPositive = etf.percent_change >= 0;
              const changeColor = isPositive ? 'text-green-400' : 'text-red-400';
              
              return (
                <div key={etf.symbol} className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-white font-semibold text-lg">
                        {etf.etf_name}
                      </h3>
                      <p className="text-slate-400 text-sm">
                        {etf.symbol} • {etf.exchange}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-white text-2xl font-bold">
                        ₹{formatPrice(etf.nav_price)}
                      </div>
                      <div className={`flex items-center space-x-1 ${changeColor}`}>
                        {isPositive ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        <span className="text-sm font-semibold">
                          {isPositive ? '+' : ''}{etf.percent_change.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-600">
                    <div>
                      <p className="text-slate-400 text-xs mb-1">Change</p>
                      <p className={`font-semibold ${changeColor}`}>
                        {isPositive ? '+' : ''}₹{formatPrice(etf.change)}
                      </p>
                    </div>
                    
                    {etf.aum_crore && (
                      <div>
                        <p className="text-slate-400 text-xs mb-1">AUM</p>
                        <p className="text-white font-semibold">{formatAUM(etf.aum_crore)}</p>
                      </div>
                    )}
                    
                    {etf.expense_ratio && (
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Expense Ratio</p>
                        <p className="text-white font-semibold">{etf.expense_ratio.toFixed(2)}%</p>
                      </div>
                    )}
                    
                    <div>
                      <p className="text-slate-400 text-xs mb-1">Exchange</p>
                      <p className="text-white font-semibold">{etf.exchange}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

