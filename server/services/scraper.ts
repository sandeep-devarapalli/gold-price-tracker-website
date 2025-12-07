import { scrapeUrl } from './firecrawlService';
import dotenv from 'dotenv';
import { insertPrice } from './priceService';
import axios from 'axios';
import { JSDOM } from 'jsdom';

dotenv.config();

export interface ScrapedPrice {
  price_10g: number;
  price_1g: number;
  timestamp: Date;
  country: string;
  source: string;
}

/**
 * Parse price from text, handling Indian number format (commas)
 */
function parsePrice(priceText: string): number | null {
  if (!priceText) return null;
  
  // Remove currency symbols, spaces, and extract numbers
  // Handle formats like "1,33,170.00", "₹1,33,170", etc.
  const cleaned = priceText
    .replace(/[₹,\s]/g, '') // Remove ₹, commas, spaces
    .replace(/[^\d.]/g, ''); // Keep only digits and decimal point
  
  const price = parseFloat(cleaned);
  return isNaN(price) ? null : price;
}

/**
 * Extract country name from scraped content
 */
function extractCountry(content: string): string {
  // We use country-level pricing, so always return "India"
  return 'India';
}

/**
 * Extract gold price from markdown/text content
 * Optimized for Livemint, MoneyControl, and Google Finance
 * 
 * PRIORITY ORDER:
 * 1. Per-gram price from article text (most accurate, multiply by 10)
 * 2. Header widget 10g price
 * 3. Standard 10g patterns
 * 4. Google Finance patterns
 */
