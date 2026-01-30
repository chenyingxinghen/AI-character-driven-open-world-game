/**
 * 游戏上下文服务
 * 从数据库获取详细的游戏上下文信息，避免硬编码
 */

import { DatabaseService, ConversationRecord } from '../database/DatabaseService';
import { WorldLoreService } from '../world/WorldLoreService';
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
  worldLore?: string;
  recentStoryEvents?: Array<{
    type: string;
    description: string;
    timestamp: Date;
  }>;
  discoveredLocations?: Array<{
    id: string;
    name: string;
    connections: string[];
    isCurrent: boolean;
  }>;
}

export interface InputClassificationContext {
  sessionId: string;
  currentLocation: string;
  nearbyCharacters: string[];
  nearbyCharacterDetails?: string[];
  recentConversation: string[];
  recentStoryEvents?: string[];
  availableLocations?: string[];
}

export class GameContextService {
  constructor(
    private databaseService: DatabaseService,
    private logger: Logger,
    private worldLoreService?: WorldLoreService
  ) { }

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
        storyEventsData,
        gameStateInfo,
        playerPreferences
      ] = await Promise.all([
        this.getSessionInfo(sessionId),
        this.getCurrentLocationInfo(sessionId),
        this.getNearbyCharactersInfo(sessionId),
        this.getRecentConversationHistory(sessionId, 10),
        this.getRecentStoryEvents(sessionId, 5),
        this.getGameStateInfo(sessionId),
        this.getPlayerPreferences(playerId)
      ]);

      // 获取可达位置信息
      const availableLocations = await this.getAvailableLocations(
        sessionId,
        locationInfo.id,
        gameStateInfo.playerLevel || 1
      );

      // 获取世界背景故事
      let worldLore = '';
      if (this.worldLoreService) {
        worldLore = await this.worldLoreService.getMainStoryForSession(sessionId);
      }

      const context: GameContextInfo = {
        sessionId,
        playerId,
        currentLocation: locationInfo,
        nearbyCharacters: charactersInfo,
        recentConversation: conversationHistory.map(conv => {
          let speakerName = conv.speaker;
          if (conv.speaker === playerId) {
            speakerName = 'Player';
          } else if (conv.speaker === 'system') {
            speakerName = 'System';
          } else {
            const char = charactersInfo.find(c => c.id === conv.speaker);
            if (char) speakerName = char.name;
          }
          return {
            ...conv,
            speaker: speakerName
          };
        }),
        availableLocations,
        gameState: gameStateInfo,
        playerPreferences,
        worldLore,
        recentStoryEvents: storyEventsData,
        discoveredLocations: await this.getDiscoveredLocations(sessionId, locationInfo.id)
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
      nearbyCharacterDetails: fullContext.nearbyCharacters.map(char => {
        let detail = `${char.name}`;
        if (char.personality) {
          try {
            const p = typeof char.personality === 'string' ? JSON.parse(char.personality) : char.personality;
            if (p.traits) detail += ` (${p.traits.join(', ')})`;
          } catch (e) {
            // ignore parse error
          }
        }
        return detail;
      }),
      recentConversation: fullContext.recentConversation.map(conv => `${conv.speaker}: ${conv.content}`),
      recentStoryEvents: fullContext.recentStoryEvents?.map(event => event.description),
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
      const MAX_CONTENT_LENGTH = 65535;
      let truncatedContent = content;
      if (content.length > MAX_CONTENT_LENGTH) {
        truncatedContent = content.substring(0, MAX_CONTENT_LENGTH);
        this.logger.warn(`Conversation content truncated for session ${sessionId}`, {
          originalLength: content.length,
          truncatedLength: MAX_CONTENT_LENGTH,
          component: 'GameContextService'
        });
      }

      const conversationRecord: ConversationRecord = {
        id: uuidv4(),
        session_id: sessionId,
        character_id: speaker,
        message_type: messageType,
        content: truncatedContent,
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

      // 尝试从 locations 表获取详细位置信息
      try {
        const locations = await this.databaseService.getLocationsBySession(sessionId);
        const currentLocation = locations.find(loc => loc.id === locationId);

        if (currentLocation) {
          return {
            id: currentLocation.id,
            name: currentLocation.name,
            description: currentLocation.description || `这是 ${currentLocation.name}`
          };
        }
      } catch (locError) {
        this.logger.warn('Failed to fetch detailed location info, using basic info', locError as Error);
      }

      // 如果找不到详细信息，尝试从 session meta 获取
      const sessionMetadataLocation = session?.game_state?.currentLocation;
      const effectiveLocationId = locationId === 'town_square' && sessionMetadataLocation ?
        sessionMetadataLocation : locationId;

      return {
        id: effectiveLocationId,
        name: this.getLocationDisplayName(effectiveLocationId),
        description: `当前位置：${this.getLocationDisplayName(effectiveLocationId)}`
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

      // 从角色表查询当前位置的活跃角色
      try {
        const allCharacters = await this.databaseService.getSessionCharacters(sessionId);
        const nearby = allCharacters
          .filter(char => char.current_location === locationId && char.is_active)
          .map(char => ({
            id: char.id,
            name: char.name,
            personality: typeof char.personality === 'string' ? char.personality : JSON.stringify(char.personality)
          }));

        if (nearby.length > 0) {
          return nearby;
        }
      } catch (charError) {
        this.logger.warn('Failed to fetch nearby characters from database', charError as Error);
      }

      // 如果数据库中没有，则返回默认角色
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

  private async getRecentStoryEvents(sessionId: string, limit: number): Promise<GameContextInfo['recentStoryEvents']> {
    try {
      const events = await this.databaseService.getStoryEvents(sessionId, limit);
      return events.map(event => ({
        type: event.event_type,
        description: event.description,
        timestamp: event.created_at
      }));
    } catch (error) {
      this.logger.warn('Failed to fetch story events from database', error as Error);
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
    sessionId: string,
    currentLocationId: string,
    playerLevel: number
  ): Promise<GameContextInfo['availableLocations']> {
    try {
      // 从数据库查询该会话的所有动态位置
      const locations = await this.databaseService.getLocationsBySession(sessionId);

      // 找出与当前位置相连的位置
      const currentLocation = locations.find(loc => loc.id === currentLocationId);
      const connectedIds = currentLocation?.location_data?.connections || [];

      return locations
        .filter(loc => loc.id !== currentLocationId && (connectedIds.includes(loc.id) || this.isLocationAccessible(loc.id, playerLevel)))
        .map(loc => ({
          id: loc.id,
          name: loc.name,
          accessibility: 'direct' as const
        }));
    } catch (error) {
      this.logger.warn('Failed to fetch dynamic locations, using basic fallback');
      return [
        { id: 'town_square', name: '镇中心广场', accessibility: 'direct' }
      ];
    }
  }

  /**
   * 获取会话中所有已发现的位置（用于地图显示）
   */
  public async getDiscoveredLocations(sessionId: string, currentLocationId: string): Promise<any[]> {
    try {
      const locations = await this.databaseService.getLocationsBySession(sessionId);
      return locations.map(loc => {
        let connections: string[] = [];
        if (loc.location_data) {
          const data = typeof loc.location_data === 'string' ? JSON.parse(loc.location_data) : loc.location_data;
          connections = data.connections || [];
        }
        return {
          id: loc.id,
          name: loc.name,
          connections,
          isCurrent: loc.id === currentLocationId
        };
      });
    } catch (error) {
      this.logger.error('Failed to get discovered locations', error as Error);
      return [];
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

    if (locationNames[locationId]) {
      return locationNames[locationId];
    }

    // Handle dynamic IDs
    if (locationId.startsWith('dynamic_')) {
      const parts = locationId.split('_');
      // format: dynamic_name_timestamp or dynamic_name
      if (parts.length >= 2) {
        const namePart = parts[1];

        // Special mapping for common fallback names
        if (namePart === 'unknown') return '未知地点';
        if (namePart === 'general') return '周边区域';

        // If it looks like an English key that we might have a translation for
        if (locationNames[namePart]) {
          return locationNames[namePart];
        }

        // Return the name part directly if no mapping found
        return namePart;
      }
      return '神秘区域';
    }

    // Check if it's a UUID (prevent displaying raw UUIDs)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(locationId)) {
      return '未知区域';
    }

    return locationId;
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