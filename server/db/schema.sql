-- Gold Price Tracker Database Schema

-- Create gold_prices table
CREATE TABLE IF NOT EXISTS gold_prices (
    id SERIAL PRIMARY KEY,
    price_10g DECIMAL(10, 2) NOT NULL,
    price_1g DECIMAL(10, 2) NOT NULL,
    country VARCHAR(100) DEFAULT 'India',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(50) DEFAULT 'google_search',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_gold_prices_timestamp ON gold_prices(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_gold_prices_country ON gold_prices(country);
CREATE INDEX IF NOT EXISTS idx_gold_prices_country_timestamp ON gold_prices(country, timestamp DESC);

-- Create unique index to prevent duplicate entries for the same day
CREATE UNIQUE INDEX IF NOT EXISTS idx_gold_prices_unique_date 
ON gold_prices(country, DATE(timestamp));

-- Comments for documentation
COMMENT ON TABLE gold_prices IS 'Stores historical gold prices scraped from Google Finance';
COMMENT ON COLUMN gold_prices.price_10g IS 'Price for 10 grams of 24k gold in INR';
COMMENT ON COLUMN gold_prices.price_1g IS 'Calculated price per gram (price_10g / 10)';
COMMENT ON COLUMN gold_prices.country IS 'Country name where price was scraped (default: India)';
COMMENT ON COLUMN gold_prices.timestamp IS 'When the price was scraped';
COMMENT ON COLUMN gold_prices.source IS 'Source of the price data (e.g., firecrawl_google_finance)';

-- Create gold_news table
CREATE TABLE IF NOT EXISTS gold_news (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    source VARCHAR(200) NOT NULL,
    url VARCHAR(1000),
    published_at TIMESTAMP,
    sentiment VARCHAR(20) DEFAULT 'neutral', -- positive, negative, neutral
    impact VARCHAR(20) DEFAULT 'low', -- high, medium, low
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for gold_news
CREATE INDEX IF NOT EXISTS idx_gold_news_published_at ON gold_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_gold_news_created_at ON gold_news(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gold_news_sentiment ON gold_news(sentiment);
CREATE INDEX IF NOT EXISTS idx_gold_news_impact ON gold_news(impact);

-- Create market_data table
CREATE TABLE IF NOT EXISTS market_data (
    id SERIAL PRIMARY KEY,
    market_type VARCHAR(20) NOT NULL, -- US or India
    index_name VARCHAR(100) NOT NULL, -- S&P 500, Dow Jones, NASDAQ, Nifty, Sensex
    value DECIMAL(15, 2) NOT NULL,
    change DECIMAL(15, 2) DEFAULT 0,
    percent_change DECIMAL(10, 4) DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for market_data
CREATE INDEX IF NOT EXISTS idx_market_data_timestamp ON market_data(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_market_data_market_type ON market_data(market_type);
CREATE INDEX IF NOT EXISTS idx_market_data_index_name ON market_data(index_name);
CREATE INDEX IF NOT EXISTS idx_market_data_market_timestamp ON market_data(market_type, timestamp DESC);

-- Create unique index to prevent duplicate entries for the same day
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_data_unique_date 
ON market_data(market_type, index_name, DATE(timestamp));

-- Create bitcoin_prices table
CREATE TABLE IF NOT EXISTS bitcoin_prices (
    id SERIAL PRIMARY KEY,
    price_usd DECIMAL(15, 2) NOT NULL,
    price_inr DECIMAL(15, 2) NOT NULL,
    change_24h DECIMAL(15, 2) DEFAULT 0,
    percent_change_24h DECIMAL(10, 4) DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for bitcoin_prices
CREATE INDEX IF NOT EXISTS idx_bitcoin_prices_timestamp ON bitcoin_prices(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bitcoin_prices_created_at ON bitcoin_prices(created_at DESC);

-- Create unique index to prevent duplicate entries for the same hour
CREATE UNIQUE INDEX IF NOT EXISTS idx_bitcoin_prices_unique_hour 
ON bitcoin_prices(DATE_TRUNC('hour', timestamp));

-- Create gold_price_predictions table
CREATE TABLE IF NOT EXISTS gold_price_predictions (
    id SERIAL PRIMARY KEY,
    predicted_date DATE NOT NULL,
    predicted_price_1g DECIMAL(10, 2) NOT NULL,
    predicted_price_10g DECIMAL(10, 2) NOT NULL,
    confidence DECIMAL(5, 2) DEFAULT 0, -- 0-100
    reasoning TEXT,
    factors JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(predicted_date)
);

-- Create indexes for gold_price_predictions
CREATE INDEX IF NOT EXISTS idx_gold_price_predictions_date ON gold_price_predictions(predicted_date DESC);
CREATE INDEX IF NOT EXISTS idx_gold_price_predictions_created_at ON gold_price_predictions(created_at DESC);

-- Create prediction_accuracy_tracking table
CREATE TABLE IF NOT EXISTS prediction_accuracy_tracking (
    id SERIAL PRIMARY KEY,
    prediction_date DATE NOT NULL,
    predicted_price_1g DECIMAL(10, 2) NOT NULL,
    actual_price_1g DECIMAL(10, 2),
    error_amount DECIMAL(10, 2),
    error_percentage DECIMAL(5, 2),
    absolute_error DECIMAL(10, 2),
    direction_correct BOOLEAN,
    confidence_score DECIMAL(5, 2),
    factors_used JSONB,
    model_version VARCHAR(20) DEFAULT '1.0',
    validated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(prediction_date)
);

-- Create index for accuracy tracking
CREATE INDEX IF NOT EXISTS idx_prediction_accuracy_date ON prediction_accuracy_tracking(prediction_date DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_accuracy_validated ON prediction_accuracy_tracking(validated_at DESC);

-- Create price_alerts table
CREATE TABLE IF NOT EXISTS price_alerts (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(10) NOT NULL, -- 'above' or 'below'
    target_price DECIMAL(10, 2) NOT NULL, -- Target price in INR/g
    is_active BOOLEAN DEFAULT TRUE,
    triggered BOOLEAN DEFAULT FALSE,
    triggered_at TIMESTAMP,
    triggered_price DECIMAL(10, 2), -- Price at which alert was triggered
    country VARCHAR(100) DEFAULT 'India',
    user_session_id VARCHAR(255), -- Optional: for multi-user support in future
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for price_alerts
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_price_alerts_triggered ON price_alerts(triggered);
CREATE INDEX IF NOT EXISTS idx_price_alerts_country ON price_alerts(country);
CREATE INDEX IF NOT EXISTS idx_price_alerts_created_at ON price_alerts(created_at DESC);

-- Create alert_history table to track alert triggers
CREATE TABLE IF NOT EXISTS alert_history (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER NOT NULL REFERENCES price_alerts(id) ON DELETE CASCADE,
    triggered_price DECIMAL(10, 2) NOT NULL,
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for alert_history
CREATE INDEX IF NOT EXISTS idx_alert_history_alert_id ON alert_history(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_triggered_at ON alert_history(triggered_at DESC);

-- Create prediction_analysis table to store analysis metadata
CREATE TABLE IF NOT EXISTS prediction_analysis (
    id SERIAL PRIMARY KEY,
    recommendation VARCHAR(10) NOT NULL, -- 'buy', 'hold', 'sell'
    confidence DECIMAL(5, 2) NOT NULL, -- 0-100
    market_sentiment VARCHAR(20) NOT NULL, -- 'bullish', 'bearish', 'neutral'
    news_sentiment DECIMAL(5, 2) NOT NULL, -- 0-100 percentage
    trend_analysis TEXT NOT NULL,
    key_factors JSONB NOT NULL,
    article_summaries JSONB, -- Key summary points extracted from articles
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for prediction_analysis
CREATE INDEX IF NOT EXISTS idx_prediction_analysis_created_at 
ON prediction_analysis(created_at DESC);

-- Create gold_futures table
CREATE TABLE IF NOT EXISTS gold_futures (
    id SERIAL PRIMARY KEY,
    exchange VARCHAR(50) NOT NULL, -- 'MCX' or 'COMEX'
    contract_symbol VARCHAR(50) NOT NULL, -- e.g., 'GOLD', 'GC'
    futures_price DECIMAL(15, 2) NOT NULL,
    spot_price DECIMAL(15, 2), -- For comparison
    trading_volume DECIMAL(15, 2), -- Number of contracts or tonnes
    open_interest DECIMAL(15, 2), -- Number of open contracts
    change DECIMAL(15, 2) DEFAULT 0,
    percent_change DECIMAL(10, 4) DEFAULT 0,
    expiry_date DATE, -- Contract expiry
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gold_futures_exchange ON gold_futures(exchange);
CREATE INDEX IF NOT EXISTS idx_gold_futures_timestamp ON gold_futures(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_gold_futures_exchange_timestamp ON gold_futures(exchange, timestamp DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gold_futures_unique_date 
ON gold_futures(exchange, contract_symbol, DATE(timestamp));

-- Add volume and market cap columns to gold_prices table
ALTER TABLE gold_prices ADD COLUMN IF NOT EXISTS trading_volume DECIMAL(15, 2);
ALTER TABLE gold_prices ADD COLUMN IF NOT EXISTS india_market_cap_usd DECIMAL(20, 2);
ALTER TABLE gold_prices ADD COLUMN IF NOT EXISTS global_market_cap_usd DECIMAL(20, 2);

-- Create gold_market_cap table
CREATE TABLE IF NOT EXISTS gold_market_cap (
    id SERIAL PRIMARY KEY,
    region VARCHAR(50) NOT NULL, -- 'India' or 'Global'
    market_cap_usd DECIMAL(20, 2) NOT NULL,
    gold_holdings_tonnes DECIMAL(15, 2), -- Total gold holdings
    source VARCHAR(200), -- e.g., 'RBI', 'World Gold Council'
    report_date DATE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gold_market_cap_region ON gold_market_cap(region);
CREATE INDEX IF NOT EXISTS idx_gold_market_cap_timestamp ON gold_market_cap(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_gold_market_cap_region_timestamp ON gold_market_cap(region, timestamp DESC);

-- Create gold_etfs table
CREATE TABLE IF NOT EXISTS gold_etfs (
    id SERIAL PRIMARY KEY,
    etf_name VARCHAR(100) NOT NULL, -- e.g., 'Nippon India Gold BeES', 'SBI Gold ETF'
    symbol VARCHAR(50) NOT NULL, -- e.g., 'GOLDBEES', 'SETFGOLD'
    exchange VARCHAR(20) NOT NULL, -- 'NSE' or 'BSE'
    nav_price DECIMAL(10, 2) NOT NULL, -- Net Asset Value per unit
    change DECIMAL(10, 2) DEFAULT 0,
    percent_change DECIMAL(10, 4) DEFAULT 0,
    aum_crore DECIMAL(15, 2), -- Assets Under Management in crores
    expense_ratio DECIMAL(5, 2), -- Expense ratio percentage
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gold_etfs_symbol ON gold_etfs(symbol);
CREATE INDEX IF NOT EXISTS idx_gold_etfs_timestamp ON gold_etfs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_gold_etfs_symbol_timestamp ON gold_etfs(symbol, timestamp DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gold_etfs_unique_date 
ON gold_etfs(symbol, DATE(timestamp));

-- Comments for new tables
COMMENT ON TABLE gold_news IS 'Stores gold-related news articles scraped from various sources';
COMMENT ON TABLE gold_etfs IS 'Stores daily Gold ETF prices from NSE/BSE (India)';
COMMENT ON COLUMN gold_etfs.etf_name IS 'Full name of the Gold ETF';
COMMENT ON COLUMN gold_etfs.symbol IS 'Trading symbol (e.g., GOLDBEES, SETFGOLD)';
COMMENT ON COLUMN gold_etfs.nav_price IS 'Net Asset Value per unit in INR';
COMMENT ON COLUMN gold_etfs.aum_crore IS 'Assets Under Management in crores';
COMMENT ON COLUMN gold_etfs.expense_ratio IS 'Expense ratio as percentage (e.g., 0.80 for 0.80%)';
COMMENT ON COLUMN gold_news.sentiment IS 'Sentiment analysis: positive, negative, or neutral';
COMMENT ON COLUMN gold_news.impact IS 'Expected impact on gold prices: high, medium, or low';
COMMENT ON TABLE market_data IS 'Stores US and India market indices data';
COMMENT ON TABLE bitcoin_prices IS 'Stores Bitcoin price history in USD and INR';
COMMENT ON TABLE gold_price_predictions IS 'Stores AI-generated gold price predictions based on market data and news';
COMMENT ON TABLE prediction_accuracy_tracking IS 'Tracks prediction accuracy by comparing predicted vs actual gold prices';
COMMENT ON TABLE price_alerts IS 'Stores user-created price alerts for gold prices';
COMMENT ON COLUMN price_alerts.alert_type IS 'Type of alert: above (price goes above target) or below (price goes below target)';
COMMENT ON COLUMN price_alerts.target_price IS 'Target price in INR per gram that triggers the alert';
COMMENT ON TABLE alert_history IS 'Stores history of when alerts were triggered';
COMMENT ON TABLE prediction_analysis IS 'Stores AI-generated prediction analysis metadata including recommendation, sentiment, and key factors';
COMMENT ON TABLE gold_futures IS 'Stores gold futures trading data from MCX (India) and COMEX (Global)';
COMMENT ON COLUMN gold_futures.exchange IS 'Exchange name: MCX (India) or COMEX (Global)';
COMMENT ON COLUMN gold_futures.contract_symbol IS 'Futures contract symbol (e.g., GOLD for MCX, GC for COMEX)';
COMMENT ON COLUMN gold_futures.futures_price IS 'Futures contract price';
COMMENT ON COLUMN gold_futures.spot_price IS 'Spot gold price for comparison (contango/backwardation)';
COMMENT ON COLUMN gold_futures.trading_volume IS 'Daily trading volume in contracts or tonnes';
COMMENT ON COLUMN gold_futures.open_interest IS 'Number of open contracts (indicator of market interest)';
COMMENT ON TABLE gold_market_cap IS 'Stores quarterly gold market cap data for India and Global markets';
COMMENT ON COLUMN gold_market_cap.region IS 'Region: India or Global';
COMMENT ON COLUMN gold_market_cap.market_cap_usd IS 'Total market capitalization in USD';
COMMENT ON COLUMN gold_market_cap.gold_holdings_tonnes IS 'Total gold holdings in metric tonnes';
COMMENT ON COLUMN gold_prices.trading_volume IS 'Daily trading volume for gold (from MCX/NCDEX)';
COMMENT ON COLUMN gold_prices.india_market_cap_usd IS 'India gold market cap in USD (updated quarterly)';
COMMENT ON COLUMN gold_prices.global_market_cap_usd IS 'Global gold market cap in USD (updated quarterly)';

