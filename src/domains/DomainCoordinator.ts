/**
 * 域协调器 - Domain Coordinator
 * 
 * 职责：
 * - 协调各个域之间的交互
 * - 管理跨域的业务流程
 * - 确保数据一致性
 * - 处理域间的事件传播
 * - 提供统一的业务接口
 */

import { Logger } from '../services/Logger';
import { LLMService } from '../services/llm/LLMService';
import { GameContextService } from '../services/game/GameContextService';

// 导入各域的管理器
import { CharacterManager } from './character/aggregates';
import { WorldManager } from './world/aggregates';
import { InputManager } from './input/aggregates';
import { OperationsManager } from './operations/aggregates';

// 导入值对象
import { InputClassification, ComplexScenarioAnalysis, EntityType } from './input/valueObjects';
import { Character } from './character/entities';
import { CharacterProfile } from './character/valueObjects';
import { GameLocation } from './world/entities';
import { PerformanceMetrics } from './operations/valueObjects';

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
  metadata: {
    processingTime: number;
    domainsInvolved: string[];
    complexity: number;
  };
  error?: string;
}

/**
 * 域协调器主类
 */
export class DomainCoordinator {
  private characterManager: CharacterManager;
  private worldManager: WorldManager;
  private inputManager: InputManager;
  private operationsManager: OperationsManager;
  private gameContextService?: GameContextService;

  constructor(
    private llmService: LLMService,
    private logger: Logger,
    gameContextService?: GameContextService,
    private databaseService?: any
  ) {
    this.characterManager = new CharacterManager(llmService, logger, databaseService);
    this.worldManager = new WorldManager(llmService, logger);
    this.inputManager = new InputManager(llmService, logger, gameContextService);
    this.operationsManager = new OperationsManager(logger);
    this.gameContextService = gameContextService;

    this.logger.info('Domain Coordinator initialized with all domain managers');
  }

  /**
   * 初始化游戏世界
   */
  async initializeGame(): Promise<void> {
    this.logger.info('Initializing game through domain coordination...');

    const startTime = Date.now();

    try {
      // 初始化世界
      await this.worldManager.initializeWorld();

      // 创建初始角色
      await this.createInitialCharacters();

      const processingTime = Date.now() - startTime;
      
      // 记录性能指标
      this.operationsManager.recordPerformance({
        operation: 'game_initialization',
        executionTime: processingTime,
        memoryUsage: typeof process !== 'undefined' ? (process as any).memoryUsage().heapUsed : 0,
        cpuUsage: 0,
        timestamp: new Date(),
        success: true
      });

      this.logger.info(`Game initialization completed in ${processingTime}ms`);
    } catch (error) {
      this.operationsManager.recordError({
        id: `error_${Date.now()}`,
        type: 'initialization_error',
        message: (error as Error).message,
        stackTrace: (error as Error).stack,
        context: { operation: 'game_initialization' },
        severity: 'critical',
        timestamp: new Date(),
        resolved: false
      });
      throw error;
    }
  }

