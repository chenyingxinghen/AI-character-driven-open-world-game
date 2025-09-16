/**
 * 游戏模式系统单元测试
 * 测试游戏模式管理器的核心功能
 */

import { GameModeManager } from '../domains/gameMode/aggregates';
import { 
  GameModeType, 
  FreeModeConfig, 
  ScriptModeConfig, 
  StoryGenre,
  PlayerPreferences,
  ModeConfig 
} from '../domains/gameMode/valueObjects';
import { Logger } from '../services/Logger';
import { LLMService } from '../services/llm/LLMService';

// Mock implementations
class MockLLMService implements LLMService {
  async generateText(prompt: string, options?: any): Promise<string> {
    return 'Mock LLM response for testing';
  }

  async generateStructuredResponse(prompt: string, schema: any, options?: any): Promise<any> {
    return { mock: 'structured response' };
  }

  async generateCharacterResponse(): Promise<any> {
    return {
      dialogue: 'mock character response',
      emotionalState: { mood: 'neutral' },
      confidence: 0.8
    };
  }
  async generateDirectorDecision(): Promise<any> {
    return {
      action: 'CONTINUE',
      reasoning: 'Mock director decision',
      confidence: 0.9,
      parameters: {}
    };
  }
  async processBatchRequests(): Promise<any[]> { return []; }
  getRateLimitStatus(): any { return {}; }
  estimateCost(): any { return {}; }
  updateConfig(): void {}
  getAvailableProviders(): any[] { return []; }
  switchProvider(): void {}
  getDefaultProvider(): any { return 'mock'; }
  async healthCheck(): Promise<any> { return {}; }
}

class MockLogger extends Logger {
  constructor() {
    super();
  }

  info(message: string, data?: any): void {
    // Silent for tests
  }

  warn(message: string, data?: any): void {
    // Silent for tests
  }

  error(message: string, error?: Error, data?: any): void {
    // Silent for tests
  }

  debug(message: string, data?: any): void {
    // Silent for tests
  }
}

