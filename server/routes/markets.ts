import express, { Request, Response } from 'express';
import { getLatestMarketData, scrapeUSMarkets, scrapeIndiaMarkets, scrapeCurrencyRates, saveMarketData } from '../services/marketScraper';

const router = express.Router();

/**
 * GET /api/markets/latest
 * Get latest market data
 */
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const marketType = req.query.type as 'US' | 'India' | undefined;
    const markets = await getLatestMarketData(marketType);
    
    res.json({
      success: true,
      data: markets,
      count: markets.length
    });
  } catch (error) {
    console.error('Error fetching market data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/markets/us
 * Get US market data
 */
router.get('/us', async (req: Request, res: Response) => {
  try {
    const markets = await getLatestMarketData('US');
    
    res.json({
      success: true,
      data: markets,
      count: markets.length
    });
  } catch (error) {
    console.error('Error fetching US market data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch US market data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/markets/india
 * Get India market data
 */
router.get('/india', async (req: Request, res: Response) => {
  try {
    const markets = await getLatestMarketData('India');
    
    res.json({
      success: true,
      data: markets,
      count: markets.length
    });
  } catch (error) {
    console.error('Error fetching India market data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch India market data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/markets/scrape
 * Manually trigger market data scraping
 */
router.post('/scrape', async (req: Request, res: Response) => {
  try {
    console.log('📈 Manual market scraping triggered');
    
    const [usMarkets, indiaMarkets, currencyRates] = await Promise.all([
      scrapeUSMarkets(),
      scrapeIndiaMarkets(),
      scrapeCurrencyRates()
    ]);
    
    const allMarkets = [...usMarkets, ...indiaMarkets, ...currencyRates];
    await saveMarketData(allMarkets);
    
    res.json({
      success: true,
      message: `Scraped and saved ${allMarkets.length} market indices`,
      count: allMarkets.length
    });
  } catch (error) {
    console.error('Error scraping market data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scrape market data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

