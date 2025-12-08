import express, { Request, Response } from 'express';
import { scrapeGoldETFs, saveGoldETFs, getLatestGoldETFs } from '../services/goldETFScraper';

const router = express.Router();

/**
 * GET /api/etfs/latest
 * Get latest Gold ETF data
 */
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const etfs = await getLatestGoldETFs();
    
    res.json({
      success: true,
      data: etfs,
      count: etfs.length
    });
  } catch (error) {
    console.error('Error fetching Gold ETF data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Gold ETF data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/etfs/scrape
 * Trigger manual Gold ETF scraping
 */
router.post('/scrape', async (req: Request, res: Response) => {
  try {
    console.log('🔄 Manual Gold ETF scraping triggered...');
    
    const etfs = await scrapeGoldETFs();
    
    if (etfs.length > 0) {
      await saveGoldETFs(etfs);
      
      res.json({
        success: true,
        message: `Scraped and saved ${etfs.length} Gold ETF(s)`,
        data: etfs,
        count: etfs.length
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'No Gold ETF data scraped',
        message: 'Failed to scrape any Gold ETF prices'
      });
    }
  } catch (error) {
    console.error('Error scraping Gold ETFs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scrape Gold ETFs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

