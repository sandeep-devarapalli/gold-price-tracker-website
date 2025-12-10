import { useState, useEffect } from 'react';
import { Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatPrice, type CurrencyUnit } from '../utils/priceConverter';
import { fetchHistoricalPrices } from '../services/api';

interface HistoricalDataProps {
  currencyUnit: CurrencyUnit;
}

interface HistoricalItem {
  period: string;
  price: number;
  change: number;
  percentChange: number;
}

export function HistoricalData({ currencyUnit }: HistoricalDataProps) {
  const [historicalPrices, setHistoricalPrices] = useState<HistoricalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadHistoricalData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch last 365 days to get enough data for comparisons
        const response = await fetchHistoricalPrices(365);
        
        if (response.data.length === 0) {
          setError('No historical data available');
          return;
        }

        const now = new Date();
        const prices = response.data;
        const latest = prices[prices.length - 1];
        
        // Calculate historical points
        const periods = [
          { label: '1 Year Ago', days: 365 },
          { label: '6 Months Ago', days: 180 },
          { label: '3 Months Ago', days: 90 },
          { label: '1 Month Ago', days: 30 },
          { label: 'Yesterday', days: 1 },
        ];

        const historical: HistoricalItem[] = [];
        
        for (const period of periods) {
          const targetDate = new Date(now);
          targetDate.setDate(targetDate.getDate() - period.days);
          
          // Find closest price to target date
          const closestPrice = prices.reduce((prev, curr) => {
            const prevDiff = Math.abs(new Date(prev.timestamp).getTime() - targetDate.getTime());
            const currDiff = Math.abs(new Date(curr.timestamp).getTime() - targetDate.getTime());
            return currDiff < prevDiff ? curr : prev;
          });
          
          if (closestPrice) {
            const price = closestPrice.price_1g;
            const change = latest.price_1g - price;
            const percentChange = price > 0 ? (change / price) * 100 : 0;
            
            historical.push({
              period: period.label,
              price: price,
              change: change,
              percentChange: percentChange
            });
          }
        }

        // Add current as latest
        historical.push({
          period: 'Today',
          price: latest.price_1g,
          change: 0,
          percentChange: 0
        });

        setHistoricalPrices(historical);
      } catch (err) {
        console.error('Failed to fetch historical data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load historical data');
      } finally {
        setLoading(false);
      }
    };

    loadHistoricalData();
  }, [currencyUnit]);
  
  const unitLabel = currencyUnit === 'USD/oz' ? '/oz' : '/g';

  return (
    <div className="bg-slate-800 rounded-2xl shadow-2xl p-6 border border-slate-700">
      <div className="flex items-center space-x-2 mb-6">
        <Clock className="h-6 w-6 text-slate-400" />
        <h2 className="text-white">Historical Price Data</h2>
      </div>

      {/* Historical Prices Table */}
      {loading && (
        <div className="text-slate-400 text-center py-8">Loading historical data...</div>
      )}
      {error && (
        <div className="text-red-400 text-center py-8">Error: {error}</div>
      )}
      {!loading && !error && historicalPrices.length > 0 && (
        <div className="space-y-3 mb-6">
          {historicalPrices.map((item, index) => (
          <div 
            key={index}
            className="flex items-center justify-between p-4 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors border border-slate-600"
          >
            <div>
              <div className="text-white">{item.period}</div>
              <div className="text-slate-400 text-sm">{formatPrice(item.price, currencyUnit)}{unitLabel}</div>
            </div>
            <div className={`flex items-center space-x-1 ${item.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {item.change >= 0 ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : (
                <ArrowDownRight className="h-4 w-4" />
              )}
              <span>{item.change >= 0 ? '+' : ''}{item.percentChange.toFixed(2)}%</span>
            </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}