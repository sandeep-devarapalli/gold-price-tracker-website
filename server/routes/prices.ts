import express, { Request, Response } from 'express';
import {
  getLatestPrice,
  getHistoricalPrices,
  getChartData,
  getPriceStatistics,
  getPriceChanges,
  get24hStatistics
} from '../services/priceService';
import { scrapeGoldPrice } from '../services/scraper';
import { insertPrice } from '../services/priceService';
import pool from '../db/connection';

const router = express.Router();

/**
 * GET /api/prices/latest
 * Get the most recent gold price
 */
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const country = (req.query.country as string) || 'India';
    const latestPrice = await getLatestPrice(country);
    
    if (!latestPrice) {
      return res.status(404).json({ 
        error: 'No price data found',
        message: 'No gold prices have been scraped yet. Please run the scraper first.'
      });
    }
    
    // Calculate price change from previous day
    // Get last 2 days of prices to compare today vs yesterday
    // Note: getHistoricalPrices returns prices sorted by timestamp ASC
    const recentPrices = await getHistoricalPrices(2, country);
    // Index 0 is the older price (yesterday), index 1 is today (when sorted ASC)
    const previousDayPrice = recentPrices.length > 1 ? recentPrices[0] : null;
    
    const change = previousDayPrice 
      ? latestPrice.price_1g - previousDayPrice.price_1g 
      : 0;
    const percentChange = previousDayPrice && previousDayPrice.price_1g > 0
      ? ((change / previousDayPrice.price_1g) * 100)
      : 0;
    
    // Get volume from gold_prices table, or fallback to MCX futures volume
    let volume = latestPrice.trading_volume ? parseFloat(latestPrice.trading_volume) : null;
    
    // Get latest market cap data from gold_market_cap table (one entry per region)
    const client = await pool.connect();
    let indiaMarketCap = null;
    let globalMarketCap = null;
    
    try {
      // If volume not available in gold_prices, use MCX futures volume as proxy
      // MCX is the primary gold trading exchange in India, so futures volume is a good indicator
      if (!volume && country === 'India') {
        try {
          const futuresResult = await client.query(`
            SELECT trading_volume 
            FROM gold_futures 
            WHERE exchange = 'MCX' 
            ORDER BY timestamp DESC 
            LIMIT 1
          `);
          
          if (futuresResult.rows.length > 0 && futuresResult.rows[0].trading_volume) {
            volume = parseFloat(futuresResult.rows[0].trading_volume);
          }
        } catch (err) {
          console.warn('Could not fetch MCX volume:', err);
        }
      }
      
      const marketCapResult = await client.query(`
        SELECT DISTINCT ON (region) region, market_cap_usd 
        FROM gold_market_cap 
        WHERE region IN ('India', 'Global')
        ORDER BY region, timestamp DESC
      `);
      
      for (const row of marketCapResult.rows) {
        if (row.region === 'India') {
          indiaMarketCap = parseFloat(row.market_cap_usd);
        } else if (row.region === 'Global') {
          globalMarketCap = parseFloat(row.market_cap_usd);
        }
      }
    } finally {
      client.release();
    }
    
    res.json({
      price_1g: latestPrice.price_1g,
      price_10g: latestPrice.price_10g,
      country: latestPrice.country,
      timestamp: latestPrice.timestamp,
      change: parseFloat(change.toFixed(2)),
      percentChange: parseFloat(percentChange.toFixed(2)),
      trading_volume: volume,
      india_market_cap_usd: indiaMarketCap,
      global_market_cap_usd: globalMarketCap
    });
  } catch (error) {
    console.error('Error fetching latest price:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch latest price'
    });
  }
});

/**
 * GET /api/prices/history
 * Get historical prices
 * Query params: days (default: 30), country (default: India)
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const country = (req.query.country as string) || 'India';
    
    if (days < 1 || days > 365) {
      return res.status(400).json({ 
        error: 'Invalid days parameter',
        message: 'Days must be between 1 and 365'
      });
    }
    
    const prices = await getHistoricalPrices(days, country);
    
    res.json({
      data: prices.map(p => ({
        id: p.id,
        price_1g: p.price_1g,
        price_10g: p.price_10g,
        country: p.country,
        timestamp: p.timestamp
      })),
      count: prices.length,
      days: days,
      country: country
    });
  } catch (error) {
    console.error('Error fetching historical prices:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch historical prices'
    });
  }
});

/**
 * GET /api/prices/chart
 * Get data formatted for charts
 * Query params: range (5D, 1M, 3M, 6M, 1Y), country (default: India)
 */
