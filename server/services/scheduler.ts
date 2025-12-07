import cron from 'node-cron';
import dotenv from 'dotenv';
import { scrapeGoldPrice } from './scraper';
import { insertPrice, isPriceScrapedToday, getLatestPrice } from './priceService';
import { scrapeAllGoldNews, saveNewsArticles } from './newsScraper';
import { scrapeUSMarkets, scrapeIndiaMarkets, scrapeCurrencyRates, saveMarketData } from './marketScraper';
import { scrapeBitcoinPrice, saveBitcoinPrice } from './bitcoinScraper';
import { generateGoldPricePredictions, savePredictions, getExistingPredictionDates } from './predictionService';
import { checkAndTriggerAlerts } from './alertService';
import pool from '../db/connection';

dotenv.config();

let goldPriceTask: cron.ScheduledTask | null = null;
let newsTask: cron.ScheduledTask | null = null;
let newsTaskEvening: cron.ScheduledTask | null = null;
let marketTask: cron.ScheduledTask | null = null;
let bitcoinTask: cron.ScheduledTask | null = null;

/**
 * Perform gold price scraping task
 */
async function performGoldPriceScraping(): Promise<void> {
  try {
    console.log(`\n⏰ [${new Date().toISOString()}] Starting scheduled gold price scraping...`);
    
    // Check if already scraped today
    const alreadyScraped = await isPriceScrapedToday();
    if (alreadyScraped) {
      console.log('ℹ️ Gold price already scraped today. Skipping...');
      return;
    }
    
    // Scrape price
    const scrapedPrice = await scrapeGoldPrice();
    if (!scrapedPrice) {
      throw new Error('Failed to scrape gold price');
    }
    
    // Save to database
    const savedPrice = await insertPrice({
      price_10g: scrapedPrice.price_10g,
      price_1g: scrapedPrice.price_1g,
      country: scrapedPrice.country,
      source: scrapedPrice.source
    });
    
    console.log(`✅ Gold price scraped and saved: ₹${parseFloat(savedPrice.price_1g).toFixed(2)}/g (₹${parseFloat(savedPrice.price_10g).toFixed(2)}/10g)`);
    
    // Check and trigger price alerts
    try {
      console.log(`🔔 Checking price alerts...`);
      const triggeredAlerts = await checkAndTriggerAlerts(savedPrice.price_1g, scrapedPrice.country);
      if (triggeredAlerts.length > 0) {
        console.log(`🔔 ${triggeredAlerts.length} alert(s) triggered:`);
        triggeredAlerts.forEach(alert => {
          console.log(`   - Alert #${alert.id}: Price ${alert.alert_type} ₹${parseFloat(alert.target_price).toFixed(2)} (Current: ₹${parseFloat(savedPrice.price_1g).toFixed(2)})`);
        });
      } else {
        console.log(`   No alerts triggered.`);
      }
    } catch (alertError) {
      console.error(`⚠️ Error checking alerts:`, alertError);
      // Don't fail the whole scraping process if alert checking fails
    }
    
  } catch (error) {
    console.error(`❌ Scheduled gold price scraping failed:`, error);
  }
}

/**
 * Perform news scraping task - Only scrapes today's news/trends
 * After scraping, automatically generates predictions for next 1 week
 */
