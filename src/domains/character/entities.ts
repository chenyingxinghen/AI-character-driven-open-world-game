/**
 * 角色域实体
 * 这些是有身份的业务对象，包含角色域的核心业务逻辑
 */

import { 
  CharacterMemory, 
  EmotionalState, 
  CharacterRelationship, 
  CharacterProfile,
  CharacterPersonality,
  BehaviorDecision,
  BehaviorOption,
  MemoryCluster,
  EmotionalTrigger,
  MemoryAccessPattern
} from './valueObjects';

// 导出供其他模块使用的接口
export {
  CharacterProfile,
  CharacterPersonality,
  CharacterMemory,
  EmotionalState,
  CharacterRelationship,
  BehaviorDecision,
  BehaviorOption,
  MemoryCluster,
  EmotionalTrigger,
  MemoryAccessPattern
};

/**
 * 角色实体
 * 这是角色域的核心聚合根
 */
export class Character {
  private memories: Map<string, CharacterMemory> = new Map();
  private relationships: Map<string, CharacterRelationship> = new Map();
  private currentEmotionalState: EmotionalState;
  private emotionalHistory: EmotionalState[] = [];
  private memoryAccessPatterns: Map<string, MemoryAccessPattern> = new Map();
  private behaviorHistory: BehaviorDecision[] = [];
  private memoryClusters: Map<string, MemoryCluster> = new Map();
  private lastUpdateTime: Date = new Date();
  
