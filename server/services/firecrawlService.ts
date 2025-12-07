import FirecrawlApp from '@mendable/firecrawl-js';
import dotenv from 'dotenv';
import { scrapeUrlLocal } from './localScraper';

dotenv.config();

// Initialize Firecrawl client
const apiKey = process.env.FIRECRAWL_API_KEY || 'fc-3d4733c917d94726a2b4c6a980ca393d';
const app = new FirecrawlApp({ apiKey });

export interface ScrapeOptions {
  onlyMainContent?: boolean;
  includeHtml?: boolean;
  formats?: Array<'markdown' | 'html' | 'rawHtml' | 'links' | 'screenshot'>;
}

/**
 * Scrape a URL using Firecrawl
 */
export async function scrapeUrl(
  url: string,
  options: ScrapeOptions = {}
): Promise<{
  success: boolean;
  markdown?: string;
  html?: string;
  metadata?: any;
  error?: string;
}> {
  try {
    console.log(`🕷️ Scraping URL with Firecrawl: ${url}`);
    
    // Build scrape options - use minimal required options
    const scrapeOptions: any = {};
    
    // Add formats if specified
    if (options.formats && options.formats.length > 0) {
      scrapeOptions.formats = options.formats;
    } else {
      scrapeOptions.formats = ['markdown'];
    }

    console.log('📤 Calling Firecrawl API with options:', JSON.stringify(scrapeOptions));
    console.log('📤 API Key configured:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET');
    
    const result = await app.scrape(url, scrapeOptions);
    
    console.log('📥 Firecrawl API response received:', {
      hasData: !!result.data,
      hasMarkdown: !!(result.data?.markdown || result.markdown),
      hasError: !!result.error,
      keys: Object.keys(result || {}).join(', ')
    });

    // Check for payment required / insufficient credits error
    if (result.error && (
      result.error.toLowerCase().includes('insufficient credits') || 
      result.error.toLowerCase().includes('rate limit') ||
      result.error.toLowerCase().includes('payment required')
    )) {
      throw new Error(result.error); // Throw to catch block for fallback
    }

    // Handle different response formats from Firecrawl SDK
    let scrapedData: any = null;
    
    // Check if result has a data property or is the data directly
    if (result.data) {
      scrapedData = result.data;
    } else if (result.markdown || result.content || result.html) {
      scrapedData = result;
    } else {
      // Check for error in response
      if (result.error || result.message) {
        console.error('❌ Firecrawl scraping failed:', result);
        return {
          success: false,
          error: result.error || result.message || 'Unknown error during scraping',
        };
      }
      // If we can't determine the format, log and return error
      console.error('❌ Unexpected Firecrawl response format:', JSON.stringify(result).substring(0, 500));
      return {
        success: false,
        error: 'Unexpected response format from Firecrawl',
      };
    }

    // Extract markdown/content from the response
    const markdown = scrapedData.markdown || scrapedData.content || '';
    
    if (!markdown || markdown.length === 0) {
      console.warn('⚠️ No markdown content found in Firecrawl response');
    }
    
    console.log('✅ Firecrawl scraping successful');
    
    // Log metadata for debugging
    if (scrapedData.metadata) {
      console.log('📋 Firecrawl metadata:', JSON.stringify(scrapedData.metadata).substring(0, 200));
    }
    
    return {
      success: true,
      markdown: markdown,
      html: scrapedData.html || '',
      metadata: scrapedData.metadata || {},
    };
  } catch (error) {
    console.error('❌ Error during Firecrawl scraping:', error);
    
    // Check if error is due to insufficient credits or payment required
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.toLowerCase().includes('insufficient credits') || 
        errorMessage.toLowerCase().includes('payment required') ||
        errorMessage.toLowerCase().includes('rate limit')) {
      
      console.log('⚠️ Firecrawl limit reached. Switching to local scraper fallback...');
      const localResult = await scrapeUrlLocal(url);
      
      if (localResult.success && localResult.data) {
        return {
          success: true,
          markdown: localResult.data.markdown,
          metadata: {
            title: localResult.data.title,
            description: localResult.data.excerpt,
            url: localResult.data.url, // Includes final URL after redirect
            sourceURL: localResult.data.url
          }
        };
      } else {
        return {
          success: false,
          error: localResult.error || 'Local scraper failed'
        };
      }
    }

    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
      errorType: error?.constructor?.name
    });
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Search the web using Firecrawl's Search API
 * Documentation: https://docs.firecrawl.dev/features/search
 */
export async function searchWeb(
  query: string,
  options: {
    limit?: number;
    sources?: Array<'web' | 'news' | 'images'>;
    tbs?: string; // Time-based search: qdr:d (past 24h), qdr:w (past week), etc.
    location?: string;
    scrapeOptions?: {
      formats?: Array<'markdown' | 'html' | 'links'>;
    };
  } = {}
): Promise<{
  success: boolean;
  data?: {
    web?: Array<{
      url: string;
      title: string;
      description?: string;
      snippet?: string;
      date?: string;
      position: number;
      markdown?: string;
      metadata?: any;
    }>;
    news?: Array<{
      url: string;
      title: string;
      snippet?: string;
      date?: string;
      position: number;
      markdown?: string;
      metadata?: any;
    }>;
  };
  error?: string;
}> {
  try {
    console.log(`🔍 Searching web with Firecrawl: "${query}"`);
    console.log(`📋 Search options:`, JSON.stringify(options));
    
    // Build search options - query is passed as first parameter
    const searchOptions: any = {
      limit: options.limit || 10,
    };
    
    // Add sources if specified
    if (options.sources && options.sources.length > 0) {
      searchOptions.sources = options.sources;
    }
    
    // Add time-based search filter (e.g., past 24 hours)
    if (options.tbs) {
      searchOptions.tbs = options.tbs;
    }
    
    // Add location if specified
    if (options.location) {
      searchOptions.location = options.location;
    }
    
    // Add scrape options if specified
    if (options.scrapeOptions) {
      searchOptions.scrapeOptions = options.scrapeOptions;
    }
    
    // Call search with query as first param, options as second
    const result = await app.search(query, searchOptions);
    
    console.log(`✅ Firecrawl search successful, result keys:`, Object.keys(result || {}));
    
    // Firecrawl search returns results directly or nested under .data
    // Handle both response formats
    let searchData = result;
    
    // If result has a data property, use that
    if (result.data) {
      searchData = result.data;
    }
    
    // Check for array of results (web search returns array directly)
    if (Array.isArray(searchData)) {
      return {
        success: true,
        data: { web: searchData },
      };
    }
    
    // Handle object with web/news properties
    if (searchData.web || searchData.news || searchData.results) {
      return {
        success: true,
        data: {
          web: searchData.web || searchData.results || [],
          news: searchData.news || [],
        },
      };
    }
    
    if (result.error) {
      console.error('❌ Firecrawl search error:', result.error);
      return {
        success: false,
        error: result.error,
      };
    }
    
    console.log('📋 Unexpected search result format:', JSON.stringify(result).substring(0, 500));
    return {
      success: false,
      error: 'Unexpected response format from Firecrawl search',
    };
  } catch (error) {
    console.error('❌ Error during Firecrawl search:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export default app;

