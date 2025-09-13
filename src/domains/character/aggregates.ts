/**
 * 角色域聚合
 * 组合多个相关的服务和实体，提供统一的业务接口
 */

import { Logger } from '../../services/Logger';
import { LLMService } from '../../services/llm/LLMService';
import { DatabaseService } from '../../services/database/DatabaseService';
import { Character } from './entities';
import { 
  CharacterMemory, 
  EmotionalState, 
  CharacterRelationship,
  CharacterProfile,
  BehaviorOption,
  BehaviorDecision 
} from './valueObjects';
import { 
  MemoryAnalysisService,
  EmotionalSystemService,
  RelationshipManagementService,
  BehaviorDecisionService
} from './services';

/**
 * 角色管理器
 * 角色域的主要聚合根，协调所有角色相关的业务逻辑
 */
export class CharacterManager {
  private memoryAnalysisService: MemoryAnalysisService;
  private emotionalSystemService: EmotionalSystemService;
  private relationshipService: RelationshipManagementService;
  private behaviorService: BehaviorDecisionService;
  private characterRegistry: Map<string, Character> = new Map();
  private locationCharacterIndex: Map<string, Set<string>> = new Map();
  
  constructor(
    private llmService: LLMService,
    private logger: Logger,
    private databaseService?: DatabaseService
  ) {
    this.memoryAnalysisService = new MemoryAnalysisService(logger);
    this.emotionalSystemService = new EmotionalSystemService(logger);
    this.relationshipService = new RelationshipManagementService(logger);
    this.behaviorService = new BehaviorDecisionService(logger);
  }

  /**
   * 创建角色
   */
  createCharacter(profile: CharacterProfile, initialState?: EmotionalState): Character {
    const character = new Character(profile.id, profile, initialState);
    
    // 注册角色到内存索引
    this.characterRegistry.set(profile.id, character);
    
    // 如果有数据库服务，持久化角色数据
    if (this.databaseService) {
      this.persistCharacterToDatabase(character).catch(error => {
        this.logger.warn('Failed to persist character to database', error, {
          characterId: profile.id,
          component: 'CharacterManager'
        });
      });
    }
    
    this.logger.info(`Created character: ${profile.name}`, {
      characterId: profile.id,
      component: 'CharacterManager'
    });
    
    return character;
  }

  /**
   * 获取所有活跃角色
   */
  async getAllCharacters(): Promise<Character[]> {
    try {
      // 如果有数据库服务，优先从数据库获取
      if (this.databaseService) {
        const sessionCharacters = await this.databaseService.getSessionCharacters('default_session');
        const characters: Character[] = [];
        
        for (const record of sessionCharacters) {
          let character = this.characterRegistry.get(record.id);
          if (!character) {
            // 从数据库记录重建角色对象
            character = this.reconstructCharacterFromRecord(record);
            this.characterRegistry.set(record.id, character);
          }
          characters.push(character);
        }
        
        return characters;
      }
      
      // 备用方案：从内存注册表返回
      return Array.from(this.characterRegistry.values());
    } catch (error) {
      this.logger.error('Failed to get all characters', error as Error, {
        component: 'CharacterManager'
      });
      
      // 如果数据库查询失败，返回内存中的角色
      return Array.from(this.characterRegistry.values());
    }
  }

  /**
   * 根据位置获取角色
   */
  async getCharactersInLocation(locationId: string): Promise<Character[]> {
    try {
      const characters: Character[] = [];
      
      // 如果有数据库服务，查询数据库中的角色位置
      if (this.databaseService) {
        const allCharacters = await this.databaseService.getSessionCharacters('default_session');
        const locationCharacters = allCharacters.filter(record => 
          record.current_location === locationId && record.is_active
        );
        
        for (const record of locationCharacters) {
          let character = this.characterRegistry.get(record.id);
          if (!character) {
            character = this.reconstructCharacterFromRecord(record);
            this.characterRegistry.set(record.id, character);
          }
          characters.push(character);
        }
        
        return characters;
      }
      
      // 备用方案：使用内存索引
      const characterIds = this.locationCharacterIndex.get(locationId) || new Set();
      for (const characterId of characterIds) {
        const character = this.characterRegistry.get(characterId);
        if (character) {
          characters.push(character);
        }
      }
      
      return characters;
    } catch (error) {
      this.logger.error('Failed to get characters in location', error as Error, {
        locationId,
        component: 'CharacterManager'
      });
      
      return [];
    }
  }