  /**
   * 处理玩家输入 - 主要的域协调流程
   */
  async processPlayerInput(
    sessionId: string,
    playerId: string,
    playerInput: string,
    gameContext: GameContext
  ): Promise<DomainCoordinationResult> {
    const startTime = Date.now();
    const domainsInvolved: string[] = ['input'];

    this.logger.info(`Processing player input: "${playerInput}"`, {
      sessionId,
      playerId,
      component: 'DomainCoordinator',
      operation: 'process_input',
      currentLocation: gameContext.currentLocation
    });

    try {
      // 1. 输入域分析
      this.logger.debug('Starting input analysis', null, {
        sessionId,
        component: 'DomainCoordinator'
      });
      
      let contextData;
      if (this.gameContextService) {
        try {
          // 使用GameContextService获取动态上下文
          const gameContext = await this.gameContextService.getGameContext(sessionId, playerId);
          contextData = {
            knownCharacters: gameContext.nearbyCharacters.map(char => char.name),
            knownLocations: gameContext.availableLocations.map(loc => loc.name),
            currentLocation: gameContext.currentLocation.name,
            recentEvents: gameContext.recentConversation.slice(-5).map(conv => ({
              type: 'conversation',
              content: conv.content,
              speaker: conv.speaker,
              timestamp: conv.timestamp
            }))
          };
          
          this.logger.debug('Using dynamic game context', {
            currentLocation: gameContext.currentLocation.name,
            nearbyCharactersCount: gameContext.nearbyCharacters.length,
            recentConversationCount: gameContext.recentConversation.length,
            component: 'DomainCoordinator'
          });
        } catch (error) {
          this.logger.warn('Failed to get dynamic context, using basic context', error as Error);
          contextData = {
            knownCharacters: await this.getKnownCharacterNames(),
            knownLocations: await this.getKnownLocationNames(),
            currentLocation: gameContext.currentLocation,
            recentEvents: []
          };
        }
      } else {
        // 备用方案：使用静态方法
        contextData = {
          knownCharacters: await this.getKnownCharacterNames(),
          knownLocations: await this.getKnownLocationNames(),
          currentLocation: gameContext.currentLocation,
          recentEvents: []
        };
      }
      
      const inputAnalysis = await this.inputManager.analyzeInput(
        sessionId,
        playerId,
        playerInput,
        contextData
      );

      // 记录输入处理结果
      this.logger.logInputProcessing(sessionId, playerId, playerInput, inputAnalysis.classification);

      // 2. 根据分析结果决定域协调策略
      let result: DomainCoordinationResult;

      if (inputAnalysis.complexAnalysis?.isComplex) {
        this.logger.debug('Processing as complex scenario', {
          complexityScore: inputAnalysis.complexAnalysis.complexityScore,
          requiredDomains: inputAnalysis.complexAnalysis.requiredDomains
        }, { sessionId, component: 'DomainCoordinator' });
        
        result = await this.handleComplexScenario(
          inputAnalysis,
          gameContext,
          domainsInvolved
        );
      } else {
        this.logger.debug('Processing as simple scenario', {
          intent: inputAnalysis.classification.intent,
          confidence: inputAnalysis.classification.confidence
        }, { sessionId, component: 'DomainCoordinator' });
        
        result = await this.handleSimpleScenario(
          inputAnalysis,
          gameContext,
          domainsInvolved
        );
      }

      // 3. 记录处理结果
      await this.recordProcessingResult(inputAnalysis, result, startTime, sessionId);

      // 记录位置变更
      if (result.stateChanges.locationChange) {
        this.logger.logLocationChange(
          sessionId,
          playerId,
          gameContext.currentLocation,
          result.stateChanges.locationChange,
          true
        );
      }

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.operationsManager.recordError({
        id: `error_${Date.now()}`,
        type: 'input_processing_error',
        message: (error as Error).message,
        stackTrace: (error as Error).stack,
        context: { sessionId, playerId, playerInput },
        severity: 'high',
        timestamp: new Date(),
        resolved: false
      });

      this.logger.error('Failed to process player input', error as Error, {
        sessionId,
        playerId,
        component: 'DomainCoordinator',
        processingTime
      });

      return {
        success: false,
        responses: {},
        stateChanges: {},
        metadata: {
          processingTime,
          domainsInvolved,
          complexity: 0
        },
        error: (error as Error).message
      };
    }
  }

  /**
   * 处理复杂场景
   */
  private async handleComplexScenario(
    inputAnalysis: any,
    gameContext: GameContext,
    domainsInvolved: string[]
  ): Promise<DomainCoordinationResult> {
    const startTime = Date.now();
    const responses: any = {};
    const stateChanges: any = {};
    
    const classification = inputAnalysis.classification;
    const complexAnalysis = inputAnalysis.complexAnalysis;

    // 根据需要的域执行协调
    for (const domain of complexAnalysis.requiredDomains) {
      switch (domain) {
        case 'character':
          domainsInvolved.push('character');
          const characterResult = await this.handleCharacterDomain(classification, gameContext);
          responses.characterResponses = characterResult.responses;
          stateChanges.characterUpdates = characterResult.updates;
          break;

        case 'world':
          domainsInvolved.push('world');
          const worldResult = await this.handleWorldDomain(classification, gameContext);
          responses.locationDescription = worldResult.description;
          stateChanges.worldUpdates = worldResult.updates;
          if (worldResult.locationChange) {
            stateChanges.locationChange = worldResult.locationChange;
          }
          break;
      }
    }

    // 生成综合叙述
    responses.narrative = await this.generateComplexNarrative(
      inputAnalysis,
      responses,
      gameContext
    );

    const processingTime = Date.now() - startTime;
    
    return {
      success: true,
      responses,
      stateChanges,
      metadata: {
        processingTime,
        domainsInvolved,
        complexity: complexAnalysis.complexityScore
      }
    };
  }

