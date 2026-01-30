/**
 * 动态位置生成服务
 * 当目标位置不存在时，智能生成新位置
 */

import { LLMService } from '../llm/LLMService';
import { Logger } from '../Logger';
import { FormattedTextGenerator } from '../llm/FormattedTextResponse';

export interface LocationDefinition {
  id: string;
  name: string;
  description: string;
  region: string;
  connections: string[];
  dynamicallyGenerated: boolean;
}

export class DynamicLocationService {
  constructor(
    private llmService: LLMService,
    private logger: Logger
  ) { }

  /**
   * 动态生成位置定义
   */
  async generateLocation(
    locationName: string,
    context: {
      currentLocation: string;
      gameStyle: string;
      existingLocations: string[];
    }
  ): Promise<LocationDefinition> {
    try {
      // 生成位置ID
      const locationId = this.generateLocationId(locationName);

      // 使用LLM生成位置描述
      const prompt = FormattedTextGenerator.generateLocationCreationPrompt(locationName, {
        currentLocation: context.currentLocation,
        gameStyle: context.gameStyle
      });

      const description = await this.llmService.generateText(prompt, {
        maxTokens: 100,
        temperature: 0.7
      });

      // 确定区域和连接
      const region = this.determineRegion(locationName, context.existingLocations);
      const connections = this.generateConnections(locationId, context.currentLocation, context.existingLocations);

      const location: LocationDefinition = {
        id: locationId,
        name: locationName,
        description: description.trim() || `一个名为${locationName}的神秘地方。`,
        region,
        connections,
        dynamicallyGenerated: true
      };

      this.logger.info('Dynamically generated new location', {
        component: 'DynamicLocationService',
        locationId,
        locationName,
        description: location.description
      });

      return location;
    } catch (error) {
      this.logger.error('Failed to generate location dynamically', error as Error, {
        component: 'DynamicLocationService',
        locationName
      });

      // 返回默认位置定义
      return this.getDefaultLocation(locationName);
    }
  }

  /**
   * 生成位置ID
   */
  private generateLocationId(locationName: string): string {
    // 将中文名称转换为英文ID
    const mapping: Record<string, string> = {
      '图书馆': 'library',
      '书店': 'bookstore',
      '市场': 'market',
      '广场': 'town_square',
      '公园': 'park',
      '学校': 'school',
      '医院': 'hospital',
      '银行': 'bank',
      '餐厅': 'restaurant',
      '酒店': 'hotel',
      '家': 'home',
      '办公室': 'office',
      '车站': 'station',
      '机场': 'airport',
      '教堂': 'church',
      '博物馆': 'museum',
      '剧院': 'theater',
      '电影院': 'cinema',
      '体育馆': 'gym',
      '游泳池': 'pool',
      '咖啡厅': 'cafe'
    };

    // 如果有预定义映射，使用它
    if (mapping[locationName]) {
      return mapping[locationName];
    }

    // 否则生成基于拼音或简化的ID
    const simplifiedName = locationName
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]/g, '_')
      .replace(/[_]+/g, '_')
      .replace(/^_|_$/g, '');

    return `dynamic_${simplifiedName}`;
  }

  /**
   * 确定位置所属区域
   */
  private determineRegion(locationName: string, existingLocations: string[]): string {
    // 根据位置名称确定区域
    const commercialKeywords = ['店', '市场', '商场', '银行', 'shop', 'market', 'bank'];
    const residentialKeywords = ['家', '公园', '住宅', 'home', 'park', 'residential'];
    const culturalKeywords = ['图书馆', '博物馆', '剧院', '学校', 'library', 'museum', 'theater', 'school'];
    const serviceKeywords = ['医院', '车站', '机场', 'hospital', 'station', 'airport'];

    const lower = locationName.toLowerCase();

    if (commercialKeywords.some(keyword => lower.includes(keyword))) {
      return 'commercial_district';
    }
    if (residentialKeywords.some(keyword => lower.includes(keyword))) {
      return 'residential_district';
    }
    if (culturalKeywords.some(keyword => lower.includes(keyword))) {
      return 'cultural_district';
    }
    if (serviceKeywords.some(keyword => lower.includes(keyword))) {
      return 'service_district';
    }

    return 'general_area';
  }

  /**
   * 生成位置连接
   */
  private generateConnections(
    locationId: string,
    currentLocation: string,
    existingLocations: string[]
  ): string[] {
    const connections = [currentLocation]; // 总是连接到当前位置

    // 随机连接到1-3个现有位置，增加连接的丰富性
    const shuffled = [...existingLocations].sort(() => 0.5 - Math.random());
    const additionalConnections = Math.min(3, shuffled.length);
    connections.push(...shuffled.slice(0, additionalConnections));

    return [...new Set(connections)]; // 去重
  }

  /**
   * 获取默认位置定义
   */
  private getDefaultLocation(locationName: string): LocationDefinition {
    return {
      id: this.generateLocationId(locationName),
      name: locationName,
      description: `一个神秘的地方，名为${locationName}。这里充满了未知的可能性。`,
      region: 'unknown_area',
      connections: [], // 不再默认连接到镇中心，让WorldManager处理连接
      dynamicallyGenerated: true
    };
  }

  /**
   * 验证位置名称是否合理
   */
  isValidLocationName(locationName: string): boolean {
    // 基本验证规则
    if (!locationName || locationName.trim().length === 0) {
      return false;
    }

    // 长度检查
    if (locationName.length > 20 || locationName.length < 2) {
      return false;
    }

    // 不允许的字符
    const invalidChars = /[<>{}[\]|\\`~!@#$%^&*()=+;:"'.,?\/]/;
    if (invalidChars.test(locationName)) {
      return false;
    }

    return true;
  }
}