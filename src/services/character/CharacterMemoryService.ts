export interface MemoryRecord {
  id: string;
  characterId: string;
  sessionId: string;
  content: string;
  emotionalWeight: number;
  associatedCharacters: string[];
  tags: string[];
  memoryType: 'dialogue' | 'observation' | 'action' | 'event';
  significance: number; // 1-10, higher means more significant
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
}

export interface EmotionalState {
  mood: string;
  intensity: number; // 0-100
  stability: number; // 0-100
  triggers: string[];
}

export class CharacterMemoryService {
  private memories: Map<string, MemoryRecord[]> = new Map();
  private emotionalStates: Map<string, EmotionalState> = new Map();

  /**
   * 存储记忆
   */
  storeMemory(memory: MemoryRecord): void {
    const characterMemories = this.memories.get(memory.characterId) || [];
    characterMemories.push(memory);
    this.memories.set(memory.characterId, characterMemories);
    
    // 更新访问时间
    this.updateMemoryAccess(memory.characterId, memory.id);
  }

  /**
   * 获取角色记忆
   */
  getCharacterMemories(characterId: string, sessionId: string, limit: number = 50): MemoryRecord[] {
    const characterMemories = this.memories.get(characterId) || [];
    const sessionMemories = characterMemories.filter(memory => memory.sessionId === sessionId);
    
    // 按重要性和最近访问排序
    return sessionMemories
      .sort((a, b) => {
        // 首先按重要性排序
        if (b.significance !== a.significance) {
          return b.significance - a.significance;
        }
        // 然后按访问次数排序
        if (b.accessCount !== a.accessCount) {
          return b.accessCount - a.accessCount;
        }
        // 最后按创建时间排序
        return b.createdAt.getTime() - a.createdAt.getTime();
      })
      .slice(0, limit);
  }

  /**
   * 根据标签搜索记忆
   */
  searchMemoriesByTags(characterId: string, tags: string[]): MemoryRecord[] {
    const characterMemories = this.memories.get(characterId) || [];
    
    return characterMemories.filter(memory => 
      tags.some(tag => memory.tags.includes(tag))
    );
  }

