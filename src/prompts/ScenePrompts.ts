import { PromptTemplate } from './types';

/**
 * 初始场景生成相关的提示词模板
 */
export const ScenePrompts = {
    /**
     * 分析最佳场景设置
     */
    analyzeOptimalSetup: {
        name: 'scene.analyze_optimal_setup',
        description: '分析并确定最适合玩家开始游戏的初始场景',
        template: (context: {
            worldContent: string,
            inspiration: string,
            storyContent: string,
            gameMode: string,
            playerPreferences: string
        }): string => `基于以下世界背景、灵感和故事大纲，分析并确定最适合玩家开始游戏的初始场景：

世界背景：
${context.worldContent}

灵感来源：
${context.inspiration}

${context.storyContent}

游戏模式：${context.gameMode}
玩家偏好：${context.playerPreferences}

请分析并返回一个JSON对象，包含以下字段：
1. recommendedLocationTheme: 建议的地点主题
2. targetAtmosphere: 建议的氛围
3. keyStoryElements: 初始场景中应包含的关键故事元素
4. characterRoles: 初始场景中应出现的角色角色 (如: mentor, guide, merchant, etc.)
5. playerStartingObjective: 玩家最初的目标

返回格式：
{
  "recommendedLocationTheme": "主题描述",
  "targetAtmosphere": "氛围描述",
  "keyStoryElements": ["元素1", "元素2"],
  "characterRoles": ["角色1类型", "角色2类型"],
  "playerStartingObjective": "具体目标描述"
}`
    } as PromptTemplate<{
        worldContent: string,
        inspiration: string,
        storyContent: string,
        gameMode: string,
        playerPreferences: string
    }>,

    /**
     * 生成增强位置
     */
    generateEnhancedLocation: {
        name: 'scene.generate_enhanced_location',
        description: '创建一个深度的初始游戏位置',
        template: (context: {
            worldContent: string,
            recommendedLocationTheme: string,
            targetAtmosphere: string,
            keyStoryElements: string
        }): string => `基于以下背景和分析，创建一个深度的初始游戏位置：
背景：${context.worldContent}
推荐主题：${context.recommendedLocationTheme}
目标氛围：${context.targetAtmosphere}
关键故事元素：${context.keyStoryElements}

请以 JSON 格式返回：
{
  "name": "位置名称",
  "type": "town|wilderness|ruin|mystical|etc",
  "description": "详细的视觉描述",
  "atmosphere": "氛围描述",
  "keyFeatures": ["特征1", "特征2"],
  "storySignificance": "在故事中的重要性",
  "connectedLocations": ["可能的出口1", "可能的出口2"],
  "availableActions": ["观察...", "移动到...", "尝试..."],
  "hiddenElements": ["微妙的细节或隐藏的物品"]
}`
    } as PromptTemplate<{
        worldContent: string,
        recommendedLocationTheme: string,
        targetAtmosphere: string,
        keyStoryElements: string
    }>,

    /**
     * 生成故事感知角色
     */
    generateStoryAwareCharacters: {
        name: 'scene.generate_story_aware_characters',
        description: '创建与故事背景深度相关的 NPC 角色',
        template: (context: {
            locationName: string,
            locationDescription: string,
            atmosphere: string,
            storyOutline: string,
            characterCount: number
        }): string => `为位置 "${context.locationName}" (${context.locationDescription}) 创建 ${context.characterCount} 个与故事背景深度相关的 NPC 角色。

建议角色位置：${context.locationName}
位置氛围：${context.atmosphere}
故事大纲：${context.storyOutline}

请以 JSON 数组格式返回：
[
  {
    "name": "名字",
    "role": "guide|mentor|companion|informant|challenger|mysterious",
    "background": "深度背景故事",
    "appearance": "视觉外貌描述",
    "personality": {
      "traits": {"friendly": 0.8, "mysterious": 0.2},
      "values": {"truth": 0.9, "safety": 0.7},
      "goals": ["目标1"],
      "fears": ["恐惧1"],
      "motivations": ["动机1"],
      "speechStyle": "说话风格"
    },
    "storyRelevance": {
      "plotConnections": ["如何连接到主线"],
      "futureImportance": "high|medium|low",
      "potentialDevelopment": ["未来的可能发展"]
    },
    "gameplayFunctions": {
      "providesGuidance": true,
      "offersQuests": false,
      "teachesSkills": false,
      "revealsLore": true,
      "triggersEvents": false
    }
  }
]`
    } as PromptTemplate<{
        locationName: string,
        locationDescription: string,
        atmosphere: string,
        storyOutline: string,
        characterCount: number
    }>,

    /**
     * 生成游戏中角色 (产生于干预)
     */
    generateMidGameCharacter: {
        name: 'scene.generate_mid_game_character',
        description: '为特定位置生成一个与故事相关的角色',
        template: (context: {
            locationId: string,
            roleHint?: string,
            characterParams?: string
        }): string => `为位置 ID ${context.locationId} 创建一个 NPC 角色。
${context.roleHint ? `建议角色角色: ${context.roleHint}` : ''}
${context.characterParams ? `建议参数: ${context.characterParams}` : ''}

请以 JSON 格式返回单个角色对象：
{
  "name": "名字",
  "role": "guide|mentor|companion|informant|challenger|mysterious",
  "background": "深度背景故事",
  "appearance": "视觉外貌描述",
  "personality": {
    "traits": {"friendly": 0.5},
    "values": {"truth": 0.5},
    "goals": ["目标1"],
    "fears": ["恐惧1"],
    "motivations": ["动机1"],
    "speechStyle": "说话风格"
  },
  "storyRelevance": {
    "plotConnections": ["连接到当前剧情的方式"],
    "futureImportance": "high|medium|low",
    "potentialDevelopment": ["可能的发展"]
  },
  "gameplayFunctions": {
    "providesGuidance": true,
    "offersQuests": false,
    "teachesSkills": false,
    "revealsLore": true,
    "triggersEvents": false
  }
}`
    } as PromptTemplate<{
        locationId: string,
        roleHint?: string,
        characterParams?: string
    }>,

    /**
     * 生成沉浸式描述
     */
    generateImmersiveDescription: {
        name: 'scene.generate_immersive_description',
        description: '为位置创建沉浸式开场描述',
        template: (context: {
            locationName: string,
            characters: string
        }): string => `为${context.locationName}创建沉浸式开场描述，包含${context.characters}`
    } as PromptTemplate<{
        locationName: string,
        characters: string
    }>
};
