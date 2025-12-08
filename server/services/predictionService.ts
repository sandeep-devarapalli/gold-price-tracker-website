import OpenAI from 'openai';
import pool from '../db/connection';
import { getLatestMarketData } from './marketScraper';
import { getLatestNews, getTodaysNews, NewsArticle } from './newsScraper';
import { getLatestFuturesData } from './goldFuturesScraper';

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

export interface PricePrediction {
  date: string;
  predicted_price_1g: number;
  predicted_price_10g: number;
  confidence: number;
  reasoning: string;
  factors: string[];
}

export interface PredictionAnalysis {
  recommendation: 'buy' | 'hold' | 'sell';
  confidence: number;
  market_sentiment: 'bullish' | 'bearish' | 'neutral';
  news_sentiment: number; // 0-100 percentage positive
  trend_analysis: string;
  key_factors: string[];
  article_summaries: string[]; // Key summary points from analyzed articles
  predictions: PricePrediction[];
}

/**
 * Generate gold price predictions using OpenAI based on news and market data
 */
export async function generateGoldPricePredictions(
  currentPrice: number,
  days: number = 7
): Promise<PredictionAnalysis> {
  try {
    console.log('🤖 Generating gold price predictions using OpenAI...');
    
    // Gather current market data, futures data, and TODAY'S news (for daily predictions)
    const [usMarkets, indiaMarkets, currencyRates, futuresData, newsArticles] = await Promise.all([
      getLatestMarketData('US'),
      getLatestMarketData('India'),
      getLatestMarketData('Currency'),
      getLatestFuturesData(), // Get MCX and COMEX futures data
      getTodaysNews(15) // Get today's news for predictions
    ]);
    
    console.log(`📰 Using ${newsArticles.length} today's news articles for prediction`);
    
    // Get historical gold prices for context
    const client = await pool.connect();
    let historicalPrices: Array<{ price_1g: number; timestamp: Date }> = [];
    
    try {
      const historyResult = await client.query(
        `SELECT price_1g, timestamp 
         FROM gold_prices 
         WHERE country = 'India'
         ORDER BY timestamp DESC 
         LIMIT 30`
      );
      historicalPrices = historyResult.rows.map(row => ({
        price_1g: parseFloat(row.price_1g),
        timestamp: row.timestamp
      }));
    } finally {
      client.release();
    }
    
    // Analyze article content and extract key summary points using OpenAI
    console.log('📊 Analyzing article content to extract key insights...');
    const articleSummaries = await extractArticleSummaryPoints(newsArticles.slice(0, 10)); // Analyze top 10 articles
    console.log(`✅ Extracted ${articleSummaries.length} key summary points from articles`);
    
    // Prepare context for OpenAI
    const marketContext = {
      usIndices: usMarkets.map(m => ({
        name: m.index_name,
        value: m.value,
        change: m.change,
        percent_change: m.percent_change
      })),
      indiaIndices: indiaMarkets.map(m => ({
        name: m.index_name,
        value: m.value,
        change: m.change,
        percent_change: m.percent_change
      })),
      currency: currencyRates.map(m => ({
        name: m.index_name,
        value: m.value,
        change: m.change,
        percent_change: m.percent_change
      })),
      goldFutures: futuresData.map(f => ({
        exchange: f.exchange,
        contract_symbol: f.contract_symbol,
        futures_price: f.futures_price,
        spot_price: f.spot_price,
        trading_volume: f.trading_volume,
        open_interest: f.open_interest,
        change: f.change,
        percent_change: f.percent_change
      })),
      newsCount: newsArticles.length,
      newsSentiment: calculateNewsSentiment(newsArticles),
      articleSummaries: articleSummaries, // Include extracted summary points
      recentNews: newsArticles.slice(0, 10).map(n => ({
        title: n.title,
        content: n.content ? n.content.substring(0, 500) : '', // Include content for analysis
        sentiment: n.sentiment,
        impact: n.impact,
        source: n.source
      })),
      currentPrice: currentPrice,
      recentPrices: historicalPrices.slice(0, 7).map(p => ({
        price: p.price_1g,
        date: p.timestamp.toISOString().split('T')[0]
      }))
    };
    
    // Create prompt for OpenAI
    const prompt = createPredictionPrompt(marketContext, days);
    
    console.log('📤 Sending prediction request to OpenAI...');
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert financial analyst specializing in gold price predictions. Analyze market data, news sentiment, and historical trends to provide accurate gold price forecasts.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });
    
    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }
    
    const analysis = JSON.parse(responseContent) as PredictionAnalysis;
    
    // Ensure article_summaries is included (use extracted summaries if not in response)
    if (!analysis.article_summaries || analysis.article_summaries.length === 0) {
      analysis.article_summaries = articleSummaries;
    }
    
    // Validate and adjust predictions
    analysis.predictions = analysis.predictions.map(pred => ({
      ...pred,
      predicted_price_10g: pred.predicted_price_1g * 10,
      confidence: Math.min(100, Math.max(0, pred.confidence))
    }));
    
    console.log('✅ Generated predictions successfully');
    return analysis;
    
  } catch (error) {
    console.error('❌ Error generating predictions:', error);
    
    // Return fallback predictions if OpenAI fails
    return generateFallbackPredictions(currentPrice, days);
  }
}