  /**
   * 更新角色位置
   */
  async updateCharacterLocation(characterId: string, newLocationId: string, sessionId: string = 'default_session'): Promise<void> {
    try {
      const character = this.characterRegistry.get(characterId);
      if (!character) {
        this.logger.warn('Character not found in registry', {
          characterId,
          component: 'CharacterManager'
        });
        return;
      }
      
      // 从旧位置索引中移除
      for (const [locationId, characterSet] of this.locationCharacterIndex.entries()) {
        characterSet.delete(characterId);
        if (characterSet.size === 0) {
          this.locationCharacterIndex.delete(locationId);
        }
      }
      
      // 添加到新位置索引
      if (!this.locationCharacterIndex.has(newLocationId)) {
        this.locationCharacterIndex.set(newLocationId, new Set());
      }
      this.locationCharacterIndex.get(newLocationId)!.add(characterId);
      
      // 更新数据库
      if (this.databaseService) {
        await this.databaseService.updateCharacter(characterId, sessionId, {
          current_location: newLocationId,
          updated_at: new Date()
        });
      }
      
      this.logger.info('Updated character location', {
        characterId,
        newLocationId,
        component: 'CharacterManager'
      });
    } catch (error) {
      this.logger.error('Failed to update character location', error as Error, {
        characterId,
        newLocationId,
        component: 'CharacterManager'
      });
    }
  }

  /**
   * 获取角色
   */
  async getCharacter(characterId: string): Promise<Character | null> {
    try {
      // 首先检查内存注册表
      let character = this.characterRegistry.get(characterId);
      if (character) {
        return character;
      }
      
      // 如果内存中没有，尝试从数据库加载
      if (this.databaseService) {
        const record = await this.databaseService.getCharacter(characterId, 'default_session');
        if (record) {
          character = this.reconstructCharacterFromRecord(record);
          this.characterRegistry.set(characterId, character);
          return character;
        }
      }
      
      return null;
    } catch (error) {
      this.logger.error('Failed to get character', error as Error, {
        characterId,
        component: 'CharacterManager'
      });
      return null;
    }
  }

  /**
   * 处理角色交互
   */
  async processCharacterInteraction(
    sourceCharacter: Character,
    targetCharacter: Character,
    interaction: any
  ): Promise<{
    sourceResponse: string;
    targetResponse: string;
    updatedRelationships: CharacterRelationship[];
    emotionalChanges: { source: EmotionalState; target: EmotionalState };
  }> {
    this.logger.info(`Processing interaction between ${sourceCharacter.name} and ${targetCharacter.name}`);

    // 更新关系
    const sourceRelationship = this.relationshipService.updateRelationship(
      sourceCharacter, 
      targetCharacter.id, 
      interaction
    );
    const targetRelationship = this.relationshipService.updateRelationship(
      targetCharacter, 
      sourceCharacter.id, 
      { ...interaction, perspective: 'target' }
    );

    // 计算情绪影响
    const sourceEmotionalChange = this.emotionalSystemService.calculateEmotionalImpact(
      interaction, 
      sourceCharacter, 
      targetCharacter
    );
    const targetEmotionalChange = this.emotionalSystemService.calculateEmotionalImpact(
      { ...interaction, perspective: 'target' }, 
      targetCharacter, 
      sourceCharacter
    );

    // 更新情绪状态
    sourceCharacter.updateEmotionalState(sourceEmotionalChange);
    targetCharacter.updateEmotionalState(targetEmotionalChange);

    // 生成响应
    const sourceResponse = await this.generateCharacterResponse(sourceCharacter, interaction);
    const targetResponse = await this.generateCharacterResponse(targetCharacter, {
      ...interaction,
      perspective: 'target'
    });

    // 创建记忆
    await this.createInteractionMemories(sourceCharacter, targetCharacter, interaction);

    return {
      sourceResponse,
      targetResponse,
      updatedRelationships: [sourceRelationship, targetRelationship],
      emotionalChanges: {
        source: sourceCharacter.getEmotionalState(),
        target: targetCharacter.getEmotionalState()
      }
    };
  }

