# Testing Guide

Manual testing procedures for the Gold Price Tracker application.

## API Testing

### Health Check

```bash
curl http://localhost:3001/health
```

Expected: `{"status":"ok","timestamp":"..."}`

### Gold Prices

```bash
# Get latest price
curl http://localhost:3001/api/prices/latest

# Get historical data
curl http://localhost:3001/api/prices/history?days=7

# Get chart data
curl http://localhost:3001/api/prices/chart?range=5D

# Trigger scrape
curl -X POST http://localhost:3001/api/prices/scrape
```

### Predictions

```bash
# Get latest predictions
curl http://localhost:3001/api/predictions/latest

# Get AI analysis
curl http://localhost:3001/api/predictions/analysis

# Generate new predictions
curl -X POST http://localhost:3001/api/predictions/generate \
  -H "Content-Type: application/json" \
  -d '{"days": 7}'
```

### News

```bash
# Get latest news
curl http://localhost:3001/api/news/latest?limit=5

# Get today's news
curl http://localhost:3001/api/news/today

# Trigger news scrape
curl -X POST http://localhost:3001/api/news/scrape
```

### Markets

```bash
# Get US markets
curl http://localhost:3001/api/markets/us

# Get India markets
curl http://localhost:3001/api/markets/india

# Trigger market scrape
curl -X POST http://localhost:3001/api/markets/scrape
```

### Bitcoin

```bash
# Get latest Bitcoin price
curl http://localhost:3001/api/bitcoin/latest

# Get Bitcoin history
curl http://localhost:3001/api/bitcoin/history?days=7

# Trigger Bitcoin scrape
curl -X POST http://localhost:3001/api/bitcoin/scrape
```

### Alerts

```bash
# Create alert
curl -X POST http://localhost:3001/api/alerts \
  -H "Content-Type: application/json" \
  -d '{"alert_type": "above", "target_price": 13500}'

# Get all alerts
curl http://localhost:3001/api/alerts

# Delete alert
curl -X DELETE http://localhost:3001/api/alerts/1
```

### Accuracy

```bash
# Get accuracy metrics
curl http://localhost:3001/api/accuracy/metrics

# Get recent accuracy records
curl http://localhost:3001/api/accuracy/recent

# Validate predictions
curl -X POST http://localhost:3001/api/accuracy/validate
```

## Database Testing

### Connect to Database

```bash
psql -d gold_price_tracker
```

### Useful Queries

```sql
-- View latest gold prices
SELECT * FROM gold_prices ORDER BY timestamp DESC LIMIT 5;

-- Count records by table
SELECT 
  (SELECT COUNT(*) FROM gold_prices) as gold_prices,
  (SELECT COUNT(*) FROM gold_news) as news,
  (SELECT COUNT(*) FROM market_data) as markets,
  (SELECT COUNT(*) FROM bitcoin_prices) as bitcoin,
  (SELECT COUNT(*) FROM gold_price_predictions) as predictions,
  (SELECT COUNT(*) FROM price_alerts) as alerts;

-- View recent news with sentiment
SELECT title, source, sentiment, impact, published_at 
FROM gold_news 
ORDER BY created_at DESC 
LIMIT 10;

-- View latest predictions
SELECT predicted_date, predicted_price_1g, confidence 
FROM gold_price_predictions 
ORDER BY predicted_date DESC 
LIMIT 7;

-- View active alerts
SELECT * FROM price_alerts WHERE is_active = TRUE;

-- View prediction accuracy
SELECT prediction_date, predicted_price_1g, actual_price_1g, error_percentage, direction_correct
FROM prediction_accuracy_tracking 
WHERE validated_at IS NOT NULL
ORDER BY prediction_date DESC 
LIMIT 10;
```

## Frontend Testing

### Verify Components

1. **Live Price Card**: Shows current gold price with change indicator
2. **Price Chart**: Interactive chart with range selector (5D, 1M, 3M, 6M, 1Y)
3. **AI Recommendations**: Shows prediction analysis with sentiment
4. **Market News**: Displays recent news with sentiment badges
5. **Market Widget**: Shows US and India market indices
6. **Bitcoin Price**: Shows BTC price with currency toggle
7. **Price Alerts**: Create/delete price alerts
8. **Historical Data**: Table of historical prices

### Browser Console

Check for errors in browser developer tools (F12 > Console).

## Scheduled Tasks Testing

### Verify Scheduler is Running

Check backend logs for scheduler initialization:
```
Gold Price Scheduler: Initialized with schedule 0 11 * * *
News Scheduler (Morning): Initialized with schedule 5 11 * * *
...
```

### Manual Trigger All Scrapes

```bash
# Run all scrapes
curl -X POST http://localhost:3001/api/prices/scrape
curl -X POST http://localhost:3001/api/news/scrape
curl -X POST http://localhost:3001/api/markets/scrape
curl -X POST http://localhost:3001/api/bitcoin/scrape
curl -X POST http://localhost:3001/api/predictions/generate -H "Content-Type: application/json" -d '{"days": 7}'
```

## Troubleshooting

### No Data Showing

1. Check if backend is running: `curl http://localhost:3001/health`
2. Check database connection: `psql -d gold_price_tracker -c "SELECT 1"`
3. Trigger manual scrapes (see above)
4. Check backend logs for errors

### Scraping Failures

1. Verify Firecrawl API key in `.env`
2. Check backend logs for scraping errors
3. Test Firecrawl connection manually

### Prediction Errors

1. Verify OpenAI API key in `.env`
2. Check if news articles exist in database
3. Check backend logs for OpenAI errors

### Frontend Not Loading

1. Check if frontend is running on port 3000
2. Check browser console for errors
3. Verify backend API is accessible
