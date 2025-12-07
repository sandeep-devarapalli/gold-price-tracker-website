// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { initializeScheduler, getSchedulerStatus } from './services/scheduler';
import pool from './db/connection';
import priceRoutes from './routes/prices';
import newsRoutes from './routes/news';
import marketRoutes from './routes/markets';
import bitcoinRoutes from './routes/bitcoin';
import predictionRoutes from './routes/predictions';
import accuracyRoutes from './routes/accuracy';
import alertRoutes from './routes/alerts';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Scheduler status endpoint - easy way to check all scheduler statuses
app.get('/api/scheduler/status', async (req, res) => {
  try {
    const status = await getSchedulerStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('Scheduler status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get scheduler status', details: error instanceof Error ? error.message : String(error) });
  }
});

// Comprehensive system status endpoint
app.get('/api/system/status', async (req, res) => {
  try {
    // Check database connectivity
    let dbStatus = 'ok';
    let dbError = null;
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
    } catch (error) {
      dbStatus = 'error';
      dbError = error instanceof Error ? error.message : String(error);
    }
    
    // Get scheduler status
    let schedulerStatus = null;
    try {
      schedulerStatus = await getSchedulerStatus();
    } catch (error) {
      console.error('Error getting scheduler status:', error);
    }
    
    // Determine overall system health
    const allSystemsUp = dbStatus === 'ok' && schedulerStatus !== null;
    
    // Check if scrapers have run today (IST timezone)
    const now = new Date();
    const todayIST = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    todayIST.setHours(0, 0, 0, 0);
    
    let scrapersToday = {
      gold_price: false,
      bitcoin: false,
      markets: false,
      news: false
    };
    
    if (schedulerStatus?.last_scraped) {
      const checkIfToday = (dateStr: string | null): boolean => {
        if (!dateStr) return false;
        const scrapedDate = new Date(dateStr);
        const scrapedDateIST = new Date(scrapedDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        scrapedDateIST.setHours(0, 0, 0, 0);
        return scrapedDateIST.getTime() === todayIST.getTime();
      };
      
      scrapersToday = {
        gold_price: checkIfToday(schedulerStatus.last_scraped.gold_price),
        bitcoin: checkIfToday(schedulerStatus.last_scraped.bitcoin),
        markets: checkIfToday(schedulerStatus.last_scraped.markets),
        news: checkIfToday(schedulerStatus.last_scraped.news)
      };
    }
    
    res.json({
      success: true,
      data: {
        overall_status: allSystemsUp ? 'operational' : 'degraded',
        timestamp: new Date().toISOString(),
        components: {
          backend: {
            status: 'ok',
            uptime: process.uptime(),
            port: PORT
          },
          database: {
            status: dbStatus,
            error: dbError
          },
          scrapers: {
            schedulers_active: schedulerStatus?.schedulers.filter(s => s.is_active).length || 0,
            schedulers_total: schedulerStatus?.schedulers.length || 0,
            scraped_today: scrapersToday
          }
        },
        scheduler: schedulerStatus,
        scrapers_today: scrapersToday
      }
    });
  } catch (error) {
    console.error('System status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system status',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// API routes
app.use('/api/prices', priceRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/markets', marketRoutes);
app.use('/api/bitcoin', bitcoinRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/accuracy', accuracyRoutes);
app.use('/api/alerts', alertRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  
  // Initialize scheduler for daily scraping
  initializeScheduler();
});

export default app;

