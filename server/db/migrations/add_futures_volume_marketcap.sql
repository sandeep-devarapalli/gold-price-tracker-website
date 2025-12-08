-- Migration: Add Gold Futures, Volume, and Market Cap Tables
-- Date: 2025-12-08

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

-- Comments for documentation
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

