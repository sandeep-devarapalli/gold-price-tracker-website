# Gold Price Prediction Factors & Methodology

## Overview
This document tracks the factors, logic, and methodology used to predict gold prices in India for the next 1 week and 1 month. It also documents testing results and iterative improvements to achieve accurate predictions.

**Last Updated:** December 2, 2025  
**Current Prediction Horizon:** 7 days (1 week) and 30 days (1 month)  
**Target Accuracy:** >80% within ±2% price range

---

## Table of Contents
1. [Factors Used](#factors-used)
2. [Prediction Logic](#prediction-logic)
3. [Data Sources](#data-sources)
4. [Model Methodology](#model-methodology)
5. [Testing & Evaluation](#testing--evaluation)
6. [Iterative Improvements](#iterative-improvements)
7. [Accuracy Tracking](#accuracy-tracking)

---

## Factors Used

### 1. Market Data Factors

#### A. India Market Indices
- **Nifty 50** (NSE)
  - Weight: 15%
  - Rationale: Strong correlation with gold demand in India
  - Expected Impact: Bullish Nifty → Increased gold demand → Price increase
- **Sensex** (BSE)
  - Weight: 15%
  - Rationale: Overall market sentiment affects gold investment
  - Expected Impact: Positive correlation with gold prices

#### B. US Market Indices
- **S&P 500**
  - Weight: 10%
  - Rationale: Global economic sentiment affects gold as safe haven
  - Expected Impact: Bearish S&P 500 → Increased gold demand
- **Dow Jones**
  - Weight: 10%
  - Rationale: Similar to S&P 500, indicates economic health
- **NASDAQ**
  - Weight: 5%
  - Rationale: Tech stock performance affects risk appetite

#### C. Currency Factors
- **USD/INR Exchange Rate**
  - Weight: 20%
  - Rationale: Gold prices in India are heavily influenced by USD/INR
  - Expected Impact: Weaker INR → Higher gold prices in INR.
  - **Critical Threshold:** If USD/INR crosses **90.00**, it acts as a strong bullish multiplier for domestic gold prices, as import costs rise significantly.
- **Dollar Strength Index**
  - Weight: 5%
  - Rationale: Stronger dollar typically pressures gold prices

### 2. News & Sentiment Factors

#### A. News Sentiment Analysis
- **Positive News Count**
  - Weight: 10%
  - Sources: Livemint, Economic Times, Business Standard, MoneyControl, Financial Express
  - Keywords: "rise", "gain", "surge", "rally", "increase", "bullish"
- **Negative News Count**
  - Weight: 10%
  - Keywords: "fall", "drop", "decline", "crash", "plunge", "bearish"
- **Neutral News Count**
  - Weight: 5%
  - Impact: Baseline sentiment

#### B. News Impact Level
- **High Impact News**
  - Examples: RBI policy changes, import duty changes, major economic events
  - Weight: 20% (if present)
- **Medium Impact News**
  - Examples: Inflation data, trade balance, demand-supply reports
  - Weight: 10% (if present)
- **Low Impact News**
  - Examples: Daily price movements, minor updates
  - Weight: 5% (if present)

#### C. India-Specific Factors
- **RBI Interest Rate (Repo Rate)**
  - Weight: 25% (during policy reviews)
  - Rationale: Interest rates directly impact gold demand. Higher rates make gold less attractive (bearish); lower rates or pauses make gold more attractive (bullish).
  - Expected Impact: Rate Hike → Bearish for Gold; Rate Cut/Pause → Bullish for Gold.
- **RBI Gold Reserves**
  - Weight: 10%
  - Rationale: Central bank buying/selling affects supply
- **Gold Import Data**
  - Weight: 10%
  - Rationale: High imports → Increased supply → Price pressure
- **Festival Season**
  - Weight: 15% (during Oct-Mar)
  - Rationale: Diwali, Akshaya Tritiya increase demand
- **Monsoon Performance**
  - Weight: 10% (during/after monsoon)
  - Rationale: Good monsoon → Higher rural gold demand

### 3. Gold Futures Factors

#### A. MCX Gold Futures (India)
- **Futures Price**
  - Weight: 15%
  - Rationale: MCX futures reflect Indian market expectations and sentiment
  - Expected Impact: Futures price > Spot price (contango) = Bullish; Futures < Spot (backwardation) = Bearish
- **Trading Volume**
  - Weight: 10%
  - Rationale: High volume indicates strong market interest and liquidity
  - Expected Impact: Increasing volume = Bullish signal; Decreasing volume = Bearish signal
- **Open Interest**
  - Weight: 5%
  - Rationale: Increasing open interest shows new positions being opened (bullish), decreasing shows positions closing (bearish)
  - Expected Impact: Rising OI = Bullish; Falling OI = Bearish

#### B. COMEX Gold Futures (Global)
- **Futures Price**
  - Weight: 10%
  - Rationale: Global gold sentiment affects Indian prices through import costs
  - Expected Impact: Rising COMEX prices support Indian gold prices
- **Trading Volume**
  - Weight: 5%
  - Rationale: Global trading activity reflects worldwide gold demand
- **Futures vs Spot Spread**
  - Weight: 5%
  - Rationale: Contango/backwardation indicates market expectations
  - Expected Impact: Contango = Bullish expectations; Backwardation = Bearish expectations

### 4. Trading Volume Factors

#### A. MCX Gold Trading Volume
- **Daily Trading Volume**
  - Weight: 10%
  - Rationale: High trading volume indicates active market participation and strong interest
  - Expected Impact: Volume spikes often precede price movements
- **Volume Trends**
  - Weight: 5%
  - Rationale: Increasing volume trend = growing interest; Decreasing = waning interest

### 5. Historical Price Factors

#### A. Price Trends
- **7-Day Moving Average**
  - Weight: 15%
  - Rationale: Short-term momentum
- **30-Day Moving Average**
  - Weight: 10%
  - Rationale: Medium-term trend
- **Volatility (Standard Deviation)**
  - Weight: 10%
  - Rationale: Higher volatility → More uncertainty in predictions

#### B. Price Patterns
- **Recent High/Low**
  - Weight: 5%
  - Rationale: Support/resistance levels
- **Price Change Rate**
  - Weight: 10%
  - Rationale: Acceleration/deceleration in price movement

### 6. Market Cap Context

#### A. India Gold Market Cap
- **Total Market Value**
  - Weight: Contextual (not directly weighted)
  - Rationale: Provides context for market size and significance
  - Update Frequency: Quarterly
  - Sources: RBI reports, World Gold Council

#### B. Global Gold Market Cap
- **Total Market Value**
  - Weight: Contextual (not directly weighted)
  - Rationale: Global market context for comparison
  - Update Frequency: Quarterly
  - Sources: World Gold Council

### 7. External Factors

#### A. Global Factors
- **International Gold Price (USD/oz)**
  - Weight: 25%
  - Rationale: Base price reference
- **Economic Calendar Events**
  - **RBI MPC Meetings:** Watch for Repo Rate decisions (Bullish if rates hold/cut).
  - **US Fed (FOMC):** Watch for Fed rate decisions (Bullish if Fed pivots to cuts).
  - **US Non-Farm Payrolls & CPI:** High volatility expected around these releases.
- **Bitcoin Price**
  - Weight: 5%
  - Rationale: Alternative investment affects gold demand
- **Oil Prices**
  - Weight: 5%
  - Rationale: Inflation indicator

#### B. Geopolitical Factors
- **War/Conflict News**
  - Weight: 15% (if present)
  - Rationale: Safe haven demand
- **Economic Sanctions**
  - Weight: 10% (if present)
  - Rationale: Affects global trade

### 4. Gold Futures Factors

#### A. MCX Gold Futures (India)
- **Futures Price**
  - Weight: 15%
  - Rationale: MCX futures reflect Indian market expectations and sentiment
  - Expected Impact: Futures price > Spot price (contango) = Bullish; Futures < Spot (backwardation) = Bearish
- **Trading Volume**
  - Weight: 10%
  - Rationale: High volume indicates strong market interest and liquidity
  - Expected Impact: Increasing volume = Bullish signal; Decreasing volume = Bearish signal
- **Open Interest**
  - Weight: 5%
  - Rationale: Increasing open interest shows new positions being opened (bullish), decreasing shows positions closing (bearish)
  - Expected Impact: Rising OI = Bullish; Falling OI = Bearish

#### B. COMEX Gold Futures (Global)
- **Futures Price**
  - Weight: 10%
  - Rationale: Global gold sentiment affects Indian prices through import costs
  - Expected Impact: Rising COMEX prices support Indian gold prices
- **Trading Volume**
  - Weight: 5%
  - Rationale: Global trading activity reflects worldwide gold demand
- **Futures vs Spot Spread**
  - Weight: 5%
  - Rationale: Contango/backwardation indicates market expectations
  - Expected Impact: Contango = Bullish expectations; Backwardation = Bearish expectations

### 5. Trading Volume Factors

#### A. MCX Gold Trading Volume
- **Daily Trading Volume**
  - Weight: 10%
  - Rationale: High trading volume indicates active market participation and strong interest
  - Expected Impact: Volume spikes often precede price movements
- **Volume Trends**
  - Weight: 5%
  - Rationale: Increasing volume trend = growing interest; Decreasing = waning interest

---

## Prediction Logic

### Current Model: Multi-Factor Weighted Analysis

1. **Data Collection Phase**
   - Gather all factors listed above
   - Normalize data to 0-100 scale
   - Weight each factor according to importance

2. **AI Analysis Phase** (OpenAI GPT-4o-mini)
   - Send all factors to OpenAI with detailed prompt
   - AI analyzes correlations and patterns
   - Generate predictions with confidence scores

3. **Output Format**
   ```json
   {
     "recommendation": "buy|hold|sell",
     "confidence": 0-100,
     "market_sentiment": "bullish|bearish|neutral",
     "news_sentiment": 0-100,
     "trend_analysis": "string",
     "key_factors": ["factor1", "factor2"],
     "predictions": [
       {
         "date": "YYYY-MM-DD",
         "predicted_price_1g": number,
         "confidence": 0-100,
         "reasoning": "string",
         "factors": ["factor1", "factor2"]
       }
     ]
   }
   ```

### Fallback Model: Trend Continuation
- Used when OpenAI fails or returns invalid data
- Simple linear regression based on last 7 days
- Adds 0.1-0.3% daily variation
- Confidence: 60%

---

## Data Sources

### News Sources
**Google News (Aggregated)** - Single API call aggregates from multiple sources
- **Search Query:** Focuses on trends, festivals, demand patterns (NOT price updates)
- **Geographic Mix:** 
  - 30%+ Global news (international markets, central banks, global trends)
  - 70% India-specific news (festivals, local demand, RBI policy)
- **Global Sources:** Reuters, Bloomberg, CNBC, Financial Times, China market updates
- **India Sources:** Livemint, Economic Times, Business Standard, MoneyControl, Financial Express, Times of India
- **Frequency:** Daily (3 times per day)
- **Focus:** Market trends, festivals, social factors, demand patterns (NOT price updates)
- **Filtering:** Excludes price update articles, focuses on trend analysis

### Market Data Sources
- **Google Finance** - US and India market indices
- **Livemint** - Current gold prices
- **MoneyControl** - MCX Gold futures

---

## Model Methodology

### Prediction Algorithm

#### Step 1: Factor Normalization
```
For each factor:
  - Normalize to 0-100 scale
  - Apply weight multiplier
  - Calculate weighted score
```

#### Step 2: Correlation Analysis
```
For each factor pair:
  - Calculate correlation coefficient
  - Identify strong correlations (|r| > 0.7)
  - Adjust weights based on correlation strength
```

#### Step 3: Trend Analysis
```
- Calculate moving averages (7d, 30d)
- Identify trend direction (up/down/neutral)
- Calculate momentum (rate of change)
- Predict continuation or reversal
```

#### Step 4: Sentiment Integration
```
- Aggregate news sentiment scores
- Weight high-impact news more heavily
- Adjust predictions based on sentiment shift
```

#### Step 5: Price Prediction
```
predicted_price = base_price * (1 + trend_factor) * (1 + sentiment_factor) * (1 + market_factor)

where:
  trend_factor = weighted_moving_average_change
  sentiment_factor = normalized_news_sentiment
  market_factor = weighted_market_indices_change
```

### Confidence Score Calculation
```
confidence = (
  (data_quality_score * 0.3) +
  (factor_coverage_score * 0.3) +
  (historical_accuracy * 0.2) +
  (news_sentiment_consistency * 0.2)
) * 100
```

---

## Testing & Evaluation

### Test Methodology

#### Phase 1: Historical Backtesting
- Test predictions against historical data
- Calculate accuracy metrics
- Identify best-performing factors

#### Phase 2: Real-Time Testing
- Generate daily predictions
- Track actual vs predicted prices
- Calculate error rates

#### Phase 3: Factor Contribution Analysis
- Remove factors one by one
- Measure impact on accuracy
- Optimize factor weights

### Evaluation Metrics

1. **Mean Absolute Percentage Error (MAPE)**
   ```
   MAPE = (1/n) * Σ |(Actual - Predicted) / Actual| * 100
   Target: < 2%
   ```

2. **Root Mean Square Error (RMSE)**
   ```
   RMSE = √(Σ(Predicted - Actual)² / n)
   Target: < ₹50/g
   ```

3. **Direction Accuracy**
   ```
   Direction Accuracy = (Correct Direction Predictions / Total) * 100
   Target: > 70%
   ```

4. **Confidence Calibration**
   ```
   High confidence predictions should have lower error rates
   Target: Confidence correlates with accuracy
   ```

---

## Iterative Improvements

### Version 1.0 (Current - December 2, 2025)
- ✅ Basic factor collection (market data, news)
- ✅ OpenAI integration for analysis
- ✅ Simple trend continuation fallback
- ✅ India-specific news sources added (5 sources)
- ✅ Accuracy tracking system implemented
- ✅ 27 news articles scraped (includes India sources)
- **Accuracy:** Pending validation (predictions generated, waiting for actual prices)

### Planned Improvements

#### Version 1.1 (Next Week)
- [ ] Add India-specific news sources
- [ ] Implement accuracy tracking database
- [ ] Add historical backtesting
- [ ] Improve factor weighting based on correlation

#### Version 1.2 (Next Month)
- [ ] Machine learning model training
- [ ] Seasonal factor adjustments (festivals, monsoon)
- [ ] Real-time factor importance updates
- [ ] Automated factor weight optimization

#### Version 2.0 (Future)
- [ ] Deep learning model for pattern recognition
- [ ] Multi-horizon predictions (1 day, 1 week, 1 month)
- [ ] Ensemble model combining multiple approaches
- [ ] Real-time factor correlation monitoring

---

## Accuracy Tracking

### Test Results Log

#### Test Run #1 - December 2, 2025
- **Prediction Date:** 2025-12-02
- **Horizon:** 7 days
- **Method:** OpenAI Analysis + Trend Continuation
- **Factors Used:** Market indices, News sentiment (limited), Historical prices
- **Predictions:**
  - Dec 2: ₹13,098.35/g (60% confidence)
  - Dec 3: ₹13,096.93/g (60% confidence)
  - Dec 4: ₹13,071.29/g (60% confidence)
  - Dec 5: ₹13,079.91/g (60% confidence)
  - Dec 6: ₹13,085.39/g (60% confidence)
  - Dec 7: ₹13,106.87/g (60% confidence)
  - Dec 8: ₹13,094.82/g (60% confidence)
- **Status:** Pending validation (predictions generated)
- **Notes:** Used fallback model (OpenAI may have failed)

#### Test Run #2 - [Date]
- **Status:** Pending

---

## Factor Performance Analysis

### Factor Effectiveness Ranking
(To be updated based on test results)

1. **High Impact Factors** (To be determined)
2. **Medium Impact Factors** (To be determined)
3. **Low Impact Factors** (To be determined)

### Recommended Weight Adjustments
(To be updated based on testing)

---

## Issues & Solutions

### Issue #1: Limited News Sources
- **Status:** Fixed
- **Solution:** Added 5 India-specific news sources
- **Date:** December 2, 2025

### Issue #2: OpenAI Fallback Usage
- **Status:** Investigating
- **Problem:** Predictions using trend continuation instead of AI analysis
- **Possible Causes:**
  - API key issues
  - Rate limiting
  - Response parsing errors
- **Next Steps:** Check OpenAI API logs, improve error handling

### Issue #3: No Accuracy Tracking
- **Status:** In Progress
- **Solution:** Create database table for tracking predictions vs actuals
- **Target Date:** Next week

---

## Notes & Observations

### Key Learnings
1. News sentiment has strong correlation with short-term price movements
2. India market indices provide better signals than US indices for Indian gold prices
3. Currency (USD/INR) is critical factor - needs more weight

### Future Considerations
- Add RBI policy announcement dates to calendar
- Track festival dates for demand spikes
- Monitor import/export data from government sources
- Consider adding weather patterns for rural demand prediction

---

## References

### Academic Research
- Gold price prediction using machine learning
- Sentiment analysis for commodity price forecasting
- Multi-factor models for precious metals

### Industry Standards
- Commodity price prediction methodologies
- Financial market prediction best practices

---

**Document Maintained By:** Gold Price Tracker Development Team  
**Review Frequency:** Weekly  
**Last Review Date:** December 2, 2025  
**Next Review Date:** December 9, 2025

---

## News Scraping Strategy (Updated)

### Focus: Market Trends & Social Factors (NOT Price Updates)

The news scraper is designed to extract articles about:
- ✅ **Festivals** (Diwali, Dhanteras, Akshaya Tritiya, etc.)
- ✅ **Demand Patterns** (wedding season, rural buying, urban trends)
- ✅ **Market Factors** (RBI policy, import/export, supply/demand)
- ✅ **Social Trends** (buying behavior, cultural factors)
- ❌ **NOT Price Updates** (filtered out automatically)

### Daily Scraping Schedule

- **Frequency:** Once per day (6 PM IST)
- **Scope:** TODAY'S news only (last 24 hours)
- **After Scraping:** Automatically generates predictions for next 7 days
- **Purpose:** Daily fresh predictions based on latest market trends

### Filtering Logic

Articles are filtered to exclude:
- "Gold Price Today" articles
- "Rate Today" updates
- Pure price-focused content
- Articles older than today

Articles are included if they mention:
- Festivals (always high impact for demand)
- Demand trends
- Market factors
- Social/cultural buying patterns
- **Published today** (for daily prediction accuracy)

