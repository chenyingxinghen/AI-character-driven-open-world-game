import { GameSessionEngine } from './engine/GameSessionEngine';
import { DomainCoordinator, GameContext, DomainCoordinationResult } from './domains/DomainCoordinator';
import { GameModeManager } from './domains/gameMode/aggregates';
import { GameModeType, ModeConfig, FreeModeConfig, ScriptModeConfig } from './domains/gameMode/valueObjects';
import { DefaultServiceFactory, SERVICE_IDENTIFIERS } from './services/factory';
import { Logger } from './services/Logger';
import { LLMService } from './services/llm/LLMService';
import { container } from './services/DependencyInjectionContainer';
import { DatabaseService } from './services/database/DatabaseService';
import { WorldLoreService } from './services/world/WorldLoreService';
import { StoryOutlineGeneratorService } from './services/gameMode/StoryOutlineGeneratorService';
import { EnhancedInitialSceneService } from './services/gameMode/EnhancedInitialSceneService';
import { SimplifiedDirectorEngine } from './engine/SimplifiedDirectorEngine';
import { v4 as uuidv4 } from 'uuid';

// Session interface
export interface GameSession {
  id: string;
  playerId: string;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
  metadata: Record<string, any>;
}

// Orchestrator result interface
export interface OrchestratorResult {
  success: boolean;
  session: GameSession;
  coordinationResult?: DomainCoordinationResult;
  error?: string;
  executionTime: number;
}

export class Orchestrator {
  private sessionEngine: GameSessionEngine;
  private domainCoordinator: DomainCoordinator;
  private gameModeManager: GameModeManager;
  private logger: Logger;
  private databaseService: DatabaseService;
  private worldLoreService: WorldLoreService;
  private storyOutlineGeneratorService: StoryOutlineGeneratorService;
  private enhancedInitialSceneService: EnhancedInitialSceneService;
  private simplifiedDirectorEngine: SimplifiedDirectorEngine;
  private sessions: Map<string, GameSession> = new Map();

  constructor() {
    this.logger = container.resolve<Logger>(SERVICE_IDENTIFIERS.LOGGER);
    this.databaseService = container.resolve<DatabaseService>(SERVICE_IDENTIFIERS.DATABASE_SERVICE);
    this.worldLoreService = container.resolve<WorldLoreService>(SERVICE_IDENTIFIERS.WORLD_LORE_SERVICE);
    this.storyOutlineGeneratorService = container.resolve<StoryOutlineGeneratorService>(SERVICE_IDENTIFIERS.STORY_OUTLINE_GENERATOR_SERVICE);
    this.enhancedInitialSceneService = container.resolve<EnhancedInitialSceneService>(SERVICE_IDENTIFIERS.ENHANCED_INITIAL_SCENE_SERVICE);
    this.sessionEngine = new GameSessionEngine();
    this.domainCoordinator = container.resolve<DomainCoordinator>(SERVICE_IDENTIFIERS.DOMAIN_COORDINATOR);

    // Initialize game mode manager
    const llmService = container.resolve<LLMService>(SERVICE_IDENTIFIERS.LLM_SERVICE);
    this.gameModeManager = new GameModeManager(llmService, this.logger, this.databaseService);

    // Initialize simplified director engine
    this.simplifiedDirectorEngine = new SimplifiedDirectorEngine(
      llmService,
      this.databaseService,
      this.logger
    );

    this.logger.info('Orchestrator initialized with enhanced story and scene generation');
  }

  /**
   * 初始化游戏
   */
  async initializeGame(): Promise<void> {
    try {
      await this.domainCoordinator.initializeGame();
      this.logger.info('Game initialized successfully');
    } catch (error) {
      this.logger.error('Error initializing game:', error as Error);
      throw error;
    }
  }

