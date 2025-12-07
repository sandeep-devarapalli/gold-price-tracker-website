import { scrapeUrl } from '../services/firecrawlService';

async function testFirecrawl() {
  console.log('🧪 Testing Firecrawl scraper...');
  
  try {
    const testUrl = 'https://www.google.com/search?q=gold+price+india';
    console.log(`Testing with URL: ${testUrl}`);
    
    const result = await scrapeUrl(testUrl, {
      onlyMainContent: false,
      formats: ['markdown'],
    });
    
    console.log('\n=== Scrape Result ===');
    console.log('Success:', result.success);
    
    if (result.success) {
      console.log('Markdown length:', result.markdown?.length || 0);
      console.log('\nMarkdown preview (first 500 chars):');
      console.log(result.markdown?.substring(0, 500) || 'No markdown');
    } else {
      console.log('Error:', result.error);
    }
    
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testFirecrawl();

