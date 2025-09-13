/**
 * 游戏内容生成器
 * 基于配置模板动态生成游戏内容
 */

import { GameDataConfiguration, CharacterTemplate, LocationTemplate, DialogueTemplate } from './GameDataConfiguration';
import { Character, CharacterProfile, CharacterPersonality } from '../domains/character/entities';
import { GameLocation } from '../domains/world/entities';
import { Logger } from '../services/Logger';

/**
 * 生成选项
 */
export interface GenerationOptions {
  readonly variation: number; // 0-100, 变化程度
  readonly creativity: number; // 0-100, 创造性
  readonly consistency: number; // 0-100, 一致性
  readonly playerLevel: number; // 1-100, 玩家等级
}

/**
 * 游戏内容生成器
 */
export class GameContentGenerator {
  constructor(
    private config: GameDataConfiguration,
    private logger: Logger
  ) {}

  /**
   * 生成角色
   */
  generateCharacter(templateId?: string, options: Partial<GenerationOptions> = {}): Character | null {
    const template = templateId ? 
      this.config.getCharacterTemplate(templateId) : 
      this.config.getRandomCharacterTemplate();

    if (!template) {
      this.logger.warn('No character template available for generation');
      return null;
    }

    const opts: GenerationOptions = {
      variation: 30,
      creativity: 50,
      consistency: 80,
      playerLevel: 1,
      ...options
    };

    const profile: CharacterProfile = {
      id: `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: this.generateVariedName(template.name, opts.variation),
      background: this.generateVariedBackground(template.background, opts),
      appearance: typeof template.appearance === 'string' ? template.appearance : 'Default appearance',
      personality: {
        traits: this.convertTraitsToRecord(template.personality.traits),
        values: this.convertValuesToRecord(template.personality.values),
        goals: [...(template.background.goals || [])],
        fears: (template.personality as any).fears || [],
        motivations: (template.personality as any).motivations || []
      }
    };

    const character = new Character(
      profile.id,
      profile
    );

    this.logger.info(`Generated character: ${profile.name} from template ${template.id}`);
    return character;
  }

  /**
   * 生成位置
   */
  generateLocation(templateId?: string, options: Partial<GenerationOptions> = {}): GameLocation | null {
    const template = templateId ? 
      this.config.getLocationTemplate(templateId) : 
      this.config.getRandomLocationTemplate();

    if (!template) {
      this.logger.warn('No location template available for generation');
      return null;
    }

    const opts: GenerationOptions = {
      variation: 40,
      creativity: 60,
      consistency: 70,
      playerLevel: 1,
      ...options
    };

    const location = new GameLocation(
      `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      this.generateVariedName(template.name, opts.variation),
      this.generateVariedDescription(template.description, opts),
      { x: Math.random() * 1000, y: Math.random() * 1000, z: 0 },
      'default_region',
      template.type
    );

    this.logger.info(`Generated location: ${location.name} from template ${template.id}`);
    return location;
  }

  /**
   * 批量生成角色
   */
  generateCharacters(count: number, category?: CharacterTemplate['category'], options: Partial<GenerationOptions> = {}): Character[] {
    const characters: Character[] = [];
    
    for (let i = 0; i < count; i++) {
      const template = category ? 
        this.config.getRandomCharacterTemplate(category) : 
        this.config.getRandomCharacterTemplate();
      
      if (template) {
        const character = this.generateCharacter(template.id, options);
        if (character) {
          characters.push(character);
        }
      }
    }
    
    return characters;
  }

  /**
   * 批量生成位置
   */
  generateLocations(count: number, type?: LocationTemplate['type'], options: Partial<GenerationOptions> = {}): GameLocation[] {
    const locations: GameLocation[] = [];
    
    for (let i = 0; i < count; i++) {
      const template = type ? 
        this.config.getRandomLocationTemplate(type) : 
        this.config.getRandomLocationTemplate();
      
      if (template) {
        const location = this.generateLocation(template.id, options);
        if (location) {
          locations.push(location);
        }
      }
    }
    
    return locations;
  }

  // ========== 私有方法 ==========

  private generateVariedName(baseName: string, variation: number): string {
    if (variation < 20) return baseName;
    
    const nameVariations = [
      'Elder', 'Young', 'Wise', 'Bold', 'Swift', 'Ancient', 'New', 'Hidden', 'Lost', 'Found'
    ];
    
    if (variation > 70 && Math.random() < 0.6) {
      const prefix = nameVariations[Math.floor(Math.random() * nameVariations.length)];
      return `${prefix} ${baseName}`;
    }
    
    return baseName;
  }

  private generateVariedDescription(baseDescription: string, options: GenerationOptions): string {
    if (options.variation < 30) return baseDescription;
    
    // 简化实现：根据变化程度调整描述
    const variations = [
      'weathered by time',
      'touched by magic',
      'recently discovered',
      'carefully maintained',
      'mysteriously changed'
    ];
    
    if (options.variation > 60 && Math.random() < 0.5) {
      const variation = variations[Math.floor(Math.random() * variations.length)];
      return `${baseDescription}, ${variation}`;
    }
    
    return baseDescription;
  }

  private generateVariedBackground(baseBackground: any, options: GenerationOptions): string {
    // 简化实现
    return baseBackground.origin || 'Unknown origin';
  }

  /**
   * 转换traits为记录格式
   */
  private convertTraitsToRecord(traits: string[] | any): Record<string, number> {
    if (Array.isArray(traits)) {
      const record: Record<string, number> = {};
      traits.forEach((trait, index) => {
        record[trait] = 50 + Math.random() * 50; // Random value between 50-100
      });
      return record;
    }
    return traits || {};
  }

  /**
   * 转换values为记录格式
   */
  private convertValuesToRecord(values: any): Record<string, number> {
    if (Array.isArray(values)) {
      const record: Record<string, number> = {};
      values.forEach(v => {
        if (typeof v === 'object' && v.trait && v.score !== undefined) {
          record[v.trait] = v.score;
        } else if (typeof v === 'string') {
          record[v] = 50 + Math.random() * 50;
        }
      });
      return record;
    } else if (values instanceof Map) {
      const record: Record<string, number> = {};
      values.forEach((value, key) => {
        record[key] = value;
      });
      return record;
    }
    return values || {};
  }
}