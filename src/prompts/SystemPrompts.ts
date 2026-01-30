import { PromptTemplate } from './types';

/**
 * 格式化文本响应模板集 (用于非 JSON 模式)
 */
export const FormattedResponseTemplates = {
    INPUT_CLASSIFICATION: `
=== INPUT_CLASSIFICATION ===
TYPE: {type}
INTENT: {intent}
CONFIDENCE: {confidence}
TARGET_CHARACTER: {targetCharacter}
TARGET_LOCATION: {targetLocation}
IS_DIRECT_SPEECH: {isDirectSpeech}
IS_ACTION_DESCRIPTION: {isActionDescription}
IS_SYSTEM_QUERY: {isSystemQuery}
IS_COMPOUND_ACTION: {isCompoundAction}
EXTRACTED_ACTION: {extractedAction}
EXTRACTED_SPEECH: {extractedSpeech}
URGENCY: {urgency}
EMOTIONAL_TONE: {emotionalTone}
CONTEXTUAL_HINTS: {contextualHints}
=== END_CLASSIFICATION ===
`.trim(),

    CHARACTER_DIALOGUE: `
=== CHARACTER_DIALOGUE ===
DIALOGUE: {dialogue}
ACTION: {action}
EMOTIONAL_STATE_MOOD: {emotionalStateMood}
EMOTIONAL_STATE_INTENSITY: {emotionalStateIntensity}
CONFIDENCE: {confidence}
=== END_DIALOGUE ===
`.trim(),

    DIRECTOR_DECISION: `
=== DIRECTOR_DECISION ===
ACTION: {action}
REASONING: {reasoning}
CONFIDENCE: {confidence}
PARAMETERS: {parameters}
=== END_DECISION ===
`.trim(),

    COMPOUND_ACTION: `
=== COMPOUND_ACTION_ANALYSIS ===
IS_COMPOUND: {isCompound}
ACTION_SEQUENCE: {actionSequence}
SUB_ACTIONS: {subActions}
=== END_COMPOUND_ACTION ===
`.trim()
};

/**
 * 系统级别或通用的格式化文本提示词
 */
