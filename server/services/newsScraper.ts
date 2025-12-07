import { scrapeUrl } from './firecrawlService';
import pool from '../db/connection';

export interface NewsArticle {
  title: string;
  content: string;
  source: string;
  url: string;
  published_at: Date | null;
  sentiment: 'positive' | 'negative' | 'neutral';
  impact: 'high' | 'medium' | 'low';
}

/**
 * Sentiment analysis based on keywords
 * Focuses on market trends and demand indicators (NOT price movements)
 */
function analyzeSentiment(content: string, title: string): 'positive' | 'negative' | 'neutral' {
  const text = (title + ' ' + content).toLowerCase();
  
  // Positive indicators for gold demand
  const positiveKeywords = [
    'increase', 'growing', 'rising', 'strong', 'boost', 'surge', 'gain',
    'high demand', 'increased demand', 'spike', 'peak', 'record',
    'festival', 'wedding', 'marriage', 'investment', 'buying',
    'positive', 'good', 'growth', 'expanding', 'flourishing',
    'monsoon', 'harvest', 'rural', 'prosperity'
  ];
  
  // Negative indicators for gold demand
  const negativeKeywords = [
    'decline', 'falling', 'decreasing', 'weak', 'drop', 'low demand',
    'decreased', 'slump', 'downturn', 'recession', 'crisis',
    'concern', 'worry', 'risk', 'negative', 'problem', 'trouble',
    'drought', 'poor', 'failure', 'unstable'
  ];
  
  let positiveScore = 0;
  let negativeScore = 0;
  
  positiveKeywords.forEach(keyword => {
    if (text.includes(keyword)) positiveScore++;
  });
  
  negativeKeywords.forEach(keyword => {
    if (text.includes(keyword)) negativeScore++;
  });
  
  // Festivals are generally positive for gold demand
  const festivalKeywords = ['diwali', 'dussehra', 'akshaya tritiya', 'dhanteras', 'festival'];
  if (festivalKeywords.some(keyword => text.includes(keyword))) {
    positiveScore += 2;
  }
  
  if (positiveScore > negativeScore + 2) return 'positive';
  if (negativeScore > positiveScore + 2) return 'negative';
  return 'neutral';
}

/**
 * Determine impact level based on keywords and content length
 * Focuses on market trends, festivals, and social factors
 */
function analyzeImpact(content: string, title: string): 'high' | 'medium' | 'low' {
  const text = (title + ' ' + content).toLowerCase();
  
  // High impact: Festivals, major policy changes, economic factors
  const highImpactKeywords = [
    'diwali', 'dussehra', 'akshaya tritiya', 'dhanteras', 'pushya nakshatra',
    'central bank', 'rbi', 'reserve bank', 'policy change', 'rate cut', 'rate hike',
    'inflation', 'recession', 'crisis', 'war', 'conflict', 'sanctions',
    'import duty', 'custom duty', 'gst', 'tax', 'regulation',
    'major', 'significant', 'substantial', 'festival season', 'wedding season'
  ];
  
  // Medium impact: Market trends, demand patterns, economic indicators
  const mediumImpactKeywords = [
    'festival', 'demand', 'supply', 'buying trend', 'purchase trend',
    'economy', 'market', 'rural', 'urban', 'consumption',
    'trade', 'export', 'import', 'currency', 'dollar', 'rupee',
    'jewellery', 'investment', 'reserves', 'mining', 'production',
    'wedding', 'marriage', 'season', 'monsoon'
  ];
  
  // Low impact: General news, minor updates
  const lowImpactKeywords = [
    'news', 'update', 'report', 'announcement'
  ];
  
  let highImpactCount = 0;
  let mediumImpactCount = 0;
  
  highImpactKeywords.forEach(keyword => {
    if (text.includes(keyword)) highImpactCount++;
  });
  
  mediumImpactKeywords.forEach(keyword => {
    if (text.includes(keyword)) mediumImpactCount++;
  });
  
  // Festival detection - always high impact for gold demand
  const festivalKeywords = ['diwali', 'dussehra', 'akshaya tritiya', 'dhanteras', 'festival'];
  const hasFestival = festivalKeywords.some(keyword => text.includes(keyword));
  
  if (hasFestival || highImpactCount >= 2) return 'high';
  if (highImpactCount >= 1 || mediumImpactCount >= 3) return 'medium';
  return 'low';
}

/**
 * Extract date from URL (e.g., 2025-10-15 from Reuters URLs)
 */
