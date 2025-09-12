/**
 * AI角色驱动开放世界游戏 - 完整游戏流程示例
 * 
 * 此示例演示了完整的游戏流程，包括：
 * 1. 系统初始化
 * 2. 会话创建
 * 3. 玩家输入处理
 * 4. AI角色响应
 * 5. 游戏状态更新
 * 6. 世界环境变化
 */

import { Orchestrator, OrchestratorResult } from '../Orchestrator';
import { Logger } from '../services/Logger';
import { GameClient, GameClientConfig } from '../client/GameClient';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

class GameFlowExample {
  private orchestrator: Orchestrator;
  private logger: Logger;
  private gameClient: GameClient;
  private sessionId: string | null = null;

  constructor() {
    this.logger = new Logger();
    this.orchestrator = new Orchestrator();
    
    // 初始化游戏客户端
    const clientConfig: GameClientConfig = {
      websocketUrl: process.env.WEBSOCKET_URL || 'ws://localhost:8080',
      playerId: 'example_player'
    };
    this.gameClient = new GameClient(clientConfig);
    
    this.setupEventHandlers();
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    this.gameClient.onConnectionChange((connected: boolean) => {
      this.logger.info(`Connection status: ${connected ? 'Connected' : 'Disconnected'}`);
    });

    this.gameClient.onCharacterResponse((response: any) => {
      this.logger.info(`Character Response from ${response.characterName}: ${response.content}`);
    });

    this.gameClient.onSceneUpdate((scene: any) => {
      this.logger.info(`Scene Update: ${scene.title} - ${scene.description}`);
    });

    this.gameClient.onGameStateUpdate((state: any) => {
      this.logger.info(`Game State: ${state.status} at ${state.currentLocation}`);
    });
  }

  /**
   * 运行完整的游戏流程示例
   */
  async runExample(): Promise<void> {
    try {
      this.logger.info('=== AI角色驱动开放世界游戏流程示例 ===');
      
      // 1. 初始化游戏系统
      await this.initializeGame();
      
      // 2. 连接到游戏服务器（如果可用）
      await this.connectToGameServer();
      
      // 3. 创建游戏会话
      await this.createGameSession();
      
      // 4. 模拟玩家交互
      await this.simulatePlayerInteractions();
      
      // 5. 展示系统状态
      await this.showSystemStatus();
      
      this.logger.info('=== 游戏流程示例完成 ===');
      
    } catch (error) {
      this.logger.error('Game flow example failed:', error as Error);
    } finally {
      // 清理资源
      await this.cleanup();
    }
  }

  /**
   * 初始化游戏系统
   */
  private async initializeGame(): Promise<void> {
    this.logger.info('\n1. 初始化游戏系统...');
    
    try {
      await this.orchestrator.initializeGame();
      this.logger.info('✓ 游戏系统初始化成功');
      this.logger.info('  - 域协调器已启动');
      this.logger.info('  - LLM服务已配置');
      this.logger.info('  - 数据库连接已建立');
    } catch (error) {
      this.logger.warn('游戏系统初始化部分失败，但可以继续运行');
      this.logger.warn('某些功能可能使用模拟服务');
    }
  }

  /**
   * 连接到游戏服务器
   */
  private async connectToGameServer(): Promise<void> {
    this.logger.info('\n2. 连接到游戏服务器...');
    
    try {
      const connected = await this.gameClient.connect();
      if (connected) {
        this.logger.info('✓ 成功连接到游戏服务器');
      } else {
        this.logger.warn('⚠ 无法连接到游戏服务器，使用本地模式');
      }
    } catch (error) {
      this.logger.warn('⚠ 游戏服务器连接失败，使用本地模式');
    }
  }

  /**
   * 创建游戏会话
   */
  private async createGameSession(): Promise<void> {
    this.logger.info('\n3. 创建游戏会话...');
    
    try {
      const session = await this.orchestrator.createSession('example_player');
      this.sessionId = session.id;
      
      this.logger.info(`✓ 游戏会话创建成功: ${this.sessionId}`);
      this.logger.info(`  - 玩家ID: ${session.playerId}`);
      this.logger.info(`  - 创建时间: ${session.createdAt.toLocaleString()}`);
      this.logger.info(`  - 初始位置: 镇中心广场`);
    } catch (error) {
      this.logger.error('创建游戏会话失败:', error as Error);
      throw error;
    }
  }

