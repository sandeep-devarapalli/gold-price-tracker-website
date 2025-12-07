import { getLatestNews } from '../services/newsScraper';
import { generateGoldPricePredictions } from '../services/predictionService';
import { getLatestPrice } from '../services/priceService';
import dotenv from 'dotenv';

dotenv.config();

async function analyzeExistingArticles() {
  console.log('🔍 Analyzing existing articles in database and generating predictions with summaries...\n');
  
  try {
    // Step 1: Get latest price
    console.log('📊 Step 1: Getting latest gold price...');
    const latestPrice = await getLatestPrice('India');
    if (!latestPrice) {
      console.error('❌ No gold price found. Please scrape gold price first.');
      process.exit(1);
    }
    console.log(`✅ Current price: ₹${latestPrice.price_1g.toFixed(2)}/g\n`);
    
    // Step 2: Get existing articles
    console.log('📰 Step 2: Fetching existing articles...');
    const articles = await getLatestNews(15);
    console.log(`✅ Found ${articles.length} articles in database\n`);
    
    if (articles.length === 0) {
      console.log('⚠️  No articles found. Please scrape news first.');
      process.exit(1);
    }
    
    // Step 3: Generate predictions (this will analyze articles)
    console.log('🤖 Step 3: Generating predictions with article analysis...');
    console.log('   This will analyze article content using OpenAI...\n');
    
    const analysis = await generateGoldPricePredictions(latestPrice.price_1g, 7);
    
    console.log('\n✅ Analysis complete!\n');
    console.log('📊 Results:');
    console.log(`   Recommendation: ${analysis.recommendation.toUpperCase()}`);
    console.log(`   Confidence: ${analysis.confidence}%`);
    console.log(`   Market Sentiment: ${analysis.market_sentiment.toUpperCase()}`);
    console.log(`   Article Summaries: ${analysis.article_summaries?.length || 0} points\n`);
    
    if (analysis.article_summaries && analysis.article_summaries.length > 0) {
      console.log('🎉 Article summaries extracted:\n');
      analysis.article_summaries.forEach((summary, idx) => {
        const summaryText = typeof summary === 'string' ? summary : String(summary);
        console.log(`${idx + 1}. ${summaryText.substring(0, 120)}${summaryText.length > 120 ? '...' : ''}`);
      });
      console.log('\n✅ Article analysis successful!');
      console.log('✅ Summaries are saved to database');
      console.log('\n🔄 Frontend will show these summaries automatically!');
    } else {
      console.log('⚠️  No article summaries generated');
      console.log('   This might be due to:');
      console.log('   - Articles not meeting filtering criteria');
      console.log('   - OpenAI analysis failing');
      console.log('   - Check server logs for errors');
    }
    
    process.exit(0);
    
  } catch (error: any) {
    console.error('\n❌ Error analyzing articles:\n');
    console.error(`   ${error.message || error}`);
    if (error.stack) {
      console.error('\n   Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

analyzeExistingArticles();

