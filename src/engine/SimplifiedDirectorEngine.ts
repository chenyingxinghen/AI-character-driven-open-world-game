/**
 * 简化版导演引擎
 * 使用LLM格式化文本输出和提取器，直接获得是否进行操作和干预方法，然后执行
 */

import { Logger } from '../services/Logger';
import { LLMService } from '../services/llm/LLMService';
import { DatabaseService } from '../services/database/DatabaseService';
import { FormattedTextExtractorService } from '../services/llm/FormattedTextExtractorService';
import { StoryEventRecord } from '../services/database/DatabaseService';

export interface DirectorContext {
  sessionId: string;
  playerId: string;
  currentLocation: string;
  recentActions: string[];
  storyState: any;
  characterStates: Record<string, any>;
  currentTime: Date;
}

export interface DirectorDecision {
  shouldIntervene: boolean;
  interventionType: string;
  content: string;
  effectiveness: number;
  parameters: Record<string, any>;
}

export interface InterventionResult {
  success: boolean;
  interventionContent: string;
  expectedOutcome: string;
  followUpActions: string[];
}

export class SimplifiedDirectorEngine {
  private extractor: FormattedTextExtractorService;

  constructor(
    private llmService: LLMService,
    private databaseService: DatabaseService,
    private logger: Logger
  ) {
    this.extractor = new FormattedTextExtractorService(logger);
  }

