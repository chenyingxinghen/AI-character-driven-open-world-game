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
import { EnhancedInitialSceneService } from '../services/gameMode/EnhancedInitialSceneService';

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
import { InputClassification, IntentType } from './input/valueObjects';
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
  worldLore?: string;
  recentConversation?: Array<{ speaker: string, content: string }>;
}

import { GameAction } from '../engine/GameAction';

/**
 * 域协调结果
 */
export interface DomainCoordinationResult {
  success: boolean;
  responses: {
    narrative?: string;
    characterResponses?: Array<{
      characterId: string;
      characterName: string;
      content: string;
    }>;
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
  private enhancedInitialSceneService?: EnhancedInitialSceneService;
  private worldLoreService?: WorldLoreService;
  private pipeline: Pipeline;

  constructor(
    private llmService: LLMService,
    private logger: Logger,
    gameContextService?: GameContextService,
    private databaseService?: any,
    worldLoreService?: WorldLoreService,
    enhancedInitialSceneService?: EnhancedInitialSceneService
  ) {
    this.characterManager = new CharacterManager(llmService, logger, databaseService);
    this.worldManager = new WorldManager(llmService, logger, databaseService);
    this.inputManager = new InputManager(llmService, logger, gameContextService);
    this.operationsManager = new OperationsManager(logger);
    this.gameContextService = gameContextService;
    this.worldLoreService = worldLoreService;
    this.enhancedInitialSceneService = enhancedInitialSceneService;

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
      gameContext,
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

  private isValidCharacterName(name: string): boolean {
    if (!name || name.toLowerCase() === 'none' || name.toLowerCase() === 'unknown') return false;

    const pronouns = [
      '她', '他', '它', '他们', '她们', '它们', '你', '我', '我们', '你们',
      'she', 'her', 'he', 'him', 'it', 'they', 'them', 'you', 'i', 'me', 'we', 'us'
    ];

    // 如果名称完全匹配代词，或者是代词加上称呼（如“她那个”），则拒绝
    const cleanName = name.trim().toLowerCase();
    if (pronouns.includes(cleanName)) return false;

    // 长度检查，通常合法的名字至少2个汉字或2个字母（排除单字称呼，但有些名字可能是单字，需谨慎）
    // 这里主要防范单字代词
    if (name.length === 1 && pronouns.includes(name)) return false;

    return true;
  }

  // 辅助方法：由 DomainExecutionLayer 调用
  private async handleSimpleScenario(analysis: any, gameContext: any, domains: string[]): Promise<any> {
    const result = { responses: {} as any, stateChanges: {} as any };
    const classification = analysis.classification;

    if (classification.intent === IntentType.DIALOGUE || classification.intent === IntentType.CHARACTER_INTERACTION) {
      // 增强：从数据库或管理器中解析真正的角色
      const targetChar = classification.targetCharacter;
      let char = null;

      if (targetChar && targetChar !== 'none') {
        // 先尝试通过 ID 获取
        char = await this.characterManager.getCharacter(targetChar, gameContext.sessionId);

        // 如果 ID 找不到，尝试通过名称获取
        if (!char) {
          char = await this.characterManager.getCharacterByName(targetChar, gameContext.sessionId);
        }
      }

      if (char) {
        const charResponse = await this.characterManager.generateCharacterResponse(char, {
          input: analysis.preprocessed?.sanitizedInput || classification.extractedSpeech,
          gameContext
        });

        result.responses.characterResponses = [{
          characterId: char.id,
          characterName: char.name,
          content: charResponse
        }];

        // 标记涉及的域
        if (!domains.includes('character')) {
          domains.push('character');
        }
      } else if (classification.targetCharacter &&
        classification.targetCharacter !== 'none' &&
        this.isValidCharacterName(classification.targetCharacter) &&
        this.enhancedInitialSceneService) {
        // 如果指定了角色但不存在，且有生成服务，则动态新建角色
        this.logger.info(`Character "${classification.targetCharacter}" not found, attempting dynamic creation`, {
          sessionId: gameContext.sessionId,
          targetCharacter: classification.targetCharacter
        });

        try {
          const newChar = await this.enhancedInitialSceneService.generateAndSaveCharacter(
            gameContext.sessionId,
            gameContext.currentLocation,
            'mysterious', // 默认角色类型
            { name: classification.targetCharacter }
          );

          if (newChar) {
            this.logger.info(`Dynamically created character: ${newChar.name} (${newChar.id})`);

            // 重新获取角色对象（为了保证 CharacterManager 内部状态同步，或者直接用 reconstruction 如果 CharacterManager 暴露了）
            const createdChar = await this.characterManager.getCharacter(newChar.id, gameContext.sessionId);

            if (createdChar) {
              const charResponse = await this.characterManager.generateCharacterResponse(createdChar, {
                input: analysis.preprocessed?.sanitizedInput || classification.extractedSpeech,
                gameContext
              });

              result.responses.characterResponses = [{
                characterId: createdChar.id,
                characterName: createdChar.name,
                content: charResponse
              }];

              if (!domains.includes('character')) {
                domains.push('character');
              }
            }
          }
        } catch (error) {
          this.logger.error('Failed to dynamically create character:', error as Error);
        }
      } else {
        // 如果找不到指定角色但有附近角色，尝试选择一个
        const nearby = await this.characterManager.getCharactersInLocation(gameContext.currentLocation, gameContext.sessionId);

        if (nearby.length > 0) {
          let targetCharObj = nearby[0]; // 默认第一个

          // 增强：如果有对话历史，尝试找到最近说话的那个人
          if (gameContext.recentConversation && gameContext.recentConversation.length > 0) {
            const lastSpeaker = [...gameContext.recentConversation]
              .reverse()
              .find(c => c.speaker !== 'Player' && c.speaker !== 'System');

            if (lastSpeaker) {
              const matchedChar = nearby.find(n => n.name === lastSpeaker.speaker);
              if (matchedChar) {
                targetCharObj = matchedChar;
                this.logger.debug(`Inferred target character "${targetCharObj.name}" from conversation history`);
              }
            }
          }

          const charResponse = await this.characterManager.generateCharacterResponse(targetCharObj, {
            input: analysis.preprocessed?.sanitizedInput || classification.extractedSpeech,
            gameContext
          });

          result.responses.characterResponses = [{
            characterId: targetCharObj.id,
            characterName: targetCharObj.name,
            content: charResponse
          }];

          if (!domains.includes('character')) {
            domains.push('character');
          }
        }
      }
    } else if (classification.intent === IntentType.MOVEMENT) {
      const moveResult = await this.worldManager.processLocationMovement(
        gameContext.currentLocation,
        classification.targetLocation || 'unknown',
        gameContext.playerId,
        gameContext.sessionId
      );
      if (moveResult.success) {
        result.stateChanges.locationChange = moveResult.newLocation?.id;
        result.responses.locationDescription = moveResult.sceneDescription;

        if (!domains.includes('world')) {
          domains.push('world');
        }
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