/**
 * AI Character-Driven Open World Game - Refactored with Domain Architecture
 * 
 * This is the main entry point for the refactored game that now uses
 * Domain-Driven Design (DDD) to achieve clean separation of concerns.
 */

import { Orchestrator } from './Orchestrator';
import { Logger } from './services/Logger';
import { DefaultServiceFactory } from './services/factory';

/**
 * Main game class using domain architecture
 */
export class DomainBasedGame {
  private orchestrator: Orchestrator;
  private logger: Logger;

  constructor() {
    // 首先注册所有依赖服务到容器
    const factory = new DefaultServiceFactory();
    factory.registerAllServices();

    this.logger = new Logger();
    this.orchestrator = new Orchestrator();
    this.logger.info('Domain-based AI Character Game initialized');
  }

  async initialize(): Promise<void> {
    await this.orchestrator.initializeGame();
    this.logger.info('Game initialization completed');
  }

  async startSession(playerId: string = 'player1'): Promise<string> {
    const session = await this.orchestrator.createSession(playerId);
    return session.id;
  }

  async processInput(input: string, sessionId?: string, playerId: string = 'player1'): Promise<any> {
    const result = await this.orchestrator.runOnce(input, sessionId, playerId);

    if (result.success && result.coordinationResult) {
      return {
        success: true,
        sessionId: result.session.id,
        narrative: result.coordinationResult.responses.narrative,
        processingTime: result.executionTime,
        domainsInvolved: result.coordinationResult.metadata.domainsInvolved
      };
    } else {
      return {
        success: false,
        error: result.error,
        processingTime: result.executionTime
      };
    }
  }

  async getSystemStatus(): Promise<any> {
    return await this.orchestrator.getSystemStatus();
  }

  async cleanup(): Promise<void> {
    await this.orchestrator.cleanupSystem();
  }
}

// Example usage
async function main() {
  const game = new DomainBasedGame();

  try {
    await game.initialize();
    const sessionId = await game.startSession('test_player');

    const result = await game.processInput('你好，我是新来的。', sessionId);

    if (result.success) {
      console.log('叙述:', result.narrative);
      console.log('处理时间:', result.processingTime + 'ms');
      console.log('涉及域:', result.domainsInvolved.join(', '));
    } else {
      console.log('错误:', result.error);
    }

    await game.cleanup();
  } catch (error) {
    console.error('游戏运行错误:', error);
  }
}

export { Orchestrator } from './Orchestrator';
export * from './domains';
export * from './services/factory';

if (typeof require !== 'undefined' && (require as any).main === (module as any)) {
  main().catch(console.error);
}