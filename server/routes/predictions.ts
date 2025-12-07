import express, { Request, Response } from 'express';
import { generateGoldPricePredictions, getLatestPredictions, savePredictions, getAllPredictionsWithActuals, getLatestAnalysis } from '../services/predictionService';
import { getLatestPrice } from '../services/priceService';

const router = express.Router();

/**
 * GET /api/predictions/latest
 * Get latest gold price predictions
 */
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const includePast = req.query.includePast === 'true';
    const predictions = await getLatestPredictions(days, includePast);
    
    res.json({
      success: true,
      data: predictions,
      count: predictions.length
    });
  } catch (error) {
    console.error('Error fetching predictions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch predictions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/predictions/combined
 * Get combined past and future predictions with actual prices
 */
router.get('/combined', async (req: Request, res: Response) => {
  try {
    const pastDays = parseInt(req.query.pastDays as string) || 7;
    const futureDays = parseInt(req.query.futureDays as string) || 7;
    
    const predictions = await getAllPredictionsWithActuals(pastDays, futureDays);
    
    res.json({
      success: true,
      data: predictions,
      count: predictions.length,
      pastDays,
      futureDays
    });
  } catch (error) {
    console.error('Error fetching combined predictions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch combined predictions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/predictions/analysis
 * Get latest prediction analysis metadata (recommendation, sentiment, etc.)
 */
router.get('/analysis', async (req: Request, res: Response) => {
  try {
    const analysis = await getLatestAnalysis();
    
    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'No analysis available',
        message: 'No prediction analysis found. Please generate predictions first.'
      });
    }
    
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Error fetching analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analysis',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/predictions/generate
 * Generate new gold price predictions using OpenAI
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    console.log('🤖 Generating new gold price predictions...');
    
    // Get current gold price
    const currentPriceData = await getLatestPrice('India');
    if (!currentPriceData) {
      return res.status(404).json({
        success: false,
        error: 'No current price data available. Please scrape gold prices first.'
      });
    }
    
    const days = parseInt(req.body.days as string) || 7;
    const currentPrice = parseFloat(currentPriceData.price_1g);
    
    // Generate predictions
    const analysis = await generateGoldPricePredictions(currentPrice, days);
    
    // Save predictions to database
    await savePredictions(analysis);
    
    res.json({
      success: true,
      message: `Generated ${analysis.predictions.length} predictions`,
      data: analysis
    });
  } catch (error) {
    console.error('Error generating predictions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate predictions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
