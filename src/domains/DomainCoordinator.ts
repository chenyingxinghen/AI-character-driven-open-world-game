/**
 * 域协调器 - Domain Coordinator
 * 
 * 职责：
 * - 协调各个域之间的交互
 * - 管理重构后的处理流水线 (Pipeline)
 */

import { Logger } from '../services/Logger';
import { LLMService } from '../services/llm/LLMService';
import { GameContextService } from '../services/game/GameContextService';
import { WorldLoreService } from '../services/world/WorldLoreService';

import { Pipeline, ProcessingContext } from '../engine/Pipeline';
import { IntentAnalysisLayer } from '../engine/IntentAnalysisLayer';
import { DirectorLayer } from '../engine/DirectorLayer';
import { DomainExecutionLayer } from '../engine/DomainExecutionLayer';
import { NarrativeSynthesisLayer } from '../engine/NarrativeSynthesisLayer';

// 导入各域的管理器
import { CharacterManager } from './character/aggregates';
import { WorldManager } from './world/aggregates';
import { InputManager } from './input/aggregates';
import { OperationsManager } from './operations/aggregates';

// 导入值对象
import { InputClassification } from './input/valueObjects';
import { Character } from './character/entities';
import { CharacterProfile } from './character/valueObjects';

/**
 * 游戏上下文接口
 */
export interface GameContext {
  sessionId: string;
  playerId: string;
  currentLocation: string;
  activeCharacters: string[];
  gameState: any;
  timestamp: Date;
}

import { GameAction } from '../engine/GameAction';

/**
 * 域协调结果
 */
export interface DomainCoordinationResult {
  success: boolean;
  responses: {
    narrative?: string;
    characterResponses?: string[];
    locationDescription?: string;
    choices?: any[];
  };
  stateChanges: {
    characterUpdates?: any[];
    worldUpdates?: any[];
    locationChange?: string;
  };
  actions?: GameAction[];
  metadata: {
    processingTime: number;
    domainsInvolved: string[];
    complexity: number;
  };
  error?: string;
}

export class DomainCoordinator {
  private characterManager: CharacterManager;
  private worldManager: WorldManager;
  private inputManager: InputManager;
  private operationsManager: OperationsManager;
  private gameContextService?: GameContextService;
  private worldLoreService?: WorldLoreService;
  private pipeline: Pipeline;

  constructor(
    private llmService: LLMService,
    private logger: Logger,
    gameContextService?: GameContextService,
    private databaseService?: any,
    worldLoreService?: WorldLoreService
  ) {
    this.characterManager = new CharacterManager(llmService, logger, databaseService);
    this.worldManager = new WorldManager(llmService, logger, databaseService);
    this.inputManager = new InputManager(llmService, logger, gameContextService);
    this.operationsManager = new OperationsManager(logger);
    this.gameContextService = gameContextService;
    this.worldLoreService = worldLoreService;

    // 初始化处理流水线
    this.pipeline = new Pipeline();
    this.initializePipeline();

    this.logger.info('Domain Coordinator initialized with Pipeline architecture');
  }

  private initializePipeline(): void {
    this.pipeline
      .use(new IntentAnalysisLayer(this.inputManager, this.logger))
      .use(new DirectorLayer((this as any).directorEngine || { evaluateStoryProgression: async () => ({ shouldIntervene: false }) }, this.logger))
      .use(new DomainExecutionLayer(this, this.logger))
      .use(new NarrativeSynthesisLayer(this.llmService, this.logger));
  }

  async processPlayerInput(
    sessionId: string,
    playerId: string,
    playerInput: string,
    gameContext: GameContext
  ): Promise<DomainCoordinationResult> {
    const startTime = Date.now();

    const context: ProcessingContext = {
      sessionId,
      playerId,
      timestamp: new Date(),
      rawInput: playerInput,
      actions: [],
      coordinationResult: {
        success: true,
        responses: {},
        stateChanges: { locationChange: gameContext.currentLocation },
        metadata: { processingTime: 0, domainsInvolved: ['input'], complexity: 0 }
      },
      metadata: { startTime, steps: [] }
    };

    try {
      await this.pipeline.execute(context);
      context.coordinationResult.actions = context.actions; // 填充动作序列
      context.coordinationResult.metadata.processingTime = Date.now() - startTime;
      return context.coordinationResult;
    } catch (error) {
      this.logger.error('Pipeline processing failed', error as Error);
      return {
        success: false,
        responses: { narrative: "An error occurred during processing." },
        stateChanges: {},
        metadata: { processingTime: Date.now() - startTime, domainsInvolved: ['input'], complexity: 1 },
        error: (error as Error).message
      };
    }
  }

  async initializeGame(): Promise<void> {
    this.logger.info('Initializing game through domain coordination...');
    await this.worldManager.initializeWorld();
  }

  async getSystemStatus(): Promise<any> {
    return {
      characters: this.characterManager.getCharacterStatistics(),
      status: 'active',
      timestamp: new Date()
    };
  }

  async cleanupSystem(olderThanHours: number): Promise<void> {
    this.logger.info(`Cleaning up system data older than ${olderThanHours} hours...`);
    this.characterManager.cleanup();
  }

  /**
   * 同步会话状态
   * 触发各个域管理器加载对应的持久化数据
   */
  async syncSessionState(sessionId: string): Promise<void> {
    this.logger.info(`Synchronizing session state for: ${sessionId}`);

    // 1. 同步世界状态（位置、连接、场景）
    await this.worldManager.loadSessionState(sessionId);

    // 2. 同步角色状态（NPC 及其当前位置）
    await this.characterManager.getAllCharacters(sessionId);

    this.logger.info(`Session state synchronization completed for: ${sessionId}`);
  }

  // 辅助方法：由 DomainExecutionLayer 调用
  private async handleSimpleScenario(analysis: any, gameContext: any, domains: string[]): Promise<any> {
    const result = { responses: {} as any, stateChanges: {} as any };
    const classification = analysis.classification;

    if (classification.intent === 'dialogue') {
      const char = await this.characterManager.getCharacter(classification.targetCharacter || 'any', gameContext.sessionId);
      if (char) {
        const charResponse = await this.characterManager.generateCharacterResponse(char, {
          input: analysis.preprocessed?.sanitizedInput || classification.extractedSpeech,
          gameContext
        });
        result.responses.characterResponses = [charResponse];
      }
    } else if (classification.intent === 'movement') {
      const moveResult = await this.worldManager.processLocationMovement(
        gameContext.currentLocation,
        classification.targetLocation || 'unknown',
        gameContext.playerId,
        gameContext.sessionId
      );
      if (moveResult.success) {
        result.stateChanges.locationChange = moveResult.newLocation?.id;
        result.responses.locationDescription = moveResult.sceneDescription;
      }
    }

    return result;
  }

  private async recordProcessingResult(analysis: any, result: any, startTime: number, sessionId: string): Promise<void> {
    const processingTime = Date.now() - startTime;
    this.operationsManager.recordPerformance({
      operation: 'process_input',
      executionTime: processingTime,
      memoryUsage: 0,
      cpuUsage: 0,
      timestamp: new Date(),
      success: result.success
    });
  }
}