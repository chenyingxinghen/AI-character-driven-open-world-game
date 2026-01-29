#!/usr/bin/env ts-node

/**
 * 数据库初始化脚本
 * 
 * 此脚本负责：
 * 1. 检查数据库连接
 * 2. 创建必要的数据库和表
 * 3. 初始化基础数据
 * 4. 验证数据库设置
 */

import { Client } from 'pg';
import { createClient } from 'redis';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
  success: (message: string, ...args: any[]) => console.log(`[SUCCESS] ✓ ${message}`, ...args)
};

/**
 * 数据库配置
 */
const dbConfig = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'ai_narrative_game',
  user: process.env.DATABASE_USER || 'app_user',
  password: process.env.DATABASE_PASSWORD || 'app_password',
  connectionTimeoutMillis: 10000
};

/**
 * Redis配置
 */
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  database: parseInt(process.env.REDIS_DB || '0')
};

/**
 * 检查PostgreSQL连接
 */
async function checkPostgresConnection(): Promise<boolean> {
  logger.info('检查PostgreSQL连接...');

  const client = new Client({ ...dbConfig, database: 'postgres' });

  try {
    await client.connect();
    const result = await client.query('SELECT NOW() as current_time');
    logger.success(`PostgreSQL连接成功: ${result.rows[0].current_time}`);
    return true;
  } catch (error) {
    logger.error('PostgreSQL连接失败:', (error as Error).message);
    return false;
  } finally {
    await client.end();
  }
}

/**
 * 检查Redis连接
 */
async function checkRedisConnection(): Promise<boolean> {
  if (!process.env.REDIS_HOST) {
    logger.info('Redis配置未提供，跳过Redis检查');
    return true;
  }

  logger.info('检查Redis连接...');

  const client = createClient({
    socket: {
      host: redisConfig.host,
      port: redisConfig.port
    },
    password: redisConfig.password,
    database: redisConfig.database
  });

  try {
    await client.connect();
    await client.ping();
    logger.success('Redis连接成功');
    return true;
  } catch (error) {
    logger.error('Redis连接失败:', (error as Error).message);
    return false;
  } finally {
    await client.disconnect();
  }
}

/**
 * 创建数据库（如果不存在）
 */
async function createDatabaseIfNotExists(): Promise<boolean> {
  logger.info('检查并创建数据库...');

  // 连接到postgres数据库来创建目标数据库
  const adminClient = new Client({
    ...dbConfig,
    database: 'postgres' // 连接到默认的postgres数据库
  });

  try {
    await adminClient.connect();

    // 检查数据库是否存在
    const checkResult = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbConfig.database]
    );

    if (checkResult.rows.length === 0) {
      // 数据库不存在，创建它
      logger.info(`创建数据库: ${dbConfig.database}`);
      await adminClient.query(`CREATE DATABASE \"${dbConfig.database}\"`);
      logger.success(`数据库 ${dbConfig.database} 创建成功`);
    } else {
      logger.info(`数据库 ${dbConfig.database} 已存在`);
    }

    return true;
  } catch (error) {
    logger.error('创建数据库失败:', (error as Error).message);
    return false;
  } finally {
    await adminClient.end();
  }
}

/**
 * 执行SQL脚本
 */
