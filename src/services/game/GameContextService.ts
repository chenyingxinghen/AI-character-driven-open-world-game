/**
 * 游戏上下文服务
 * 从数据库获取详细的游戏上下文信息，避免硬编码
 */

import { DatabaseService, ConversationRecord } from '../database/DatabaseService';
import { Logger } from '../Logger';
import { v4 as uuidv4 } from 'uuid';

export interface GameContextInfo {
  sessionId: string;
  playerId: string;
  currentLocation: {
    id: string;
    name: string;
    description: string;
  };
  nearbyCharacters: Array<{
    id: string;
    name: string;
    personality?: string;
  }>;
  recentConversation: Array<{
    timestamp: Date;
    speaker: string;
    content: string;
  }>;
  availableLocations: Array<{
    id: string;
    name: string;
    accessibility: 'direct' | 'indirect' | 'blocked';
  }>;
  gameState: {
    timeOfDay: string;
    weather: string;
    atmosphere: string;
    playerLevel?: number;
    completedQuests?: string[];
  };
  playerPreferences: {
    language: string;
    difficulty: string;
    narrativeStyle: string;
  };
}

export interface InputClassificationContext {
  sessionId: string;
  currentLocation: string;
  nearbyCharacters: string[];
  recentConversation: string[];
  availableLocations?: string[];
}

export class GameContextService {
  constructor(
    private databaseService: DatabaseService,
    private logger: Logger
  ) {}

  /**
   * 获取完整的游戏上下文信息
   */
  async getGameContext(sessionId: string, playerId: string): Promise<GameContextInfo> {
    try {
      this.logger.debug('Fetching game context from database', {
        sessionId,
        playerId,
        component: 'GameContextService'
      });

      // 并行获取各种上下文信息
      const [
        sessionInfo,
        locationInfo,
        charactersInfo,
        conversationHistory,
        gameStateInfo,
        playerPreferences
      ] = await Promise.all([
        this.getSessionInfo(sessionId),
        this.getCurrentLocationInfo(sessionId),
        this.getNearbyCharactersInfo(sessionId),
        this.getRecentConversationHistory(sessionId, 10),
        this.getGameStateInfo(sessionId),
        this.getPlayerPreferences(playerId)
      ]);

      // 获取可达位置信息
      const availableLocations = await this.getAvailableLocations(
        locationInfo.id,
        gameStateInfo.playerLevel || 1
      );

      const context: GameContextInfo = {
        sessionId,
        playerId,
        currentLocation: locationInfo,
        nearbyCharacters: charactersInfo,
        recentConversation: conversationHistory,
        availableLocations,
        gameState: gameStateInfo,
        playerPreferences
      };

      this.logger.debug('Successfully retrieved game context', {
        sessionId,
        locationId: locationInfo.id,
        charactersCount: charactersInfo.length,
        conversationCount: conversationHistory.length,
        component: 'GameContextService'
      });

      return context;
    } catch (error) {
      this.logger.error('Failed to get game context', error as Error, {
        sessionId,
        playerId,
        component: 'GameContextService'
      });

      // 返回最小可用上下文
      return this.getMinimalContext(sessionId, playerId);
    }
  }

  /**
   * 获取适用于输入分类的上下文格式
   */
  async getInputClassificationContext(sessionId: string, playerId: string): Promise<InputClassificationContext> {
    const fullContext = await this.getGameContext(sessionId, playerId);
    
    return {
      sessionId,
      currentLocation: fullContext.currentLocation.name,
      nearbyCharacters: fullContext.nearbyCharacters.map(char => char.name),
      recentConversation: fullContext.recentConversation.map(conv => conv.content),
      availableLocations: fullContext.availableLocations.map(loc => loc.name)
    };
  }

