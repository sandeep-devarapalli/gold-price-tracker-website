import { scrapeUrl } from './firecrawlService';
import pool from '../db/connection';
import axios from 'axios';
import { JSDOM } from 'jsdom';

export interface BitcoinPrice {
  price_usd: number;
  price_inr: number;
  change_24h: number;
  percent_change_24h: number;
  timestamp: Date;
}

/**
 * Get USD to INR exchange rate from database (or default fallback)
 */
async function getUSDToINRRate(): Promise<number> {
  try {
    const client = await pool.connect();
    try {
      // Get latest USD/INR rate from market_data table
      const result = await client.query(
        `SELECT value FROM market_data 
         WHERE market_type = 'Currency' AND index_name = 'USD/INR'
         ORDER BY timestamp DESC
         LIMIT 1`
      );
      
      if (result.rows.length > 0 && result.rows[0].value) {
        const rate = parseFloat(result.rows[0].value);
        if (rate > 70 && rate < 100) { // Sanity check
          console.log(`✅ Using USD/INR rate from database: ${rate}`);
          return rate;
        }
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.log(`⚠️ Could not fetch USD/INR from database, using default`);
  }
  
  // Fallback to default rate
  return 83.0;
}

/**
 * Parse number from text (handles various formats including unicode minus signs)
 */
function parseNumber(text: string): number | null {
  if (!text) return null;
  
  const cleaned = text
    .replace(/[,\s$]/g, '')
    // Replace various dash types with standard hyphen
    .replace(/[\u2212\u2013\u2014]/g, '-')
    // Remove currency symbols but keep digits, dot, and hyphen
    .replace(/[^\d.-]/g, '');
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Extract Bitcoin price from scraped content
 */
function extractBitcoinPrice(content: string): BitcoinPrice | null {
  // Look for Bitcoin price patterns from Google Finance
  // Format from g.co/finance/BTC-USD shows: "Bitcoin (BTC / USD) 87,010.79"
  const patterns = [
    /Bitcoin\s*\(BTC\s*\/\s*USD\)\s*([\d,]+(?:\.\d+)?)/i,  // Bitcoin (BTC / USD) 87,010.79
    /BTC\s*\/\s*USD[^\d]*([\d,]+(?:\.\d+)?)/i,  // BTC / USD 87,010.79
    /\$\s*([\d,]+(?:\.\d+)?)\s*(?:USD|Dec)/,  // $87,010.79 Dec 2
    /([\d,]+(?:\.\d+)?)\s*Dec\s*2,\s*5:59:51\s*AM/i,  // 87,010.79 Dec 2, 5:59:51 AM
    /Bitcoin[^\d]*([\d,]+(?:\.\d+)?)/i,  // Bitcoin 87010.79
    /\$([\d,]+(?:\.\d+)?)/,  // $50,000 format
  ];
  
  let priceUSD: number | null = null;
  
  // Try to find price in USD
  for (const pattern of patterns) {
    const matches = content.matchAll(new RegExp(pattern, 'gi'));
    for (const match of matches) {
      if (match && match[1]) {
        const parsed = parseNumber(match[1]);
        if (parsed && parsed > 10000 && parsed < 200000) { // Reasonable range for BTC (2024-2025)
          priceUSD = parsed;
          console.log(`✅ Found Bitcoin price using pattern: $${priceUSD}`);
          break;
        }
      }
    }
    if (priceUSD) break;
  }
  
  // Look for 24h change from Google Finance format
  // Previous close shows: "Previous close 86,322.54"
  let change24h: number = 0;
  let percentChange24h: number = 0;
  
  // Try to find previous close to calculate change
  const previousClosePattern = /Previous\s+close\s*([\d,]+(?:\.\d+)?)/i;
  const previousCloseMatch = content.match(previousClosePattern);
  
  if (previousCloseMatch && previousCloseMatch[1] && priceUSD) {
    const previousClose = parseNumber(previousCloseMatch[1]);
    if (previousClose) {
      change24h = priceUSD - previousClose;
      percentChange24h = previousClose > 0 ? ((change24h / previousClose) * 100) : 0;
      console.log(`✅ Calculated 24h change: ${change24h.toFixed(2)} (${percentChange24h.toFixed(2)}%)`);
    }
  }
  
  // Fallback: Look for change patterns directly
  if (change24h === 0) {
    const changePatterns = [
      /([+-]?[\d,]+(?:\.\d+)?)\s*24h/i,
      /24h[^\d]*([+-]?[\d,]+(?:\.\d+)?)/i,
    ];
    
    for (const pattern of changePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const parsed = parseNumber(match[1]);
        if (parsed) {
          change24h = parsed;
          break;
        }
      }
    }
    
    const percentPattern = /([+-]?[\d,]+(?:\.[\d]+)?)%[^0-9]*24h/i;
    const percentMatch = content.match(percentPattern);
    if (percentMatch && percentMatch[1]) {
      percentChange24h = parseNumber(percentMatch[1]) || 0;
    }
  }
  
  if (!priceUSD) {
    return null;
  }
  
  return {
    price_usd: priceUSD,
    price_inr: 0, // Will be calculated
    change_24h: change24h,
    percent_change_24h: percentChange24h,
    timestamp: new Date(),
  };
}

/**
 * Scrape Bitcoin price directly from Google Finance using local HTML parsing
 * This bypasses Firecrawl API limits
 */
async function fetchBitcoinPriceFromGoogleFinance(): Promise<BitcoinPrice | null> {
  try {
    const url = 'https://www.google.com/finance/quote/BTC-USD';
    console.log(`₿ Local scraping Bitcoin from Google Finance: ${url}`);

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 10000
    });

    const dom = new JSDOM(response.data);
    const document = dom.window.document;

    // Use the same approach as market scraper
    const allPrices = document.querySelectorAll('.YMlKec.fxKbKc');
    const priceElement = allPrices[0];
    
    if (!priceElement) {
      console.log(`⚠️ No price element found on Google Finance`);
      return null;
    }

    const priceText = priceElement.textContent || '';
    const priceUSD = parseNumber(priceText);
    
    if (!priceUSD || priceUSD < 10000 || priceUSD > 200000) {
      console.log(`⚠️ Invalid price found: ${priceUSD}`);
      return null;
    }

    // Find change values using the same math validation approach as market scraper
    let change24h = 0;
    let percentChange24h = 0;

    const allBadges = document.querySelectorAll('.P2Luy, .Ez2Ioe, .JwB6zf');
    const precedingBadges: { num: number | null, text: string, element: Element }[] = [];
    
    for (let i = 0; i < allBadges.length; i++) {
      const badge = allBadges[i];
      if (priceElement.compareDocumentPosition(badge) & 2) {
        const text = badge.textContent || '';
        const num = parseNumber(text);
        if (num !== null) {
          precedingBadges.push({ num, text, element: badge });
        }
      }
    }
    
    const closestBadges = precedingBadges.slice(0, 5);
    
    if (priceUSD && closestBadges.length > 0) {
      for (const c of closestBadges) {
        if (!c.num || c.text.includes('%')) continue;
        
        const potentialChange = c.num;
        // Ignore if change is too large relative to price
        if (Math.abs(potentialChange) >= priceUSD * 0.1) continue;
        
        const expectedPercent = (potentialChange / priceUSD) * 100;
        
        const match = closestBadges.find(p => {
          if (!p.num || !p.text.includes('%')) return false;
          return Math.abs(p.num - expectedPercent) < 0.1;
        });
        
        if (match && match.num) {
          change24h = potentialChange;
          percentChange24h = match.num;
          console.log(`✅ Found Bitcoin change: ${change24h} (${percentChange24h}%)`);
          break;
        }
      }
    }

    // Calculate INR price
    const usdToInr = await getUSDToINRRate();
    const priceINR = priceUSD * usdToInr;
    
    console.log(`✅ Found Bitcoin price: $${priceUSD} (₹${priceINR.toFixed(2)})`);
    
    return {
      price_usd: priceUSD,
      price_inr: priceINR,
      change_24h: change24h,
      percent_change_24h: percentChange24h,
      timestamp: new Date()
    };
  } catch (error: any) {
    console.error('❌ Error scraping Google Finance for Bitcoin:', error.message);
    return null;
  }
}