function extractPriceFromContent(content: string): { price_10g: number | null; country: string } {
  let price_10g: number | null = null;
  let country = extractCountry(content);
  
  console.log(`📍 Detected country: ${country}`);
  console.log('🔍 Extracting price from scraped content (Livemint/MoneyControl/Google)...');
  
  // ============================================
  // PRIORITY 1: Per-gram price from article text
  // This is the most accurate as it's in the article body
  // ============================================
  const perGramPatterns = [
    // Livemint format: "24 Karat Gold (999 purity) : ₹13,014 per gram"
    /24\s*Karat\s*Gold\s*\(?999\s*purity\)?\s*:?\s*₹\s*(\d{1,2},\d{3}(?:\.\d{2})?)\s*per\s*gram/i,
    // Generic: "₹13,014 per gram" near "24 Karat" or "24k"
    /24\s*(?:Karat|k).*?₹\s*(\d{1,2},\d{3}(?:\.\d{2})?)\s*per\s*gram/i,
    // Reverse: "per gram" with price before it
    /₹\s*(\d{1,2},\d{3}(?:\.\d{2})?)\s*per\s*gram/i,
  ];
  
  for (const pattern of perGramPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      const perGramPrice = parsePrice(match[1]);
      if (perGramPrice && perGramPrice > 10000 && perGramPrice < 20000) {
        price_10g = perGramPrice * 10;
        console.log(`✅ Found per-gram price: ₹${perGramPrice}/g → ₹${price_10g}/10g`);
        return { price_10g, country };
      }
    }
  }
  
  // ============================================
  // PRIORITY 2: Header widget 10g price
  // ============================================
  const headerPatterns = [
    // Livemint header: "₹130140-630.00\n\n24 Carat Gold Rate (10 grams)"
    /₹\s*(\d{6})(?:[+\-]\d+(?:\.\d+)?)?\s*\n+\s*24\s*Carat\s*Gold\s*Rate\s*\(?\s*10\s*grams?\s*\)?/i,
    // Header with change indicator
    /₹\s*(\d{1,3}(?:,\d{2,3})*)\s*[+\-]?\d*\.?\d*\s*\n\s*24\s*Carat\s*Gold\s*Rate/i,
  ];
  
  for (const pattern of headerPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      let headerPrice = parsePrice(match[1]);
      // Fix malformed prices (e.g., "1307700" should be "130770")
      if (headerPrice && headerPrice > 500000 && headerPrice < 5000000) {
        headerPrice = Math.round(headerPrice / 10);
        console.log(`⚠️  Header price appears malformed, correcting: ₹${headerPrice}`);
      }
      if (headerPrice && headerPrice > 50000 && headerPrice < 500000) {
        price_10g = headerPrice;
        console.log(`✅ Found header widget price: ₹${price_10g}/10g`);
        return { price_10g, country };
      }
    }
  }
  
  // ============================================
  // PRIORITY 3: Standard 10g patterns
  // ============================================
  const standard10gPatterns = [
    /24\s*Carat\s*Gold\s*Rate\s*\(?\s*10\s*grams?\s*\)?\s*:?\s*₹?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)/i,
    /24\s*Carat.*?10\s*grams?.*?₹\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)/i,
    /10g.*?(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)\s*(?:Indian\s+Rupee|INR|₹|Rs)/i,
  ];
  
  for (const pattern of standard10gPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      const price = parsePrice(match[1]);
      if (price && price > 50000 && price < 500000) {
        price_10g = price;
        console.log(`✅ Found standard 10g price: ₹${price_10g}/10g`);
        return { price_10g, country };
      }
    }
  }
  
  // ============================================
  // PRIORITY 4: Google Finance patterns
  // ============================================
  const googlePatterns = [
    /(?:gold|24k|24\s*k|99\.9%).*?(?:price|rate|per\s+10g|10\s*g).*?(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)\s*(?:INR|₹|Rs|Indian\s+Rupee)/i,
    /(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)\s*(?:INR|₹|Rs|Indian\s+Rupee).*?(?:gold|24k|24\s*k|99\.9%).*?(?:price|rate|per\s+10g|10\s*g)/i,
  ];
  
  for (const pattern of googlePatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      let price = parsePrice(match[1]);
      // Check if it's per gram and convert
      if (price && price > 10000 && price < 20000) {
        price = price * 10;
        console.log(`ℹ️  Converting per-gram to 10g: ₹${price}`);
      }
      if (price && price > 50000 && price < 500000) {
        price_10g = price;
        console.log(`✅ Found Google Finance price: ₹${price_10g}/10g`);
        return { price_10g, country };
      }
    }
  }
  
  // ============================================
  // FALLBACK: Search for any reasonable price
  // ============================================
  if (!price_10g) {
    console.log('🔍 No price found with primary patterns, trying fallback...');
    
    // Search for lines containing "10g" and extract price from nearby text
    const lines = content.split(/\n|\.|\s+/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.includes('10g') || line.includes('10 g')) {
        const contextLines = [
          lines[i - 2] || '',
          lines[i - 1] || '',
          lines[i] || '',
          lines[i + 1] || '',
          lines[i + 2] || ''
        ].join(' ');
        
        const numberMatches = contextLines.match(/\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?/g);
        if (numberMatches) {
          for (const numStr of numberMatches) {
            const price = parsePrice(numStr);
            if (price && price > 50000 && price < 500000) {
              price_10g = price;
              console.log(`✅ [Fallback] Found price near "10g" context: ₹${price_10g}`);
              break;
            }
          }
        }
        if (price_10g) break;
      }
    }
  }
  
  // Last resort: Try finding any large number in INR context
  if (!price_10g) {
    console.log('🔍 Searching for large numbers in INR context...');
    const allNumbers = content.match(/\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?/g) || [];
    
    for (const numStr of allNumbers) {
      const price = parsePrice(numStr);
      if (price && price > 50000 && price < 500000) {
        const numIndex = content.indexOf(numStr);
        const context = content.substring(Math.max(0, numIndex - 100), numIndex + numStr.length + 100);
        const contextLower = context.toLowerCase();
        
        if (contextLower.includes('gold') || 
            contextLower.includes('24k') || 
            contextLower.includes('10g') ||
            contextLower.includes('₹') ||
            contextLower.includes('inr') ||
            contextLower.includes('rupee')) {
          price_10g = price;
          console.log(`✅ [Last Resort] Found potential price in context: ₹${price_10g}`);
          break;
        }
      }
    }
  }
  
  return { price_10g, country };
}

/**
 * Scrape gold price directly from Livemint using local HTML parsing
 * This bypasses Firecrawl API limits
 */
