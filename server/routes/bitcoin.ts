import express, { Request, Response } from 'express';
import { getLatestBitcoinPrice, getBitcoinHistory, scrapeBitcoinPrice, saveBitcoinPrice } from '../services/bitcoinScraper';

const router = express.Router();

/**
 * GET /api/bitcoin/latest
 * Get latest Bitcoin price
 */
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const price = await getLatestBitcoinPrice();
    
    if (!price) {
      return res.status(404).json({
        success: false,
        error: 'No Bitcoin price data found',
        message: 'Bitcoin price has not been scraped yet'
      });
    }
    
    res.json({
      success: true,
      data: price
    });
  } catch (error) {
    console.error('Error fetching Bitcoin price:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Bitcoin price',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/bitcoin/history
 * Get Bitcoin price history
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const history = await getBitcoinHistory(days);
    
    res.json({
      success: true,
      data: history,
      count: history.length,
      days: days
    });
  } catch (error) {
    console.error('Error fetching Bitcoin history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Bitcoin history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/bitcoin/chart
 * Get Bitcoin price data formatted for charts
 */
router.get('/chart', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const history = await getBitcoinHistory(days);
    
    // Format for chart display
    const chartData = history.map(price => ({
      date: new Date(price.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      price: price.price_usd,
      price_inr: price.price_inr,
      timestamp: price.timestamp
    }));
    
    res.json({
      success: true,
      data: chartData,
      count: chartData.length,
      days: days
    });
  } catch (error) {
    console.error('Error fetching Bitcoin chart data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Bitcoin chart data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/bitcoin/scrape
 * Manually trigger Bitcoin price scraping
 */
router.post('/scrape', async (req: Request, res: Response) => {
  try {
    console.log('₿ Manual Bitcoin scraping triggered');
    const price = await scrapeBitcoinPrice();
    
    if (!price) {
      return res.status(500).json({
        success: false,
        error: 'Failed to scrape Bitcoin price'
      });
    }
    
    await saveBitcoinPrice(price);
    
    res.json({
      success: true,
      message: 'Bitcoin price scraped and saved successfully',
      data: price
    });
  } catch (error) {
    console.error('Error scraping Bitcoin price:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scrape Bitcoin price',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

