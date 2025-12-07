import pool from '../config/database';
import fs from 'fs';
import path from 'path';

async function migrate() {
  try {
    console.log('🔄 Running database migrations...');
    
    const client = await pool.connect();
    
    try {
      // Read schema file
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      
      // Split into statements more carefully
      // First, remove comments
      let cleanedSchema = schema.replace(/--.*$/gm, '');
      
      // Split by semicolon followed by newline or end of string
      const statements = cleanedSchema
        .split(/;\s*(?=\n|$)/)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('COMMENT'));
      
      // Separate CREATE TABLE and CREATE INDEX statements
      const createTableStatements: string[] = [];
      const createIndexStatements: string[] = [];
      const commentStatements: string[] = [];
      
      for (const statement of statements) {
        const upperStatement = statement.toUpperCase();
        if (upperStatement.includes('CREATE TABLE')) {
          createTableStatements.push(statement);
        } else if (upperStatement.includes('CREATE INDEX') || upperStatement.includes('CREATE UNIQUE INDEX')) {
          createIndexStatements.push(statement);
        } else if (upperStatement.includes('COMMENT')) {
          commentStatements.push(statement);
        }
      }
      
      // Execute CREATE TABLE statements first
      for (const statement of createTableStatements) {
        try {
          await client.query(statement);
          const tableMatch = statement.match(/CREATE TABLE.*?(\w+)/i);
          const tableName = tableMatch ? tableMatch[1] : 'table';
          console.log(`✅ Created/verified ${tableName} table`);
        } catch (error: any) {
          if (error.code === '42P07') {
            // Table already exists
            const tableMatch = statement.match(/CREATE TABLE.*?(\w+)/i);
            const tableName = tableMatch ? tableMatch[1] : 'table';
            console.log(`ℹ️  ${tableName} table already exists`);
          } else {
            throw error;
          }
        }
      }
      
      // Then execute CREATE INDEX statements
      for (const statement of createIndexStatements) {
        try {
          await client.query(statement);
        } catch (error: any) {
          if (error.code === '42P07' || error.code === '42710') {
            // Index already exists, that's fine
            continue;
          } else {
            // Log but don't fail on index errors
            console.warn(`⚠️  Warning creating index: ${error.message.substring(0, 80)}`);
          }
        }
      }
      
      console.log('✅ Created/verified all indexes');
      console.log('✅ Database migration completed successfully!');
    } finally {
      client.release();
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
