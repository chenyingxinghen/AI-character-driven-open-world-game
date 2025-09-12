/**
 * 角色域服务
 * 这些服务包含角色域的业务逻辑，但不属于任何特定实体
 */

import { Logger } from '../../services/Logger';
import { 
  CharacterMemory, 
  EmotionalState, 
  CharacterRelationship,
  ImportanceScore,
  RelatedMemory,
  BehaviorDecision,
  BehaviorOption
} from './valueObjects';
import { Character } from './entities';

/**
 * 记忆分析服务
 * 专门处理记忆相关的分析逻辑
 */
export class MemoryAnalysisService {
  constructor(private logger: Logger) {}

  /**
   * 评估记忆重要性
   */
  evaluateMemoryImportance(memory: CharacterMemory, character: Character): ImportanceScore {
    let score = 0;
    const factors: string[] = [];
    
    // 情绪权重影响
    if (Math.abs(memory.emotionalWeight) > 0.7) {
      score += Math.abs(memory.emotionalWeight) * 30;
      factors.push('high_emotional_impact');
    }
    
    // 角色关系影响
    if (memory.associatedCharacters.length > 0) {
      score += memory.associatedCharacters.length * 10;
      factors.push('character_relationships');
    }
    
    // 标签相关性
    const importantTags = ['dialogue', 'conflict', 'revelation', 'discovery'];
    const tagBonus = memory.tags.filter(tag => importantTags.includes(tag)).length * 15;
    if (tagBonus > 0) {
      score += tagBonus;
      factors.push('significant_tags');
    }
    
    // 记忆类型影响
    if (memory.memoryType === 'dialogue') {
      score += 20;
      factors.push('dialogue_memory');
    }

    // 个性特征影响
    const personalityTraits = character.personality.traits;
    if (personalityTraits.nostalgia > 0.7) {
      score += 10;
      factors.push('nostalgic_personality');
    }
    
    return {
      score: Math.min(100, score),
      factors,
      reasoning: `Memory scored ${score} based on ${factors.join(', ')}`
    };
  }

  /**
   * 查找相关记忆
   */
  findRelatedMemories(
    targetMemory: CharacterMemory, 
    allMemories: CharacterMemory[]
  ): RelatedMemory[] {
    const related: RelatedMemory[] = [];
    
    for (const memory of allMemories) {
      if (memory.id === targetMemory.id) continue;
      
      const similarity = this.calculateMemorySimilarity(targetMemory, memory);
      if (similarity > 0.3) {
        related.push({
          memory,
          similarityScore: similarity,
          relationshipType: this.determineRelationshipType(targetMemory, memory)
        });
      }
    }
    
    return related.sort((a, b) => b.similarityScore - a.similarityScore);
  }

  /**
   * 计算记忆相似度
   */
  private calculateMemorySimilarity(memory1: CharacterMemory, memory2: CharacterMemory): number {
    let similarity = 0;
    
    // 角色重叠
    const commonCharacters = memory1.associatedCharacters.filter(char =>
      memory2.associatedCharacters.includes(char)
    );
    similarity += commonCharacters.length * 0.2;
    
    // 标签重叠
    const commonTags = memory1.tags.filter(tag => memory2.tags.includes(tag));
    similarity += commonTags.length * 0.15;
    
    // 记忆类型匹配
    if (memory1.memoryType === memory2.memoryType) {
      similarity += 0.1;
    }
    
    // 情绪权重相似性
    const emotionalSimilarity = 1 - Math.abs(memory1.emotionalWeight - memory2.emotionalWeight) / 200;
    similarity += emotionalSimilarity * 0.2;
    
    return Math.min(1.0, similarity);
  }

  /**
   * 确定记忆关系类型
   */
  private determineRelationshipType(memory1: CharacterMemory, memory2: CharacterMemory): string {
    // 角色重叠
    const hasCommonCharacters = memory1.associatedCharacters.some(char =>
      memory2.associatedCharacters.includes(char)
    );
    if (hasCommonCharacters) return 'character_related';
    
    // 标签重叠
    const hasCommonTags = memory1.tags.some(tag => memory2.tags.includes(tag));
    if (hasCommonTags) return 'thematically_related';
    
    // 时间邻近
    const timeDiff = Math.abs(memory1.createdAt.getTime() - memory2.createdAt.getTime());
    if (timeDiff < 24 * 60 * 60 * 1000) return 'temporally_related'; // 24小时内
    
    return 'loosely_related';
  }
}

/**
 * 情绪系统服务
 * 处理角色情绪状态的变化和传播
 */
export class EmotionalSystemService {
  constructor(private logger: Logger) {}

  /**
   * 计算情绪影响
   */
  calculateEmotionalImpact(
    interaction: any,
    character: Character,
    targetCharacter?: Character
  ): Partial<EmotionalState> {
    const currentState = character.getEmotionalState();
    const personality = character.personality;
    
    let moodChange = 0;
    let intensityChange = 0;
    const newTriggers: string[] = [...currentState.triggers];
    
    // 基于个性特征计算情绪变化
    if (personality.traits.emotional_sensitivity > 0.7) {
      intensityChange += 10;
    }
    
    // 基于交互类型计算情绪变化
    if (interaction.type === 'positive') {
      moodChange += 15;
    } else if (interaction.type === 'negative') {
      moodChange -= 15;
      newTriggers.push(interaction.trigger || 'negative_interaction');
    }
    
    // 基于关系强度调整
    if (targetCharacter) {
      const relationship = character.getRelationship(targetCharacter.id);
      if (relationship) {
        const relationshipMultiplier = relationship.strength / 100;
        moodChange *= relationshipMultiplier;
        intensityChange *= relationshipMultiplier;
      }
    }
    
    return {
      intensity: Math.max(0, Math.min(100, currentState.intensity + intensityChange)),
      triggers: newTriggers.slice(-5) // 只保留最近5个触发器
    };
  }