  /**
   * 创建新的游戏会话
   */
  async createSession(
    sessionIdOrPlayerId: string = 'player1',
    inspiration?: string,
    gameMode: 'free' | 'script' | 'guided_free' = 'guided_free',
    playerPreferences?: any,
    onProgress?: (step: string, message: string) => void,
    worldOptions?: {
      worldName?: string,
      worldDescription?: string,
      setting?: 'fantasy' | 'medieval' | 'modern' | 'sci-fi' | 'mixed',
      complexity?: 'simple' | 'moderate' | 'complex',
      locale?: 'zh' | 'en'
    }
  ): Promise<GameSession> {
    try {
      // Check if the first parameter is a valid UUID (session ID) or a player ID
      const isSessionId = sessionIdOrPlayerId.includes('-') && sessionIdOrPlayerId.length > 20;

      let sessionId: string;
      let playerId: string;

      if (isSessionId) {
        // If it's a session ID, use it directly and generate a player ID
        sessionId = sessionIdOrPlayerId;
        playerId = uuidv4();
      } else {
        // If it's a player ID, generate a new session ID
        playerId = sessionIdOrPlayerId;
        sessionId = this.sessionEngine.createSession().id;
      }

      // 初始位置默认值,将在后续根据模式更新
      let initialLocation = 'town_square';

      const gameSession: GameSession = {
        id: sessionId,
        playerId,
        createdAt: new Date(),
        lastActivity: new Date(),
        isActive: true,
        metadata: { currentLocation: initialLocation, gameMode, hasStoryOutline: false }
      };

      this.sessions.set(sessionId, gameSession);

      // 保存会话到数据库（如果不是从数据库创建的）
      if (!isSessionId) {
        await this.databaseService.updateSession(sessionId, {
          player_id: playerId,
          created_at: gameSession.createdAt,
          last_activity: gameSession.lastActivity,
          is_active: true
        });
      }

      // 生成世界背景故事
      let worldLore: any[] = [];
      try {
        const loreOptions = {
          worldName: worldOptions?.worldName,
          worldDescription: worldOptions?.worldDescription,
          inspiration: inspiration,
          setting: worldOptions?.setting || 'fantasy',
          complexity: worldOptions?.complexity || 'moderate',
          locale: worldOptions?.locale || 'zh'
        };
        onProgress?.('lore', '正在利用灵感构建世界背景（历史、传说、地理）...');
        worldLore = await this.worldLoreService.generateWorldLoreForSession(sessionId, loreOptions);
        onProgress?.('lore_done', '世界背景构建完成。');
      } catch (loreError) {
        this.logger.warn(`Failed to generate world lore for session ${sessionId}:`, loreError as Error);
      }

      // 根据游戏模式生成剧情大纲和初始场景
      if (gameMode !== 'free') {
        try {
          this.logger.info(`Generating story outline and initial scene for ${gameMode} mode...`);
          onProgress?.('outline', '正在基于历史背景编织主线剧情大纲...');
          // 生成增强初始场景（包含剧情大纲生成）
          const initialScenePackage = await this.enhancedInitialSceneService.generateEnhancedInitialScene({
            sessionId,
            worldLore,
            gameMode,
            playerPreferences: {
              startingLocationPreference: playerPreferences?.startingLocationPreference,
              characterInteractionLevel: playerPreferences?.characterInteractionLevel || 'medium',
              atmospherePreference: playerPreferences?.atmospherePreference,
              difficultyLevel: playerPreferences?.difficultyLevel || 'normal',
              storyPacing: playerPreferences?.storyPacing || 'medium'
            }
          });
          onProgress?.('scene', '正在布置初始场景与角色互动锚点...');

          // 使用动态生成的起始位置
          initialLocation = initialScenePackage.startingLocation.id;

          // 更新会话元数据
          gameSession.metadata = {
            ...gameSession.metadata,
            hasStoryOutline: true,
            currentLocation: initialLocation,  // 使用动态生成的位置
            storyContext: initialScenePackage.storyContext,
            nearbyCharacters: initialScenePackage.nearbyCharacters.map(c => c.id),
            initialSceneGenerated: true
          };

          this.logger.info(`Story outline and initial scene generated for session ${sessionId}`, {
            locationId: initialScenePackage.startingLocation.id,
            locationName: initialScenePackage.startingLocation.name,
            characterCount: initialScenePackage.nearbyCharacters.length,
            currentPlotPoint: initialScenePackage.storyContext.currentPlotPoint
          });

        } catch (sceneError) {
          this.logger.warn(`Failed to generate story outline/initial scene for session ${sessionId}:`, sceneError as Error);
        }
      }

      this.logger.info(`Created new session ${sessionId} for player ${playerId} with mode ${gameMode}`, {
        initialLocation: initialLocation
      });
      return gameSession;
    } catch (error) {
      this.logger.error(`Error creating session:`, error as Error);
      throw error;
    }
  }

  /**
   * 加载现有会话
   */
  async loadSession(sessionId: string): Promise<GameSession | null> {
    try {
      // Check if session exists in memory
      if (this.sessions.has(sessionId)) {
        const session = this.sessions.get(sessionId)!;
        session.lastActivity = new Date();
        return session;
      }

      // Try to load from database
      try {
        const sessionData = await this.databaseService.getSession(sessionId);
        if (sessionData) {
          const gameSession: GameSession = {
            id: sessionData.id,
            playerId: sessionData.player_id,
            createdAt: sessionData.created_at,
            lastActivity: new Date(),
            isActive: sessionData.is_active !== false,
            metadata: sessionData.game_state || {}
          };

          // Store in memory for future access
          this.sessions.set(sessionId, gameSession);

          // 触发深层状态同步（位置、角色等）
          await this.domainCoordinator.syncSessionState(sessionId);

          this.logger.info(`Session ${sessionId} loaded and synchronized`);
          return gameSession;
        }
      } catch (dbError) {
        this.logger.warn(`Failed to load session ${sessionId} from database:`, dbError as Error);
      }

      this.logger.warn(`Session ${sessionId} not found in memory or database`);
      return null;
    } catch (error) {
      this.logger.error(`Error loading session ${sessionId}:`, error as Error);
      return null;
    }
  }

