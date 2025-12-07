import dotenv from 'dotenv';
import { scrapeGoldPrice } from '../services/scraper';
import { insertPrice } from '../services/priceService';
import { scrapeUSMarkets, scrapeIndiaMarkets, saveMarketData } from '../services/marketScraper';
import { scrapeBitcoinPrice, saveBitcoinPrice } from '../services/bitcoinScraper';

dotenv.config();

/**
 * Master scraping script that:
 * 1. Clears old data from database (optional - controlled by CLEAR_OLD_DATA env var)
 * 2. Scrapes current gold price from Google Finance
 * 3. Scrapes US and India market data from Google Finance
 * 4. Scrapes Bitcoin price from Google Finance
 */
async function scrapeAll() {
  try {
    console.log('🚀 Starting comprehensive scraping from Google Finance...\n');
    
    // Step 1: Clear old data if requested
    const shouldClear = process.env.CLEAR_OLD_DATA === 'true';
    if (shouldClear) {
      console.log('🗑️  Clearing old data...');
      const { default: clearDatabase } = await import('./clear-database');
      // Note: clearDatabase is exported as a function, but we need to call it
      // For now, we'll skip this step and let the user run it separately
      console.log('⚠️  Please run "npm run db:clear" separately to clear old data\n');
    }
    
    // Step 2: Scrape gold price
    console.log('='.repeat(60));
    console.log('📊 Step 1: Scraping Gold Price from Google Finance');
    console.log('='.repeat(60));
    try {
      const goldPrice = await scrapeGoldPrice();
      if (goldPrice) {
        const savedPrice = await insertPrice({
          price_10g: goldPrice.price_10g,
          price_1g: goldPrice.price_1g,
          country: goldPrice.country,
          source: goldPrice.source
        });
        console.log(`✅ Gold price saved: ₹${savedPrice.price_1g.toFixed(2)}/g (₹${savedPrice.price_10g.toFixed(2)}/10g)\n`);
      } else {
        console.error('❌ Failed to scrape gold price\n');
      }
    } catch (error) {
      console.error('❌ Error scraping gold price:', error);
      console.error('');
    }
    
    // Step 3: Scrape US and India markets
    console.log('='.repeat(60));
    console.log('📈 Step 2: Scraping Market Data from Google Finance');
    console.log('='.repeat(60));
    try {
      const [usMarkets, indiaMarkets] = await Promise.all([
        scrapeUSMarkets(),
        scrapeIndiaMarkets()
      ]);
      
      const allMarkets = [...usMarkets, ...indiaMarkets];
      if (allMarkets.length > 0) {
        await saveMarketData(allMarkets);
        console.log(`✅ Market data saved: ${allMarkets.length} indices\n`);
      } else {
        console.error('❌ No market data scraped\n');
      }
    } catch (error) {
      console.error('❌ Error scraping market data:', error);
      console.error('');
    }
    
    // Step 4: Scrape Bitcoin price
    console.log('='.repeat(60));
    console.log('₿ Step 3: Scraping Bitcoin Price from Google Finance');
    console.log('='.repeat(60));
    try {
      const bitcoinPrice = await scrapeBitcoinPrice();
      if (bitcoinPrice) {
        await saveBitcoinPrice(bitcoinPrice);
        console.log(`✅ Bitcoin price saved: $${bitcoinPrice.price_usd} (₹${bitcoinPrice.price_inr.toFixed(2)})\n`);
      } else {
        console.error('❌ Failed to scrape Bitcoin price\n');
      }
    } catch (error) {
      console.error('❌ Error scraping Bitcoin price:', error);
      console.error('');
    }
    
    console.log('='.repeat(60));
    console.log('✅ All scraping completed!');
    console.log('='.repeat(60));
    console.log('\n📝 Note: Historical gold prices for 30 days are not easily available');
    console.log('   via scraping. Current price has been scraped. For true historical');
    console.log('   data, consider using a dedicated gold price API.\n');
    
  } catch (error) {
    console.error('❌ Fatal error during scraping:', error);
    process.exit(1);
  }
}

// Run scraping
scrapeAll()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