  /**
   * 生成角色响应
   */
  async generateCharacterResponse(character: Character, context: any): Promise<string> {
    const recentMemories = character.getRecentMemories(5);
    const currentEmotion = character.getEmotionalState();
    
    const prompt = this.buildResponsePrompt(character, context, recentMemories, currentEmotion);
    
    try {
      const response = await this.llmService.generateText(prompt, {
        temperature: 0.8,
        maxTokens: 200
      });
      
      return response || "I need a moment to think...";
    } catch (error) {
      this.logger.error('Error generating character response:', error as Error);
      return this.getFallbackResponse(character, context);
    }
  }

  /**
   * 分析角色记忆
   */
  analyzeCharacterMemories(character: Character): {
    importantMemories: CharacterMemory[];
    memoryConnections: Array<{ memory: CharacterMemory; related: CharacterMemory[] }>;
    emotionalPatterns: string[];
  } {
    const allMemories = character.getAllMemories();
    
    // 找出重要记忆
    const importantMemories = allMemories
      .map(memory => ({
        memory,
        score: this.memoryAnalysisService.evaluateMemoryImportance(memory, character)
      }))
      .filter(item => item.score.score > 60)
      .sort((a, b) => b.score.score - a.score.score)
      .map(item => item.memory);

    // 分析记忆连接
    const memoryConnections = importantMemories.map(memory => ({
      memory,
      related: this.memoryAnalysisService.findRelatedMemories(memory, allMemories)
        .slice(0, 3)
        .map(rm => rm.memory)
    }));

    // 分析情绪模式
    const emotionalPatterns = this.analyzeEmotionalPatterns(allMemories);

    return {
      importantMemories,
      memoryConnections,
      emotionalPatterns
    };
  }

  /**
   * 做出行为决策
   */
  makeCharacterDecision(character: Character, options: BehaviorOption[]): BehaviorDecision {
    return this.behaviorService.evaluateBehaviorOptions(character, options);
  }

  /**
   * 处理时间流逝的影响
   */
  processTimePassage(character: Character, timeElapsed: number): void {
    // 情绪恢复
    const emotionalRecovery = this.emotionalSystemService.processEmotionalRecovery(
      character, 
      timeElapsed
    );
    character.updateEmotionalState(emotionalRecovery);

    // 记忆衰减（这里可以实现记忆重要性的自然衰减）
    this.processMemoryDecay(character, timeElapsed);
  }

  /**
   * 构建响应提示
   */
  private buildResponsePrompt(
    character: Character, 
    context: any, 
    recentMemories: CharacterMemory[], 
    emotion: EmotionalState
  ): string {
    const personality = character.personality;
    
    return `
角色信息：
- 姓名：${character.name}
- 背景：${character.profile.background}
- 个性特征：${JSON.stringify(personality.traits)}
- 当前情绪：${emotion.mood}（强度：${emotion.intensity}）

最近记忆：
${recentMemories.map(m => `- ${m.content}`).join('\n')}

当前情况：
${JSON.stringify(context)}

请以这个角色的身份回应当前情况，保持角色的个性和情绪状态一致：
`;
  }

  /**
   * 获取备用响应
   */
  private getFallbackResponse(character: Character, context: any): string {
    const responses = [
      `${character.name} 沉思了一下...`,
      `${character.name} 看起来有些困惑。`,
      `${character.name} 需要时间来理解情况。`,
      `${character.name} 静静地观察着。`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * 创建交互记忆
   */
  private async createInteractionMemories(
    sourceCharacter: Character,
    targetCharacter: Character,
    interaction: any
  ): Promise<void> {
    const sourceMemory: CharacterMemory = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: `Interacted with ${targetCharacter.name}: ${interaction.description}`,
      emotionalWeight: interaction.emotionalImpact || 0,
      associatedCharacters: [targetCharacter.id],
      tags: ['interaction', interaction.type || 'general'],
      memoryType: 'dialogue',
      significance: 60,
      createdAt: new Date()
    };

    const targetMemory: CharacterMemory = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: `${sourceCharacter.name} interacted with me: ${interaction.description}`,
      emotionalWeight: (interaction.emotionalImpact || 0) * 0.8, // 目标感受稍微减弱
      associatedCharacters: [sourceCharacter.id],
      tags: ['interaction', interaction.type || 'general'],
      memoryType: 'dialogue',
      significance: 60,
      createdAt: new Date()
    };

    sourceCharacter.addMemory(sourceMemory);
    targetCharacter.addMemory(targetMemory);
  }

