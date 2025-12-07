import { scrapeUrl, searchWeb } from './firecrawlService';
import pool from '../db/connection';
import axios from 'axios';
import { JSDOM } from 'jsdom';

export interface MarketData {
  market_type: 'US' | 'India' | 'Currency';
  index_name: string;
  value: number;
  change: number;
  percent_change: number;
  timestamp: Date;
}

/**
 * Fetch market data directly from Google Finance using local scraping
 * This bypasses Firecrawl API limits
 */
async function fetchGoogleFinanceData(symbol: string, indexName: string, marketType: 'US' | 'India' | 'Currency'): Promise<MarketData | null> {
  const url = `https://www.google.com/finance/quote/${symbol}`;
  console.log(`🕷️ Local scraping ${indexName} from ${url}`);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 10000 // 10 second timeout to prevent hanging
    });

    const dom = new JSDOM(response.data);
    const document = dom.window.document;

    // Selectors for Google Finance (as of Dec 2025)
    // Price class: YMlKec fxKbKc
    // The first one on the quote page is always the main index price
    const allPrices = document.querySelectorAll('.YMlKec.fxKbKc');
    const priceElement = allPrices[0];
    
    if (priceElement) {
      const priceText = priceElement.textContent || '';
      const value = parseNumber(priceText);

      let change = 0;
      let percentChange = 0;

      // Smart Matching Strategy: Math verification + DOM proximity
      // Relationship: Change / Price * 100 ~= Percent
      // But only match badges that are close to the price element in DOM
      
      const allBadges = document.querySelectorAll('.P2Luy, .Ez2Ioe, .JwB6zf');
      
      // First, filter badges by DOM proximity (preceding the price)
      // Take only the last 5 preceding badges (closest to price)
      const precedingBadges: { num: number, text: string, element: Element }[] = [];
      
      for (let i = 0; i < allBadges.length; i++) {
        const badge = allBadges[i];
        // Check if badge is preceding the price
        if (priceElement.compareDocumentPosition(badge) & 2) {
            const text = badge.textContent || '';
            const num = parseNumber(text);
            if (num !== null) {
                precedingBadges.push({ num, text, element: badge });
            }
        }
      }
      
      // Take the FIRST 5 badges (closest to price in DOM order)
      // precedingBadges[0] is closest, precedingBadges[n-1] is furthest
      // This avoids picking up badges from "Compare" sections which appear later
      const closestBadges = precedingBadges.slice(0, 5);
      
      let foundMatch = false;
      
      if (value && value !== 0 && closestBadges.length > 0) {
          // Try to find a pair (Change, Percent) in the closest badges
          for (const c of closestBadges) {
              // Skip percentages when looking for change value
              if (c.text.includes('%')) continue;
              
              const potentialChange = c.num;
              // Ignore if change is too large relative to price (likely wrong index)
              if (Math.abs(potentialChange) >= value * 0.1) continue;
              
              const expectedPercent = (potentialChange / value) * 100;
              
              // Find a matching percentage badge ONLY in closest badges
              const match = closestBadges.find(p => {
                  if (!p.text.includes('%')) return false;
                  // Strict tolerance: 0.1% for rounding errors
                  return Math.abs(p.num - expectedPercent) < 0.1;
              });
              
              if (match) {
                  change = potentialChange;
                  percentChange = match.num;
                  foundMatch = true;
                  console.log(`✅ Math Match (closest): ${change} / ${value} * 100 = ${expectedPercent.toFixed(2)}% ≈ ${percentChange}%`);
                  break;
              }
          }
      }
      
      // If no match in first 5, try the next 5 (badges 6-10)
      if (!foundMatch && precedingBadges.length > 5) {
          const nextBadges = precedingBadges.slice(5, 10);
          for (const c of nextBadges) {
              if (c.text.includes('%')) continue;
              const potentialChange = c.num;
              if (Math.abs(potentialChange) >= value * 0.1) continue;
              
              const expectedPercent = (potentialChange / value) * 100;
              const match = nextBadges.find(p => {
                  if (!p.text.includes('%')) return false;
                  return Math.abs(p.num - expectedPercent) < 0.1;
              });
              
              if (match) {
                  change = potentialChange;
                  percentChange = match.num;
                  foundMatch = true;
                  console.log(`✅ Math Match (extended): ${change} / ${value} * 100 = ${expectedPercent.toFixed(2)}% ≈ ${percentChange}%`);
                  break;
              }
          }
      }
      
      // If no math match found, log a warning but return 0 change (better than wrong data)
      if (!foundMatch) {
          console.log(`⚠️ No valid math match found for ${indexName}. Change values will be 0 (market may be closed/unchanged).`);
          // Change and percentChange remain 0, which is acceptable if market is closed or unchanged
      }

      if (value !== null) {
        console.log(`✅ Found ${indexName}: ${value} (Change: ${change}, ${percentChange}%)`);
        return {
          market_type: marketType,
          index_name: indexName,
          value,
          change,
          percent_change: percentChange,
          timestamp: new Date()
        };
      }
    }
    
    console.warn(`⚠️ Could not find price element for ${indexName}`);
    return null;

  } catch (error) {
    console.error(`❌ Error scraping ${indexName}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Parse number with commas and formatting
 */
function parseNumber(text: string): number | null {
  if (!text) return null;
  
  const cleaned = text
    .replace(/[,\s]/g, '')
    // Replace various dash types with standard hyphen
    .replace(/[\u2212\u2013\u2014]/g, '-')
    // Remove currency symbols (₹, $, etc.) but keep digits, dot, and hyphen
    .replace(/[^\d.-]/g, '');
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Scrape US market data using Local Scraper
 */
export async function scrapeUSMarkets(): Promise<MarketData[]> {
  const markets: MarketData[] = [];
  const indices = [
    { name: 'S&P 500', symbol: '.INX:INDEXSP' },
    { name: 'Dow Jones', symbol: '.DJI:INDEXDJX' },
    { name: 'NASDAQ', symbol: '.IXIC:INDEXNASDAQ' },
  ];
  
  console.log('📈 Fetching US market data using Local Scraper...');
  
  for (const index of indices) {
    const data = await fetchGoogleFinanceData(index.symbol, index.name, 'US');
    if (data) {
      markets.push(data);
    }
  }
  
  console.log(`✅ Total US market indices found: ${markets.length}`);
  return markets;
}

/**
 * Scrape India market data using Local Scraper
 */
export async function scrapeIndiaMarkets(): Promise<MarketData[]> {
  const markets: MarketData[] = [];
  const indices = [
    { name: 'Nifty', symbol: 'NIFTY_50:INDEXNSE' },
    { name: 'Sensex', symbol: 'SENSEX:INDEXBOM' },
  ];
  
  console.log('📈 Fetching India market data using Local Scraper...');
  
  for (const index of indices) {
    const data = await fetchGoogleFinanceData(index.symbol, index.name, 'India');
    if (data) {
      markets.push(data);
    }
  }
  
  console.log(`✅ Total India market indices found: ${markets.length}`);
  return markets;
}

/**
 * Scrape USD to INR exchange rate using Local Scraper
 */
export async function scrapeCurrencyRates(): Promise<MarketData[]> {
  const markets: MarketData[] = [];
  
  console.log('💱 Fetching currency rates using Local Scraper...');
  
  const data = await fetchGoogleFinanceData('USD-INR', 'USD/INR', 'Currency');
  if (data) {
    markets.push(data);
  }
  
  return markets;
}

/**
 * Save market data to database
 */
export async function saveMarketData(markets: MarketData[]): Promise<void> {
  const client = await pool.connect();
  
  try {
    for (const market of markets) {
      // Check if data already exists for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const existingCheck = await client.query(
        `SELECT id FROM market_data 
         WHERE market_type = $1 AND index_name = $2 AND DATE(timestamp) = DATE($3)`,
        [market.market_type, market.index_name, today]
      );
      
      if (existingCheck.rows.length > 0) {
        // Update existing record
        await client.query(
          `UPDATE market_data 
           SET value = $1, change = $2, percent_change = $3, timestamp = $4
           WHERE market_type = $5 AND index_name = $6 AND DATE(timestamp) = DATE($4)`,
          [
            market.value,
            market.change,
            market.percent_change,
            market.timestamp,
            market.market_type,
            market.index_name
          ]
        );
        console.log(`✅ Updated ${market.market_type} ${market.index_name}: ${market.value}`);
      } else {
        // Insert new record
        await client.query(
          `INSERT INTO market_data (market_type, index_name, value, change, percent_change, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            market.market_type,
            market.index_name,
            market.value,
            market.change,
            market.percent_change,
            market.timestamp
          ]
        );
        console.log(`✅ Saved ${market.market_type} ${market.index_name}: ${market.value}`);
      }
    }
  } finally {
    client.release();
  }
}

/**
 * Get latest market data from database
 */
export async function getLatestMarketData(marketType?: 'US' | 'India' | 'Currency'): Promise<MarketData[]> {
  const client = await pool.connect();
  
  try {
    // Get the most recent data for each index (within last 7 days)
    // Use DISTINCT ON to get only the latest record per index
    let query = `
      SELECT DISTINCT ON (market_type, index_name)
        market_type, index_name, value, change, percent_change, timestamp
      FROM market_data
      WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days'
    `;
    
    const params: any[] = [];
    if (marketType) {
      query += ' AND market_type = $1';
      params.push(marketType);
    }
    
    query += ' ORDER BY market_type, index_name, timestamp DESC';
    
    const result = await client.query(query, params);
    
    return result.rows.map(row => ({
      market_type: row.market_type,
      index_name: row.index_name,
      value: parseFloat(row.value),
      change: parseFloat(row.change),
      percent_change: parseFloat(row.percent_change),
      timestamp: row.timestamp,
    }));
  } finally {
    client.release();
  }
}