function extractDateFromUrl(url: string): Date | null {
  try {
    // Pattern 1: YYYY-MM-DD in URL (common in Reuters, Bloomberg, etc.)
    const dateMatch = url.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      const year = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]) - 1; // Month is 0-indexed
      const day = parseInt(dateMatch[3]);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    
    // Pattern 2: /YYYY/MM/DD/ format
    const dateMatch2 = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
    if (dateMatch2) {
      const year = parseInt(dateMatch2[1]);
      const month = parseInt(dateMatch2[2]) - 1;
      const day = parseInt(dateMatch2[3]);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    
    // Pattern 3: /MM/DD/YYYY/ format
    const dateMatch3 = url.match(/\/(\d{2})\/(\d{2})\/(\d{4})\//);
    if (dateMatch3) {
      const month = parseInt(dateMatch3[1]) - 1;
      const day = parseInt(dateMatch3[2]);
      const year = parseInt(dateMatch3[3]);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  } catch (e) {
    // Invalid date, return null
  }
  return null;
}

/**
 * Extract date from various formats in content
 */
function extractDateFromContent(content: string, title: string): Date | null {
  const text = (title + ' ' + content).toLowerCase();
  
  // Pattern: "October 15, 2025" or "Oct 15, 2025"
  const datePatterns = [
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),\s+(\d{4})/i,
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2}),\s+(\d{4})/i,
    /(\d{4})-(\d{2})-(\d{2})/, // ISO format
    /(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY
    /(\d{2})\/(\d{2})\/(\d{2})/, // MM/DD/YY
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        let date: Date;
        if (match[0].includes(',')) {
          // Full month name format
          date = new Date(match[0]);
        } else if (match[0].includes('-')) {
          // ISO format YYYY-MM-DD
          date = new Date(match[0]);
        } else if (match[0].includes('/')) {
          // MM/DD/YYYY format
          const parts = match[0].split('/');
          if (parts[2].length === 4) {
            date = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
          } else {
            // YY format - assume 20YY
            date = new Date(2000 + parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
          }
        } else {
          continue;
        }
        
        if (!isNaN(date.getTime())) {
          return date;
        }
      } catch (e) {
        // Invalid date, continue
      }
    }
  }
  
  return null;
}

/**
 * Extract news articles from Google News scraped content
 * Google News aggregates news from multiple sources
 */
