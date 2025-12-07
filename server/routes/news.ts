import express, { Request, Response } from 'express';
import { getLatestNews } from '../services/newsScraper';
import { scrapeAllGoldNews, saveNewsArticles } from '../services/newsScraper';
import pool from '../db/connection';
import { extractArticleMetadata, extractMultipleArticleMetadata } from '../services/articleExtractor';
import { searchArticles, searchImportantArticlesForDate, ArticleSearchOptions } from '../services/articleSearch';
import { extractMultipleArticleMetadata as enrichArticles } from '../services/articleExtractor';

const router = express.Router();

/**
 * GET /api/news/latest
 * Get latest gold-related news articles
 */
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const news = await getLatestNews(limit);
    
    res.json({
      success: true,
      data: news,
      count: news.length
    });
  } catch (error) {
    console.error('Error fetching latest news:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch latest news',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/news/today
 * Get news articles from today
 */
router.get('/today', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    // For now, return latest news - can filter by date later
    const news = await getLatestNews(limit);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayNews = news.filter(article => {
      if (!article.published_at) return true; // Include if no date
      const articleDate = new Date(article.published_at);
      articleDate.setHours(0, 0, 0, 0);
      return articleDate.getTime() === today.getTime();
    });
    
    res.json({
      success: true,
      data: todayNews,
      count: todayNews.length
    });
  } catch (error) {
    console.error('Error fetching today\'s news:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch today\'s news',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/news/all
 * Delete all news articles from the database
 */
router.delete('/all', async (req: Request, res: Response) => {
  try {
    console.log('🗑️  Deleting all news articles from database...');
    const client = await pool.connect();
    
    try {
      const result = await client.query('DELETE FROM gold_news');
      const deletedCount = result.rowCount || 0;
      
      console.log(`✅ Deleted ${deletedCount} news articles from database`);
      
      res.json({
        success: true,
        message: `Deleted ${deletedCount} news articles`,
        deleted: deletedCount
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting news articles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete news articles',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/news/scrape
 * Manually trigger news scraping
 */
router.post('/scrape', async (req: Request, res: Response) => {
  try {
    console.log('📰 Manual news scraping triggered');
    const articles = await scrapeAllGoldNews();
    await saveNewsArticles(articles);
    
    res.json({
      success: true,
      message: `Scraped and saved ${articles.length} news articles`,
      count: articles.length
    });
  } catch (error) {
    console.error('Error scraping news:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scrape news',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/news/enrich
 * Enrich existing articles with OpenAI-extracted content and dates
 * Optional: limit (number of articles to enrich, default: 10)
 * Optional: update_all (boolean, if true updates all articles missing dates)
 */
router.post('/enrich', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const updateAll = req.query.update_all === 'true';
    
    console.log(`🤖 Starting article enrichment with OpenAI (limit: ${limit}, update_all: ${updateAll})`);
    
    const client = await pool.connect();
    
    try {
      // Get articles that need enrichment (missing published_at or have Google News URLs)
      let query = `
        SELECT id, title, content, source, url, published_at
        FROM gold_news
        WHERE (published_at IS NULL OR url LIKE '%news.google.com%')
        AND url IS NOT NULL
        AND url != ''
        ORDER BY created_at DESC
        ${updateAll ? '' : `LIMIT $1`}
      `;
      
      const params = updateAll ? [] : [limit];
      const result = await client.query(query, params);
      
      const articlesToEnrich = result.rows;
      console.log(`📄 Found ${articlesToEnrich.length} articles to enrich`);
      
      if (articlesToEnrich.length === 0) {
        return res.json({
          success: true,
          message: 'No articles need enrichment',
          enriched: 0
        });
      }
      
      // Separate Google News URLs from regular URLs
      const googleNewsUrls = articlesToEnrich
        .map(row => row.url)
        .filter(url => url && url.includes('news.google.com'));
      
      const regularUrls = articlesToEnrich
        .map(row => row.url)
        .filter(url => url && !url.includes('news.google.com'));
      
      console.log(`🔗 Found ${googleNewsUrls.length} Google News URLs and ${regularUrls.length} regular URLs`);
      
      // Resolve Google News redirect URLs to actual article URLs
      let resolvedUrls = new Map<string, string>();
      if (googleNewsUrls.length > 0) {
        const { resolveMultipleGoogleNewsUrls } = await import('../services/googleNewsResolver');
        console.log(`🔗 Resolving ${googleNewsUrls.length} Google News redirect URLs...`);
        resolvedUrls = await resolveMultipleGoogleNewsUrls(googleNewsUrls, 3);
        console.log(`✅ Resolved ${resolvedUrls.size} Google News URLs to actual article URLs`);
      }
      
      // Combine resolved URLs with regular URLs for enrichment
      const allUrlsToEnrich: string[] = [
        ...regularUrls,
        ...Array.from(resolvedUrls.values()).filter(url => url && !url.includes('news.google.com'))
      ];
      
      console.log(`🔗 Extracting metadata for ${allUrlsToEnrich.length} article URLs using OpenAI...`);
      
      // Extract metadata from URLs using OpenAI
      const metadataMap = await extractMultipleArticleMetadata(allUrlsToEnrich, 3);
      
      // Update articles in database
      let enrichedCount = 0;
      for (const row of articlesToEnrich) {
        if (!row.url) {
          continue;
        }
        
        // Determine which URL to look up (resolved if Google News, original otherwise)
        let urlToLookup = row.url;
        let actualUrl = row.url;
        
        if (row.url.includes('news.google.com')) {
          const resolved = resolvedUrls.get(row.url);
          if (resolved && !resolved.includes('news.google.com')) {
            urlToLookup = resolved;
            actualUrl = resolved; // Update to actual URL
          } else {
            continue; // Skip if we couldn't resolve
          }
        }
        
        const metadata = metadataMap.get(urlToLookup);
        if (metadata) {
          await client.query(
            `UPDATE gold_news 
             SET title = COALESCE($1, title),
                 content = COALESCE($2, content),
                 url = $3,
                 published_at = COALESCE($4, published_at)
             WHERE id = $5`,
            [
              metadata.title || null,
              metadata.content || null,
              actualUrl, // Update URL to actual article URL if resolved
              metadata.published_at || null,
              row.id
            ]
          );
          enrichedCount++;
          console.log(`✅ Enriched article #${row.id}: ${row.title.substring(0, 50)}... (date: ${metadata.published_at?.toISOString().split('T')[0] || 'none'})`);
        }
      }
      
      res.json({
        success: true,
        message: `Enriched ${enrichedCount} articles with OpenAI`,
        enriched: enrichedCount,
        total: articlesToEnrich.length
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error enriching articles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enrich articles',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/news/search
 * Search for articles across multiple sources with flexible options
 * Query params:
 *   - query: Search query (required)
 *   - date: Specific date to search (YYYY-MM-DD format, optional)
 *   - sources: Comma-separated list of sources (optional)
 *   - limit: Maximum results (default: 20)
 *   - sortBy: 'relevance' or 'date' (default: 'relevance')
 *   - enrich: Boolean, whether to enrich with OpenAI (default: false)
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { query, date, sources, limit, sortBy, enrich } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }
    
    const searchOptions: ArticleSearchOptions = {
      query: query as string,
      date: date as string | undefined,
      sources: sources ? (typeof sources === 'string' ? sources.split(',').map(s => s.trim()) : sources) : undefined,
      limit: limit ? parseInt(limit as string) : 20,
      sortBy: (sortBy as 'relevance' | 'date') || 'relevance',
    };
    
    console.log(`🔍 Searching articles with options:`, searchOptions);
    
    // Search for articles
    const searchResults = await searchArticles(searchOptions);
    
    // Enrich with OpenAI if requested
    let enrichedResults = searchResults;
    if (enrich === true || enrich === 'true') {
      console.log(`🤖 Enriching ${searchResults.length} articles with OpenAI...`);
      const urls = searchResults.map(r => r.url).filter(url => url && !url.includes('news.google.com'));
      const metadataMap = await enrichArticles(urls, 3);
      
      enrichedResults = searchResults.map(result => {
        const metadata = metadataMap.get(result.url);
        if (metadata) {
          return {
            ...result,
            title: metadata.title || result.title,
            snippet: metadata.summary || result.snippet,
            published_at: metadata.published_at || result.published_at,
          };
        }
        return result;
      });
    }
    
    res.json({
      success: true,
      data: enrichedResults,
      count: enrichedResults.length,
      query: searchOptions.query,
      date: searchOptions.date,
    });
  } catch (error) {
    console.error('Error searching articles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search articles',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/news/search/date/:date
 * Search for important articles on a specific date
 * Query params:
 *   - query: Search query (optional, defaults to gold-related query)
 *   - limit: Maximum results (default: 10)
 */
router.get('/search/date/:date', async (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    const query = (req.query.query as string) || 'gold market trends india festival demand';
    const limit = parseInt(req.query.limit as string) || 10;
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    }
    
    console.log(`📅 Searching for important articles on ${date}: "${query}"`);
    
    // Search for important articles on that date
    const results = await searchImportantArticlesForDate(query, date, limit);
    
    // Enrich with OpenAI to get full content and accurate dates
    console.log(`🤖 Enriching ${results.length} articles with OpenAI...`);
    const urls = results.map(r => r.url).filter(url => url && !url.includes('news.google.com'));
    const metadataMap = await enrichArticles(urls, 3);
    
    const enrichedResults = results.map(result => {
      const metadata = metadataMap.get(result.url);
      if (metadata) {
        return {
          ...result,
          title: metadata.title || result.title,
          snippet: metadata.summary || result.snippet,
          published_at: metadata.published_at || result.published_at,
          full_content: metadata.content,
          author: metadata.author,
        };
      }
      return result;
    });
    
    res.json({
      success: true,
      data: enrichedResults,
      count: enrichedResults.length,
      date,
      query,
    });
  } catch (error) {
    console.error('Error searching articles by date:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search articles by date',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/news/search-and-save
 * Search for articles and save them to database with OpenAI enrichment
 * Body:
 *   - query: Search query (required)
 *   - date: Specific date (optional)
 *   - sources: Array of sources (optional)
 *   - limit: Maximum results (default: 20)
 */
router.post('/search-and-save', async (req: Request, res: Response) => {
  try {
    const { query, date, sources, limit } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }
    
    console.log(`🔍 Searching and saving articles: "${query}"${date ? ` (date: ${date})` : ''}`);
    
    // Search for articles
    const searchOptions: ArticleSearchOptions = {
      query: query as string,
      date: date as string | undefined,
      sources: sources as string[] | undefined,
      limit: limit ? parseInt(limit as string) : 20,
      sortBy: 'date',
    };
    
    const searchResults = await searchArticles(searchOptions);
    
    // Enrich with OpenAI
    console.log(`🤖 Enriching ${searchResults.length} articles with OpenAI...`);
    const urls = searchResults.map(r => r.url).filter(url => url && !url.includes('news.google.com'));
    const metadataMap = await enrichArticles(urls, 3);
    
    // Convert to NewsArticle format and save
    const client = await pool.connect();
    let savedCount = 0;
    
    try {
      for (const result of searchResults) {
        const metadata = metadataMap.get(result.url);
        
        if (metadata) {
          // Check if article already exists
          const existingCheck = await client.query(
            'SELECT id FROM gold_news WHERE url = $1',
            [result.url]
          );
          
          if (existingCheck.rows.length > 0) {
            console.log(`⏭️ Article already exists: ${metadata.title.substring(0, 50)}...`);
            continue;
          }
          
          // Save to database
          await client.query(
            `INSERT INTO gold_news (title, content, source, url, published_at, sentiment, impact)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              metadata.title || result.title,
              metadata.content || result.snippet || '',
              result.source || 'Unknown',
              result.url,
              metadata.published_at || result.published_at || null,
              'neutral', // Default sentiment, can be analyzed later
              'medium', // Default impact, can be analyzed later
            ]
          );
          
          savedCount++;
          console.log(`✅ Saved article: ${metadata.title.substring(0, 50)}...`);
        }
      }
    } finally {
      client.release();
    }
    
    res.json({
      success: true,
      message: `Searched and saved ${savedCount} articles`,
      searched: searchResults.length,
      saved: savedCount,
    });
  } catch (error) {
    console.error('Error searching and saving articles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search and save articles',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

