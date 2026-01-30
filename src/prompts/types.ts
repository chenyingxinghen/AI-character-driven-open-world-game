/**
 * 提示词相关类型定义
 */

/**
 * 提示词模板定义
 */
export interface PromptTemplate<T = any> {
    /** 模板名称 */
    readonly name: string;
    /** 模板描述 */
    readonly description?: string;
    /** 版本号 */
    readonly version?: string;
    /** 核心模板文本，包含 {variable} 占位符 */
    readonly template: string | ((context: T) => string);
    /** 预期的响应格式 (可选) */
    readonly responseFormat?: 'text' | 'json' | 'formatted_text';
    /** 系统提示词 (可选) */
    readonly systemPrompt?: string;
    /** JSON Schema 约束 (可选) */
    readonly schema?: any;
}

/**
 * 提示词分类
 */
export enum PromptCategory {
    INPUT = 'input',
    WORLD = 'world',
    CHARACTER = 'character',
    STORY = 'story',
    DIRECTOR = 'director',
    SYSTEM = 'system'
}

/**
 * 提示词元数据
 */
export interface PromptMetadata {
    category: PromptCategory;
    tags?: string[];
}
