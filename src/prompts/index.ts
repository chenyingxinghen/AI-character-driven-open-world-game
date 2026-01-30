import { PromptTemplate } from './types';
export * from './types';
export * from './PromptManager';
export * from './InputPrompts';
export * from './WorldPrompts';
export * from './CharacterPrompts';
export * from './StoryPrompts';
export * from './DirectorPrompts';
export * from './SystemPrompts';
export * from './ScenePrompts';
export * from './GuidancePrompts';

// 导入所有 prompt 定义并注册
import { promptManager } from './PromptManager';
import { InputPrompts } from './InputPrompts';
import { WorldPrompts } from './WorldPrompts';
import { CharacterPrompts } from './CharacterPrompts';
import { StoryPrompts } from './StoryPrompts';
import { DirectorPrompts } from './DirectorPrompts';
import { SystemPrompts } from './SystemPrompts';
import { ScenePrompts } from './ScenePrompts';
import { GuidancePrompts } from './GuidancePrompts';

/**
 * 自动注册核心提示词模板
 */
export function registerCorePrompts() {
    // 注册输入相关的
    (Object.values(InputPrompts) as PromptTemplate<any>[]).forEach(p => promptManager.register(p));

    // 注册世界相关的
    (Object.values(WorldPrompts) as PromptTemplate<any>[]).forEach(p => promptManager.register(p));

    // 注册角色相关的
    (Object.values(CharacterPrompts) as PromptTemplate<any>[]).forEach(p => promptManager.register(p));

    // 注册剧情相关的
    (Object.values(StoryPrompts) as PromptTemplate<any>[]).forEach(p => promptManager.register(p));

    // 注册导演相关的
    (Object.values(DirectorPrompts) as PromptTemplate<any>[]).forEach(p => promptManager.register(p));

    // 注册系统相关的
    (Object.values(SystemPrompts) as PromptTemplate<any>[]).forEach(p => promptManager.register(p));

    // 注册场景相关的
    (Object.values(ScenePrompts) as PromptTemplate<any>[]).forEach(p => promptManager.register(p));

    // 注册引导相关的
    (Object.values(GuidancePrompts) as PromptTemplate<any>[]).forEach(p => promptManager.register(p));
}

// 立即注册
registerCorePrompts();