  constructor(
    public readonly id: string,
    public readonly profile: CharacterProfile,
    initialEmotionalState?: EmotionalState
  ) {
    this.currentEmotionalState = initialEmotionalState || {
      mood: 'neutral',
      intensity: 50,
      stability: 75,
      triggers: [],
      dominantEmotions: ['calm'],
      emotionalHistory: [],
      lastMoodChange: new Date(),
      baselineStability: 75
    };
    
    this.emotionalHistory.push(this.currentEmotionalState);
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
   * 更新情绪状态（带状态机逻辑）
   */
  updateEmotionalState(newState: Partial<EmotionalState>, trigger?: EmotionalTrigger): void {
    const previousState = { ...this.currentEmotionalState };
    
    // 应用情绪状态机逻辑
    const processedState = this.processEmotionalTransition(previousState, newState, trigger);
    
    this.currentEmotionalState = {
      ...this.currentEmotionalState,
      ...processedState,
      lastMoodChange: new Date(),
      emotionalHistory: [...this.currentEmotionalState.emotionalHistory.slice(-9), previousState].slice(0, 10)
    };
    
    // 记录情绪历史
    this.emotionalHistory.push(this.currentEmotionalState);
    if (this.emotionalHistory.length > 50) {
      this.emotionalHistory.shift();
    }
    
    // 更新时间戳
    this.lastUpdateTime = new Date();
  }

  /**
   * 添加记忆（带智能管理）
   */
  addMemory(memory: CharacterMemory): void {
    this.memories.set(memory.id, memory);
    
    // 更新记忆访问模式
    this.updateMemoryAccessPattern(memory);
    
    // 更新记忆聚类
    this.updateMemoryClusters(memory);
    
    // 如果记忆太多，执行记忆管理
    if (this.memories.size > 1000) {
      this.performMemoryMaintenance();
    }
  }

  /**
   * 获取记忆（带访问记录）
   */
  getMemory(memoryId: string): CharacterMemory | undefined {
    const memory = this.memories.get(memoryId);
    if (memory) {
      this.recordMemoryAccess(memory);
    }
    return memory;
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
    const memory = this.memories.get(memoryId);
    if (memory) {
      this.memories.delete(memoryId);
      this.memoryAccessPatterns.delete(memoryId);
      this.removeFromMemoryClusters(memory);
    }
  }

  /**
   * 添加或更新关系（带更新逻辑）
   */
  setRelationship(relationship: CharacterRelationship): void {
    const existingRelationship = this.relationships.get(relationship.characterId);
    
    if (existingRelationship) {
      // 更新现有关系
      const updatedRelationship = this.updateRelationshipDynamics(existingRelationship, relationship);
      this.relationships.set(relationship.characterId, updatedRelationship);
    } else {
      // 新建关系
      this.relationships.set(relationship.characterId, {
        ...relationship,
        relationshipHistory: [],
        emotionalBond: this.calculateInitialEmotionalBond(relationship),
        trustTrajectory: [relationship.trustLevel],
        conflictHistory: []
      });
    }
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
   * 根据标签过滤记忆（带智能排序）
   */
  getMemoriesByTags(tags: string[]): CharacterMemory[] {
    const filteredMemories = this.getAllMemories().filter(memory =>
      tags.some(tag => memory.tags.includes(tag))
    );
    
    // 按照重要性和近期访问频率排序
    return this.sortMemoriesByRelevance(filteredMemories);
  }

  /**
   * 根据类型过滤记忆
   */
  getMemoriesByType(type: CharacterMemory['memoryType']): CharacterMemory[] {
    const filteredMemories = this.getAllMemories().filter(memory => memory.memoryType === type);
    return this.sortMemoriesByRelevance(filteredMemories);
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
      .sort((a, b) => {
        const scoreA = this.calculateMemoryRelevanceScore(a);
        const scoreB = this.calculateMemoryRelevanceScore(b);
        return scoreB - scoreA;
      })
      .slice(0, count);
  }

  /**
   * 获取相关记忆
   */
  getRelatedMemories(memory: CharacterMemory, count: number = 5): CharacterMemory[] {
    const allMemories = this.getAllMemories().filter(m => m.id !== memory.id);
    
    return allMemories
      .map(m => ({
        memory: m,
        similarity: this.calculateMemorySimilarity(memory, m)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, count)
      .map(item => item.memory);
  }

  /**
   * 做出行为决策
   */
  makeBehaviorDecision(options: BehaviorOption[]): BehaviorDecision {
    const decision = this.evaluateBehaviorOptions(options);
    
    // 记录决策历史
    this.behaviorHistory.push(decision);
    if (this.behaviorHistory.length > 100) {
      this.behaviorHistory.shift();
    }
    
    return decision;
  }

  /**
   * 获取情绪变化趋势
   */
  getEmotionalTrend(hours: number = 24): {
    trend: 'stable' | 'improving' | 'declining' | 'volatile';
    averageIntensity: number;
    moodChanges: number;
    stabilityScore: number;
  } {
    const recentStates = this.getRecentEmotionalStates(hours);
    
    if (recentStates.length < 2) {
      return {
        trend: 'stable',
        averageIntensity: this.currentEmotionalState.intensity,
        moodChanges: 0,
        stabilityScore: this.currentEmotionalState.stability
      };
    }
    
    const intensities = recentStates.map(s => s.intensity);
    const averageIntensity = intensities.reduce((sum, i) => sum + i, 0) / intensities.length;
    
    const moodChanges = this.countMoodChanges(recentStates);
    const stabilityScore = this.calculateStabilityScore(recentStates);
    
    let trend: 'stable' | 'improving' | 'declining' | 'volatile';
    const firstHalf = intensities.slice(0, Math.floor(intensities.length / 2));
    const secondHalf = intensities.slice(Math.floor(intensities.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, i) => sum + i, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, i) => sum + i, 0) / secondHalf.length;
    
    if (moodChanges > recentStates.length * 0.5) {
      trend = 'volatile';
    } else if (secondAvg > firstAvg + 10) {
      trend = 'improving';
    } else if (secondAvg < firstAvg - 10) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }
    
    return {
      trend,
      averageIntensity,
      moodChanges,
      stabilityScore
    };
  }

  /**
   * 获取记忆统计
   */
  getMemoryStatistics(): {
    totalMemories: number;
    memoriesByType: Record<string, number>;
    averageSignificance: number;
    mostAccessedMemories: CharacterMemory[];
    oldestMemory?: CharacterMemory;
    newestMemory?: CharacterMemory;
  } {
    const memories = this.getAllMemories();
    
    const memoriesByType: Record<string, number> = {};
    let totalSignificance = 0;
    
    for (const memory of memories) {
      memoriesByType[memory.memoryType] = (memoriesByType[memory.memoryType] || 0) + 1;
      totalSignificance += memory.significance;
    }
    
    const averageSignificance = memories.length > 0 ? totalSignificance / memories.length : 0;
    
    const mostAccessedMemories = memories
      .map(m => ({
        memory: m,
        accessCount: this.memoryAccessPatterns.get(m.id)?.accessCount || 0
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 5)
      .map(item => item.memory);
    
    const sortedByDate = memories.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    return {
      totalMemories: memories.length,
      memoriesByType,
      averageSignificance,
      mostAccessedMemories,
      oldestMemory: sortedByDate[0],
      newestMemory: sortedByDate[sortedByDate.length - 1]
    };
  }

  /**
   * 更新记忆聚类
   */
  private updateMemoryClusters(memory: CharacterMemory): void {
    // Find related clusters or create new one
    let targetCluster: MemoryCluster | undefined;
    
    for (const cluster of this.memoryClusters.values()) {
      const similarity = this.calculateMemoryClusterSimilarity(memory, cluster);
      if (similarity > 0.6) {
        targetCluster = cluster;
        break;
      }
    }
    
    if (targetCluster) {
      (targetCluster.memoryIds as string[]).push(memory.id);
      (targetCluster as any).lastUpdated = new Date();
    } else {
      const newCluster: MemoryCluster = {
        id: this.generateId(),
        theme: memory.tags[0] || 'general',
        memoryIds: [memory.id],
        significance: memory.significance || 50,
        emotionalTone: memory.emotionalWeight,
        createdAt: new Date(),
        lastUpdated: new Date(),
        averageSignificance: memory.significance || 50
      };
      this.memoryClusters.set(newCluster.id, newCluster);
    }
  }

  /**
   * 执行记忆维护
   */
  private performMemoryMaintenance(): void {
    const memories = this.getAllMemories();
    
    // Remove least relevant memories if over limit
    if (memories.length > 1000) {
      const sortedMemories = this.sortMemoriesByRelevance(memories);
      const toRemove = sortedMemories.slice(800); // Keep top 800
      
      for (const memory of toRemove) {
        this.removeMemory(memory.id);
      }
    }
  }

  /**
   * 获取最近的情绪状态
   */
  private getRecentEmotionalStates(hours: number): EmotionalState[] {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.emotionalHistory.filter(state => 
      state.lastMoodChange >= cutoffTime
    );
  }

  /**
   * 计算情绪变化次数
   */
  private countMoodChanges(states: EmotionalState[]): number {
    let changes = 0;
    for (let i = 1; i < states.length; i++) {
      if (states[i].mood !== states[i - 1].mood) {
        changes++;
      }
    }
    return changes;
  }

  /**
   * 计算稳定性分数
   */
  private calculateStabilityScore(states: EmotionalState[]): number {
    if (states.length < 2) return 100;
    
    const intensityVariations = [];
    for (let i = 1; i < states.length; i++) {
      intensityVariations.push(Math.abs(states[i].intensity - states[i - 1].intensity));
    }
    
    const avgVariation = intensityVariations.reduce((sum, v) => sum + v, 0) / intensityVariations.length;
    return Math.max(0, 100 - avgVariation);
  }

  /**
   * 从记忆聚类中移除记忆
   */
  private removeFromMemoryClusters(memory: CharacterMemory): void {
    for (const cluster of this.memoryClusters.values()) {
      const index = cluster.memoryIds.indexOf(memory.id);
      if (index !== -1) {
        (cluster.memoryIds as string[]).splice(index, 1);
        if (cluster.memoryIds.length === 0) {
          this.memoryClusters.delete(cluster.id);
        }
      }
    }
  }

  /**
   * 计算记忆与聚类的相似度
   */
  private calculateMemoryClusterSimilarity(memory: CharacterMemory, cluster: MemoryCluster): number {
    let similarity = 0;
    
    // Check theme similarity
    if (memory.tags.includes(cluster.theme)) {
      similarity += 0.4;
    }
    
    // Check emotional tone similarity
    const emotionDiff = Math.abs(memory.emotionalWeight - (cluster as any).emotionalTone);
    similarity += Math.max(0, 0.4 - emotionDiff / 100);
    
    // Check significance similarity
    const significanceDiff = Math.abs((memory.significance || 50) - (cluster as any).significance);
    similarity += Math.max(0, 0.2 - significanceDiff / 100);
    
    return similarity;
  }

  /**
   * 生成ID
   */
  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * 更新关系动态
   */
  private updateRelationshipDynamics(
    existing: CharacterRelationship, 
    update: CharacterRelationship
  ): CharacterRelationship {
    return {
      ...existing,
      ...update,
      relationshipHistory: [...existing.relationshipHistory || [], {
        timestamp: new Date(),
        previousTrustLevel: existing.trustLevel,
        newTrustLevel: update.trustLevel,
        changeReason: 'Updated'
      }],
      trustTrajectory: [...existing.trustTrajectory || [], update.trustLevel]
    };
  }

  /**
   * 计算初始情感纽带
   */
  private calculateInitialEmotionalBond(relationship: CharacterRelationship): number {
    // Simple calculation based on relationship type and trust level
    const typeMultiplier = relationship.relationshipType === 'friend' ? 1.2 : 
                          relationship.relationshipType === 'enemy' ? 0.5 : 1.0;
    return relationship.trustLevel * typeMultiplier;
  }

  /**
   * 评估行为选项
   */
  private evaluateBehaviorOptions(options: BehaviorOption[]): BehaviorDecision {
    const evaluatedOptions = options.map(option => {
      let score = (option as any).baseScore || 50;
      
      // Adjust based on personality traits
      for (const [trait, value] of Object.entries(this.personality.traits)) {
        if ((option as any).personalityFactors?.[trait]) {
          score += value * (option as any).personalityFactors[trait] * 0.1;
        }
      }
      
      // Adjust based on current emotional state
      if ((option as any).emotionalFactors) {
        const currentMood = this.currentEmotionalState.mood;
        if ((option as any).emotionalFactors[currentMood]) {
          score += (option as any).emotionalFactors[currentMood];
        }
      }
      
      return {
        option,
        score: Math.max(0, Math.min(100, score))
      };
    });
    
    const bestOption = evaluatedOptions.reduce((best, current) => 
      current.score > best.score ? current : best
    );
    
    return {
      selectedOption: bestOption.option,
      confidence: bestOption.score / 100,
      reasoning: `Selected based on personality alignment (${bestOption.score.toFixed(1)}/100)`,
      alternativeOptions: evaluatedOptions
        .filter(e => e !== bestOption)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .map(e => e.option),
      timestamp: new Date(),
      contextualFactors: {
        emotionalState: this.currentEmotionalState.mood,
        recentMemories: this.getRecentMemories(3).map(m => m.id)
      }
    } as any;
  }

  /**
   * 处理情绪转换（情绪状态机）
   */
  private processEmotionalTransition(
    previousState: EmotionalState,
    newState: Partial<EmotionalState>,
    trigger?: EmotionalTrigger
  ): Partial<EmotionalState> {
    const processedState = { ...newState };
    
    // 情绪强度的稳定性检查
    if (processedState.intensity !== undefined) {
      const maxChange = previousState.stability / 10;
      const intensityDiff = Math.abs(processedState.intensity - previousState.intensity);
      
      if (intensityDiff > maxChange) {
        const direction = processedState.intensity > previousState.intensity ? 1 : -1;
        processedState.intensity = previousState.intensity + (maxChange * direction);
      }
    }
    
    return processedState;
  }

  /**
   * 更新记忆访问模式
   */
  private updateMemoryAccessPattern(memory: CharacterMemory): void {
    const existingPattern = this.memoryAccessPatterns.get(memory.id);
    
    if (existingPattern) {
      this.memoryAccessPatterns.set(memory.id, {
        ...existingPattern,
        lastAccessed: new Date(),
        accessCount: existingPattern.accessCount + 1
      });
    } else {
      this.memoryAccessPatterns.set(memory.id, {
        memoryId: memory.id,
        accessCount: 1,
        lastAccessed: new Date(),
        accessFrequency: 0,
        contextualTriggers: []
      });
    }
  }

  /**
   * 记录记忆访问
   */
  private recordMemoryAccess(memory: CharacterMemory): void {
    const pattern = this.memoryAccessPatterns.get(memory.id);
    if (pattern) {
      const timeSinceLastAccess = Date.now() - pattern.lastAccessed.getTime();
      const accessFrequency = pattern.accessCount / timeSinceLastAccess * 86400000;
      
      this.memoryAccessPatterns.set(memory.id, {
        ...pattern,
        lastAccessed: new Date(),
        accessCount: pattern.accessCount + 1,
        accessFrequency
      });
    }
  }

  /**
   * 计算记忆相关性分数
   */
  private calculateMemoryRelevanceScore(memory: CharacterMemory): number {
    let score = memory.significance;
    
    const accessPattern = this.memoryAccessPatterns.get(memory.id);
    if (accessPattern) {
      score += accessPattern.accessCount * 2;
      score += accessPattern.accessFrequency * 5;
    }
    
    const daysSinceCreated = (Date.now() - memory.createdAt.getTime()) / 86400000;
    score *= Math.exp(-daysSinceCreated / 30);
    
    score += Math.abs(memory.emotionalWeight) * 0.5;
    
    return score;
  }

  /**
   * 按相关性排序记忆
   */
  private sortMemoriesByRelevance(memories: CharacterMemory[]): CharacterMemory[] {
    return memories.sort((a, b) => {
      const scoreA = this.calculateMemoryRelevanceScore(a);
      const scoreB = this.calculateMemoryRelevanceScore(b);
      return scoreB - scoreA;
    });
  }

  /**
   * 计算记忆相似度
   */
  private calculateMemorySimilarity(memory1: CharacterMemory, memory2: CharacterMemory): number {
    let similarity = 0;
    
    const commonTags = memory1.tags.filter(tag => memory2.tags.includes(tag));
    similarity += commonTags.length / Math.max(memory1.tags.length, memory2.tags.length) * 40;
    
    if (memory1.memoryType === memory2.memoryType) {
      similarity += 20;
    }
    
    const commonCharacters = memory1.associatedCharacters.filter(char => 
      memory2.associatedCharacters.includes(char)
    );
    similarity += commonCharacters.length * 10;
    
    const emotionDiff = Math.abs(memory1.emotionalWeight - memory2.emotionalWeight);
    similarity += Math.max(0, 30 - emotionDiff);
    
    return Math.min(100, similarity);
  }
}