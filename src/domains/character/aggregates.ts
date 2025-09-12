/**
 * 角色域聚合
 * 组合多个相关的服务和实体，提供统一的业务接口
 */

import { Logger } from '../../services/Logger';
import { LLMService } from '../../services/llm/LLMService';
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
  
  constructor(
    private llmService: LLMService,
    private logger: Logger
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
    return new Character(profile.id, profile, initialState);
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
}