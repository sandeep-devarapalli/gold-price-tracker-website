import pool from '../db/connection';
import axios from 'axios';
import { JSDOM } from 'jsdom';

export interface GoldETFData {
  etf_name: string;
  symbol: string;
  exchange: 'NSE' | 'BSE';
  nav_price: number;
  change: number;
  percent_change: number;
  aum_crore?: number;
  expense_ratio?: number;
  timestamp: Date;
}

// Major Indian Gold ETFs
const GOLD_ETFS = [
  {
    name: 'Nippon India Gold BeES',
    symbol: 'GOLDBEES',
    yahooSymbol: 'GOLDBEES.NS',
    exchange: 'NSE' as const,
    aum_crore: 32605, // Approximate AUM
    expense_ratio: 0.80
  },
  {
    name: 'SBI Gold ETF',
    symbol: 'SETFGOLD',
    yahooSymbol: 'SETFGOLD.NS',
    exchange: 'NSE' as const,
    aum_crore: 6155.35,
    expense_ratio: 0.70
  },
  {
    name: 'Kotak Gold ETF',
    symbol: 'GOLD1',
    yahooSymbol: 'GOLD1.NS',
    exchange: 'NSE' as const,
    aum_crore: 4610.11,
    expense_ratio: 0.55
  },
  {
    name: 'ICICI Prudential Gold ETF',
    symbol: 'GOLDIETF',
    yahooSymbol: 'GOLDIETF.NS',
    exchange: 'NSE' as const,
    aum_crore: 4444.30,
    expense_ratio: 0.50
  },
  {
    name: 'HDFC Gold ETF',
    symbol: 'HDFCMFGETF',
    yahooSymbol: 'HDFCMFGETF.NS',
    exchange: 'NSE' as const,
    aum_crore: 2000, // Approximate
    expense_ratio: 0.60
  },
  {
    name: 'Axis Gold ETF',
    symbol: 'AXISGOLD',
    yahooSymbol: 'AXISGOLD.NS',
    exchange: 'NSE' as const,
    aum_crore: 1500, // Approximate
    expense_ratio: 0.65
  }
];

/**
 * Parse number from string, handling Indian number format
 */