async function fetchGoldPriceFromLivemint(): Promise<{ price_10g: number | null; price_1g: number | null }> {
  try {
    const url = `https://www.livemint.com/gold-prices?_cb=${Date.now()}`;
    console.log(`🕷️ Local scraping Gold from Livemint: ${url}`);

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

    // Try multiple selectors for Livemint price widgets
    // Livemint typically shows prices in various formats
    const selectors = [
      // Header widget price (most common)
      '[data-price]',
      '.price',
      '.gold-price',
      '.price-widget',
      // Text-based patterns
      'span:contains("₹")',
      'div:contains("24 Karat")',
    ];
    
    // First, try to find price in data attributes or specific classes
    let priceElement = null;
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of Array.from(elements)) {
          const text = el.textContent || '';
          // Look for patterns like "₹130,140" or "1,30,140"
          const priceMatch = text.match(/₹?\s*(\d{1,3}(?:,\d{2,3}){0,2}(?:\.\d{2})?)/);
          if (priceMatch) {
            const priceText = priceMatch[1];
            const price = parsePrice(priceText);
            // Check if it's in the expected range for 10g or 1g
            if (price && price > 50000 && price < 500000) {
              priceElement = el;
              console.log(`✅ Found 10g price element: ₹${price}`);
              return {
                price_10g: price,
                price_1g: price / 10
              };
            } else if (price && price > 5000 && price < 15000) {
              priceElement = el;
              console.log(`✅ Found 1g price element: ₹${price}, converting to 10g`);
              return {
                price_10g: price * 10,
                price_1g: price
              };
            }
          }
        }
      } catch (e) {
        // Some selectors might fail (like :contains), continue
        continue;
      }
    }
    
    // If specific selectors didn't work, search all text content
    const bodyText = document.body.textContent || '';
    
    // Pattern 1: "24 Karat Gold (999 purity) : ₹13,014 per gram"
    const perGramMatch = bodyText.match(/24\s*Karat\s*Gold\s*\(?999\s*purity\)?\s*:?\s*₹\s*(\d{1,2},\d{3}(?:\.\d{2})?)\s*per\s*gram/i);
    if (perGramMatch) {
      const perGramPrice = parsePrice(perGramMatch[1]);
      if (perGramPrice && perGramPrice > 10000 && perGramPrice < 20000) {
        console.log(`✅ Found per-gram price in text: ₹${perGramPrice}/g`);
        return {
          price_10g: perGramPrice * 10,
          price_1g: perGramPrice
        };
      }
    }
    
    // Pattern 2: "₹130,140" or "1,30,140" near "24 Carat" or "10 grams"
    const tenGramMatch = bodyText.match(/24\s*Carat.*?₹\s*(\d{1,3}(?:,\d{2,3}){0,2}(?:\.\d{2})?).*?10\s*grams?/i) ||
                        bodyText.match(/₹\s*(\d{1,3}(?:,\d{2,3}){0,2}(?:\.\d{2})?).*?24\s*Carat.*?10\s*grams?/i) ||
                        bodyText.match(/10\s*grams?.*?₹\s*(\d{1,3}(?:,\d{2,3}){0,2}(?:\.\d{2})?)/i);
    if (tenGramMatch) {
      const tenGramPrice = parsePrice(tenGramMatch[1]);
      if (tenGramPrice && tenGramPrice > 50000 && tenGramPrice < 500000) {
        console.log(`✅ Found 10g price in text: ₹${tenGramPrice}/10g`);
        return {
          price_10g: tenGramPrice,
          price_1g: tenGramPrice / 10
        };
      }
    }
    
    // Pattern 3: Generic price extraction (last resort)
    const allPrices = bodyText.match(/₹\s*(\d{1,3}(?:,\d{2,3}){0,2}(?:\.\d{2})?)/g);
    if (allPrices) {
      for (const priceStr of allPrices) {
        const price = parsePrice(priceStr);
        if (price && price > 50000 && price < 500000) {
          console.log(`✅ Found potential 10g price in text: ₹${price}/10g`);
          return {
            price_10g: price,
            price_1g: price / 10
          };
        }
      }
    }
    
    console.log(`⚠️ No price element found on Livemint page`);
    return { price_10g: null, price_1g: null };
  } catch (error: any) {
    console.error('❌ Error scraping Livemint for gold:', error.message);
    return { price_10g: null, price_1g: null };
  }
}

/**
 * Scrape gold price directly from Google Finance using local HTML parsing
 * This bypasses Firecrawl API limits
 */