  /**
   * 导演决策的 JSON Schema
   */
  private readonly DIRECTOR_SCHEMA = {
    type: "object",
    properties: {
      shouldIntervene: { type: "boolean" },
      conflictEvaluation: {
        type: "object",
        properties: {
          currentTension: { type: "number", minimum: 0, maximum: 100 },
          primaryConflict: { type: "string" },
          suggestedConflictEscalation: { type: "string" }
        },
        required: ["currentTension", "primaryConflict"]
      },
      intervention: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["dialogue_guidance", "event_generation", "environment_change", "character_introduction", "none"]
          },
          content: { type: "string" },
          targetActorId: { type: "string" },
          priority: { type: "number", minimum: 1, maximum: 10 }
        }
      }
    },
    required: ["shouldIntervene", "conflictEvaluation"]
  };

  /**
   * 评估当前故事进展并决定是否需要导演干预 (增强版: 支持冲突评估与结构化输出)
   */
  async evaluateStoryProgression(context: DirectorContext): Promise<{
    shouldIntervene: boolean;
    decision?: DirectorDecision;
  }> {
    try {
      const prompt = `As a Game Director AI, evaluate the current story progression and tension.
Current Game State:
Location: ${context.currentLocation}
Recent Actions: ${context.recentActions.join(', ')}
Story State: ${JSON.stringify(context.storyState)}
Character States: ${JSON.stringify(context.characterStates)}

Evaluate if a narrative intervention is needed to maintain engagement or drive the conflict forward.`;

      const result = await this.llmService.generateStructuredResponse(
        prompt,
        this.DIRECTOR_SCHEMA,
        { temperature: 0.3 }
      );

      if (!result.shouldIntervene) {
        return { shouldIntervene: false, decision: result };
      }

      const decision: DirectorDecision = {
        shouldIntervene: true,
        interventionType: result.intervention?.type || 'event_generation',
        content: result.intervention?.content || '',
        effectiveness: result.conflictEvaluation?.currentTension || 50,
        parameters: {
          ...result.intervention,
          ...result.conflictEvaluation
        }
      };

      return { shouldIntervene: true, decision };
    } catch (error) {
      this.logger.error('Error evaluating story progression (structured):', error as Error);
      return { shouldIntervene: false };
    }
  }

  /**
   * 执行导演干预
   */
  async executeIntervention(
    decision: DirectorDecision,
    context: DirectorContext
  ): Promise<InterventionResult> {
    try {
      this.logger.info('Executing director intervention', {
        sessionId: context.sessionId,
        interventionType: decision.interventionType,
        component: 'SimplifiedDirectorEngine'
      });

      // 生成干预内容
      const interventionContent = decision.content;

      // 记录干预到数据库
      await this.recordIntervention(decision, context);

      // 存储干预事件到故事事件表
      await this.storeInterventionAsStoryEvent(decision, context);

      return {
        success: true,
        interventionContent,
        expectedOutcome: this.predictInterventionOutcome(decision),
        followUpActions: this.generateFollowUpActions(decision)
      };
    } catch (error) {
      this.logger.error('Failed to execute director intervention', error as Error);
      return {
        success: false,
        interventionContent: '系统正在观察情况，稍后提供指导',
        expectedOutcome: '维持当前状态',
        followUpActions: ['继续监控']
      };
    }
  }

  /**
   * 提取指定的段落
   */
  private extractSection(text: string, startMarker: string, endMarker: string): string {
    const startPattern = new RegExp(`===\\s*${startMarker}\\s*===`, 'i');
    const endPattern = new RegExp(`===\\s*${endMarker}\\s*===`, 'i');

    const startMatch = text.match(startPattern);
    const endMatch = text.match(endPattern);

    if (!startMatch || !endMatch) {
      throw new Error(`Could not find section markers: ${startMarker} - ${endMarker}`);
    }

    const startIndex = startMatch.index! + startMatch[0].length;
    const endIndex = endMatch.index!;

    if (startIndex >= endIndex) {
      throw new Error(`Invalid section boundaries: ${startMarker} - ${endMarker}`);
    }

    return text.substring(startIndex, endIndex).trim();
  }

  /**
   * 解析字段
   */
  private parseFields(section: string): Record<string, string> {
    const fields: Record<string, string> = {};
    const lines = section.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        fields[key] = value;
      }
    }

    return fields;
  }

  /**
   * 解析数字
   */
  private parseNumber(value: string, min: number, max: number): number {
    const num = parseFloat(value);
    if (isNaN(num)) {
      throw new Error(`Invalid number: ${value}`);
    }
    if (num < min || num > max) {
      throw new Error(`Number ${num} is out of range [${min}, ${max}]`);
    }
    return num;
  }

  /**
   * 解析布尔值
   */
  private parseBoolean(value: string): boolean {
    const lower = value.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
    throw new Error(`Invalid boolean value: ${value}`);
  }

  /**
   * 解析参数
   */
  private parseParameters(value: string): Record<string, any> {
    try {
      return JSON.parse(value);
    } catch (error) {
      this.logger.warn('Failed to parse parameters, using empty object', error as Error);
      return {};
    }
  }

  /**
   * 记录干预
   */
  private async recordIntervention(
    decision: DirectorDecision,
    context: DirectorContext
  ): Promise<void> {
    try {
      // 这里可以记录到专门的干预记录表（如果存在）
      this.logger.info('Intervention recorded', {
        sessionId: context.sessionId,
        interventionType: decision.interventionType
      });
    } catch (error) {
      this.logger.warn('Failed to record intervention', error as Error);
    }
  }

  /**
   * 存储干预作为故事事件
   */
  private async storeInterventionAsStoryEvent(
    decision: DirectorDecision,
    context: DirectorContext
  ): Promise<void> {
    try {
      const eventRecord: StoryEventRecord = {
        id: `intervention_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        session_id: context.sessionId,
        event_type: 'director_intervention',
        description: `导演干预: ${decision.interventionType}`,
        location: context.currentLocation,
        involved_characters: Object.keys(context.characterStates),
        impact_level: Math.floor(decision.effectiveness / 10), // 0-10的等级
        story_data: {
          interventionType: decision.interventionType,
          content: decision.content,
          effectiveness: decision.effectiveness,
          parameters: decision.parameters,
          timestamp: new Date()
        },
        created_at: new Date(),
        updated_at: new Date()
      };

      // 存储到数据库
      await this.databaseService.storeStoryEvent(eventRecord);

      this.logger.info('Intervention stored as story event', {
        sessionId: context.sessionId,
        eventId: eventRecord.id
      });
    } catch (error) {
      this.logger.error('Failed to store intervention as story event', error as Error);
      throw error;
    }
  }

  /**
   * 预测干预结果
   */
  private predictInterventionOutcome(decision: DirectorDecision): string {
    return `预期通过${decision.interventionType}方式的干预来引导故事发展`;
  }

  /**
   * 生成后续行动
   */
  private generateFollowUpActions(decision: DirectorDecision): string[] {
    return [
      'monitor_player_response',
      'assess_effectiveness',
      'prepare_backup_intervention'
    ];
  }
}