/**
 * Scrape Bitcoin price from Google Finance
 * Uses the official Google Finance short URL: https://g.co/finance/BTC-USD
 */
export async function scrapeBitcoinPrice(): Promise<BitcoinPrice | null> {
  try {
    console.log('₿ Scraping Bitcoin price from Google Finance...');
    
    // Try Firecrawl first
    const url = 'https://g.co/finance/BTC-USD';
    
    const result = await scrapeUrl(url, {
      onlyMainContent: true,
      formats: ['markdown'],
    });
    
    if (result.success && result.markdown) {
      const bitcoinPrice = extractBitcoinPrice(result.markdown);
      
      if (bitcoinPrice) {
        // Calculate INR price
        const usdToInr = await getUSDToINRRate();
        bitcoinPrice.price_inr = bitcoinPrice.price_usd * usdToInr;
        
        console.log(`✅ Bitcoin price scraped from Google Finance (Firecrawl): $${bitcoinPrice.price_usd} (₹${bitcoinPrice.price_inr.toFixed(2)})`);
        return bitcoinPrice;
      }
    }
    
    // If Firecrawl fails, try direct HTML scraping
    console.log('⚠️ Firecrawl failed for Bitcoin, trying direct HTML scraping...');
    const directResult = await fetchBitcoinPriceFromGoogleFinance();
    
    if (directResult) {
      console.log(`✅ Bitcoin price scraped from Google Finance (direct): $${directResult.price_usd} (₹${directResult.price_inr.toFixed(2)})`);
      return directResult;
    }
    
    console.error('❌ Could not extract Bitcoin price from Google Finance');
    return null;
  } catch (error) {
    console.error('❌ Error scraping Bitcoin price from Google Finance:', error);
    return null;
  }
}

/**
 * Save Bitcoin price to database
 * Calculates change_24h and percent_change_24h from previous day's value
 */