function extractNewsFromContent(markdown: string, baseUrl: string): NewsArticle[] {
  const articles: NewsArticle[] = [];
  
  // Split into lines and process
  const lines = markdown.split('\n').filter(line => line.trim().length > 0);
  
  // Google News typically has this structure:
  // - Article titles (often as links or headings)
  // - Source names (e.g., "Reuters", "Economic Times", etc.)
  // - Timestamps (e.g., "2 hours ago")
  // - URLs or links
  
  // Pattern to find article blocks
  // Look for patterns like:
  // - Headings (## Title)
  // - Links ([Title](url))
  // - Source mentions
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Skip very short lines
    if (line.length < 15) {
      i++;
      continue;
    }
    
    // Look for article title patterns
    // Pattern 1: Markdown headings
    let title = '';
    let url = baseUrl;
    let source = '';
    let publishedAt: Date | null = null;
    let content = '';
    
    // Check if line contains a title (heading or link)
    if (line.startsWith('##') || line.startsWith('#')) {
      title = line.replace(/^#+\s*/, '').trim();
    } else if (line.includes('[') && line.includes('](') && line.includes(')')) {
      // Markdown link format: [Title](URL)
      const linkMatch = line.match(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/);
      if (linkMatch) {
        title = linkMatch[1].trim();
        url = linkMatch[2].trim();
      }
    } else if (line.length > 30 && line.length < 200 && !line.match(/^\d+\s*(hours?|days?|ago)/i)) {
      // Could be a standalone title
      title = line.trim();
    }
    
    // If we found a potential title, look for source and metadata in surrounding lines
    if (title && title.length > 15 && title.length < 300) {
      // Extract source from title line or nearby lines
      // Common sources for gold news in India
      const knownSources = [
        'Reuters', 'Bloomberg', 'Economic Times', 'Livemint', 'MoneyControl',
        'Business Standard', 'Financial Express', 'The Hindu', 'Times of India',
        'Hindustan Times', 'NDTV', 'India Today', 'CNBC', 'CNBC TV18',
        'Mint', 'BusinessLine', 'Zee Business'
      ];
      
      // Check current and next few lines for source
      for (let j = Math.max(0, i - 1); j < Math.min(i + 5, lines.length); j++) {
        const checkLine = lines[j].toLowerCase();
        
        // Check for known sources
        for (const knownSource of knownSources) {
          if (checkLine.includes(knownSource.toLowerCase())) {
            source = knownSource;
            break;
          }
        }
        
        // Extract time
        const timeMatch = checkLine.match(/(\d+)\s*(hours?|days?|weeks?|minutes?)\s*ago/i);
        if (timeMatch && !publishedAt) {
          const value = parseInt(timeMatch[1]);
          const unit = timeMatch[2].toLowerCase();
          publishedAt = new Date();
          if (unit.includes('minute')) {
            publishedAt.setMinutes(publishedAt.getMinutes() - value);
          } else if (unit.includes('hour')) {
            publishedAt.setHours(publishedAt.getHours() - value);
          } else if (unit.includes('day')) {
            publishedAt.setDate(publishedAt.getDate() - value);
          } else if (unit.includes('week')) {
            publishedAt.setDate(publishedAt.getDate() - (value * 7));
          }
        }
        
        // Extract URL if not already found
        if (url === baseUrl) {
          const urlMatch = checkLine.match(/(https?:\/\/[^\s\)]+)/);
          if (urlMatch) {
            url = urlMatch[1];
          }
        }
        
        // Collect content/description
        if (checkLine.length > 50 && 
            !checkLine.match(/hours?|days?|ago|minutes?|•|·|source|by\s+\w+/) &&
            j !== i) {
          content += lines[j].trim() + ' ';
        }
      }
      
      // Clean title
      title = title
        .replace(/^(Link|Read|More|View):\s*/i, '')
        .replace(/\[.*?\]\(.*?\)/g, '')
        .trim();
      
      // Extract date from URL first (most reliable - e.g., 2025-10-15 in Reuters URLs)
      if (!publishedAt && url !== baseUrl) {
        const urlDate = extractDateFromUrl(url);
        if (urlDate) {
          publishedAt = urlDate;
          console.log(`📅 Extracted date from URL ${url}: ${urlDate.toISOString().split('T')[0]}`);
        }
      }
      
      // Extract date from content/title if still not found
      if (!publishedAt) {
        const contentDate = extractDateFromContent(content || title, title);
        if (contentDate) {
          publishedAt = contentDate;
          console.log(`📅 Extracted date from content: ${contentDate.toISOString().split('T')[0]}`);
        }
      }
      
      // If still no date found, extract from the full markdown content around this article
      // (Google News might have dates in nearby lines)
      if (!publishedAt && i < lines.length - 10) {
        const nearbyContent = lines.slice(Math.max(0, i - 5), Math.min(i + 10, lines.length)).join(' ');
        const nearbyDate = extractDateFromContent(nearbyContent, title);
        if (nearbyDate) {
          publishedAt = nearbyDate;
        }
      }
      
      // Set default source if not found
      if (!source || source === '') {
        // Try to extract from URL
        if (url !== baseUrl) {
          try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.replace(/^www\./, '');
            // Extract domain name as source
            const domainParts = hostname.split('.');
            if (domainParts.length >= 2) {
              source = domainParts[domainParts.length - 2]
                .split('-')
                .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' ');
            }
          } catch (e) {
            source = 'News Source';
          }
        } else {
          source = 'News Source';
        }
      }
      
      // Only add if title is meaningful and NOT a price update
      const titleLower = title.toLowerCase();
      
      // Aggressively filter out price update articles
      const isPriceUpdate = 
        /^(gold|silver)\s+(price|rate)\s+today/i.test(title) ||
        /check\s+(gold|silver)\s+(price|rate)/i.test(title) ||
        /gold\s+(price|rate)\s+in\s+(major\s+)?cities/i.test(title) ||
        /(price|rate)\s+today/i.test(title) ||
        /check\s+\d+\s+carat/i.test(title) ||
        /gold\s+price\s+(in|today|update|check)/i.test(title);
      
      // Check if it's about trends/festivals instead
      const isTrendRelated = 
        /(festival|diwali|dussehra|akshaya|dhanteras|wedding|marriage|demand|trend|market|import|export|rbi|policy|rural|urban|season)/i.test(title);
      
      if (title.length > 20 && title.length < 400 && 
          !titleLower.includes('there are no items') &&
          !titleLower.includes('page isn\'t working') &&
          (!isPriceUpdate || isTrendRelated)) {
        
        const sentiment = analyzeSentiment(content || title, title);
        const impact = analyzeImpact(content || title, title);
        
        articles.push({
          title: title,
          content: content.trim().substring(0, 1000) || title,
          source: source,
          url: url,
          published_at: publishedAt,
          sentiment,
          impact,
        });
      }
      
      // Skip ahead
      i += 2;
    } else {
      i++;
    }
  }
  
  // Remove duplicates
  const uniqueArticles: NewsArticle[] = [];
  const seenTitles = new Set<string>();
  
  for (const article of articles) {
    const titleKey = article.title.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (!seenTitles.has(titleKey) && titleKey.length > 10) {
      seenTitles.add(titleKey);
      uniqueArticles.push(article);
    }
  }
  
  return uniqueArticles.slice(0, 20); // Limit to top 20 articles
}

