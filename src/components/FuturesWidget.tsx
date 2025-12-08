import { TrendingUp, TrendingDown, BarChart3, Activity } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchLatestFutures, type GoldFuturesData } from '../services/api';

export function FuturesWidget() {
  const [futures, setFutures] = useState<GoldFuturesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFuturesData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetchLatestFutures();
        
        if (response.success && response.data) {
          setFutures(response.data);
        } else {
          setError(response.error || 'Failed to load futures data');
        }
      } catch (err) {
        console.error('Failed to fetch futures data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load futures data');
      } finally {
        setLoading(false);
      }
    };

    loadFuturesData();
    
    // Refresh every 5 minutes
    const interval = setInterval(loadFuturesData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (value: number): string => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatVolume = (volume: number | null): string => {
    if (!volume) return 'N/A';
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(2)}M`;
    }
    if (volume >= 1000) {
      return `${(volume / 1000).toFixed(2)}K`;
    }
    return volume.toFixed(0);
  };

  const getContangoStatus = (futures: GoldFuturesData): { status: 'contango' | 'backwardation' | 'neutral'; spread: number } => {
    if (!futures.spot_price) {
      return { status: 'neutral', spread: 0 };
    }
    const spread = futures.futures_price - futures.spot_price;
    const spreadPercent = (spread / futures.spot_price) * 100;
    
    if (spreadPercent > 0.1) return { status: 'contango', spread: spreadPercent };
    if (spreadPercent < -0.1) return { status: 'backwardation', spread: spreadPercent };
    return { status: 'neutral', spread: spreadPercent };
  };

  return (
    <div className="bg-slate-800 rounded-2xl shadow-2xl p-6 border border-slate-700">
      <div className="flex items-center space-x-2 mb-6">
        <Activity className="h-6 w-6 text-yellow-400" />
        <h2 className="text-white text-xl font-bold">Gold Futures</h2>
      </div>

      {loading && (
        <div className="text-center py-8 text-slate-400">
          <div className="animate-pulse">Loading futures data...</div>
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-8 text-red-400">
          <div>Error: {error}</div>
          <div className="text-sm text-slate-400 mt-2">Futures data may not be available yet</div>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-4">
          {futures.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>No futures data available</p>
            </div>
          ) : (
            futures.map((future) => {
              const contango = getContangoStatus(future);
              const isPositive = future.percent_change >= 0;
              
              return (
                <div key={`${future.exchange}-${future.contract_symbol}`} className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-white font-semibold text-lg">
                        {future.exchange} {future.contract_symbol}
                      </h3>
                      <p className="text-slate-400 text-sm">
                        {future.exchange === 'MCX' ? 'Multi Commodity Exchange (India)' : 'COMEX (Global)'}
                        {future.expiry_date && (
                          <span className="ml-2 text-yellow-400">
                            • Exp: {new Date(future.expiry_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-white text-2xl font-bold">
                        {future.exchange === 'MCX' ? '₹' : '$'}{formatPrice(future.futures_price)}
                      </div>
                      <div className={`flex items-center space-x-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositive ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        <span className="text-sm font-semibold">
                          {isPositive ? '+' : ''}{future.percent_change.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-600">
                    {future.spot_price && (
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Spot Price</p>
                        <p className="text-white font-semibold">
                          {future.exchange === 'MCX' ? '₹' : '$'}{formatPrice(future.spot_price)}
                        </p>
                        <div className={`text-xs mt-1 ${contango.status === 'contango' ? 'text-green-400' : contango.status === 'backwardation' ? 'text-red-400' : 'text-slate-400'}`}>
                          {contango.status === 'contango' && '📈 Contango'}
                          {contango.status === 'backwardation' && '📉 Backwardation'}
                          {contango.status === 'neutral' && '➡️ Neutral'}
                          {contango.spread !== 0 && ` (${contango.spread > 0 ? '+' : ''}${contango.spread.toFixed(2)}%)`}
                        </div>
                      </div>
                    )}
                    
                    {future.trading_volume && (
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Trading Volume</p>
                        <p className="text-white font-semibold">{formatVolume(future.trading_volume)}</p>
                      </div>
                    )}
                    
                    {future.open_interest && (
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Open Interest</p>
                        <p className="text-white font-semibold">{formatVolume(future.open_interest)}</p>
                      </div>
                    )}
                    
                    <div>
                      <p className="text-slate-400 text-xs mb-1">Change</p>
                      <p className={`font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositive ? '+' : ''}{future.exchange === 'MCX' ? '₹' : '$'}{formatPrice(future.change)}
                      </p>
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

