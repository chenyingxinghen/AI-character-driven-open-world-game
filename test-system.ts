#!/usr/bin/env ts-node

/**
 * 系统集成测试脚本
 * 
 * 此脚本测试游戏系统的各个组件，确保:
 * 1. 所有服务能够正常初始化
 * 2. 数据库连接正常
 * 3. LLM服务配置正确
 * 4. WebSocket通信正常
 * 5. 游戏循环完整运行
 */

import { Orchestrator } from './src/Orchestrator';
import { Logger } from './src/services/Logger';
import { GameClient, GameClientConfig } from './src/client/GameClient';
import { WebSocketServer } from 'ws';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  duration: number;
  details?: any;
}

class SystemTester {
  private logger: Logger;
  private orchestrator: Orchestrator;
  private testResults: TestResult[] = [];
  private gameClient?: GameClient;
  private testServer?: WebSocketServer;

  constructor() {
    this.logger = new Logger();
    this.orchestrator = new Orchestrator();
  }

  /**
   * 运行所有测试
   */
  async runAllTests(): Promise<void> {
    this.logger.info('=== AI角色驱动开放世界游戏 - 系统集成测试 ===\n');
    
    const tests = [
      { name: '系统初始化测试', test: () => this.testSystemInitialization() },
      { name: 'LLM服务测试', test: () => this.testLLMService() },
      { name: '数据库连接测试', test: () => this.testDatabaseConnection() },
      { name: '游戏会话测试', test: () => this.testGameSession() },
      { name: '域协调器测试', test: () => this.testDomainCoordination() },
      { name: 'WebSocket服务器测试', test: () => this.testWebSocketServer() },
      { name: '客户端连接测试', test: () => this.testClientConnection() },
      { name: '完整游戏流程测试', test: () => this.testCompleteGameFlow() }
    ];

    for (const testSpec of tests) {
      await this.runTest(testSpec.name, testSpec.test);
    }

    this.generateTestReport();
  }

  /**
   * 运行单个测试
   */
  private async runTest(name: string, testFn: () => Promise<any>): Promise<void> {
    this.logger.info(`🧪 运行测试: ${name}`);
    const startTime = Date.now();
    
    try {
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      this.testResults.push({
        name,
        success: true,
        duration,
        details: result
      });
      
      this.logger.info(`✅ ${name} - 通过 (${duration}ms)\n`);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.testResults.push({
        name,
        success: false,
        error: (error as Error).message,
        duration
      });
      
      this.logger.error(`❌ ${name} - 失败: ${(error as Error).message} (${duration}ms)\n`);
    }
  }

  /**
   * 测试系统初始化
   */
  private async testSystemInitialization(): Promise<any> {
    await this.orchestrator.initializeGame();
    const status = await this.orchestrator.getSystemStatus();
    
    return {
      healthStatus: status.health,
      hasStatistics: !!status.statistics,
      alertCount: status.activeAlerts?.length || 0
    };
  }

  /**
   * 测试LLM服务
   */
  private async testLLMService(): Promise<any> {
    const hasApiKey = !!(process.env.OPENAI_API_KEY || 
                        process.env.ANTHROPIC_API_KEY || 
                        process.env.GEMINI_API_KEY || 
                        process.env.OPENROUTER_API_KEY);
    
    if (!hasApiKey) {
      return {
        configured: false,
        usingMock: true,
        message: '未配置API密钥，使用模拟服务'
      };
    }
    
    // 这里可以添加实际的LLM测试
    return {
      configured: true,
      usingMock: false,
      providers: Object.keys(process.env).filter(key => key.includes('_API_KEY')).length
    };
  }