/**
 * Create the prompt for OpenAI prediction
 */
function createPredictionPrompt(context: any, days: number): string {
  const currentPrice = typeof context.currentPrice === 'number' ? context.currentPrice : parseFloat(context.currentPrice) || 0;
  
  return `Analyze the following market data and news to predict gold prices in India for the next ${days} days.

CURRENT MARKET DATA:
- Current Gold Price (1g): ₹${currentPrice.toFixed(2)}
- US Markets: ${JSON.stringify(context.usIndices)}
- India Markets: ${JSON.stringify(context.indiaIndices)}
- Currency Rates: ${JSON.stringify(context.currency)}
- Gold Futures: ${context.goldFutures ? JSON.stringify(context.goldFutures) : 'No futures data available'}
- News Articles Analyzed: ${context.newsCount}
- Overall News Sentiment: ${context.newsSentiment}% positive

RECENT NEWS ARTICLES (with content):
${context.recentNews.map((n: any) => `
- "${n.title}" (Source: ${n.source || 'Unknown'}, ${n.sentiment}, ${n.impact} impact)
  Content: ${n.content || 'No content available'}
`).join('\n')}

KEY ARTICLE SUMMARY POINTS:
${context.articleSummaries && context.articleSummaries.length > 0 
  ? context.articleSummaries.map((point: string) => `- ${point}`).join('\n')
  : '- Analyzing articles...'}

RECENT PRICE HISTORY:
${context.recentPrices.map((p: any) => `- ${p.date}: ₹${(typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0).toFixed(2)}`).join('\n')}

Please provide a JSON response with the following structure:
{
  "recommendation": "buy" | "hold" | "sell",
  "confidence": number (0-100),
  "market_sentiment": "bullish" | "bearish" | "neutral",
  "news_sentiment": number (0-100, percentage positive),
  "trend_analysis": "string describing the trend",
  "key_factors": ["factor1", "factor2", ...],
  "article_summaries": ["summary point 1", "summary point 2", ...],
  "predictions": [
    {
      "date": "YYYY-MM-DD",
      "predicted_price_1g": number,
      "confidence": number (0-100),
      "reasoning": "brief explanation",
      "factors": ["factor1", "factor2"]
    }
  ]
}

Generate predictions for the next ${days} days starting from tomorrow. Consider:
1. Market trends from US and India indices
2. News sentiment and impact - pay special attention to the KEY ARTICLE SUMMARY POINTS above
3. Historical price patterns
4. Economic factors (Fed decisions, dollar strength, inflation)
5. Demand factors (festivals, seasonal trends, investment demand)
6. **Currency Impact**: Check the USD/INR rate provided in "Currency Rates". 
   - If USD/INR > 90.00, treat this as a STRONG BULLISH signal for gold prices in India (imports become costlier).
   - If USD/INR is rising, it puts upward pressure on domestic gold prices.
7. **RBI Interest Rate (Repo Rate)**: Look for mentions of "RBI MPC", "Repo Rate", or "Interest Rates" in the news summaries.
   - Rate Hike = Bearish for Gold
   - Rate Cut / Pause = Bullish for Gold
8. **Gold Futures Data** (Weight: 15-20% of prediction):
   - **MCX Futures Price**: Compare with spot price. If futures > spot (contango), it indicates bullish sentiment. If futures < spot (backwardation), it may indicate bearish sentiment.
   - **COMEX Futures Price**: Global gold sentiment. Rising COMEX prices typically support Indian gold prices.
   - **Trading Volume**: High volume indicates strong market interest and can signal price direction. Increasing volume = bullish, decreasing = bearish.
   - **Open Interest**: Increasing open interest = bullish (more positions being opened), decreasing = bearish (positions being closed).
   - **Futures vs Spot Spread**: Analyze the spread between futures and spot prices for both MCX and COMEX to gauge market expectations.

For article_summaries: Include the most important 5-8 summary points from the article analysis that are relevant for price predictions.

Be realistic with price movements (typically 0.1-2% daily changes for gold).`;
}

