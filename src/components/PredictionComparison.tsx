import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { Target, TrendingUp } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { formatPrice, type CurrencyUnit } from '../utils/priceConverter';
import { fetchCombinedPredictions, type PredictionWithActual } from '../services/api';

interface PredictionComparisonProps {
  currencyUnit: CurrencyUnit;
}

interface ComparisonDataPoint {
  date: string; // Formatted date for display
  dateISO: string; // ISO date string for comparison
  predicted: number | null; // Can be null for dates without predictions
  actual: number | null;
  error: number | null;
}

export function PredictionComparison({ currencyUnit }: PredictionComparisonProps) {
  const [predictions, setPredictions] = useState<PredictionWithActual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPredictions = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch combined predictions: past 7 days + future 7 days
      const response = await fetchCombinedPredictions(7, 7);
      if (response.success && response.data) {
        setPredictions(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch predictions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load predictions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPredictions();
  }, []);

  // Transform combined predictions into chart data
  // Includes both predictions and actual prices (some dates may have only actuals)
  const comparisonData = useMemo<ComparisonDataPoint[]>(() => {
    if (predictions.length === 0) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Sort predictions by date
    const sortedPredictions = [...predictions].sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    const dataPoints: ComparisonDataPoint[] = [];

    sortedPredictions.forEach(pred => {
      const predDate = new Date(pred.date);
      predDate.setHours(0, 0, 0, 0);
      
      const predicted = pred.predicted_price_1g; // Can be null for dates without predictions
      const actual = pred.actual_price_1g;
      const error = (actual !== null && predicted !== null) ? Math.abs(actual - predicted) : null;

      dataPoints.push({
        date: predDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dateISO: pred.date, // Keep original ISO date for comparison
        predicted, // Can be null for dates without predictions
        actual,
        error
      });
    });

    return dataPoints;
  }, [predictions]);

  const avgConfidence = useMemo(() => {
    // Only count predictions that have actual confidence values (not null)
    const predsWithConfidence = predictions.filter(p => p.confidence !== null && p.confidence > 0);
    if (predsWithConfidence.length === 0) return 0;
    const total = predsWithConfidence.reduce((sum, p) => sum + (p.confidence || 0), 0);
    return Math.round(total / predsWithConfidence.length);
  }, [predictions]);
  
  // Calculate average confidence for future predictions only
  const futureConfidence = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futurePreds = predictions.filter(pred => {
      const predDate = new Date(pred.date);
      predDate.setHours(0, 0, 0, 0);
      return predDate > today;
    });
    if (futurePreds.length === 0) return 0;
    const total = futurePreds.reduce((sum, p) => sum + (p.confidence || 0), 0);
    return Math.round(total / futurePreds.length);
  }, [predictions]);

  const avgError = useMemo(() => {
    const errors = comparisonData.filter(d => d.error !== null).map(d => d.error!);
    if (errors.length === 0) return 0;
    return errors.reduce((sum, e) => sum + e, 0) / errors.length;
  }, [comparisonData]);

  const accuracy = useMemo(() => {
    if (comparisonData.length === 0 || avgError === 0) return 100;
    const avgPredicted = comparisonData.reduce((sum, d) => sum + d.predicted, 0) / comparisonData.length;
    if (avgPredicted === 0) return 0;
    const errorRate = avgError / avgPredicted;
    return Math.max(0, Math.min(100, (1 - errorRate) * 100));
  }, [comparisonData, avgError]);

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-2xl shadow-2xl p-6 border border-slate-700">
        <div className="text-center py-8 text-slate-400">
          <div className="animate-pulse">Loading predictions...</div>
        </div>
      </div>
    );
  }

  if (error && predictions.length === 0) {
    return (
      <div className="bg-slate-800 rounded-2xl shadow-2xl p-6 border border-slate-700">
        <div className="text-center py-8 text-red-400">
          <div>Error: {error}</div>
          <div className="text-slate-400 text-sm mt-2">Predictions will be generated automatically after news scraping</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-2xl shadow-2xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Target className="h-6 w-6 text-indigo-400" />
          <h2 className="text-white">Prediction vs Actual Performance</h2>
        </div>
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-lg">
            <div className="text-sm opacity-90">Avg Confidence</div>
            <div className="text-xl">{avgConfidence}%</div>
          </div>
        </div>
      </div>

      {comparisonData.length > 0 && (
        <>
          <div className="h-80 mb-6">
            <HighchartsReact
              highcharts={Highcharts}
              options={{
                chart: {
                  type: 'line',
                  backgroundColor: 'transparent',
                  height: 320,
                },
                title: {
                  text: null,
                },
                xAxis: {
                  categories: comparisonData.map(d => d.date),
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
                  shared: true,
                  formatter: function() {
                    const index = this.x as number;
                    const point = comparisonData[index];
                    let tooltip = `<b>${point.date}</b><br/>`;
                    if (point.predicted !== null && point.predicted > 0) {
                      tooltip += `Predicted: ${formatPrice(point.predicted, currencyUnit)}<br/>`;
                    }
                    if (point.actual !== null) {
                      tooltip += `Actual: ${formatPrice(point.actual, currencyUnit)}<br/>`;
                      if (point.error !== null) {
                        tooltip += `Error: ${formatPrice(point.error, currencyUnit)}`;
                      }
                    } else if (point.predicted !== null) {
                      tooltip += `Actual: Not available yet`;
                    }
                    return tooltip;
                  },
                },
                legend: {
                  itemStyle: {
                    color: '#94a3b8',
                  },
                },
                series: (() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const todayStr = today.toISOString().split('T')[0];
                  
                  // Separate past and future predictions
                  const pastPredictions: (number | null)[] = [];
                  const futurePredictions: (number | null)[] = [];
                  const actualPrices: (number | null)[] = [];
                  
                  comparisonData.forEach((d) => {
                    // Use ISO date for accurate comparison
                    const isFuture = d.dateISO > todayStr;
                    
                    if (isFuture) {
                      pastPredictions.push(null);
                      futurePredictions.push(d.predicted);
                    } else {
                      // Only add to past predictions if there's actually a prediction
                      pastPredictions.push(d.predicted);
                      futurePredictions.push(null);
                    }
                    actualPrices.push(d.actual);
                  });
                  
                  const series: any[] = [];
                  
                  // Add actual prices series FIRST (so it appears behind predictions)
                  // Use connectNulls: true so the line connects all actual price points
                  if (actualPrices.some(p => p !== null)) {
                    series.push({
                      name: 'Actual Price',
                      data: actualPrices,
                      color: '#10b981',
                      lineWidth: 3,
                      marker: {
                        enabled: true,
                        radius: 5,
                        fillColor: '#10b981',
                        lineWidth: 2,
                        lineColor: '#ffffff',
                        symbol: 'circle',
                      },
                      connectNulls: true, // Connect actual prices across gaps
                      enableMouseTracking: true,
                      zIndex: 1,
                    });
                  }
                  
                  // Add past predictions series (if any have actual predictions)
                  if (pastPredictions.some(p => p !== null && p > 0)) {
                    series.push({
                      name: 'Past Predictions',
                      data: pastPredictions,
                      color: '#f97316', // Orange color (orange-500)
                      lineWidth: 2,
                      dashStyle: 'Dash',
                      marker: {
                        enabled: true,
                        radius: 4,
                        symbol: 'diamond',
                        fillColor: '#f97316',
                        lineColor: '#fff',
                      },
                      connectNulls: false,
                      zIndex: 2,
                    });
                  }
                  
                  // Add future predictions series
                  if (futurePredictions.some(p => p !== null && p > 0)) {
                    series.push({
                      name: 'Future Predictions',
                      data: futurePredictions,
                      color: '#6366f1', // Blue
                      lineWidth: 2,
                      dashStyle: 'Dash',
                      marker: {
                        enabled: true,
                        radius: 4,
                        symbol: 'diamond',
                      },
                      connectNulls: false,
                      zIndex: 2,
                    });
                  }
                  
                  return series;
                })(),
                credits: {
                  enabled: false,
                },
              }}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
              <div className="flex items-center space-x-2 mb-2">
                <div className="h-3 w-3 bg-indigo-500 rounded-full"></div>
                <span className="text-slate-300 text-sm">Predicted (Avg)</span>
              </div>
              <div className="text-white text-xl">
                {(() => {
                  // Calculate average of only FUTURE predictions (exclude today's actual price)
                  const futurePredictions = comparisonData.filter(d => d.actual === null && d.predicted !== null && d.predicted > 0);
                  if (futurePredictions.length === 0) {
                    // Fallback: use all predictions with values if no future ones found
                    const allPredictions = comparisonData.filter(d => d.predicted !== null && d.predicted > 0);
                    if (allPredictions.length === 0) return formatPrice(0, currencyUnit);
                    const avg = allPredictions.reduce((sum, d) => sum + (d.predicted || 0), 0) / allPredictions.length;
                    return formatPrice(avg, currencyUnit);
                  }
                  const avg = futurePredictions.reduce((sum, d) => sum + (d.predicted || 0), 0) / futurePredictions.length;
                  return formatPrice(avg, currencyUnit);
                })()}
              </div>
            </div>

            {comparisonData.some(d => d.actual !== null) && (
              <>
                <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                    <span className="text-slate-300 text-sm">Actual (Avg)</span>
                  </div>
                  <div className="text-white text-xl">
                    {formatPrice(
                      comparisonData
                        .filter(d => d.actual !== null)
                        .reduce((sum, d) => sum + (d.actual || 0), 0) /
                        comparisonData.filter(d => d.actual !== null).length,
                      currencyUnit
                    )}
                  </div>
                </div>

                <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                  <div className="text-slate-300 text-sm mb-2">Avg Error</div>
                  <div className="text-white text-xl">{formatPrice(avgError, currencyUnit)}</div>
                </div>

                <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                  <div className="text-slate-300 text-sm mb-2">Accuracy</div>
                  <div className="text-white text-xl">{accuracy.toFixed(1)}%</div>
                </div>
              </>
            )}
          </div>

          {comparisonData.length > 0 && (
            <div className="mt-6 bg-slate-700 rounded-xl p-4 border border-slate-600">
              <div className="text-slate-400 text-sm mb-2">Prediction Details</div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {predictions
                  .filter(pred => pred.predicted_price_1g !== null && pred.predicted_price_1g > 0)
                  .slice(0, 5)
                  .map((pred, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span className="text-slate-300">
                        {new Date(pred.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="text-white">{formatPrice(pred.predicted_price_1g || 0, currencyUnit)}</span>
                      <span className="text-slate-400">({pred.confidence || 0}% confidence)</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {predictions.length === 0 && !loading && !error && (
        <div className="text-center py-8 text-slate-400">
          <Target className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No predictions available yet</p>
          <p className="text-sm mt-2 opacity-75">Predictions will be generated automatically after news scraping</p>
        </div>
      )}
    </div>
  );
}