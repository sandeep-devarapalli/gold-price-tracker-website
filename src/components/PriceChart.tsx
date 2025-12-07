import { useState, useEffect, useRef } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { Calendar } from 'lucide-react';
import { convertPrice, formatPrice, type CurrencyUnit } from '../utils/priceConverter';
import { fetchChartData } from '../services/api';

interface PriceChartProps {
  currentPrice: number;
  currencyUnit: CurrencyUnit;
}

type TimeRange = '5D' | '1M' | '3M' | '6M' | '1Y';

export function PriceChart({ currentPrice, currencyUnit }: PriceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const [chartData, setChartData] = useState<Array<{ date: string; price: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadChartData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchChartData(timeRange);
        
        // Data is already in INR/g format from API
        // Convert to display currency if needed using the converter utility
        setChartData(response.data.map(item => ({
          date: item.date,
          price: convertPrice(item.price, currencyUnit)
        })));
      } catch (err) {
        console.error('Failed to fetch chart data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load chart data');
      } finally {
        setLoading(false);
      }
    };

    loadChartData();
  }, [timeRange, currencyUnit]);

  const displayData = chartData.length > 0 ? chartData : [];
  const timeRanges: TimeRange[] = ['5D', '1M', '3M', '6M', '1Y'];

  return (
    <div className="bg-slate-800 rounded-2xl shadow-2xl p-6 border border-slate-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div className="flex items-center space-x-2 mb-4 sm:mb-0">
          <Calendar className="h-5 w-5 text-amber-500" />
          <h2 className="text-white">Price Chart</h2>
        </div>
        
        <div className="flex space-x-2">
          {timeRanges.map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg transition-all ${
                timeRange === range
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="h-96 flex items-center justify-center">
          <div className="text-slate-400">Loading chart data...</div>
        </div>
      )}
      {error && (
        <div className="h-96 flex items-center justify-center">
          <div className="text-red-400">Error: {error}</div>
        </div>
      )}
      {!loading && !error && displayData.length > 0 && (
        <div className="h-96">
          <HighchartsReact
            highcharts={Highcharts}
            options={{
              chart: {
                type: 'area',
                backgroundColor: 'transparent',
                height: 384,
              },
              title: {
                text: null,
              },
              xAxis: {
                categories: displayData.map(d => d.date),
                labels: {
                  style: {
                    color: '#94a3b8',
                    fontSize: '12px',
                  },
                },
                lineColor: '#475569',
                tickColor: '#475569',
              },
              yAxis: {
                title: {
                  text: null,
                },
                labels: {
                  style: {
                    color: '#94a3b8',
                    fontSize: '12px',
                  },
                  formatter: function() {
                    return formatPrice(this.value as number, currencyUnit);
                  },
                },
                gridLineColor: '#475569',
                gridLineDashStyle: 'Dash',
              },
              tooltip: {
                backgroundColor: 'rgba(30, 41, 59, 0.95)',
                borderColor: '#475569',
                borderRadius: 8,
                style: {
                  color: '#fff',
                },
                formatter: function() {
                  return `<b>${this.x}</b><br/>${formatPrice(this.y as number, currencyUnit)}`;
                },
              },
              series: [{
                name: 'Price',
                data: displayData.map(d => d.price),
                color: '#f59e0b',
                fillColor: {
                  linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
                  stops: [
                    [0, 'rgba(245, 158, 11, 0.8)'],
                    [1, 'rgba(245, 158, 11, 0)'],
                  ],
                },
                lineWidth: 3,
                marker: {
                  enabled: false,
                },
              }],
              credits: {
                enabled: false,
              },
              legend: {
                enabled: false,
              },
            }}
          />
        </div>
      )}
      {!loading && !error && displayData.length === 0 && (
        <div className="h-96 flex items-center justify-center">
          <div className="text-slate-400">No chart data available</div>
        </div>
      )}

      {displayData.length > 0 && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
            <div className="text-slate-300 text-sm">Period High</div>
            <div className="text-white text-xl mt-1">{formatPrice(Math.max(...displayData.map(d => d.price)), currencyUnit)}</div>
          </div>
          <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
            <div className="text-slate-300 text-sm">Period Low</div>
            <div className="text-white text-xl mt-1">{formatPrice(Math.min(...displayData.map(d => d.price)), currencyUnit)}</div>
          </div>
          <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
            <div className="text-slate-300 text-sm">Avg Price</div>
            <div className="text-white text-xl mt-1">
              {formatPrice(displayData.reduce((acc, d) => acc + d.price, 0) / displayData.length, currencyUnit)}
            </div>
          </div>
          <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
            <div className="text-slate-300 text-sm">Volatility</div>
            <div className="text-white text-xl mt-1">
              {((Math.max(...displayData.map(d => d.price)) - Math.min(...displayData.map(d => d.price))) / Math.min(...displayData.map(d => d.price)) * 100).toFixed(2)}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}