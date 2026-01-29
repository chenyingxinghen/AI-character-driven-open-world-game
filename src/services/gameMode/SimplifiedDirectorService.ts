/**
 * 简化版导演服务
 * 直接使用LLM格式化文本输出和提取器，存储干预事件到数据库
 */

import { Logger } from '../Logger';
import { LLMService } from '../llm/LLMService';
import { FormattedTextExtractorService } from '../llm/FormattedTextExtractorService';
import { DatabaseService } from '../database/DatabaseService';
import { StoryEventRecord } from '../database/DatabaseService';

export interface DirectorIntervention {
  sessionId: string;
  interventionType: string;
  content: string;
  effectiveness: number;
  timestamp: Date;
}

export interface DirectorContext {
  sessionId: string;
  playerId: string;
  currentLocation: string;
  recentActions: string[];
  storyState: any;
  characterStates: Record<string, any>;
}

export interface InterventionDecision {
  shouldIntervene: boolean;
  interventionType: string;
  content: string;
  effectiveness: number;
}

export class SimplifiedDirectorService {
  private extractor: FormattedTextExtractorService;

  constructor(
    private llmService: LLMService,
    private databaseService: DatabaseService,
    private logger: Logger
  ) {
    this.extractor = new FormattedTextExtractorService(logger);
  }

  /**
   * 评估是否需要干预并执行干预
   */
  async evaluateAndIntervene(context: DirectorContext): Promise<DirectorIntervention | null> {
    try {
      // 生成干预决策
      const decision = await this.generateInterventionDecision(context);

      if (!decision.shouldIntervene) {
        return null;
      }

      // 执行干预
      const intervention: DirectorIntervention = {
        sessionId: context.sessionId,
        interventionType: decision.interventionType,
        content: decision.content,
        effectiveness: decision.effectiveness,
        timestamp: new Date()
      };

      // 存储干预事件到数据库
      await this.storeInterventionEvent(intervention);

      this.logger.info('Director intervention executed', {
        sessionId: context.sessionId,
        interventionType: decision.interventionType
      });

      return intervention;
    } catch (error) {
      this.logger.error('Failed to execute director intervention', error as Error);
      return null;
    }
  }

  /**
   * 生成干预决策
   */
  private async generateInterventionDecision(context: DirectorContext): Promise<InterventionDecision> {
    // 构建提示词，要求LLM返回格式化文本
    const prompt = `
你是一个游戏导演AI，负责监控游戏进程并在必要时进行干预以保持故事的连贯性和趣味性。

当前游戏状态：
- 会话ID: ${context.sessionId}
- 玩家ID: ${context.playerId}
- 当前位置: ${context.currentLocation}
- 最近行动: ${context.recentActions.join(', ')}
- 故事状态: ${JSON.stringify(context.storyState)}
- 角色状态: ${JSON.stringify(context.characterStates)}

请评估当前游戏状态，并决定是否需要进行干预。如果需要，请指定干预类型和内容。

请严格按照以下格式返回：

=== DIRECTOR_DECISION ===
ACTION: INTERVENE|NO_INTERVENTION
REASONING: 干预内容或不干预的理由
CONFIDENCE: 0-1的数字，表示预期效果/置信度
PARAMETERS: interventionType=dialogue_guidance|event_generation|environment_change|information_hint
=== END_DECISION ===
`;

    try {
      // 调用LLM生成决策
      const response = await this.llmService.generateText(prompt, {
        temperature: 0.5,
        maxTokens: 300
      });

      // 使用格式化文本提取器解析响应
      const decision = this.extractor.extractDirectorDecision(response);

      return {
        shouldIntervene: decision.action !== 'no_intervention',
        interventionType: decision.parameters.interventionType || 'dialogue_guidance',
        content: decision.reasoning,
        effectiveness: decision.confidence * 100
      };
    } catch (error) {
      this.logger.warn('Failed to generate intervention decision, using fallback', error as Error);

      // 返回默认决策（不干预）
      return {
        shouldIntervene: false,
        interventionType: 'none',
        content: '',
        effectiveness: 0
      };
    }
  }

  /**
   * 存储干预事件到数据库
   */
  private async storeInterventionEvent(intervention: DirectorIntervention): Promise<void> {
    try {
      const eventRecord: StoryEventRecord = {
        id: `intervention_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        session_id: intervention.sessionId,
        event_type: 'director_intervention',
        description: `导演干预: ${intervention.interventionType}`,
        location: 'game_world', // 干预通常不局限于特定位置
        involved_characters: [], // 干预可能涉及所有角色
        impact_level: Math.floor(intervention.effectiveness / 10), // 0-10的等级
        story_data: {
          interventionType: intervention.interventionType,
          content: intervention.content,
          effectiveness: intervention.effectiveness,
          timestamp: intervention.timestamp
        },
        created_at: new Date(),
        updated_at: new Date()
      };

      // 存储到数据库
      await this.databaseService.storeStoryEvent(eventRecord);
    } catch (error) {
      this.logger.error('Failed to store intervention event', error as Error);
      throw error;
    }
  }
}