  /**
   * 更新玩家当前位置
   */
  async updatePlayerLocation(sessionId: string, newLocationId: string): Promise<boolean> {
    try {
      await this.databaseService.updateSession(sessionId, {
        current_location: newLocationId,
        last_activity: new Date()
      });

      // 记录位置变更历史
      const conversationRecord: ConversationRecord = {
        id: uuidv4(),
        session_id: sessionId,
        character_id: 'system',
        message_type: 'system_message',
        content: `Player moved to ${newLocationId}`,
        context: { type: 'location_change', newLocation: newLocationId },
        created_at: new Date(),
        updated_at: new Date()
      };
      
      await this.databaseService.storeConversation(conversationRecord);

      this.logger.info('Player location updated', {
        sessionId,
        newLocationId,
        component: 'GameContextService'
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to update player location', error as Error, {
        sessionId,
        newLocationId,
        component: 'GameContextService'
      });
      return false;
    }
  }

  /**
   * 记录对话历史
   */
  async recordConversation(
    sessionId: string,
    speaker: string,
    content: string,
    messageType: 'player_input' | 'character_response' | 'narration' | 'system_message' = 'player_input'
  ): Promise<void> {
    try {
      const conversationRecord: ConversationRecord = {
        id: uuidv4(),
        session_id: sessionId,
        character_id: speaker,
        message_type: messageType,
        content,
        context: { timestamp: new Date(), speaker },
        created_at: new Date(),
        updated_at: new Date()
      };
      
      await this.databaseService.storeConversation(conversationRecord);

      this.logger.debug('Conversation recorded', {
        sessionId,
        speaker,
        messageType,
        component: 'GameContextService'
      });
    } catch (error) {
      this.logger.error('Failed to record conversation', error as Error, {
        sessionId,
        speaker,
        component: 'GameContextService'
      });
    }
  }

  // ===== 私有方法 =====

  private async getSessionInfo(sessionId: string): Promise<any> {
    try {
      return await this.databaseService.getSession(sessionId);
    } catch (error) {
      return { id: sessionId, created_at: new Date(), is_active: true };
    }
  }

  private async getCurrentLocationInfo(sessionId: string): Promise<GameContextInfo['currentLocation']> {
    try {
      const session = await this.databaseService.getSession(sessionId);
      const locationId = session?.current_location || 'town_square';
      
      // 这里应该从位置数据表获取详细信息
      // 暂时返回基本信息，实际实现需要查询locations表
      return {
        id: locationId,
        name: this.getLocationDisplayName(locationId),
        description: `当前位置：${this.getLocationDisplayName(locationId)}`
      };
    } catch (error) {
      return {
        id: 'town_square',
        name: '镇中心广场',
        description: '游戏的起始位置'
      };
    }
  }

  private async getNearbyCharactersInfo(sessionId: string): Promise<GameContextInfo['nearbyCharacters']> {
    try {
      const session = await this.databaseService.getSession(sessionId);
      const locationId = session?.current_location || 'town_square';
      
      // 从角色位置表查询当前位置的角色
      // 这里应该实现实际的数据库查询
      const defaultCharacters = this.getDefaultCharactersForLocation(locationId);
      return defaultCharacters;
    } catch (error) {
      return [{ id: 'town_guard', name: '城镇守卫' }];
    }
  }

  private async getRecentConversationHistory(sessionId: string, limit: number): Promise<GameContextInfo['recentConversation']> {
    try {
      const conversations = await this.databaseService.getConversationHistory(sessionId, limit);
      return conversations.map(conv => ({
        timestamp: conv.created_at, // 使用created_at作为timestamp
        speaker: conv.character_id || 'system', // 使用character_id作为speaker
        content: conv.content
      }));
    } catch (error) {
      return [];
    }
  }

  private async getGameStateInfo(sessionId: string): Promise<GameContextInfo['gameState']> {
    try {
      // 从游戏状态表获取信息
      const gameState = await this.databaseService.getGameState(sessionId);
      return {
        timeOfDay: gameState?.time_of_day || 'afternoon',
        weather: gameState?.weather || 'sunny',
        atmosphere: gameState?.atmosphere || 'peaceful',
        playerLevel: gameState?.player_level || 1,
        completedQuests: gameState?.completed_quests || []
      };
    } catch (error) {
      return {
        timeOfDay: 'afternoon',
        weather: 'sunny',
        atmosphere: 'peaceful',
        playerLevel: 1,
        completedQuests: []
      };
    }
  }

