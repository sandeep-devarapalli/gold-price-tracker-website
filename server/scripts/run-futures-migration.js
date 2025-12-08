const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'gold_price_tracker'}`,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('📊 Running migration: Adding gold_futures and gold_market_cap tables...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../db/migrations/add_futures_volume_marketcap.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the tables exist
    const futuresCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'gold_futures';
    `);
    
    const marketCapCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'gold_market_cap';
    `);
    
    const columnsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'gold_prices' 
      AND column_name IN ('trading_volume', 'india_market_cap_usd', 'global_market_cap_usd');
    `);
    
    if (futuresCheck.rows.length > 0) {
      console.log('✅ Verified: gold_futures table exists');
    } else {
      console.log('⚠️  Warning: gold_futures table not found after migration');
    }
    
    if (marketCapCheck.rows.length > 0) {
      console.log('✅ Verified: gold_market_cap table exists');
    } else {
      console.log('⚠️  Warning: gold_market_cap table not found after migration');
    }
    
    if (columnsCheck.rows.length === 3) {
      console.log('✅ Verified: All columns added to gold_prices table');
    } else {
      console.log(`⚠️  Warning: Only ${columnsCheck.rows.length}/3 columns found in gold_prices table`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();