  /**
   * 处理简单场景
   */
  private async handleSimpleScenario(
    inputAnalysis: any,
    gameContext: GameContext,
    domainsInvolved: string[]
  ): Promise<DomainCoordinationResult> {
    const startTime = Date.now();
    const classification = inputAnalysis.classification;
    const responses: any = {};
    const stateChanges: any = {};

    // 根据主要意图选择处理方式
    switch (classification.intent) {
      case 'dialogue':
      case 'character_interaction':
        domainsInvolved.push('character');
        const characterResult = await this.handleCharacterDomain(classification, gameContext);
        responses.characterResponses = characterResult.responses;
        responses.narrative = characterResult.responses[0] || 'Character interaction completed.';
        stateChanges.characterUpdates = characterResult.updates;
        break;

      case 'movement':
      case 'exploration':
      case 'location_query':
        domainsInvolved.push('world');
        const worldResult = await this.handleWorldDomain(classification, gameContext);
        responses.locationDescription = worldResult.description;
        responses.narrative = worldResult.description;
        stateChanges.worldUpdates = worldResult.updates;
        if (worldResult.locationChange) {
          stateChanges.locationChange = worldResult.locationChange;
        }
        break;

      default:
        responses.narrative = await this.generateDefaultResponse(classification, gameContext);
    }

    const processingTime = Date.now() - startTime;
    
    return {
      success: true,
      responses,
      stateChanges,
      metadata: {
        processingTime,
        domainsInvolved,
        complexity: classification.confidence || 0.5
      }
    };
  }

  /**
   * 处理角色域逻辑
   */
  private async handleCharacterDomain(
    classification: InputClassification,
    gameContext: GameContext
  ): Promise<{ responses: string[]; updates: any[] }> {
    const responses: string[] = [];
    const updates: any[] = [];

    // 获取当前位置的角色
    const locationCharacters = await this.getCharactersInLocation(gameContext.currentLocation);

    for (const character of locationCharacters) {
      // 生成角色响应
      const response = await this.characterManager.generateCharacterResponse(
        character,
        {
          playerInput: classification.intent,
          context: gameContext,
          emotionalTone: classification.emotionalTone
        }
      );

      responses.push(response);

      // 模拟角色状态更新
      updates.push({
        characterId: character.id,
        lastInteraction: new Date(),
        emotionalChange: { mood: classification.emotionalTone }
      });
    }

    return { responses, updates };
  }

  /**
   * 处理世界域逻辑
   */
  private async handleWorldDomain(
    classification: InputClassification,
    gameContext: GameContext
  ): Promise<{ description: string; updates: any[]; locationChange?: string }> {
    let description = '';
    const updates: any[] = [];
    let locationChange: string | undefined;

    this.logger.debug('Handling world domain logic', {
      intent: classification.intent,
      currentLocation: gameContext.currentLocation
    }, { component: 'DomainCoordinator', operation: 'world_domain' });

    if (classification.intent === 'movement') {
      // 处理移动
      const targetLocation = this.extractTargetLocation(classification);
      if (targetLocation) {
        this.logger.debug('Processing movement request', {
          from: gameContext.currentLocation,
          to: targetLocation
        }, { component: 'DomainCoordinator' });
        
        const movementResult = await this.worldManager.processLocationMovement(
          gameContext.currentLocation,
          targetLocation,
          gameContext.playerId
        );

        if (movementResult.success) {
          description = movementResult.sceneDescription || 'You have moved to a new location.';
          locationChange = targetLocation;
          updates.push({
            type: 'location_activity',
            locationId: targetLocation,
            change: 'player_arrived'
          });
          
          this.logger.info('Movement completed successfully', {
            component: 'DomainCoordinator',
            operation: 'movement',
            fromLocation: gameContext.currentLocation,
            toLocation: targetLocation
          });
        } else {
          description = movementResult.message || 'Movement failed for unknown reasons.';
          this.logger.warn('Movement failed', {
            component: 'DomainCoordinator',
            reason: movementResult.message,
            targetLocation,
            fromLocation: gameContext.currentLocation
          });
        }
      } else {
        description = 'I could not determine the target location for your movement.';
        this.logger.warn('No target location found in movement intent', {
          component: 'DomainCoordinator',
          targetLocation: classification.targetLocation,
          targetCharacter: classification.targetCharacter
        });
      }
    } else {
      // 获取当前位置上下文
      const locationContext = await this.worldManager.getLocationContext(gameContext.currentLocation);
      description = locationContext.scene?.generateFullDescription() || 
        locationContext.location.description;
    }

    return { description, updates, locationChange };
  }

