// 为 lru-cache v5.1.1 创建正确的类型声明
interface LRUCacheOptions<K = any, V = any> {
  max?: number;
  maxAge?: number;
  length?: (value: V, key: K) => number;
  dispose?: (key: K, value: V) => void;
  stale?: boolean;
  noDisposeOnSet?: boolean;
  updateAgeOnGet?: boolean;
}

interface LRUCache<K = any, V = any> {
  set(key: K, value: V, maxAge?: number): boolean;
  get(key: K): V | undefined;
  peek(key: K): V | undefined;
  has(key: K): boolean;
  del(key: K): void;
  reset(): void;
  prune(): void;
  
  // 迭代方法
  forEach(fn: (value: V, key: K, cache: LRUCache<K, V>) => void, thisArg?: any): void;
  rforEach(fn: (value: V, key: K, cache: LRUCache<K, V>) => void, thisArg?: any): void;
  keys(): K[];
  values(): V[];
  dump(): Array<{ k: K; v: V; e: number }>;
  load(arr: Array<{ k: K; v: V; e: number }>): void;
  
  readonly max: number;
  readonly length: number;
  readonly itemCount: number;
  readonly lengthCalculator: (value: V, key: K) => number;
}

// 默认导出构造函数
declare const LRUCacheConstructor: {
  new <K = any, V = any>(options: LRUCacheOptions<K, V>): LRUCache<K, V>;
  <K = any, V = any>(options: LRUCacheOptions<K, V>): LRUCache<K, V>;
};

export = LRUCacheConstructor;