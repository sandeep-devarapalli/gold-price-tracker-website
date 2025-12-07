import pool from '../db/connection';

async function migrateCityToCountry() {
  try {
    console.log('🔄 Migrating city column to country...');
    
    const client = await pool.connect();
    
    try {
      // Rename the column
      await client.query('ALTER TABLE gold_prices RENAME COLUMN city TO country;');
      console.log('✅ Renamed column: city → country');
      
      // Drop old indexes
      await client.query('DROP INDEX IF EXISTS idx_gold_prices_city;');
      await client.query('DROP INDEX IF EXISTS idx_gold_prices_city_timestamp;');
      await client.query('DROP INDEX IF EXISTS idx_gold_prices_unique_date;');
      console.log('✅ Dropped old indexes');
      
      // Create new indexes with country
      await client.query('CREATE INDEX IF NOT EXISTS idx_gold_prices_country ON gold_prices(country);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_gold_prices_country_timestamp ON gold_prices(country, timestamp DESC);');
      await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_gold_prices_unique_date ON gold_prices(country, DATE(timestamp));');
      console.log('✅ Created new indexes with country');
      
      // Update column comment
      await client.query(`COMMENT ON COLUMN gold_prices.country IS 'Country name where price was scraped (default: India)';`);
      console.log('✅ Updated column comment');
      
      console.log('✅ Migration completed successfully!');
    } finally {
      client.release();
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateCityToCountry();