async function fetchGoldPriceFromGoogleFinance(): Promise<{ price_10g: number | null; price_1g: number | null }> {
  try {
    // Try multiple symbols for gold on MCX and other exchanges
    const urls = [
      'https://www.google.com/finance/quote/GOLD:MCX',
      'https://www.google.com/finance/quote/GOLD',
    ];
    
    for (const url of urls) {
      try {
        console.log(`🕷️ Local scraping Gold from Google Finance: ${url}`);

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

        // Try multiple selectors for price
        const selectors = [
          '.YMlKec.fxKbKc',  // Main price selector
          '[data-field="regularMarketPrice"]',
          '[jsname="vWLAgc"]',
          '.AHmHk .YMlKec',
        ];
        
        let priceElement = null;
        for (const selector of selectors) {
          priceElement = document.querySelector(selector);
          if (priceElement) break;
        }
        
        if (priceElement) {
          const priceText = priceElement.textContent || '';
          console.log(`📊 Found price element text: "${priceText}"`);
          
          // Remove currency symbols, commas, spaces and parse
          const cleaned = priceText.replace(/[₹$,\s]/g, '').replace(/[^\d.]/g, '');
          const price = parseFloat(cleaned);
          
          console.log(`🔢 Parsed price: ${price}`);
          
          if (!isNaN(price) && price > 0) {
            // MCX Gold futures are typically per 10g in INR
            // Google Finance might show price per gram or per 10g
            // If price seems to be per 10g (> 50000), use as is
            // If price seems to be per 1g (> 5000 and < 15000), multiply by 10
            if (price > 50000 && price < 500000) {
              console.log(`✅ Found 10g price: ₹${price}`);
              return {
                price_10g: price,
                price_1g: price / 10
              };
            } else if (price > 5000 && price < 15000) {
              console.log(`✅ Found 1g price, converting to 10g: ₹${price * 10}`);
              return {
                price_10g: price * 10,
                price_1g: price
              };
            } else {
              console.log(`⚠️ Price ${price} doesn't match expected range, trying next URL...`);
            }
          }
        } else {
          console.log(`⚠️ No price element found with any selector on ${url}`);
        }
      } catch (urlError: any) {
        console.log(`⚠️ Error with ${url}: ${urlError.message}, trying next...`);
        continue;
      }
    }
    
    console.log('⚠️ Could not extract gold price from any Google Finance URL');
    return { price_10g: null, price_1g: null };
  } catch (error: any) {
    console.error('❌ Error scraping Google Finance for gold:', error.message);
    return { price_10g: null, price_1g: null };
  }
}

/**
 * Scrape gold price from Google Finance using Firecrawl
 * Specifically targets Google Finance results for more accurate gold price data
 */