describe('GameModeManager', () => {
  let gameModeManager: GameModeManager;
  let mockLLMService: MockLLMService;
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockLLMService = new MockLLMService();
    mockLogger = new MockLogger();
    gameModeManager = new GameModeManager(mockLLMService, mockLogger);
  });

  describe('初始化游戏模式', () => {
    test('应该能够初始化自由模式', async () => {
      const playerPrefs: PlayerPreferences = {
        preferredGenre: StoryGenre.FANTASY,
        difficultyLevel: 50,
        narrativeStyle: 'descriptive',
        interactionFrequency: 'medium',
        allowMatureContent: false,
        languagePreference: 'zh-CN'
      };

      const freeModeConfig: FreeModeConfig = {
        worldGenerationType: 'random',
        characterCreationEnabled: true,
        locationAccessLevel: 'unrestricted',
        eventRandomness: 70,
        creativeFreedom: 80
      };

      const config: ModeConfig = {
        mode: GameModeType.FREE,
        sessionId: 'test-session-1',
        worldSeed: 'test-seed',
        playerPreferences: playerPrefs,
        modeSpecificConfig: freeModeConfig
      };

      const result = await gameModeManager.initializeGameMode(config, 'test-player');

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session?.id).toBe('test-session-1');
      expect(result.errors).toBeUndefined();
    });

    test('应该能够初始化剧本模式', async () => {
      const playerPrefs: PlayerPreferences = {
        preferredGenre: StoryGenre.MYSTERY,
        difficultyLevel: 60,
        narrativeStyle: 'dialogue_heavy',
        interactionFrequency: 'high',
        allowMatureContent: false,
        languagePreference: 'zh-CN'
      };

      const scriptModeConfig: ScriptModeConfig = {
        storyOutlineId: 'mystery-artifact',
        directorInterventionLevel: 70,
        storyDeviationTolerance: 40,
        targetStoryLength: 120,
        keyPlotPoints: [],
        allowPlayerDeviations: true
      };

      const config: ModeConfig = {
        mode: GameModeType.SCRIPT,
        sessionId: 'test-session-2',
        worldSeed: 'test-seed-2',
        playerPreferences: playerPrefs,
        modeSpecificConfig: scriptModeConfig
      };

      const result = await gameModeManager.initializeGameMode(config, 'test-player');

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session?.id).toBe('test-session-2');
    });

    test('应该拒绝无效配置', async () => {
      const invalidConfig: ModeConfig = {
        mode: GameModeType.FREE,
        sessionId: '', // 无效的空会话ID
        worldSeed: 'test-seed',
        playerPreferences: {
          preferredGenre: StoryGenre.FANTASY,
          difficultyLevel: 150, // 无效的难度级别
          narrativeStyle: 'descriptive',
          interactionFrequency: 'medium',
          allowMatureContent: false,
          languagePreference: 'zh-CN'
        },
        modeSpecificConfig: {
          worldGenerationType: 'random',
          characterCreationEnabled: true,
          locationAccessLevel: 'unrestricted',
          eventRandomness: 70,
          creativeFreedom: 80
        } as FreeModeConfig
      };

      const result = await gameModeManager.initializeGameMode(invalidConfig, 'test-player');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('模式切换', () => {
    beforeEach(async () => {
      // 首先初始化一个自由模式会话
      const config: ModeConfig = {
        mode: GameModeType.FREE,
        sessionId: 'switch-test-session',
        worldSeed: 'switch-test-seed',
        playerPreferences: {
          preferredGenre: StoryGenre.FANTASY,
          difficultyLevel: 50,
          narrativeStyle: 'descriptive',
          interactionFrequency: 'medium',
          allowMatureContent: false,
          languagePreference: 'zh-CN'
        },
        modeSpecificConfig: {
          worldGenerationType: 'random',
          characterCreationEnabled: true,
          locationAccessLevel: 'unrestricted',
          eventRandomness: 70,
          creativeFreedom: 80
        } as FreeModeConfig
      };

      await gameModeManager.initializeGameMode(config, 'test-player');
    });

    test('应该能够从自由模式切换到剧本模式', async () => {
      const scriptModeConfig: ScriptModeConfig = {
        storyOutlineId: 'mystery-artifact',
        directorInterventionLevel: 60,
        storyDeviationTolerance: 50,
        targetStoryLength: 90,
        keyPlotPoints: [],
        allowPlayerDeviations: true
      };

      const result = await gameModeManager.switchMode(GameModeType.SCRIPT, scriptModeConfig);

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    test('应该能够从剧本模式切换到自由模式', async () => {
      // 先切换到剧本模式
      const scriptModeConfig: ScriptModeConfig = {
        storyOutlineId: 'mystery-artifact',
        directorInterventionLevel: 60,
        storyDeviationTolerance: 50,
        targetStoryLength: 90,
        keyPlotPoints: [],
        allowPlayerDeviations: true
      };

      await gameModeManager.switchMode(GameModeType.SCRIPT, scriptModeConfig);

      // 然后切换回自由模式
      const freeModeConfig: FreeModeConfig = {
        worldGenerationType: 'guided',
        characterCreationEnabled: true,
        locationAccessLevel: 'unrestricted',
        eventRandomness: 60,
        creativeFreedom: 90
      };

      const result = await gameModeManager.switchMode(GameModeType.FREE, freeModeConfig);

      expect(result.success).toBe(true);
    });
  });

  describe('处理玩家行动', () => {
    beforeEach(async () => {
      const config: ModeConfig = {
        mode: GameModeType.FREE,
        sessionId: 'action-test-session',
        worldSeed: 'action-test-seed',
        playerPreferences: {
          preferredGenre: StoryGenre.FANTASY,
          difficultyLevel: 50,
          narrativeStyle: 'descriptive',
          interactionFrequency: 'medium',
          allowMatureContent: false,
          languagePreference: 'zh-CN'
        },
        modeSpecificConfig: {
          worldGenerationType: 'random',
          characterCreationEnabled: true,
          locationAccessLevel: 'unrestricted',
          eventRandomness: 70,
          creativeFreedom: 80
        } as FreeModeConfig
      };

      await gameModeManager.initializeGameMode(config, 'test-player');
    });

    test('应该能够处理自由模式下的玩家行动', async () => {
      const result = await gameModeManager.processPlayerAction(
        'test-player',
        '我想要探索附近的森林',
        { location: 'town_square' }
      );

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(typeof result.response).toBe('string');
      expect(result.response.length).toBeGreaterThan(0);
    });

    test('应该返回有意义的响应', async () => {
      const result = await gameModeManager.processPlayerAction(
        'test-player',
        '我想要与村民对话',
        { location: 'town_square' }
      );

      expect(result.success).toBe(true);
      expect(result.response).toContain('Mock LLM response');
    });
  });

  describe('获取模式状态', () => {
    test('在未初始化时应该返回null', () => {
      const state = gameModeManager.getCurrentModeState();
      expect(state).toBeNull();
    });

    test('在初始化后应该返回有效状态', async () => {
      const config: ModeConfig = {
        mode: GameModeType.FREE,
        sessionId: 'state-test-session',
        worldSeed: 'state-test-seed',
        playerPreferences: {
          preferredGenre: StoryGenre.FANTASY,
          difficultyLevel: 50,
          narrativeStyle: 'descriptive',
          interactionFrequency: 'medium',
          allowMatureContent: false,
          languagePreference: 'zh-CN'
        },
        modeSpecificConfig: {
          worldGenerationType: 'random',
          characterCreationEnabled: true,
          locationAccessLevel: 'unrestricted',
          eventRandomness: 70,
          creativeFreedom: 80
        } as FreeModeConfig
      };

      await gameModeManager.initializeGameMode(config, 'test-player');

      const state = gameModeManager.getCurrentModeState();
      expect(state).not.toBeNull();
      expect(state!.currentMode).toBe(GameModeType.FREE);
      expect(state!.isTransitioning).toBe(false);
      expect(state!.sessionStartTime).toBeInstanceOf(Date);
    });
  });

  describe('故事进展（剧本模式）', () => {
    beforeEach(async () => {
      const config: ModeConfig = {
        mode: GameModeType.SCRIPT,
        sessionId: 'story-test-session',
        worldSeed: 'story-test-seed',
        playerPreferences: {
          preferredGenre: StoryGenre.MYSTERY,
          difficultyLevel: 50,
          narrativeStyle: 'descriptive',
          interactionFrequency: 'medium',
          allowMatureContent: false,
          languagePreference: 'zh-CN'
        },
        modeSpecificConfig: {
          storyOutlineId: 'mystery-artifact',
          directorInterventionLevel: 60,
          storyDeviationTolerance: 40,
          targetStoryLength: 120,
          keyPlotPoints: [],
          allowPlayerDeviations: true
        } as ScriptModeConfig
      };

      await gameModeManager.initializeGameMode(config, 'test-player');
    });

    test('应该能够获取故事进展信息', () => {
      const progress = gameModeManager.getStoryProgress();
      
      expect(progress).not.toBeNull();
      expect(progress!.currentAct).toBe(1);
      expect(progress!.completionPercentage).toBe(0);
      expect(typeof progress!.overallDeviation).toBe('number');
    });

    test('应该能够获取导演统计信息', () => {
      const stats = gameModeManager.getDirectorStats();
      
      expect(stats).not.toBeNull();
      expect(stats.totalInterventions).toBe(0);
      expect(stats.isActive).toBe(true);
      expect(Array.isArray(stats.activeCooldowns)).toBe(true);
    });
  });
});

describe('模式配置验证', () => {
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockLogger = new MockLogger();
  });

  test('应该验证有效的自由模式配置', () => {
    const { ModeConfigValidationService } = require('../src/domains/gameMode/services');
    const validationService = new ModeConfigValidationService(mockLogger);

    const config: ModeConfig = {
      mode: GameModeType.FREE,
      sessionId: 'valid-session',
      worldSeed: 'valid-seed',
      playerPreferences: {
        preferredGenre: StoryGenre.FANTASY,
        difficultyLevel: 50,
        narrativeStyle: 'descriptive',
        interactionFrequency: 'medium',
        allowMatureContent: false,
        languagePreference: 'zh-CN'
      },
      modeSpecificConfig: {
        worldGenerationType: 'random',
        characterCreationEnabled: true,
        locationAccessLevel: 'unrestricted',
        eventRandomness: 70,
        creativeFreedom: 80
      } as FreeModeConfig
    };

    const result = validationService.validateModeConfig(config);

    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  test('应该检测无效配置', () => {
    const { ModeConfigValidationService } = require('../src/domains/gameMode/services');
    const validationService = new ModeConfigValidationService(mockLogger);

    const config: ModeConfig = {
      mode: GameModeType.FREE,
      sessionId: '', // 无效
      worldSeed: '',  // 无效
      playerPreferences: {
        preferredGenre: StoryGenre.FANTASY,
        difficultyLevel: 150, // 超出范围
        narrativeStyle: 'descriptive',
        interactionFrequency: 'medium',
        allowMatureContent: false,
        languagePreference: 'zh-CN'
      },
      modeSpecificConfig: {
        worldGenerationType: 'random',
        characterCreationEnabled: true,
        locationAccessLevel: 'unrestricted',
        eventRandomness: 120, // 超出范围
        creativeFreedom: 80
      } as FreeModeConfig
    };

    const result = validationService.validateModeConfig(config);

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors).toContain('Session ID is required');
    expect(result.errors).toContain('World seed is required');
  });
});