  /**
   * 根据内容搜索记忆
   */
  searchMemoriesByContent(characterId: string, searchTerm: string): MemoryRecord[] {
    const characterMemories = this.memories.get(characterId) || [];
    
    return characterMemories.filter(memory => 
      memory.content.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  /**
   * 更新记忆访问信息
   */
  private updateMemoryAccess(characterId: string, memoryId: string): void {
    const characterMemories = this.memories.get(characterId);
    if (!characterMemories) return;
    
    const memory = characterMemories.find(m => m.id === memoryId);
    if (memory) {
      memory.lastAccessed = new Date();
      memory.accessCount += 1;
    }
  }

  /**
   * 获取角色情绪状态
   */
  getEmotionalState(characterId: string): EmotionalState {
    return this.emotionalStates.get(characterId) || {
      mood: 'neutral',
      intensity: 50,
      stability: 70,
      triggers: []
    };
  }

  /**
   * 更新角色情绪状态
   */
  updateEmotionalState(characterId: string, emotionalUpdate: Partial<EmotionalState>): void {
    const currentState = this.getEmotionalState(characterId);
    const newState = { ...currentState, ...emotionalUpdate };
    
    // 确保数值在有效范围内
    newState.intensity = Math.min(100, Math.max(0, newState.intensity || 0));
    newState.stability = Math.min(100, Math.max(0, newState.stability || 0));
    
    this.emotionalStates.set(characterId, newState);
  }

  /**
   * 基于事件更新情绪状态
   */
  updateEmotionalStateFromEvent(characterId: string, event: any): void {
    const currentEmotionalState = this.getEmotionalState(characterId);
    
    // 根据事件类型和内容更新情绪
    switch (event.type) {
      case 'positive_interaction':
        this.updateEmotionalState(characterId, {
          mood: 'happy',
          intensity: Math.min(100, currentEmotionalState.intensity + 10),
          stability: Math.min(100, currentEmotionalState.stability + 5)
        });
        break;
        
      case 'negative_interaction':
        this.updateEmotionalState(characterId, {
          mood: 'sad',
          intensity: Math.min(100, currentEmotionalState.intensity + 15),
          stability: Math.max(0, currentEmotionalState.stability - 10)
        });
        break;
        
      case 'surprise':
        this.updateEmotionalState(characterId, {
          mood: 'surprised',
          intensity: Math.min(100, currentEmotionalState.intensity + 20),
          stability: Math.max(0, currentEmotionalState.stability - 5)
        });
        break;
        
      case 'threat':
        this.updateEmotionalState(characterId, {
          mood: 'fearful',
          intensity: Math.min(100, currentEmotionalState.intensity + 25),
          stability: Math.max(0, currentEmotionalState.stability - 15)
        });
        break;
        
      default:
        // 轻微的情绪波动
        this.updateEmotionalState(characterId, {
          intensity: Math.min(100, currentEmotionalState.intensity + 5),
          stability: Math.max(0, currentEmotionalState.stability - 2)
        });
    }
  }

  /**
   * 获取相关记忆（基于当前情境）
   */
  getRelevantMemories(characterId: string, context: any, limit: number = 10): MemoryRecord[] {
    const characterMemories = this.memories.get(characterId) || [];
    
    // 根据情境相关性排序
    const scoredMemories = characterMemories.map(memory => {
      let score = 0;
      
      // 基于标签匹配
      if (context.tags) {
        const matchingTags = memory.tags.filter(tag => context.tags.includes(tag));
        score += matchingTags.length * 10;
      }
      
      // 基于关联角色匹配
      if (context.characters) {
        const matchingCharacters = memory.associatedCharacters.filter(char => context.characters.includes(char));
        score += matchingCharacters.length * 5;
      }
      
      // 基于时间相关性（最近的记忆得分更高）
      const timeDiff = Date.now() - memory.createdAt.getTime();
      const timeScore = Math.max(0, 100 - (timeDiff / (1000 * 60 * 60 * 24))); // 每天减少1分
      score += timeScore;
      
      // 基于重要性
      score += memory.significance * 2;
      
      // 基于访问频率
      score += memory.accessCount;
      
      return { memory, score };
    });
    
    // 按得分排序并返回前N个
    return scoredMemories
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.memory);
  }

  /**
   * 清理过期记忆
   */
  cleanupOldMemories(characterId: string, maxAgeInDays: number = 30): void {
    const characterMemories = this.memories.get(characterId);
    if (!characterMemories) return;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);
    
    const filteredMemories = characterMemories.filter(memory => 
      memory.createdAt > cutoffDate
    );
    
    this.memories.set(characterId, filteredMemories);
  }

  /**
   * 获取记忆统计信息
   */
  getMemoryStats(characterId: string): {
    totalMemories: number;
    memoryTypes: Record<string, number>;
    averageSignificance: number;
    mostAccessedMemory: MemoryRecord | null;
  } {
    const characterMemories = this.memories.get(characterId) || [];
    
    // 计算记忆类型统计
    const memoryTypes: Record<string, number> = {};
    characterMemories.forEach(memory => {
      memoryTypes[memory.memoryType] = (memoryTypes[memory.memoryType] || 0) + 1;
    });
    
    // 计算平均重要性
    const totalSignificance = characterMemories.reduce((sum, memory) => sum + memory.significance, 0);
    const averageSignificance = characterMemories.length > 0 ? totalSignificance / characterMemories.length : 0;
    
    // 找到访问最多记忆
    const mostAccessedMemory = characterMemories.length > 0 
      ? characterMemories.reduce((max, memory) => 
          memory.accessCount > max.accessCount ? memory : max, 
          characterMemories[0]
        ) 
      : null;
    
    return {
      totalMemories: characterMemories.length,
      memoryTypes,
      averageSignificance,
      mostAccessedMemory
    };
  }
}