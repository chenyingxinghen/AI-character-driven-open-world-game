/**
 * 游戏模式域服务
 * 提供游戏模式相关的业务逻辑和处理能力
 */

import { Logger } from '../../services/Logger';
import {
  GameModeType,
  InterventionType,
  InterventionIntensity,
  InterventionDecision,
  InterventionOption,
  DeviationRecord,
  StoryOutline,
  PlotPoint,
  ModeConfig,
  FreeModeConfig,
  ScriptModeConfig
} from './valueObjects';
import { StoryProgress, DirectorController } from './entities';

/**
 * 模式配置验证服务
 */
export class ModeConfigValidationService {
  constructor(private logger: Logger) { }

  /**
   * 验证模式配置
   */
  validateModeConfig(config: ModeConfig): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 基础验证
    if (!config.sessionId) {
      errors.push('Session ID is required');
    }

    if (!config.worldSeed) {
      errors.push('World seed is required');
    }

    // 模式特定验证
    if (config.mode === GameModeType.FREE) {
      this.validateFreeModeConfig(config.modeSpecificConfig as FreeModeConfig, errors, warnings);
    } else if (config.mode === GameModeType.SCRIPT) {
      this.validateScriptModeConfig(config.modeSpecificConfig as ScriptModeConfig, errors, warnings);
    }

    // 玩家偏好验证
    this.validatePlayerPreferences(config.playerPreferences, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateFreeModeConfig(config: FreeModeConfig, errors: string[], warnings: string[]): void {
    if (config.eventRandomness < 0 || config.eventRandomness > 100) {
      errors.push('Event randomness must be between 0 and 100');
    }

    if (config.creativeFreedom < 0 || config.creativeFreedom > 100) {
      errors.push('Creative freedom must be between 0 and 100');
    }

    if (config.eventRandomness > 80 && config.creativeFreedom > 80) {
      warnings.push('High randomness and creativity settings may result in unpredictable gameplay');
    }
  }

  private validateScriptModeConfig(config: ScriptModeConfig, errors: string[], warnings: string[]): void {
    if (!config.storyOutlineId) {
      errors.push('Story outline ID is required for script mode');
    }

    if (config.directorInterventionLevel < 0 || config.directorInterventionLevel > 100) {
      errors.push('Director intervention level must be between 0 and 100');
    }

    if (config.storyDeviationTolerance < 0 || config.storyDeviationTolerance > 100) {
      errors.push('Story deviation tolerance must be between 0 and 100');
    }

    if (config.targetStoryLength <= 0) {
      errors.push('Target story length must be greater than 0');
    }

    if (config.directorInterventionLevel > 80 && config.storyDeviationTolerance < 20) {
      warnings.push('High intervention with low tolerance may feel restrictive to players');
    }
  }

  private validatePlayerPreferences(preferences: any, errors: string[], warnings: string[]): void {
    if (!preferences) {
      errors.push('Player preferences are required');
      return;
    }

    if (!preferences.preferredGenre) {
      errors.push('Preferred genre is required');
    }

    if (preferences.difficultyLevel < 0 || preferences.difficultyLevel > 100) {
      errors.push('Difficulty level must be between 0 and 100');
    }
  }
}

/**
 * 干预决策服务
 * 负责决定何时以及如何进行导演干预
 */
export class InterventionDecisionService {
  constructor(private logger: Logger) { }

  /**
   * 评估是否需要干预
   */
  evaluateInterventionNeed(
    currentDeviation: number,
    directorController: DirectorController,
    storyProgress: StoryProgress,
    context: {
      playerAction: string;
      currentPlotPoint?: PlotPoint;
      recentActions: string[];
    }
  ): InterventionDecision {
    this.logger.debug('Evaluating intervention need', {
      deviation: currentDeviation,
      playerAction: context.playerAction,
      component: 'InterventionDecisionService'
    });

    // 获取基础干预选项
    const options = this.generateInterventionOptions(currentDeviation, context);

    // 选择最佳干预方案
    const bestOption = this.selectBestIntervention(options, storyProgress, directorController);

    if (!bestOption) {
      return {
        shouldIntervene: false,
        interventionType: InterventionType.EVENT_GENERATION,
        intensity: InterventionIntensity.NONE,
        reasoning: 'No intervention needed at current deviation level',
        targetElements: [],
        estimatedEffectiveness: 0,
        fallbackOptions: options
      };
    }

    return {
      shouldIntervene: true,
      interventionType: bestOption.type,
      intensity: bestOption.intensity,
      reasoning: this.generateReasoningForIntervention(currentDeviation, context, bestOption),
      targetElements: this.identifyTargetElements(context, bestOption),
      estimatedEffectiveness: this.estimateEffectiveness(bestOption, context),
      fallbackOptions: options.filter(opt => opt !== bestOption)
    };
  }