  private async getPlayerPreferences(playerId: string): Promise<GameContextInfo['playerPreferences']> {
    try {
      // 从玩家配置表获取信息
      const preferences = await this.databaseService.getPlayerPreferences(playerId);
      return {
        language: preferences?.language || 'zh',
        difficulty: preferences?.difficulty || 'normal',
        narrativeStyle: preferences?.narrative_style || 'immersive'
      };
    } catch (error) {
      return {
        language: 'zh',
        difficulty: 'normal',
        narrativeStyle: 'immersive'
      };
    }
  }

  private async getAvailableLocations(
    currentLocationId: string,
    playerLevel: number
  ): Promise<GameContextInfo['availableLocations']> {
    try {
      // 从位置连接表查询可达位置
      // 这里应该实现实际的数据库查询逻辑
      const baseLocations = [
        { id: 'town_square', name: '镇中心广场', accessibility: 'direct' as const },
        { id: 'library', name: '图书馆', accessibility: 'direct' as const },
        { id: 'market', name: '市场', accessibility: 'direct' as const },
        { id: 'park', name: '公园', accessibility: 'direct' as const }
      ];

      // 根据玩家等级过滤可达位置
      return baseLocations.filter(loc => 
        loc.id !== currentLocationId && 
        this.isLocationAccessible(loc.id, playerLevel)
      );
    } catch (error) {
      return [
        { id: 'town_square', name: '镇中心广场', accessibility: 'direct' },
        { id: 'library', name: '图书馆', accessibility: 'direct' }
      ];
    }
  }

  private getMinimalContext(sessionId: string, playerId: string): GameContextInfo {
    return {
      sessionId,
      playerId,
      currentLocation: {
        id: 'town_square',
        name: '镇中心广场',
        description: '默认位置'
      },
      nearbyCharacters: [{ id: 'town_guard', name: '城镇守卫' }],
      recentConversation: [],
      availableLocations: [
        { id: 'library', name: '图书馆', accessibility: 'direct' }
      ],
      gameState: {
        timeOfDay: 'afternoon',
        weather: 'sunny',
        atmosphere: 'peaceful'
      },
      playerPreferences: {
        language: 'zh',
        difficulty: 'normal',
        narrativeStyle: 'immersive'
      }
    };
  }

  private getLocationDisplayName(locationId: string): string {
    const locationNames: Record<string, string> = {
      'town_square': '镇中心广场',
      'library': '图书馆',
      'market': '市场',
      'park': '公园',
      'bookstore': '书店',
      'cafe': '咖啡厅',
      'hospital': '医院',
      'school': '学校'
    };
    return locationNames[locationId] || locationId;
  }

  private getDefaultCharactersForLocation(locationId: string): GameContextInfo['nearbyCharacters'] {
    const locationCharacters: Record<string, GameContextInfo['nearbyCharacters']> = {
      'town_square': [
        { id: 'town_guard', name: '城镇守卫', personality: 'dutiful' },
        { id: 'merchant', name: '商人', personality: 'friendly' }
      ],
      'library': [
        { id: 'librarian', name: '图书管理员', personality: 'knowledgeable' }
      ],
      'market': [
        { id: 'vendor', name: '摊贩', personality: 'energetic' }
      ]
    };
    return locationCharacters[locationId] || [];
  }

  private isLocationAccessible(locationId: string, playerLevel: number): boolean {
    // 基于玩家等级的位置访问控制
    const locationRequirements: Record<string, number> = {
      'town_square': 1,
      'library': 1,
      'market': 1,
      'park': 1,
      'advanced_area': 5,
      'dangerous_zone': 10
    };
    
    const requiredLevel = locationRequirements[locationId] || 1;
    return playerLevel >= requiredLevel;
  }
}