export const SystemPrompts = {
    /**
     * 输入分类 (格式化文本版)
     */
    inputClassification: {
        name: 'system.input_classification',
        description: '分析玩家输入并分类意图',
        template: (context: {
            input: string;
            sessionId: string;
            currentLocation: string;
            nearbyCharacters: string[];
            recentConversation: string[];
            inputTypes: string;
            intentTypes: string;
            urgencyLevels: string;
            emotionalTones: string;
        }): string => `
你是一个游戏输入分类系统。请分析以下玩家输入并提供详细的分类结果。

玩家输入: "${context.input}"

上下文信息:
- 会话ID: ${context.sessionId}
- 当前位置: ${context.currentLocation}
- 附近角色: ${context.nearbyCharacters.join(', ')}
- 最近对话: ${context.recentConversation.join(' | ')}

请严格按照以下格式返回分类结果：
${FormattedResponseTemplates.INPUT_CLASSIFICATION}

注意：请严格按照上述格式输出，不要添加额外的解释或说明。

字段说明：
- TYPE: 输入类型，可选: ${context.inputTypes}
- INTENT: 意图类型，可选: ${context.intentTypes}
- CONFIDENCE: 置信度，数值范围 0-100
- URGENCY: 紧急程度，可选: ${context.urgencyLevels}
- EMOTIONAL_TONE: 情绪基调，可选: ${context.emotionalTones}
- TARGET_CHARACTER: 目标角色，如无则填 'none', 注意联系上下文推断指代。意图类型为dialogue时，必须有指代对象。绝对不要填入代词（如：她、他、它、他们、她们、它们、her, him, it, they）。
- TARGET_LOCATION: 目标位置，如无则填 'none', 注意联系上下文推断指代。
- IS_DIRECT_SPEECH: 是否为直接对话 (true/false)
- IS_ACTION_DESCRIPTION: 是否为动作描述 (true/false)
- IS_SYSTEM_QUERY: 是否为系统查询 (true/false)
- IS_COMPOUND_ACTION: 是否为复合动作 (true/false)
- EXTRACTED_ACTION: 提取的动作摘要
- EXTRACTED_SPEECH: 提取的对话内容
- CONTEXTUAL_HINTS: 上下文提示词列表，用方括号包裹，如 [hint1, hint2]
- CRITICAL: TARGET_CHARACTER 必须是具体的角色名字，严禁使用代词。如果无法确定具体姓名，请填入 'none'。
`
    } as PromptTemplate<any>,

    /**
     * 角色对话 (格式化文本版)
     */
    characterDialogue: {
        name: 'system.character_dialogue',
        description: '生成角色对话响应',
        template: (context: {
            characterName: string;
            personality: string;
            emotionalState: string;
            context: string;
            userInput: string;
            moods: string;
        }): string => `
你是游戏角色 ${context.characterName}，拥有以下特性：
- 个性特征: ${context.personality}
- 当前情绪状态: ${context.emotionalState}
- 游戏上下文: ${context.context}

玩家说: "${context.userInput}"

请以该角色的身份回应，严格按照以下格式输出：

${FormattedResponseTemplates.CHARACTER_DIALOGUE}

字段说明：
- DIALOGUE: 角色的对话内容，为字符串
- ACTION: 可选的动作描述，如无动作请填写 'none'
- EMOTIONAL_STATE_MOOD: 情绪状态，常见值: ${context.moods}
- EMOTIONAL_STATE_INTENSITY: 情绪强度，数值范围 0-100
- CONFIDENCE: 置信度，数值范围 0.0-1.0

注意：请严格按照上述格式输出，不要添加额外的解释或说明。
`
    } as PromptTemplate<any>,

    /**
     * 导演决策 (格式化文本版)
     */
    directorDecision: {
        name: 'system.director_decision',
        description: '生成导演决策',
        template: (context: {
            context: string;
            evaluation: string;
            actions: string;
        }): string => `
你是游戏导演，负责做出叙事决策。

当前上下文: ${context.context}
评估结果: ${context.evaluation}

请分析当前情况并做出决策，严格按照以下格式输出：

${FormattedResponseTemplates.DIRECTOR_DECISION}

字段说明：
- ACTION: 导演动作类型，常见值: ${context.actions}
- REASONING: 决策的原因 and 说明，为字符串
- CONFIDENCE: 置信度，数值范围 0.0-1.0 或 0-100
- PARAMETERS: JSON格式的参数对象，如: {"tensionLevel": 70, "priority": 5}

注意：请严格按照上述格式输出，不要添加额外的解释或说明。
`
    } as PromptTemplate<any>,

    /**
     * 位置创建
     */
    locationCreation: {
        name: 'system.location_creation',
        description: '动态创建不存在的位置描述',
        template: (context: {
            locationName: string;
            currentLocation: string;
            gameStyle: string;
        }): string => `
你是一个游戏世界设计师。玩家想要前往"${context.locationName}"，但这个位置在游戏世界中不存在。请为这个位置创建一个合理的描述。

上下文：
- 当前位置: ${context.currentLocation}
- 游戏风格: ${context.gameStyle}

请返回一个简洁但生动的位置描述（不超过50个字）：
`
    } as PromptTemplate<{
        locationName: string;
        currentLocation: string;
        gameStyle: string;
    }>,

    /**
     * 强制 JSON Schema 响应
     */
    schemaEnforcement: {
        name: 'system.schema_enforcement',
        description: '在提示词末尾添加 Schema 约束',
        template: (context: { prompt: string, schema: string }): string =>
            `${context.prompt}\n\nPlease respond in JSON format according to this schema: ${context.schema}`
    } as PromptTemplate<{ prompt: string, schema: string }>,

    /**
     * 默认角色对话 (用于 Provider 兜底)
     */
    defaultCharacterResponse: {
        name: 'system.default_character_response',
        description: 'Provider 默认的角色对话提示词',
        template: (context: { name: string, personality: string, emotionalState: string, context: string, prompt: string }): string => `
      You are ${context.name}, a character with the following personality: ${context.personality}.
      Current emotional state: ${context.emotionalState}.
      Context: ${context.context}
      Player says: ${context.prompt}
      
      Respond as the character in a JSON format:
      {
        "dialogue": "your response here",
        "emotionalState": { "mood": "current mood", "intensity": 0-100 },
        "confidence": 0-1
      }
    `
    } as PromptTemplate<{ name: string, personality: string, emotionalState: string, context: string, prompt: string }>,

    /**
     * 默认导演决策 (用于 Provider 兜底)
     */
    defaultDirectorDecision: {
        name: 'system.default_director_decision',
        description: 'Provider 默认的导演决策提示词',
        template: (context: { context: string, evaluation: string }): string => `
      You are the game director making narrative decisions.
      Context: ${context.context}
      Evaluation: ${context.evaluation}
      
      Respond with a JSON object:
      {
        "action": "CONTINUE|ADVANCE_PLOT|INTRODUCE_CONFLICT|etc",
        "reasoning": "explanation of the decision",
        "confidence": 0-1,
        "parameters": { "key": "value" }
      }
    `
    } as PromptTemplate<{ context: string, evaluation: string }>,

    /**
     * 对话引导系统提示词
     */
    dialogueGuidanceSystem: {
        name: 'system.dialogue_guidance_system',
        description: '对话引导服务的系统提示词',
        template: (): string => `You are an AI game guide. Respond with a JSON object describing the character's dialogue and guidance.`
    } as PromptTemplate<any>,

    /**
     * Ollama 角色对话提示词 (非 JSON 版)
     */
    ollamaCharacterResponse: {
        name: 'system.ollama_character_response',
        description: 'Ollama 专用的角色对话提示词 (非 JSON)',
        template: (context: { name: string, personality: string, emotionalState: string, context: string, prompt: string }): string => `
You are ${context.name}, a character with the following personality: ${context.personality}.
Current emotional state: ${context.emotionalState}.
Context: ${context.context}
Player says: ${context.prompt}

Please respond as the character. Format your response as follows:
DIALOGUE: [Your response as the character]
EMOTION_MOOD: [current mood]
EMOTION_INTENSITY: [0-100]
CONFIDENCE: [0.0-1.0]
`
    } as PromptTemplate<{ name: string, personality: string, emotionalState: string, context: string, prompt: string }>,

    /**
     * Ollama 导演决策提示词 (非 JSON 版)
     */
    ollamaDirectorDecision: {
        name: 'system.ollama_director_decision',
        description: 'Ollama 专用的导演决策提示词 (非 JSON)',
        template: (context: { context: string, evaluation: string }): string => `
You are the game director making narrative decisions.
Context: ${context.context}
Evaluation: ${context.evaluation}

Analyze the situation and decide on the next narrative action. Format your response as follows:
ACTION: [CONTINUE|ADVANCE_PLOT|INTRODUCE_CONFLICT|etc]
REASONING: [explanation of the decision]
CONFIDENCE: [0.0-1.0]
PARAMETERS: [key1=value1,key2=value2]
`
    } as PromptTemplate<{ context: string, evaluation: string }>
};
