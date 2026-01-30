/**
 * 世界背景故事服务
 * 负责生成、管理和存储世界背景故事
 */

import { Logger } from '../Logger';
import { LLMService } from '../llm/LLMService';
import { DatabaseService } from '../database/DatabaseService';
import { v4 as uuidv4 } from 'uuid';
import { JsonUtils } from '../../utils/JsonUtils';
import { promptManager } from '../../prompts';

export interface WorldLore {
  id: string;
  sessionId: string;
  loreType: 'main_story' | 'history' | 'legend' | 'culture' | 'geography';
  title: string;
  content: string;
  inspiration?: string; // 用户提供的灵感
  generationSeed: string; // 生成种子，用于重现生成过程
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoreGenerationOptions {
  worldName?: string; // 世界名称
  worldDescription?: string; // 世界描述
  inspiration?: string; // 用户提供的灵感
  themes?: string[]; // 主题偏好
  setting?: 'fantasy' | 'medieval' | 'modern' | 'sci-fi' | 'mixed'; // 设定风格
  complexity?: 'simple' | 'moderate' | 'complex'; // 复杂程度
  locale?: 'zh' | 'en'; // 语言
}

export class WorldLoreService {
  constructor(
    private llmService: LLMService,
    private databaseService: DatabaseService,
    private logger: Logger
  ) { }

  /**
   * 为新会话生成完整的世界背景故事
   */
  async generateWorldLoreForSession(
    sessionId: string,
    options: LoreGenerationOptions = {}
  ): Promise<WorldLore[]> {
    this.logger.info(`Generating world lore for session: ${sessionId}`, {
      component: 'WorldLoreService',
      sessionId,
      options
    });

    try {
      // 检查是否已存在世界背景（仅在数据库可用时）
      let hasExistingLore = false;
      try {
        hasExistingLore = await this.databaseService.hasWorldLore(sessionId);
      } catch (dbError) {
        // 如果数据库未初始化或不可用，跳过检查，直接生成新的世界背景
        this.logger.warn('Database not available for world lore check, will generate new world lore', {
          sessionId,
          component: 'WorldLoreService',
          error: (dbError as Error).message
        });
        hasExistingLore = false;
      }

      if (hasExistingLore) {
        this.logger.info('World lore already exists for session, retrieving from database', {
          sessionId,
          component: 'WorldLoreService'
        });
        return await this.databaseService.getWorldLoreBySession(sessionId);
      }

      // 生成种子用于确保一致性
      const generationSeed = this.generateSeed(sessionId, options);

      // 批量生成所有类型的世界背景
      const loreTypes: WorldLore['loreType'][] = ['main_story', 'history', 'legend', 'culture', 'geography'];

      this.logger.info(`Generating ${loreTypes.length} lore types in a single batch request...`);

      const prompt = promptManager.generate('world.batch_generation', {
        worldName: options.worldName,
        worldDescription: options.worldDescription,
        inspiration: options.inspiration,
        complexity: options.complexity,
        setting: options.setting,
        locale: options.locale
      });

      let generatedLore: WorldLore[] = [];
      try {
        const response = await this.llmService.generateText(prompt, {
          maxTokens: 3000,
          temperature: 0.8,
          jsonMode: true
        });

        // 使用 JsonUtils 提取 JSON
        const data = JsonUtils.extractJson<any>(response || '{}');

        for (const type of loreTypes) {
          const item = data[type] || { title: this.getDefaultTitle(type), content: this.getDefaultContent(type) };

          // Truncate title to ensure it fits in database (VARCHAR(200))
          let cleanTitle = item.title || this.getDefaultTitle(type);
          if (cleanTitle.length > 190) {
            cleanTitle = cleanTitle.substring(0, 190) + '...';
          }

          const lore: WorldLore = {
            id: uuidv4(),
            sessionId,
            loreType: type,
            title: cleanTitle,
            content: item.content || this.getDefaultContent(type),
            inspiration: options.inspiration,
            generationSeed,
            metadata: { options, generatedAt: new Date().toISOString() },
            createdAt: new Date(),
            updatedAt: new Date()
          };
          generatedLore.push(lore);

          // 异步存储到数据库
          this.databaseService.createWorldLore({
            id: lore.id,
            session_id: lore.sessionId,
            lore_type: lore.loreType,
            title: lore.title,
            content: lore.content,
            inspiration: lore.inspiration,
            generation_seed: lore.generationSeed,
            metadata: JSON.stringify(lore.metadata || {})
          }).catch(e => this.logger.warn(`Failed to save ${type} lore`, e));
        }
      } catch (genError) {
        this.logger.error('Batch lore generation failed, using fallbacks', genError as Error);
        // 兜底逻辑：使用默认值
        generatedLore = loreTypes.map(type => ({
          id: uuidv4(),
          sessionId,
          loreType: type,
          title: this.getDefaultTitle(type),
          content: this.getDefaultContent(type),
          inspiration: options.inspiration,
          generationSeed,
          metadata: { fallback: true },
          createdAt: new Date(),
          updatedAt: new Date()
        }));
      }

      this.logger.info(`Generated ${generatedLore.length} world lore entries for session`, {
        sessionId,
        component: 'WorldLoreService',
        count: generatedLore.length
      });

      return generatedLore;
    } catch (error) {
      this.logger.error('Failed to generate world lore', error as Error, {
        sessionId,
        component: 'WorldLoreService'
      });
      throw error;
    }
  }

