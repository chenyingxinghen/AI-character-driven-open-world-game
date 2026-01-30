import { PromptTemplate } from './types';

/**
 * 剧情相关提示词
 */
export const StoryPrompts = {
  /**
   * 分析世界背景
   */
  analyzeWorldLore: {
    name: 'story.analyze_world_lore',
    description: '分析世界背景故事，提取关键要素用于剧情大纲生成',
    template: (context: { combinedLore: string }): string => `分析以下世界背景故事，提取关键要素用于剧情大纲生成。
请以 JSON 格式返回分析结果：

${context.combinedLore}

返回 JSON 格式要求：
{
  "keyElements": ["元素1", "元素2", "元素3"],
  "themes": ["主题1", "主题2", "主题3"],
  "conflicts": ["冲突1", "冲突2", "冲突3"],
  "characters": ["角色/势力1", "角色/势力2", "角色/势力3"],
  "locations": ["地点1", "地点2", "地点3"],
  "tone": "整体基调描述"
}
请直接返回 JSON，要求简洁准确。`
  } as PromptTemplate<{ combinedLore: string }>,

  /**
   * 生成故事框架
   */
  generateStoryFramework: {
    name: 'story.generate_framework',
    description: '创建故事框架',
    template: (context: {
      gameMode: string;
      preferredGenre: string;
      targetDuration: number;
      keyElements: string[];
      tone: string;
    }): string => `基于世界分析结果，创建一个适合${context.gameMode === 'script' ? '剧本模式' : '引导自由模式'}的故事框架。
玩家偏好：${context.preferredGenre}，目标时长：${context.targetDuration}分钟。

世界关键信息：
- 元素：${context.keyElements.join(', ')}
- 基调：${context.tone}

请以 JSON 格式返回故事框架：
{
  "mainConflict": "核心对立和张力描述",
  "turningPoints": ["转折点1", "转折点2"],
  "characterArcs": ["角色弧线1", "角色弧线2"],
  "acts": [
    {
      "title": "章节标题",
      "summary": "章节概要",
      "keyEvents": ["事件1", "事件2"],
      "expectedOutcomes": ["结果1", "结果2"]
    }
  ]
}
要求简洁、逻辑连贯。直接返回 JSON。`
  } as PromptTemplate<{
    gameMode: string;
    preferredGenre: string;
    targetDuration: number;
    keyElements: string[];
    tone: string;
  }>,

  /**
   * 批量生成剧情点
   */
  generatePlotPoints: {
    name: 'story.generate_plot_points',
    description: '批量为章节生成剧情点',
    systemPrompt: `You are a master screenwriter. Your task is to generate detailed plot points for a structured narrative.
You MUST respond with a valid JSON object matching this structure:
{
  "allPlotPoints": [
    {
      "actNumber": 1,
      "points": [
        {
          "title": "Plot Point Title",
          "description": "Detailed description",
          "type": "introduction|conflict|climax|resolution|transition",
          "expectedPlayerActions": ["action 1", "action 2"],
          "possibleOutcomes": ["outcome 1", "outcome 2"],
          "directorNotes": "Guidance for the director"
        }
      ]
    }
  ]
}`,
    template: (context: { actsInfo: string }): string => `Based on the following acts, generate 4-6 detailed plot points for EACH act:
${context.actsInfo}

Ensure narrative flow, creativity, and logic. Directly return the JSON.`
  } as PromptTemplate<{ actsInfo: string }>,

  /**
   * 为单个章节生成剧情点
   */
  generateActPlotPoints: {
    name: 'story.generate_act_plot_points',
    description: '为单个章节生成剧情点',
    template: (context: { title: string, summary: string, keyEvents: string[] }): string => `为章节 "${context.title}" 生成 4-6 个详细剧情点。
章节任务：${context.summary}
关键点：${context.keyEvents.join(', ')}

请以 JSON 格式返回列表：
{
  "plotPoints": [
    {
      "title": "剧情点标题",
      "description": "详细描述",
      "type": "introduction|conflict|climax|resolution|transition",
      "expectedPlayerActions": ["行动1", "行动2"],
      "possibleOutcomes": ["结果1", "结果2"],
      "directorNotes": "给导演的引导建议"
    }
  ]
}
直接返回 JSON。`
  } as PromptTemplate<{ title: string, summary: string, keyEvents: string[] }>,

  /**
   * 生成导演指导
   */
  generateDirectorGuidance: {
    name: 'story.generate_director_guidance',
    description: '批量生成导演指导',
    systemPrompt: `You are a specialized game director assistant. Provide detailed guidance for plot points.
Response MUST be a JSON object:
{
  "guidanceList": [
    {
      "plotPointId": "id from input",
      "guidance": "Core principle",
      "interventionTriggers": ["trigger 1", "trigger 2"],
      "suggestedApproaches": ["approach 1", "approach 2"],
      "backupPlans": ["backup 1", "backup 2"]
    }
  ]
}`,
    template: (context: { worldAnalysis: string, pointsInfo: string }): string => `Provide director guidance for the following plot points in the context of the world analysis:
WORLD ANALYSIS: ${context.worldAnalysis}

PLOT POINTS:
${context.pointsInfo}

Return detailed guidance for EACH point. JSON only.`
  } as PromptTemplate<{ worldAnalysis: string, pointsInfo: string }>,

  /**
   * 评估剧情大纲
   */
  validateStoryOutline: {
    name: 'story.validate_outline',
    description: '评估剧情大纲',
    template: (context: { title: string, genre: string, actsCount: number, pointsCount: number }): string => `对剧情大纲进行评估：
- 标题：${context.title} - ${context.genre}
- 结构：${context.actsCount}章节, ${context.pointsCount}剧情点

请以 JSON 格式返回验证结果：
{
  "coherenceScore": 80,
  "worldConsistency": 85,
  "playerEngagement": 75,
  "adaptabilityScore": 70,
  "issues": ["例：章节逻辑断层"],
  "recommendations": ["例：补充过渡剧情"]
}
直接返回 JSON。`
  } as PromptTemplate<{ title: string, genre: string, actsCount: number, pointsCount: number }>,

  /**
   * 为单个剧情点生成指导 (兜底)
   */
  generatePlotPointGuidanceIndividual: {
    name: 'story.generate_plot_point_guidance_individual',
    description: '为单个剧情点生成导演指导 JSON',
    template: (context: { title: string }): string => `为剧情点 "${context.title}" 提供导演指导 JSON。`
  } as PromptTemplate<{ title: string }>,

  /**
   * 分析故事节奏
   */
  analyzeStoryPacing: {
    name: 'story.analyze_pacing',
    description: '分析故事的叙事节奏',
    schema: {
      type: 'object',
      properties: {
        currentPacing: {
          type: 'string',
          enum: ['slow', 'normal', 'fast', 'rushed']
        },
        recommendedAdjustments: {
          type: 'array',
          items: { type: 'string' }
        },
        estimatedTimeToCompletion: { type: 'number' },
        bottlenecks: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['currentPacing', 'estimatedTimeToCompletion']
    },
    template: (context: {
      title: string;
      currentAct: number;
      totalActs: number;
      completion: number;
      timeSpent: number;
      estimatedDuration: number;
      recentActions: string[];
    }): string => `
分析故事节奏：

故事信息:
- 标题: ${context.title}
- 当前章节: ${context.currentAct}/${context.totalActs}
- 完成度: ${context.completion.toFixed(1)}%
- 已用时间: ${context.timeSpent}分钟
- 预计总时长: ${context.estimatedDuration}分钟

最近行动:
${context.recentActions.map((action, i) => `${i + 1}. ${action}`).join('\n')}

请分析当前故事节奏，包括：
1. 节奏评估（慢/正常/快/急促）
2. 节奏调整建议
3. 预计剩余时间
4. 可能的瓶颈问题
`
  } as PromptTemplate<any>,

  /**
   * 检测剧情点完成状态
   */
  detectPlotPointCompletion: {
    name: 'story.detect_completion',
    description: '检测特定剧情点是否已完成',
    schema: {
      type: 'object',
      properties: {
        completionSignals: {
          type: 'array',
          items: { type: 'string' }
        },
        completionConfidence: { type: 'number' },
        missingElements: {
          type: 'array',
          items: { type: 'string' }
        },
        nextSteps: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['completionConfidence']
    },
    template: (context: {
      plotPointTitle: string;
      plotPointDescription: string;
      expectedOutcomes: string[];
      playerActions: string[];
      gameState: string;
    }): string => `
检测剧情点完成状态：

剧情点信息:
- 标题: ${context.plotPointTitle}
- 描述: ${context.plotPointDescription}
- 预期结果: ${context.expectedOutcomes.join(', ')}

玩家行动:
${context.playerActions.map((action, i) => `${i + 1}. ${action}`).join('\n')}

游戏状态:
${context.gameState}

请分析：
1. 剧情点是否已完成
2. 完成的信号和证据
3. 缺失的关键元素
4. 下一步建议
`
  } as PromptTemplate<any>,

  /**
   * 评估故事质量
   */
  assessStoryQuality: {
    name: 'story.assess_quality',
    description: '多维度评估故事叙事质量',
    schema: {
      type: 'object',
      properties: {
        narrativeCoherence: { type: 'number' },
        characterDevelopment: { type: 'number' },
        plotProgression: { type: 'number' },
        playerEngagement: { type: 'number' },
        improvement_suggestions: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['narrativeCoherence', 'characterDevelopment', 'plotProgression', 'playerEngagement']
    },
    template: (context: {
      completion: number;
      currentAct: number;
      completedPlotPointsCount: number;
      playerFeedback: string[];
      deviationHistoryCount: number;
      interventionHistoryCount: number;
    }): string => `
评估故事质量：

故事进展:
- 完成度: ${context.completion.toFixed(1)}%
- 当前章节: ${context.currentAct}
- 已完成剧情点: ${context.completedPlotPointsCount}

玩家反馈:
${context.playerFeedback.map(fb => `- ${fb}`).join('\n')}

偏离记录: ${context.deviationHistoryCount}次
干预记录: ${context.interventionHistoryCount}次

请评估故事质量的各个方面（0-100分）：
1. 叙事连贯性
2. 角色发展
3. 情节推进
4. 玩家参与度
5. 整体质量

并提供具体的改进建议。
`
  } as PromptTemplate<any>,

  /**
   * 生成故事总结
   */
  generateStorySummary: {
    name: 'story.generate_summary',
    description: '生成当前故事的摘要总结',
    template: (context: { title: string; completion: number; keyEvents: string[] }): string => `
生成故事总结：

故事: ${context.title}
当前进度: ${context.completion.toFixed(1)}%

关键事件:
${context.keyEvents.map(event => `- ${event}`).join('\n')}

请生成一个简洁的故事总结，概括主要情节发展和角色经历。
`
  } as PromptTemplate<any>,

  /**
   * 预测故事结局
   */
  predictStoryEnding: {
    name: 'story.predict_ending',
    description: '预测潜在的故事结局',
    schema: {
      type: 'object',
      properties: {
        possibleEndings: {
          type: 'array',
          items: { type: 'string' }
        },
        mostLikely: { type: 'string' },
        confidence: { type: 'number' }
      },
      required: ['possibleEndings', 'mostLikely']
    },
    template: (context: {
      title: string;
      genre: string;
      completion: number;
      playerChoices: string[];
    }): string => `
预测故事结局：

故事信息:
- 标题: ${context.title}
- 类型: ${context.genre}
- 进度: ${context.completion.toFixed(1)}%

玩家关键选择:
${context.playerChoices.map(choice => `- ${choice}`).join('\n')}

请预测可能的故事结局，包括：
1. 3-5个可能的结局
2. 最可能的结局
3. 预测置信度
`
  } as PromptTemplate<any>
};
