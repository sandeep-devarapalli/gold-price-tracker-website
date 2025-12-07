import { Brain, TrendingUp, TrendingDown, AlertCircle, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatPrice, type CurrencyUnit } from '../utils/priceConverter';
import { fetchLatestAnalysis, generatePredictions, type PredictionAnalysis } from '../services/api';

interface AIRecommendationsProps {
  currentPrice: number;
  currencyUnit: CurrencyUnit;
}

export function AIRecommendations({ currentPrice, currencyUnit }: AIRecommendationsProps) {
  const [analysis, setAnalysis] = useState<PredictionAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [articleSummaries, setArticleSummaries] = useState<string[]>([]);
  
  const recommendation = analysis?.recommendation || 'hold';
  const confidence = analysis?.confidence || 60;
  const newsSentiment = analysis?.news_sentiment || 50;
  const marketSentiment = analysis?.market_sentiment || 'neutral';
  
  const predictions = analysis?.predictions || [];
  const predictedPrices = predictions.map(p => p.predicted_price_1g);
  
  let showBuyWindow = false;
  
  if (predictedPrices.length > 0) {
    const minPredictedPrice = Math.min(...predictedPrices);
    if (minPredictedPrice < currentPrice) {
      showBuyWindow = true;
    }
  }

  const loadAnalysis = async (forceGenerate: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      
      if (!forceGenerate) {
        try {
          const existingResponse = await fetchLatestAnalysis();
          if (existingResponse.success && existingResponse.data) {
            setAnalysis(existingResponse.data);
            const summaries = existingResponse.data.article_summaries || [];
            setArticleSummaries(summaries.slice(0, 5));
            setLoading(false);
            return;
          }
        } catch (fetchError) {
          console.log('No existing analysis found, will generate new one');
        }
      }
      
      const response = await generatePredictions(7);
      if (response.success && response.data) {
        setAnalysis(response.data);
        const summaries = response.data.article_summaries || [];
        setArticleSummaries(summaries.slice(0, 5));
      } else {
        throw new Error('Failed to generate analysis');
      }
    } catch (err) {
      console.error('Failed to load analysis:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analysis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalysis(false);
  }, []);

  const getRecommendationColor = () => {
    switch (recommendation) {
      case 'buy':
        return 'from-green-500 to-emerald-600';
      case 'sell':
        return 'from-red-500 to-rose-600';
      default:
        return 'from-blue-500 to-indigo-600';
    }
  };

  const getRecommendationIcon = () => {
    switch (recommendation) {
      case 'buy':
        return <TrendingUp className="h-5 w-5" />;
      case 'sell':
        return <TrendingDown className="h-5 w-5" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  if (loading && !analysis) {
    return (
      <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-purple-400" />
          <h2 className="text-white text-lg font-semibold">AI-Powered Market Analysis</h2>
        </div>
        <div className="text-center py-12 text-slate-400">
          <div className="animate-pulse">Loading analysis...</div>
        </div>
      </div>
    );
  }

  if (!analysis && !loading) {
    return (
      <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-purple-400" />
          <h2 className="text-white text-lg font-semibold">AI-Powered Market Analysis</h2>
        </div>
        {error ? (
          <div className="mt-6 p-4 bg-red-900/30 border border-red-500 rounded-lg">
            <div className="text-red-400 font-semibold mb-2">Error</div>
            <div className="text-red-300 text-sm">{error}</div>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">
            <Brain className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>No analysis available yet</p>
          </div>
        )}
      </div>
    );
  }

  const displaySummaries = articleSummaries.slice(0, 5);

  return (
    <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Brain className="h-6 w-6 text-purple-400" />
        <h2 className="text-white text-lg font-semibold">AI-Powered Market Analysis</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {/* Recommendation */}
        <div className={`bg-gradient-to-br ${getRecommendationColor()} rounded-xl p-4 text-white`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/80 text-xs font-medium">Recommendation</span>
            {getRecommendationIcon()}
          </div>
          <div className="text-xl font-bold uppercase">{recommendation}</div>
          <div className="text-white/70 text-xs mt-1">Confidence: {confidence}%</div>
        </div>

        {/* Market Sentiment */}
        <div className="bg-slate-700/60 rounded-xl p-4 border border-slate-600">
          <div className="text-slate-400 text-xs font-medium mb-2">Market Sentiment</div>
          <div className={`text-xl font-bold ${
            marketSentiment === 'bullish' ? 'text-green-400' : 
            marketSentiment === 'bearish' ? 'text-red-400' : 
            'text-blue-400'
          }`}>
            {marketSentiment.charAt(0).toUpperCase() + marketSentiment.slice(1)}
          </div>
        </div>

        {/* News Sentiment */}
        <div className="bg-slate-700/60 rounded-xl p-4 border border-slate-600">
          <div className="text-slate-400 text-xs font-medium mb-2">News Sentiment</div>
          <div className={`text-xl font-bold ${
            newsSentiment >= 60 ? 'text-green-400' : 
            newsSentiment <= 40 ? 'text-red-400' : 
            'text-blue-400'
          }`}>
            {newsSentiment}% Positive
          </div>
        </div>

        {/* Buy Window */}
        <div className="bg-slate-700/60 rounded-xl p-4 border border-slate-600">
          <div className="text-slate-400 text-xs font-medium mb-2">Buy Window</div>
          <div className={`text-xl font-bold ${
            showBuyWindow ? 'text-green-400' : 'text-red-400'
          }`}>
            {showBuyWindow ? 'Optimal' : 'Not Optimal'}
          </div>
        </div>
      </div>

      {/* Market News Summary */}
      {displaySummaries.length > 0 && (
        <div className="mt-6 bg-slate-700/40 rounded-xl p-5 border border-slate-600">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="h-5 w-5 text-blue-400" />
            <h3 className="text-white font-semibold">Market News Summary</h3>
          </div>
          <ul className="space-y-3">
            {displaySummaries.map((summary, idx) => {
              const cleanSummary = summary.startsWith('•') ? summary.substring(1).trim() : summary.trim();
              return (
                <li key={idx} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-semibold">
                    {idx + 1}
                  </span>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    {cleanSummary}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
