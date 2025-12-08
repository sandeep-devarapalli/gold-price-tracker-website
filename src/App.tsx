import { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { LivePriceCard } from './components/LivePriceCard';
import { PriceChart } from './components/PriceChart';
import { HistoricalData } from './components/HistoricalData';
import { PredictionComparison } from './components/PredictionComparison';
import { AIRecommendations } from './components/AIRecommendations';
import { MarketNews } from './components/MarketNews';
import { PriceAlerts } from './components/PriceAlerts';
import { MarketWidget } from './components/MarketWidget';
import { BitcoinPrice } from './components/BitcoinPrice';
import { SystemStatusWidget } from './components/SystemStatusWidget';
import { FuturesWidget } from './components/FuturesWidget';
import { MarketCapWidget } from './components/MarketCapWidget';
import { GoldETFWidget } from './components/GoldETFWidget';
import { fetchLatestPrice } from './services/api';

export default function App() {
  const [currentPrice, setCurrentPrice] = useState(13831.20); // Default fallback price in INR/g (will be updated by API)
  const [priceChange, setPriceChange] = useState(0);
  const [percentChange, setPercentChange] = useState(0);
  const [priceTimestamp, setPriceTimestamp] = useState<string | null>(null);
  const [currencyUnit, setCurrencyUnit] = useState<'USD/oz' | 'INR/g'>('INR/g');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch latest price from API
  useEffect(() => {
    const loadPrice = async () => {
      try {
        setError(null);
        const priceData = await fetchLatestPrice();
        
        // Price data is in INR/g format from API
        setCurrentPrice(priceData.price_1g);
        setPriceChange(priceData.change);
        setPercentChange(priceData.percentChange);
        setPriceTimestamp(priceData.timestamp);
      } catch (err) {
        console.error('Failed to fetch price:', err);
        setError(err instanceof Error ? err.message : 'Failed to load price data');
        // Keep default/previous values on error
      } finally {
        setLoading(false);
      }
    };

    loadPrice();

    // Poll for updates every 60 seconds
    const interval = setInterval(loadPrice, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black">
      <Navigation currencyUnit={currencyUnit} setCurrencyUnit={setCurrencyUnit} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section with Live Price */}
        <div className="mb-8">
          <LivePriceCard 
            currentPrice={currentPrice}
            priceChange={priceChange}
            percentChange={percentChange}
            currencyUnit={currencyUnit}
            timestamp={priceTimestamp}
          />
        </div>

        {/* Interactive Chart Section */}
        <div className="mb-8">
          <PriceChart currentPrice={currentPrice} currencyUnit={currencyUnit} />
        </div>

        {/* AI Recommendations */}
        <div className="mb-8">
          <AIRecommendations currentPrice={currentPrice} currencyUnit={currencyUnit} />
        </div>

        {/* Prediction vs Actual */}
        <div className="mb-8">
          <PredictionComparison currencyUnit={currencyUnit} />
        </div>

        {/* Historical Data & Market News Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <HistoricalData currencyUnit={currencyUnit} />
          <MarketNews />
        </div>

        {/* Market Data Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <MarketWidget marketType="US" />
          <MarketWidget marketType="India" includeCurrency={true} />
        </div>

        {/* Gold Futures & Market Cap Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <FuturesWidget />
          <MarketCapWidget />
        </div>

        {/* Gold ETFs Section */}
        <div className="mb-8">
          <GoldETFWidget />
        </div>

        {/* Bitcoin Price Section */}
        <div className="mb-8">
          <BitcoinPrice />
        </div>

        {/* Price Alerts */}
        <div className="mb-8">
          <PriceAlerts currentPrice={currentPrice} currencyUnit={currencyUnit} />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>Gold Price Tracker © 2025 | Market data sourced from Google Finance</p>
          {error && (
            <p className="text-red-400 mt-2 text-sm">⚠️ {error}</p>
          )}
        </div>
      </footer>

      {/* System Status Widget - Fixed position bottom right */}
      <SystemStatusWidget />
    </div>
  );
}