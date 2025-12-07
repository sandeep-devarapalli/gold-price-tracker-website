import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/gold_price_tracker'
  },
  scraping: {
    schedule: process.env.SCRAPE_SCHEDULE || '0 0 * * *', // Daily at midnight
    timezone: process.env.SCRAPE_TIMEZONE || 'Asia/Kolkata',
    googleFinanceUrl: process.env.GOOGLE_FINANCE_URL || 'https://www.google.com/finance/search?q=gold+price+india',
    runOnStartup: process.env.RUN_SCRAPE_ON_STARTUP === 'true'
  },
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3001'
  }
};

export default config;

