# API Documentation

Complete API reference for the Gold Price Tracker backend.

## Base URL

- Development: `http://localhost:3001`
- All API endpoints are prefixed with `/api`

## Authentication

Currently, all endpoints are public. In production, consider adding authentication for write endpoints.

---

## Gold Prices

### Get Latest Price

Retrieve the most recent gold price with change information.

```http
GET /api/prices/latest?country=India
```

**Query Parameters:**
- `country` (optional): Country name (default: "India")

**Response:**
```json
{
  "price_1g": 13077.00,
  "price_10g": 130770.00,
  "country": "India",
  "timestamp": "2025-12-03T05:30:00.000Z",
  "change": 50.00,
  "percentChange": 0.38
}
```

### Get Historical Prices

```http
GET /api/prices/history?days=30&country=India
```

**Query Parameters:**
- `days` (optional): Number of days (1-365, default: 30)
- `country` (optional): Country name (default: "India")

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "price_1g": 13077.00,
      "price_10g": 130770.00,
      "country": "India",
      "timestamp": "2025-12-03T05:30:00.000Z"
    }
  ],
  "count": 30,
  "days": 30,
  "country": "India"
}
```

### Get Chart Data

```http
GET /api/prices/chart?range=5D&country=India
```

**Query Parameters:**
- `range` (required): `5D`, `1M`, `3M`, `6M`, `1Y`
- `country` (optional): Country name (default: "India")

**Response:**
```json
{
  "data": [
    {
      "date": "Dec 3",
      "price": 13077.00,
      "timestamp": "2025-12-03T05:30:00.000Z"
    }
  ],
  "range": "5D",
  "country": "India",
  "count": 5
}
```

### Get Price Statistics

```http
GET /api/prices/statistics?period=1M&country=India
```

**Query Parameters:**
- `period` (optional): `1D`, `1W`, `1M`, `3M`, `6M`, `1Y` (default: "1M")
- `country` (optional): Country name (default: "India")

**Response:**
```json
{
  "min": 12800.00,
  "max": 13200.00,
  "avg": 13000.00,
  "current": 13077.00,
  "change": 50.00,
  "percentChange": 0.38,
  "period": "1M",
  "country": "India"
}
```

### Trigger Manual Scrape

```http
POST /api/prices/scrape
```

**Response:**
```json
{
  "success": true,
  "message": "Price scraped and saved successfully",
  "data": {
    "price_1g": 13077.00,
    "price_10g": 130770.00,
    "country": "India",
    "timestamp": "2025-12-03T05:30:00.000Z"
  }
}
```

---

## Predictions

### Get Latest Predictions

```http
GET /api/predictions/latest?days=7
```

**Query Parameters:**
- `days` (optional): Number of days to fetch (default: 7)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "predicted_date": "2025-12-04",
      "predicted_price_1g": 13090.00,
      "predicted_price_10g": 130900.00,
      "confidence": 70,
      "reasoning": "Based on market trends and news sentiment",
      "factors": ["Fed rate expectations", "Festival demand"]
    }
  ],
  "count": 7
}
```

### Get Latest Analysis

```http
GET /api/predictions/analysis
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recommendation": "hold",
    "confidence": 70,
    "market_sentiment": "neutral",
    "news_sentiment": 67,
    "trend_analysis": "Stable trend with slight upward pressure",
    "key_factors": ["Fed policy", "USD strength", "Festival demand"],
    "article_summaries": [
      "Gold prices stabilizing amid Fed rate cut expectations",
      "Indian demand expected to rise during wedding season"
    ],
    "predictions": [...]
  }
}
```

### Generate New Predictions

```http
POST /api/predictions/generate
```

**Request Body:**
```json
{
  "days": 7
}
```

**Response:**
```json
{
  "success": true,
  "message": "Generated 7 predictions",
  "data": {
    "recommendation": "hold",
    "confidence": 70,
    "market_sentiment": "neutral",
    "news_sentiment": 67,
    "trend_analysis": "...",
    "key_factors": [...],
    "article_summaries": [...],
    "predictions": [...]
  }
}
```

---

## News

### Get Latest News

```http
GET /api/news/latest?limit=10
```

