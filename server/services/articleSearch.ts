import { scrapeUrl } from './firecrawlService';
import { extractArticleMetadata, ArticleMetadata } from './articleExtractor';

export interface ArticleSearchOptions {
  query: string;
  date?: string; // ISO date format (YYYY-MM-DD) or date range
  sources?: string[]; // Specific news sources to search
  limit?: number; // Maximum number of articles to return
  sortBy?: 'relevance' | 'date'; // Sort order
}

export interface SearchResult {
  url: string;
  title: string;
  source: string;
  snippet?: string;
  published_at?: Date;
  relevance_score?: number;
}

/**
 * Search for articles across multiple sources using various search strategies
 */
export async function searchArticles(options: ArticleSearchOptions): Promise<SearchResult[]> {
  const {
    query,
    date,
    sources = [],
    limit = 20,
    sortBy = 'relevance'
  } = options;

  console.log(`🔍 Searching for articles: "${query}"${date ? ` (date: ${date})` : ''}`);

  const results: SearchResult[] = [];

  // Strategy 1: Google Search (general web search)
  try {
    const googleResults = await searchGoogleArticles(query, date, limit);
    results.push(...googleResults);
  } catch (error) {
    console.error('Error searching Google:', error);
  }

  // Strategy 2: Google News (if no specific sources requested)
  if (sources.length === 0) {
    try {
      const newsResults = await searchGoogleNewsArticles(query, date, limit);
      results.push(...newsResults);
    } catch (error) {
      console.error('Error searching Google News:', error);
    }
  }

  // Strategy 3: Specific news sources (if requested)
  for (const source of sources) {
    try {
      const sourceResults = await searchSourceArticles(source, query, date, Math.floor(limit / sources.length));
      results.push(...sourceResults);
    } catch (error) {
      console.error(`Error searching ${source}:`, error);
    }
  }

  // Remove duplicates based on URL
  const uniqueResults = deduplicateResults(results);

  // Sort results
  if (sortBy === 'date') {
    uniqueResults.sort((a, b) => {
      const dateA = a.published_at?.getTime() || 0;
      const dateB = b.published_at?.getTime() || 0;
      return dateB - dateA; // Newest first
    });
  }

  // Limit results
  return uniqueResults.slice(0, limit);
}

/**
 * Search Google for articles
 */
async function searchGoogleArticles(
  query: string,
  date?: string,
  limit: number = 20
): Promise<SearchResult[]> {
  try {
    // Build Google search URL
    let searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    
    // Add date filter if specified
    if (date) {
      // Google date filter: tbs=cdr:1,cd_min:MM/DD/YYYY,cd_max:MM/DD/YYYY
      const dateObj = new Date(date);
      const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
      searchUrl += `&tbs=cdr:1,cd_min:${dateStr},cd_max:${dateStr}`;
    }
    
    searchUrl += '&num=20'; // Number of results
    
    console.log(`🌐 Searching Google: ${searchUrl}`);
    
    const result = await scrapeUrl(searchUrl, {
      onlyMainContent: true,
      includeHtml: false,
      formats: ['markdown'],
    });
    
    if (!result.success || !result.markdown) {
      return [];
    }
    
    return parseGoogleSearchResults(result.markdown, query);
  } catch (error) {
    console.error('Error searching Google:', error);
    return [];
  }
}

/**
 * Search Google News for articles
 */