/**
 * Calculate similarity between two strings (simple Jaccard similarity)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(str2.split(/\s+/).filter(w => w.length > 3));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Scrape gold-related news from a source URL
 * (Legacy function - kept for backward compatibility)
 */
export async function scrapeGoldNews(url: string, source: string): Promise<NewsArticle[]> {
  try {
    console.log(`📰 Scraping news from ${source}: ${url}`);
    
    const result = await scrapeUrl(url, {
      onlyMainContent: true,
      includeHtml: false,
      formats: ['markdown'],
    });
    
    if (!result.success || !result.markdown) {
      console.error(`❌ Failed to scrape news from ${source}:`, result.error);
      return [];
    }
    
    const articles = extractNewsFromContent(result.markdown, url);
    console.log(`✅ Extracted ${articles.length} articles from ${source}`);
    
    return articles;
  } catch (error) {
    console.error(`❌ Error scraping news from ${source}:`, error);
    return [];
  }
}

/**
 * Scrape gold-related news from multiple sources (not just Google News)
 * Focuses on market trends, festivals, and social factors (NOT price updates)
 * Mix: 70% India-specific + 30% Global news
 * Uses multi-source search and OpenAI enrichment for accurate dates
 */
export async function scrapeAllGoldNews(): Promise<NewsArticle[]> {
  // Directly use the local RSS scraper as the primary method
  return scrapeAllGoldNewsLocal();
}

/**
 * Scrape from Google News RSS (Primary Local Method)
 * More reliable than HTML scraping and doesn't require API credits
 */
