import { scrapeUrl } from './firecrawlService';

/**
 * Resolve Google News redirect URL to actual article URL
 * Google News URLs are redirects like: https://news.google.com/articles/...
 * We need to follow the redirect to get the actual article URL
 */
export async function resolveGoogleNewsUrl(googleNewsUrl: string): Promise<string | null> {
  try {
    if (!googleNewsUrl.includes('news.google.com')) {
      // Not a Google News URL, return as-is
      return googleNewsUrl;
    }
    
    console.log(`🔗 Resolving Google News redirect URL: ${googleNewsUrl}`);
    
    // Try to scrape the redirect page to get the actual URL
    // Firecrawl should follow redirects automatically, but we need to extract the final URL
    const result = await scrapeUrl(googleNewsUrl, {
      onlyMainContent: false,
      includeHtml: true,
      formats: ['markdown', 'html'],
    });
    
    if (!result.success) {
      console.warn(`⚠️ Failed to resolve Google News URL: ${googleNewsUrl}`);
      return null;
    }
    
    // Check Firecrawl metadata first - it might have the final URL
    if (result.metadata && result.metadata.url) {
      const finalUrl = result.metadata.url;
      if (finalUrl && !finalUrl.includes('news.google.com')) {
        console.log(`✅ Resolved via Firecrawl metadata to: ${finalUrl}`);
        return finalUrl;
      }
    }
    
    // Extract actual article URL from the scraped content
    // Google News redirects typically contain the actual URL in the HTML
    if (result.html) {
      // Look for canonical link or og:url
      const canonicalMatch = result.html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
      if (canonicalMatch && canonicalMatch[1]) {
        const actualUrl = canonicalMatch[1].trim();
        if (!actualUrl.includes('news.google.com')) {
          console.log(`✅ Resolved Google News URL to: ${actualUrl}`);
          return actualUrl;
        }
      }
      
      // Look for og:url meta tag
      const ogUrlMatch = result.html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i);
      if (ogUrlMatch && ogUrlMatch[1]) {
        const actualUrl = ogUrlMatch[1].trim();
        if (!actualUrl.includes('news.google.com')) {
          console.log(`✅ Resolved Google News URL to: ${actualUrl}`);
          return actualUrl;
        }
      }
      
      // Look for redirect meta tag
      const redirectMatch = result.html.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"';]+)/i);
      if (redirectMatch && redirectMatch[1]) {
        const actualUrl = redirectMatch[1].trim();
        if (!actualUrl.includes('news.google.com')) {
          console.log(`✅ Resolved via redirect meta tag to: ${actualUrl}`);
          return actualUrl;
        }
      }
      
      // Look for article URL in the content (often in markdown links or hrefs)
      const urlPatterns = [
        /href=["'](https?:\/\/(?!news\.google\.com)[^"']+)["']/gi,
        /\[([^\]]+)\]\((https?:\/\/(?!news\.google\.com)[^\)]+)\)/g,
      ];
      
      for (const pattern of urlPatterns) {
        const matches = Array.from(result.html.matchAll(pattern));
        for (const match of matches) {
          const url = match[2] || match[1];
          if (url && !url.includes('news.google.com')) {
            // Accept any valid article URL, not just known sources
            try {
              const urlObj = new URL(url);
              // Check if it looks like a news article URL (has domain, not just Google)
              if (urlObj.hostname && !urlObj.hostname.includes('google')) {
                console.log(`✅ Found article URL in content: ${url}`);
                return url.trim();
              }
            } catch (e) {
              // Invalid URL, skip
            }
          }
        }
      }
    }
    
    // If we couldn't extract from HTML, try from markdown
    if (result.markdown) {
      // Look for article URLs in markdown
      const urlMatches = result.markdown.matchAll(/\[([^\]]+)\]\((https?:\/\/(?!news\.google\.com)[^\)]+)\)/g);
      for (const match of urlMatches) {
        const url = match[2];
        if (url && !url.includes('news.google.com')) {
          console.log(`✅ Found article URL in markdown: ${url}`);
          return url.trim();
        }
      }
    }
    
    console.warn(`⚠️ Could not resolve Google News URL to actual article URL: ${googleNewsUrl}`);
    return null;
  } catch (error) {
    console.error(`❌ Error resolving Google News URL: ${error}`);
    return null;
  }
}

/**
 * Resolve multiple Google News URLs in batch
 */
export async function resolveMultipleGoogleNewsUrls(
  urls: string[],
  concurrency: number = 3
): Promise<Map<string, string>> {
  const resolvedUrls = new Map<string, string>();
  
  // Separate Google News URLs from regular URLs
  const googleNewsUrls: string[] = [];
  const regularUrls: string[] = [];
  
  for (const url of urls) {
    if (url.includes('news.google.com')) {
      googleNewsUrls.push(url);
    } else {
      regularUrls.push(url);
      resolvedUrls.set(url, url); // Regular URLs map to themselves
    }
  }
  
  if (googleNewsUrls.length === 0) {
    return resolvedUrls;
  }
  
  console.log(`🔗 Resolving ${googleNewsUrls.length} Google News redirect URLs...`);
  
  // Process Google News URLs in batches
  for (let i = 0; i < googleNewsUrls.length; i += concurrency) {
    const batch = googleNewsUrls.slice(i, i + concurrency);
    
    const batchResults = await Promise.allSettled(
      batch.map(async (url) => {
        const resolvedUrl = await resolveGoogleNewsUrl(url);
        return { originalUrl: url, resolvedUrl };
      })
    );
    
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.resolvedUrl) {
        resolvedUrls.set(result.value.originalUrl, result.value.resolvedUrl);
      }
    });
    
    // Small delay between batches
    if (i + concurrency < googleNewsUrls.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`✅ Resolved ${resolvedUrls.size - regularUrls.length}/${googleNewsUrls.length} Google News URLs`);
  
  return resolvedUrls;
}