async function searchGoogleNewsArticles(
  query: string,
  date?: string,
  limit: number = 20
): Promise<SearchResult[]> {
  try {
    // Build Google News search URL
    let searchUrl = `https://news.google.com/search?q=${encodeURIComponent(query)}&hl=en&gl=US&ceid=US:en`;
    
    // Add date filter if specified
    if (date) {
      const dateObj = new Date(date);
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - dateObj.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 1) {
        searchUrl += '&when=1d'; // Last 24 hours
      } else if (diffDays <= 7) {
        searchUrl += '&when=7d'; // Last week
      } else {
        // For older dates, we'll need to filter results
        searchUrl += '&when=1m'; // Last month (then filter)
      }
    }
    
    console.log(`📰 Searching Google News: ${searchUrl}`);
    
    const result = await scrapeUrl(searchUrl, {
      onlyMainContent: true,
      includeHtml: false,
      formats: ['markdown'],
    });
    
    if (!result.success || !result.markdown) {
      return [];
    }
    
    const results = parseGoogleNewsResults(result.markdown);
    
    // Filter by date if specified
    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      
      return results.filter(result => {
        if (!result.published_at) return true; // Include if no date
        const articleDate = new Date(result.published_at);
        articleDate.setHours(0, 0, 0, 0);
        return articleDate.getTime() === targetDate.getTime();
      });
    }
    
    return results;
  } catch (error) {
    console.error('Error searching Google News:', error);
    return [];
  }
}

/**
 * Search specific news source
 */
async function searchSourceArticles(
  source: string,
  query: string,
  date?: string,
  limit: number = 10
): Promise<SearchResult[]> {
  try {
    // Map common source names to their search URLs
    const sourceUrls: Record<string, string> = {
      'reuters': `https://www.reuters.com/search/news?blob=${encodeURIComponent(query)}`,
      'bloomberg': `https://www.bloomberg.com/search?query=${encodeURIComponent(query)}`,
      'economic-times': `https://economictimes.indiatimes.com/topic/${encodeURIComponent(query)}`,
      'livemint': `https://www.livemint.com/search?q=${encodeURIComponent(query)}`,
      'moneycontrol': `https://www.moneycontrol.com/news/tags/${encodeURIComponent(query)}.html`,
    };
    
    const searchUrl = sourceUrls[source.toLowerCase()];
    if (!searchUrl) {
      console.warn(`Unknown source: ${source}`);
      return [];
    }
    
    console.log(`📰 Searching ${source}: ${searchUrl}`);
    
    const result = await scrapeUrl(searchUrl, {
      onlyMainContent: true,
      includeHtml: false,
      formats: ['markdown'],
    });
    
    if (!result.success || !result.markdown) {
      return [];
    }
    
    return parseSourceResults(result.markdown, source);
  } catch (error) {
    console.error(`Error searching ${source}:`, error);
    return [];
  }
}

/**
 * Parse Google search results from markdown
 */
function parseGoogleSearchResults(markdown: string, query: string): SearchResult[] {
  const results: SearchResult[] = [];
  const lines = markdown.split('\n').filter(line => line.trim().length > 0);
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Look for result patterns in Google search results
    if (line.length > 20 && line.length < 300) {
      // Check if it's a heading (often the title)
      if (line.startsWith('##') || line.startsWith('#')) {
        const title = line.replace(/^#+\s*/, '').trim();
        
        // Look for URL in next few lines
        let url = '';
        let snippet = '';
        
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const nextLine = lines[j].trim();
          
          // Extract URL
          const urlMatch = nextLine.match(/(https?:\/\/[^\s\)]+)/);
          if (urlMatch && !url) {
            url = urlMatch[1];
          }
          
          // Extract snippet
          if (nextLine.length > 50 && nextLine.length < 300 && !urlMatch) {
            snippet = nextLine;
          }
        }
        
        if (url && title) {
          // Extract source from URL
          const source = extractSourceFromUrl(url);
          
          // Extract date from URL if available
          const publishedAt = extractDateFromUrl(url);
          
          results.push({
            url,
            title,
            source,
            snippet,
            published_at: publishedAt || undefined,
          });
        }
      }
    }
    
    i++;
  }
  
  return results;
}

/**
 * Parse Google News results from markdown
 */