async function scrapeAllGoldNewsLocal(): Promise<NewsArticle[]> {
  console.log('📰 Scraping news using Google News RSS (Local)...');
  
  const queries = [
    'gold price India',
    'gold market trends',
    'gold rates',
    'RBI gold reserves'
  ];
  
  // Dynamically import xml2js and axios to avoid top-level dependency issues
  const { parseStringPromise } = await import('xml2js');
  const { default: axios } = await import('axios');
  
  const allArticles: NewsArticle[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries) {
    try {
      // Use Google News RSS feed for India (en-IN)
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query + ' when:1d')}&hl=en-IN&gl=IN&ceid=IN:en`;
      console.log(`🕷️ Fetching RSS: ${rssUrl}`);
      
      const response = await axios.get(rssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const result = await parseStringPromise(response.data);
      
      if (result?.rss?.channel?.[0]?.item) {
        const items = result.rss.channel[0].item;
        
        for (const item of items) {
          const url = item.link?.[0];
          const title = item.title?.[0];
          const pubDateStr = item.pubDate?.[0];
          const source = item.source?.[0]?._ || 'Google News';
          
          if (url && title && !seenUrls.has(url)) {
            seenUrls.add(url);
            
            // Clean title (remove source suffix if present)
            const cleanTitle = title.replace(/\s+-\s+[^-]+$/, '');
            
            // Basic filtering using our existing logic
            // We construct a temporary article object to check relevance
            const tempArticle: NewsArticle = {
              title: cleanTitle,
              content: cleanTitle, // Use title as content for initial check
              source,
              url,
              published_at: null,
              sentiment: 'neutral',
              impact: 'medium'
            };
            
            // Filter out irrelevant articles
            if (filterRelevantTrendArticles([tempArticle]).length === 0) {
              continue;
            }

            // Parse date
            let publishedAt = new Date();
            if (pubDateStr) {
              const parsedDate = new Date(pubDateStr);
              if (!isNaN(parsedDate.getTime())) {
                publishedAt = parsedDate;
              }
            }
            
            // Analyze sentiment/impact
            const sentiment = analyzeSentiment(cleanTitle, cleanTitle);
            const impact = analyzeImpact(cleanTitle, cleanTitle);

            allArticles.push({
              title: cleanTitle,
              url: url,
              source: source,
              published_at: publishedAt,
              sentiment,
              impact,
              content: cleanTitle // Initial content is just title, will be enriched later
            });
          }
        }
      }
    } catch (error) {
      console.error(`❌ RSS scrape failed for query "${query}":`, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Deduplicate based on title similarity
  const uniqueArticles: NewsArticle[] = [];
  const seenTitles = new Set<string>();
  
  for (const article of allArticles) {
    const titleKey = article.title.toLowerCase().substring(0, 50); // First 50 chars as key
    if (!seenTitles.has(titleKey)) {
      seenTitles.add(titleKey);
      uniqueArticles.push(article);
    }
  }

  console.log(`✅ RSS Fallback found ${uniqueArticles.length} unique articles`);
  
  // Balance global/India news if possible (RSS is mostly India due to 'gl=IN')
  return uniqueArticles.slice(0, 20);
}

/**
 * Balance articles to ensure at least 30% global news
 */
function balanceIndiaGlobalNews(articles: NewsArticle[]): NewsArticle[] {
  if (articles.length === 0) return articles;
  
  // Classify articles as India or Global
  const indiaArticles: NewsArticle[] = [];
  const globalArticles: NewsArticle[] = [];
  
  for (const article of articles) {
    const titleLower = article.title.toLowerCase();
    const sourceLower = article.source.toLowerCase();
    
    // Check if it's India-specific
    const isIndia = 
      titleLower.includes('india') ||
      sourceLower.includes('times of india') ||
      sourceLower.includes('hindustan times') ||
      sourceLower.includes('livemint') ||
      sourceLower.includes('economic times') ||
      sourceLower.includes('business standard') ||
      sourceLower.includes('moneycontrol') ||
      sourceLower.includes('financial express') ||
      titleLower.includes('diwali') ||
      titleLower.includes('dhanteras') ||
      titleLower.includes('rbi') ||
      titleLower.includes('indian');
    
    // Check if it's global
    const isGlobal = 
      titleLower.includes('global') ||
      titleLower.includes('international') ||
      titleLower.includes('world') ||
      titleLower.includes('federal reserve') ||
      titleLower.includes('central bank') ||
      titleLower.includes('china') ||
      titleLower.includes('usa') ||
      titleLower.includes('united states') ||
      titleLower.includes('europe') ||
      titleLower.includes('london') ||
      sourceLower.includes('reuters') ||
      sourceLower.includes('bloomberg') ||
      sourceLower.includes('cnbc') ||
      sourceLower.includes('financial times') ||
      sourceLower.includes('wall street');
    
    if (isGlobal) {
      globalArticles.push(article);
    } else if (isIndia) {
      indiaArticles.push(article);
    } else {
      // Neutral - classify based on source
      if (sourceLower.includes('reuters') || sourceLower.includes('bloomberg') || 
          sourceLower.includes('cnbc') || sourceLower.includes('ft')) {
        globalArticles.push(article);
      } else {
        indiaArticles.push(article);
      }
    }
  }
  
  // Calculate target distribution (at least 30% global)
  const targetGlobalPercent = 0.30; // Minimum 30% global
  const totalNeeded = Math.min(articles.length, 30); // Limit to 30 articles max
  const targetGlobalCount = Math.ceil(totalNeeded * targetGlobalPercent); // At least 30%
  const targetIndiaCount = totalNeeded - targetGlobalCount;
  
  // Prioritize global articles to meet minimum 30% requirement
  // Take all available global articles first, then fill with India
  const selectedGlobal = globalArticles.slice(0, Math.max(targetGlobalCount, Math.min(globalArticles.length, totalNeeded)));
  const remainingSlots = totalNeeded - selectedGlobal.length;
  const selectedIndia = indiaArticles.slice(0, Math.min(remainingSlots, indiaArticles.length));
  
  // If we don't have enough global articles, log a warning
  if (selectedGlobal.length < targetGlobalCount) {
    console.warn(`⚠️  Only found ${selectedGlobal.length} global articles (target: ${targetGlobalCount}). Consider improving search query.`);
  }
  
  // Combine and shuffle for better mix
  const combined = [...selectedGlobal, ...selectedIndia];
  
  // Shuffle to mix India and global articles
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  
  const globalInFinal = combined.filter(a => globalArticles.includes(a)).length;
  const globalPercent = combined.length > 0 ? (globalInFinal / combined.length) * 100 : 0;
  
  console.log(`🌍 Balanced news mix: ${globalInFinal} global (${globalPercent.toFixed(1)}%), ${combined.length - globalInFinal} India (${(100 - globalPercent).toFixed(1)}%)`);
  
  return combined.slice(0, 30); // Return up to 30 articles
}

/**
 * Filter articles to only include today's news (published today)
 */
function filterTodaysNews(articles: NewsArticle[]): NewsArticle[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const todaysArticles = articles.filter(article => {
    if (!article.published_at) {
      // If no published date, include it (likely recent)
      return true;
    }
    
    const publishedDate = new Date(article.published_at);
    publishedDate.setHours(0, 0, 0, 0);
    
    // Include if published today
    return publishedDate.getTime() >= today.getTime() && publishedDate.getTime() < tomorrow.getTime();
  });
  
  console.log(`📅 Filtered to today's news: ${todaysArticles.length} articles from ${articles.length} total`);
  
  return todaysArticles;
}

