/**
 * 配置系统导出
 */

export * from './GameDataConfiguration';
export * from './GameContentGenerator';
export * from './TestDataGenerator';
export * from './EnvironmentConfig';

// 配置管理器单例
import { GameDataConfiguration } from './GameDataConfiguration';
import { GameContentGenerator } from './GameContentGenerator';
import { Logger, LogLevel } from '../services/Logger';

let configInstance: GameDataConfiguration | null = null;
let generatorInstance: GameContentGenerator | null = null;

/**
 * 获取配置管理器实例
 */
export function getGameDataConfig(): GameDataConfiguration {
  if (!configInstance) {
    configInstance = new GameDataConfiguration(new Logger(LogLevel.INFO));
  }
  return configInstance;
}

/**
 * 获取内容生成器实例
 */
export function getGameContentGenerator(): GameContentGenerator {
  if (!generatorInstance) {
    const config = getGameDataConfig();
    generatorInstance = new GameContentGenerator(config, new Logger(LogLevel.INFO));
  }
  return generatorInstance;
}

/**
 * 初始化配置系统
 */
export async function initializeGameConfig(): Promise<void> {
  const config = getGameDataConfig();
  await config.initialize();
}