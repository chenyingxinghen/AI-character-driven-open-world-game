/**
 * 游戏模式系统集成测试
 * 测试整个游戏模式系统的集成功能
 */

import { GameModeManager } from '../domains/gameMode/aggregates';
import { FreeModeEngine, IFreeModeEngine } from '../engine/FreeModeEngine';
import { ScriptModeEngine, IScriptModeEngine } from '../engine/ScriptModeEngine';
import { GameModeDirectorEngine, IDirectorEngine } from '../engine/GameModeDirectorEngine';
import {
  GameModeType,
  FreeModeConfig,
  ScriptModeConfig,
  StoryGenre,
  PlayerPreferences,
  ModeConfig,
  InterventionIntensity
} from '../domains/gameMode/valueObjects';
import { Logger } from '../services/Logger';
import { LLMService } from '../services/llm/LLMService';
import { WorldManager } from '../domains/world/aggregates';
import { CharacterManager } from '../domains/character/aggregates';
import { StoryProgress, DirectorController } from '../domains/gameMode/entities';
import { MockDatabaseService } from '../services/database/DatabaseService';

// Mock implementations for testing
class MockLLMService implements LLMService {
  async generateText(prompt: string, options?: any): Promise<string> {
    // 基于提示内容返回模拟响应
    if (prompt.includes('事件生成')) {
      return '一个神秘的旅者出现在你面前，他似乎有重要的信息要告诉你。';
    }
    if (prompt.includes('对话引导')) {
      return '智者说："也许你应该仔细考虑一下这个决定..."';
    }
    if (prompt.includes('自由模式')) {
      return '你的创意行动在这个开放的世界中产生了有趣的连锁反应。';
    }
    if (prompt.includes('剧本模式')) {
      return '故事按照预期的方向发展，你的选择推进了情节。';
    }
    // Handle Director Intervention Prompt
    if (prompt.includes('DIRECTOR_DECISION') || prompt.includes('干预') || prompt.includes('导演')) {
      return `
=== DIRECTOR_DECISION ===
ACTION: INTERVENE
REASONING: The director suggests a subtle hint.
CONFIDENCE: 0.85
PARAMETERS: interventionType=dialogue_guidance
=== END_DECISION ===
`;
    }
    return 'Mock LLM response for testing';
  }

  async generateStructuredResponse(prompt: string, schema: any, options?: any): Promise<any> {
    if (prompt.includes('故事大纲')) {
      return {
        title: '测试故事',
        summary: '这是一个测试用的故事大纲',
        acts: [
          {
            title: '第一章',
            description: '故事开始',
            plotPoints: [
              {
                title: '初始剧情点',
                description: '玩家开始冒险',
                expectedOutcomes: ['explore', 'investigate']
              }
            ]
          }
        ],
        characters: [
          {
            name: '测试角色',
            description: '一个测试用的角色',
            role: 'supporting'
          }
        ],
        themes: ['adventure', 'mystery']
      };
    }
    return { mock: 'structured response' };
  }

  async generateCharacterResponse(character: any, context: any, prompt: string): Promise<any> {
    return {
      dialogue: 'mock character response',
      emotionalState: { mood: 'neutral' },
      confidence: 0.8
    };
  }
  async generateDirectorDecision(context: any, evaluation: any): Promise<any> {
    return {
      action: 'CONTINUE',
      reasoning: 'Mock director decision',
      confidence: 0.9,
      parameters: {}
    };
  }
  async processBatchRequests(requests: any[], options?: any): Promise<any[]> { return []; }
  getRateLimitStatus(): any { return {}; }
  estimateCost(): any { return {}; }
  updateConfig(): void { }
  getAvailableProviders(): any[] { return []; }
  switchProvider(): void { }
  getDefaultProvider(): any { return 'mock'; }
  async healthCheck(): Promise<any> { return {}; }
}

class MockLogger extends Logger {
  constructor() {
    super();
  }

  info(message: string, data?: any): void {
    console.log(`[INFO] ${message}`, data);
  }

  warn(message: string, data?: any): void {
    console.log(`[WARN] ${message}`, data);
  }

  error(message: string, error?: Error, data?: any): void {
    console.log(`[ERROR] ${message}`, error, data);
  }

  debug(message: string, data?: any): void {
    console.log(`[DEBUG] ${message}`, data);
  }
}

class MockWorldManager extends WorldManager {
  constructor() {
    const mockLLM = new MockLLMService();
    const mockLogger = new MockLogger();
    super(mockLLM, mockLogger);
  }