  /**
   * 生成复杂场景叙述
   */
  private async generateComplexNarrative(
    inputAnalysis: any,
    responses: any,
    gameContext: GameContext
  ): Promise<string> {
    const prompt = `
创建一个综合的游戏叙述，整合以下元素：

角色响应：${JSON.stringify(responses.characterResponses || [])}
位置描述：${responses.locationDescription || ''}
玩家输入：${inputAnalysis.preprocessed.originalInput}
游戏上下文：${JSON.stringify(gameContext)}

请生成一个流畅、连贯的叙述：
`;

    try {
      const response = await this.llmService.generateText(prompt, {
        maxTokens: 300
      });
      
      return response || 'The story continues...';
    } catch (error) {
      this.logger.error('Error generating complex narrative:', error as Error);
      return this.getFallbackNarrative(responses);
    }
  }

  /**
   * 生成默认响应
   */
  private async generateDefaultResponse(
    classification: InputClassification,
    gameContext: GameContext
  ): Promise<string> {
    return `You ${classification.intent} in ${gameContext.currentLocation}. ${classification.emotionalTone === 'confused' ? 'You feel a bit confused about what to do next.' : 'The world responds to your actions.'}`;
  }

  /**
   * 记录处理结果
   */
  private async recordProcessingResult(
    inputAnalysis: any,
    result: DomainCoordinationResult,
    startTime: number,
    sessionId: string
  ): Promise<void> {
    const processingTime = Date.now() - startTime;

    // 记录域协调性能
    this.logger.logDomainCoordination(
      sessionId,
      result.metadata.domainsInvolved,
      processingTime,
      result.success
    );

    // 记录性能指标
    this.operationsManager.recordPerformance({
      operation: 'domain_coordination',
      executionTime: processingTime,
      memoryUsage: typeof process !== 'undefined' ? (process as any).memoryUsage().heapUsed : 0,
      cpuUsage: 0,
      timestamp: new Date(),
      success: result.success
    });

    // 更精确的LLM成本记录
    if (result.responses.narrative) {
      // 估算token数量（简单的字符数除以4的方式）
      const estimatedTokens = Math.ceil((result.responses.narrative.length + 
        (inputAnalysis.preprocessed?.originalInput?.length || 0)) / 4);
      
      // 根据估算的token数计算成本（每1000token约$0.002）
      const estimatedCost = (estimatedTokens / 1000) * 0.002;
      
      this.operationsManager.recordCost({
        provider: 'llm_service',
        operation: 'narrative_generation',
        tokensUsed: estimatedTokens,
        cost: estimatedCost,
        currency: 'USD',
        timestamp: new Date()
      });
      
      this.logger.debug('LLM cost recorded', {
        estimatedTokens,
        estimatedCost,
        component: 'DomainCoordinator'
      });
    }

    // 记录附加的LLM操作成本
    if (result.responses.characterResponses && result.responses.characterResponses.length > 0) {
      result.responses.characterResponses.forEach((response: string, index: number) => {
        if (response && response.length > 0) {
          const tokens = Math.ceil(response.length / 4);
          const cost = (tokens / 1000) * 0.002;
          
          this.operationsManager.recordCost({
            provider: 'llm_service',
            operation: `character_response_${index}`,
            tokensUsed: tokens,
            cost: cost,
            currency: 'USD',
            timestamp: new Date()
          });
        }
      });
    }
  }

  /**
   * 获取系统状态摘要
   */
  async getSystemStatus(): Promise<{
    health: any;
    statistics: any;
    activeAlerts: any[];
  }> {
    const health = await this.operationsManager.getSystemHealth();
    const statistics = this.operationsManager.getStatistics();
    const activeAlerts = this.operationsManager.getActiveAlerts();

    return { health, statistics, activeAlerts };
  }

  /**
   * 清理系统数据
   */
  async cleanupSystem(olderThanHours: number = 24): Promise<void> {
    const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    this.operationsManager.cleanupOldData(cutoffDate);
    this.inputManager.cleanupExpiredSessions(olderThanHours);
    
    this.logger.info(`System cleanup completed for data older than ${olderThanHours} hours`);
  }