/**
 * Filter articles to focus on trends, festivals, and market factors
 * Exclude articles that are primarily about price updates
 */
function filterRelevantTrendArticles(articles: NewsArticle[]): NewsArticle[] {
  const filtered: NewsArticle[] = [];
  
  // Keywords that indicate relevant trend articles
  const trendKeywords = [
    'festival', 'diwali', 'dussehra', 'akshaya tritiya', 'dhanteras', 'pushya nakshatra',
    'demand', 'buying', 'purchase', 'wedding', 'marriage', 'season',
    'trend', 'market', 'economy', 'growth', 'rural', 'urban',
    'import', 'export', 'supply', 'consumption', 'jewellery', 'investment',
    'rbi', 'policy', 'government', 'regulation', 'duty', 'tax',
    'inflation', 'currency', 'rupee', 'dollar', 'global', 'international',
    'mining', 'production', 'reserves', 'central bank', 'social', 'cultural'
  ];
  
  // Keywords/phrases that indicate price-only articles or generic/irrelevant pages (to exclude)
  const priceOnlyPatterns = [
    /price\s+today/i,
    /rate\s+today/i,
    /gold\s+price\s+today/i,
    /gold\s+rate\s+today/i,
    /current\s+price/i,
    /latest\s+price/i,
    /price\s+update/i,
    /rate\s+update/i,
    /price\s+check/i,
    /check\s+gold\s+price/i,
    /check\s+gold\s+rate/i,
    /gold\s+prices?\s+in\s+(major\s+)?cities/i,
    /gold\s+rates?\s+in\s+(major\s+)?cities/i,
    /₹\s*\d+/i,  // Currency symbols with numbers in title
    /rupees?\s+per\s+(gram|10g|10\s+g)/i,
    /per\s+gram/i,
    /per\s+10g/i,
    // Generic/Irrelevant titles
    /^oops,?\s+something\s+went\s+wrong/i,
    /^page\s+not\s+found/i,
    /^access\s+denied/i,
    /^home\s+page/i,
    /stock\s+price/i,
    /quote\s+&\s+history/i,
    /historical\s+data/i,
    /charts?\s+&\s+quotes?/i,
    /login/i,
    /sign\s+up/i,
    /subscribe/i,
    /newsletter/i
  ];

  // Strong exclusion patterns - if title matches these, exclude immediately
  const strongExclusionPatterns = [
    /^(gold|silver)\s+(price|rate)\s+today/i,
    /check\s+(gold|silver)\s+(price|rate)/i,
    /gold\s+(price|rate)\s+in\s+major\s+cities/i,
    /^oops/i,
    /something\s+went\s+wrong/i,
    /stock\s+price,\s+news,\s+quote/i,
    /gold\s+spot\s+\/\s+u\.s\.\s+dollar/i // TradingView generic titles
  ];
  
  for (const article of articles) {
    const title = article.title.toLowerCase();
    const fullText = (article.title + ' ' + article.content).toLowerCase();
    
    // Strong exclusion: if title matches exclusion patterns, skip
    const matchesStrongExclusion = strongExclusionPatterns.some(pattern => pattern.test(title));
    if (matchesStrongExclusion) {
      continue; // Skip this article
    }
    
    // Check if article is primarily about price updates
    const priceOnlyMatches = priceOnlyPatterns.filter(pattern => 
      pattern.test(title) || pattern.test(fullText)
    ).length;
    
    const trendCount = trendKeywords.filter(keyword => fullText.includes(keyword)).length;
    
    // Exclusion criteria:
    // 1. Title has "price today" or "rate today" - ALWAYS exclude (unless has festival context)
    // 2. Multiple price patterns in title - exclude
    // 3. Has price patterns but no trend keywords - exclude
    
    const titleHasPriceUpdate = /(price|rate)\s+today/i.test(title) || 
                                /check\s+(gold|silver)\s+(price|rate)/i.test(title) ||
                                /gold\s+(price|rate)\s+in\s+(major\s+)?cities/i.test(title);
    const hasStrongPriceFocus = priceOnlyMatches >= 2;
    const hasTrendContent = trendCount >= 2;
    
    // Special case: Festival articles are always included (high demand indicator)
    const hasFestivalKeyword = /(festival|diwali|dussehra|akshaya|dhanteras|wedding|marriage|season)/i.test(fullText);
    
    // Strong exclusion: If title is about "price today" or "rate today", exclude UNLESS it has festival context
    // Also check if it mentions demand/trends in addition to price
    const hasDemandTrendContext = /(demand|buying|trend|festival|wedding|season|rural|urban)/i.test(fullText);
    
    if (titleHasPriceUpdate && !hasFestivalKeyword && !hasDemandTrendContext) {
      continue; // Skip pure price update articles
    }
    
    // Include if:
    // 1. Has festival keywords (always relevant for demand prediction), OR
    // 2. Has trend content AND is not price-focused
    if (hasFestivalKeyword || (!hasStrongPriceFocus && (hasTrendContent || article.impact === 'high'))) {
      filtered.push(article);
    }
  }
  
  return filtered;
}

