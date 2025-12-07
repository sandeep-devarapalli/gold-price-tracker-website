import { Bitcoin, TrendingUp, TrendingDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchLatestBitcoinPrice, type BitcoinPrice as BitcoinPriceData } from '../services/api';

export function BitcoinPrice() {
  const [bitcoinPrice, setBitcoinPrice] = useState<BitcoinPriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBitcoinData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const priceResponse = await fetchLatestBitcoinPrice();
        
        if (priceResponse.success && priceResponse.data) {
          setBitcoinPrice(priceResponse.data);
        }
      } catch (err) {
        console.error('Failed to fetch Bitcoin data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load Bitcoin data');
      } finally {
        setLoading(false);
      }
    };

    loadBitcoinData();
    const interval = setInterval(loadBitcoinData, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatUSD = (price: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatINR = (price: number): string => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const isPositive = bitcoinPrice?.percent_change_24h && bitcoinPrice.percent_change_24h >= 0;
  const changeColor = isPositive ? 'text-green-400' : 'text-red-400';

  return (
    <div className="bg-slate-800 rounded-2xl shadow-2xl p-6 border border-slate-700">
      {/* Header */}
      <div className="flex items-center space-x-2 mb-6">
        <Bitcoin className="h-6 w-6 text-orange-400" />
        <h2 className="text-white">Bitcoin Price</h2>
      </div>

      {loading && !bitcoinPrice && (
        <div className="text-center py-8 text-slate-400">
          <div className="animate-pulse">Loading Bitcoin data...</div>
        </div>
      )}

      {error && !loading && !bitcoinPrice && (
        <div className="text-center py-8 text-slate-400">
          <Bitcoin className="h-12 w-12 mx-auto mb-2 opacity-30" />
          <p>No Bitcoin data available yet</p>
        </div>
      )}

      {bitcoinPrice && (
        <div className="bg-slate-700 rounded-lg p-4 border border-slate-600 hover:border-orange-500 transition-colors">
          {/* Top Row: Name & Change */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-white font-semibold">BTC / USD</h3>
              <div className="text-slate-400 text-sm">Cryptocurrency</div>
            </div>
            <div className={`flex items-center space-x-1 ${changeColor}`}>
              {isPositive ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )}
              <span className="text-sm font-medium">
                {isPositive ? '+' : ''}{bitcoinPrice.percent_change_24h.toFixed(2)}%
              </span>
            </div>
          </div>
          
          {/* Price Row */}
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-2xl font-bold text-white">
              {formatUSD(bitcoinPrice.price_usd)}
            </div>
            <div className={`text-sm ${changeColor}`}>
              {isPositive ? '+' : ''}{formatUSD(bitcoinPrice.change_24h)}
            </div>
          </div>

          {/* INR Price */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-600">
            <div className="text-slate-400 text-sm">INR Value</div>
            <div className="text-white font-medium">₹{formatINR(bitcoinPrice.price_inr)}</div>
          </div>
          
          {/* Updated timestamp */}
          {bitcoinPrice.timestamp && (
            <div className="text-xs text-slate-500 mt-3">
              Updated: {new Date(bitcoinPrice.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, {new Date(bitcoinPrice.timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
