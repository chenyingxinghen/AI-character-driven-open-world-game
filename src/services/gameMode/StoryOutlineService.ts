/**
 * 故事大纲服务
 * 负责管理和生成故事大纲，提供剧本模式的故事内容
 */

import { Logger } from '../../services/Logger';
import { LLMService } from '../../services/llm/LLMService';
import {
  StoryOutline,
  StoryAct,
  PlotPoint,
  StoryCharacter,
  StoryLocation,
  StoryGenre,
  PlayerPreferences
} from '../../domains/gameMode/valueObjects';

/**
 * 故事大纲模板
 */
export interface StoryOutlineTemplate {
  readonly id: string;
  readonly title: string;
  readonly genre: StoryGenre;
  readonly complexity: 'simple' | 'medium' | 'complex';
  readonly estimatedDuration: number;
  readonly tags: string[];
  readonly template: Partial<StoryOutline>;
}

/**
 * 故事生成参数
 */
export interface StoryGenerationParams {
  readonly genre: StoryGenre;
  readonly targetDuration: number; // 分钟
  readonly complexity: 'simple' | 'medium' | 'complex';
  readonly themes: string[];
  readonly playerPreferences: PlayerPreferences;
  readonly worldContext?: any;
}

/**
 * 故事验证结果
 */
export interface StoryValidationResult {
  readonly isValid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
  readonly suggestions: string[];
  readonly completeness: number; // 0-100
}

/**
 * 故事大纲服务
 */
export class StoryOutlineService {
  private templates: Map<string, StoryOutlineTemplate> = new Map();
  private generatedOutlines: Map<string, StoryOutline> = new Map();

  constructor(
    private llmService: LLMService,
    private logger: Logger
  ) {
    this.initializeTemplates();
  }

  /**
   * 生成新的故事大纲
   */
  async generateStoryOutline(params: StoryGenerationParams): Promise<StoryOutline> {
    this.logger.info('Generating story outline', {
      genre: params.genre,
      duration: params.targetDuration,
      component: 'StoryOutlineService'
    });

    const outlinePrompt = this.buildOutlineGenerationPrompt(params);

    try {
      const outlineData = await this.llmService.generateStructuredResponse(
        outlinePrompt,
        this.getOutlineSchema(),
        {
          temperature: 0.7,
          maxTokens: 1000
        }
      );

      const outline = this.parseOutlineData(outlineData, params);
      const validation = this.validateStoryOutline(outline);

      if (!validation.isValid) {
        this.logger.warn('Generated outline has validation issues', {
          errors: validation.errors,
          component: 'StoryOutlineService'
        });
        // 尝试修复或使用模板
        return this.generateFromTemplate(params);
      }

      // 缓存生成的大纲
      this.generatedOutlines.set(outline.id, outline);
      return outline;
    } catch (error) {
      this.logger.error('Failed to generate story outline', error as Error);
      return this.generateFromTemplate(params);
    }
  }

  /**
   * 从模板生成故事大纲
   */
  async generateFromTemplate(params: StoryGenerationParams): Promise<StoryOutline> {
    const suitableTemplates = this.findSuitableTemplates(params);
    
    if (suitableTemplates.length === 0) {
      return this.createBasicOutline(params);
    }

    const template = suitableTemplates[0];
    const customizedOutline = await this.customizeTemplate(template, params);
    
    this.generatedOutlines.set(customizedOutline.id, customizedOutline);
    return customizedOutline;
  }

  /**
   * 获取故事大纲
   */
  getStoryOutline(outlineId: string): StoryOutline | null {
    return this.generatedOutlines.get(outlineId) || null;
  }