**Query Parameters:**
- `limit` (optional): Number of articles (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Gold prices rise amid Fed rate cut expectations",
      "content": "Gold prices increased today...",
      "source": "Reuters",
      "url": "https://...",
      "published_at": "2025-12-03T10:00:00.000Z",
      "sentiment": "positive",
      "impact": "high"
    }
  ],
  "count": 10
}
```

### Get Today's News

```http
GET /api/news/today?limit=20
```

**Query Parameters:**
- `limit` (optional): Number of articles (default: 20)

### Trigger News Scrape

```http
POST /api/news/scrape
```

**Response:**
```json
{
  "success": true,
  "message": "Scraped 15 news articles",
  "data": {
    "total": 15,
    "positive": 6,
    "negative": 3,
    "neutral": 6
  }
}
```

---

## Markets

### Get US Market Data

```http
GET /api/markets/us
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "market_type": "US",
      "index_name": "S&P 500",
      "value": 5998.74,
      "change": 14.77,
      "percent_change": 0.25,
      "timestamp": "2025-12-03T16:00:00.000Z"
    },
    {
      "market_type": "US",
      "index_name": "Dow Jones",
      "value": 44705.53,
      "change": 308.51,
      "percent_change": 0.69,
      "timestamp": "2025-12-03T16:00:00.000Z"
    },
    {
      "market_type": "US",
      "index_name": "NASDAQ",
      "value": 19480.91,
      "change": -17.30,
      "percent_change": -0.09,
      "timestamp": "2025-12-03T16:00:00.000Z"
    }
  ]
}
```

### Get India Market Data

```http
GET /api/markets/india
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "market_type": "India",
      "index_name": "Nifty 50",
      "value": 24467.45,
      "change": 31.15,
      "percent_change": 0.13,
      "timestamp": "2025-12-03T15:30:00.000Z"
    },
    {
      "market_type": "India",
      "index_name": "Sensex",
      "value": 80845.75,
      "change": 110.58,
      "percent_change": 0.14,
      "timestamp": "2025-12-03T15:30:00.000Z"
    }
  ]
}
```

### Trigger Market Scrape

```http
POST /api/markets/scrape
```

---

## Bitcoin

### Get Latest Bitcoin Price

```http
GET /api/bitcoin/latest
```

**Response:**
```json
{
  "success": true,
  "data": {
    "price_usd": 95500.00,
    "price_inr": 8050000.00,
    "change_24h": 1200.00,
    "percent_change_24h": 1.27,
    "timestamp": "2025-12-03T11:00:00.000Z"
  }
}
```

### Get Bitcoin History

```http
GET /api/bitcoin/history?days=7
```

**Query Parameters:**
- `days` (optional): Number of days (default: 7)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "price_usd": 95500.00,
      "price_inr": 8050000.00,
      "change_24h": 1200.00,
      "percent_change_24h": 1.27,
      "timestamp": "2025-12-03T11:00:00.000Z"
    }
  ],
  "count": 7
}
```

### Trigger Bitcoin Scrape

```http
POST /api/bitcoin/scrape
```

---

## Price Alerts

### Get All Alerts

```http
GET /api/alerts?active_only=true
```

**Query Parameters:**
- `active_only` (optional): Only return active alerts (default: false)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "alert_type": "above",
      "target_price": 13500.00,
      "is_active": true,
      "triggered": false,
      "triggered_at": null,
      "triggered_price": null,
      "country": "India",
      "created_at": "2025-12-03T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

### Create Alert

```http
POST /api/alerts
```

**Request Body:**
```json
{
  "alert_type": "above",
  "target_price": 13500.00,
  "country": "India"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Alert created successfully",
  "data": {
    "id": 1,
    "alert_type": "above",
    "target_price": 13500.00,
    "is_active": true,
    "country": "India"
  }
}
```

### Delete Alert

```http
DELETE /api/alerts/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Alert deleted successfully"
}
```

### Get Triggered Alerts

```http
GET /api/alerts/triggered
```

---

## Accuracy Tracking

### Get Accuracy Metrics

```http
GET /api/accuracy/metrics?days=30
```

**Query Parameters:**
- `days` (optional): Number of days to analyze (default: 30)

**Response:**
```json
{
  "success": true,
  "data": {
    "total_predictions": 30,
    "validated_predictions": 25,
    "mean_absolute_error": 45.50,
    "mean_absolute_percentage_error": 0.35,
    "root_mean_square_error": 52.30,
    "direction_accuracy": 72.00,
    "within_1_percent": 85.00,
    "within_2_percent": 96.00
  }
}
```

### Get Recent Accuracy Records

```http
GET /api/accuracy/recent?limit=10
```

**Query Parameters:**
- `limit` (optional): Number of records (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "prediction_date": "2025-12-02",
      "predicted_price_1g": 13050.00,
      "actual_price_1g": 13077.00,
      "error_amount": 27.00,
      "error_percentage": 0.21,
      "direction_correct": true
    }
  ],
  "count": 10
}
```

### Validate Predictions

```http
POST /api/accuracy/validate
```

Validates all unvalidated predictions against actual prices.

---

## Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-03T11:00:00.000Z"
}
```

---

## Data Models

### GoldPrice
```typescript
{
  id: number;
  price_10g: number;      // Price for 10 grams in INR
  price_1g: number;       // Price per gram
  country: string;        // Country name (e.g., "India")
  timestamp: string;      // ISO 8601 timestamp
  source: string;         // Data source
}
```

### NewsArticle
```typescript
{
  id: number;
  title: string;
  content: string;
  source: string;
  url: string;
  published_at: string | null;
  sentiment: 'positive' | 'negative' | 'neutral';
  impact: 'high' | 'medium' | 'low';
}
```

### MarketData
```typescript
{
  market_type: 'US' | 'India';
  index_name: string;
  value: number;
  change: number;
  percent_change: number;
  timestamp: string;
}
```

### BitcoinPrice
```typescript
{
  price_usd: number;
  price_inr: number;
  change_24h: number;
  percent_change_24h: number;
  timestamp: string;
}
```

### PriceAlert
```typescript
{
  id: number;
  alert_type: 'above' | 'below';
  target_price: number;
  is_active: boolean;
  triggered: boolean;
  triggered_at: string | null;
  triggered_price: number | null;
  country: string;
}
```

### PredictionAnalysis
```typescript
{
  recommendation: 'buy' | 'hold' | 'sell';
  confidence: number;        // 0-100
  market_sentiment: 'bullish' | 'bearish' | 'neutral';
  news_sentiment: number;    // 0-100
  trend_analysis: string;
  key_factors: string[];
  article_summaries: string[];
  predictions: PricePrediction[];
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable error message"
}
```

Common HTTP status codes:
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

---

## Notes

- All prices are in INR (Indian Rupees)
- Gold prices are for 24k gold (99.9% purity)
- Timestamps are in UTC (ISO 8601 format)
- The API uses PostgreSQL for data storage
- Scraping runs automatically via cron scheduler
