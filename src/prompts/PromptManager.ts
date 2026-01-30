import { PromptTemplate } from './types';

/**
 * 提示词管理器
 * 负责统一管理、获取和填充提示词模板
 */
export class PromptManager {
    private static instance: PromptManager;
    private templates: Map<string, PromptTemplate> = new Map();

    private constructor() { }

    /**
     * 获取单例
     */
    public static getInstance(): PromptManager {
        if (!PromptManager.instance) {
            PromptManager.instance = new PromptManager();
        }
        return PromptManager.instance;
    }

    /**
     * 注册提示词模板
     */
    public register<T>(template: PromptTemplate<T>): void {
        if (this.templates.has(template.name)) {
            console.warn(`Prompt template with name "${template.name}" already exists. Overwriting.`);
        }
        this.templates.set(template.name, template);
    }

    /**
     * 获取提示词模板
     */
    public getTemplate<T>(name: string): PromptTemplate<T> | undefined {
        return this.templates.get(name) as PromptTemplate<T> | undefined;
    }

    /**
     * 生成提示词文本
     */
    public generate<T>(name: string, context: T): string {
        const template = this.getTemplate<T>(name);
        if (!template) {
            throw new Error(`Prompt template "${name}" not found.`);
        }

        if (typeof template.template === 'function') {
            return template.template(context);
        }

        return this.fillTemplate(template.template, context);
    }

    /**
     * 填充模板中的变量
     */
    private fillTemplate(template: string, context: any): string {
        let result = template;

        // 递归处理嵌套对象
        const flattenContext = (obj: any, prefix = ''): Record<string, string> => {
            let res: Record<string, string> = {};
            for (const key in obj) {
                const value = obj[key];
                const newKey = prefix ? `${prefix}.${key}` : key;

                if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                    Object.assign(res, flattenContext(value, newKey));
                } else if (Array.isArray(value)) {
                    res[newKey] = value.join(', ');
                } else {
                    res[newKey] = String(value ?? '');
                }
            }
            return res;
        };

        const flatContext = flattenContext(context);

        // 简单的正则表达式替换 {variable}
        return result.replace(/{([^{}]+)}/g, (match, key) => {
            const trimmedKey = key.trim();
            return flatContext[trimmedKey] !== undefined ? flatContext[trimmedKey] : match;
        });
    }

    /**
     * 获取所有模板名称
     */
    public getAllTemplateNames(): string[] {
        return Array.from(this.templates.keys());
    }
}

// 导出单例实例
export const promptManager = PromptManager.getInstance();