/**
 * Enrich article with OpenAI-extracted metadata
 * This extracts better content and published dates from the article URL
 */
export async function enrichArticleWithOpenAI(article: NewsArticle): Promise<NewsArticle> {
  try {
    // Import dynamically to avoid circular dependencies
    const { extractArticleMetadata } = await import('./articleExtractor');
    
    if (!article.url || article.url.includes('news.google.com')) {
      // Skip Google News redirect URLs - they don't point to actual articles
      return article;
    }
    
    console.log(`🤖 Enriching article with OpenAI: ${article.title.substring(0, 50)}...`);
    const metadata = await extractArticleMetadata(article.url);
    
    if (metadata) {
      // Update article with extracted metadata
      return {
        ...article,
        title: metadata.title || article.title,
        content: metadata.content || article.content,
        published_at: metadata.published_at || article.published_at,
      };
    }
  } catch (error) {
    console.error(`⚠️ Failed to enrich article with OpenAI:`, error);
    // Return original article if enrichment fails
  }
  
  return article;
}

/**
 * Save news articles to database
 * Automatically enriches articles with OpenAI if they don't have published dates
 */
export async function saveNewsArticles(articles: NewsArticle[]): Promise<void> {
  const client = await pool.connect();
  
  try {
    // Separate articles that need enrichment (missing dates or Google News URLs)
    const articlesNeedingEnrichment = articles.filter(a => 
      !a.published_at || 
      (a.url && a.url.includes('news.google.com'))
    );
    
    // Enrich articles that need it
    if (articlesNeedingEnrichment.length > 0) {
      console.log(`🤖 Enriching ${articlesNeedingEnrichment.length} articles with OpenAI to extract dates...`);
      
      // First, resolve Google News redirect URLs to actual article URLs
      const { resolveMultipleGoogleNewsUrls } = await import('./googleNewsResolver');
      const { extractMultipleArticleMetadata } = await import('./articleExtractor');
      
      const googleNewsUrls = articlesNeedingEnrichment
        .map(a => a.url)
        .filter(url => url && url.includes('news.google.com'));
      
      const regularUrls = articlesNeedingEnrichment
        .map(a => a.url)
        .filter(url => url && !url.includes('news.google.com'));
      
      // Resolve Google News redirect URLs
      let resolvedUrls = new Map<string, string>();
      if (googleNewsUrls.length > 0) {
        console.log(`🔗 Resolving ${googleNewsUrls.length} Google News redirect URLs...`);
        resolvedUrls = await resolveMultipleGoogleNewsUrls(googleNewsUrls, 3);
      }
      
      // Combine resolved URLs with regular URLs
      const allUrlsToEnrich: string[] = [
        ...regularUrls,
        ...Array.from(resolvedUrls.values()).filter(url => url && !url.includes('news.google.com'))
      ];
      
      if (allUrlsToEnrich.length > 0) {
        console.log(`📄 Enriching ${allUrlsToEnrich.length} articles with OpenAI...`);
        const metadataMap = await extractMultipleArticleMetadata(allUrlsToEnrich, 3);
        
        // Update articles with enriched metadata
        for (const article of articlesNeedingEnrichment) {
          let urlToLookup = article.url;
          
          // If it's a Google News URL, try to get the resolved URL
          if (article.url && article.url.includes('news.google.com')) {
            const resolved = resolvedUrls.get(article.url);
            if (resolved) {
              urlToLookup = resolved;
              article.url = resolved; // Update to actual URL
            } else {
              continue; // Skip if we couldn't resolve
            }
          }
          
          if (urlToLookup) {
            const metadata = metadataMap.get(urlToLookup);
            if (metadata) {
              article.title = metadata.title || article.title;
              article.content = metadata.content || article.content;
              article.published_at = metadata.published_at || article.published_at;
              console.log(`✅ Enriched article: ${article.title.substring(0, 50)}... (date: ${article.published_at?.toISOString().split('T')[0] || 'none'})`);
            }
          }
        }
      }
    }
    
    // Save all articles
    for (const article of articles) {
      // Check if article already exists (by URL)
      const existingCheck = await client.query(
        'SELECT id FROM gold_news WHERE url = $1',
        [article.url]
      );
      
      if (existingCheck.rows.length > 0) {
        // Update existing article if we have better data (with date)
        if (article.published_at) {
          await client.query(
            `UPDATE gold_news 
             SET title = $1, content = $2, source = $3, published_at = $4, sentiment = $5, impact = $6
             WHERE url = $7`,
            [
              article.title,
              article.content,
              article.source,
              article.published_at,
              article.sentiment,
              article.impact,
              article.url
            ]
          );
          console.log(`🔄 Updated article: ${article.title.substring(0, 50)}...`);
        } else {
          console.log(`⏭️ Article already exists: ${article.title.substring(0, 50)}...`);
        }
        continue;
      }
      
      await client.query(
        `INSERT INTO gold_news (title, content, source, url, published_at, sentiment, impact)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          article.title,
          article.content,
          article.source,
          article.url,
          article.published_at,
          article.sentiment,
          article.impact
        ]
      );
      
      console.log(`✅ Saved article: ${article.title.substring(0, 50)}... (date: ${article.published_at?.toISOString().split('T')[0] || 'none'})`);
    }
  } finally {
    client.release();
  }
}

/**
 * Get latest news articles from database
 */
export async function getLatestNews(limit: number = 10): Promise<NewsArticle[]> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT title, content, source, url, published_at, sentiment, impact, created_at
       FROM gold_news
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    
    return result.rows.map(row => {
      // If published_at is null, try to extract date from URL or content
      let publishedAt: Date | null = row.published_at;
      if (!publishedAt) {
        // Try extracting from URL first
        if (row.url) {
          const urlDate = extractDateFromUrl(row.url);
          if (urlDate) {
            publishedAt = urlDate;
          }
        }
        // Try extracting from content/title if URL didn't work
        if (!publishedAt && row.content && row.title) {
          const contentDate = extractDateFromContent(row.content, row.title);
          if (contentDate) {
            publishedAt = contentDate;
          }
        }
      }
      
      return {
        title: row.title,
        content: row.content,
        source: row.source,
        url: row.url,
        published_at: publishedAt,
        sentiment: row.sentiment,
        impact: row.impact,
      };
    });
  } finally {
    client.release();
  }
}

/**
 * Get today's news articles only (published today)
 * Used for daily prediction generation
 */
export async function getTodaysNews(limit: number = 20): Promise<NewsArticle[]> {
  const client = await pool.connect();
  
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const result = await client.query(
      `SELECT title, content, source, url, published_at, sentiment, impact
       FROM gold_news
       WHERE (published_at >= $1 AND published_at < $2) 
          OR (published_at IS NULL AND created_at >= $1 AND created_at < $2)
       ORDER BY published_at DESC NULLS LAST, created_at DESC
       LIMIT $3`,
      [today, tomorrow, limit]
    );
    
    console.log(`📅 Fetched ${result.rows.length} today's news articles for prediction`);
    
    return result.rows.map(row => ({
      title: row.title,
      content: row.content,
      source: row.source,
      url: row.url,
      published_at: row.published_at,
      sentiment: row.sentiment,
      impact: row.impact,
    }));
  } finally {
    client.release();
  }
}