function parseGoogleNewsResults(markdown: string): SearchResult[] {
  const results: SearchResult[] = [];
  const lines = markdown.split('\n').filter(line => line.trim().length > 0);
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Look for article title patterns
    if (line.length > 20 && line.length < 300 && !line.match(/^\d+\s*(hours?|days?|ago)/i)) {
      let title = '';
      let url = '';
      let source = '';
      
      // Check for markdown links
      const linkMatch = line.match(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/);
      if (linkMatch) {
        title = linkMatch[1].trim();
        url = linkMatch[2].trim();
      } else if (line.startsWith('##') || line.startsWith('#')) {
        title = line.replace(/^#+\s*/, '').trim();
      } else if (line.length > 30) {
        title = line.trim();
      }
      
      // Look for source and URL in surrounding lines
      if (title) {
        for (let j = Math.max(0, i - 1); j < Math.min(i + 5, lines.length); j++) {
          const checkLine = lines[j].toLowerCase();
          
          // Extract URL
          if (!url) {
            const urlMatch = lines[j].match(/(https?:\/\/[^\s\)]+)/);
            if (urlMatch) {
              url = urlMatch[1];
            }
          }
          
          // Extract source
          const knownSources = ['reuters', 'bloomberg', 'economic times', 'livemint', 'moneycontrol'];
          for (const knownSource of knownSources) {
            if (checkLine.includes(knownSource) && !source) {
              source = knownSource;
              break;
            }
          }
        }
        
        if (url || title) {
          if (!url) {
            // Try to extract from title if it's a link
            const titleUrlMatch = title.match(/(https?:\/\/[^\s\)]+)/);
            if (titleUrlMatch) {
              url = titleUrlMatch[1];
            }
          }
          
          if (!source && url) {
            source = extractSourceFromUrl(url);
          }
          
          const publishedAt = url ? extractDateFromUrl(url) : null;
          
          results.push({
            url: url || '',
            title: title.substring(0, 500), // Limit title length
            source: source || 'Unknown',
            published_at: publishedAt || undefined,
          });
        }
      }
    }
    
    i++;
  }
  
  return results;
}

/**
 * Parse results from specific news sources
 */
function parseSourceResults(markdown: string, source: string): SearchResult[] {
  // Similar parsing logic, adapted for specific source formats
  // This can be customized per source
  return parseGoogleNewsResults(markdown).map(result => ({
    ...result,
    source: result.source || source,
  }));
}

/**
 * Extract source name from URL
 */
function extractSourceFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, '');
    const domainParts = hostname.split('.');
    
    if (domainParts.length >= 2) {
      const sourceName = domainParts[domainParts.length - 2];
      return sourceName
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    }
    
    return 'Unknown';
  } catch (e) {
    return 'Unknown';
  }
}

/**
 * Extract date from URL
 */
function extractDateFromUrl(url: string): Date | null {
  try {
    // Pattern 1: YYYY-MM-DD in URL
    const dateMatch = url.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      const year = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]) - 1;
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
  } catch (e) {
    // Invalid URL or date
  }
  
  return null;
}

/**
 * Remove duplicate results based on URL
 */
function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const unique: SearchResult[] = [];
  
  for (const result of results) {
    if (result.url && !seen.has(result.url)) {
      seen.add(result.url);
      unique.push(result);
    }
  }
  
  return unique;
}

/**
 * Search for important articles on a specific date
 * Uses OpenAI to determine importance/relevance
 */
export async function searchImportantArticlesForDate(
  query: string,
  date: string,
  limit: number = 10
): Promise<SearchResult[]> {
  console.log(`🔍 Searching for important articles on ${date}: "${query}"`);
  
  // First, search for articles on that date
  const allResults = await searchArticles({
    query,
    date,
    limit: limit * 2, // Get more results to filter from
    sortBy: 'date',
  });
  
  // Use OpenAI to rank/score importance (if we have many results)
  if (allResults.length > limit) {
    // Could use OpenAI to score relevance here
    // For now, return the first N results
    return allResults.slice(0, limit);
  }
  
  return allResults;
}
