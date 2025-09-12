/**
 * 角色域实体
 * 这些是有身份的业务对象，包含角色域的核心业务逻辑
 */

import { 
  CharacterMemory, 
  EmotionalState, 
  CharacterRelationship, 
  CharacterProfile,
  CharacterPersonality 
} from './valueObjects';

/**
 * 角色实体
 * 这是角色域的核心聚合根
 */
export class Character {
  private memories: Map<string, CharacterMemory> = new Map();
  private relationships: Map<string, CharacterRelationship> = new Map();
  private currentEmotionalState: EmotionalState;
  
  constructor(
    public readonly id: string,
    public readonly profile: CharacterProfile,
    initialEmotionalState?: EmotionalState
  ) {
    this.currentEmotionalState = initialEmotionalState || {
      mood: 'neutral',
      intensity: 50,
      stability: 75,
      triggers: []
    };
  }

  /**
   * 获取角色名称
   */
  get name(): string {
    return this.profile.name;
  }

  /**
   * 获取角色个性
   */
  get personality(): CharacterPersonality {
    return this.profile.personality;
  }

  /**
   * 获取当前情绪状态
   */
  getEmotionalState(): EmotionalState {
    return this.currentEmotionalState;
  }

  /**
   * 更新情绪状态
   */
  updateEmotionalState(newState: Partial<EmotionalState>): void {
    this.currentEmotionalState = {
      ...this.currentEmotionalState,
      ...newState
    };
  }

  /**
   * 添加记忆
   */
  addMemory(memory: CharacterMemory): void {
    this.memories.set(memory.id, memory);
  }

  /**
   * 获取记忆
   */
  getMemory(memoryId: string): CharacterMemory | undefined {
    return this.memories.get(memoryId);
  }

  /**
   * 获取所有记忆
   */
  getAllMemories(): CharacterMemory[] {
    return Array.from(this.memories.values());
  }

  /**
   * 删除记忆
   */
  removeMemory(memoryId: string): void {
    this.memories.delete(memoryId);
  }

  /**
   * 添加或更新关系
   */
  setRelationship(relationship: CharacterRelationship): void {
    this.relationships.set(relationship.characterId, relationship);
  }

  /**
   * 获取关系
   */
  getRelationship(characterId: string): CharacterRelationship | undefined {
    return this.relationships.get(characterId);
  }

  /**
   * 获取所有关系
   */
  getAllRelationships(): CharacterRelationship[] {
    return Array.from(this.relationships.values());
  }

  /**
   * 删除关系
   */
  removeRelationship(characterId: string): void {
    this.relationships.delete(characterId);
  }

  /**
   * 根据标签过滤记忆
   */
  getMemoriesByTags(tags: string[]): CharacterMemory[] {
    return this.getAllMemories().filter(memory =>
      tags.some(tag => memory.tags.includes(tag))
    );
  }

  /**
   * 根据类型过滤记忆
   */
  getMemoriesByType(type: CharacterMemory['memoryType']): CharacterMemory[] {
    return this.getAllMemories().filter(memory => memory.memoryType === type);
  }

  /**
   * 获取最近的记忆
   */
  getRecentMemories(count: number = 10): CharacterMemory[] {
    return this.getAllMemories()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, count);
  }

  /**
   * 获取最重要的记忆
   */
  getMostSignificantMemories(count: number = 10): CharacterMemory[] {
    return this.getAllMemories()
      .sort((a, b) => b.significance - a.significance)
      .slice(0, count);
  }
}