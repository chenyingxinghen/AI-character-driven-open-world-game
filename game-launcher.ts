#!/usr/bin/env node

/**
 * AI角色驱动开放世界游戏 - 完整启动器
 * 
 * 此脚本将启动完整的游戏系统，包括：
 * - PostgreSQL 数据库初始化（如果需要）
 * - Redis 缓存服务（如果配置）
 * - WebSocket 游戏服务器
 * - 游戏引擎和域协调器
 * - Web界面服务
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import * as dotenv from 'dotenv';
import { Logger } from './src/services/Logger';

// 加载环境变量
dotenv.config();

const logger = new Logger();
const processes: ChildProcess[] = [];

interface ServiceConfig {
  name: string;
  command: string;
  args: string[];
  cwd?: string;
  required: boolean;
  healthCheck?: () => Promise<boolean>;
}

/**
 * 检查环境变量配置
 */
function checkEnvironment(): boolean {
  const requiredEnvVars = [
    'OPENAI_API_KEY',
    'DATABASE_HOST',
    'DATABASE_NAME',
    'DATABASE_USER',
    'DATABASE_PASSWORD'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logger.warn(`Missing environment variables: ${missingVars.join(', ')}`);
    logger.info('The system will use mock services for missing configurations.');
    return false;
  }

  return true;
}

/**
 * 检查数据库连接
 */
async function checkDatabase(): Promise<boolean> {
  try {
    const { Client } = await import('pg');
    const client = new Client({
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      connectionTimeoutMillis: 5000
    });

    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    
    logger.info('Database connection successful');
    return true;
  } catch (error) {
    logger.warn('Database connection failed:', error as Error);
    return false;
  }
}

/**
 * 初始化数据库（如果需要）
 */
async function initializeDatabase(): Promise<void> {
  const schemaPath = path.join(__dirname, 'database', 'schema.sql');
  
  if (!fs.existsSync(schemaPath)) {
    logger.warn('Database schema file not found, skipping database initialization');
    return;
  }

  try {
    const { spawn } = await import('child_process');
    
    const psqlProcess = spawn('psql', [
      '-h', process.env.DATABASE_HOST || 'localhost',
      '-p', process.env.DATABASE_PORT || '5432',
      '-U', process.env.DATABASE_USER || 'app_user',
      '-d', process.env.DATABASE_NAME || 'ai_narrative_game',
      '-f', schemaPath
    ], {
      env: {
        ...process.env,
        PGPASSWORD: process.env.DATABASE_PASSWORD
      }
    });

    return new Promise<void>((resolve, reject) => {
      psqlProcess.on('close', (code) => {
        if (code === 0) {
          logger.info('Database initialized successfully');
          resolve();
        } else {
          logger.warn(`Database initialization exited with code ${code}`);
          resolve(); // 继续启动，即使数据库初始化失败
        }
      });

      psqlProcess.on('error', (error) => {
        logger.warn('Database initialization error:', error);
        resolve(); // 继续启动
      });
    });
  } catch (error) {
    logger.warn('Could not run database initialization:', error as Error);
  }
}

/**
 * 启动服务
 */
function startService(config: ServiceConfig): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    logger.info(`Starting ${config.name}...`);
    
    const childProcess = spawn(config.command, config.args, {
      cwd: config.cwd || __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
      shell: process.platform === 'win32' // 在Windows上需要shell选项
    });

    let started = false;
    
    if (childProcess.stdout) {
      childProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString();
        logger.info(`[${config.name}] ${output.trim()}`);
        
        // 检查服务是否已启动
        if (!started && (output.includes('server') || output.includes('started') || output.includes('listening'))) {
          started = true;
          processes.push(childProcess);
          resolve(childProcess);
        }
      });
    }

    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data: Buffer) => {
        const error = data.toString();
        logger.warn(`[${config.name}] ${error.trim()}`);
      });
    }

    childProcess.on('error', (error: Error) => {
      logger.error(`Error starting ${config.name}:`, error);
      if (config.required) {
        reject(error);
      } else {
        resolve(childProcess);
      }
    });

    childProcess.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      logger.info(`${config.name} exited with code ${code} and signal ${signal}`);
      if (config.required && code !== 0) {
        reject(new Error(`${config.name} exited with non-zero code`));
      }
    });

    // 超时处理
    setTimeout(() => {
      if (!started) {
        started = true;
        processes.push(childProcess);
        resolve(childProcess);
      }
    }, 5000);
  });
}

/**
 * 主启动函数
 */
async function main(): Promise<void> {
  try {
    logger.info('🚀 Starting AI Character-Driven Open World Game...');
    
    // 1. 检查环境配置
    const hasFullConfig = checkEnvironment();
    
    // 2. 检查并初始化数据库（如果配置了）
    if (hasFullConfig) {
      const dbConnected = await checkDatabase();
      if (dbConnected) {
        await initializeDatabase();
      }
    }
    
    // 3. 构建项目
    logger.info('Building TypeScript project...');
    try {
      await startService({
        name: 'TypeScript Build',
        command: 'npx',
        args: ['tsc', '-p', 'tsconfig.json'],
        required: true
      });
      logger.info('TypeScript build completed');
    } catch (error) {
      logger.warn('TypeScript build failed, trying to continue with ts-node');
    }
    
    // 4. 启动游戏服务器
    logger.info('Starting game server...');
    const gameServer = await startService({
      name: 'Game Server',
      command: 'npx',
      args: ['ts-node', 'src/server/game-server.ts'],
      required: true
    });
    
    // 5. 等待服务器完全启动
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 6. 显示启动信息
    logger.info('🎮 Game System Started Successfully!');
    logger.info('');
    logger.info('=== 游戏系统信息 ===');
    logger.info(`游戏服务器: ws://localhost:${process.env.GAME_SERVER_PORT || '8080'}`);
    logger.info(`管理界面: http://localhost:3000 (需要单独启动)`);
    logger.info('');
    logger.info('=== 可用命令 ===');
    logger.info('Ctrl+C: 停止所有服务');
    logger.info('');
    logger.info('=== 快速开始 ===');
    logger.info('1. 打开浏览器访问游戏界面');
    logger.info('2. 或使用WebSocket客户端连接到游戏服务器');
    logger.info('3. 开始你的AI驱动冒险之旅！');
    logger.info('');
    
    // 7. 设置优雅关闭
    setupGracefulShutdown();
    
  } catch (error) {
    logger.error('Failed to start game system:', error as Error);
    await shutdown();
    process.exit(1);
  }
}

/**
 * 设置优雅关闭
 */
function setupGracefulShutdown(): void {
  const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'] as const;
  
  signals.forEach(signal => {
    process.on(signal, async () => {
      logger.info(`\nReceived ${signal}, shutting down gracefully...`);
      await shutdown();
      process.exit(0);
    });
  });
}

/**
 * 关闭所有服务
 */
async function shutdown(): Promise<void> {
  logger.info('Shutting down all services...');
  
  const shutdownPromises = processes.map(process => {
    return new Promise<void>((resolve) => {
      if (!process.killed) {
        process.kill('SIGTERM');
        
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
          resolve();
        }, 5000);
        
        process.on('exit', () => resolve());
      } else {
        resolve();
      }
    });
  });
  
  await Promise.all(shutdownPromises);
  logger.info('All services shut down');
}

// 启动应用
if (require.main === module) {
  main().catch((error) => {
    console.error('Startup failed:', error);
    process.exit(1);
  });
}

export { main as startGameSystem };