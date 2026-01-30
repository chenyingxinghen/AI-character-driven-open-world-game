import { PromptTemplate } from './types';

/**
 * 导演系统相关提示词
 */
export const DirectorPrompts = {
    /**
     * 生成干预决策
     */
    interventionDecision: {
        name: 'director.intervention_decision',
        description: '决定是否需要介入游戏进程',
        template: (context: {
            sessionId: string;
            playerId: string;
            currentLocation: string;
            recentActions: string[];
            storyState: string;
            characterStates: string;
        }): string => `
你是一个游戏导演AI，负责监控游戏进程并在必要时进行干预以保持故事的连贯性和趣味性。

当前游戏状态：
- 会话ID: ${context.sessionId}
- 玩家ID: ${context.playerId}
- 当前位置: ${context.currentLocation}
- 最近行动: ${context.recentActions.join(', ')}
- 故事状态: ${context.storyState}
- 角色状态: ${context.characterStates}

请评估当前游戏状态，并决定是否需要进行干预。
不要无端新建角色。如果需干预以打破僵局，请优先选择：
1. 'event_generation'：直接向前端叙述突发的有趣事件。
2. 'character_introduction'：仅在新角色会立即主动发起对话时使用。
如果需要，请指定干预类型和内容。

请严格按照以下格式返回：

=== DIRECTOR_DECISION ===
ACTION: INTERVENE|NO_INTERVENTION
REASONING: 干预内容或不干预的理由
CONFIDENCE: 0-1的数字，表示预期效果/置信度
PARAMETERS: interventionType=dialogue_guidance|event_generation|environment_change|information_hint
=== END_DECISION ===
`
    } as PromptTemplate<{
        sessionId: string;
        playerId: string;
        currentLocation: string;
        recentActions: string[];
        storyState: string;
        characterStates: string;
    }>,

    /**
     * 评估故事进展 (结构化输出版)
     */
    evaluateStoryProgression: {
        name: 'director.evaluate_story_progression',
        description: '评估故事是否停滞并决定是否干预',
        template: (context: {
            currentLocation: string;
            recentActions: string;
            recentEventsText: string;
            storyState: string;
            characterStates: string;
            currentTime: string;
        }): string => `As a Game Director AI, evaluate the current story progression and tension.
Current Game State:
Location: ${context.currentLocation}
Recent Player Actions: ${context.recentActions}
Recent Story Events (Interventions):
${context.recentEventsText}
Story State: ${context.storyState}
Character States: ${context.characterStates}
Timestamp: ${context.currentTime}

评估故事是否停滞（停滞程度 0-100）以及是否需要叙事干预。
不要无端新建角色。
如果需要干预以打破僵局：
1. 优先选择：'event_generation' - 直接向玩家叙述一个突发的、重大的事件。
2. 备选方案：'character_introduction' - 仅当该新角色会立即主动接近并与玩家交谈时使用。
对于 'character_introduction'，请提供 'characterParams' 并在 'content' 中包含其开场白。`
    } as PromptTemplate<{
        currentLocation: string;
        recentActions: string;
        recentEventsText: string;
        storyState: string;
        characterStates: string;
        currentTime: string;
    }>
};