  /**
   * 获取会话的世界背景故事
   */
  async getWorldLoreForSession(sessionId: string, loreType?: WorldLore['loreType']): Promise<WorldLore[]> {
    try {
      const loreRecords = await this.databaseService.getWorldLoreBySession(sessionId, loreType);
      return loreRecords.map((record: any) => this.mapRecordToLore(record));
    } catch (error) {
      this.logger.error('Failed to get world lore', error as Error, {
        sessionId,
        loreType,
        component: 'WorldLoreService'
      });
      // 如果数据库不可用，返回空数组
      return [];
    }
  }

  /**
   * 获取主要故事背景（用于回答用户查询）
   */
  async getMainStoryForSession(sessionId: string): Promise<string> {
    try {
      const mainStoryLore = await this.getWorldLoreForSession(sessionId, 'main_story');
      if (mainStoryLore.length > 0) {
        return mainStoryLore[0].content;
      }

      // 如果没有主故事，生成一个（但不依赖数据库）
      try {
        const lore = await this.generateWorldLoreForSession(sessionId);
        const mainStory = lore.find(l => l.loreType === 'main_story');
        return mainStory?.content || '这是一个充满奇幻和冒险的世界...';
      } catch (generationError) {
        this.logger.warn('Failed to generate main story, using fallback', {
          sessionId,
          component: 'WorldLoreService',
          error: (generationError as Error).message
        });
        return '这是一个充满奇幻和冒险的世界，等待着勇敢的冒险者来探索其中的奥秘...';
      }
    } catch (error) {
      this.logger.error('Failed to get main story', error as Error, {
        sessionId,
        component: 'WorldLoreService'
      });
      return '这是一个充满奇幻和冒险的世界...';
    }
  }

  /**
   * 根据查询类型获取相关的世界背景
   */
  async getLoreByQuery(sessionId: string, query: string): Promise<string> {
    try {
      // 分析查询类型
      const loreType = this.analyzeLoreTypeFromQuery(query);
      const relevantLore = await this.getWorldLoreForSession(sessionId, loreType);

      if (relevantLore.length > 0) {
        return relevantLore[0].content;
      }

      // 如果没有找到相关背景，获取主故事
      return await this.getMainStoryForSession(sessionId);
    } catch (error) {
      this.logger.error('Failed to get lore by query', error as Error, {
        sessionId,
        query,
        component: 'WorldLoreService'
      });
      return '关于这个问题，这个世界有着丰富的历史和传说等待探索...';
    }
  }