export async function saveBitcoinPrice(price: BitcoinPrice): Promise<void> {
  const client = await pool.connect();
  
  try {
    // Get previous day's price to calculate 24h change
    const previousDayQuery = await client.query(
      `SELECT price_usd FROM bitcoin_prices 
       WHERE timestamp < $1
       ORDER BY timestamp DESC
       LIMIT 1`,
      [price.timestamp]
    );
    
    let calculatedChange24h = 0;
    let calculatedPercentChange24h = 0;
    
    if (previousDayQuery.rows.length > 0) {
      const previousPrice = parseFloat(previousDayQuery.rows[0].price_usd);
      calculatedChange24h = price.price_usd - previousPrice;
      calculatedPercentChange24h = previousPrice !== 0 ? (calculatedChange24h / previousPrice) * 100 : 0;
      console.log(`📊 Calculated 24h change for Bitcoin: ${calculatedChange24h.toFixed(2)} (${calculatedPercentChange24h.toFixed(2)}%) from previous price $${previousPrice}`);
    } else {
      // No previous data, use scraper values or 0
      calculatedChange24h = price.change_24h || 0;
      calculatedPercentChange24h = price.percent_change_24h || 0;
      console.log(`ℹ️  No previous Bitcoin data, using scraper values or 0`);
    }
    
    // Check if price already exists for this hour
    const hourStart = new Date(price.timestamp);
    hourStart.setMinutes(0, 0, 0);
    
    const existingCheck = await client.query(
      `SELECT id FROM bitcoin_prices 
       WHERE DATE_TRUNC('hour', timestamp) = DATE_TRUNC('hour', $1::timestamp)`,
      [price.timestamp]
    );
    
    if (existingCheck.rows.length > 0) {
      // Update existing record with calculated changes
      await client.query(
        `UPDATE bitcoin_prices 
         SET price_usd = $1, price_inr = $2, change_24h = $3, percent_change_24h = $4, timestamp = $5
         WHERE DATE_TRUNC('hour', timestamp) = DATE_TRUNC('hour', $5::timestamp)`,
        [
          price.price_usd,
          price.price_inr,
          calculatedChange24h,
          calculatedPercentChange24h,
          price.timestamp
        ]
      );
      console.log(`✅ Updated Bitcoin price: $${price.price_usd} (Change: ${calculatedChange24h.toFixed(2)}, ${calculatedPercentChange24h.toFixed(2)}%)`);
    } else {
      // Insert new record with calculated changes
      await client.query(
        `INSERT INTO bitcoin_prices (price_usd, price_inr, change_24h, percent_change_24h, timestamp)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          price.price_usd,
          price.price_inr,
          calculatedChange24h,
          calculatedPercentChange24h,
          price.timestamp
        ]
      );
      console.log(`✅ Saved Bitcoin price: $${price.price_usd} (Change: ${calculatedChange24h.toFixed(2)}, ${calculatedPercentChange24h.toFixed(2)}%)`);
    }
  } finally {
    client.release();
  }
}

/**
 * Get latest Bitcoin price from database
 * Recalculates change_24h and percent_change_24h from previous day's value to ensure accuracy
 */
export async function getLatestBitcoinPrice(): Promise<BitcoinPrice | null> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT price_usd, price_inr, change_24h, percent_change_24h, timestamp
       FROM bitcoin_prices
       ORDER BY timestamp DESC
       LIMIT 1`
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    const currentPrice = parseFloat(row.price_usd);
    const currentTimestamp = row.timestamp;
    
    // Recalculate changes from previous day
    const previousDayQuery = await client.query(
      `SELECT price_usd FROM bitcoin_prices 
       WHERE timestamp < $1
       ORDER BY timestamp DESC
       LIMIT 1`,
      [currentTimestamp]
    );
    
    let calculatedChange24h = parseFloat(row.change_24h);
    let calculatedPercentChange24h = parseFloat(row.percent_change_24h);
    
    if (previousDayQuery.rows.length > 0) {
      const previousPrice = parseFloat(previousDayQuery.rows[0].price_usd);
      calculatedChange24h = currentPrice - previousPrice;
      calculatedPercentChange24h = previousPrice !== 0 ? (calculatedChange24h / previousPrice) * 100 : 0;
    }
    
    return {
      price_usd: currentPrice,
      price_inr: parseFloat(row.price_inr),
      change_24h: calculatedChange24h,
      percent_change_24h: calculatedPercentChange24h,
      timestamp: currentTimestamp,
    };
  } finally {
    client.release();
  }
}

/**
 * Get Bitcoin price history
 */
export async function getBitcoinHistory(days: number = 30): Promise<BitcoinPrice[]> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT price_usd, price_inr, change_24h, percent_change_24h, timestamp
       FROM bitcoin_prices
       WHERE timestamp >= NOW() - INTERVAL '${days} days'
       ORDER BY timestamp DESC`
    );
    
    return result.rows.map(row => ({
      price_usd: parseFloat(row.price_usd),
      price_inr: parseFloat(row.price_inr),
      change_24h: parseFloat(row.change_24h),
      percent_change_24h: parseFloat(row.percent_change_24h),
      timestamp: row.timestamp,
    }));
  } finally {
    client.release();
  }
}

