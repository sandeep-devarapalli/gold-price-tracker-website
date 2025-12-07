import axios from 'axios';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

// Initialize Turndown service for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

export interface ScrapeResult {
  success: boolean;
  data?: {
    title: string;
    content: string;
    markdown: string;
    excerpt: string;
    byline: string;
    siteName: string;
  };
  error?: string;
}

/**
 * Scrape a URL using local Node.js libraries (axios + jsdom + readability)
 * This avoids external API limits and costs.
 */
export async function scrapeUrlLocal(url: string): Promise<ScrapeResult> {
  try {
    console.log(`🕷️ Local scraping: ${url}`);
    
    // Fetch HTML
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 10000 // 10 second timeout
    });

    const html = response.data;
    // Get final URL after redirects (axios follows redirects by default)
    const finalUrl = response.request?.res?.responseUrl || url;
    
    const dom = new JSDOM(html, { url: finalUrl });
    
    // Check if we should use Readability (good for articles) or raw conversion (good for lists/data)
    // For Google News/Finance, raw is often better to preserve links and data tables
    const isDataSite = finalUrl.includes('google.com/finance') || finalUrl.includes('news.google.com');
    
    let markdown = '';
    let title = dom.window.document.title;
    let content = '';
    let excerpt = '';
    let byline = '';
    let siteName = '';
    
    // ... (rest of logic) ...

    return {
      success: true,
      data: {
        title,
        content,
        markdown,
        excerpt,
        byline,
        siteName,
        url: finalUrl // Return the final URL
      }
    };

  } catch (error) {
    console.error(`❌ Local scrape failed for ${url}:`, error instanceof Error ? error.message : String(error));
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Search the web using Google Custom Search (mock/fallback since we don't have API key)
 * or scrape a search results page directly (Google/Bing).
 * Note: Scraping search engines is brittle. Better to use specific site scraping if possible.
 */
export async function searchWebLocal(query: string): Promise<any[]> {
  // Implementing a robust search scraper is complex and often blocked.
  // For now, we will rely on known sources URLs or use a simple Bing scrape if needed.
  // This is a placeholder for future enhancement.
  return [];
}