  /**
   * 获取已知角色名称
   */
  private async getKnownCharacterNames(): Promise<string[]> {
    try {
      // 使用角色管理器获取实际的角色数据
      const characters = await this.characterManager.getAllCharacters();
      const characterNames = characters.map(char => char.name).filter(name => name && name.trim() !== '');
      
      if (characterNames.length === 0) {
        this.logger.info('No characters found, returning default character names', {
          component: 'DomainCoordinator'
        });
        return ['Guard', 'Merchant', 'Innkeeper', 'Villager'];
      }
      
      this.logger.debug('Retrieved character names from character manager', {
        count: characterNames.length,
        names: characterNames,
        component: 'DomainCoordinator'
      });
      
      return characterNames;
    } catch (error) {
      this.logger.warn('Failed to get character names from manager, using fallback', error as Error);
      return ['Guard', 'Merchant', 'Innkeeper'];
    }
  }

  /**
   * 获取已知位置名称
   */
  private async getKnownLocationNames(): Promise<string[]> {
    const world = this.worldManager.getWorld();
    return world.getAllLocations().map(loc => loc.name);
  }

  /**
   * 获取位置中的角色
   */
  private async getCharactersInLocation(locationId: string): Promise<Character[]> {
    try {
      this.logger.debug(`Getting characters for location: ${locationId}`);
      
      // 优先从角色管理器获取实际数据
      const charactersInLocation = await this.characterManager.getCharactersInLocation(locationId);
      
      if (charactersInLocation && charactersInLocation.length > 0) {
        this.logger.info(`Found ${charactersInLocation.length} characters in location ${locationId}`, {
          characterNames: charactersInLocation.map(c => c.name),
          component: 'DomainCoordinator'
        });
        return charactersInLocation;
      }
      
      // 如果没有找到角色，检查是否需要为该位置动态创建角色
      const shouldCreateCharacter = await this.shouldCreateCharacterForLocation(locationId);
      
      if (shouldCreateCharacter) {
        this.logger.info(`Creating dynamic character for location: ${locationId}`);
        const dynamicCharacter = await this.createDynamicCharacterForLocation(locationId);
        return [dynamicCharacter];
      }
      
      this.logger.info(`No characters found in location ${locationId} and no dynamic character needed`);
      return [];
      
    } catch (error) {
      this.logger.error('Failed to get characters in location', error as Error, {
        locationId,
        component: 'DomainCoordinator'
      });
      return [];
    }
  }

