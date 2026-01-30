/**
 * JSON 提取与解析工具类
 * 专门用于处理 LLM 返回的带有 Markdown 标记或多余文字的字符串
 */
export class JsonUtils {
    /**
     * 从混杂文本中提取第一个有效的 JSON 对象或数组
     */
    static extractJson<T>(text: string): T {
        if (!text) {
            throw new Error('Empty text provided for JSON extraction');
        }

        // 1. 尝试直接解析（理想情况）
        try {
            return JSON.parse(text) as T;
        } catch (e) {
            // 继续尝试提取逻辑
        }

        // 2. 查找所有 JSON 代码块标记 ```json ... ```
        const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
        let match;
        const candidates: string[] = [];

        while ((match = codeBlockRegex.exec(text)) !== null) {
            if (match[1]) {
                candidates.push(match[1]);
            }
        }

        // 3. 平衡括号搜索（补充，如果代码块没找到或者提取不全）
        let stack = 0;
        let start = -1;
        let firstChar = '';

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === '{' || char === '[') {
                if (stack === 0) {
                    start = i;
                    firstChar = char;
                }
                if (char === (firstChar === '{' ? '{' : '[')) {
                    stack++;
                }
            } else if (char === '}' || char === ']') {
                if (char === (firstChar === '{' ? '}' : ']')) {
                    stack--;
                    if (stack === 0 && start !== -1) {
                        candidates.push(text.substring(start, i + 1));
                    }
                }
            }
        }

        // 尝试解析找到的所有候选者（逆序尝试，因为 LLM 通常在最后给出答案）
        for (let i = candidates.length - 1; i >= 0; i--) {
            const candidate = candidates[i];
            try {
                // 移除控制字符并解析
                const cleaned = candidate.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
                const parsed = JSON.parse(cleaned) as T;

                // 增强启发式：如果解析结果看起来非常像一个 JSON Schema 而不是数据
                const looksLikeSchema = i > 0 &&
                    typeof parsed === 'object' &&
                    parsed !== null &&
                    ((parsed as any).type === 'object' || (parsed as any).type === 'string') &&
                    ((parsed as any).properties !== undefined || (parsed as any).enum !== undefined || (parsed as any).minimum !== undefined);

                if (looksLikeSchema) {
                    console.log('Skipping schema-like JSON candidate, looking for data-like one...');
                    continue;
                }

                return parsed;
            } catch (e) {
                // 继续尝试下一个候选者
            }
        }

        // 如果平衡括号没找到，尝试最后的回退：第一个 { 和最后一个 }
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            try {
                const candidate = text.substring(firstBrace, lastBrace + 1);
                const cleaned = candidate.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
                return JSON.parse(cleaned) as T;
            } catch (e) {
                // 失败
            }
        }

        throw new Error('No valid JSON structure found in the provided text');
    }

    /**
     * 安全解析 JSON，解析失败时返回默认值
     */
    static safeExtractJson<T>(text: string, defaultValue: T): T {
        try {
            return this.extractJson<T>(text);
        } catch (e: any) {
            console.warn('JSON extraction failed, using default value:', e.message);
            return defaultValue;
        }
    }
}