async function performNewsScraping(): Promise<void> {
  try {
    console.log(`\n📰 [${new Date().toISOString()}] Starting scheduled news scraping (TODAY'S NEWS ONLY)...`);
    
    // Scrape only today's news and trends
    const articles = await scrapeAllGoldNews();
    await saveNewsArticles(articles);
    
    console.log(`✅ News scraping completed: ${articles.length} today's articles scraped`);
    
    // After scraping today's news, generate predictions for next 1 week
    console.log(`\n🤖 [${new Date().toISOString()}] Generating gold price predictions for next 7 days based on today's news...`);
    
    try {
      // Get current gold price
      const currentPriceData = await getLatestPrice('India');
      if (!currentPriceData) {
        console.warn(`⚠️  No current price data available. Skipping prediction generation.`);
        return;
      }
      
      // Check existing predictions to see what dates need predictions
      const existingDates = await getExistingPredictionDates();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      // Calculate which dates need predictions (next 7 days starting from tomorrow)
      const datesNeeded: string[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(tomorrow);
        date.setDate(tomorrow.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        if (!existingDates.has(dateStr)) {
          datesNeeded.push(dateStr);
        }
      }
      
      if (datesNeeded.length === 0) {
        console.log(`ℹ️  All dates already have predictions. No new predictions needed.`);
        return;
      }
      
      console.log(`📅 Generating predictions for ${datesNeeded.length} missing dates: ${datesNeeded.join(', ')}`);
      
      // Generate predictions for next 7 days (starting from tomorrow)
      // The savePredictions function will automatically skip existing dates
      const currentPrice = currentPriceData.price_1g;
      const analysis = await generateGoldPricePredictions(currentPrice, 7);
      
      // Save predictions - existing dates will be skipped automatically
      await savePredictions(analysis);
      
      console.log(`✅ Predictions generated successfully for next 7 days`);
      console.log(`   (Existing predictions preserved, only new dates added)`);
      console.log(`   Recommendation: ${analysis.recommendation.toUpperCase()} (Confidence: ${analysis.confidence}%)`);
    } catch (predictionError) {
      console.error(`❌ Failed to generate predictions after news scraping:`, predictionError);
      // Don't throw - news scraping succeeded, prediction failure is separate
    }
    
  } catch (error) {
    console.error(`❌ Scheduled news scraping failed:`, error);
  }
}

/**
 * Perform market data scraping task
 */
async function performMarketScraping(): Promise<void> {
  try {
    console.log(`\n📈 [${new Date().toISOString()}] Starting scheduled market data scraping...`);
    
    const [usMarkets, indiaMarkets, currencyRates] = await Promise.all([
      scrapeUSMarkets(),
      scrapeIndiaMarkets(),
      scrapeCurrencyRates()
    ]);
    
    const allMarkets = [...usMarkets, ...indiaMarkets, ...currencyRates];
    await saveMarketData(allMarkets);
    
    console.log(`✅ Market data scraping completed: ${allMarkets.length} indices scraped`);
  } catch (error) {
    console.error(`❌ Scheduled market data scraping failed:`, error);
  }
}

/**
 * Perform Bitcoin price scraping task
 */
async function performBitcoinScraping(): Promise<void> {
  try {
    console.log(`\n₿ [${new Date().toISOString()}] Starting scheduled Bitcoin price scraping...`);
    
    const price = await scrapeBitcoinPrice();
    if (!price) {
      throw new Error('Failed to scrape Bitcoin price');
    }
    
    await saveBitcoinPrice(price);
    
    console.log(`✅ Bitcoin price scraped and saved: $${price.price_usd} (₹${price.price_inr.toFixed(2)})`);
  } catch (error) {
    console.error(`❌ Scheduled Bitcoin scraping failed:`, error);
  }
}

/**
 * Parse cron schedule to get hour and minute
 */
function parseCronSchedule(schedule: string): { hour: number; minute: number } {
  const parts = schedule.split(' ');
  return {
    minute: parseInt(parts[0]),
    hour: parseInt(parts[1]),
  };
}

/**
 * Check if a scheduled time has passed today
 */
function hasScheduledTimePassed(schedule: string): boolean {
  const { hour, minute } = parseCronSchedule(schedule);
  const now = new Date();
  const scheduledTime = new Date();
  scheduledTime.setHours(hour, minute, 0, 0);
  return now >= scheduledTime;
}

/**
 * Check if data was scraped today
 */
async function wasScrapedToday(tableName: string, timestampColumn: string = 'timestamp'): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT COUNT(*) as count FROM ${tableName} WHERE DATE(${timestampColumn}) = CURRENT_DATE`
    );
    return parseInt(result.rows[0].count) > 0;
  } finally {
    client.release();
  }
}

/**
 * Run any missed scrapers on startup
 * This catches up on any scrapers that should have run today but didn't because the server was down
 */
async function runMissedScrapers(): Promise<void> {
  console.log('\n🔍 Checking for missed scraper runs...');
  
  const goldSchedule = process.env.SCRAPE_SCHEDULE || '0 11 * * *';
  const newsScheduleMorning = process.env.NEWS_SCRAPE_SCHEDULE_MORNING || '5 11 * * *';
  const bitcoinSchedule = process.env.BITCOIN_SCRAPE_SCHEDULE || '0 11 * * *';
  const marketSchedule = process.env.MARKET_SCRAPE_SCHEDULE || '15 11 * * *';
  
  const missedTasks: { name: string; task: () => Promise<void> }[] = [];
  
  // Check Gold Price (11 AM)
  if (hasScheduledTimePassed(goldSchedule)) {
    const scraped = await wasScrapedToday('gold_prices');
    if (!scraped) {
      missedTasks.push({ name: 'Gold Price', task: performGoldPriceScraping });
    }
  }
  
  // Check Bitcoin (11 AM)
  if (hasScheduledTimePassed(bitcoinSchedule)) {
    const scraped = await wasScrapedToday('bitcoin_prices');
    if (!scraped) {
      missedTasks.push({ name: 'Bitcoin', task: performBitcoinScraping });
    }
  }
  
  // Check News Morning (11:05 AM)
  if (hasScheduledTimePassed(newsScheduleMorning)) {
    const scraped = await wasScrapedToday('gold_news', 'created_at');
    if (!scraped) {
      missedTasks.push({ name: 'News', task: performNewsScraping });
    }
  }
  
  // Check Markets (4 PM)
  if (hasScheduledTimePassed(marketSchedule)) {
    const scraped = await wasScrapedToday('market_data');
    if (!scraped) {
      missedTasks.push({ name: 'Markets', task: performMarketScraping });
    }
  }
  
  if (missedTasks.length === 0) {
    console.log('✅ No missed scrapers - all data is up to date for today');
    return;
  }
  
  console.log(`\n⚠️  Found ${missedTasks.length} missed scraper(s): ${missedTasks.map(t => t.name).join(', ')}`);
  console.log('🔄 Running missed scrapers now (catch-up mode)...\n');
  
  // Run missed tasks sequentially to avoid overloading
  for (const task of missedTasks) {
    console.log(`\n🔄 [CATCH-UP] Running missed ${task.name} scraper...`);
    try {
      await task.task();
      console.log(`✅ [CATCH-UP] ${task.name} scraper completed`);
    } catch (error) {
      console.error(`❌ [CATCH-UP] ${task.name} scraper failed:`, error);
    }
    
    // Small delay between scrapers to be gentle on external APIs
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n✅ Catch-up scraping completed');
}

/**
 * Initialize and start all schedulers
 */
export function initializeScheduler(): void {
  const timezone = process.env.SCRAPE_TIMEZONE || 'Asia/Kolkata';
  
  // Gold Price: Daily at 11 AM IST
  const goldPriceSchedule = process.env.SCRAPE_SCHEDULE || '0 11 * * *';
  if (cron.validate(goldPriceSchedule)) {
    goldPriceTask = cron.schedule(goldPriceSchedule, performGoldPriceScraping, {
      scheduled: true,
      timezone
    });
    console.log(`📅 Gold price scheduler initialized: ${goldPriceSchedule} (11 AM daily)`);
  }
  
  // News: Twice daily (at 11:05 AM and 7 PM IST) - scrapes today's news and generates predictions
  // Morning scrape at 11:05 AM (after gold price scraping)
  const newsScheduleMorning = process.env.NEWS_SCRAPE_SCHEDULE_MORNING || '5 11 * * *'; // 11:05 AM daily
  if (cron.validate(newsScheduleMorning)) {
    newsTask = cron.schedule(newsScheduleMorning, performNewsScraping, {
      scheduled: true,
      timezone
    });
    console.log(`📅 News scheduler (Morning) initialized: ${newsScheduleMorning} (11:05 AM - TODAY'S NEWS ONLY)`);
  }
  
  // Evening scrape at 7 PM
  const newsScheduleEvening = process.env.NEWS_SCRAPE_SCHEDULE_EVENING || '0 19 * * *'; // 7 PM daily
  if (cron.validate(newsScheduleEvening)) {
    newsTaskEvening = cron.schedule(newsScheduleEvening, performNewsScraping, {
      scheduled: true,
      timezone
    });
    console.log(`📅 News scheduler (Evening) initialized: ${newsScheduleEvening} (7 PM - TODAY'S NEWS ONLY)`);
  }
  
  console.log(`📅 After each news scraping, predictions will be automatically generated for next 7 days`);
  
  // Markets: Daily at 11:15 AM IST (after gold/bitcoin scraping)
  const marketSchedule = process.env.MARKET_SCRAPE_SCHEDULE || '15 11 * * *';
  if (cron.validate(marketSchedule)) {
    marketTask = cron.schedule(marketSchedule, performMarketScraping, {
      scheduled: true,
      timezone
    });
    console.log(`📅 Market data scheduler initialized: ${marketSchedule} (11:15 AM daily)`);
  }
  
  // Bitcoin: Daily at 11 AM IST (same time as gold price)
  const bitcoinSchedule = process.env.BITCOIN_SCRAPE_SCHEDULE || '0 11 * * *';
  if (cron.validate(bitcoinSchedule)) {
    bitcoinTask = cron.schedule(bitcoinSchedule, performBitcoinScraping, {
      scheduled: true,
      timezone
    });
    console.log(`📅 Bitcoin scheduler initialized: ${bitcoinSchedule} (11 AM daily)`);
  }
  
  console.log('✅ All schedulers initialized and running');
  
  // Run catch-up for any missed scrapers (async, don't block startup)
  runMissedScrapers().catch(err => {
    console.error('❌ Error during catch-up scraping:', err);
  });
}

