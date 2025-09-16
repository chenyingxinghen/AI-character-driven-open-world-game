declare module 'lru-cache' {
  export interface LRUCacheOptions<K = any, V = any> {
    max?: number;
    ttl?: number;
    maxSize?: number;
    sizeCalculation?: (value: V, key: K) => number;
    dispose?: (value: V, key: K) => void;
    disposeAfter?: (value: V, key: K) => void;
    noDisposeOnSet?: boolean;
    noUpdateTTL?: boolean;
    noDeleteOnStaleGet?: boolean;
    allowStaleOnFetchAbort?: boolean;
    allowStaleOnFetchRejection?: boolean;
    ignoreFetchAbort?: boolean;
    fetchMethod?: (key: K, staleValue: V | undefined, options: any) => Promise<V>;
    allowStale?: boolean;
    updateAgeOnGet?: boolean;
    updateAgeOnHas?: boolean;
  }

  export class LRUCache<K = any, V = any> {
    constructor(options: LRUCacheOptions<K, V>);
    
    set(key: K, value: V, options?: { ttl?: number; size?: number; sizeCalculation?: (value: V, key: K) => number; noDisposeOnSet?: boolean; }): this;
    get(key: K, options?: { allowStale?: boolean; updateAgeOnGet?: boolean; noDeleteOnStaleGet?: boolean; }): V | undefined;
    has(key: K, options?: { allowStale?: boolean; updateAgeOnHas?: boolean; }): boolean;
    delete(key: K): boolean;
    clear(): void;
    
    readonly size: number;
    readonly max: number;
    readonly maxSize: number;
    readonly calculatedSize: number;
    readonly ttl: number;
    
    keys(): Generator<K, void, unknown>;
    values(): Generator<V, void, unknown>;
    entries(): Generator<[K, V], void, unknown>;
    
    find(fn: (value: V, key: K, cache: this) => boolean, options?: { allowStale?: boolean; }): V | undefined;
    forEach(fn: (value: V, key: K, cache: this) => void, thisArg?: any): void;
    
    getRemainingTTL(key: K): number;
    
    purgeStale(): boolean;
    
    info(key: K): {
      value: V;
      ttl: number;
      size: number;
      start: number;
    } | undefined;
    
    dump(): Array<[K, { value: V; ttl: number; size: number; start: number; }]>;
    load(arr: Array<[K, { value: V; ttl: number; size: number; start: number; }]>): void;
    
    peek(key: K, options?: { allowStale?: boolean; }): V | undefined;
  }
}