  async initializeWorld(): Promise<void> {
    // Mock implementation
  }
}

class MockCharacterManager extends CharacterManager {
  constructor() {
    const mockLLM = new MockLLMService();
    const mockLogger = new MockLogger();
    super(mockLLM, mockLogger);
  }
}

describe('游戏模式系统集成测试', () => {
  let gameModeManager: GameModeManager;
  let freeModeEngine: IFreeModeEngine;
  let scriptModeEngine: IScriptModeEngine;
  let directorEngine: IDirectorEngine;
  let mockLLMService: MockLLMService;
  let mockLogger: MockLogger;
  let mockWorldManager: MockWorldManager;
  let mockCharacterManager: MockCharacterManager;
  let mockDatabaseService: MockDatabaseService;

  beforeEach(() => {
    mockLLMService = new MockLLMService();
    mockLogger = new MockLogger();
    mockWorldManager = new MockWorldManager();
    mockCharacterManager = new MockCharacterManager();
    mockDatabaseService = new MockDatabaseService();

    gameModeManager = new GameModeManager(mockLLMService, mockLogger, mockDatabaseService);
    freeModeEngine = new FreeModeEngine(mockLLMService, mockWorldManager, mockCharacterManager, mockLogger);
    scriptModeEngine = new ScriptModeEngine(mockLLMService, mockWorldManager, mockCharacterManager, mockLogger);
    directorEngine = new GameModeDirectorEngine(mockLLMService, mockLogger);
  });

  describe('完整的自由模式流程', () => {
    test('应该能够完成完整的自由模式游戏流程', async () => {
      // 1. 初始化自由模式
      const playerPrefs: PlayerPreferences = {
        preferredGenre: StoryGenre.FANTASY,
        difficultyLevel: 60,
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
        creativeFreedom: 85
      };

      const config: ModeConfig = {
        mode: GameModeType.FREE,
        sessionId: 'integration-test-free',
        worldSeed: 'test-seed-123',
        playerPreferences: playerPrefs,
        modeSpecificConfig: freeModeConfig
      };

      const initResult = await gameModeManager.initializeGameMode(config, 'test-player');
      expect(initResult.success).toBe(true);
      expect(initResult.session).toBeDefined();

      // 2. 处理多个玩家行动
      const actions = [
        '我想要探索附近的森林',
        '我试图与一位智者交谈',
        '我寻找隐藏的宝藏',
        '我创建一个新的角色朋友',
        '我想要建造一个秘密基地'
      ];

      for (const action of actions) {
        const response = await gameModeManager.processPlayerAction(
          'test-player',
          action,
          { location: 'forest_clearing' }
        );

        expect(response.success).toBe(true);
        expect(response.response).toBeDefined();
        expect(response.response.length).toBeGreaterThan(0);
      }

      // 3. 检查游戏状态
      const modeState = gameModeManager.getCurrentModeState();
      expect(modeState).not.toBeNull();
      expect(modeState!.currentMode).toBe(GameModeType.FREE);
      expect(modeState!.totalPlayTime).toBeGreaterThan(0);
    });

    test('应该能够在自由模式中处理创意内容生成', async () => {
      // 初始化自由模式引擎
      const freeModeConfig: FreeModeConfig = {
        worldGenerationType: 'custom',
        characterCreationEnabled: true,
        locationAccessLevel: 'unrestricted',
        eventRandomness: 90,
        creativeFreedom: 95
      };

      await freeModeEngine.initialize(freeModeConfig);

      // 测试动态内容创建
      const context = {
        sessionId: 'test-session',
        playerId: 'test-player',
        currentLocation: 'magical_forest',
        worldSeed: 'creative-seed',
        creativeFreedom: 95,
        eventRandomness: 90,
        recentActions: ['explore forest', 'talk to animals'],
        worldState: { magic_level: 'high' }
      };

      const dynamicContent = await freeModeEngine.createDynamicContent(
        '创建一个会说话的神奇动物',
        context
      );

      expect(dynamicContent).toBeDefined();
      expect(dynamicContent.type).toBe('generated_content');
      expect(dynamicContent.description).toBeDefined();

      // 测试随机事件生成
      const randomEvent = await freeModeEngine.generateRandomEvent(context);
      expect(randomEvent).toBeDefined();
      expect(randomEvent.length).toBeGreaterThan(0);
    });
  });

  describe('完整的剧本模式流程', () => {
    test('应该能够完成完整的剧本模式游戏流程', async () => {
      // 1. 初始化剧本模式
      const playerPrefs: PlayerPreferences = {
        preferredGenre: StoryGenre.MYSTERY,
        difficultyLevel: 70,
        narrativeStyle: 'dialogue_heavy',
        interactionFrequency: 'high',
        allowMatureContent: false,
        languagePreference: 'zh-CN'
      };

      const scriptModeConfig: ScriptModeConfig = {
        storyOutlineId: 'mystery-artifact-test',
        directorInterventionLevel: 65,
        storyDeviationTolerance: 35,
        targetStoryLength: 90,
        keyPlotPoints: [],
        allowPlayerDeviations: true
      };

      const config: ModeConfig = {
        mode: GameModeType.SCRIPT,
        sessionId: 'integration-test-script',
        worldSeed: 'script-seed-456',
        playerPreferences: playerPrefs,
        modeSpecificConfig: scriptModeConfig
      };

      const initResult = await gameModeManager.initializeGameMode(config, 'test-player');
      expect(initResult.success).toBe(true);

      // 2. 模拟故事进展
      const storyActions = [
        'I examine and investigate the ancient artifact carefully',
        'I investigate and discover the surroundings',
        'I decide to explore elsewhere', // This should trigger director intervention
        'I return to examine and investigate the artifact',
        'I discover and examine the secret of the artifact'
      ];

      let interventionCount = 0;

      for (const action of storyActions) {
        const response = await gameModeManager.processPlayerAction(
          'test-player',
          action,
          { location: 'ancient_ruins' }
        );

        expect(response.success).toBe(true);
        expect(response.response).toBeDefined();

        if (response.interventionApplied) {
          interventionCount++;
          expect(response.interventionApplied).toBeDefined();
        }

        if (response.storyProgressUpdate) {
          expect(response.storyProgressUpdate.currentAct).toBeGreaterThan(0);
          expect(response.storyProgressUpdate.completionPercentage).toBeGreaterThanOrEqual(0);
        }
      }

      // 3. 验证导演系统工作
      expect(interventionCount).toBeGreaterThan(0); // 应该至少有一次干预

      // 4. 检查故事进展
      const storyProgress = gameModeManager.getStoryProgress();
      expect(storyProgress).not.toBeNull();
      expect(storyProgress!.completionPercentage).toBeGreaterThan(0);

      // 5. 检查导演统计
      const directorStats = gameModeManager.getDirectorStats();
      expect(directorStats).not.toBeNull();
      expect(directorStats.totalInterventions).toBeGreaterThanOrEqual(interventionCount);
    });

    test('应该能够处理不同强度的导演干预', async () => {
      // 测试导演引擎的不同干预级别
      const storyOutline = {
        id: 'test-story',
        title: 'Test Story',
        genre: StoryGenre.FANTASY,
        summary: 'A test story',
        acts: [{
          id: 'act1',
          title: 'Chapter 1',
          description: 'Start',
          plotPoints: [{
            id: 'plot1',
            title: 'Test Plot Point',
            description: 'Investigate the artifact',
            requiredConditions: [],
            expectedOutcomes: ['investigate', 'explore'],
            priority: 10,
            estimatedTime: 15,
            isOptional: false
          }],
          targetDuration: 30,
          themes: ['test']
        }],
        characters: [],
        locations: [],
        themes: ['test'],
        estimatedDuration: 60,
        tags: ['test']
      };

      // Initialize Director Engine
      const storyProgress = new StoryProgress('test-progress', 'test-session', storyOutline);
      const directorController = new DirectorController('test-controller', 'test-session', 50, 30);
      await directorEngine.initialize(storyProgress, directorController);

      // 模拟不同偏离程度的行动
      const testCases = [
        { action: 'investigate', expectedIntervention: false },
        { action: 'explore', expectedIntervention: false },
        { action: 'ignore everything', expectedIntervention: true }
      ];

      for (const testCase of testCases) {
        const context = {
          sessionId: 'test-session',
          playerId: 'test-player',
          currentLocation: 'test-location',
          recentActions: [testCase.action],
          timeElapsed: 10,
          currentPlotPoint: storyOutline.acts[0].plotPoints[0],
          gameVariables: {},
          characterStates: {}
        };

        const evaluation = await directorEngine.evaluatePlayerAction(testCase.action, context);

        expect(evaluation).toBeDefined();
        expect(evaluation.shouldIntervene).toBe(testCase.expectedIntervention);

        if (evaluation.shouldIntervene) {
          expect(evaluation.recommendedIntervention).toBeDefined();
          expect(evaluation.recommendedIntervention!.interventionType).toBeDefined();
          expect(evaluation.recommendedIntervention!.intensity).toBeDefined();
        }
      }
    });
  });

  describe('模式切换测试', () => {
    test('应该能够在游戏中切换模式', async () => {
      // 1. 开始自由模式
      const freeModeConfig: FreeModeConfig = {
        worldGenerationType: 'random',
        characterCreationEnabled: true,
        locationAccessLevel: 'unrestricted',
        eventRandomness: 50,
        creativeFreedom: 70
      };

      const initialConfig: ModeConfig = {
        mode: GameModeType.FREE,
        sessionId: 'mode-switch-test',
        worldSeed: 'switch-seed',
        playerPreferences: {
          preferredGenre: StoryGenre.ADVENTURE,
          difficultyLevel: 50,
          narrativeStyle: 'descriptive',
          interactionFrequency: 'medium',
          allowMatureContent: false,
          languagePreference: 'zh-CN'
        },
        modeSpecificConfig: freeModeConfig
      };

      await gameModeManager.initializeGameMode(initialConfig, 'test-player');

      // 验证初始模式
      let modeState = gameModeManager.getCurrentModeState();
      expect(modeState!.currentMode).toBe(GameModeType.FREE);

      // 2. 切换到剧本模式
      const scriptModeConfig: ScriptModeConfig = {
        storyOutlineId: 'adventure-story',
        directorInterventionLevel: 50,
        storyDeviationTolerance: 60,
        targetStoryLength: 120,
        keyPlotPoints: [],
        allowPlayerDeviations: true
      };

      const switchResult = await gameModeManager.switchMode(GameModeType.SCRIPT, scriptModeConfig);
      expect(switchResult.success).toBe(true);

      // 验证切换后的模式
      modeState = gameModeManager.getCurrentModeState();
      expect(modeState!.currentMode).toBe(GameModeType.SCRIPT);

      // 3. 在新模式下处理行动
      const response = await gameModeManager.processPlayerAction(
        'test-player',
        '我开始新的冒险',
        { location: 'starting_point' }
      );

      expect(response.success).toBe(true);
      expect(response.storyProgressUpdate).toBeDefined(); // 剧本模式特有的进展更新

      // 4. 切换回自由模式
      const backToFreeResult = await gameModeManager.switchMode(GameModeType.FREE, freeModeConfig);
      expect(backToFreeResult.success).toBe(true);

      modeState = gameModeManager.getCurrentModeState();
      expect(modeState!.currentMode).toBe(GameModeType.FREE);
    });

    test('应该保持模式切换时的状态连续性', async () => {
      // 测试模式切换时游戏状态的保持
      const sessionId = 'continuity-test';

      // 初始化并进行一些游戏
      const initialConfig: ModeConfig = {
        mode: GameModeType.FREE,
        sessionId,
        worldSeed: 'continuity-seed',
        playerPreferences: {
          preferredGenre: StoryGenre.FANTASY,
          difficultyLevel: 60,
          narrativeStyle: 'descriptive',
          interactionFrequency: 'medium',
          allowMatureContent: false,
          languagePreference: 'zh-CN'
        },
        modeSpecificConfig: {
          worldGenerationType: 'random',
          characterCreationEnabled: true,
          locationAccessLevel: 'unrestricted',
          eventRandomness: 60,
          creativeFreedom: 80
        } as FreeModeConfig
      };

      await gameModeManager.initializeGameMode(initialConfig, 'test-player');

      // 记录初始状态
      const initialState = gameModeManager.getCurrentModeState();
      const initialSessionStartTime = initialState!.sessionStartTime;

      // 模拟一些游戏时间
      await new Promise(resolve => setTimeout(resolve, 100));

      // 切换模式
      const scriptConfig: ScriptModeConfig = {
        storyOutlineId: 'continuity-story',
        directorInterventionLevel: 50,
        storyDeviationTolerance: 50,
        targetStoryLength: 90,
        keyPlotPoints: [],
        allowPlayerDeviations: true
      };

      await gameModeManager.switchMode(GameModeType.SCRIPT, scriptConfig);

      // 验证状态连续性
      const postSwitchState = gameModeManager.getCurrentModeState();
      expect(postSwitchState!.sessionStartTime).toEqual(initialSessionStartTime);
      expect(postSwitchState!.totalPlayTime).toBeGreaterThanOrEqual(initialState!.totalPlayTime);
    });
  });

  describe('错误处理和边界情况', () => {
    test('应该优雅地处理LLM服务错误', async () => {
      // 创建会失败的LLM服务
      class FailingLLMService {
        async generateText(): Promise<string> {
          throw new Error('LLM service unavailable');
        }

        async generateStructuredResponse(): Promise<any> {
          throw new Error('LLM service unavailable');
        }

        async generateCharacterResponse(): Promise<any> {
          throw new Error('LLM service unavailable');
        }
        async generateDirectorDecision(): Promise<any> {
          throw new Error('LLM service unavailable');
        }
        async processBatchRequests(): Promise<any[]> { return []; }
        getRateLimitStatus(): any { return {}; }
        estimateCost(): any { return {}; }
        updateConfig(): void { }
        getAvailableProviders(): any[] { return []; }
        switchProvider(): void { }
        getDefaultProvider(): any { return 'mock'; }
        async healthCheck(): Promise<any> { return {}; }
      }

      const failingGameModeManager = new GameModeManager(
        new FailingLLMService(),
        mockLogger
      );

      const config: ModeConfig = {
        mode: GameModeType.FREE,
        sessionId: 'error-test',
        worldSeed: 'error-seed',
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
          eventRandomness: 50,
          creativeFreedom: 70
        } as FreeModeConfig
      };

      // 系统应该仍能初始化（使用备用机制）
      const initResult = await failingGameModeManager.initializeGameMode(config, 'test-player');
      expect(initResult.success).toBe(true);

      // 处理行动应该返回备用响应
      const actionResult = await failingGameModeManager.processPlayerAction(
        'test-player',
        '测试行动',
        { location: 'test-location' }
      );

      expect(actionResult.success).toBe(true);
      expect(actionResult.response).toBeDefined();
      expect(actionResult.response.length).toBeGreaterThan(0);
    });

    test('应该处理无效的配置参数', async () => {
      const invalidConfigs = [
        {
          // 缺少sessionId
          mode: GameModeType.FREE,
          sessionId: '',
          worldSeed: 'test-seed',
          playerPreferences: {} as PlayerPreferences,
          modeSpecificConfig: {} as FreeModeConfig
        },
        {
          // 无效的模式特定配置
          mode: GameModeType.SCRIPT,
          sessionId: 'test-session',
          worldSeed: 'test-seed',
          playerPreferences: {
            preferredGenre: StoryGenre.FANTASY,
            difficultyLevel: 150, // 超出范围
            narrativeStyle: 'descriptive',
            interactionFrequency: 'medium',
            allowMatureContent: false,
            languagePreference: 'zh-CN'
          },
          modeSpecificConfig: {
            storyOutlineId: '',
            directorInterventionLevel: -10, // 无效值
            storyDeviationTolerance: 150, // 超出范围
            targetStoryLength: 0,
            keyPlotPoints: [],
            allowPlayerDeviations: true
          } as ScriptModeConfig
        }
      ];

      for (const invalidConfig of invalidConfigs) {
        const result = await gameModeManager.initializeGameMode(
          invalidConfig as ModeConfig,
          'test-player'
        );

        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors!.length).toBeGreaterThan(0);
      }
    });

    test('应该处理并发操作', async () => {
      // 测试同时进行的操作不会导致状态冲突
      const config: ModeConfig = {
        mode: GameModeType.FREE,
        sessionId: 'concurrent-test',
        worldSeed: 'concurrent-seed',
        playerPreferences: {
          preferredGenre: StoryGenre.ADVENTURE,
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
          eventRandomness: 50,
          creativeFreedom: 70
        } as FreeModeConfig
      };

      await gameModeManager.initializeGameMode(config, 'test-player');

      // 同时发起多个行动请求
      const concurrentActions = [
        '我探索北方',
        '我探索南方',
        '我与角色对话',
        '我检查物品',
        '我使用技能'
      ];

      const promises = concurrentActions.map(action =>
        gameModeManager.processPlayerAction(
          'test-player',
          action,
          { location: 'central_hub' }
        )
      );

      const results = await Promise.all(promises);

      // 所有操作都应该成功
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.response).toBeDefined();
      });

      // 状态应该保持一致
      const finalState = gameModeManager.getCurrentModeState();
      expect(finalState).not.toBeNull();
      expect(finalState!.currentMode).toBe(GameModeType.FREE);
    });
  });
});