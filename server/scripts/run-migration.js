const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'gold_price_tracker'}`,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('📊 Running migration: Adding article_summaries column...');
    await client.query(`
      ALTER TABLE prediction_analysis 
      ADD COLUMN IF NOT EXISTS article_summaries JSONB;
    `);
    console.log('✅ Migration completed successfully!');
    
    // Verify the column exists
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'prediction_analysis' 
      AND column_name = 'article_summaries';
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Column verified: article_summaries exists');
    } else {
      console.log('⚠️  Warning: Column not found after migration');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