async function executeSqlScript(scriptPath: string): Promise<boolean> {
  logger.info(`执行SQL脚本: ${scriptPath}`);

  if (!fs.existsSync(scriptPath)) {
    logger.error(`SQL脚本文件不存在: ${scriptPath}`);
    return false;
  }

  const client = new Client(dbConfig);

  try {
    await client.connect();

    // 按照正确的依赖顺序定义表创建语句
    // 1. 首先创建无依赖的表
    const createGameSessions = `
      CREATE TABLE IF NOT EXISTS game_sessions (
          id VARCHAR(36) PRIMARY KEY,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          player_id VARCHAR(36),
          game_state JSONB,
          is_active BOOLEAN DEFAULT true
      );
    `;

    // 2. 然后创建依赖game_sessions的表
    const createCharacters = `
      CREATE TABLE IF NOT EXISTS characters (
          id VARCHAR(36) PRIMARY KEY,
          session_id VARCHAR(36) REFERENCES game_sessions(id),
          name VARCHAR(100) NOT NULL,
          personality JSONB,
          background TEXT,
          current_location VARCHAR(100),
          emotional_state JSONB,
          is_active BOOLEAN DEFAULT true,
          character_data JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 3. 创建其他依赖表
    const createDependentTables = `
      CREATE TABLE IF NOT EXISTS character_memories (
          id VARCHAR(36) PRIMARY KEY,
          character_id VARCHAR(36) REFERENCES characters(id),
          session_id VARCHAR(36) REFERENCES game_sessions(id),
          content TEXT NOT NULL,
          emotional_weight NUMERIC(3,2),
          associated_characters TEXT[],
          tags TEXT[],
          memory_type VARCHAR(20) CHECK (memory_type IN ('dialogue', 'observation', 'action')),
          significance INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS conversations (
          id VARCHAR(36) PRIMARY KEY,
          session_id VARCHAR(36) REFERENCES game_sessions(id),
          character_id VARCHAR(36) REFERENCES characters(id),
          message_type VARCHAR(20) CHECK (message_type IN ('player_input', 'character_response', 'narration', 'system_message')),
          content TEXT NOT NULL,
          context JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS character_relationships (
          id VARCHAR(36) PRIMARY KEY,
          character_id VARCHAR(36) REFERENCES characters(id),
          target_character_id VARCHAR(36) REFERENCES characters(id),
          relationship_type VARCHAR(50),
          strength NUMERIC(3,2),
          relationship_data JSONB,
          session_id VARCHAR(36) REFERENCES game_sessions(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS locations (
          id VARCHAR(100) PRIMARY KEY,
          name VARCHAR(200) NOT NULL,
          description TEXT,
          location_type VARCHAR(50),
          region_id VARCHAR(100),
          position_x NUMERIC(10,2),
          position_y NUMERIC(10,2),
          location_data JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS world_lore (
          id VARCHAR(36) PRIMARY KEY,
          session_id VARCHAR(36) REFERENCES game_sessions(id) ON DELETE CASCADE,
          lore_type VARCHAR(50) NOT NULL,
          title VARCHAR(200) NOT NULL,
          content TEXT NOT NULL,
          inspiration TEXT,
          generation_seed VARCHAR(100),
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS story_events (
          id VARCHAR(36) PRIMARY KEY,
          session_id VARCHAR(36) REFERENCES game_sessions(id),
          event_type VARCHAR(50),
          description TEXT,
          location VARCHAR(100),
          involved_characters TEXT[],
          impact_level INTEGER,
          story_data JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS game_mode_sessions (
          id VARCHAR(36) PRIMARY KEY,
          session_id VARCHAR(36) REFERENCES game_sessions(id) ON DELETE CASCADE,
          mode_type VARCHAR(20) CHECK (mode_type IN ('free', 'script')) NOT NULL,
          config JSONB NOT NULL,
          state JSONB NOT NULL,
          player_id VARCHAR(36) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS story_outlines (
          id VARCHAR(36) PRIMARY KEY,
          title VARCHAR(200) NOT NULL,
          genre VARCHAR(50) NOT NULL,
          summary TEXT,
          acts JSONB NOT NULL,
          characters JSONB,
          locations JSONB,
          themes TEXT[],
          estimated_duration INTEGER,
          tags TEXT[],
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS story_progress (
          id VARCHAR(36) PRIMARY KEY,
          session_id VARCHAR(36) REFERENCES game_mode_sessions(id) ON DELETE CASCADE,
          story_outline_id VARCHAR(36) REFERENCES story_outlines(id),
          current_act INTEGER DEFAULT 1,
          completed_plot_points TEXT[],
          completion_percentage NUMERIC(5,2) DEFAULT 0,
          story_variables JSONB,
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS deviation_records (
          id VARCHAR(36) PRIMARY KEY,
          session_id VARCHAR(36) REFERENCES game_mode_sessions(id) ON DELETE CASCADE,
          player_action TEXT NOT NULL,
          expected_action TEXT NOT NULL,
          deviation_score NUMERIC(5,2) NOT NULL,
          current_plot_point VARCHAR(36),
          impact VARCHAR(20) CHECK (impact IN ('minor', 'moderate', 'major', 'critical')),
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS intervention_records (
          id VARCHAR(36) PRIMARY KEY,
          session_id VARCHAR(36) REFERENCES game_mode_sessions(id) ON DELETE CASCADE,
          intervention_type VARCHAR(50) NOT NULL,
          intensity VARCHAR(20) CHECK (intensity IN ('none', 'subtle', 'moderate', 'strong', 'forced')),
          trigger_reason TEXT,
          outcome VARCHAR(30) CHECK (outcome IN ('successful', 'partially_successful', 'failed')),
          effectiveness NUMERIC(5,2),
          player_reaction TEXT,
          notes TEXT,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS director_controllers (
          id VARCHAR(36) PRIMARY KEY,
          session_id VARCHAR(36) REFERENCES game_mode_sessions(id) ON DELETE CASCADE,
          intervention_level INTEGER CHECK (intervention_level >= 0 AND intervention_level <= 100),
          deviation_tolerance INTEGER CHECK (deviation_tolerance >= 0 AND deviation_tolerance <= 100),
          total_interventions INTEGER DEFAULT 0,
          successful_interventions INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          cooldown_data JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS dynamic_content_cache (
          id VARCHAR(36) PRIMARY KEY,
          session_id VARCHAR(36) REFERENCES game_mode_sessions(id) ON DELETE CASCADE,
          content_type VARCHAR(50) NOT NULL,
          cache_key VARCHAR(200) NOT NULL,
          content_data JSONB NOT NULL,
          usage_count INTEGER DEFAULT 0,
          last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(session_id, cache_key)
      );

      CREATE TABLE IF NOT EXISTS story_outlines_generated (
          id VARCHAR(36) PRIMARY KEY,
          session_id VARCHAR(36) REFERENCES game_sessions(id) ON DELETE CASCADE,
          world_lore_ids TEXT[],
          story_outline JSONB NOT NULL,
          core_elements JSONB NOT NULL,
          context_mapping JSONB NOT NULL,
          validation_report JSONB NOT NULL,
          generation_params JSONB,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS initial_scene_packages (
          id VARCHAR(36) PRIMARY KEY,
          session_id VARCHAR(36) REFERENCES game_sessions(id) ON DELETE CASCADE,
          story_outline_id VARCHAR(36) REFERENCES story_outlines_generated(id),
          starting_location JSONB NOT NULL,
          nearby_characters JSONB NOT NULL,
          immersive_description TEXT NOT NULL,
          player_guidance JSONB NOT NULL,
          environment_details JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS director_guidance_records (
          id VARCHAR(36) PRIMARY KEY,
          session_id VARCHAR(36) REFERENCES game_sessions(id) ON DELETE CASCADE,
          story_outline_id VARCHAR(36) REFERENCES story_outlines_generated(id),
          current_plot_point VARCHAR(100),
          guidance_type VARCHAR(50) NOT NULL,
          guidance_content TEXT NOT NULL,
          player_deviation_score NUMERIC(5,2) DEFAULT 0,
          effectiveness_score NUMERIC(5,2),
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 4. 创建索引语句
    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_characters_session_id ON characters(session_id);
      CREATE INDEX IF NOT EXISTS idx_character_memories_character_id ON character_memories(character_id);
      CREATE INDEX IF NOT EXISTS idx_character_memories_session_id ON character_memories(session_id);
      CREATE INDEX IF NOT EXISTS idx_character_memories_created_at ON character_memories(created_at);
      CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_character_id ON conversations(character_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
      CREATE INDEX IF NOT EXISTS idx_character_relationships_character_id ON character_relationships(character_id);
      CREATE INDEX IF NOT EXISTS idx_character_relationships_session_id ON character_relationships(session_id);
      CREATE INDEX IF NOT EXISTS idx_story_events_session_id ON story_events(session_id);
      CREATE INDEX IF NOT EXISTS idx_story_events_created_at ON story_events(created_at);
      CREATE INDEX IF NOT EXISTS idx_locations_type ON locations(location_type);
      CREATE INDEX IF NOT EXISTS idx_locations_region ON locations(region_id);
      CREATE INDEX IF NOT EXISTS idx_world_lore_session_id ON world_lore(session_id);
      CREATE INDEX IF NOT EXISTS idx_world_lore_type ON world_lore(lore_type);
      CREATE INDEX IF NOT EXISTS idx_game_mode_sessions_session_id ON game_mode_sessions(session_id);
      CREATE INDEX IF NOT EXISTS idx_game_mode_sessions_mode_type ON game_mode_sessions(mode_type);
      CREATE INDEX IF NOT EXISTS idx_story_outlines_genre ON story_outlines(genre);
      CREATE INDEX IF NOT EXISTS idx_story_progress_session_id ON story_progress(session_id);
      CREATE INDEX IF NOT EXISTS idx_story_progress_story_outline_id ON story_progress(story_outline_id);
      CREATE INDEX IF NOT EXISTS idx_deviation_records_session_id ON deviation_records(session_id);
      CREATE INDEX IF NOT EXISTS idx_deviation_records_created_at ON deviation_records(created_at);
      CREATE INDEX IF NOT EXISTS idx_intervention_records_session_id ON intervention_records(session_id);
      CREATE INDEX IF NOT EXISTS idx_intervention_records_applied_at ON intervention_records(applied_at);
      CREATE INDEX IF NOT EXISTS idx_director_controllers_session_id ON director_controllers(session_id);
      CREATE INDEX IF NOT EXISTS idx_dynamic_content_cache_session_id ON dynamic_content_cache(session_id);
      CREATE INDEX IF NOT EXISTS idx_dynamic_content_cache_content_type ON dynamic_content_cache(content_type);
      CREATE INDEX IF NOT EXISTS idx_story_outlines_generated_session_id ON story_outlines_generated(session_id);
      CREATE INDEX IF NOT EXISTS idx_story_outlines_generated_created_at ON story_outlines_generated(created_at);
      CREATE INDEX IF NOT EXISTS idx_initial_scene_packages_session_id ON initial_scene_packages(session_id);
      CREATE INDEX IF NOT EXISTS idx_initial_scene_packages_story_outline_id ON initial_scene_packages(story_outline_id);
      CREATE INDEX IF NOT EXISTS idx_director_guidance_records_session_id ON director_guidance_records(session_id);
      CREATE INDEX IF NOT EXISTS idx_director_guidance_records_story_outline_id ON director_guidance_records(story_outline_id);
      CREATE INDEX IF NOT EXISTS idx_director_guidance_records_applied_at ON director_guidance_records(applied_at);
    `;

    // 按正确顺序执行语句
    const statements = [
      createGameSessions,
      createCharacters,
      createDependentTables,
      createIndexes
    ];

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await client.query(statement);
        } catch (error) {
          // 忽略已存在的错误
          if (!(error as Error).message.includes('already exists')) {
            logger.warn(`执行SQL语句时出现警告: ${(error as Error).message}`);
            logger.warn(`语句: ${statement.substring(0, 100)}...`);
          }
        }
      }
    }

    logger.success('SQL脚本执行完成');
    return true;
  } catch (error) {
    logger.error('执行SQL脚本失败:', (error as Error).message);
    return false;
  } finally {
    await client.end();
  }
}

/**
 * 验证数据库表结构
 */
async function validateTables(): Promise<boolean> {
  logger.info('验证数据库表结构...');

  const client = new Client(dbConfig);

  try {
    await client.connect();

    const expectedTables = [
      'game_sessions',
      'characters',
      'character_memories',
      'conversations',
      'character_relationships',
      'locations',
      'world_lore',
      'story_events',
      'game_mode_sessions',
      'story_outlines',
      'story_progress',
      'deviation_records',
      'intervention_records',
      'director_controllers',
      'dynamic_content_cache',
      'story_outlines_generated',
      'initial_scene_packages',
      'director_guidance_records'
    ];

    for (const tableName of expectedTables) {
      const result = await client.query(
        `SELECT table_name FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_name = $1`,
        [tableName]
      );

      if (result.rows.length > 0) {
        logger.success(`表 ${tableName} 存在`);
      } else {
        logger.error(`表 ${tableName} 不存在`);
        return false;
      }
    }

    logger.success('所有必需的表都存在');
    return true;
  } catch (error) {
    logger.error('验证表结构失败:', (error as Error).message);
    return false;
  } finally {
    await client.end();
  }
}

/**
 * 初始化示例数据（可选）
 * 该函数不在自动初始化中调用，需要手动调用
 */
export async function insertSampleData(options?: {
  includeExampleSession?: boolean;
  includeExampleCharacter?: boolean;
}): Promise<boolean> {
  logger.info('初始化示例数据...');

  const config = {
    includeExampleSession: false,
    includeExampleCharacter: false,
    ...options
  };

  const client = new Client(dbConfig);

  try {
    await client.connect();

    if (config.includeExampleSession) {
      // 插入示例会话
      await client.query(`\
        INSERT INTO game_sessions (id, player_id, game_state) 
        VALUES ($1, $2, $3) 
        ON CONFLICT (id) DO NOTHING
      `, ['example-session-1', 'example-player', JSON.stringify({
        currentLocation: 'town_square',
        startTime: new Date().toISOString()
      })]);

      logger.success('示例会话创建完成');
    }

    if (config.includeExampleCharacter) {
      // 插入示例角色
      await client.query(`\
        INSERT INTO characters (id, session_id, name, personality, background, current_location, emotional_state, character_data) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        ON CONFLICT (id) DO NOTHING
      `, [
        'town-guard-1',
        'example-session-1',
        '镇守卫',
        JSON.stringify({
          traits: { friendly: 0.7, dutiful: 0.9, cautious: 0.6 },
          values: { justice: 0.9, order: 0.8, protection: 0.9 }
        }),
        '一位尽职尽责的镇守卫，负责保护镇中心广场的安全',
        'town_square',
        JSON.stringify({ mood: 'alert', confidence: 0.8 }),
        JSON.stringify({
          equipment: ['sword', 'shield', 'armor'],
          duties: ['patrol', 'protect citizens', 'maintain order']
        })
      ]);

      logger.success('示例角色创建完成');
    }

    logger.success('示例数据初始化完成');
    return true;
  } catch (error) {
    logger.error('初始化示例数据失败:', (error as Error).message);
    return false;
  } finally {
    await client.end();
  }
}

/**
 * 主初始化函数
 */
async function initializeDatabase(): Promise<void> {
  logger.info('=== 开始数据库初始化 ===');

  try {
    // 1. 检查PostgreSQL连接
    const pgConnected = await checkPostgresConnection();
    if (!pgConnected) {
      logger.error('PostgreSQL连接失败，无法继续初始化');
      process.exit(1);
    }

    // 2. 创建数据库
    const dbCreated = await createDatabaseIfNotExists();
    if (!dbCreated) {
      logger.error('数据库创建失败');
      process.exit(1);
    }

    // 3. 执行schema脚本
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schemaExecuted = await executeSqlScript(schemaPath);
    if (!schemaExecuted) {
      logger.error('数据库schema创建失败');
      process.exit(1);
    }

    // 4. 验证表结构
    const tablesValid = await validateTables();
    if (!tablesValid) {
      logger.error('数据库表验证失败');
      process.exit(1);
    }

    // 5. 检查Redis连接（可选）
    await checkRedisConnection();

    logger.info('\n数据库初始化完成！');
    logger.info('\n数据库配置信息:');
    logger.info(`  主机: ${dbConfig.host}:${dbConfig.port}`);
    logger.info(`  数据库: ${dbConfig.database}`);
    logger.info(`  用户: ${dbConfig.user}`);

    if (process.env.REDIS_HOST) {
      logger.info(`  Redis: ${redisConfig.host}:${redisConfig.port}`);
    }

    logger.info('\n游戏系统现在可以启动了！');
    logger.info('\n如需初始化示例数据，请手动调用 insertSampleData() 函数');

  } catch (error) {
    logger.error('数据库初始化过程中发生错误:', (error as Error).message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  initializeDatabase().catch(error => {
    logger.error('数据库初始化失败:', error);
    process.exit(1);
  });
}

export { initializeDatabase };