  /**
   * 生成干预选项
   */
  private generateInterventionOptions(
    deviation: number,
    context: { playerAction: string; currentPlotPoint?: PlotPoint; recentActions: string[] }
  ): InterventionOption[] {
    const options: InterventionOption[] = [];

    // 根据偏离程度生成不同强度的选项
    if (deviation > 30) {
      options.push({
        type: InterventionType.DIALOGUE_GUIDANCE,
        intensity: InterventionIntensity.SUBTLE,
        description: 'Use NPC dialogue to subtly guide player back to story',
        cost: 10,
        riskLevel: 20,
        expectedOutcome: 'Player receives gentle narrative guidance'
      });
    }

    if (deviation > 50) {
      options.push({
        type: InterventionType.EVENT_GENERATION,
        intensity: InterventionIntensity.MODERATE,
        description: 'Generate a story-relevant event to redirect attention',
        cost: 25,
        riskLevel: 40,
        expectedOutcome: 'Player attention refocused on main plot'
      });
    }

    if (deviation > 70) {
      options.push({
        type: InterventionType.ENVIRONMENT_CONTROL,
        intensity: InterventionIntensity.STRONG,
        description: 'Use environmental changes to force plot progression',
        cost: 40,
        riskLevel: 60,
        expectedOutcome: 'Strong redirection towards intended story path'
      });
    }

    if (deviation > 85) {
      options.push({
        type: InterventionType.INFORMATION_INTERFERENCE,
        intensity: InterventionIntensity.FORCED,
        description: 'Direct information manipulation to correct course',
        cost: 60,
        riskLevel: 80,
        expectedOutcome: 'Immediate course correction with high certainty'
      });
    }

    return options;
  }

