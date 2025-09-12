#!/usr/bin/env ts-node

import { RealDatabaseService } from '../src/services/database/RealDatabaseService';
import * as fs from 'fs';
import * as path from 'path';

async function initDatabase() {
  console.log('Initializing database...');
  
  // Read database configuration from environment variables
  const dbConfig = {
    postgres: {
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME || 'ai_narrative_game',
      user: process.env.DATABASE_USER || 'app_user',
      password: process.env.DATABASE_PASSWORD || 'app_password',
      max: parseInt(process.env.DATABASE_POOL_MAX || '20'),
      idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '5000')
    }
  };

  // Add Redis configuration if available
  if (process.env.REDIS_HOST) {
    (dbConfig as any).redis = {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0')
    };
  }

  const dbService = new RealDatabaseService(dbConfig);
  
  try {
    // Connect to database
    await dbService.connect();
    console.log('Connected to database successfully');
    
    // Read and execute schema SQL
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      console.log('Executing schema SQL...');
      
      // Split SQL by semicolons and execute each statement
      const statements = schemaSql.split(';').filter(stmt => stmt.trim() !== '');
      for (const statement of statements) {
        if (statement.trim() !== '') {
          try {
            await dbService.query(statement.trim());
            console.log('Executed statement successfully');
          } catch (error) {
            console.warn('Failed to execute statement:', error);
          }
        }
      }
      
      console.log('Schema executed successfully');
    } else {
      console.warn('Schema file not found, skipping schema execution');
    }
    
    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
  } finally {
    try {
      await dbService.disconnect();
      console.log('Disconnected from database');
    } catch (error) {
      console.error('Error disconnecting from database:', error);
    }
  }
}

// Run the initialization
initDatabase().catch(console.error);