import pool from '../db/connection';

/**
 * Clear all old data from the database tables
 */
async function clearDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🗑️  Starting database cleanup...');
    
    // Clear gold_prices
    console.log('Clearing gold_prices table...');
    const goldResult = await client.query('DELETE FROM gold_prices');
    console.log(`✅ Deleted ${goldResult.rowCount} records from gold_prices`);
    
    // Clear market_data
    console.log('Clearing market_data table...');
    const marketResult = await client.query('DELETE FROM market_data');
    console.log(`✅ Deleted ${marketResult.rowCount} records from market_data`);
    
    // Clear bitcoin_prices
    console.log('Clearing bitcoin_prices table...');
    const bitcoinResult = await client.query('DELETE FROM bitcoin_prices');
    console.log(`✅ Deleted ${bitcoinResult.rowCount} records from bitcoin_prices`);
    
    // Clear gold_news (optional - keeping for now)
    console.log('Clearing gold_news table...');
    const newsResult = await client.query('DELETE FROM gold_news');
    console.log(`✅ Deleted ${newsResult.rowCount} records from gold_news`);
    
    console.log('');
    console.log('✅ Database cleanup completed successfully!');
    console.log('All old data has been removed. Ready for fresh scraping.');
    
  } catch (error) {
    console.error('❌ Database cleanup failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run cleanup
clearDatabase()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

