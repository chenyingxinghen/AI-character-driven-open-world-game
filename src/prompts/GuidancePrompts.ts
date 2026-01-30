import { PromptTemplate } from './types';

/**
 * 对话引导相关的提示词模板
 */
export const GuidancePrompts = {
    /**
     * 生成引导性对话
     */
    generateDialogue: {
        name: 'guidance.generate_dialogue',
        description: '生成引导性对话',
        template: (context: {
            guidanceType: string,
            speakerType: string,
            speakerName: string,
            intensity: string,
            currentLocation: string,
            playerAction: string,
            targetOutcome: string,
            storyGenre: string,
            guidanceDescription: string
        }): string => `
生成引导性对话：

对话设定:
- 引导类型: ${context.guidanceType}
- 说话者类型: ${context.speakerType}
- 说话者: ${context.speakerName}
- 干预强度: ${context.intensity}

情境信息:
- 当前位置: ${context.currentLocation}
- 玩家行动: ${context.playerAction}
- 目标结果: ${context.targetOutcome}
- 故事风格: ${context.storyGenre}

生成要求:
1. 对话应该${context.guidanceDescription}
2. 符合${context.speakerName}的身份和角色设定
3. 自然地引导玩家朝向目标结果
4. 保持${context.storyGenre}的故事风格
5. 提供合适的玩家回应选项

请生成符合要求的对话内容。
`
    } as PromptTemplate<{
        guidanceType: string,
        speakerType: string,
        speakerName: string,
        intensity: string,
        currentLocation: string,
        playerAction: string,
        targetOutcome: string,
        storyGenre: string,
        guidanceDescription: string
    }>,

    /**
     * 个性化调整对话
     */
    personalizeDialogue: {
        name: 'guidance.personalize_dialogue',
        description: '根据角色个性调整对话',
        template: (context: {
            characterId: string,
            personality: string,
            message: string,
            currentLocation: string,
            targetOutcome: string
        }): string => `
根据角色个性调整对话：

角色: ${context.characterId}
个性特征: ${context.personality}
原始对话: ${context.message}
当前情境: ${context.currentLocation}
目标引导: ${context.targetOutcome}

请调整对话以符合角色个性，同时保持引导效果。
`
    } as PromptTemplate<{
        characterId: string,
        personality: string,
        message: string,
        currentLocation: string,
        targetOutcome: string
    }>
};
