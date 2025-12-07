import OpenAI from 'openai';
import { scrapeUrl } from './firecrawlService';

// Lazy initialization of OpenAI client
let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

export interface ArticleMetadata {
  title: string;
  content: string;
  published_at: Date | null;
  author?: string;
  summary?: string;
}

/**
 * Extract article content and published date from a URL using OpenAI
 */
export async function extractArticleMetadata(url: string): Promise<ArticleMetadata | null> {
  try {
    console.log(`📄 Extracting article metadata from URL: ${url}`);
    
    // If it's a Google News redirect URL, resolve it first
    let actualUrl = url;
    if (url.includes('news.google.com')) {
      const { resolveGoogleNewsUrl } = await import('./googleNewsResolver');
      const resolved = await resolveGoogleNewsUrl(url);
      if (resolved && !resolved.includes('news.google.com')) {
        actualUrl = resolved;
        console.log(`✅ Resolved Google News URL to: ${actualUrl}`);
      } else {
        console.warn(`⚠️ Could not resolve Google News URL: ${url}`);
        return null;
      }
    }
    
    // First, scrape the article URL using Firecrawl
    const scrapeResult = await scrapeUrl(actualUrl, {
      onlyMainContent: true,
      includeHtml: false,
      formats: ['markdown'],
    });
    
    if (!scrapeResult.success || !scrapeResult.markdown) {
      console.error(`❌ Failed to scrape article URL: ${actualUrl}`);
      return null;
    }
    
    const articleContent = scrapeResult.markdown;
    
    // Truncate content if too long (OpenAI has token limits)
    const maxContentLength = 15000; // ~4000 tokens
    const truncatedContent = articleContent.length > maxContentLength
      ? articleContent.substring(0, maxContentLength) + '...'
      : articleContent;
    
    // Use OpenAI to extract structured metadata from the article
    console.log(`🤖 Using OpenAI to extract metadata from article...`);
    
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at extracting structured information from news articles. 
Extract the article title, main content, and published date from the provided article text.
Return the information in a structured JSON format.
For the published date, return it in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss).
If you cannot find a published date, return null for published_at.`
        },
        {
          role: 'user',
          content: `Extract the following information from this article:
URL: ${actualUrl}

Article Content:
${truncatedContent}

Return a JSON object with:
- title: string (the article headline/title)
- content: string (cleaned main article content, remove ads/navigation)
- published_at: string | null (ISO 8601 date format, or null if not found)
- author: string | null (optional, if available)
- summary: string | null (optional, brief summary)

Return ONLY valid JSON, no other text.`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });
    
    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      console.error('❌ No response from OpenAI');
      return null;
    }
    
    const metadata = JSON.parse(responseContent) as {
      title?: string;
      content?: string;
      published_at?: string | null;
      author?: string | null;
      summary?: string | null;
    };
    
    // Parse the published date
    let publishedAt: Date | null = null;
    if (metadata.published_at) {
      try {
        publishedAt = new Date(metadata.published_at);
        if (isNaN(publishedAt.getTime())) {
          publishedAt = null;
        }
      } catch (e) {
        console.warn(`⚠️ Failed to parse published_at: ${metadata.published_at}`);
        publishedAt = null;
      }
    }
    
    const result: ArticleMetadata = {
      title: metadata.title || '',
      content: metadata.content || truncatedContent,
      published_at: publishedAt,
      author: metadata.author || undefined,
      summary: metadata.summary || undefined,
    };
    
    console.log(`✅ Extracted metadata: title="${result.title.substring(0, 50)}...", published_at=${result.published_at?.toISOString() || 'null'}`);
    
    return result;
  } catch (error) {
    console.error(`❌ Error extracting article metadata from ${url}:`, error);
    return null;
  }
}

/**
 * Extract metadata from multiple article URLs in batch
 */
export async function extractMultipleArticleMetadata(
  urls: string[],
  concurrency: number = 3
): Promise<Map<string, ArticleMetadata>> {
  const results = new Map<string, ArticleMetadata>();
  
  // Process URLs in batches to avoid rate limits
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    
    console.log(`📦 Processing batch ${Math.floor(i / concurrency) + 1} (${batch.length} articles)...`);
    
    const batchResults = await Promise.allSettled(
      batch.map(async (url) => {
        const metadata = await extractArticleMetadata(url);
        return { url, metadata };
      })
    );
    
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.metadata) {
        results.set(result.value.url, result.value.metadata);
      } else if (result.status === 'rejected') {
        console.error(`❌ Failed to extract metadata for URL: ${result.reason}`);
      }
    });
    
    // Add a small delay between batches to avoid rate limits
    if (i + concurrency < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    }
  }
  
  return results;
}
