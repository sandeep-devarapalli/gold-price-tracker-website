import { getTodaysNews } from '../services/newsScraper';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testArticleAnalysis() {
  console.log('🧪 Testing Article Content Analysis with OpenAI...\n');
  
  try {
    // Step 1: Get today's news articles
    console.log('📰 Step 1: Fetching today\'s news articles...');
    const articles = await getTodaysNews(10);
    console.log(`✅ Found ${articles.length} articles\n`);
    
    if (articles.length === 0) {
      console.log('⚠️  No articles found for today. Cannot test analysis.');
      process.exit(1);
    }
    
    // Display articles
    console.log('📄 Articles to analyze:');
    articles.slice(0, 5).forEach((article, idx) => {
      console.log(`\n${idx + 1}. ${article.title}`);
      console.log(`   Source: ${article.source}`);
      console.log(`   Impact: ${article.impact}`);
      console.log(`   Content length: ${article.content?.length || 0} characters`);
      console.log(`   Has content: ${article.content && article.content.length > 200 ? 'Yes ✅' : 'No ❌'}`);
    });
    
    // Step 2: Filter important articles
    console.log('\n\n📊 Step 2: Filtering important articles...');
    const importantArticles = articles
      .filter(a => a.impact === 'high' || 
        a.source.toLowerCase().includes('investing') ||
        a.source.toLowerCase().includes('reuters') ||
        a.source.toLowerCase().includes('bloomberg') ||
        a.source.toLowerCase().includes('economic') ||
        (a.content && a.content.length > 200))
      .slice(0, 5); // Test with top 5
    
    console.log(`✅ Selected ${importantArticles.length} important articles for analysis\n`);
    
    if (importantArticles.length === 0) {
      console.log('⚠️  No important articles found. Using first article for testing...');
      importantArticles.push(articles[0]);
    }
    
    // Step 3: Prepare content for OpenAI
    console.log('🤖 Step 3: Preparing content for OpenAI analysis...');
    const articleContext = importantArticles.map((article, index) => ({
      index: index + 1,
      title: article.title,
      content: article.content ? article.content.substring(0, 1000) : '', // Limit for testing
      source: article.source,
      sentiment: article.sentiment,
      impact: article.impact
    }));
    
    console.log(`✅ Prepared ${articleContext.length} articles for OpenAI\n`);
    
    // Step 4: Call OpenAI to analyze
    console.log('📤 Step 4: Calling OpenAI API to analyze articles...');
    const prompt = `You are a financial analyst specializing in gold market analysis. Analyze the following news articles about gold and extract 3-5 KEY SUMMARY POINTS that are most relevant for gold price predictions in India.

Focus on:
- Market trends and price movements
- Economic factors (Fed decisions, inflation, dollar strength)
- Demand patterns (festivals, seasonal trends, investment demand)
- Global events affecting gold
- Policy changes or regulatory impacts

Articles to analyze:
${articleContext.map((a, i) => `
${i + 1}. Title: "${a.title}"
   Source: ${a.source}
   Sentiment: ${a.sentiment} | Impact: ${a.impact}
   Content: ${a.content || 'Content not available'}
`).join('\n---\n')}

Extract 3-5 concise, actionable summary points. Each point should be:
- A complete sentence starting with a bullet point (•)
- Focused on gold market implications
- Specific and factual
- Relevant for price prediction

Return ONLY a JSON object with a "summaries" array, no other text:
{"summaries": ["• point 1", "• point 2", "• point 3"]}`;
    
    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert financial analyst. Extract key insights from gold market news articles and present them as concise, actionable summary points.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' }
    });
    const duration = Date.now() - startTime;
    
    console.log(`✅ OpenAI API call completed in ${duration}ms\n`);
    
    // Step 5: Parse response
    console.log('📥 Step 5: Parsing OpenAI response...');
    const responseContent = completion.choices[0]?.message?.content;
    
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }
    
    console.log('✅ Received response from OpenAI\n');
    
    const parsed = JSON.parse(responseContent);
    let summaryPoints: string[] = [];
    
    if (parsed.summaries && Array.isArray(parsed.summaries)) {
      summaryPoints = parsed.summaries;
    } else if (Array.isArray(parsed)) {
      summaryPoints = parsed;
    } else if (parsed.points && Array.isArray(parsed.points)) {
      summaryPoints = parsed.points;
    }
    
    // Step 6: Display results
    console.log('🎉 Step 6: Analysis Results!\n');
    console.log('='.repeat(60));
    console.log(`✅ Successfully extracted ${summaryPoints.length} summary points:\n`);
    
    summaryPoints.forEach((point, idx) => {
      console.log(`${idx + 1}. ${point}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ ARTICLE CONTENT ANALYSIS IS WORKING! ✅\n');
    console.log(`✅ Analyzed ${importantArticles.length} articles`);
    console.log(`✅ Extracted ${summaryPoints.length} key insights`);
    console.log(`✅ OpenAI API call successful (${duration}ms)\n`);
    
    process.exit(0);
    
  } catch (error: any) {
    console.error('\n❌ Error during article analysis test:\n');
    console.error(`   Error: ${error.message || error}`);
    
    if (error.status === 401) {
      console.error('\n   ⚠️  OpenAI API key issue');
    } else if (error.status === 429) {
      console.error('\n   ⚠️  Rate limit exceeded - try again later');
    } else {
      console.error(`\n   Status: ${error.status || 'N/A'}`);
    }
    
    process.exit(1);
  }
}

testArticleAnalysis();