/**
 * Extract key summary points from article content using OpenAI
 * Analyzes important articles (especially from financial sources like Investing.com)
 * and extracts actionable insights for gold price predictions
 */
async function extractArticleSummaryPoints(articles: NewsArticle[]): Promise<string[]> {
  if (articles.length === 0) return [];
  
  try {
    console.log(`📊 Analyzing ${articles.length} articles to extract key insights...`);
    
    // Filter to high-impact articles and prioritize financial sources (Investing.com, Reuters, etc.)
    const importantArticles = articles
      .filter(a => a.impact === 'high' || 
        a.source.toLowerCase().includes('investing') ||
        a.source.toLowerCase().includes('reuters') ||
        a.source.toLowerCase().includes('bloomberg') ||
        a.source.toLowerCase().includes('economic') ||
        a.content && a.content.length > 200) // Has substantial content
      .slice(0, 10); // Analyze top 10 important articles
    
    if (importantArticles.length === 0) {
      // If no high-impact articles, use first 5 articles
      return articles.slice(0, 5).map(a => `• ${a.title} - ${a.sentiment} sentiment`);
    }
    
    // Prepare article content for OpenAI analysis
    const articleContext = importantArticles.map((article, index) => ({
      index: index + 1,
      title: article.title,
      content: article.content ? article.content.substring(0, 1500) : '', // Limit content length
      source: article.source,
      sentiment: article.sentiment,
      impact: article.impact
    }));
    
    const prompt = `You are a financial analyst specializing in gold market analysis. Analyze the following news articles and extract 4-5 KEY INSIGHTS that directly impact gold prices.

ONLY include insights about:
- Gold price movements and trends (up/down and why)
- Economic factors affecting gold (Fed rates, inflation, USD strength, Treasury yields)
- Demand drivers (festivals, central bank buying, investment flows)
- Global events with direct gold price impact (geopolitical tensions, trade policies)
- Supply factors (mining, imports/exports)

DO NOT include:
- Security warnings or fraud alerts
- Website/company announcements unrelated to prices
- General news without price implications
- Vague or speculative statements

Articles to analyze:
${articleContext.map((a, i) => `
${i + 1}. "${a.title}" (${a.source})
   ${a.content || 'No content'}
`).join('\n')}

Extract exactly 4-5 concise insights. Each insight must:
- Directly relate to gold price movement or prediction
- Be specific with numbers/percentages when available
- Explain the price implication (bullish/bearish)

Return as JSON object with "insights" array:
{"insights": ["insight 1", "insight 2", "insight 3", "insight 4", "insight 5"]}`;
    
    const completion = await getOpenAI().chat.completions.create({
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
    
    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      console.warn('⚠️ No response from OpenAI for article summary extraction');
      return importantArticles.slice(0, 5).map(a => `• ${a.title} - ${a.sentiment} sentiment`);
    }
    
    const parsed = JSON.parse(responseContent);
    
    // Extract insights from response
    let insights: string[] = [];
    
    if (parsed.insights && Array.isArray(parsed.insights)) {
      insights = parsed.insights;
    } else if (Array.isArray(parsed)) {
      insights = parsed;
    } else if (parsed.summaries && Array.isArray(parsed.summaries)) {
      insights = parsed.summaries;
    } else if (parsed.points && Array.isArray(parsed.points)) {
      insights = parsed.points;
    } else {
      // Fallback: extract key price-related info from titles
      insights = importantArticles
        .filter(a => a.impact === 'high')
        .slice(0, 5)
        .map(a => a.title);
    }
    
    // Clean up insights (remove bullets if present, we'll add them in frontend)
    insights = insights.map(point => {
      let cleaned = point.trim();
      if (cleaned.startsWith('•')) cleaned = cleaned.substring(1).trim();
      if (cleaned.startsWith('-')) cleaned = cleaned.substring(1).trim();
      return cleaned;
    }).filter(point => point.length > 10); // Filter out empty/short entries
    
    console.log(`✅ Extracted ${insights.length} key insights from articles`);
    return insights.slice(0, 5); // Limit to 5 insights
    
  } catch (error) {
    console.error('❌ Error extracting article summaries:', error);
    // Fallback: return simple summaries from article titles
    return articles.slice(0, 5).map(a => `• ${a.title} - ${a.sentiment} sentiment`);
  }
}

/**
 * Calculate overall news sentiment percentage
 */
function calculateNewsSentiment(news: Array<{ sentiment: string }>): number {
  if (news.length === 0) return 50; // Neutral if no news
  
  const positive = news.filter(n => n.sentiment === 'positive').length;
  const negative = news.filter(n => n.sentiment === 'negative').length;
  
  if (positive + negative === 0) return 50;
  
  return Math.round((positive / (positive + negative)) * 100);
}

/**
 * Generate fallback predictions if OpenAI fails
 */
function generateFallbackPredictions(currentPrice: number, days: number): PredictionAnalysis {
  const predictions: PricePrediction[] = [];
  const today = new Date();
  
  for (let i = 1; i <= days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    
    // Simple trend continuation (slight upward trend)
    const dailyChange = 0.1 + (Math.random() - 0.5) * 0.3; // -0.05% to 0.25%
    const predictedPrice = currentPrice * (1 + dailyChange / 100);
    
    predictions.push({
      date: date.toISOString().split('T')[0],
      predicted_price_1g: Math.round(predictedPrice * 100) / 100,
      predicted_price_10g: Math.round(predictedPrice * 10 * 100) / 100,
      confidence: 60,
      reasoning: 'Based on historical trend continuation',
      factors: ['Historical trend', 'Market stability']
    });
  }
  
  return {
    recommendation: 'hold',
    confidence: 60,
    market_sentiment: 'neutral',
    news_sentiment: 50,
    trend_analysis: 'Stable trend continuation expected',
    key_factors: ['Historical patterns', 'Market stability'],
    article_summaries: [],
    predictions
  };
}

/**
 * Get existing prediction dates from database
 */
export async function getExistingPredictionDates(): Promise<Set<string>> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT predicted_date FROM gold_price_predictions`
    );
    return new Set(result.rows.map(row => row.predicted_date.toISOString().split('T')[0]));
  } finally {
    client.release();
  }
}

/**
 * Calculate which dates need predictions
 */
function calculateDatesNeeded(existingDates: Set<string>, days: number): string[] {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const datesNeeded: string[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(tomorrow);
    date.setDate(tomorrow.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    if (!existingDates.has(dateStr)) {
      datesNeeded.push(dateStr);
    }
  }
  
  return datesNeeded;
}

/**
 * Save prediction analysis metadata to database
 */
export async function saveAnalysisMetadata(analysis: PredictionAnalysis): Promise<void> {
  const client = await pool.connect();
  try {
    // Delete old analysis records (keep only the latest)
    await client.query('DELETE FROM prediction_analysis');
    
    // Insert new analysis metadata
    await client.query(
      `INSERT INTO prediction_analysis 
       (recommendation, confidence, market_sentiment, news_sentiment, trend_analysis, key_factors, article_summaries, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [
        analysis.recommendation,
        analysis.confidence,
        analysis.market_sentiment,
        analysis.news_sentiment,
        analysis.trend_analysis,
        JSON.stringify(analysis.key_factors),
        JSON.stringify(analysis.article_summaries || [])
      ]
    );
    
    console.log(`✅ Saved prediction analysis metadata to database`);
  } finally {
    client.release();
  }
}