  /**
   * 判断是否应该为位置创建角色
   */
  private async shouldCreateCharacterForLocation(locationId: string): Promise<boolean> {
    try {
      // 获取位置信息
      const locationContext = await this.worldManager.getLocationContext(locationId);
      
      // 根据位置类型和特性决定是否需要角色
      const location = locationContext.location;
      
      // 只有在人口密集的地方才创建角色
      if (location.locationType === 'urban' || 
          locationId.toLowerCase().includes('town') ||
          locationId.toLowerCase().includes('market') ||
          locationId.toLowerCase().includes('tavern')) {
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.warn('Failed to check if character should be created, defaulting to false', error as Error);
      return false;
    }
  }

  /**
   * 为位置动态创建角色
   */
  private async createDynamicCharacterForLocation(locationId: string): Promise<Character> {
    // 根据位置类型生成适当的角色配置
    let characterProfile: CharacterProfile;
    
    if (locationId.toLowerCase().includes('guard') || locationId.toLowerCase().includes('gate')) {
      characterProfile = {
        id: `guard_${locationId}_${Date.now()}`,
        name: 'Town Guard',
        background: 'A dedicated guard protecting this area',
        appearance: 'Tall and sturdy, wearing leather armor',
        personality: {
          traits: { dutiful: 0.9, helpful: 0.7, cautious: 0.8 },
          values: { justice: 0.9, order: 0.8, protection: 0.9 },
          goals: ['protect citizens', 'maintain order'],
          fears: ['chaos', 'crime'],
          motivations: ['duty', 'honor', 'community']
        }
      };
    } else if (locationId.toLowerCase().includes('market') || locationId.toLowerCase().includes('shop')) {
      characterProfile = {
        id: `merchant_${locationId}_${Date.now()}`,
        name: 'Local Merchant',
        background: 'A friendly merchant who knows the local area well',
        appearance: 'Well-dressed with a warm smile',
        personality: {
          traits: { friendly: 0.9, knowledgeable: 0.8, helpful: 0.7 },
          values: { trade: 0.8, community: 0.7, prosperity: 0.8 },
          goals: ['help customers', 'grow business'],
          fears: ['loss', 'conflict'],
          motivations: ['profit', 'community service']
        }
      };
    } else {
      characterProfile = {
        id: `resident_${locationId}_${Date.now()}`,
        name: 'Local Resident',
        background: `A resident of ${locationId} who can provide local information`,
        appearance: 'A friendly local person',
        personality: {
          traits: { helpful: 0.8, friendly: 0.7, knowledgeable: 0.6 },
          values: { community: 0.8, helpfulness: 0.7 },
          goals: ['help visitors', 'share local knowledge'],
          fears: ['conflict', 'strangers'],
          motivations: ['community spirit', 'helpfulness']
        }
      };
    }

    // 使用角色管理器创建角色（这将自动处理注册和持久化）
    const character = this.characterManager.createCharacter(characterProfile);
    
    // 更新角色位置
    await this.characterManager.updateCharacterLocation(character.id, locationId);
    
    this.logger.info(`Created dynamic character for location`, {
      characterId: character.id,
      characterName: character.name,
      locationId,
      component: 'DomainCoordinator'
    });
    
    return character;
  }

  /**
   * 从分类中提取目标位置
   */
  private extractTargetLocation(classification: InputClassification): string | undefined {
    // 优先使用targetLocation字段
    if (classification.targetLocation) {
      return classification.targetLocation;
    }
    
    // 如果没有明确的目标位置，尝试从intent中推断
    if (classification.intent === 'movement') {
      // 可以添加基于自然语言处理的位置提取逻辑
      // 这里暂时返回undefined，让调用者处理
      this.logger.debug('Movement intent detected but no target location specified', {
        component: 'DomainCoordinator',
        classification
      });
    }
    
    return undefined;
  }

  /**
   * 获取备用叙述
   */
  private getFallbackNarrative(responses: any): string {
    const parts = [];
    
    if (responses.characterResponses?.length > 0) {
      parts.push(responses.characterResponses[0]);
    }
    
    if (responses.locationDescription) {
      parts.push(responses.locationDescription);
    }
    
    return parts.length > 0 ? parts.join(' ') : 'The story continues in unexpected ways...';
  }

  /**
   * 创建初始角色
   */
  private async createInitialCharacters(): Promise<void> {
    try {
      // 创建多个初始角色以供游戏交互
      const characterProfiles: CharacterProfile[] = [
        {
          id: 'town_guard',
          name: 'Town Guard',
          background: 'A dedicated guard who protects the town square',
          appearance: 'Tall and sturdy, wearing leather armor',
          personality: {
            traits: { friendly: 0.7, dutiful: 0.9, cautious: 0.6 },
            values: { justice: 0.9, order: 0.8, protection: 0.9 },
            goals: ['protect citizens', 'maintain order'],
            fears: ['chaos', 'crime'],
            motivations: ['duty', 'honor', 'community']
          }
        },
        {
          id: 'local_merchant',
          name: 'Market Merchant',
          background: 'An experienced trader who knows everyone in town',
          appearance: 'Well-dressed with a friendly demeanor',
          personality: {
            traits: { charismatic: 0.8, knowledgeable: 0.9, ambitious: 0.7 },
            values: { trade: 0.9, community: 0.8, prosperity: 0.8 },
            goals: ['expand business', 'help customers'],
            fears: ['economic downturn', 'conflict'],
            motivations: ['profit', 'reputation', 'community service']
          }
        },
        {
          id: 'wise_elder',
          name: 'Village Elder',
          background: 'An old resident who remembers the history of this place',
          appearance: 'Elderly with kind eyes and weathered hands',
          personality: {
            traits: { wise: 0.9, patient: 0.8, storyteller: 0.9 },
            values: { tradition: 0.9, wisdom: 0.9, peace: 0.8 },
            goals: ['preserve history', 'guide young people'],
            fears: ['forgotten traditions', 'conflict'],
            motivations: ['legacy', 'wisdom sharing', 'peace']
          }
        }
      ];

      // 创建所有初始角色
      for (const profile of characterProfiles) {
        try {
          this.characterManager.createCharacter(profile);
          this.logger.debug(`Created initial character: ${profile.name}`, {
            characterId: profile.id,
            component: 'DomainCoordinator'
          });
        } catch (error) {
          this.logger.warn(`Failed to create character ${profile.name}`, error as Error, {
            characterId: profile.id,
            component: 'DomainCoordinator'
          });
        }
      }

      this.logger.info(`Attempted to create ${characterProfiles.length} initial characters`, {
        characterIds: characterProfiles.map(p => p.id),
        component: 'DomainCoordinator'
      });
    } catch (error) {
      this.logger.error('Failed to create initial characters', error as Error, {
        component: 'DomainCoordinator'
      });
      // 即使创建失败也不抛出异常，保证游戏能够启动
    }
  }
}