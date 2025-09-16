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
  private sessions: Map<string, GameSession> = new Map();
  private serviceFactory: DefaultServiceFactory;

  constructor() {
    // Initialize the service factory and register all services
    this.serviceFactory = new DefaultServiceFactory();
    this.serviceFactory.registerAllServices();
    
    this.logger = container.resolve<Logger>(SERVICE_IDENTIFIERS.LOGGER);
    this.databaseService = container.resolve<DatabaseService>(SERVICE_IDENTIFIERS.DATABASE_SERVICE);
    this.worldLoreService = container.resolve<WorldLoreService>(SERVICE_IDENTIFIERS.WORLD_LORE_SERVICE);
    this.sessionEngine = new GameSessionEngine();
    this.domainCoordinator = container.resolve<DomainCoordinator>(SERVICE_IDENTIFIERS.DOMAIN_COORDINATOR);
    
    // Initialize game mode manager
    const llmService = container.resolve<LLMService>(SERVICE_IDENTIFIERS.LLM_SERVICE);
    this.gameModeManager = new GameModeManager(llmService, this.logger, this.databaseService);
    
    this.logger.info('Orchestrator initialized with domain architecture and game mode system');
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
  async createSession(sessionIdOrPlayerId: string = 'player1', inspiration?: string): Promise<GameSession> {
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
      
      const gameSession: GameSession = {
        id: sessionId,
        playerId,
        createdAt: new Date(),
        lastActivity: new Date(),
        isActive: true,
        metadata: { currentLocation: 'town_square' }
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
      try {
        this.logger.info(`Generating world lore for session ${sessionId}...`);
        const loreOptions = inspiration ? { inspiration } : {};
        await this.worldLoreService.generateWorldLoreForSession(sessionId, loreOptions);
        this.logger.info(`World lore generated successfully for session ${sessionId}`);
      } catch (loreError) {
        // 即使世界背景故事生成失败，也不影响会话创建
        this.logger.warn(`Failed to generate world lore for session ${sessionId}:`, loreError as Error);
      }
      
      this.logger.info(`Created new session ${sessionId} for player ${playerId}`);
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
      // Note: This would require implementing a getSession method in DatabaseService
      this.logger.warn(`Session ${sessionId} not found in memory`);
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
        is_active: session.isActive
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
      
      // 构建游戏上下文
      const gameContext: GameContext = {
        sessionId: session.id,
        playerId: session.playerId,
        currentLocation: session.metadata.currentLocation || 'town_square',
        activeCharacters: ['town_guard'], // 可以从会话状态获取
        gameState: {}, // 可以从数据库加载
        timestamp: new Date()
      };
      
      // 使用域协调器处理输入
      const coordinationResult = await this.domainCoordinator.processPlayerInput(
        session.id,
        playerId,
        inputText,
        gameContext
      );
      
      // 更新会话状态
      if (coordinationResult.stateChanges.locationChange) {
        session.metadata.currentLocation = coordinationResult.stateChanges.locationChange;
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
}