/**
 * Stop all schedulers
 */
export function stopScheduler(): void {
  if (goldPriceTask) {
    goldPriceTask.stop();
    goldPriceTask = null;
  }
  if (newsTask) {
    newsTask.stop();
    newsTask = null;
  }
  if (newsTaskEvening) {
    newsTaskEvening.stop();
    newsTaskEvening = null;
  }
  if (marketTask) {
    marketTask.stop();
    marketTask = null;
  }
  if (bitcoinTask) {
    bitcoinTask.stop();
    bitcoinTask = null;
  }
  console.log('⏹️ All schedulers stopped');
}

/**
 * Manually trigger gold price scraping (useful for testing)
 */
export async function triggerManualScrape(): Promise<void> {
  console.log('🔧 Manual gold price scrape triggered');
  await performGoldPriceScraping();
}

/**
 * Get current scheduler status and last scraped times
 */
export async function getSchedulerStatus(): Promise<{
  current_time: string;
  timezone: string;
  schedulers: {
    name: string;
    schedule: string;
    next_run: string;
    is_active: boolean;
  }[];
  last_scraped: {
    gold_price: string | null;
    bitcoin: string | null;
    markets: string | null;
    news: string | null;
  };
}> {
  const timezone = process.env.SCRAPE_TIMEZONE || 'Asia/Kolkata';
  const now = new Date();
  
  // Get last scraped times from database
  const client = await pool.connect();
  try {
    const [goldResult, bitcoinResult, marketsResult, newsResult] = await Promise.all([
      client.query('SELECT MAX(timestamp) as last FROM gold_prices'),
      client.query('SELECT MAX(timestamp) as last FROM bitcoin_prices'),
      client.query('SELECT MAX(timestamp) as last FROM market_data'),
      client.query('SELECT MAX(created_at) as last FROM gold_news'),
    ]);
    
    // Calculate next runs (approximate based on cron schedules)
    const getNextRun = (schedule: string): string => {
      const parts = schedule.split(' ');
      const minute = parseInt(parts[0]);
      const hour = parseInt(parts[1]);
      
      const nextRun = new Date();
      nextRun.setHours(hour, minute, 0, 0);
      
      // If already past today's time, next run is tomorrow
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      
      return nextRun.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    };
    
    const goldSchedule = process.env.SCRAPE_SCHEDULE || '0 11 * * *';
    const newsScheduleMorning = process.env.NEWS_SCRAPE_SCHEDULE_MORNING || '5 11 * * *';
    const newsScheduleEvening = process.env.NEWS_SCRAPE_SCHEDULE_EVENING || '0 19 * * *';
    const marketSchedule = process.env.MARKET_SCRAPE_SCHEDULE || '15 11 * * *';
    const bitcoinSchedule = process.env.BITCOIN_SCRAPE_SCHEDULE || '0 11 * * *';
    
    return {
      current_time: now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      timezone,
      schedulers: [
        {
          name: 'Gold Price',
          schedule: goldSchedule + ' (11:00 AM IST)',
          next_run: getNextRun(goldSchedule),
          is_active: goldPriceTask !== null,
        },
        {
          name: 'Bitcoin',
          schedule: bitcoinSchedule + ' (11:00 AM IST)',
          next_run: getNextRun(bitcoinSchedule),
          is_active: bitcoinTask !== null,
        },
        {
          name: 'News (Morning)',
          schedule: newsScheduleMorning + ' (11:05 AM IST)',
          next_run: getNextRun(newsScheduleMorning),
          is_active: newsTask !== null,
        },
        {
          name: 'News (Evening)',
          schedule: newsScheduleEvening + ' (7:00 PM IST)',
          next_run: getNextRun(newsScheduleEvening),
          is_active: newsTaskEvening !== null,
        },
        {
          name: 'Markets',
          schedule: marketSchedule + ' (11:15 AM IST)',
          next_run: getNextRun(marketSchedule),
          is_active: marketTask !== null,
        },
      ],
      last_scraped: {
        gold_price: goldResult.rows[0]?.last ? new Date(goldResult.rows[0].last).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : null,
        bitcoin: bitcoinResult.rows[0]?.last ? new Date(bitcoinResult.rows[0].last).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : null,
        markets: marketsResult.rows[0]?.last ? new Date(marketsResult.rows[0].last).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : null,
        news: newsResult.rows[0]?.last ? new Date(newsResult.rows[0].last).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : null,
      },
    };
  } finally {
    client.release();
  }
}
