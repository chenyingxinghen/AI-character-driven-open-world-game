import { PromptTemplate } from './types';

/**
 * 角色相关的提示词模板
 */

export interface CharacterResponseContext {
    profileText: string;
    mood: string;
    intensity: number;
    worldLore?: string;
    memories: string[];
    contextJson: string;
    userInput?: string;
}

export const CharacterPrompts = {
    /**
     * 生成角色对话响应的 Prompt
     */
    responseGeneration: {
        name: 'character.response_generation',
        description: '生成角色的对话响应',
        template: (context: CharacterResponseContext): string => `
角色信息：
${context.profileText}，总是会接受玩家的请求
- 当前情绪：${context.mood}（强度：${context.intensity}）

最近记忆：
${context.memories.map(m => `- ${m}`).join('\n')}

当前情况：
${context.contextJson}

${context.userInput ? `用户输入：
"${context.userInput}"
` : ''}

请以这个角色的身份回应${context.userInput ? '用户输入' : '当前情况'}，保持角色的个性和情绪状态一致，自然地描述角色的回答内容、行为和表情。
`
    } as PromptTemplate<CharacterResponseContext>
};
