import pool from '../db/connection';
import dotenv from 'dotenv';

dotenv.config();

interface HistoricalPriceData {
  date: string; // YYYY-MM-DD format
  price_24k_1g: number;
  price_24k_10g: number;
  change: number;
}

// Historical gold price data from user
const historicalData: HistoricalPriceData[] = [
  { date: '2025-12-01', price_24k_1g: 13009.00, price_24k_10g: 130090.00, change: -10.00 },
  { date: '2025-11-30', price_24k_1g: 13010.00, price_24k_10g: 130100.00, change: 1350.00 },
  { date: '2025-11-29', price_24k_1g: 12875.00, price_24k_10g: 128750.00, change: 730.00 },
  { date: '2025-11-28', price_24k_1g: 12802.00, price_24k_10g: 128020.00, change: -180.00 },
  { date: '2025-11-27', price_24k_1g: 12820.00, price_24k_10g: 128200.00, change: 870.00 },
  { date: '2025-11-26', price_24k_1g: 12733.00, price_24k_10g: 127330.00, change: 1930.00 },
  { date: '2025-11-25', price_24k_1g: 12540.00, price_24k_10g: 125400.00, change: -710.00 },
  { date: '2025-11-24', price_24k_1g: 12611.00, price_24k_10g: 126110.00, change: -10.00 },
  { date: '2025-11-23', price_24k_1g: 12612.00, price_24k_10g: 126120.00, change: 1870.00 },
  { date: '2025-11-22', price_24k_1g: 12425.00, price_24k_10g: 124250.00, change: -280.00 },
  { date: '2025-11-21', price_24k_1g: 12453.00, price_24k_10g: 124530.00, change: 600.00 },
  { date: '2025-11-20', price_24k_1g: 12393.00, price_24k_10g: 123930.00, change: 0.00 },
  { date: '2025-11-19', price_24k_1g: 12393.00, price_24k_10g: 123930.00, change: -1760.00 },
  { date: '2025-11-18', price_24k_1g: 12569.00, price_24k_10g: 125690.00, change: 340.00 },
];

async function insertHistoricalPrices() {
  const client = await pool.connect();
  try {
    console.log('📊 Inserting historical gold price data...');
    
    let inserted = 0;
    let updated = 0;
    
    for (const priceData of historicalData) {
      const timestamp = new Date(priceData.date + 'T00:00:00');
      
      // Check if entry already exists
      const existing = await client.query(
        `SELECT id FROM gold_prices 
         WHERE country = 'India' AND DATE(timestamp) = $1`,
        [priceData.date]
      );
      
      if (existing.rows.length > 0) {
        // Update existing entry
        await client.query(
          `UPDATE gold_prices 
           SET price_10g = $1, price_1g = $2, timestamp = $3, source = 'historical_data'
           WHERE country = 'India' AND DATE(timestamp) = $4`,
          [
            priceData.price_24k_10g,
            priceData.price_24k_1g,
            timestamp,
            priceData.date
          ]
        );
        updated++;
        console.log(`✅ Updated ${priceData.date}: ₹${priceData.price_24k_1g.toFixed(2)}/g`);
      } else {
        // Insert new entry
        await client.query(
          `INSERT INTO gold_prices (price_10g, price_1g, country, timestamp, source)
           VALUES ($1, $2, 'India', $3, 'historical_data')`,
          [
            priceData.price_24k_10g,
            priceData.price_24k_1g,
            timestamp
          ]
        );
        inserted++;
        console.log(`✅ Inserted ${priceData.date}: ₹${priceData.price_24k_1g.toFixed(2)}/g`);
      }
    }
    
    console.log(`\n✅ Historical data import complete!`);
    console.log(`   Inserted: ${inserted} records`);
    console.log(`   Updated: ${updated} records`);
    console.log(`   Total: ${historicalData.length} records`);
    
  } catch (error) {
    console.error('❌ Error inserting historical prices:', error);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

insertHistoricalPrices();