function parseNumber(text: string | null | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[₹,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Fetch Gold ETF price from Yahoo Finance API
 */
async function fetchETFFromYahooFinance(etf: typeof GOLD_ETFS[0]): Promise<GoldETFData | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${etf.yahooSymbol}?interval=1d&range=1d`;
    console.log(`🕷️ Fetching ${etf.name} (${etf.symbol}) from Yahoo Finance...`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 10000
    });
    
    if (response.data && response.data.chart && response.data.chart.result && response.data.chart.result.length > 0) {
      const result = response.data.chart.result[0];
      if (result.meta && result.meta.regularMarketPrice) {
        const price = result.meta.regularMarketPrice;
        const previousClose = result.meta.previousClose || price;
        const change = price - previousClose;
        const percentChange = previousClose ? ((change / previousClose) * 100) : 0;
        
        console.log(`✅ Found ${etf.name}: ₹${price} (Change: ${change.toFixed(2)}, ${percentChange.toFixed(2)}%)`);
        
        return {
          etf_name: etf.name,
          symbol: etf.symbol,
          exchange: etf.exchange,
          nav_price: price,
          change: change,
          percent_change: percentChange,
          aum_crore: etf.aum_crore,
          expense_ratio: etf.expense_ratio,
          timestamp: new Date()
        };
      }
    }
  } catch (error) {
    console.warn(`⚠️ Yahoo Finance failed for ${etf.symbol}:`, error instanceof Error ? error.message : String(error));
  }
  return null;
}

/**
 * Fetch Gold ETF from Google Finance
 */
async function fetchETFFromGoogleFinance(etf: typeof GOLD_ETFS[0]): Promise<GoldETFData | null> {
  try {
    const symbol = `${etf.symbol}:NSE`;
    const url = `https://www.google.com/finance/quote/${symbol}`;
    console.log(`🕷️ Fetching ${etf.name} from Google Finance...`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 10000
    });
    
    const dom = new JSDOM(response.data);
    const document = dom.window.document;
    
    // Look for price element
    const priceElement = document.querySelector('[data-last-price]') ||
                        document.querySelector('.YMlKec.fxKbKc') ||
                        document.querySelector('[jsname="vWLAgc"]');
    
    if (priceElement) {
      const priceText = priceElement.textContent || priceElement.getAttribute('data-last-price') || '';
      const price = parseNumber(priceText);
      
      if (price && price > 50 && price < 200) { // Gold ETFs typically trade in ₹50-200 range
        // Try to find change
        const changeElement = document.querySelector('[data-change]') ||
                             document.querySelector('.JwB6zf') ||
                             document.querySelector('[jsname="qZk3k"]');
        
        let change = 0;
        let percentChange = 0;
        
        if (changeElement) {
          const changeText = changeElement.textContent || changeElement.getAttribute('data-change') || '';
          change = parseNumber(changeText) || 0;
          
          // Try to find percent change
          const percentElement = document.querySelector('[data-percent-change]') ||
                                document.querySelector('.JwB6zf + span');
          if (percentElement) {
            const percentText = percentElement.textContent || '';
            const percentMatch = percentText.match(/([+-]?\d+\.?\d*)%/);
            if (percentMatch) {
              percentChange = parseFloat(percentMatch[1]);
            }
          }
        }
        
        console.log(`✅ Found ${etf.name} from Google Finance: ₹${price}`);
        return {
          etf_name: etf.name,
          symbol: etf.symbol,
          exchange: etf.exchange,
          nav_price: price,
          change: change,
          percent_change: percentChange,
          aum_crore: etf.aum_crore,
          expense_ratio: etf.expense_ratio,
          timestamp: new Date()
        };
      }
    }
  } catch (error) {
    console.warn(`⚠️ Google Finance failed for ${etf.symbol}:`, error instanceof Error ? error.message : String(error));
  }
  return null;
}

/**
 * Scrape all Gold ETFs
 */
