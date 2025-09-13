/**
 * 测试数据生成器
 * 为开发和测试生成模拟数据
 */

import { Character } from '../domains/character/entities';
import { GameLocation } from '../domains/world/entities';
import { getGameDataConfig, getGameContentGenerator } from './index';
import { Logger, LogLevel } from '../services/Logger';

/**
 * 测试数据生成器
 */
export class TestDataGenerator {
  private config = getGameDataConfig();
  private generator = getGameContentGenerator();
  
  constructor(private logger: Logger) {}

  /**
   * 生成测试角色集合
   */
  async generateTestCharacters(): Promise<Character[]> {
    const characters: Character[] = [];
    
    // 生成3个不同类型的角色
    const categories: Array<'npc' | 'companion' | 'neutral'> = ['npc', 'companion', 'neutral'];
    
    for (const category of categories) {
      const character = this.generator.generateCharacter(undefined, {
        variation: 50,
        creativity: 70
      });
      
      if (character) {
        characters.push(character);
      }
    }
    
    this.logger.info(`Generated ${characters.length} test characters`);
    return characters;
  }

  /**
   * 生成测试位置集合
   */
  async generateTestLocations(): Promise<GameLocation[]> {
    const locations: GameLocation[] = [];
    
    // 生成4个不同类型的位置
    const types: Array<'urban' | 'rural' | 'wilderness' | 'mystical'> = ['urban', 'rural', 'wilderness', 'mystical'];
    
    for (const type of types) {
      const location = this.generator.generateLocation(undefined, {
        variation: 40,
        creativity: 60
      });
      
      if (location) {
        locations.push(location);
      }
    }
    
    this.logger.info(`Generated ${locations.length} test locations`);
    return locations;
  }

  /**
   * 生成完整测试场景
   */
  async generateTestScenario(): Promise<{
    characters: Character[];
    locations: GameLocation[];
    relationships: Array<{ char1: string; char2: string; type: string }>;
  }> {
    const characters = await this.generateTestCharacters();
    const locations = await this.generateTestLocations();
    
    // 生成简单的关系网络
    const relationships = [];
    for (let i = 0; i < characters.length - 1; i++) {
      relationships.push({
        char1: characters[i].id,
        char2: characters[i + 1].id,
        type: 'acquaintance'
      });
    }
    
    this.logger.info('Generated complete test scenario');
    return { characters, locations, relationships };
  }
}

// 导出单例
let testGeneratorInstance: TestDataGenerator | null = null;

export function getTestDataGenerator(): TestDataGenerator {
  if (!testGeneratorInstance) {
    testGeneratorInstance = new TestDataGenerator(new Logger(LogLevel.INFO));
  }
  return testGeneratorInstance;
}