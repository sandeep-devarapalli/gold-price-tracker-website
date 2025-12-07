# Environment Configuration

## Required Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/gold_price_tracker

# Server Configuration
PORT=3001
NODE_ENV=development

# Scraping Schedule (cron format, IST timezone)
SCRAPE_SCHEDULE=0 11 * * *
SCRAPE_TIMEZONE=Asia/Kolkata

# News Scraping Schedule (optional overrides)
NEWS_SCRAPE_SCHEDULE_MORNING=5 11 * * *
NEWS_SCRAPE_SCHEDULE_EVENING=0 19 * * *

# Market Scraping Schedule (optional override)
MARKET_SCRAPE_SCHEDULE=0 16 * * *

# Bitcoin Scraping Schedule (optional override)
BITCOIN_SCRAPE_SCHEDULE=0 11 * * *

# Firecrawl API Configuration (required for scraping)
FIRECRAWL_API_KEY=your_firecrawl_api_key

# OpenAI API Configuration (required for predictions)
OPENAI_API_KEY=your_openai_api_key

# Optional: Run scrape on server startup (development only)
RUN_SCRAPE_ON_STARTUP=false
```

## Environment Variables Reference

### Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |

### Server

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3001 | Backend server port |
| `NODE_ENV` | No | development | Environment mode |

### Scraping Schedules

All schedules use cron format and run in the configured timezone.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SCRAPE_SCHEDULE` | No | `0 11 * * *` | Gold price scraping (11 AM daily) |
| `SCRAPE_TIMEZONE` | No | `Asia/Kolkata` | Timezone for all schedules |
| `NEWS_SCRAPE_SCHEDULE_MORNING` | No | `5 11 * * *` | Morning news scrape (11:05 AM) |
| `NEWS_SCRAPE_SCHEDULE_EVENING` | No | `0 19 * * *` | Evening news scrape (7 PM) |
| `MARKET_SCRAPE_SCHEDULE` | No | `0 16 * * *` | Market data scrape (4 PM) |
| `BITCOIN_SCRAPE_SCHEDULE` | No | `0 11 * * *` | Bitcoin price scrape (11 AM) |

### API Keys

| Variable | Required | Description |
|----------|----------|-------------|
| `FIRECRAWL_API_KEY` | Yes | Firecrawl API key for web scraping |
| `OPENAI_API_KEY` | Yes | OpenAI API key for AI predictions |

### Optional

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RUN_SCRAPE_ON_STARTUP` | No | false | Run initial scrape when server starts |

## Getting API Keys

### Firecrawl API Key
1. Go to [firecrawl.dev](https://firecrawl.dev)
2. Sign up for an account
3. Navigate to API Keys section
4. Copy your API key

### OpenAI API Key
1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Navigate to API Keys
4. Create a new secret key
5. Copy the key (it won't be shown again)

## Cron Schedule Format

The schedule uses standard cron format:

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-6, Sunday=0)
│ │ │ │ │
* * * * *
```

### Examples
- `0 11 * * *` - Daily at 11:00 AM
- `5 11 * * *` - Daily at 11:05 AM
- `0 19 * * *` - Daily at 7:00 PM
- `0 16 * * *` - Daily at 4:00 PM
- `0 */6 * * *` - Every 6 hours

## Development vs Production

### Development
```env
NODE_ENV=development
RUN_SCRAPE_ON_STARTUP=true
```

### Production
```env
NODE_ENV=production
RUN_SCRAPE_ON_STARTUP=false
```

In production:
- Use environment variables from your hosting platform
- Never commit `.env` file to version control
- Use a managed PostgreSQL database
- Configure proper monitoring for scheduled tasks
