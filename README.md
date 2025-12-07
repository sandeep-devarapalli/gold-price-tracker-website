# Gold Price Tracker

A comprehensive gold price tracking and prediction platform for India. Features real-time price monitoring, AI-powered price predictions using OpenAI, market news analysis, and price alerts.

## Features

- **Live Gold Prices** - Real-time gold prices (1g and 10g) in INR for India
- **AI Price Predictions** - 7-day price forecasts using OpenAI GPT-4o-mini
- **Market News Analysis** - Automated news scraping with sentiment analysis
- **Price Alerts** - Set custom alerts for price thresholds
- **Market Tracking** - US markets (S&P 500, Dow, NASDAQ) and India markets (Nifty, Sensex)
- **Bitcoin Tracking** - Bitcoin prices in USD and INR
- **Interactive Charts** - Price trends visualization using Highcharts
- **Historical Data** - View price history from 5 days to 1 year

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for building
- Tailwind CSS for styling
- Highcharts for data visualization
- Radix UI components
- Lucide React icons

### Backend
- Node.js with Express
- TypeScript
- PostgreSQL for data storage
- Firecrawl SDK for web scraping
- OpenAI API for predictions and analysis
- node-cron for scheduled tasks

## Prerequisites

- Node.js 18+
- PostgreSQL 12+
- Firecrawl API key (get from [firecrawl.dev](https://firecrawl.dev))
- OpenAI API key (get from [platform.openai.com](https://platform.openai.com))

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd gold-price-tracker-website
npm install
```

### 2. Set Up PostgreSQL

```sql
CREATE DATABASE gold_price_tracker;
```

### 3. Configure Environment

Create a `.env` file in the root directory:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/gold_price_tracker
PORT=3001
NODE_ENV=development
SCRAPE_SCHEDULE=0 11 * * *
SCRAPE_TIMEZONE=Asia/Kolkata
FIRECRAWL_API_KEY=your_firecrawl_api_key
OPENAI_API_KEY=your_openai_api_key
```

See [ENV_SETUP.md](ENV_SETUP.md) for detailed configuration options.

### 4. Run Database Migrations

```bash
npm run db:migrate
```

### 5. Start the Application

```bash
# Start both frontend and backend
npm run dev:all

# Or start separately:
npm run dev:server  # Backend on port 3001
npm run dev         # Frontend on port 3000
```

Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/health

## Daily Scraping Schedule

All times are in IST (Asia/Kolkata):

| Time | Task | Description |
|------|------|-------------|
| 11:00 AM | Gold Price | Scrapes current gold price from MoneyControl/Google Finance |
| 11:00 AM | Bitcoin | Scrapes Bitcoin price from Google Finance |
| 11:05 AM | News (Morning) | Scrapes gold-related news + generates AI predictions |
| 4:00 PM | Markets | Scrapes US and India market indices |
| 7:00 PM | News (Evening) | Scrapes gold-related news + updates predictions |

## API Endpoints

### Gold Prices
- `GET /api/prices/latest` - Get latest gold price
- `GET /api/prices/history?days=30` - Get historical prices
- `GET /api/prices/chart?range=5D` - Get chart data (5D, 1M, 3M, 6M, 1Y)
- `POST /api/prices/scrape` - Trigger manual scrape

### Predictions
- `GET /api/predictions/latest` - Get latest predictions
- `GET /api/predictions/analysis` - Get AI analysis metadata
- `POST /api/predictions/generate` - Generate new predictions

### News
- `GET /api/news/latest` - Get latest news articles
- `GET /api/news/today` - Get today's news
- `POST /api/news/scrape` - Trigger news scrape

### Markets
- `GET /api/markets/us` - Get US market data
- `GET /api/markets/india` - Get India market data
- `POST /api/markets/scrape` - Trigger market scrape

### Bitcoin
- `GET /api/bitcoin/latest` - Get latest Bitcoin price
- `GET /api/bitcoin/history` - Get Bitcoin price history
- `POST /api/bitcoin/scrape` - Trigger Bitcoin scrape

### Alerts
- `GET /api/alerts` - Get all alerts
- `POST /api/alerts` - Create new alert
- `DELETE /api/alerts/:id` - Delete alert

### Accuracy Tracking
- `GET /api/accuracy/metrics` - Get prediction accuracy metrics
- `GET /api/accuracy/recent` - Get recent accuracy records

See [API_DOCS.md](API_DOCS.md) for complete API documentation.

## Project Structure

```
gold-price-tracker-website/
├── server/                     # Backend server
│   ├── db/                     # Database schema and migrations
│   ├── routes/                 # API route handlers
│   │   ├── prices.ts          # Gold price endpoints
│   │   ├── predictions.ts     # AI prediction endpoints
│   │   ├── news.ts            # News endpoints
│   │   ├── markets.ts         # Market data endpoints
│   │   ├── bitcoin.ts         # Bitcoin endpoints
│   │   ├── alerts.ts          # Price alert endpoints
│   │   └── accuracy.ts        # Accuracy tracking endpoints
│   ├── services/              # Business logic
│   │   ├── scraper.ts         # Gold price scraping
│   │   ├── newsScraper.ts     # News scraping with sentiment
│   │   ├── marketScraper.ts   # Market data scraping
│   │   ├── bitcoinScraper.ts  # Bitcoin scraping
│   │   ├── predictionService.ts # AI predictions
│   │   ├── alertService.ts    # Alert management
│   │   ├── firecrawlService.ts # Firecrawl wrapper
│   │   └── scheduler.ts       # Cron job scheduler
│   └── index.ts               # Express server entry point
├── src/                        # Frontend React application
│   ├── components/            # React components
│   │   ├── LivePriceCard.tsx  # Current price display
│   │   ├── PriceChart.tsx     # Price chart with Highcharts
│   │   ├── AIRecommendations.tsx # AI analysis display
│   │   ├── MarketNews.tsx     # News feed
│   │   ├── MarketWidget.tsx   # Market indices
│   │   ├── BitcoinPrice.tsx   # Bitcoin tracker
│   │   ├── PriceAlerts.tsx    # Alert management
│   │   └── HistoricalData.tsx # Historical prices table
│   ├── services/api.ts        # API client
│   └── utils/                 # Utility functions
├── GOLD_PRICE_PREDICTION_FACTORS.md # Prediction methodology
└── package.json
```

## AI Prediction System

The prediction system uses OpenAI GPT-4o-mini to analyze:
- Historical gold prices (last 30 days)
- US and India market indices
- News sentiment (positive/negative/neutral)
- Festival seasons and demand patterns

Predictions include:
- 7-day price forecasts
- Buy/Hold/Sell recommendation
- Confidence scores
- Key market insights

See [GOLD_PRICE_PREDICTION_FACTORS.md](GOLD_PRICE_PREDICTION_FACTORS.md) for detailed methodology.

## Scripts

```bash
npm run dev           # Start frontend dev server
npm run dev:server    # Start backend dev server
npm run dev:all       # Start both frontend and backend
npm run build         # Build for production
npm run db:migrate    # Run database migrations
npm run scrape:manual # Trigger manual gold price scrape
npm run validate:predictions # Validate prediction accuracy
```

## Troubleshooting

### Database Connection Issues
1. Verify PostgreSQL is running: `pg_isready`
2. Check `DATABASE_URL` in `.env`
3. Ensure database exists: `psql -l | grep gold_price_tracker`

### API Not Responding
1. Check if backend is running on port 3001
2. Verify health endpoint: `curl http://localhost:3001/health`
3. Check backend logs for errors

### Scraping Issues
1. Verify Firecrawl API key is valid
2. Check backend logs for scraping errors
3. Manually trigger scrape: `curl -X POST http://localhost:3001/api/prices/scrape`

## License

Copyright © 2025 Gold Price Tracker

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request
