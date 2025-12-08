import express, { Request, Response } from 'express';
import { getLatestFuturesData, scrapeAllGoldFutures, saveGoldFuturesData } from '../services/goldFuturesScraper';
import { getLatestMarketCap, fetchIndiaGoldMarketCap, fetchGlobalGoldMarketCap, saveMarketCapData } from '../services/marketCapService';
import pool from '../db/connection';

const router = express.Router();

/**
 * GET /api/futures/latest
 * Get latest gold futures data (MCX & COMEX)
 */
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const exchange = req.query.exchange as 'MCX' | 'COMEX' | undefined;
    const futures = await getLatestFuturesData(exchange);
    
    res.json({
      success: true,
      data: futures,
      count: futures.length
    });
  } catch (error) {
    console.error('Error fetching latest futures data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch futures data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/futures/history
 * Get historical gold futures data
 * Query params: exchange (MCX | COMEX), days (default: 30)
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const exchange = req.query.exchange as 'MCX' | 'COMEX' | undefined;
    const days = parseInt(req.query.days as string) || 30;
    
    const client = await pool.connect();
    try {
      let query = `
        SELECT exchange, contract_symbol, futures_price, spot_price, trading_volume, open_interest,
               change, percent_change, expiry_date, timestamp
        FROM gold_futures
        WHERE timestamp >= CURRENT_DATE - INTERVAL '${days} days'
      `;
      
      const params: any[] = [];
      if (exchange) {
        query += ' AND exchange = $1';
        params.push(exchange);
      }
      
      query += ' ORDER BY timestamp DESC, exchange';
      
      const result = await client.query(query, params);
      
      res.json({
        success: true,
        data: result.rows.map(row => ({
          exchange: row.exchange,
          contract_symbol: row.contract_symbol,
          futures_price: parseFloat(row.futures_price),
          spot_price: row.spot_price ? parseFloat(row.spot_price) : null,
          trading_volume: row.trading_volume ? parseFloat(row.trading_volume) : null,
          open_interest: row.open_interest ? parseFloat(row.open_interest) : null,
          change: parseFloat(row.change),
          percent_change: parseFloat(row.percent_change),
          expiry_date: row.expiry_date ? row.expiry_date.toISOString().split('T')[0] : null,
          timestamp: row.timestamp
        })),
        count: result.rows.length
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching futures history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch futures history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/futures/volume
 * Get volume trends for gold futures
 * Query params: exchange (MCX | COMEX), days (default: 7)
 */
router.get('/volume', async (req: Request, res: Response) => {
  try {
    const exchange = req.query.exchange as 'MCX' | 'COMEX' | undefined;
    const days = parseInt(req.query.days as string) || 7;
    
    const client = await pool.connect();
    try {
      let query = `
        SELECT DATE(timestamp) as date, exchange,
               AVG(trading_volume) as avg_volume,
               MAX(trading_volume) as max_volume,
               MIN(trading_volume) as min_volume
        FROM gold_futures
        WHERE timestamp >= CURRENT_DATE - INTERVAL '${days} days'
          AND trading_volume IS NOT NULL
      `;
      
      const params: any[] = [];
      if (exchange) {
        query += ' AND exchange = $1';
        params.push(exchange);
      }
      
      query += ' GROUP BY DATE(timestamp), exchange ORDER BY date DESC, exchange';
      
      const result = await client.query(query, params);
      
      res.json({
        success: true,
        data: result.rows.map(row => ({
          date: row.date.toISOString().split('T')[0],
          exchange: row.exchange,
          avg_volume: parseFloat(row.avg_volume),
          max_volume: parseFloat(row.max_volume),
          min_volume: parseFloat(row.min_volume)
        })),
        count: result.rows.length
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching volume trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch volume trends',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/futures/market-cap
 * Get latest market cap data (India & Global)
 * Query params: region (India | Global)
 */
router.get('/market-cap', async (req: Request, res: Response) => {
  try {
    const region = req.query.region as 'India' | 'Global' | undefined;
    const marketCap = await getLatestMarketCap(region);
    
    res.json({
      success: true,
      data: marketCap,
      count: marketCap.length
    });
  } catch (error) {
    console.error('Error fetching market cap data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market cap data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/futures/scrape
 * Manually trigger gold futures scraping
 */
router.post('/scrape', async (req: Request, res: Response) => {
  try {
    console.log('📊 Manual gold futures scraping triggered');
    
    const futuresData = await scrapeAllGoldFutures();
    
    if (futuresData.length === 0) {
      console.warn('⚠️ No futures data was scraped - this may be due to Google Finance page structure changes or blocking');
      return res.status(500).json({
        success: false,
        error: 'Failed to scrape gold futures data',
        message: 'No futures data was scraped. This may be due to Google Finance page structure changes or request blocking. The scraper will retry automatically at the scheduled time (11:20 AM IST).'
      });
    }
    
    await saveGoldFuturesData(futuresData);
    
    res.json({
      success: true,
      message: `Scraped and saved ${futuresData.length} futures exchange(s)`,
      data: futuresData,
      count: futuresData.length
    });
  } catch (error) {
    console.error('Error in manual futures scrape:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scrape futures data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/futures/market-cap/scrape
 * Manually trigger market cap update
 */
router.post('/market-cap/scrape', async (req: Request, res: Response) => {
  try {
    console.log('💰 Manual market cap scraping triggered');
    
    const [indiaCap, globalCap] = await Promise.all([
      fetchIndiaGoldMarketCap(),
      fetchGlobalGoldMarketCap()
    ]);
    
    const marketCaps = [];
    if (indiaCap) marketCaps.push(indiaCap);
    if (globalCap) marketCaps.push(globalCap);
    
    if (marketCaps.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Failed to scrape market cap data',
        message: 'No market cap data was scraped or estimated'
      });
    }
    
    for (const cap of marketCaps) {
      await saveMarketCapData(cap);
    }
    
    res.json({
      success: true,
      message: `Scraped and saved ${marketCaps.length} market cap entry/entries`,
      data: marketCaps,
      count: marketCaps.length
    });
  } catch (error) {
    console.error('Error in manual market cap scrape:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scrape market cap data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

