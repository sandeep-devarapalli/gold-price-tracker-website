import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchUSMarketData, fetchIndiaMarketData, fetchLatestMarketData, type MarketData } from '../services/api';

interface MarketWidgetProps {
  marketType: 'US' | 'India';
  includeCurrency?: boolean;
}

export function MarketWidget({ marketType, includeCurrency = false }: MarketWidgetProps) {
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMarketData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = marketType === 'US' 
          ? await fetchUSMarketData()
          : await fetchIndiaMarketData();
        
        let marketData = response.data || [];

        // If includeCurrency is true and marketType is India, fetch currency data and append it
        if (includeCurrency && marketType === 'India') {
          try {
            const currencyResponse = await fetchLatestMarketData('Currency');
            if (currencyResponse.success && currencyResponse.data) {
              marketData = [...marketData, ...currencyResponse.data];
            }
          } catch (currencyErr) {
            console.warn('Failed to fetch currency data:', currencyErr);
          }
        }
        
        if (response.success) {
          setMarkets(marketData);
        } else {
          setError('Failed to load market data');
        }
      } catch (err) {
        console.error(`Failed to fetch ${marketType} market data:`, err);
        setError(err instanceof Error ? err.message : 'Failed to load market data');
      } finally {
        setLoading(false);
      }
    };

    loadMarketData();
    
    // Refresh every 5 minutes
    const interval = setInterval(loadMarketData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [marketType]);

  const formatValue = (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(2)}K`;
    }
    return value.toFixed(2);
  };

  const formatPrice = (value: number): string => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="bg-slate-800 rounded-2xl shadow-2xl p-6 border border-slate-700">
      <div className="flex items-center space-x-2 mb-6">
        <BarChart3 className="h-6 w-6 text-blue-400" />
        <h2 className="text-white">{marketType === 'US' ? 'US Markets' : 'India Markets'}</h2>
      </div>

      {loading && (
        <div className="text-center py-8 text-slate-400">
          <div className="animate-pulse">Loading market data...</div>
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-8 text-red-400">
          <div>Error: {error}</div>
          <div className="text-sm text-slate-400 mt-2">Market data may not be available yet</div>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-4">
          {markets.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>No market data available yet</p>
            </div>
          ) : (
            markets.map((market) => {
              const isPositive = market.change >= 0;
              const changeColor = isPositive ? 'text-green-400' : 'text-red-400';
              
              return (
                <div
                  key={`${market.market_type}-${market.index_name}`}
                  className="bg-slate-700 rounded-lg p-4 border border-slate-600 hover:border-blue-500 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-white font-semibold">{market.index_name}</h3>
                      <div className="text-slate-400 text-sm">
                        {market.market_type === 'Currency' 
                          ? 'Exchange Rate' 
                          : marketType === 'US' ? 'US Market' : 'India Market'}
                      </div>
                    </div>
                    <div className={`flex items-center space-x-1 ${changeColor}`}>
                      {isPositive ? (
                        <TrendingUp className="h-5 w-5" />
                      ) : (
                        <TrendingDown className="h-5 w-5" />
                      )}
                      <span className="text-sm font-medium">
                        {isPositive ? '+' : ''}{market.percent_change.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-baseline justify-between">
                    <div className="text-2xl font-bold text-white">
                      {market.market_type === 'Currency'
                        ? `₹${market.value.toFixed(2)}`
                        : marketType === 'US' 
                          ? formatValue(market.value)
                          : formatPrice(market.value)
                      }
                    </div>
                    <div className={`text-sm ${changeColor}`}>
                      {isPositive ? '+' : ''}
                      {market.market_type === 'Currency'
                        ? `₹${Math.abs(market.change).toFixed(2)}`
                        : marketType === 'US'
                          ? `$${formatValue(Math.abs(market.change))}`
                          : `₹${formatPrice(Math.abs(market.change))}`
                      }
                    </div>
                  </div>
                  
                  {market.timestamp && (
                    <div className="text-xs text-slate-500 mt-2">
                      Updated: {new Date(market.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, {new Date(market.timestamp).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