export async function scrapeGoldPrice(timestamp?: Date): Promise<ScrapedPrice | null> {
  try {
    console.log('🕷️ Starting gold price scraping (Livemint / MoneyControl / Google Search)...');
    
    // Use Livemint as primary source for accurate gold prices in India
    // Primary: Livemint (most accurate)
    // Fallback 1: MoneyControl MCX Gold futures
    // Fallback 2: Google search
    
    // Add cache-busting parameter to bypass CDN caching
    const cacheBuster = `_cb=${Date.now()}`;
    const livemintUrl = `https://www.livemint.com/gold-prices?${cacheBuster}`;
    const moneyControlUrl = `https://www.moneycontrol.com/commodity/mcx-gold-price?${cacheBuster}`;
    const googleSearchUrl = process.env.GOOGLE_SEARCH_URL || 
      'https://www.google.com/search?q=gold+price+india&oq=gold+&gs_lcrp=EgZjaHJvbWUqDggAEEUYJxg7GIAEGIoFMg4IABBFGCcYOxiABBiKBTIOCAEQRRgnGDsYgAQYigUyBggCEEUYOzIGCAMQRRg8MgYIBBBFGDwyBggFEEUYPDIGCAYQRRg8MgYIBxBFGDzSAQg5MzQxajBqNKgCALACAA&sourceid=chrome&ie=UTF-8';
    
    // Try Livemint first (most accurate source)
    console.log(`📍 Trying Livemint first (most accurate): ${livemintUrl}`);
    console.log(`🔄 Cache-busting enabled: ${cacheBuster}`);
    
    let result = await scrapeUrl(livemintUrl, {
      onlyMainContent: false,
      includeHtml: false,
      formats: ['markdown'],
    });
    
    let price_10g: number | null = null;
    let country = 'India';
    let markdown = '';
    
    // If Firecrawl fails, try direct Livemint scraping
    if (!result.success || !result.markdown) {
      console.log('⚠️  Firecrawl failed for Livemint, trying direct HTML scraping...');
      const livemintDirectResult = await fetchGoldPriceFromLivemint();
      
      if (livemintDirectResult.price_10g && livemintDirectResult.price_1g) {
        console.log(`✅ Successfully scraped gold price from Livemint (direct): ₹${livemintDirectResult.price_10g} (10g), ₹${livemintDirectResult.price_1g} (1g)`);
        
        return {
          price_10g: livemintDirectResult.price_10g,
          price_1g: livemintDirectResult.price_1g,
          timestamp: timestamp || new Date(),
          country: 'India',
          source: 'Livemint Direct'
        };
      }
      
      console.log('⚠️  Direct Livemint scraping also failed, trying MoneyControl MCX...');
      console.log(`📍 Scraping from MoneyControl: ${moneyControlUrl}`);
      
      result = await scrapeUrl(moneyControlUrl, {
        onlyMainContent: false,
        includeHtml: false,
        formats: ['markdown'],
      });
    }
    
    // If MoneyControl also fails, try Google search
    if (!result.success || !result.markdown) {
      console.log('⚠️  MoneyControl scraping failed, trying Google search fallback...');
      console.log(`📍 Scraping from Google search: ${googleSearchUrl}`);
      
      result = await scrapeUrl(googleSearchUrl, {
        onlyMainContent: false,
        includeHtml: false,
        formats: ['markdown'],
      });
    }
    
    // If all previous sources failed, try Google Finance directly
    if (!result.success || !result.markdown) {
      console.log('⚠️  All web scraping failed, trying Google Finance direct scraping...');
      const googleFinanceResult = await fetchGoldPriceFromGoogleFinance();
      
      if (googleFinanceResult.price_10g && googleFinanceResult.price_1g) {
        console.log(`✅ Successfully scraped gold price from Google Finance: ₹${googleFinanceResult.price_10g} (10g), ₹${googleFinanceResult.price_1g} (1g)`);
        
        return {
          price_10g: googleFinanceResult.price_10g,
          price_1g: googleFinanceResult.price_1g,
          timestamp: timestamp || new Date(),
          country: 'India',
          source: 'Google Finance MCX'
        };
      }
      
      console.error('❌ Failed to scrape gold price from all sources:', result.error);
      throw new Error(result.error || 'Failed to scrape gold price from all sources');
    }
    
    markdown = result.markdown;
    console.log('📄 Scraped content preview (first 1000 chars):');
    console.log(markdown.substring(0, 1000));
    
    // Check if Google blocked us with CAPTCHA
    const contentLower = markdown.toLowerCase();
    if (contentLower.includes('unusual traffic') || 
        contentLower.includes('captcha') ||
        contentLower.includes('verify you\'re not a robot') ||
        contentLower.includes('our systems have detected')) {
      console.warn('⚠️ Google has detected automated traffic and is showing CAPTCHA');
      throw new Error('Google blocked request - CAPTCHA detected');
    }
    
    // Extract price and country from content
    const extracted = extractPriceFromContent(markdown);
    price_10g = extracted.price_10g;
    country = extracted.country;
    
    // Validate price exists
    if (!price_10g || price_10g <= 0) {
      console.error('❌ No valid price extracted from scraped content');
      throw new Error('No valid price extracted from scraped content');
    }
    
    // Calculate 1g price
    const price_1g = price_10g / 10;
    
    const scrapedResult: ScrapedPrice = {
      price_10g,
      price_1g,
      timestamp: timestamp || new Date(),
      country: 'India', // Always use country-level pricing
      source: 'firecrawl_livemint'
    };
    
    console.log('✅ Gold price scraping successful:', scrapedResult);
    return scrapedResult;
    
  } catch (error) {
    console.error('❌ Scraping from Google Finance failed:', error);
    throw error;
  }
}

/**
 * Scrape historical gold prices for the last N days
 * Note: This will use the current price as a baseline since Google Finance doesn't provide
 * easy access to historical data via scraping. For true historical data, use a dedicated API.
 */
export async function scrapeHistoricalGoldPrices(days: number = 30): Promise<ScrapedPrice[]> {
  console.log(`📅 Scraping historical gold prices for the last ${days} days...`);
  console.log('⚠️  Note: Historical scraping uses current price. For accurate historical data, use a dedicated API.');
  
  const prices: ScrapedPrice[] = [];
  const currentPrice = await scrapeGoldPrice();
  
  if (!currentPrice) {
    console.error('❌ Failed to get current price for historical scraping');
    return [];
  }
  
  // Since we can't easily get historical data from Google Finance via scraping,
  // we'll just return the current price with a note that historical data
  // would require a different approach or API
  console.log('ℹ️  Google Finance scraping provides current prices only.');
  console.log('💡 To get true 30-day historical data, consider using a dedicated gold price API.');
  
  prices.push(currentPrice);
  
  return prices;
}

/**
 * Test scraping function (for manual testing)
 */
export async function testScrape(): Promise<void> {
  try {
    const result = await scrapeGoldPrice();
    console.log('Test scraping result:', result);
  } catch (error) {
    console.error('Test scraping failed:', error);
    throw error;
  }
}
