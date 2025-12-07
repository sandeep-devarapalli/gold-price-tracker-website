import pool from '../db/connection';

export interface GoldPrice {
  id: number;
  price_10g: number;
  price_1g: number;
  country: string;
  timestamp: Date;
  source: string;
  created_at: Date;
}

export interface PriceStatistics {
  min: number;
  max: number;
  avg: number;
  current: number;
  change: number;
  percentChange: number;
}

/**
 * Insert a new gold price record
 */
export async function insertPrice(data: {
  price_10g: number;
  price_1g: number;
  country?: string;
  source?: string;
}): Promise<GoldPrice> {
  const query = `
    INSERT INTO gold_prices (price_10g, price_1g, country, source)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (country, DATE(timestamp)) 
    DO UPDATE SET 
      price_10g = EXCLUDED.price_10g,
      price_1g = EXCLUDED.price_1g,
      timestamp = EXCLUDED.timestamp
    RETURNING *
  `;
  
  const values = [
    data.price_10g,
    data.price_1g,
    data.country || 'India',
    data.source || 'google_search'
  ];
  
  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Get the latest gold price
 */
export async function getLatestPrice(country: string = 'India'): Promise<GoldPrice | null> {
  const query = `
    SELECT * FROM gold_prices
    WHERE country = $1
    ORDER BY timestamp DESC
    LIMIT 1
  `;
  
  const result = await pool.query(query, [country]);
  return result.rows[0] || null;
}

/**
 * Get historical prices within a date range
 */
export async function getHistoricalPrices(
  days: number = 30,
  country: string = 'India'
): Promise<GoldPrice[]> {
  const query = `
    SELECT * FROM gold_prices
    WHERE country = $1
      AND timestamp >= NOW() - INTERVAL '${days} days'
    ORDER BY timestamp ASC
  `;
  
  const result = await pool.query(query, [country]);
  return result.rows;
}

/**
 * Get prices for chart data (formatted for specific time ranges)
 */
export async function getChartData(
  range: '5D' | '1M' | '3M' | '6M' | '1Y',
  country: string = 'India'
): Promise<Array<{ date: string; price: number; timestamp: Date }>> {
  let days = 5;
  let interval = '1 day';
  
  switch (range) {
    case '5D':
      days = 5;
      interval = '1 day';
      break;
    case '1M':
      days = 30;
      interval = '1 day';
      break;
    case '3M':
      days = 90;
      interval = '3 days';
      break;
    case '6M':
      days = 180;
      interval = '7 days';
      break;
    case '1Y':
      days = 365;
      interval = '7 days';
      break;
  }
  
  const query = `
    SELECT 
      DATE(timestamp) as date,
      AVG(price_1g) as price,
      MAX(timestamp) as timestamp
    FROM gold_prices
    WHERE country = $1
      AND timestamp >= NOW() - INTERVAL '${days} days'
    GROUP BY DATE(timestamp)
    ORDER BY date ASC
  `;
  
  const result = await pool.query(query, [country]);
  
  return result.rows.map(row => ({
    date: new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    price: parseFloat(row.price),
    timestamp: row.timestamp
  }));
}

/**
 * Get price statistics for a given period
 */
export async function getPriceStatistics(
  period: '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' = '1M',
  country: string = 'India'
): Promise<PriceStatistics | null> {
  let days = 30;
  switch (period) {
    case '1D':
      days = 1;
      break;
    case '1W':
      days = 7;
      break;
    case '1M':
      days = 30;
      break;
    case '3M':
      days = 90;
      break;
    case '6M':
      days = 180;
      break;
    case '1Y':
      days = 365;
      break;
  }
  
  // Get latest price
  const latest = await getLatestPrice(country);
  if (!latest) {
    return null;
  }
  
  // Get statistics
  const statsQuery = `
    SELECT 
      MIN(price_1g) as min,
      MAX(price_1g) as max,
      AVG(price_1g) as avg
    FROM gold_prices
    WHERE country = $1
      AND timestamp >= NOW() - INTERVAL '${days} days'
  `;
  
  const statsResult = await pool.query(statsQuery, [country]);
  const stats = statsResult.rows[0];
  
  // Get previous price for comparison
  const previousQuery = `
    SELECT price_1g
    FROM gold_prices
    WHERE country = $1
      AND timestamp < $2
    ORDER BY timestamp DESC
    LIMIT 1
  `;
  
  const previousResult = await pool.query(previousQuery, [country, latest.timestamp]);
  const previousPrice = previousResult.rows[0]?.price_1g || latest.price_1g;
  
  const change = latest.price_1g - previousPrice;
  const percentChange = previousPrice > 0 ? (change / previousPrice) * 100 : 0;
  
  return {
    min: parseFloat(stats.min) || 0,
    max: parseFloat(stats.max) || 0,
    avg: parseFloat(stats.avg) || 0,
    current: latest.price_1g,
    change: change,
    percentChange: percentChange
  };
}

/**
 * Check if price was already scraped today
 */
export async function isPriceScrapedToday(country: string = 'India'): Promise<boolean> {
  const query = `
    SELECT COUNT(*) as count
    FROM gold_prices
    WHERE country = $1
      AND DATE(timestamp) = CURRENT_DATE
  `;
  
  const result = await pool.query(query, [country]);
  return parseInt(result.rows[0].count) > 0;
}

/**
 * Get price change over time periods
 */
export async function getPriceChanges(country: string = 'India'): Promise<{
  daily: { change: number; percentChange: number };
  weekly: { change: number; percentChange: number };
  monthly: { change: number; percentChange: number };
}> {
  const latest = await getLatestPrice(country);
  if (!latest) {
    return {
      daily: { change: 0, percentChange: 0 },
      weekly: { change: 0, percentChange: 0 },
      monthly: { change: 0, percentChange: 0 }
    };
  }
  
  const calculateChange = async (days: number) => {
    const query = `
      SELECT price_1g
      FROM gold_prices
      WHERE country = $1
        AND timestamp >= NOW() - INTERVAL '${days} days'
      ORDER BY timestamp ASC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [country]);
    const previousPrice = result.rows[0]?.price_1g || latest.price_1g;
    const change = latest.price_1g - previousPrice;
    const percentChange = previousPrice > 0 ? (change / previousPrice) * 100 : 0;
    
    return { change, percentChange };
  };
  
  const [daily, weekly, monthly] = await Promise.all([
    calculateChange(1),
    calculateChange(7),
    calculateChange(30)
  ]);
  
  return { daily, weekly, monthly };
}

/**
 * Get 24-hour price statistics (high, low)
 */
export async function get24hStatistics(country: string = 'India'): Promise<{
  high: number;
  low: number;
  current: number;
} | null> {
  const latest = await getLatestPrice(country);
  if (!latest) {
    return null;
  }
  
  // Get 24h statistics
  const statsQuery = `
    SELECT 
      MIN(price_1g) as low,
      MAX(price_1g) as high
    FROM gold_prices
    WHERE country = $1
      AND timestamp >= NOW() - INTERVAL '24 hours'
  `;
  
  const statsResult = await pool.query(statsQuery, [country]);
  const stats = statsResult.rows[0];
  
  // If no data in last 24h, use latest price as both high and low
  const high = stats.high ? parseFloat(stats.high) : latest.price_1g;
  const low = stats.low ? parseFloat(stats.low) : latest.price_1g;
  
  return {
    high,
    low,
    current: latest.price_1g
  };
}

