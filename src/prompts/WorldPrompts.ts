import { PromptTemplate } from './types';

/**
 * 世界观生成相关的提示词模板
 */

export interface LoreGenerationContext {
    worldName?: string;
    worldDescription?: string;
    inspiration?: string;
    complexity?: string;
    setting?: string;
    locale?: string;
}

export const WorldPrompts = {
    /**
     * 生成完整世界背景的批量请求 Prompt
     */
    batchGeneration: {
        name: 'world.batch_generation',
        description: '生成完整世界背景背景',
        template: (context: LoreGenerationContext): string => `你是一个世界构建大师。请为一个${context.setting || '奇幻'}风格的开放世界游戏创建完整的世界观背景。
${context.worldName ? `世界名称：${context.worldName}` : ''}
${context.worldDescription ? `世界描述：${context.worldDescription}` : ''}
${context.inspiration ? `用户灵感：${context.inspiration}` : ''}
${context.complexity ? `复杂程度：${context.complexity}` : ''}

请以 JSON 格式返回以下 5 个维度的内容（每个维度 100 字），且语言为${context.locale === 'en' ? '英文' : '中文'}：
1. main_story: 世界总体设定、核心冲突和玩家定位。
2. history: 重要的历史时期、关键历史转折点。
3. legend: 神话传说、古老英雄或神秘预言。
4. culture: 社会结构、主要种族习俗或宗教信仰。
5. geography: 地理地貌、标志性地标或奇观。

返回格式要求：
{
  "main_story": { "title": "...", "content": "..." },
  "history": { "title": "...", "content": "..." },
  "legend": { "title": "...", "content": "..." },
  "culture": { "title": "...", "content": "..." },
  "geography": { "title": "...", "content": "..." }
}
请直接返回 JSON，不要有任何多余文字。`
    } as PromptTemplate<LoreGenerationContext>,

    /**
     * 生成特定类型 Lore 的 Prompt
     */
    specificLoreGeneration: {
        name: 'world.specific_lore_generation',
        description: '生成特定类型的背景故事',
        template: (context: {
            context: LoreGenerationContext;
            loreTypeDescription: string;
            specificInstructions: string;
        }): string => `你是一个富有创造力的世界构建师。为一个${context.context.setting || '奇幻'}风格的开放世界游戏创建${context.loreTypeDescription}。

${context.context.inspiration ? `用户灵感：${context.context.inspiration}` : ''}

请创建一个引人入胜、细节丰富的${context.loreTypeDescription}，要求：
1. 内容要有独特性和创新性
2. 适合${context.context.complexity || 'moderate'}复杂程度
3. 风格为${context.context.setting || '奇幻'}
4. 语言为${context.context.locale === 'en' ? '英文' : '中文'}
5. 内容长度适中（300-600字）

${context.specificInstructions}

请直接返回内容，不要包含任何格式标记或说明文字。`
    } as PromptTemplate<{
        context: LoreGenerationContext;
        loreTypeDescription: string;
        specificInstructions: string;
    }>
};