export async function scrapeGoldETFs(): Promise<GoldETFData[]> {
  console.log('📊 Scraping Gold ETFs from India...');
  const results: GoldETFData[] = [];
  
  for (const etf of GOLD_ETFS) {
    // Try Yahoo Finance first (more reliable)
    let data = await fetchETFFromYahooFinance(etf);
    
    // Fallback to Google Finance
    if (!data) {
      data = await fetchETFFromGoogleFinance(etf);
    }
    
    if (data) {
      results.push(data);
    } else {
      console.warn(`⚠️ Could not fetch data for ${etf.name} (${etf.symbol})`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`✅ Scraped ${results.length} out of ${GOLD_ETFS.length} Gold ETFs`);
  return results;
}

/**
 * Save Gold ETF data to database
 * Calculates change and percent_change from previous day's value
 */
export async function saveGoldETFs(etfs: GoldETFData[]): Promise<void> {
  const client = await pool.connect();
  
  try {
    for (const etf of etfs) {
      // Get previous day's NAV to calculate change
      const previousDayQuery = await client.query(
        `SELECT nav_price FROM gold_etfs 
         WHERE symbol = $1 
         AND DATE(timestamp) < DATE($2)
         ORDER BY timestamp DESC
         LIMIT 1`,
        [etf.symbol, etf.timestamp]
      );
      
      let calculatedChange = 0;
      let calculatedPercentChange = 0;
      
      if (previousDayQuery.rows.length > 0) {
        const previousNAV = parseFloat(previousDayQuery.rows[0].nav_price);
        calculatedChange = etf.nav_price - previousNAV;
        calculatedPercentChange = previousNAV !== 0 ? (calculatedChange / previousNAV) * 100 : 0;
        console.log(`📊 Calculated change for ${etf.symbol}: ${calculatedChange.toFixed(2)} (${calculatedPercentChange.toFixed(2)}%) from previous NAV ${previousNAV}`);
      } else {
        // No previous data, use scraper values or 0
        calculatedChange = etf.change || 0;
        calculatedPercentChange = etf.percent_change || 0;
        console.log(`ℹ️  No previous data for ${etf.symbol}, using scraper values or 0`);
      }
      
      // Check if data already exists for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const existingCheck = await client.query(
        `SELECT id FROM gold_etfs 
         WHERE symbol = $1 AND DATE(timestamp) = DATE($2)`,
        [etf.symbol, today]
      );
      
      if (existingCheck.rows.length > 0) {
        // Update existing record with calculated changes
        await client.query(
          `UPDATE gold_etfs 
           SET nav_price = $1, change = $2, percent_change = $3, 
               aum_crore = $4, expense_ratio = $5, timestamp = $6
           WHERE symbol = $7 AND DATE(timestamp) = DATE($6)`,
          [
            etf.nav_price,
            calculatedChange,
            calculatedPercentChange,
            etf.aum_crore,
            etf.expense_ratio,
            etf.timestamp,
            etf.symbol
          ]
        );
        console.log(`✅ Updated ${etf.etf_name}: ₹${etf.nav_price} (Change: ${calculatedChange.toFixed(2)}, ${calculatedPercentChange.toFixed(2)}%)`);
      } else {
        // Insert new record with calculated changes
        await client.query(
          `INSERT INTO gold_etfs (etf_name, symbol, exchange, nav_price, change, percent_change, aum_crore, expense_ratio, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            etf.etf_name,
            etf.symbol,
            etf.exchange,
            etf.nav_price,
            calculatedChange,
            calculatedPercentChange,
            etf.aum_crore,
            etf.expense_ratio,
            etf.timestamp
          ]
        );
        console.log(`✅ Saved ${etf.etf_name}: ₹${etf.nav_price} (Change: ${calculatedChange.toFixed(2)}, ${calculatedPercentChange.toFixed(2)}%)`);
      }
    }
  } finally {
    client.release();
  }
}

/**
 * Get latest Gold ETF data from database
 * Recalculates change and percent_change from previous day's value to ensure accuracy
 */
export async function getLatestGoldETFs(): Promise<GoldETFData[]> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT DISTINCT ON (symbol) 
       etf_name, symbol, exchange, nav_price, change, percent_change, 
       aum_crore, expense_ratio, timestamp
       FROM gold_etfs
       ORDER BY symbol, timestamp DESC`
    );
    
    // Recalculate changes from previous day for each ETF
    const etfsWithCalculatedChanges = await Promise.all(
      result.rows.map(async (row) => {
        // Get previous day's NAV
        const previousDayQuery = await client.query(
          `SELECT nav_price FROM gold_etfs 
           WHERE symbol = $1 
           AND DATE(timestamp) < DATE($2)
           ORDER BY timestamp DESC
           LIMIT 1`,
          [row.symbol, row.timestamp]
        );
        
        let calculatedChange = parseFloat(row.change);
        let calculatedPercentChange = parseFloat(row.percent_change);
        const currentNAV = parseFloat(row.nav_price);
        
        if (previousDayQuery.rows.length > 0) {
          const previousNAV = parseFloat(previousDayQuery.rows[0].nav_price);
          calculatedChange = currentNAV - previousNAV;
          calculatedPercentChange = previousNAV !== 0 ? (calculatedChange / previousNAV) * 100 : 0;
        }
        
        return {
          etf_name: row.etf_name,
          symbol: row.symbol,
          exchange: row.exchange,
          nav_price: currentNAV,
          change: calculatedChange,
          percent_change: calculatedPercentChange,
          aum_crore: row.aum_crore ? parseFloat(row.aum_crore) : undefined,
          expense_ratio: row.expense_ratio ? parseFloat(row.expense_ratio) : undefined,
          timestamp: row.timestamp
        };
      })
    );
    
    return etfsWithCalculatedChanges;
  } finally {
    client.release();
  }
}

