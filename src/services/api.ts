const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export interface LatestPrice {
  price_1g: number;
  price_10g: number;
  country: string;
  timestamp: string;
  change: number;
  percentChange: number;
  trading_volume?: number | null;
  india_market_cap_usd?: number | null;
  global_market_cap_usd?: number | null;
}

export interface HistoricalPrice {
  id: number;
  price_1g: number;
  price_10g: number;
  country: string;
  timestamp: string;
}

export interface HistoricalPriceResponse {
  data: HistoricalPrice[];
  count: number;
  days: number;
  country: string;
}

export interface ChartDataPoint {
  date: string;
  price: number;
  timestamp: string;
}

export interface ChartDataResponse {
  data: ChartDataPoint[];
  range: string;
  country: string;
  count: number;
}

export interface PriceStatistics {
  min: number;
  max: number;
  avg: number;
  current: number;
  change: number;
  percentChange: number;
  period: string;
  country: string;
}

export interface PriceChanges {
  daily: { change: number; percentChange: number };
  weekly: { change: number; percentChange: number };
  monthly: { change: number; percentChange: number };
  country: string;
}

/**
 * Fetch latest gold price
 */
export async function fetchLatestPrice(country: string = 'India'): Promise<LatestPrice> {
  const response = await fetch(`${API_BASE_URL}/prices/latest?country=${encodeURIComponent(country)}`);
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('No price data available. Please run the scraper first.');
    }
    throw new Error(`Failed to fetch latest price: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch historical prices
 */
export async function fetchHistoricalPrices(
  days: number = 30,
  country: string = 'India'
): Promise<HistoricalPriceResponse> {
  const response = await fetch(
    `${API_BASE_URL}/prices/history?days=${days}&country=${encodeURIComponent(country)}`
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch historical prices: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch chart data for a specific time range
 */
export async function fetchChartData(
  range: '5D' | '1M' | '3M' | '6M' | '1Y',
  country: string = 'India'
): Promise<ChartDataResponse> {
  const response = await fetch(
    `${API_BASE_URL}/prices/chart?range=${range}&country=${encodeURIComponent(country)}`
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch chart data: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch price statistics for a period
 */
export async function fetchPriceStatistics(
  period: '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' = '1M',
  country: string = 'India'
): Promise<PriceStatistics> {
  const response = await fetch(
    `${API_BASE_URL}/prices/statistics?period=${period}&country=${encodeURIComponent(country)}`
  );
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('No statistics available for the specified period');
    }
    throw new Error(`Failed to fetch statistics: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch price changes over different time periods
 */
export async function fetchPriceChanges(country: string = 'India'): Promise<PriceChanges> {
  const response = await fetch(
    `${API_BASE_URL}/prices/changes?country=${encodeURIComponent(country)}`
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch price changes: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch 24-hour price statistics (high, low)
 */
export async function fetch24hStatistics(country: string = 'India'): Promise<{
  high: number;
  low: number;
  current: number;
  country: string;
}> {
  const response = await fetch(`${API_BASE_URL}/prices/24h-stats?country=${encodeURIComponent(country)}`);
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('No 24h statistics available');
    }
    throw new Error(`Failed to fetch 24h statistics: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Manually trigger scraping (for testing)
 */
export async function triggerScrape(): Promise<{ success: boolean; message: string; data?: any }> {
  const response = await fetch(`${API_BASE_URL}/prices/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `Failed to trigger scrape: ${response.statusText}`);
  }
  
  return response.json();
}

// News API interfaces and functions
export interface NewsArticle {
  id?: number;
  title: string;
  content: string;
  source: string;
  url: string;
  published_at: string | null;
  sentiment: 'positive' | 'negative' | 'neutral';
  impact: 'high' | 'medium' | 'low';
}

export interface NewsResponse {
  success: boolean;
  data: NewsArticle[];
  count: number;
}

/**
 * Fetch latest gold-related news
 */
export async function fetchLatestNews(limit: number = 10): Promise<NewsResponse> {
  const response = await fetch(`${API_BASE_URL}/news/latest?limit=${limit}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch news: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch today's news
 */
export async function fetchTodayNews(limit: number = 20): Promise<NewsResponse> {
  const response = await fetch(`${API_BASE_URL}/news/today?limit=${limit}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch today's news: ${response.statusText}`);
  }
  
  return response.json();
}

// Market API interfaces and functions
export interface MarketData {
  market_type: 'US' | 'India' | 'Currency';
  index_name: string;
  value: number;
  change: number;
  percent_change: number;
  timestamp: string;
}

export interface MarketResponse {
  success: boolean;
  data: MarketData[];
  count: number;
}

/**
 * Fetch latest market data
 */
export async function fetchLatestMarketData(type?: 'US' | 'India' | 'Currency'): Promise<MarketResponse> {
  const url = type 
    ? `${API_BASE_URL}/markets/latest?type=${type}`
    : `${API_BASE_URL}/markets/latest`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch market data: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch US market data
 */
export async function fetchUSMarketData(): Promise<MarketResponse> {
  const response = await fetch(`${API_BASE_URL}/markets/us`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch US market data: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch India market data
 */
export async function fetchIndiaMarketData(): Promise<MarketResponse> {
  const response = await fetch(`${API_BASE_URL}/markets/india`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch India market data: ${response.statusText}`);
  }
  
  return response.json();
}

// Bitcoin API interfaces and functions
export interface BitcoinPrice {
  price_usd: number;
  price_inr: number;
  change_24h: number;
  percent_change_24h: number;
  timestamp: string;
}

export interface BitcoinResponse {
  success: boolean;
  data: BitcoinPrice;
}

export interface BitcoinHistoryResponse {
  success: boolean;
  data: BitcoinPrice[];
  count: number;
  days: number;
}

export interface BitcoinChartResponse {
  success: boolean;
  data: Array<{
    date: string;
    price: number;
    price_inr: number;
    timestamp: string;
  }>;
  count: number;
  days: number;
}

/**
 * Fetch latest Bitcoin price
 */
export async function fetchLatestBitcoinPrice(): Promise<BitcoinResponse> {
  const response = await fetch(`${API_BASE_URL}/bitcoin/latest`);
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('No Bitcoin price data available');
    }
    throw new Error(`Failed to fetch Bitcoin price: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch Bitcoin price history
 */
export async function fetchBitcoinHistory(days: number = 30): Promise<BitcoinHistoryResponse> {
  const response = await fetch(`${API_BASE_URL}/bitcoin/history?days=${days}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Bitcoin history: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch Bitcoin chart data
 */
export async function fetchBitcoinChart(days: number = 30): Promise<BitcoinChartResponse> {
  const response = await fetch(`${API_BASE_URL}/bitcoin/chart?days=${days}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Bitcoin chart data: ${response.statusText}`);
  }
  
  return response.json();
}

// Prediction API interfaces and functions
export interface PricePrediction {
  date: string;
  predicted_price_1g: number;
  predicted_price_10g: number;
  confidence: number;
  reasoning: string;
  factors: string[];
}

export interface PredictionAnalysis {
  recommendation: 'buy' | 'hold' | 'sell';
  confidence: number;
  market_sentiment: 'bullish' | 'bearish' | 'neutral';
  news_sentiment: number;
  trend_analysis: string;
  key_factors: string[];
  article_summaries?: string[]; // Key summary points from analyzed articles
  predictions: PricePrediction[];
}

export interface PredictionResponse {
  success: boolean;
  data: PredictionAnalysis;
  message?: string;
}

export interface PredictionsListResponse {
  success: boolean;
  data: PricePrediction[];
  count: number;
}

/**
 * Fetch latest gold price predictions
 */
export async function fetchLatestPredictions(days: number = 7): Promise<PredictionsListResponse> {
  const response = await fetch(`${API_BASE_URL}/predictions/latest?days=${days}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch predictions: ${response.statusText}`);
  }
  
  return response.json();
}

// Combined prediction with actual price
// Note: prediction fields can be null for dates with only actual prices
export interface PredictionWithActual {
  date: string;
  predicted_price_1g: number | null;
  predicted_price_10g: number | null;
  confidence: number | null;
  reasoning: string | null;
  factors: string[];
  actual_price_1g: number | null;
  has_actual: boolean;
}

export interface CombinedPredictionsResponse {
  success: boolean;
  data: PredictionWithActual[];
  count: number;
  pastDays: number;
  futureDays: number;
}

/**
 * Fetch combined past and future predictions with actual prices
 */
export async function fetchCombinedPredictions(
  pastDays: number = 7,
  futureDays: number = 7
): Promise<CombinedPredictionsResponse> {
  const response = await fetch(`${API_BASE_URL}/predictions/combined?pastDays=${pastDays}&futureDays=${futureDays}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch combined predictions: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Generate new gold price predictions using OpenAI
 */
/**
 * Fetch latest prediction analysis (recommendation, sentiment, etc.)
 */
export async function fetchLatestAnalysis(): Promise<PredictionResponse> {
  const response = await fetch(`${API_BASE_URL}/predictions/analysis`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch analysis: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Generate new gold price predictions using OpenAI
 */
export async function generatePredictions(days: number = 7): Promise<PredictionResponse> {
  const response = await fetch(`${API_BASE_URL}/predictions/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ days })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to generate predictions: ${response.statusText}`);
  }
  
  return response.json();
}

// Price Alerts API interfaces and functions
export interface PriceAlert {
  id: number;
  alert_type: 'above' | 'below';
  target_price: number;
  is_active: boolean;
  triggered: boolean;
  triggered_at: string | null;
  triggered_price: number | null;
  country: string;
  user_session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertsResponse {
  success: boolean;
  data: PriceAlert[];
  count: number;
}

export interface AlertResponse {
  success: boolean;
  data: PriceAlert;
  message?: string;
}

export interface CreateAlertData {
  alert_type: 'above' | 'below';
  target_price: number;
  country?: string;
}

/**
 * Fetch all price alerts
 */
export async function fetchAlerts(activeOnly: boolean = false): Promise<AlertsResponse> {
  const params = activeOnly ? '?activeOnly=true' : '';
  const response = await fetch(`${API_BASE_URL}/alerts${params}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch alerts: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Create a new price alert
 */
export async function createAlert(data: CreateAlertData): Promise<AlertResponse> {
  const response = await fetch(`${API_BASE_URL}/alerts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create alert: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Update an alert
 */
export async function updateAlert(
  id: number,
  updates: {
    is_active?: boolean;
    alert_type?: 'above' | 'below';
    target_price?: number;
  }
): Promise<AlertResponse> {
  const response = await fetch(`${API_BASE_URL}/alerts/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update alert: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Delete an alert
 */
export async function deleteAlert(id: number): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/alerts/${id}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to delete alert: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Reset a triggered alert
 */
export async function resetAlert(id: number): Promise<AlertResponse> {
  const response = await fetch(`${API_BASE_URL}/alerts/${id}/reset`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to reset alert: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * System Status Types
 */
export interface SystemStatus {
  overall_status: 'operational' | 'degraded' | 'down';
  timestamp: string;
  components: {
    backend: {
      status: string;
      uptime: number;
      port: number;
    };
    database: {
      status: string;
      error: string | null;
    };
    scrapers: {
      schedulers_active: number;
      schedulers_total: number;
      scraped_today: {
        gold_price: boolean;
        bitcoin: boolean;
        markets: boolean;
        news: boolean;
      };
    };
  };
  scheduler: {
    current_time: string;
    timezone: string;
    schedulers: Array<{
      name: string;
      schedule: string;
      next_run: string;
      is_active: boolean;
    }>;
    last_scraped: {
      gold_price: string | null;
      bitcoin: string | null;
      markets: string | null;
      news: string | null;
    };
  };
  scrapers_today: {
    gold_price: boolean;
    bitcoin: boolean;
    markets: boolean;
    news: boolean;
  };
}

export interface SystemStatusResponse {
  success: boolean;
  data: SystemStatus;
}

/**
 * Fetch system status
 */
export async function fetchSystemStatus(): Promise<SystemStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/system/status`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch system status: ${response.statusText}`);
  }
  
  return response.json();
}

// Gold ETF API interfaces and functions
export interface GoldETFData {
  etf_name: string;
  symbol: string;
  exchange: 'NSE' | 'BSE';
  nav_price: number;
  change: number;
  percent_change: number;
  aum_crore?: number;
  expense_ratio?: number;
  timestamp: string;
}

export async function fetchLatestETFs(): Promise<{
  success: boolean;
  data?: GoldETFData[];
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/etfs/latest`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch ETF data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch ETF data'
    };
  }
}

// Gold Futures API interfaces and functions
export interface GoldFuturesData {
  exchange: 'MCX' | 'COMEX';
  contract_symbol: string;
  futures_price: number;
  spot_price: number | null;
  trading_volume: number | null;
  open_interest: number | null;
  change: number;
  percent_change: number;
  expiry_date: string | null;
  timestamp: string;
}

export async function fetchLatestFutures(exchange?: 'MCX' | 'COMEX'): Promise<{
  success: boolean;
  data?: GoldFuturesData[];
  error?: string;
}> {
  try {
    const url = exchange 
      ? `${API_BASE_URL}/futures/latest?exchange=${exchange}`
      : `${API_BASE_URL}/futures/latest`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch futures data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch futures data'
    };
  }
}

export async function fetchFuturesHistory(exchange?: 'MCX' | 'COMEX', days: number = 30): Promise<{
  success: boolean;
  data?: GoldFuturesData[];
  error?: string;
}> {
  try {
    const params = new URLSearchParams();
    if (exchange) params.append('exchange', exchange);
    params.append('days', days.toString());
    const response = await fetch(`${API_BASE_URL}/futures/history?${params}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch futures history:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch futures history'
    };
  }
}

// Market Cap API interfaces and functions
export interface MarketCapData {
  region: 'India' | 'Global';
  market_cap_usd: number;
  gold_holdings_tonnes: number | null;
  source: string;
  report_date: string | null;
  timestamp: string;
}

export async function fetchMarketCap(region?: 'India' | 'Global'): Promise<{
  success: boolean;
  data?: MarketCapData[];
  error?: string;
}> {
  try {
    const url = region
      ? `${API_BASE_URL}/futures/market-cap?region=${region}`
      : `${API_BASE_URL}/futures/market-cap`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch market cap data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch market cap data'
    };
  }
}
