import express, { Request, Response } from 'express';
import {
  createAlert,
  getAllAlerts,
  getAlertById,
  updateAlert,
  deleteAlert,
  resetAlert,
  getAlertHistory,
  CreateAlertData
} from '../services/alertService';

const router = express.Router();

/**
 * GET /api/alerts
 * Get all price alerts
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const country = (req.query.country as string) || 'India';
    const activeOnly = req.query.activeOnly === 'true';
    
    const alerts = await getAllAlerts(country, activeOnly);
    
    res.json({
      success: true,
      data: alerts,
      count: alerts.length
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/alerts/:id
 * Get a single alert by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alert ID'
      });
    }
    
    const alert = await getAlertById(id);
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }
    
    res.json({
      success: true,
      data: alert
    });
  } catch (error) {
    console.error('Error fetching alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/alerts
 * Create a new price alert
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { alert_type, target_price, country, user_session_id } = req.body;
    
    // Validation
    if (!alert_type || !['above', 'below'].includes(alert_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alert_type. Must be "above" or "below"'
      });
    }
    
    if (!target_price || typeof target_price !== 'number' || target_price <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid target_price. Must be a positive number'
      });
    }
    
    const alertData: CreateAlertData = {
      alert_type,
      target_price,
      country: country || 'India',
      user_session_id
    };
    
    const alert = await createAlert(alertData);
    
    res.status(201).json({
      success: true,
      data: alert,
      message: 'Alert created successfully'
    });
  } catch (error) {
    console.error('Error creating alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create alert',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/alerts/:id
 * Update an alert
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alert ID'
      });
    }
    
    const { is_active, alert_type, target_price } = req.body;
    
    const updates: {
      is_active?: boolean;
      alert_type?: 'above' | 'below';
      target_price?: number;
    } = {};
    
    if (is_active !== undefined) {
      updates.is_active = Boolean(is_active);
    }
    
    if (alert_type !== undefined) {
      if (!['above', 'below'].includes(alert_type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alert_type. Must be "above" or "below"'
        });
      }
      updates.alert_type = alert_type;
    }
    
    if (target_price !== undefined) {
      if (typeof target_price !== 'number' || target_price <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid target_price. Must be a positive number'
        });
      }
      updates.target_price = target_price;
    }
    
    const updatedAlert = await updateAlert(id, updates);
    
    if (!updatedAlert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }
    
    res.json({
      success: true,
      data: updatedAlert,
      message: 'Alert updated successfully'
    });
  } catch (error) {
    console.error('Error updating alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update alert',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/alerts/:id
 * Delete an alert
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alert ID'
      });
    }
    
    const deleted = await deleteAlert(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Alert deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete alert',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/alerts/:id/reset
 * Reset a triggered alert so it can trigger again
 */
router.post('/:id/reset', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alert ID'
      });
    }
    
    const resetAlertData = await resetAlert(id);
    
    if (!resetAlertData) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }
    
    res.json({
      success: true,
      data: resetAlertData,
      message: 'Alert reset successfully'
    });
  } catch (error) {
    console.error('Error resetting alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset alert',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/alerts/:id/history
 * Get alert trigger history
 */
router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 50;
    
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alert ID'
      });
    }
    
    const history = await getAlertHistory(id, limit);
    
    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    console.error('Error fetching alert history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