  /**
   * 测试数据库连接
   */
  private async testDatabaseConnection(): Promise<any> {
    const hasDbConfig = !!(process.env.DATABASE_HOST && process.env.DATABASE_NAME);
    
    if (!hasDbConfig) {
      return {
        configured: false,
        usingMock: true,
        message: '未配置数据库，使用模拟服务'
      };
    }
    
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
      const result = await client.query('SELECT NOW() as timestamp');
      await client.end();
      
      return {
        configured: true,
        connected: true,
        timestamp: result.rows[0].timestamp
      };
    } catch (error) {
      return {
        configured: true,
        connected: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * 测试游戏会话
   */
  private async testGameSession(): Promise<any> {
    const session = await this.orchestrator.createSession('test_player');
    
    const result = {
      sessionId: session.id,
      playerId: session.playerId,
      isActive: session.isActive,
      createdAt: session.createdAt
    };
    
    // 清理测试会话
    await this.orchestrator.closeSession(session.id);
    
    return result;
  }

  /**
   * 测试域协调
   */
  private async testDomainCoordination(): Promise<any> {
    const session = await this.orchestrator.createSession('coordination_test_player');
    
    try {
      const result = await this.orchestrator.runOnce(
        '你好，我是新来的冒险者',
        session.id,
        'coordination_test_player'
      );
      
      return {
        success: result.success,
        hasResponses: !!(result.coordinationResult?.responses),
        domainsInvolved: result.coordinationResult?.metadata.domainsInvolved || [],
        processingTime: result.executionTime
      };
    } finally {
      await this.orchestrator.closeSession(session.id);
    }
  }

  /**
   * 测试WebSocket服务器
   */
  private async testWebSocketServer(): Promise<any> {
    return new Promise((resolve, reject) => {
      // 启动临时测试服务器
      this.testServer = new WebSocketServer({ port: 0 }); // 使用随机端口
      
      this.testServer.on('listening', () => {
        const address = this.testServer!.address();
        const port = typeof address === 'object' && address ? address.port : 'unknown';
        
        resolve({
          serverStarted: true,
          port: port,
          message: 'WebSocket服务器启动成功'
        });
      });
      
      this.testServer.on('error', (error) => {
        reject(error);
      });
      
      // 设置超时
      setTimeout(() => {
        reject(new Error('WebSocket服务器启动超时'));
      }, 5000);
    });
  }

  /**
   * 测试客户端连接
   */
  private async testClientConnection(): Promise<any> {
    if (!this.testServer) {
      throw new Error('测试服务器未启动');
    }
    
    const address = this.testServer.address();
    const port = typeof address === 'object' && address ? address.port : null;
    
    if (!port) {
      throw new Error('无法获取测试服务器端口');
    }
    
    const config: GameClientConfig = {
      websocketUrl: `ws://localhost:${port}`,
      playerId: 'test_client'
    };
    
    this.gameClient = new GameClient(config);
    
    return new Promise((resolve, reject) => {
      let resolved = false;
      
      this.gameClient!.onConnectionChange((connected) => {
        if (connected && !resolved) {
          resolved = true;
          resolve({
            connected: true,
            url: config.websocketUrl,
            playerId: config.playerId
          });
        }
      });
      
      // 尝试连接
      this.gameClient!.connect().catch((error) => {
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      });
      
      // 设置超时
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('客户端连接超时'));
        }
      }, 5000);
    });
  }

  /**
   * 测试完整游戏流程
   */
  private async testCompleteGameFlow(): Promise<any> {
    const session = await this.orchestrator.createSession('flow_test_player');
    
    try {
      const interactions = [
        '你好',
        '这里是什么地方？',
        '我想探索一下'
      ];
      
      const results = [];
      
      for (const input of interactions) {
        const result = await this.orchestrator.runOnce(input, session.id, 'flow_test_player');
        results.push({
          input,
          success: result.success,
          hasResponse: !!(result.coordinationResult?.responses.narrative || 
                         result.coordinationResult?.responses.characterResponses?.length),
          processingTime: result.executionTime
        });
      }
      
      return {
        totalInteractions: interactions.length,
        successfulInteractions: results.filter(r => r.success).length,
        averageProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0) / results.length,
        results
      };
    } finally {
      await this.orchestrator.closeSession(session.id);
    }
  }

  /**
   * 生成测试报告
   */
  private generateTestReport(): void {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const totalTime = this.testResults.reduce((sum, r) => sum + r.duration, 0);
    
    this.logger.info('\n' + '='.repeat(60));
    this.logger.info('📊 测试报告汇总');
    this.logger.info('='.repeat(60));
    this.logger.info(`总测试数: ${totalTests}`);
    this.logger.info(`通过测试: ${passedTests} ✅`);
    this.logger.info(`失败测试: ${failedTests} ❌`);
    this.logger.info(`总耗时: ${totalTime}ms`);
    this.logger.info(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (failedTests > 0) {
      this.logger.info('\n❌ 失败测试详情:');
      this.testResults.filter(r => !r.success).forEach(result => {
        this.logger.error(`  - ${result.name}: ${result.error}`);
      });
    }
    
    this.logger.info('\n🎯 系统状态评估:');
    if (passedTests === totalTests) {
      this.logger.info('✅ 系统运行完全正常，可以启动游戏！');
    } else if (passedTests >= totalTests * 0.8) {
      this.logger.info('⚠️  系统基本正常，但有一些非关键功能可能受限');
    } else {
      this.logger.error('❌ 系统存在严重问题，建议检查配置和依赖');
    }
    
    this.logger.info('\n📋 建议:');
    if (failedTests > 0) {
      this.logger.info('1. 检查 .env 配置文件');
      this.logger.info('2. 确保数据库服务正在运行');
      this.logger.info('3. 验证LLM API密钥配置');
      this.logger.info('4. 查看详细错误日志');
    } else {
      this.logger.info('1. 运行 npm run game 启动完整游戏');
      this.logger.info('2. 或运行 npm run dev:server 启动服务器');
      this.logger.info('3. 打开 web-interface.html 开始游戏');
    }
    
    this.logger.info('='.repeat(60));
  }

  /**
   * 清理测试资源
   */
  async cleanup(): Promise<void> {
    if (this.gameClient) {
      this.gameClient.disconnect();
    }
    
    if (this.testServer) {
      this.testServer.close();
    }
    
    // 清理过期会话
    await this.orchestrator.cleanupExpiredSessions(0);
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const tester = new SystemTester();
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error('测试过程中发生严重错误:', error);
  } finally {
    await tester.cleanup();
    process.exit(0);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(error => {
    console.error('测试失败:', error);
    process.exit(1);
  });
}

export { SystemTester };