  /**
   * 获取所有可用模板
   */
  getAvailableTemplates(): StoryOutlineTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 根据偏好推荐故事大纲
   */
  recommendStoryOutlines(preferences: PlayerPreferences, limit: number = 5): StoryOutlineTemplate[] {
    const allTemplates = Array.from(this.templates.values());
    
    // 根据偏好评分
    const scored = allTemplates.map(template => ({
      template,
      score: this.calculateTemplateScore(template, preferences)
    }));

    // 排序并返回前N个
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.template);
  }

  /**
   * 验证故事大纲
   */
  validateStoryOutline(outline: StoryOutline): StoryValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // 基础验证
    if (!outline.title || outline.title.trim().length === 0) {
      errors.push('故事标题不能为空');
    }

    if (!outline.summary || outline.summary.trim().length < 20) {
      warnings.push('故事摘要太短，建议至少20个字符');
    }

    if (outline.acts.length === 0) {
      errors.push('故事必须至少包含一个章节');
    }

    if (outline.acts.length > 5) {
      warnings.push('章节数量较多，可能影响游戏体验');
    }

    // 章节验证
    let totalPlotPoints = 0;
    for (const act of outline.acts) {
      if (act.plotPoints.length === 0) {
        warnings.push(`章节"${act.title}"没有剧情点`);
      }
      totalPlotPoints += act.plotPoints.length;
    }

    if (totalPlotPoints < 3) {
      errors.push('故事剧情点太少，至少需要3个');
    }

    if (totalPlotPoints > 20) {
      warnings.push('剧情点过多，可能导致故事冗长');
    }

    // 角色验证
    if (outline.characters.length === 0) {
      warnings.push('故事没有定义角色');
    }

    // 地点验证
    if (outline.locations.length === 0) {
      warnings.push('故事没有定义特殊地点');
    }

    // 时长验证
    if (outline.estimatedDuration < 30) {
      warnings.push('故事时长较短，可能不够丰富');
    }

    if (outline.estimatedDuration > 300) {
      warnings.push('故事时长过长，建议分解为多个部分');
    }

    // 计算完整度
    let completeness = 70; // 基础分
    if (outline.summary.length > 50) completeness += 5;
    if (outline.characters.length > 0) completeness += 10;
    if (outline.locations.length > 0) completeness += 5;
    if (outline.themes.length > 0) completeness += 5;
    if (totalPlotPoints >= 5) completeness += 5;

    // 生成建议
    if (completeness < 80) {
      suggestions.push('考虑添加更多故事细节');
    }
    if (outline.characters.length < 3) {
      suggestions.push('增加更多角色可以丰富故事');
    }
    if (outline.themes.length < 2) {
      suggestions.push('明确更多主题可以增强故事深度');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      completeness: Math.min(100, completeness)
    };
  }

  /**
   * 更新故事大纲
   */
  async updateStoryOutline(
    outlineId: string,
    updates: Partial<StoryOutline>
  ): Promise<StoryOutline | null> {
    const existing = this.generatedOutlines.get(outlineId);
    if (!existing) {
      return null;
    }

    const updated: StoryOutline = {
      ...existing,
      ...updates,
      id: existing.id // 保持ID不变
    };

    // 验证更新后的大纲
    const validation = this.validateStoryOutline(updated);
    if (validation.isValid) {
      this.generatedOutlines.set(outlineId, updated);
      return updated;
    } else {
      this.logger.warn('Story outline update failed validation', {
        outlineId,
        errors: validation.errors,
        component: 'StoryOutlineService'
      });
      return existing; // 返回原始版本
    }
  }

  /**
   * 初始化故事模板
   */
  private initializeTemplates(): void {
    // 神秘文物模板
    this.templates.set('mystery-artifact', {
      id: 'mystery-artifact',
      title: '神秘的古代文物',
      genre: StoryGenre.MYSTERY,
      complexity: 'medium',
      estimatedDuration: 90,
      tags: ['mystery', 'archaeology', 'adventure'],
      template: {
        summary: '玩家发现一个古代文物，揭开隐藏的秘密',
        themes: ['discovery', 'mystery', 'history'],
        acts: [
          {
            id: 'act1',
            title: '发现',
            description: '发现神秘文物',
            plotPoints: [
              {
                id: 'find_artifact',
                title: '发现文物',
                description: '在古老的遗迹中发现神秘文物',
                requiredConditions: [],
                expectedOutcomes: ['examine', 'investigate'],
                priority: 10,
                estimatedTime: 15,
                isOptional: false
              }
            ],
            targetDuration: 30,
            themes: ['discovery']
          }
        ],
        characters: [
          {
            id: 'archaeologist',
            name: '考古学家艾伦',
            role: 'supporting',
            description: '经验丰富的考古学家',
            motivations: ['解开历史谜团'],
            relationships: [],
            appearances: []
          }
        ],
        locations: [
          {
            id: 'ancient_ruins',
            name: '古代遗迹',
            description: '布满神秘符文的古老建筑',
            significance: 'critical',
            connectedLocations: [],
            availableEvents: ['artifact_discovery']
          }
        ]
      }
    });

    // 星际探险模板
    this.templates.set('space-adventure', {
      id: 'space-adventure',
      title: '星际探险',
      genre: StoryGenre.SCIENCE_FICTION,
      complexity: 'complex',
      estimatedDuration: 120,
      tags: ['space', 'exploration', 'technology'],
      template: {
        summary: '探索未知星系，寻找失落的殖民地',
        themes: ['exploration', 'technology', 'survival'],
        acts: [
          {
            id: 'departure',
            title: '启程',
            description: '开始星际旅程',
            plotPoints: [
              {
                id: 'launch',
                title: '飞船发射',
                description: '驾驶飞船离开母星',
                requiredConditions: [],
                expectedOutcomes: ['navigate', 'explore'],
                priority: 10,
                estimatedTime: 20,
                isOptional: false
              }
            ],
            targetDuration: 40,
            themes: ['departure', 'preparation']
          }
        ],
        characters: [
          {
            id: 'ai_companion',
            name: 'AI伴侣ARIA',
            role: 'supporting',
            description: '先进的人工智能助手',
            motivations: ['协助探索任务'],
            relationships: [],
            appearances: []
          }
        ],
        locations: [
          {
            id: 'spaceship',
            name: '探索飞船',
            description: '装备先进科技的星际飞船',
            significance: 'critical',
            connectedLocations: [],
            availableEvents: ['system_check', 'navigation']
          }
        ]
      }
    });

    // 中世纪传奇模板
    this.templates.set('medieval-quest', {
      id: 'medieval-quest',
      title: '中世纪传奇',
      genre: StoryGenre.FANTASY,
      complexity: 'complex',
      estimatedDuration: 150,
      tags: ['fantasy', 'medieval', 'quest'],
      template: {
        summary: '在中世纪幻想世界中完成英雄任务',
        themes: ['heroism', 'magic', 'adventure'],
        acts: [
          {
            id: 'call_to_adventure',
            title: '冒险召唤',
            description: '接受英雄任务',
            plotPoints: [
              {
                id: 'meet_king',
                title: '觐见国王',
                description: '在王宫接受重要任务',
                requiredConditions: [],
                expectedOutcomes: ['accept_quest', 'ask_questions'],
                priority: 10,
                estimatedTime: 25,
                isOptional: false
              }
            ],
            targetDuration: 50,
            themes: ['duty', 'honor']
          }
        ],
        characters: [
          {
            id: 'king',
            name: '国王阿瑟',
            role: 'supporting',
            description: '智慧的统治者',
            motivations: ['保护王国'],
            relationships: [],
            appearances: []
          }
        ],
        locations: [
          {
            id: 'royal_palace',
            name: '王宫',
            description: '宏伟的王室宫殿',
            significance: 'important',
            connectedLocations: [],
            availableEvents: ['royal_audience']
          }
        ]
      }
    });
  }

  /**
   * 查找合适的模板
   */
  private findSuitableTemplates(params: StoryGenerationParams): StoryOutlineTemplate[] {
    const allTemplates = Array.from(this.templates.values());
    
    return allTemplates.filter(template => {
      // 类型匹配
      if (template.genre !== params.genre) return false;
      
      // 时长匹配（允许20%误差）
      const durationDiff = Math.abs(template.estimatedDuration - params.targetDuration);
      const tolerance = params.targetDuration * 0.2;
      if (durationDiff > tolerance) return false;
      
      // 复杂度匹配
      if (template.complexity !== params.complexity) return false;
      
      return true;
    });
  }

  /**
   * 定制模板
   */
  private async customizeTemplate(
    template: StoryOutlineTemplate,
    params: StoryGenerationParams
  ): Promise<StoryOutline> {
    const customizationPrompt = this.buildCustomizationPrompt(template, params);
    
    try {
      const customData = await this.llmService.generateStructuredResponse(
        customizationPrompt,
        this.getCustomizationSchema(),
        {
          temperature: 0.6,
          maxTokens: 600
        }
      );

      return this.applyCustomizations(template, customData, params);
    } catch (error) {
      this.logger.error('Failed to customize template', error as Error);
      return this.createBasicOutlineFromTemplate(template, params);
    }
  }

  /**
   * 创建基础大纲
   */
  private createBasicOutline(params: StoryGenerationParams): StoryOutline {
    const id = `outline_${Date.now()}`;
    
    return {
      id,
      title: `${params.genre}故事`,
      genre: params.genre,
      summary: `一个${params.genre}类型的冒险故事`,
      acts: [
        {
          id: 'act1',
          title: '开始',
          description: '故事的开端',
          plotPoints: [
            {
              id: 'intro',
              title: '故事开始',
              description: '冒险的起点',
              requiredConditions: [],
              expectedOutcomes: ['explore', 'investigate'],
              priority: 10,
              estimatedTime: 20,
              isOptional: false
            }
          ],
          targetDuration: params.targetDuration,
          themes: params.themes
        }
      ],
      characters: [],
      locations: [],
      themes: params.themes,
      estimatedDuration: params.targetDuration,
      tags: [params.genre.toLowerCase()]
    };
  }

  /**
   * 从模板创建基础大纲
   */
  private createBasicOutlineFromTemplate(
    template: StoryOutlineTemplate,
    params: StoryGenerationParams
  ): StoryOutline {
    const baseOutline = template.template as StoryOutline;
    const id = `outline_${Date.now()}`;
    
    return {
      ...baseOutline,
      id,
      title: template.title,
      genre: template.genre,
      estimatedDuration: params.targetDuration,
      themes: params.themes.length > 0 ? params.themes : baseOutline.themes || []
    };
  }

  /**
   * 计算模板评分
   */
  private calculateTemplateScore(
    template: StoryOutlineTemplate,
    preferences: PlayerPreferences
  ): number {
    let score = 0;

    // 类型匹配
    if (template.genre === preferences.preferredGenre) {
      score += 40;
    }

    // 复杂度匹配
    const preferredComplexity = preferences.difficultyLevel > 70 ? 'complex' :
                              preferences.difficultyLevel > 40 ? 'medium' : 'simple';
    if (template.complexity === preferredComplexity) {
      score += 20;
    }

    // 标签匹配（基于叙事风格）
    const narrativeStyleBonus: Record<string, string[]> = {
      'descriptive': ['exploration', 'mystery', 'atmosphere'],
      'dialogue_heavy': ['character', 'interaction', 'social'],
      'action_oriented': ['adventure', 'combat', 'fast-paced']
    };

    const bonusTags = narrativeStyleBonus[preferences.narrativeStyle] || [];
    const matchingTags = template.tags.filter(tag => bonusTags.includes(tag));
    score += matchingTags.length * 10;

    return score;
  }

  /**
   * 构建大纲生成提示
   */
  private buildOutlineGenerationPrompt(params: StoryGenerationParams): string {
    return `
生成${params.genre}类型的故事大纲：

参数设置:
- 故事类型: ${params.genre}
- 目标时长: ${params.targetDuration}分钟
- 复杂度: ${params.complexity}
- 主题: ${params.themes.join(', ')}
- 叙事风格: ${params.playerPreferences.narrativeStyle}

生成要求:
1. 创造引人入胜的故事情节
2. 设计3-5个主要章节
3. 每个章节包含2-4个关键剧情点
4. 定义主要角色和关键地点
5. 确保故事结构完整且连贯

请生成完整的故事大纲结构。
`;
  }

  /**
   * 构建定制提示
   */
  private buildCustomizationPrompt(
    template: StoryOutlineTemplate,
    params: StoryGenerationParams
  ): string {
    return `
基于以下模板定制故事大纲：

原始模板: ${template.title}
定制要求:
- 目标时长调整为: ${params.targetDuration}分钟
- 主题调整为: ${params.themes.join(', ')}
- 适应玩家偏好: ${params.playerPreferences.narrativeStyle}

请提供定制建议，包括标题修改、情节调整、角色变化等。
`;
  }

  /**
   * 获取大纲数据结构
   */
  private getOutlineSchema(): any {
    return {
      type: 'object',
      properties: {
        title: { type: 'string' },
        summary: { type: 'string' },
        acts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              plotPoints: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    expectedOutcomes: { type: 'array', items: { type: 'string' } }
                  }
                }
              }
            }
          }
        },
        characters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              role: { type: 'string' }
            }
          }
        },
        themes: { type: 'array', items: { type: 'string' } }
      },
      required: ['title', 'summary', 'acts']
    };
  }

  /**
   * 获取定制数据结构
   */
  private getCustomizationSchema(): any {
    return {
      type: 'object',
      properties: {
        titleModification: { type: 'string' },
        plotAdjustments: { type: 'array', items: { type: 'string' } },
        characterChanges: { type: 'array', items: { type: 'string' } },
        themeEnhancements: { type: 'array', items: { type: 'string' } }
      }
    };
  }

  /**
   * 解析大纲数据
   */
  private parseOutlineData(outlineData: any, params: StoryGenerationParams): StoryOutline {
    const id = `outline_${Date.now()}`;
    
    const acts: StoryAct[] = (outlineData.acts || []).map((actData: any, index: number) => ({
      id: `act${index + 1}`,
      title: actData.title || `第${index + 1}章`,
      description: actData.description || '',
      plotPoints: (actData.plotPoints || []).map((plotData: any, plotIndex: number) => ({
        id: `plot_${index}_${plotIndex}`,
        title: plotData.title || '剧情点',
        description: plotData.description || '',
        requiredConditions: [],
        expectedOutcomes: plotData.expectedOutcomes || [],
        priority: 5,
        estimatedTime: 15,
        isOptional: false
      })),
      targetDuration: Math.floor(params.targetDuration / (outlineData.acts?.length || 1)),
      themes: params.themes
    }));

    const characters: StoryCharacter[] = (outlineData.characters || []).map((charData: any, index: number) => ({
      id: `char_${index}`,
      name: charData.name || '角色',
      role: charData.role || 'supporting',
      description: charData.description || '',
      motivations: [],
      relationships: [],
      appearances: []
    }));

    return {
      id,
      title: outlineData.title || '未命名故事',
      genre: params.genre,
      summary: outlineData.summary || '',
      acts,
      characters,
      locations: [],
      themes: outlineData.themes || params.themes,
      estimatedDuration: params.targetDuration,
      tags: [params.genre.toLowerCase()]
    };
  }

  /**
   * 应用定制
   */
  private applyCustomizations(
    template: StoryOutlineTemplate,
    customData: any,
    params: StoryGenerationParams
  ): StoryOutline {
    const baseOutline = template.template as StoryOutline;
    const id = `outline_${Date.now()}`;
    
    return {
      ...baseOutline,
      id,
      title: customData.titleModification || template.title,
      genre: params.genre,
      summary: baseOutline.summary || `定制的${params.genre}故事`,
      themes: params.themes.length > 0 ? params.themes : baseOutline.themes || [],
      estimatedDuration: params.targetDuration
    };
  }
}