  /**
   * 保存会话
   */
  async saveSession(sessionId: string): Promise<boolean> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        this.logger.warn(`Session ${sessionId} not found`);
        return false;
      }

      // Update last activity
      session.lastActivity = new Date();

      // Save to database
      await this.databaseService.updateSession(sessionId, {
        last_activity: session.lastActivity,
        is_active: session.isActive,
        current_location: session.metadata.currentLocation,
        game_state: session.metadata
      });

      this.logger.info(`Saved session ${sessionId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error saving session ${sessionId}:`, error as Error);
      return false;
    }
  }

  /**
   * 关闭会话
   */
  async closeSession(sessionId: string): Promise<boolean> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        this.logger.warn(`Session ${sessionId} not found`);
        return false;
      }

      // Mark as inactive
      session.isActive = false;
      session.lastActivity = new Date();

      // Save to database
      await this.databaseService.updateSession(sessionId, {
        last_activity: session.lastActivity,
        is_active: false
      });

      // Remove from memory
      this.sessions.delete(sessionId);

      this.logger.info(`Closed session ${sessionId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error closing session ${sessionId}:`, error as Error);
      return false;
    }
  }

  /**
   * 运行一次游戏循环 - 使用域架构
   */
  async runOnce(inputText: string, sessionId?: string, playerId: string = 'player1'): Promise<OrchestratorResult> {
    const startTime = Date.now();

    try {
      // If no session ID provided, create a new session
      let session: GameSession;
      if (sessionId) {
        const loadedSession = await this.loadSession(sessionId);
        if (!loadedSession) {
          throw new Error(`Session ${sessionId} not found`);
        }
        session = loadedSession;
      } else {
        session = await this.createSession(playerId);
      }

      // Update session activity
      session.lastActivity = new Date();

      // 并行获取动态上下文信息
      const contextInfo = await container.resolve<any>(SERVICE_IDENTIFIERS.GAME_CONTEXT_SERVICE).getGameContext(session.id, playerId);

      // 构建动态游戏上下文
      const gameContext: GameContext = {
        sessionId: session.id,
        playerId: session.playerId,
        currentLocation: contextInfo.currentLocation.id,
        activeCharacters: contextInfo.nearbyCharacters.map((c: any) => c.id),
        gameState: contextInfo.gameState,
        timestamp: new Date(),
        worldLore: contextInfo.worldLore,
        recentConversation: contextInfo.recentConversation.map((c: any) => ({
          speaker: c.speaker,
          content: c.content
        }))
      };

      // 使用动态上下文评估导演决策
      const directorContext = {
        sessionId: session.id,
        playerId: session.playerId,
        currentLocation: contextInfo.currentLocation.id,
        recentActions: contextInfo.recentConversation.map((c: any) => c.content),
        recentStoryEvents: contextInfo.recentStoryEvents,
        storyState: contextInfo.gameState,
        characterStates: contextInfo.nearbyCharacters.reduce((acc: any, curr: any) => {
          acc[curr.id] = { personality: curr.personality };
          return acc;
        }, {}),
        currentTime: new Date()
      };

      // 并行执行导演评估和领域协调 - 性能优化
      this.logger.debug('Starting parallel director evaluation and domain coordination', null, { sessionId: session.id });
      const [evaluation, coordinationResult] = await Promise.all([
        this.simplifiedDirectorEngine.evaluateStoryProgression(directorContext),
        this.domainCoordinator.processPlayerInput(
          session.id,
          playerId,
          inputText,
          gameContext
        )
      ]);

      if (evaluation.shouldIntervene && evaluation.decision) {
        // 执行导演干预
        const intervention = await this.simplifiedDirectorEngine.executeIntervention(evaluation.decision, directorContext);

        // 将导演干预集成到叙述中
        if (coordinationResult.responses.narrative) {
          coordinationResult.responses.narrative = `${intervention.interventionContent}\n\n${coordinationResult.responses.narrative}`;
        } else {
          coordinationResult.responses.narrative = intervention.interventionContent;
        }

        // 记录干预应用
        this.logger.info('Director intervention applied to narrative', {
          sessionId: session.id,
          type: evaluation.decision.interventionType
        });
      }

      // 更新会话状态
      if (coordinationResult.stateChanges.locationChange) {
        session.metadata.currentLocation = coordinationResult.stateChanges.locationChange;
        // 保存会话以持久化位置变更
        await this.saveSession(session.id);
      }

      // Save session
      await this.saveSession(session.id);

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        session,
        coordinationResult,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`Error in runOnce:`, error as Error);

      return {
        success: false,
        session: {
          id: sessionId || 'unknown',
          playerId,
          createdAt: new Date(),
          lastActivity: new Date(),
          isActive: false,
          metadata: {}
        },
        error: (error as Error).message,
        executionTime
      };
    }
  }

  /**
   * 获取系统状态
   */
  async getSystemStatus(): Promise<any> {
    return await this.domainCoordinator.getSystemStatus();
  }

  /**
   * 清理系统数据
   */
  async cleanupSystem(olderThanHours: number = 24): Promise<void> {
    await this.domainCoordinator.cleanupSystem(olderThanHours);
  }

  /**
   * 获取会话状态
   */
  getSessionStatus(sessionId: string): { active: boolean; lastActivity: Date | null } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { active: false, lastActivity: null };
    }

    return {
      active: session.isActive,
      lastActivity: session.lastActivity
    };
  }

  /**
   * 清理过期会话
   */
  async cleanupExpiredSessions(maxAgeMinutes: number = 60): Promise<number> {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      const ageInMinutes = (now.getTime() - session.lastActivity.getTime()) / (1000 * 60);
      if (ageInMinutes > maxAgeMinutes) {
        expiredSessions.push(sessionId);
      }
    }

    let closedCount = 0;
    for (const sessionId of expiredSessions) {
      if (await this.closeSession(sessionId)) {
        closedCount++;
      }
    }

    this.logger.info(`Cleaned up ${closedCount} expired sessions`);
    return closedCount;
  }

  /**
   * 处理背景干预（由服务器定时触发，用于检测停滞和突发事件）
   */
  async processBackgroundIntervention(sessionId: string): Promise<any> {
    try {
      const session = await this.loadSession(sessionId);
      if (!session || !session.isActive) return null;

      // 获取上下文
      const gameContextService = container.resolve<any>(SERVICE_IDENTIFIERS.GAME_CONTEXT_SERVICE);
      const contextInfo = await gameContextService.getGameContext(sessionId, session.playerId);

      const directorContext = {
        sessionId: session.id,
        playerId: session.playerId,
        currentLocation: contextInfo.currentLocation.id,
        recentActions: contextInfo.recentConversation.map((c: any) => c.content),
        recentStoryEvents: contextInfo.recentStoryEvents,
        storyState: contextInfo.gameState,
        characterStates: contextInfo.nearbyCharacters.reduce((acc: any, curr: any) => {
          acc[curr.id] = { personality: curr.personality };
          return acc;
        }, {}),
        currentTime: new Date()
      };

      // 评估是否需要干预
      const evaluation = await this.simplifiedDirectorEngine.evaluateStoryProgression(directorContext);

      // 特殊处理：剧情停滞导致的突发事件（如引入新角色）
      if (evaluation.shouldIntervene && evaluation.decision?.interventionType === 'character_introduction') {
        const params = evaluation.decision.characterParams;
        this.logger.info(`Director introducing new character due to stagnation in session ${sessionId}`, params);

        // 生成并保存新角色
        const newChar = await this.enhancedInitialSceneService.generateAndSaveCharacter(
          sessionId,
          directorContext.currentLocation,
          params?.role || 'mysterious',
          params
        );

        // 更新干预内容，包含角色的出现
        const appearanceDesc = `${newChar.name}（${newChar.role}）突然出现在这里。${newChar.appearance}`;
        evaluation.decision.content = `${appearanceDesc}\n\n${evaluation.decision.content}`;
      }

      if (evaluation.shouldIntervene && evaluation.decision) {
        // 执行干预逻辑（记录到数据库等）
        const result = await this.simplifiedDirectorEngine.executeIntervention(evaluation.decision, directorContext);

        return {
          type: 'director_intervention',
          intervention: result,
          decision: evaluation.decision,
          stagnationLevel: evaluation.stagnationLevel
        };
      }

      return {
        type: 'status_check',
        stagnationLevel: evaluation.stagnationLevel,
        shouldIntervene: false
      };
    } catch (error) {
      this.logger.error(`Error in processBackgroundIntervention for session ${sessionId}:`, error as Error);
      return null;
    }
  }
}