  /**
   * 模拟玩家交互
   */
  private async simulatePlayerInteractions(): Promise<void> {
    this.logger.info('\n4. 模拟玩家交互...');
    
    const interactions = [
      {
        input: '你好，我是新来的冒险者',
        description: '友好问候'
      },
      {
        input: '这个镇子有什么有趣的地方吗？',
        description: '询问信息'
      },
      {
        input: '我想了解这里的历史',
        description: '深入对话'
      },
      {
        input: '带我去图书馆看看',
        description: '移动请求'
      },
      {
        input: '观察周围的环境',
        description: '环境探索'
      }
    ];

    for (let i = 0; i < interactions.length; i++) {
      const interaction = interactions[i];
      this.logger.info(`\n4.${i + 1} ${interaction.description}: "${interaction.input}"`);
      
      try {
        const result = await this.processPlayerInput(interaction.input);
        this.displayInteractionResult(result);
        
        // 等待一段时间模拟真实游戏节奏
        await this.sleep(2000);
        
      } catch (error) {
        this.logger.error(`处理输入失败: ${(error as Error).message}`);
      }
    }
  }

  /**
   * 处理玩家输入
   */
  private async processPlayerInput(input: string): Promise<OrchestratorResult> {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    this.logger.info('  正在处理输入...');
    const startTime = Date.now();
    
    const result = await this.orchestrator.runOnce(input, this.sessionId, 'example_player');
    
    const processingTime = Date.now() - startTime;
    this.logger.info(`  处理时间: ${processingTime}ms`);
    
    return result;
  }

  /**
   * 显示交互结果
   */
  private displayInteractionResult(result: OrchestratorResult): void {
    if (result.success && result.coordinationResult) {
      const coordination = result.coordinationResult;
      
      // 显示角色响应
      if (coordination.responses.characterResponses) {
        coordination.responses.characterResponses.forEach((response, index) => {
          this.logger.info(`  🗣️ NPC回应${index + 1}: ${response}`);
        });
      }
      
      // 显示叙述文本
      if (coordination.responses.narrative) {
        this.logger.info(`  📖 叙述: ${coordination.responses.narrative}`);
      }
      
      // 显示位置描述
      if (coordination.responses.locationDescription) {
        this.logger.info(`  🌍 环境: ${coordination.responses.locationDescription}`);
      }
      
      // 显示状态变化
      if (coordination.stateChanges.locationChange) {
        this.logger.info(`  📍 位置变更: ${coordination.stateChanges.locationChange}`);
      }
      
      // 显示元数据
      this.logger.info(`  📊 涉及域: ${coordination.metadata.domainsInvolved.join(', ')}`);
      this.logger.info(`  🎯 复杂度: ${coordination.metadata.complexity}`);
      
    } else {
      this.logger.warn(`  ❌ 处理失败: ${result.error}`);
    }
  }

  /**
   * 显示系统状态
   */
  private async showSystemStatus(): Promise<void> {
    this.logger.info('\n5. 系统状态总览...');
    
    try {
      const status = await this.orchestrator.getSystemStatus();
      
      this.logger.info('✓ 系统健康状态:');
      this.logger.info(`  - 系统运行正常: ${status.health ? '是' : '否'}`);
      
      if (status.statistics) {
        this.logger.info('📈 统计信息:');
        Object.entries(status.statistics).forEach(([key, value]) => {
          this.logger.info(`  - ${key}: ${value}`);
        });
      }
      
      if (status.activeAlerts && status.activeAlerts.length > 0) {
        this.logger.warn('🚨 活跃警报:');
        status.activeAlerts.forEach((alert: any) => {
          this.logger.warn(`  - ${alert}`);
        });
      } else {
        this.logger.info('✓ 无活跃警报');
      }
      
    } catch (error) {
      this.logger.warn('获取系统状态失败:', error as Error);
    }
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    this.logger.info('\n6. 清理资源...');
    
    try {
      // 关闭会话
      if (this.sessionId) {
        await this.orchestrator.closeSession(this.sessionId);
        this.logger.info('✓ 游戏会话已关闭');
      }
      
      // 断开客户端连接
      this.gameClient.disconnect();
      this.logger.info('✓ 客户端连接已断开');
      
      // 清理过期会话
      await this.orchestrator.cleanupExpiredSessions(1);
      this.logger.info('✓ 过期会话已清理');
      
    } catch (error) {
      this.logger.warn('清理过程中出现错误:', error as Error);
    }
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 运行示例
 */
async function runExample(): Promise<void> {
  const example = new GameFlowExample();
  await example.runExample();
}

// 如果直接运行此文件
if (require.main === module) {
  runExample().catch(error => {
    console.error('Example failed:', error);
    process.exit(1);
  });
}

export { GameFlowExample, runExample };