  /**
   * 选择最佳干预方案
   */
  private selectBestIntervention(
    options: InterventionOption[],
    storyProgress: StoryProgress,
    directorController: DirectorController
  ): InterventionOption | null {
    if (options.length === 0) return null;

    // 过滤掉在冷却中的干预类型
    const availableOptions = options.filter(option =>
      !directorController.isOnCooldown(option.type)
    );

    if (availableOptions.length === 0) return null;

    // 选择风险和成本平衡最好的选项
    return availableOptions.reduce((best, current) => {
      const bestScore = this.calculateOptionScore(best);
      const currentScore = this.calculateOptionScore(current);
      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * 计算选项评分
   */
  private calculateOptionScore(option: InterventionOption): number {
    // 平衡效果、成本和风险
    const effectivenessWeight = 0.5;
    const costWeight = 0.3;
    const riskWeight = 0.2;

    // 假设较高强度意味着较高效果（简化计算）
    const effectiveness = this.intensityToNumber(option.intensity);

    return (effectiveness * effectivenessWeight) -
      (option.cost * costWeight / 100) -
      (option.riskLevel * riskWeight / 100);
  }

  /**
   * 强度转数值
   */
  private intensityToNumber(intensity: InterventionIntensity): number {
    switch (intensity) {
      case InterventionIntensity.NONE: return 0;
      case InterventionIntensity.SUBTLE: return 25;
      case InterventionIntensity.MODERATE: return 50;
      case InterventionIntensity.STRONG: return 75;
      case InterventionIntensity.FORCED: return 100;
      default: return 0;
    }
  }

  /**
   * 生成干预理由
   */
  private generateReasoningForIntervention(
    deviation: number,
    context: any,
    option: InterventionOption
  ): string {
    return `Deviation level ${deviation}% detected. Player action "${context.playerAction}" deviates from expected story path. Applying ${option.intensity} ${option.type} intervention to guide story progression.`;
  }

  /**
   * 识别目标元素
   */
  private identifyTargetElements(context: any, option: InterventionOption): string[] {
    const elements: string[] = [];

    switch (option.type) {
      case InterventionType.DIALOGUE_GUIDANCE:
        elements.push('npcs', 'dialogue_options');
        break;
      case InterventionType.EVENT_GENERATION:
        elements.push('world_events', 'character_actions');
        break;
      case InterventionType.ENVIRONMENT_CONTROL:
        elements.push('location_properties', 'weather', 'lighting');
        break;
      case InterventionType.INFORMATION_INTERFERENCE:
        elements.push('available_information', 'player_knowledge');
        break;
    }

    return elements;
  }

  /**
   * 估算干预效果
   */
  private estimateEffectiveness(option: InterventionOption, context: any): number {
    // 基础效果根据强度
    let effectiveness = this.intensityToNumber(option.intensity);

    // 根据上下文调整
    if (context.recentActions && context.recentActions.length > 0) {
      // 如果玩家最近行动一致，干预效果可能更好
      const actionConsistency = this.calculateActionConsistency(context.recentActions);
      effectiveness *= (1 + actionConsistency * 0.2);
    }

    return Math.min(100, Math.max(0, effectiveness));
  }

  /**
   * 计算行动一致性
   */
  private calculateActionConsistency(actions: string[]): number {
    // 简化的一致性计算
    // 实际实现应该更复杂，分析行动模式
    return 0.5; // 默认中等一致性
  }
}

/**
 * 偏离分析服务
 * 分析玩家行为与预期故事路径的偏离程度
 */
export class DeviationAnalysisService {
  constructor(private logger: Logger) { }

  /**
   * 计算偏离度
   */
  calculateDeviation(
    playerAction: string,
    expectedAction: string,
    currentPlotPoint: PlotPoint | null,
    storyContext: {
      recentActions: string[];
      completedPlotPoints: string[];
      storyVariables: Map<string, any>;
    }
  ): number {
    this.logger.debug('Calculating deviation', {
      playerAction,
      expectedAction,
      component: 'DeviationAnalysisService'
    });

    let deviationScore = 0;

    // 1. 直接动作比较
    deviationScore += this.compareActions(playerAction, expectedAction);

    // 2. 情境相关性分析
    if (currentPlotPoint) {
      deviationScore += this.analyzeContextualRelevance(playerAction, currentPlotPoint);
    }

    // 3. 历史行为模式分析
    deviationScore += this.analyzeHistoricalPattern(playerAction, storyContext.recentActions);

    // 4. 故事连贯性分析
    deviationScore += this.analyzeStoryCohesion(playerAction, storyContext);

    // 标准化分数到0-100范围
    return Math.min(100, Math.max(0, deviationScore));
  }

  /**
   * 创建偏离记录
   */
  createDeviationRecord(
    playerAction: string,
    expectedAction: string,
    deviationScore: number,
    currentPlotPoint: PlotPoint | null
  ): DeviationRecord {
    return {
      id: `deviation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      playerAction,
      expectedAction,
      deviationScore,
      currentPlotPoint: currentPlotPoint?.id || 'none',
      impact: this.categorizeImpact(deviationScore),
      description: this.generateDeviationDescription(playerAction, expectedAction, deviationScore)
    };
  }

  /**
   * 比较动作
   */
  private compareActions(playerAction: string, expectedAction: string): number {
    if (!playerAction || !expectedAction) return 40;

    const playerLower = playerAction.toLowerCase();
    const expectedLower = expectedAction.toLowerCase();

    if (playerLower === expectedLower) {
      return 0; // Exact match
    }

    // Check for substrings (e.g., "I examine the object" contains "examine")
    if (playerLower.includes(expectedLower) || expectedLower.includes(playerLower)) {
      return 5; // Very high similarity
    }

    // Split into words, filtering out common stop words and short particles
    const splitPattern = /[\s,.;:!?，。；：！？]+/;
    const playerWords = playerLower.split(splitPattern).filter(w => w.length > 1);
    const expectedWords = expectedLower.split(splitPattern).filter(w => w.length > 1);

    if (playerWords.length === 0 || expectedWords.length === 0) return 40;

    const commonWords = playerWords.filter(word => expectedWords.includes(word));
    const overlapRatio = commonWords.length / Math.min(playerWords.length, expectedWords.length);

    // Weighted scoring: 0-40 range
    if (overlapRatio > 0.8) return 0;
    if (overlapRatio > 0.5) return 10;
    if (overlapRatio > 0.2) return 20;

    return (1 - overlapRatio) * 40;
  }

  /**
   * 分析情境相关性
   */
  private analyzeContextualRelevance(playerAction: string, plotPoint: PlotPoint): number {
    // 检查动作是否与当前剧情点相关
    const actionWords = playerAction.toLowerCase().split(/\s+/);
    const plotWords = [
      ...plotPoint.description.toLowerCase().split(/\s+/),
      ...plotPoint.expectedOutcomes.join(' ').toLowerCase().split(/\s+/)
    ];

    const relevanceWords = actionWords.filter(word => plotWords.includes(word));
    const relevanceRatio = relevanceWords.length / actionWords.length;

    return (1 - relevanceRatio) * 30; // 最多30分的偏离
  }

  /**
   * 分析历史行为模式
   */
  private analyzeHistoricalPattern(playerAction: string, recentActions: string[]): number {
    if (recentActions.length === 0) return 0;

    // 分析行为一致性
    const actionType = this.categorizeAction(playerAction);
    const recentTypes = recentActions.map(action => this.categorizeAction(action));

    const consistentActions = recentTypes.filter(type => type === actionType).length;
    const consistencyRatio = consistentActions / recentTypes.length;

    // 如果行为模式突然改变，可能表示偏离
    return consistencyRatio < 0.3 ? 20 : 0;
  }

  /**
   * 分析故事连贯性
   */
  private analyzeStoryCohesion(
    playerAction: string,
    context: { completedPlotPoints: string[]; storyVariables: Map<string, any> }
  ): number {
    // 简化的连贯性分析
    // 检查动作是否与已完成的剧情点冲突

    // 这里可以实现更复杂的逻辑，比如：
    // - 检查动作是否违反已建立的角色关系
    // - 检查动作是否与故事世界规则冲突
    // - 检查动作是否忽略重要的故事元素

    return 0; // 暂时返回0，实际实现需要更多上下文信息
  }

  /**
   * 分类动作类型
   */
  private categorizeAction(action: string): string {
    const actionLower = action.toLowerCase();

    if (actionLower.includes('说') || actionLower.includes('talk') || actionLower.includes('speak')) {
      return 'dialogue';
    }
    if (actionLower.includes('走') || actionLower.includes('go') || actionLower.includes('move')) {
      return 'movement';
    }
    if (actionLower.includes('看') || actionLower.includes('examine') || actionLower.includes('look')) {
      return 'observation';
    }
    if (actionLower.includes('拿') || actionLower.includes('take') || actionLower.includes('use')) {
      return 'interaction';
    }

    return 'other';
  }

  /**
   * 分类影响程度
   */
  private categorizeImpact(deviationScore: number): 'minor' | 'moderate' | 'major' | 'critical' {
    if (deviationScore < 25) return 'minor';
    if (deviationScore < 50) return 'moderate';
    if (deviationScore < 75) return 'major';
    return 'critical';
  }

  /**
   * 生成偏离描述
   */
  private generateDeviationDescription(
    playerAction: string,
    expectedAction: string,
    deviationScore: number
  ): string {
    const impact = this.categorizeImpact(deviationScore);
    return `Player performed "${playerAction}" instead of expected "${expectedAction}". Impact: ${impact} (score: ${deviationScore})`;
  }
}

/**
 * 模式转换服务
 * 处理游戏模式之间的切换逻辑
 */
export class ModeTransitionService {
  constructor(private logger: Logger) { }

  /**
   * 准备模式切换
   */
  prepareModeTransition(
    currentMode: GameModeType,
    targetMode: GameModeType,
    currentConfig: ModeConfig
  ): {
    canTransition: boolean;
    requiredSteps: string[];
    warnings: string[];
    estimatedTime: number;
  } {
    this.logger.info('Preparing mode transition', {
      from: currentMode,
      to: targetMode,
      component: 'ModeTransitionService'
    });

    const requiredSteps: string[] = [];
    const warnings: string[] = [];
    let estimatedTime = 0;

    // 保存当前状态
    requiredSteps.push('save_current_state');
    estimatedTime += 2;

    // 模式特定的准备步骤
    if (currentMode === GameModeType.SCRIPT && targetMode === GameModeType.FREE) {
      requiredSteps.push('save_story_progress');
      requiredSteps.push('extract_world_state');
      warnings.push('Story progress will be paused but preserved');
      estimatedTime += 5;
    }

    if (currentMode === GameModeType.FREE && targetMode === GameModeType.SCRIPT) {
      requiredSteps.push('analyze_current_world');
      requiredSteps.push('select_compatible_story');
      requiredSteps.push('initialize_director_system');
      warnings.push('Current world state will be adapted to fit the selected story');
      estimatedTime += 10;
    }

    // 通用步骤
    requiredSteps.push('update_configuration');
    requiredSteps.push('notify_players');
    requiredSteps.push('initialize_new_mode');
    estimatedTime += 3;

    return {
      canTransition: true, // 简化逻辑，实际可能有限制条件
      requiredSteps,
      warnings,
      estimatedTime
    };
  }

  /**
   * 执行模式切换
   */
  async executeModeTransition(
    sessionId: string,
    steps: string[],
    newConfig: ModeConfig
  ): Promise<{
    success: boolean;
    completedSteps: string[];
    failedStep?: string;
    error?: string;
  }> {
    this.logger.info('Executing mode transition', {
      sessionId,
      steps,
      component: 'ModeTransitionService'
    });

    const completedSteps: string[] = [];

    try {
      for (const step of steps) {
        await this.executeTransitionStep(step, sessionId, newConfig);
        completedSteps.push(step);
      }

      return {
        success: true,
        completedSteps
      };
    } catch (error) {
      this.logger.error('Mode transition failed', error as Error, {
        sessionId,
        completedSteps,
        component: 'ModeTransitionService'
      });

      return {
        success: false,
        completedSteps,
        failedStep: steps[completedSteps.length],
        error: (error as Error).message
      };
    }
  }

  /**
   * 执行转换步骤
   */
  private async executeTransitionStep(
    step: string,
    sessionId: string,
    newConfig: ModeConfig
  ): Promise<void> {
    switch (step) {
      case 'save_current_state':
        await this.saveCurrentState(sessionId);
        break;
      case 'save_story_progress':
        await this.saveStoryProgress(sessionId);
        break;
      case 'extract_world_state':
        await this.extractWorldState(sessionId);
        break;
      case 'analyze_current_world':
        await this.analyzeCurrentWorld(sessionId);
        break;
      case 'select_compatible_story':
        await this.selectCompatibleStory(sessionId, newConfig);
        break;
      case 'initialize_director_system':
        await this.initializeDirectorSystem(sessionId, newConfig);
        break;
      case 'update_configuration':
        await this.updateConfiguration(sessionId, newConfig);
        break;
      case 'notify_players':
        await this.notifyPlayers(sessionId, newConfig);
        break;
      case 'initialize_new_mode':
        await this.initializeNewMode(sessionId, newConfig);
        break;
      default:
        throw new Error(`Unknown transition step: ${step}`);
    }
  }

  // 私有方法实现各个转换步骤
  private async saveCurrentState(sessionId: string): Promise<void> {
    // 实现保存当前状态的逻辑
    await new Promise(resolve => setTimeout(resolve, 100)); // 模拟异步操作
  }

  private async saveStoryProgress(sessionId: string): Promise<void> {
    // 实现保存故事进展的逻辑
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async extractWorldState(sessionId: string): Promise<void> {
    // 实现提取世界状态的逻辑
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async analyzeCurrentWorld(sessionId: string): Promise<void> {
    // 实现分析当前世界的逻辑
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async selectCompatibleStory(sessionId: string, config: ModeConfig): Promise<void> {
    // 实现选择兼容故事的逻辑
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async initializeDirectorSystem(sessionId: string, config: ModeConfig): Promise<void> {
    // 实现初始化导演系统的逻辑
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async updateConfiguration(sessionId: string, config: ModeConfig): Promise<void> {
    // 实现更新配置的逻辑
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async notifyPlayers(sessionId: string, config: ModeConfig): Promise<void> {
    // 实现通知玩家的逻辑
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async initializeNewMode(sessionId: string, config: ModeConfig): Promise<void> {
    // 实现初始化新模式的逻辑
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}