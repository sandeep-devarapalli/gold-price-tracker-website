import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { useState, useEffect } from 'react';
import { convertPrice, formatPrice, type CurrencyUnit } from '../utils/priceConverter';
import { fetch24hStatistics, fetchLatestPrice, fetchMarketCap } from '../services/api';

interface LivePriceCardProps {
  currentPrice: number;
  priceChange: number;
  percentChange: number;
  currencyUnit: CurrencyUnit;
  timestamp?: string | null;
}

function formatTimeAgo(timestamp: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  if (diffSecs > 0) return `${diffSecs}s ago`;
  return 'Just now';
}

function formatDate(timestamp: Date): string {
  return timestamp.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(2)}M`;
  }
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(2)}K`;
  }
  return volume.toFixed(0);
}

function formatMarketCap(marketCap: number): string {
  if (marketCap >= 1_000_000_000_000) {
    return `$${(marketCap / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (marketCap >= 1_000_000_000) {
    return `$${(marketCap / 1_000_000_000).toFixed(2)}B`;
  }
  if (marketCap >= 1_000_000) {
    return `$${(marketCap / 1_000_000).toFixed(2)}M`;
  }
  return `$${marketCap.toFixed(2)}`;
}

export function LivePriceCard({ currentPrice, priceChange, percentChange, currencyUnit, timestamp }: LivePriceCardProps) {
  const [stats24h, setStats24h] = useState<{ high: number; low: number } | null>(null);
  const [volume, setVolume] = useState<number | null>(null);
  const [marketCap, setMarketCap] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Parse the timestamp from API
  const priceDate = timestamp ? new Date(timestamp) : null;

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Fetch 24h stats
        const stats = await fetch24hStatistics();
        setStats24h({
          high: stats.high,
          low: stats.low
        });
        
        // Fetch latest price data (includes volume)
        const priceData = await fetchLatestPrice();
        if (priceData.trading_volume) {
          setVolume(priceData.trading_volume);
        }
        
        // Fetch market cap data (India market cap for INR/g, Global for USD/oz)
        const marketCapData = await fetchMarketCap();
        if (marketCapData.success && marketCapData.data) {
          const indiaCap = marketCapData.data.find(c => c.region === 'India');
          const globalCap = marketCapData.data.find(c => c.region === 'Global');
          
          if (currencyUnit === 'INR/g' && indiaCap) {
            setMarketCap(indiaCap.market_cap_usd);
          } else if (currencyUnit === 'USD/oz' && globalCap) {
            setMarketCap(globalCap.market_cap_usd);
          }
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
        // Use fallback values if API fails
        setStats24h({
          high: currentPrice,
          low: currentPrice
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
    
    // Refresh data every 5 minutes
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentPrice, currencyUnit]);

  const isPositive = priceChange >= 0;
  
  // Convert prices
  const displayPrice = convertPrice(currentPrice, currencyUnit);
  const displayChange = convertPrice(priceChange, currencyUnit);
  
  // Use real 24h stats if available, otherwise use current price as fallback
  const displayHigh = stats24h 
    ? convertPrice(stats24h.high, currencyUnit)
    : convertPrice(currentPrice, currencyUnit);
  const displayLow = stats24h 
    ? convertPrice(stats24h.low, currencyUnit)
    : convertPrice(currentPrice, currencyUnit);

  return (
    <div className="bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 rounded-2xl shadow-2xl p-8 text-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-32 translate-x-32"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white rounded-full translate-y-48 -translate-x-48"></div>
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Activity className="h-6 w-6 animate-pulse" />
            <span className="text-amber-100">Live Gold Price ({currencyUnit})</span>
          </div>
          <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm">
            {priceDate ? formatDate(priceDate) : 'Loading...'}
          </div>
        </div>

        <div className="flex items-baseline space-x-4 mb-4">
          <div className="text-6xl">{formatPrice(displayPrice, currencyUnit)}</div>
          <div className={`flex items-center space-x-1 text-2xl ${isPositive ? 'text-green-100' : 'text-red-100'}`}>
            {isPositive ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
            <span>{isPositive ? '+' : ''}{formatPrice(Math.abs(displayChange), currencyUnit)}</span>
            <span>({isPositive ? '+' : ''}{percentChange.toFixed(2)}%)</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-amber-100 text-sm">24h High</div>
            <div className="text-xl mt-1">
              {loading ? '...' : formatPrice(displayHigh, currencyUnit)}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-amber-100 text-sm">24h Low</div>
            <div className="text-xl mt-1">
              {loading ? '...' : formatPrice(displayLow, currencyUnit)}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-amber-100 text-sm">Volume</div>
            <div className="text-xl mt-1 text-amber-50">
              {loading ? '...' : volume ? formatVolume(volume) : 'N/A'}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-amber-100 text-sm">Market Cap</div>
            <div className="text-xl mt-1 text-amber-50">
              {loading ? '...' : marketCap ? formatMarketCap(marketCap) : 'N/A'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
