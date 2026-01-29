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

        // 2. 查找 JSON 代码块标记 ```json ... ```
        const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
            try {
                return JSON.parse(codeBlockMatch[1]) as T;
            } catch (e) {
                // 如果代码块内仍然解析失败，尝试进一步提取
            }
        }

        // 3. 平衡括号搜索（最鲁棒的方法）
        const candidates: string[] = [];
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

        // 尝试解析找到的所有候选者
        for (const candidate of candidates) {
            try {
                // 移除控制字符并解析
                const cleaned = candidate.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
                return JSON.parse(cleaned) as T;
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