  /**
   * 分析情绪模式
   */
  private analyzeEmotionalPatterns(memories: CharacterMemory[]): string[] {
    const patterns: string[] = [];
    
    // 分析情绪权重模式
    const positiveMemories = memories.filter(m => m.emotionalWeight > 20).length;
    const negativeMemories = memories.filter(m => m.emotionalWeight < -20).length;
    
    if (positiveMemories > negativeMemories * 2) {
      patterns.push('generally_optimistic');
    } else if (negativeMemories > positiveMemories * 2) {
      patterns.push('generally_pessimistic');
    }
    
    // 分析记忆类型模式
    const dialogueMemories = memories.filter(m => m.memoryType === 'dialogue').length;
    const totalMemories = memories.length;
    
    if (dialogueMemories / totalMemories > 0.7) {
      patterns.push('socially_oriented');
    }
    
    return patterns;
  }

  /**
   * 处理记忆衰减
   */
  private processMemoryDecay(character: Character, timeElapsed: number): void {
    // 这里可以实现记忆重要性的自然衰减
    // 例如，随着时间流逝，降低某些记忆的重要性
    // 实际实现需要考虑记忆类型、情绪权重等因素
    this.logger.debug(`Processing memory decay for ${character.name}, time elapsed: ${timeElapsed}`);
  }

  /**
   * 将角色持久化到数据库
   */
  private async persistCharacterToDatabase(character: Character): Promise<void> {
    if (!this.databaseService) return;

    try {
      const characterRecord = {
        id: character.id,
        session_id: 'default_session',
        name: character.name,
        personality: character.personality,
        background: character.profile.background,
        appearance: character.profile.appearance,
        current_location: 'town_square', // 默认位置
        emotional_state: character.getEmotionalState(),
        is_active: true
      };

      await this.databaseService.createCharacter(characterRecord);
    } catch (error) {
      this.logger.error('Failed to persist character to database', error as Error, {
        characterId: character.id,
        component: 'CharacterManager'
      });
      throw error;
    }
  }

  /**
   * 从数据库记录重建角色对象
   */
  private reconstructCharacterFromRecord(record: any): Character {
    const profile: CharacterProfile = {
      id: record.id,
      name: record.name,
      background: record.background,
      appearance: record.appearance,
      personality: typeof record.personality === 'string' 
        ? JSON.parse(record.personality) 
        : record.personality
    };

    const emotionalState = typeof record.emotional_state === 'string'
      ? JSON.parse(record.emotional_state)
      : record.emotional_state;

    const character = new Character(profile.id, profile, emotionalState);
    
    // 更新位置索引
    if (record.current_location) {
      if (!this.locationCharacterIndex.has(record.current_location)) {
        this.locationCharacterIndex.set(record.current_location, new Set());
      }
      this.locationCharacterIndex.get(record.current_location)!.add(record.id);
    }

    return character;
  }

  /**
   * 获取角色统计信息
   */
  getCharacterStatistics(): {
    totalCharacters: number;
    charactersByLocation: Record<string, number>;
    activeCharacters: number;
  } {
    const totalCharacters = this.characterRegistry.size;
    const charactersByLocation: Record<string, number> = {};
    let activeCharacters = 0;

    for (const [locationId, characterSet] of this.locationCharacterIndex.entries()) {
      charactersByLocation[locationId] = characterSet.size;
    }

    for (const character of this.characterRegistry.values()) {
      if (character) { // 假设所有注册的角色都是活跃的
        activeCharacters++;
      }
    }

    return {
      totalCharacters,
      charactersByLocation,
      activeCharacters
    };
  }

  /**
   * 清理无效角色数据
   */
  cleanup(): void {
    // 清理可能存在的内存泄漏或无效数据
    for (const [characterId, character] of this.characterRegistry.entries()) {
      if (!character) {
        this.characterRegistry.delete(characterId);
      }
    }

    // 清理空的位置索引
    for (const [locationId, characterSet] of this.locationCharacterIndex.entries()) {
      if (characterSet.size === 0) {
        this.locationCharacterIndex.delete(locationId);
      }
    }

    this.logger.info('Character manager cleanup completed', {
      component: 'CharacterManager'
    });
  }
}