  /**
   * 生成特定类型的世界背景
   */
  private async generateSpecificLore(
    sessionId: string,
    loreType: WorldLore['loreType'],
    options: LoreGenerationOptions,
    generationSeed: string
  ): Promise<WorldLore> {
    const prompt = this.buildLoreGenerationPrompt(loreType, options);

    try {
      const response = await this.llmService.generateText(prompt, {
        maxTokens: 800,
        temperature: 0.8
      });

      const content = this.extractContent(response || '', loreType);
      const title = this.generateTitle(loreType, content);

      return {
        id: uuidv4(),
        sessionId,
        loreType,
        title,
        content,
        inspiration: options.inspiration,
        generationSeed,
        metadata: {
          options,
          generatedAt: new Date().toISOString()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      this.logger.error(`Failed to generate ${loreType} lore`, error as Error);

      // 返回默认内容
      return {
        id: uuidv4(),
        sessionId,
        loreType,
        title: this.getDefaultTitle(loreType),
        content: this.getDefaultContent(loreType),
        inspiration: options.inspiration,
        generationSeed,
        metadata: { fallback: true },
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
  }

  /**
   * 构建世界背景生成提示词
   */
  private buildLoreGenerationPrompt(loreType: WorldLore['loreType'], options: LoreGenerationOptions): string {
    const prompt = promptManager.generate('world.specific_lore_generation', {
      context: options,
      loreTypeDescription: this.getLoreTypeDescription(loreType),
      specificInstructions: this.getLoreTypeSpecificInstructions(loreType)
    });

    return prompt;
  }

  /**
   * 获取背景类型描述
   */
  private getLoreTypeDescription(loreType: WorldLore['loreType']): string {
    const descriptions = {
      main_story: '主要故事背景和世界设定',
      history: '历史背景和重要事件',
      legend: '传说和神话故事',
      culture: '文化、习俗和社会结构',
      geography: '地理环境和重要地标'
    };
    return descriptions[loreType];
  }

  /**
   * 获取特定类型的生成指导
   */
  private getLoreTypeSpecificInstructions(loreType: WorldLore['loreType']): string {
    const instructions = {
      main_story: '包括：世界的总体设定、主要冲突、关键势力、玩家的角色定位',
      history: '包括：重要的历史时期、关键事件、著名人物、时代变迁',
      legend: '包括：神话传说、英雄故事、神秘现象、预言或诅咒',
      culture: '包括：社会结构、宗教信仰、节日庆典、生活习俗',
      geography: '包括：主要地区、著名地标、自然奇观、重要城市'
    };
    return instructions[loreType];
  }

  /**
   * 生成确定性的种子
   */
  private generateSeed(sessionId: string, options: LoreGenerationOptions): string {
    const seedData = {
      sessionId,
      inspiration: options.inspiration || '',
      setting: options.setting || 'fantasy',
      complexity: options.complexity || 'moderate',
      timestamp: new Date().toDateString() // 使用日期确保同一天的种子相同
    };

    return Buffer.from(JSON.stringify(seedData)).toString('base64').substring(0, 20);
  }

  /**
   * 从响应中提取内容
   */
  private extractContent(response: string, loreType: WorldLore['loreType']): string {
    // 清理LLM响应，移除多余的格式
    let content = response.trim();

    // 移除可能的标题标记
    content = content.replace(/^#+\s*/, '').replace(/\*\*(.+?)\*\*/g, '$1');

    // 确保内容不为空
    if (!content || content.length < 50) {
      return this.getDefaultContent(loreType);
    }

    return content;
  }

  /**
   * 生成标题
   */
  private generateTitle(loreType: WorldLore['loreType'], content: string): string {
    const titles = {
      main_story: '世界设定',
      history: '历史纪元',
      legend: '古老传说',
      culture: '文化风貌',
      geography: '地理概览'
    };

    return titles[loreType];
  }

  /**
   * 获取默认标题
   */
  private getDefaultTitle(loreType: WorldLore['loreType']): string {
    return this.generateTitle(loreType, '');
  }

  /**
   * 获取默认内容
   */
  private getDefaultContent(loreType: WorldLore['loreType']): string {
    const defaultContents = {
      main_story: '这是一个充满奇幻和冒险的世界，古老的魔法与现代的智慧交相辉映，各种势力在这片大陆上争夺着权力与资源。',
      history: '这片土地拥有悠久的历史，见证了无数王朝的兴衰和英雄的传说。古老的遗迹诉说着过往的辉煌。',
      legend: '流传着许多神秘的传说，讲述着古代英雄的壮举和神奇生物的故事，这些传说至今仍在人们心中流传。',
      culture: '这里的人们有着独特的文化传统，重视荣誉、友谊和智慧，各种节日和仪式丰富着人们的生活。',
      geography: '这片大陆地形多样，有雄伟的山脉、广袤的平原、神秘的森林和繁华的城市，每个地方都有其独特的风貌。'
    };

    return defaultContents[loreType];
  }

  /**
   * 分析查询对应的背景类型
   */
  private analyzeLoreTypeFromQuery(query: string): WorldLore['loreType'] {
    const lowerQuery = query.toLowerCase();

    if (/历史|过去|古代|王朝|事件/.test(lowerQuery)) {
      return 'history';
    }
    if (/传说|神话|英雄|预言|诅咒/.test(lowerQuery)) {
      return 'legend';
    }
    if (/文化|习俗|宗教|节日|社会/.test(lowerQuery)) {
      return 'culture';
    }
    if (/地理|地形|城市|山脉|河流/.test(lowerQuery)) {
      return 'geography';
    }

    return 'main_story'; // 默认返回主故事
  }

  /**
   * 将数据库记录映射为WorldLore对象
   */
  private mapRecordToLore(record: any): WorldLore {
    return {
      id: record.id,
      sessionId: record.session_id,
      loreType: record.lore_type,
      title: record.title,
      content: record.content,
      inspiration: record.inspiration,
      generationSeed: record.generation_seed,
      metadata: typeof record.metadata === 'string' ? JSON.parse(record.metadata) : record.metadata,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    };
  }
}