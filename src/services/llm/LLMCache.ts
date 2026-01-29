
import { createHash } from 'crypto';

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

export class LLMCache {
    private cache: Map<string, CacheEntry<any>> = new Map();
    private defaultTTL: number;

    constructor(defaultTTLSeconds: number = 3600) { // Default 1 hour
        this.defaultTTL = defaultTTLSeconds * 1000;
    }

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return entry.data as T;
    }

    set<T>(key: string, data: T, ttlSeconds?: number): void {
        const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTTL;
        this.cache.set(key, {
            data,
            expiresAt: Date.now() + ttl
        });
    }

    generateKey(prompt: string, options?: any): string {
        // Sort keys to ensure consistent order for JSON stringify
        const normalizedOptions = options ? this.sortKeys(options) : {};
        const content = prompt + JSON.stringify(normalizedOptions);
        return createHash('md5').update(content).digest('hex');
    }

    private sortKeys(obj: any): any {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(this.sortKeys.bind(this));
        }
        return Object.keys(obj)
            .sort()
            .reduce((result: any, key) => {
                result[key] = this.sortKeys(obj[key]);
                return result;
            }, {});
    }

    clear(): void {
        this.cache.clear();
    }
}
