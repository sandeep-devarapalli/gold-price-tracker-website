import { Newspaper, Globe } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchLatestNews, type NewsArticle } from '../services/api';

interface NewsItem {
  id: number;
  title: string;
  source: string;
  time: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  impact: 'high' | 'medium' | 'low';
  url?: string;
}

function formatTimeAgo(dateString: string | null, url?: string, title?: string, content?: string): string {
  let date: Date | null = null;
  
  // If dateString is provided, use it
  if (dateString) {
    date = new Date(dateString);
    if (isNaN(date.getTime())) {
      date = null;
    }
  }
  
  // If no valid date and URL is provided, try extracting from URL
  if (!date && url) {
    // Pattern 1: YYYY-MM-DD in URL (common in Reuters, Bloomberg, etc.)
    let dateMatch = url.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      const year = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]) - 1;
      const day = parseInt(dateMatch[3]);
      date = new Date(year, month, day);
      if (isNaN(date.getTime())) {
        date = null;
      }
    } else {
      // Pattern 2: /YYYY/MM/DD/ format
      dateMatch = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
      if (dateMatch) {
        const year = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]) - 1;
        const day = parseInt(dateMatch[3]);
        date = new Date(year, month, day);
        if (isNaN(date.getTime())) {
          date = null;
        }
      } else {
        // Pattern 3: /MM/DD/YYYY/ format
        dateMatch = url.match(/\/(\d{2})\/(\d{2})\/(\d{4})\//);
        if (dateMatch) {
          const month = parseInt(dateMatch[1]) - 1;
          const day = parseInt(dateMatch[2]);
          const year = parseInt(dateMatch[3]);
          date = new Date(year, month, day);
          if (isNaN(date.getTime())) {
            date = null;
          }
        }
      }
    }
  }
  
  // If still no date, try extracting from title/content
  if (!date && (title || content)) {
    const text = ((title || '') + ' ' + (content || '')).toLowerCase();
    // Try to find date patterns in content
    const datePatterns = [
      /(\d{4})-(\d{2})-(\d{2})/, // ISO format
      /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),\s+(\d{4})/i,
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2}),\s+(\d{4})/i,
    ];
    
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          const extractedDate = new Date(match[0]);
          if (!isNaN(extractedDate.getTime())) {
            date = extractedDate;
            break;
          }
        } catch (e) {
          // Continue to next pattern
        }
      }
    }
  }
  
  // If still no valid date, return "Recently" as a fallback
  if (!date) {
    return 'Recently';
  }
  
  // Show full date and time
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function MarketNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    const loadNews = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchLatestNews(10);
        
        if (response.success && response.data) {
          const newsItems: NewsItem[] = response.data.map((article, index) => ({
            id: article.id || index + 1,
            title: article.title,
            source: article.source,
            time: formatTimeAgo(article.published_at, article.url, article.title, article.content),
            sentiment: article.sentiment,
            impact: article.impact,
            url: article.url,
          }));
          
          setNews(newsItems);
          setLastUpdated(new Date());
        } else {
          setError('Failed to load news data');
        }
      } catch (err) {
        console.error('Failed to fetch news:', err);
        setError(err instanceof Error ? err.message : 'Failed to load news');
      } finally {
        setLoading(false);
      }
    };

    loadNews();
    
    // Refresh news every 5 minutes
    const interval = setInterval(loadNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'negative':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getImpactBadge = (impact: string) => {
    const colors = {
      high: 'bg-red-100 text-red-700',
      medium: 'bg-amber-100 text-amber-700',
      low: 'bg-slate-100 text-slate-700'
    };
    return colors[impact as keyof typeof colors];
  };

  // Calculate statistics from news data
  const positiveCount = news.filter(n => n.sentiment === 'positive').length;
  const negativeCount = news.filter(n => n.sentiment === 'negative').length;
  const neutralCount = news.filter(n => n.sentiment === 'neutral').length;
  const totalCount = news.length;
  const positivePercentage = totalCount > 0 ? Math.round((positiveCount / totalCount) * 100) : 0;
  
  const timeSinceUpdate = () => {
    const diffMs = new Date().getTime() - lastUpdated.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    return `${Math.floor(diffMins / 60)} hours ago`;
  };

  return (
    <div className="bg-slate-800 rounded-2xl shadow-2xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Newspaper className="h-6 w-6 text-blue-400" />
          <h2 className="text-white">Market News & Updates</h2>
        </div>
        <div className="flex items-center space-x-1 text-green-400">
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm">Live</span>
        </div>
      </div>

      {/* News Agent Status */}
      <div className="bg-slate-700 rounded-lg p-4 mb-6 border border-slate-600">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Globe className="h-4 w-4 text-blue-400" />
            <span className="text-white text-sm">News Agent Active</span>
          </div>
          <span className="text-xs text-slate-400">Updated {timeSinceUpdate()}</span>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-3">
          <div>
            <div className="text-xs text-slate-400">Sources Monitored</div>
            <div className="text-white">{new Set(news.map(n => n.source)).size || 2}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Articles Today</div>
            <div className="text-white">{totalCount || 0}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Sentiment</div>
            <div className="text-green-400">{positivePercentage}% Positive</div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8 text-slate-400">
          <div className="animate-pulse">Loading news...</div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="text-center py-8 text-red-400">
          <div>Error: {error}</div>
          <div className="text-sm text-slate-400 mt-2">News data may not be available yet</div>
        </div>
      )}

      {/* News Items */}
      {!loading && !error && (
        <>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {news.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Newspaper className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>No news articles available yet</p>
              </div>
            ) : (
              news.map((item) => (
                <div 
                  key={item.id}
                  className="p-4 border border-slate-600 rounded-lg hover:border-amber-500 hover:shadow-md transition-all cursor-pointer bg-slate-700/50"
                  onClick={() => item.url && window.open(item.url, '_blank')}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-white flex-1 pr-2">{item.title}</h3>
                    <span className={`text-xs px-2 py-1 rounded ${getImpactBadge(item.impact)} whitespace-nowrap`}>
                      {item.impact.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-3">
                      <span className="text-slate-400">{item.source}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-400">{item.time}</span>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded border ${getSentimentColor(item.sentiment)}`}>
                      {item.sentiment}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Market Impact Summary */}
          {news.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-700">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-green-400 text-2xl mb-1">+{positiveCount}</div>
                  <div className="text-slate-400 text-sm">Bullish News</div>
                </div>
                <div className="text-center">
                  <div className="text-blue-400 text-2xl mb-1">{neutralCount}</div>
                  <div className="text-slate-400 text-sm">Neutral News</div>
                </div>
                <div className="text-center">
                  <div className="text-red-400 text-2xl mb-1">{negativeCount}</div>
                  <div className="text-slate-400 text-sm">Bearish News</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}