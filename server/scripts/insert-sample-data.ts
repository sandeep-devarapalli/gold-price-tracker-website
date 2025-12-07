import dotenv from 'dotenv';
import pool from '../db/connection';

dotenv.config();

async function insertSampleData() {
  try {
    console.log('📊 Inserting sample gold price data...');
    
    // Generate sample prices for the last 7 days
    const basePrice = 75000; // 10g price in INR
    const today = new Date();
    
    const sampleData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Add some variation to prices
      const variation = (Math.random() - 0.5) * 2000; // ±1000 variation
      const price_10g = basePrice + variation;
      const price_1g = price_10g / 10;
      
      sampleData.push({
        price_10g: Math.round(price_10g * 100) / 100,
        price_1g: Math.round(price_1g * 100) / 100,
        city: 'India',
        source: 'sample_data',
        date: date
      });
    }
    
    // Insert each price
    for (const data of sampleData) {
      try {
        const query = `
          INSERT INTO gold_prices (price_10g, price_1g, city, source, timestamp)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (city, DATE(timestamp)) 
          DO UPDATE SET 
            price_10g = EXCLUDED.price_10g,
            price_1g = EXCLUDED.price_1g,
            timestamp = EXCLUDED.timestamp
        `;
        
        await pool.query(query, [
          data.price_10g,
          data.price_1g,
          data.city,
          data.source,
          data.date
        ]);
        
        console.log(`✅ Inserted: ₹${data.price_1g.toFixed(2)}/g (₹${data.price_10g.toFixed(2)}/10g) for ${data.date.toLocaleDateString()}`);
      } catch (error: any) {
        if (error.code === '23505') {
          console.log(`ℹ️  Data already exists for ${data.date.toLocaleDateString()}, skipping...`);
        } else {
          throw error;
        }
      }
    }
    
    console.log('✅ Sample data insertion completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to insert sample data:', error);
    process.exit(1);
  }
}

insertSampleData();

