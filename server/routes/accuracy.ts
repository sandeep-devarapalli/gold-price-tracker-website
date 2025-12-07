import express, { Request, Response } from 'express';
import { validatePredictions, getAccuracyMetrics, getRecentAccuracyRecords } from '../services/accuracyTracking';

const router = express.Router();

/**
 * GET /api/accuracy/metrics
 * Get accuracy metrics for predictions
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const metrics = await getAccuracyMetrics(days);
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error fetching accuracy metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch accuracy metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/accuracy/recent
 * Get recent accuracy tracking records
 */
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const records = await getRecentAccuracyRecords(limit);
    
    res.json({
      success: true,
      data: records,
      count: records.length
    });
  } catch (error) {
    console.error('Error fetching recent accuracy records:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch accuracy records',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/accuracy/validate
 * Manually trigger prediction validation
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    console.log('🔍 Validating predictions against actual prices...');
    await validatePredictions();
    
    res.json({
      success: true,
      message: 'Predictions validated successfully'
    });
  } catch (error) {
    console.error('Error validating predictions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate predictions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
