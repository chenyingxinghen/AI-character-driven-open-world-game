declare module 'ioredis' {
  import { EventEmitter } from 'events';

  export interface RedisOptions {
    host?: string;
    port?: number;
    family?: number;
    password?: string;
    db?: number;
    retryDelayOnFailover?: number;
    enableReadyCheck?: boolean;
    maxRetriesPerRequest?: number;
    lazyConnect?: boolean;
    keepAlive?: number;
    connectionName?: string;
    sentinels?: Array<{ host: string; port: number }>;
    name?: string;
    role?: 'master' | 'slave';
    reconnectOnError?: (err: Error) => boolean | 1 | 2;
  }

  export interface Pipeline {
    exec(): Promise<Array<[Error | null, any]>>;
    get(key: string): Pipeline;
    set(key: string, value: string | number | Buffer): Pipeline;
    setex(key: string, seconds: number, value: string | number | Buffer): Pipeline;
    del(...keys: string[]): Pipeline;
    exists(...keys: string[]): Pipeline;
    expire(key: string, seconds: number): Pipeline;
    ttl(key: string): Pipeline;
    hget(key: string, field: string): Pipeline;
    hset(key: string, field: string, value: string | number | Buffer): Pipeline;
    hdel(key: string, ...fields: string[]): Pipeline;
    hgetall(key: string): Pipeline;
    sadd(key: string, ...members: (string | number | Buffer)[]): Pipeline;
    smembers(key: string): Pipeline;
    srem(key: string, ...members: (string | number | Buffer)[]): Pipeline;
    zadd(key: string, score: number, member: string | number | Buffer): Pipeline;
    zrange(key: string, start: number, stop: number): Pipeline;
    zrem(key: string, ...members: (string | number | Buffer)[]): Pipeline;
  }

  export interface Cluster extends EventEmitter {
    get(key: string): Promise<string | null>;
    set(key: string, value: string | number | Buffer): Promise<'OK'>;
    setex(key: string, seconds: number, value: string | number | Buffer): Promise<'OK'>;
    del(...keys: string[]): Promise<number>;
    exists(...keys: string[]): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    ttl(key: string): Promise<number>;
    hget(key: string, field: string): Promise<string | null>;
    hset(key: string, field: string, value: string | number | Buffer): Promise<number>;
    hdel(key: string, ...fields: string[]): Promise<number>;
    hgetall(key: string): Promise<Record<string, string>>;
    sadd(key: string, ...members: (string | number | Buffer)[]): Promise<number>;
    smembers(key: string): Promise<string[]>;
    srem(key: string, ...members: (string | number | Buffer)[]): Promise<number>;
    zadd(key: string, score: number, member: string | number | Buffer): Promise<number>;
    zrange(key: string, start: number, stop: number): Promise<string[]>;
    zrem(key: string, ...members: (string | number | Buffer)[]): Promise<number>;
    
    pipeline(): Pipeline;
    multi(): Pipeline;
    
    disconnect(): void;
    quit(): Promise<'OK'>;
    
    status: 'wait' | 'connecting' | 'connect' | 'ready' | 'close' | 'reconnecting' | 'end';
  }

  export default class Redis extends EventEmitter {
    constructor(options?: RedisOptions);
    constructor(port?: number, host?: string, options?: RedisOptions);
    constructor(url?: string, options?: RedisOptions);

    get(key: string): Promise<string | null>;
    set(key: string, value: string | number | Buffer): Promise<'OK'>;
    setex(key: string, seconds: number, value: string | number | Buffer): Promise<'OK'>;
    del(...keys: string[]): Promise<number>;
    exists(...keys: string[]): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    ttl(key: string): Promise<number>;
    ping(): Promise<string>;
    
    hget(key: string, field: string): Promise<string | null>;
    hset(key: string, field: string, value: string | number | Buffer): Promise<number>;
    hdel(key: string, ...fields: string[]): Promise<number>;
    hgetall(key: string): Promise<Record<string, string>>;
    
    sadd(key: string, ...members: (string | number | Buffer)[]): Promise<number>;
    smembers(key: string): Promise<string[]>;
    srem(key: string, ...members: (string | number | Buffer)[]): Promise<number>;
    
    zadd(key: string, score: number, member: string | number | Buffer): Promise<number>;
    zrange(key: string, start: number, stop: number): Promise<string[]>;
    zrem(key: string, ...members: (string | number | Buffer)[]): Promise<number>;
    
    pipeline(): Pipeline;
    multi(): Pipeline;
    
    connect(): Promise<void>;
    disconnect(): void;
    quit(): Promise<'OK'>;
    
    status: 'wait' | 'connecting' | 'connect' | 'ready' | 'close' | 'reconnecting' | 'end';
    
    static Cluster: new (nodes: Array<{ host: string; port: number }>, options?: any) => Cluster;
  }
}