import dotenv from 'dotenv';
import { scrapeGoldPrice } from '../services/scraper';
import { insertPrice, isPriceScrapedToday } from '../services/priceService';

dotenv.config();

async function manualScrape() {
  try {
    console.log('🔧 Manual scraping triggered...');
    
    // Check if already scraped today
    const alreadyScraped = await isPriceScrapedToday();
    if (alreadyScraped) {
      console.log('ℹ️ Price already scraped today. Use force flag to override.');
      process.exit(0);
    }
    
    // Scrape price
    const scrapedPrice = await scrapeGoldPrice();
    if (!scrapedPrice) {
      throw new Error('Failed to scrape price');
    }
    
    // Save to database
    const savedPrice = await insertPrice({
      price_10g: scrapedPrice.price_10g,
      price_1g: scrapedPrice.price_1g,
      city: scrapedPrice.city,
      source: scrapedPrice.source
    });
    
    console.log('✅ Price saved to database:', savedPrice);
    process.exit(0);
  } catch (error) {
    console.error('❌ Manual scraping failed:', error);
    process.exit(1);
  }
}

manualScrape();