router.get('/chart', async (req: Request, res: Response) => {
  try {
    const range = (req.query.range as '5D' | '1M' | '3M' | '6M' | '1Y') || '1M';
    const country = (req.query.country as string) || 'India';
    
    const validRanges = ['5D', '1M', '3M', '6M', '1Y'];
    if (!validRanges.includes(range)) {
      return res.status(400).json({ 
        error: 'Invalid range parameter',
        message: `Range must be one of: ${validRanges.join(', ')}`
      });
    }
    
    const chartData = await getChartData(range, country);
    
    res.json({
      data: chartData,
      range: range,
      country: country,
      count: chartData.length
    });
  } catch (error) {
    console.error('Error fetching chart data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch chart data'
    });
  }
});

/**
 * GET /api/prices/statistics
 * Get price statistics for a period
 * Query params: period (1D, 1W, 1M, 3M, 6M, 1Y), city (default: India)
 */
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as '1D' | '1W' | '1M' | '3M' | '6M' | '1Y') || '1M';
    const country = (req.query.country as string) || 'India';
    
    const validPeriods = ['1D', '1W', '1M', '3M', '6M', '1Y'];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({ 
        error: 'Invalid period parameter',
        message: `Period must be one of: ${validPeriods.join(', ')}`
      });
    }
    
    const statistics = await getPriceStatistics(period, country);
    
    if (!statistics) {
      return res.status(404).json({ 
        error: 'No statistics available',
        message: 'No price data found for the specified period'
      });
    }
    
    res.json({
      ...statistics,
      period: period,
      country: country
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch statistics'
    });
  }
});

/**
 * GET /api/prices/changes
 * Get price changes over different time periods
 * Query params: country (default: India)
 */
router.get('/changes', async (req: Request, res: Response) => {
  try {
    const country = (req.query.country as string) || 'India';
    const changes = await getPriceChanges(country);
    
    res.json({
      ...changes,
      country: country
    });
  } catch (error) {
    console.error('Error fetching price changes:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch price changes'
    });
  }
});

/**
 * GET /api/prices/24h-stats
 * Get 24-hour price statistics (high, low)
 */
router.get('/24h-stats', async (req: Request, res: Response) => {
  try {
    const country = (req.query.country as string) || 'India';
    const stats = await get24hStatistics(country);
    
    if (!stats) {
      return res.status(404).json({ 
        error: 'No price data found',
        message: 'No gold prices available to calculate 24h statistics'
      });
    }
    
    res.json({
      high: stats.high,
      low: stats.low,
      current: stats.current,
      country: country
    });
  } catch (error) {
    console.error('Error fetching 24h statistics:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch 24h statistics'
    });
  }
});

/**
 * POST /api/prices/scrape
 * Manually trigger scraping (useful for testing)
 * Note: In production, this should be protected with authentication
 */
router.post('/scrape', async (req: Request, res: Response) => {
  try {
    console.log('🔧 Manual scrape requested via API');
    
    const scrapedPrice = await scrapeGoldPrice();
    if (!scrapedPrice) {
      return res.status(500).json({ 
        error: 'Scraping failed',
        message: 'Failed to scrape gold price'
      });
    }
    
    const savedPrice = await insertPrice({
      price_10g: scrapedPrice.price_10g,
      price_1g: scrapedPrice.price_1g,
      country: scrapedPrice.country,
      source: scrapedPrice.source
    });
    
    res.json({
      success: true,
      message: 'Price scraped and saved successfully',
      data: {
        price_1g: savedPrice.price_1g,
        price_10g: savedPrice.price_10g,
        country: savedPrice.country,
        timestamp: savedPrice.timestamp
      }
    });
  } catch (error) {
    console.error('Error in manual scrape:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to scrape price',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

