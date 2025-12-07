# Setup Guide

Step-by-step instructions to set up the Gold Price Tracker application.

## Prerequisites

- Node.js 18+ (`node --version`)
- PostgreSQL 12+ (`psql --version`)
- npm (`npm --version`)

## Step 1: Install PostgreSQL

### macOS (Homebrew)

```bash
# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15
```

### macOS (PostgreSQL.app)

1. Download from [postgresapp.com](https://postgresapp.com)
2. Install and launch the app
3. Click "Initialize" to create a new server

### Docker (Alternative)

```bash
docker run --name gold-price-db \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=gold_price_tracker \
  -p 5432:5432 \
  -d postgres:15
```

## Step 2: Create the Database

```bash
# Connect to PostgreSQL
psql postgres

# Create the database
CREATE DATABASE gold_price_tracker;

# Verify it was created
\l

# Exit
\q
```

## Step 3: Install Dependencies

```bash
cd gold-price-tracker-website
npm install
```

## Step 4: Configure Environment

Create a `.env` file in the project root:

```bash
touch .env
```

Add the following content:

```env
# Database (update with your credentials)
DATABASE_URL=postgresql://your_username@localhost:5432/gold_price_tracker

# Server
PORT=3001
NODE_ENV=development

# Scraping Schedule (IST)
SCRAPE_SCHEDULE=0 11 * * *
SCRAPE_TIMEZONE=Asia/Kolkata

# API Keys (required)
FIRECRAWL_API_KEY=your_firecrawl_api_key
OPENAI_API_KEY=your_openai_api_key
```

**Finding your PostgreSQL username:**
```bash
whoami  # Usually your system username on macOS
```

**Common DATABASE_URL formats:**
- Without password: `postgresql://username@localhost:5432/gold_price_tracker`
- With password: `postgresql://username:password@localhost:5432/gold_price_tracker`

## Step 5: Run Database Migrations

```bash
npm run db:migrate
```

You should see: `Database migration completed successfully!`

## Step 6: Verify Setup

```bash
# Check tables were created
psql -d gold_price_tracker -c "\dt"
```

Expected tables:
- `gold_prices`
- `gold_news`
- `market_data`
- `bitcoin_prices`
- `gold_price_predictions`
- `prediction_accuracy_tracking`
- `price_alerts`
- `alert_history`
- `prediction_analysis`

## Step 7: Start the Application

```bash
# Option 1: Start both frontend and backend
npm run dev:all

# Option 2: Start separately
npm run dev:server  # Terminal 1 - Backend
npm run dev         # Terminal 2 - Frontend
```

## Step 8: Verify Everything Works

1. **Frontend**: http://localhost:3000
2. **Backend Health**: http://localhost:3001/health
3. **API Test**: 
   ```bash
   curl http://localhost:3001/api/prices/latest
   ```

## Step 9: Initial Data (Optional)

Trigger initial scrapes to populate data:

```bash
# Scrape gold price
curl -X POST http://localhost:3001/api/prices/scrape

# Scrape news
curl -X POST http://localhost:3001/api/news/scrape

# Scrape markets
curl -X POST http://localhost:3001/api/markets/scrape

# Scrape Bitcoin
curl -X POST http://localhost:3001/api/bitcoin/scrape

# Generate predictions
curl -X POST http://localhost:3001/api/predictions/generate \
  -H "Content-Type: application/json" \
  -d '{"days": 7}'
```

## Troubleshooting

### PostgreSQL Connection Issues

```bash
# Check if PostgreSQL is running
brew services list  # macOS with Homebrew
pg_isready          # General check

# Start PostgreSQL
brew services start postgresql@15
```

### Migration Errors

1. Verify database exists: `psql -l | grep gold_price_tracker`
2. Check DATABASE_URL in `.env`
3. Ensure PostgreSQL is running

### Port Already in Use

```bash
# Find process using port 3001
lsof -i :3001

# Kill the process or change PORT in .env
```

### API Key Issues

- Firecrawl: Get key from [firecrawl.dev](https://firecrawl.dev)
- OpenAI: Get key from [platform.openai.com](https://platform.openai.com)

## Next Steps

Once setup is complete:
- The frontend shows gold prices, news, and market data
- Scraping runs automatically per the schedule in `.env`
- AI predictions are generated after news scrapes
- Set price alerts to get notified of price changes

See [README.md](README.md) for full documentation.