/**
 * Get latest prediction analysis metadata from database
 */
export async function getLatestAnalysis(): Promise<PredictionAnalysis | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT recommendation, confidence, market_sentiment, news_sentiment, 
              trend_analysis, key_factors, article_summaries, created_at
       FROM prediction_analysis
       ORDER BY created_at DESC
       LIMIT 1`
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    
    // Get predictions to construct full analysis
    const predictions = await getLatestPredictions(7);
    
    // Parse article_summaries from JSONB
    let articleSummaries: string[] = [];
    if (row.article_summaries) {
      if (Array.isArray(row.article_summaries)) {
        articleSummaries = row.article_summaries;
      } else {
        articleSummaries = JSON.parse(row.article_summaries || '[]');
      }
    }
    
    return {
      recommendation: row.recommendation,
      confidence: parseFloat(row.confidence),
      market_sentiment: row.market_sentiment as 'bullish' | 'bearish' | 'neutral',
      news_sentiment: parseFloat(row.news_sentiment),
      trend_analysis: row.trend_analysis,
      key_factors: Array.isArray(row.key_factors) ? row.key_factors : JSON.parse(row.key_factors || '[]'),
      article_summaries: articleSummaries,
      predictions: predictions
    };
  } finally {
    client.release();
  }
}

/**
 * Save predictions to database
 * Preserves existing predictions by only inserting new dates (ON CONFLICT DO NOTHING)
 */
export async function savePredictions(analysis: PredictionAnalysis): Promise<void> {
  const client = await pool.connect();
  try {
    // Get existing prediction dates to avoid overwriting
    const existingDates = await getExistingPredictionDates();
    
    let insertedCount = 0;
    let skippedCount = 0;
    
    // Insert new predictions - only for dates that don't exist yet
    for (const prediction of analysis.predictions) {
      // Check if this date already has a prediction
      if (existingDates.has(prediction.date)) {
        skippedCount++;
        continue;
      }
      
      await client.query(
        `INSERT INTO gold_price_predictions 
         (predicted_date, predicted_price_1g, predicted_price_10g, confidence, reasoning, factors, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (predicted_date) DO NOTHING`,
        [
          prediction.date,
          prediction.predicted_price_1g,
          prediction.predicted_price_10g,
          prediction.confidence,
          prediction.reasoning,
          JSON.stringify(prediction.factors)
        ]
      );
      insertedCount++;
    }
    
    console.log(`✅ Saved ${insertedCount} new predictions to database (${skippedCount} already existed and preserved)`);
    
    // Also save the analysis metadata
    await saveAnalysisMetadata(analysis);
  } finally {
    client.release();
  }
}

/**
 * Get latest predictions from database
 */
export async function getLatestPredictions(days: number = 7, includePast: boolean = false): Promise<PricePrediction[]> {
  const client = await pool.connect();
  try {
    let query: string;
    let params: any[];
    
    if (includePast) {
      // Return both past and future predictions
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      query = `
        SELECT predicted_date, predicted_price_1g, predicted_price_10g, 
               confidence, reasoning, factors
        FROM gold_price_predictions
        WHERE predicted_date >= $1::date - INTERVAL '${days} days'
          AND predicted_date <= $1::date + INTERVAL '${days} days'
        ORDER BY predicted_date ASC
      `;
      params = [today];
    } else {
      // Only return FUTURE predictions (starting from tomorrow, not today)
      query = `
        SELECT predicted_date, predicted_price_1g, predicted_price_10g, 
               confidence, reasoning, factors
        FROM gold_price_predictions
        WHERE predicted_date > CURRENT_DATE
        ORDER BY predicted_date ASC
        LIMIT $1
      `;
      params = [days];
    }
    
    const result = await client.query(query, params);
    
    return result.rows.map(row => ({
      date: row.predicted_date.toISOString().split('T')[0],
      predicted_price_1g: parseFloat(row.predicted_price_1g),
      predicted_price_10g: parseFloat(row.predicted_price_10g),
      confidence: parseFloat(row.confidence),
      reasoning: row.reasoning,
      factors: Array.isArray(row.factors) ? row.factors : JSON.parse(row.factors || '[]')
    }));
  } finally {
    client.release();
  }
}

/**
 * Combined prediction with actual price (if available)
 * Note: prediction fields can be null for dates with only actual prices
 */
export interface PredictionWithActual {
  date: string;
  predicted_price_1g: number | null;
  predicted_price_10g: number | null;
  confidence: number | null;
  reasoning: string | null;
  factors: string[];
  actual_price_1g: number | null;
  has_actual: boolean;
}

/**
 * Get all predictions (past + future) with actual prices joined
 * Also includes actual prices for dates without predictions for complete chart display
 */
export async function getAllPredictionsWithActuals(
  pastDays: number = 7,
  futureDays: number = 7
): Promise<PredictionWithActual[]> {
  const client = await pool.connect();
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Fetch predictions within the date range
    const predictionsResult = await client.query(
      `SELECT 
         TO_CHAR(p.predicted_date, 'YYYY-MM-DD') as predicted_date,
         p.predicted_price_1g,
         p.predicted_price_10g,
         p.confidence,
         p.reasoning,
         p.factors
       FROM gold_price_predictions p
       WHERE p.predicted_date >= $1::date - INTERVAL '${pastDays} days'
         AND p.predicted_date <= $1::date + INTERVAL '${futureDays} days'
       ORDER BY p.predicted_date ASC`,
      [today]
    );
    
    // Fetch actual prices for past dates (up to and including today)
    const actualPricesResult = await client.query(
      `SELECT 
         TO_CHAR(DATE(timestamp), 'YYYY-MM-DD') as price_date,
         price_1g
       FROM gold_prices
       WHERE country = 'India'
         AND DATE(timestamp) >= $1::date - INTERVAL '${pastDays} days'
         AND DATE(timestamp) <= $1::date
       ORDER BY timestamp ASC`,
      [today]
    );
    
    // Create maps for both predictions and actual prices
    const predictionMap = new Map<string, any>();
    predictionsResult.rows.forEach(row => {
      predictionMap.set(row.predicted_date, row);
    });
    
    const actualPriceMap = new Map<string, number>();
    actualPricesResult.rows.forEach(row => {
      actualPriceMap.set(row.price_date, parseFloat(row.price_1g));
    });
    
    // Get all unique dates from both predictions and actuals
    const allDates = new Set<string>();
    predictionMap.forEach((_, date) => allDates.add(date));
    actualPriceMap.forEach((_, date) => allDates.add(date));
    
    // Sort dates chronologically
    const sortedDates = Array.from(allDates).sort();
    
    // Combine all data - include dates with only actuals (no predictions)
    const combined: PredictionWithActual[] = sortedDates.map(dateStr => {
      const prediction = predictionMap.get(dateStr);
      const actualPrice = actualPriceMap.get(dateStr) || null;
      
      return {
        date: dateStr,
        predicted_price_1g: prediction ? parseFloat(prediction.predicted_price_1g) : null,
        predicted_price_10g: prediction ? parseFloat(prediction.predicted_price_10g) : null,
        confidence: prediction ? parseFloat(prediction.confidence) : null,
        reasoning: prediction?.reasoning || null,
        factors: prediction ? (Array.isArray(prediction.factors) ? prediction.factors : JSON.parse(prediction.factors || '[]')) : [],
        actual_price_1g: actualPrice,
        has_actual: actualPrice !== null
      };
    });
    
    return combined;
  } finally {
    client.release();
  }
}