  /**
   * 情绪恢复处理
   */
  processEmotionalRecovery(
    character: Character, 
    timePassed: number
  ): Partial<EmotionalState> {
    const currentState = character.getEmotionalState();
    const personality = character.personality;
    
    // 计算恢复速度
    const baseRecoveryRate = 0.1; // 每分钟0.1%
    const stabilityFactor = currentState.stability / 100;
    const personalityFactor = personality.traits.emotional_resilience || 0.5;
    
    const recoveryRate = baseRecoveryRate * stabilityFactor * personalityFactor;
    const recoveryAmount = recoveryRate * timePassed;
    
    // 逐步恢复到中性状态
    const targetIntensity = 50;
    const intensityDiff = currentState.intensity - targetIntensity;
    const newIntensity = currentState.intensity - (intensityDiff * recoveryAmount);
    
    return {
      intensity: Math.max(0, Math.min(100, newIntensity))
    };
  }
}

/**
 * 关系管理服务
 * 处理角色间关系的建立、更新和分析
 */
export class RelationshipManagementService {
  constructor(private logger: Logger) {}

  /**
   * 更新角色关系
   */
  updateRelationship(
    character: Character,
    targetCharacterId: string,
    interaction: any
  ): CharacterRelationship {
    const existingRelationship = character.getRelationship(targetCharacterId);
    
    let newStrength = existingRelationship?.strength || 50;
    let newTrustLevel = existingRelationship?.trustLevel || 50;
    
    // 基于交互类型调整关系
    if (interaction.type === 'positive') {
      newStrength += 5;
      newTrustLevel += 3;
    } else if (interaction.type === 'negative') {
      newStrength -= 10;
      newTrustLevel -= 5;
    }
    
    // 限制在合理范围内
    newStrength = Math.max(0, Math.min(100, newStrength));
    newTrustLevel = Math.max(0, Math.min(100, newTrustLevel));
    
    const newRelationship: CharacterRelationship = {
      characterId: targetCharacterId,
      relationshipType: this.determineRelationshipType(newStrength, newTrustLevel),
      strength: newStrength,
      trustLevel: newTrustLevel,
      lastInteraction: new Date(),
      interactionHistory: [
        ...(existingRelationship?.interactionHistory || []).slice(-9), // 保留最近10次交互
        interaction.description || `${interaction.type} interaction`
      ]
    };
    
    character.setRelationship(newRelationship);
    return newRelationship;
  }

  /**
   * 确定关系类型
   */
  private determineRelationshipType(strength: number, trustLevel: number): string {
    const average = (strength + trustLevel) / 2;
    
    if (average >= 80) return 'close_friend';
    if (average >= 60) return 'friend';
    if (average >= 40) return 'acquaintance';
    if (average >= 20) return 'stranger';
    return 'enemy';
  }
}

/**
 * 行为决策服务
 * 处理角色的行为决策逻辑
 */
export class BehaviorDecisionService {
  constructor(private logger: Logger) {}

  /**
   * 评估行为选项
   */
  evaluateBehaviorOptions(
    character: Character,
    options: BehaviorOption[]
  ): BehaviorDecision {
    const personality = character.personality;
    const emotionalState = character.getEmotionalState();
    
    let bestOption = options[0];
    let bestScore = -Infinity;
    
    for (const option of options) {
      let score = 0;
      
      // 基于个性特征评分
      if (personality.traits.risk_taking > 0.7 && option.riskLevel > 0.5) {
        score += 20;
      } else if (personality.traits.risk_taking < 0.3 && option.riskLevel < 0.3) {
        score += 20;
      }
      
      // 基于情绪状态评分
      if (emotionalState.intensity > 70 && option.difficulty < 0.5) {
        score += 15; // 高情绪强度时偏好简单行为
      }
      
      // 基于预期奖励评分
      score += option.expectedReward * 10;
      
      // 基于困难度惩罚
      score -= option.difficulty * 10;
      
      if (score > bestScore) {
        bestScore = score;
        bestOption = option;
      }
    }
    
    return {
      action: bestOption.action,
      reasoning: `Selected based on personality compatibility and current emotional state`,
      confidence: Math.min(100, Math.max(0, bestScore)),
      emotionalImpact: this.calculateEmotionalImpact(bestOption, emotionalState),
      expectedOutcome: `Expected positive outcome from ${bestOption.action}`
    };
  }

  /**
   * 计算情绪影响
   */
  private calculateEmotionalImpact(option: BehaviorOption, currentState: EmotionalState): number {
    let impact = 0;
    
    // 风险因素影响情绪
    if (option.riskLevel > 0.7) {
      impact += currentState.intensity > 50 ? 10 : -5;
    }
    
    // 预期奖励影响情绪
    impact += option.expectedReward * 5;
    
    return Math.max(-50, Math.min(50, impact));
  }
}