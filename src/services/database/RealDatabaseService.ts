import { Pool, PoolClient, QueryResult } from 'pg';
import { createClient, RedisClientType } from 'redis';
import { v4 as uuidv4 } from 'uuid';
import { 
  DatabaseService,
  DatabaseConfig,
  QueryOptions,
  DatabaseRecord,
  CharacterRecord,
  CharacterMemoryRecord,
  ConversationRecord,
  CharacterRelationshipRecord,
  StoryEventRecord
} from './DatabaseService';

export class RealDatabaseService implements DatabaseService {
  private postgresPool?: Pool;
  private redisClient?: any; // Use 'any' type to avoid Redis client type issues
  private redisEnabled = false;
  private isInitialized = false;
  private schemaInitialized = false;

  constructor(private config: DatabaseConfig) {}

  async connect(): Promise<void> {
    try {
      // Initialize PostgreSQL connection pool
      this.postgresPool = new Pool({
        host: this.config.postgres.host,
        port: this.config.postgres.port,
        database: this.config.postgres.database,
        user: this.config.postgres.user,
        password: this.config.postgres.password,
        max: this.config.postgres.max,
        idleTimeoutMillis: this.config.postgres.idleTimeoutMillis,
        connectionTimeoutMillis: this.config.postgres.connectionTimeoutMillis,
      });

      // Test PostgreSQL connection
      const testClient = await this.postgresPool.connect();
      await testClient.query('SELECT NOW()');
      testClient.release();
      console.log('PostgreSQL connection established successfully');

      // Initialize database schema
      await this.initializeDatabaseSchema();

      // Initialize Redis connection (optional)
      if (this.config.redis) {
        try {
          this.redisClient = createClient({
            socket: {
              host: this.config.redis.host,
              port: this.config.redis.port,
            },
            password: this.config.redis.password,
            database: this.config.redis.db,
          });

          this.redisClient.on('error', (err: any) => {
            console.error('Redis client error:', err);
          });

          await this.redisClient.connect();
          await this.redisClient.ping();
          
          this.redisEnabled = true;
          console.log('Redis connection established successfully');
        } catch (redisError) {
          console.warn('Redis connection failed, continuing without Redis:', redisError);
          this.redisClient = undefined;
          this.redisEnabled = false;
        }
      } else {
        console.log('Redis is disabled in configuration');
        this.redisEnabled = false;
      }

      this.isInitialized = true;
      console.log('Database connections initialized successfully');

    } catch (error) {
      console.error('Failed to initialize database connections:', error);
      throw error;
    }
  }

  // Connection management
  isConnected(): boolean {
    return this.isInitialized && !!this.postgresPool;
  }
  
  async healthCheck(): Promise<boolean> {
    if (!this.isConnected()) {
      return false;
    }
    
    try {
      const client = await this.postgresPool!.connect();
      await client.query('SELECT 1');
      client.release();
      
      // Also check Redis if enabled
      if (this.redisEnabled && this.redisClient) {
        await this.redisClient.ping();
      }
      
      return true;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
  
  async disconnect(): Promise<void> {
    try {
      console.log('Shutting down database connections...');

      if (this.postgresPool) {
        await this.postgresPool.end();
        this.postgresPool = undefined;
      }

      if (this.redisClient) {
        await this.redisClient.quit();
        this.redisClient = undefined;
      }

      this.isInitialized = false;
      this.redisEnabled = false;
      this.schemaInitialized = false;
      console.log('Database connections shut down successfully');

    } catch (error) {
      console.error('Error shutting down database connections:', error);
      throw error;
    }
  }

  async query<T extends QueryResult['rows'][0]>(sql: string, params?: any[], options?: QueryOptions): Promise<T[]> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const maxRetries = options?.retries || 3;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const client = await this.postgresPool.connect();
      try {
        const result = await client.query(sql, params);
        return result.rows as T[];
      } catch (error) {
        lastError = error;
        if (attempt === maxRetries) {
          throw error;
        }
        // Wait before retrying with exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`Database query error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, (error as Error).message);
        await new Promise(resolve => setTimeout(resolve, delay));
      } finally {
        client.release();
      }
    }

    throw lastError;
  }
  
  async executeTransaction<T>(queries: Array<{ sql: string; params?: any[] }>): Promise<T[]> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const client = await this.postgresPool.connect();
    try {
      await client.query('BEGIN');
      const results: T[] = [];
      
      for (const query of queries) {
        const result = await client.query(query.sql, query.params);
        results.push(...(result.rows as T[]));
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getCharacter(id: string, sessionId: string): Promise<CharacterRecord | null> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    // Try to get from cache first
    const cacheKey = `character:${id}:${sessionId}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        console.warn('Failed to parse cached character data:', error);
      }
    }

    if (!this.postgresPool) {
      throw new Error('PostgreSQL not initialized');
    }

    const sql = `
      SELECT * FROM characters 
      WHERE id = $1 AND session_id = $2
      LIMIT 1
    `;
    
    const client = await this.postgresPool.connect();
    try {
      const result = await client.query<CharacterRecord>(sql, [id, sessionId]);
      const character = result.rows.length > 0 ? result.rows[0] : null;
      
      // Cache the result for 5 minutes
      if (character && this.redisEnabled) {
        await this.cacheSet(cacheKey, JSON.stringify(character), 300);
      }
      
      return character;
    } finally {
      client.release();
    }
  }

  async getCharacterMemories(characterId: string, sessionId: string, limit: number = 50): Promise<CharacterMemoryRecord[]> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    // Try to get from cache first
    const cacheKey = `character_memories:${characterId}:${sessionId}:${limit}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        console.warn('Failed to parse cached character memories data:', error);
      }
    }

    if (!this.postgresPool) {
      throw new Error('PostgreSQL not initialized');
    }

    const sql = `
      SELECT * FROM character_memories 
      WHERE character_id = $1 AND session_id = $2
      ORDER BY created_at DESC
      LIMIT $3
    `;
    
    const client = await this.postgresPool.connect();
    try {
      const result = await client.query<CharacterMemoryRecord>(sql, [characterId, sessionId, limit]);
      const memories = result.rows;
      
      // Cache the result for 2 minutes
      if (memories.length > 0 && this.redisEnabled) {
        await this.cacheSet(cacheKey, JSON.stringify(memories), 120);
      }
      
      return memories;
    } finally {
      client.release();
    }
  }

  async getCharacterConversations(characterId: string, sessionId: string, limit: number = 50): Promise<ConversationRecord[]> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    // Try to get from cache first
    const cacheKey = `character_conversations:${characterId}:${sessionId}:${limit}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        console.warn('Failed to parse cached character conversations data:', error);
      }
    }

    if (!this.postgresPool) {
      throw new Error('PostgreSQL not initialized');
    }

    const sql = `
      SELECT * FROM conversations 
      WHERE character_id = $1 AND session_id = $2
      ORDER BY created_at DESC
      LIMIT $3
    `;
    
    const client = await this.postgresPool.connect();
    try {
      const result = await client.query<ConversationRecord>(sql, [characterId, sessionId, limit]);
      const conversations = result.rows;
      
      // Cache the result for 2 minutes
      if (conversations.length > 0 && this.redisEnabled) {
        await this.cacheSet(cacheKey, JSON.stringify(conversations), 120);
      }
      
      return conversations;
    } finally {
      client.release();
    }
  }

  async getCharacterRelationships(characterId: string, sessionId: string): Promise<CharacterRelationshipRecord[]> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    // Try to get from cache first
    const cacheKey = `character_relationships:${characterId}:${sessionId}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        console.warn('Failed to parse cached character relationships data:', error);
      }
    }

    if (!this.postgresPool) {
      throw new Error('PostgreSQL not initialized');
    }

    const sql = `
      SELECT * FROM character_relationships 
      WHERE character_id = $1 AND session_id = $2
    `;
    
    const client = await this.postgresPool.connect();
    try {
      const result = await client.query<CharacterRelationshipRecord>(sql, [characterId, sessionId]);
      const relationships = result.rows;
      
      // Cache the result for 5 minutes
      if (relationships.length > 0 && this.redisEnabled) {
        await this.cacheSet(cacheKey, JSON.stringify(relationships), 300);
      }
      
      return relationships;
    } finally {
      client.release();
    }
  }

  async getSessionCharacters(sessionId: string): Promise<CharacterRecord[]> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    // Try to get from cache first
    const cacheKey = `session_characters:${sessionId}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        console.warn('Failed to parse cached session characters data:', error);
      }
    }

    if (!this.postgresPool) {
      throw new Error('PostgreSQL not initialized');
    }

    const sql = `
      SELECT * FROM characters 
      WHERE session_id = $1 AND is_active = true
    `;
    
    const client = await this.postgresPool.connect();
    try {
      const result = await client.query<CharacterRecord>(sql, [sessionId]);
      const characters = result.rows;
      
      // Cache the result for 5 minutes
      if (characters.length > 0 && this.redisEnabled) {
        await this.cacheSet(cacheKey, JSON.stringify(characters), 300);
      }
      
      return characters;
    } finally {
      client.release();
    }
  }

  async storeMemory(memory: CharacterMemoryRecord): Promise<void> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const sql = `
      INSERT INTO character_memories (
        id, character_id, session_id, content, emotional_weight, 
        associated_characters, tags, memory_type, significance, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;
    
    const params = [
      memory.id,
      memory.character_id,
      memory.session_id,
      memory.content,
      memory.emotional_weight,
      memory.associated_characters,
      memory.tags,
      memory.memory_type,
      memory.significance,
      memory.created_at,
      memory.updated_at
    ];
    
    const client = await this.postgresPool.connect();
    try {
      await client.query(sql, params);
      
      // Invalidate related cache entries
      if (this.redisEnabled) {
        await this.cacheDel(`character_memories:${memory.character_id}:${memory.session_id}:*`);
      }
    } finally {
      client.release();
    }
  }

  async updateCharacter(characterId: string, sessionId: string, updates: Partial<CharacterRecord>): Promise<void> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    // 构建动态更新语句
    const updateFields = [];
    const params = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'created_at') {
        updateFields.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }
    
    if (updateFields.length === 0) {
      return; // 没有需要更新的字段
    }
    
    params.push(characterId, sessionId); // 添加WHERE条件参数
    
    const sql = `
      UPDATE characters 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex} AND session_id = $${paramIndex + 1}
    `;
    
    const client = await this.postgresPool.connect();
    try {
      await client.query(sql, params);
      
      // Invalidate related cache entries
      if (this.redisEnabled) {
        await this.cacheDel(`character:${characterId}:${sessionId}`);
        await this.cacheDel(`session_characters:${sessionId}`);
      }
    } finally {
      client.release();
    }
  }

  async updateSession(sessionId: string, updates: any): Promise<void> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    // 构建动态更新语句
    const updateFields = [];
    const params = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'created_at') {
        updateFields.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }
    
    if (updateFields.length === 0) {
      return; // 没有需要更新的字段
    }
    
    params.push(sessionId); // 添加WHERE条件参数
    
    const sql = `
      UPDATE game_sessions 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
    `;
    
    const client = await this.postgresPool.connect();
    try {
      await client.query(sql, params);
    } finally {
      client.release();
    }
  }

  // 新增：创建会话
  async createSession(sessionId: string, playerId?: string, gameState?: any): Promise<void> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const sql = `
      INSERT INTO game_sessions (id, player_id, game_state, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        player_id = EXCLUDED.player_id,
        game_state = EXCLUDED.game_state,
        updated_at = NOW()
    `;
    
    const params = [sessionId, playerId, gameState];
    
    const client = await this.postgresPool.connect();
    try {
      await client.query(sql, params);
    } finally {
      client.release();
    }
  }

  // 新增：获取会话
  async getSession(sessionId: string): Promise<any> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const sql = `
      SELECT * FROM game_sessions 
      WHERE id = $1
      LIMIT 1
    `;
    
    const client = await this.postgresPool.connect();
    try {
      const result = await client.query(sql, [sessionId]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } finally {
      client.release();
    }
  }

  // 新增：存储对话
  async storeConversation(conversation: ConversationRecord): Promise<void> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const sql = `
      INSERT INTO conversations (
        id, session_id, character_id, message_type, content, context, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    
    const params = [
      conversation.id,
      conversation.session_id,
      conversation.character_id,
      conversation.message_type,
      conversation.content,
      conversation.context,
      conversation.created_at,
      conversation.updated_at
    ];
    
    const client = await this.postgresPool.connect();
    try {
      await client.query(sql, params);
      
      // Invalidate related cache entries
      if (this.redisEnabled) {
        await this.cacheDel(`character_conversations:${conversation.character_id}:${conversation.session_id}:*`);
      }
    } finally {
      client.release();
    }
  }

  // 新增：存储角色关系
  async storeCharacterRelationship(relationship: CharacterRelationshipRecord): Promise<void> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const sql = `
      INSERT INTO character_relationships (
        id, character_id, target_character_id, relationship_type, strength, 
        relationship_data, session_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        strength = EXCLUDED.strength,
        relationship_data = EXCLUDED.relationship_data,
        updated_at = NOW()
    `;
    
    const params = [
      relationship.id,
      relationship.character_id,
      relationship.target_character_id,
      relationship.relationship_type,
      relationship.strength,
      relationship.relationship_data,
      relationship.session_id,
      relationship.created_at,
      relationship.updated_at
    ];
    
    const client = await this.postgresPool.connect();
    try {
      await client.query(sql, params);
      
      // Invalidate related cache entries
      if (this.redisEnabled) {
        await this.cacheDel(`character_relationships:${relationship.character_id}:${relationship.session_id}`);
      }
    } finally {
      client.release();
    }
  }

  // 新增：存储故事事件
  async storeStoryEvent(event: StoryEventRecord): Promise<void> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const sql = `
      INSERT INTO story_events (
        id, session_id, event_type, description, location, 
        involved_characters, impact_level, story_data, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;
    
    const params = [
      event.id,
      event.session_id,
      event.event_type,
      event.description,
      event.location,
      event.involved_characters,
      event.impact_level,
      event.story_data,
      event.created_at,
      event.updated_at
    ];
    
    const client = await this.postgresPool.connect();
    try {
      await client.query(sql, params);
    } finally {
      client.release();
    }
  }

  // 新增：获取故事事件
  async getStoryEvents(sessionId: string, limit: number = 50): Promise<StoryEventRecord[]> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    // Try to get from cache first
    const cacheKey = `story_events:${sessionId}:${limit}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        console.warn('Failed to parse cached story events data:', error);
      }
    }

    if (!this.postgresPool) {
      throw new Error('PostgreSQL not initialized');
    }

    const sql = `
      SELECT * FROM story_events 
      WHERE session_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    
    const client = await this.postgresPool.connect();
    try {
      const result = await client.query<StoryEventRecord>(sql, [sessionId, limit]);
      const events = result.rows;
      
      // Cache the result for 2 minutes
      if (events.length > 0 && this.redisEnabled) {
        await this.cacheSet(cacheKey, JSON.stringify(events), 120);
      }
      
      return events;
    } finally {
      client.release();
    }
  }

  // Redis缓存相关方法
  async cacheGet(key: string): Promise<string | null> {
    if (!this.redisClient || !this.redisEnabled) {
      console.debug('Redis not available, cache get operation skipped');
      return null;
    }
    try {
      return await this.redisClient.get(key) as string | null;
    } catch (error) {
      console.warn('Redis cache get failed:', error);
      return null;
    }
  }

  async cacheSet(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.redisClient || !this.redisEnabled) {
      console.debug('Redis not available, cache set operation skipped');
      return;
    }
    try {
      if (ttl) {
        await this.redisClient.setEx(key, ttl, value);
      } else {
        await this.redisClient.set(key, value);
      }
    } catch (error) {
      console.warn('Redis cache set failed:', error);
    }
  }

  async cacheDel(key: string): Promise<void> {
    if (!this.redisClient || !this.redisEnabled) {
      console.debug('Redis not available, cache delete operation skipped');
      return;
    }
    try {
      // Handle pattern-based deletion
      if (key.includes('*')) {
        const keys = await this.redisClient.keys(key);
        if (keys.length > 0) {
          await this.redisClient.del(keys);
        }
      } else {
        await this.redisClient.del(key);
      }
    } catch (error) {
      console.warn('Redis cache delete failed:', error);
    }
  }
  
  // 新增：批量删除缓存
  async cacheDelPattern(pattern: string): Promise<void> {
    if (!this.redisClient || !this.redisEnabled) {
      console.debug('Redis not available, cache delete pattern operation skipped');
      return;
    }
    try {
      const keys = await this.redisClient.keys(pattern);
      if (keys.length > 0) {
        await this.redisClient.del(keys);
      }
    } catch (error) {
      console.warn('Redis cache delete pattern failed:', error);
    }
  }

  async getGameState(sessionId: string): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    // 优先从缓存获取
    const cacheKey = `game_state:${sessionId}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        console.warn('Failed to parse cached game state:', error);
      }
    }

    if (!this.postgresPool) {
      throw new Error('PostgreSQL not initialized');
    }

    const sql = `
      SELECT game_state FROM game_sessions 
      WHERE id = $1
      LIMIT 1
    `;
    
    const client = await this.postgresPool.connect();
    try {
      const result = await client.query(sql, [sessionId]);
      const gameState = result.rows.length > 0 ? result.rows[0].game_state : null;
      
      // 缓存结果5分钟
      if (gameState && this.redisEnabled) {
        await this.cacheSet(cacheKey, JSON.stringify(gameState), 300);
      }
      
      return gameState;
    } finally {
      client.release();
    }
  }

  async getPlayerPreferences(playerId: string): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    // 优先从缓存获取
    const cacheKey = `player_preferences:${playerId}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        console.warn('Failed to parse cached player preferences:', error);
      }
    }

    if (!this.postgresPool) {
      throw new Error('PostgreSQL not initialized');
    }

    // 假设存在player_preferences表
    const sql = `
      SELECT preferences FROM player_preferences 
      WHERE player_id = $1
      LIMIT 1
    `;
    
    const client = await this.postgresPool.connect();
    try {
      const result = await client.query(sql, [playerId]);
      const preferences = result.rows.length > 0 ? result.rows[0].preferences : null;
      
      // 缓存结果15分钟
      if (preferences && this.redisEnabled) {
        await this.cacheSet(cacheKey, JSON.stringify(preferences), 900);
      }
      
      return preferences;
    } finally {
      client.release();
    }
  }
  
  // Session management methods
  async deleteSession(sessionId: string): Promise<void> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const queries = [
      { sql: 'DELETE FROM conversations WHERE session_id = $1', params: [sessionId] },
      { sql: 'DELETE FROM character_memories WHERE session_id = $1', params: [sessionId] },
      { sql: 'DELETE FROM character_relationships WHERE session_id = $1', params: [sessionId] },
      { sql: 'DELETE FROM story_events WHERE session_id = $1', params: [sessionId] },
      { sql: 'DELETE FROM characters WHERE session_id = $1', params: [sessionId] },
      { sql: 'DELETE FROM game_sessions WHERE id = $1', params: [sessionId] }
    ];

    await this.executeTransaction(queries);

    // Clear related cache
    if (this.redisEnabled) {
      const keys = await this.cacheKeys(`*${sessionId}*`);
      for (const key of keys) {
        await this.cacheDel(key);
      }
    }
  }
  
  async getPlayerSessions(playerId: string): Promise<any[]> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const sql = `
      SELECT * FROM game_sessions 
      WHERE player_id = $1
      ORDER BY updated_at DESC
    `;
    
    const client = await this.postgresPool.connect();
    try {
      const result = await client.query(sql, [playerId]);
      return result.rows;
    } finally {
      client.release();
    }
  }
  
  async getAllActiveSessions(): Promise<any[]> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const sql = `
      SELECT * FROM game_sessions 
      WHERE is_active = true
      ORDER BY updated_at DESC
    `;
    
    const client = await this.postgresPool.connect();
    try {
      const result = await client.query(sql);
      return result.rows;
    } finally {
      client.release();
    }
  }
  
  // Character management methods
  async createCharacter(character: Omit<CharacterRecord, 'created_at' | 'updated_at'>): Promise<CharacterRecord> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const sql = `
      INSERT INTO characters (
        id, name, personality, background, current_location, 
        emotional_state, is_active, character_data, session_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `;
    
    const params = [
      character.id,
      character.name,
      character.personality,
      character.background,
      character.current_location,
      character.emotional_state,
      character.is_active,
      character.character_data,
      character.session_id
    ];
    
    const client = await this.postgresPool.connect();
    try {
      const result = await client.query<CharacterRecord>(sql, params);
      const createdCharacter = result.rows[0];
      
      // Clear related cache
      if (this.redisEnabled) {
        await this.cacheDel(`session_characters:${character.session_id}`);
      }
      
      return createdCharacter;
    } finally {
      client.release();
    }
  }
  
  async deleteCharacter(characterId: string, sessionId: string): Promise<void> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const queries = [
      { sql: 'DELETE FROM character_memories WHERE character_id = $1 AND session_id = $2', params: [characterId, sessionId] },
      { sql: 'DELETE FROM character_relationships WHERE (character_id = $1 OR target_character_id = $1) AND session_id = $2', params: [characterId, sessionId] },
      { sql: 'DELETE FROM conversations WHERE character_id = $1 AND session_id = $2', params: [characterId, sessionId] },
      { sql: 'DELETE FROM characters WHERE id = $1 AND session_id = $2', params: [characterId, sessionId] }
    ];

    await this.executeTransaction(queries);

    // Clear related cache
    if (this.redisEnabled) {
      await this.cacheDel(`character:${characterId}:${sessionId}`);
      await this.cacheDel(`session_characters:${sessionId}`);
    }
  }
  
  // Memory management methods
  async searchMemories(characterId: string, sessionId: string, query: string, limit: number = 50): Promise<CharacterMemoryRecord[]> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const sql = `
      SELECT * FROM character_memories 
      WHERE character_id = $1 AND session_id = $2
        AND (content ILIKE $3 OR $3 = ANY(tags))
      ORDER BY significance DESC, created_at DESC
      LIMIT $4
    `;
    
    const client = await this.postgresPool.connect();
    try {
      const result = await client.query<CharacterMemoryRecord>(sql, [characterId, sessionId, `%${query}%`, limit]);
      return result.rows;
    } finally {
      client.release();
    }
  }
  
  async deleteMemory(memoryId: string): Promise<void> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const sql = 'DELETE FROM character_memories WHERE id = $1';
    
    const client = await this.postgresPool.connect();
    try {
      await client.query(sql, [memoryId]);
    } finally {
      client.release();
    }
  }
  
  // Conversation management methods
  async getConversationHistory(sessionId: string, limit: number = 50): Promise<ConversationRecord[]> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const sql = `
      SELECT * FROM conversations 
      WHERE session_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    
    const client = await this.postgresPool.connect();
    try {
      const result = await client.query<ConversationRecord>(sql, [sessionId, limit]);
      return result.rows;
    } finally {
      client.release();
    }
  }
  
  // Relationship management methods
  async updateRelationshipStrength(characterId: string, targetCharacterId: string, sessionId: string, delta: number): Promise<void> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const sql = `
      UPDATE character_relationships 
      SET strength = GREATEST(-100, LEAST(100, strength + $4)), updated_at = NOW()
      WHERE character_id = $1 AND target_character_id = $2 AND session_id = $3
    `;
    
    const client = await this.postgresPool.connect();
    try {
      await client.query(sql, [characterId, targetCharacterId, sessionId, delta]);
      
      // Clear related cache
      if (this.redisEnabled) {
        await this.cacheDel(`character_relationships:${characterId}:${sessionId}`);
      }
    } finally {
      client.release();
    }
  }
  
  // Story event management methods
  async getStoryEventsByLocation(locationId: string, sessionId: string, limit: number = 50): Promise<StoryEventRecord[]> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const sql = `
      SELECT * FROM story_events 
      WHERE location = $1 AND session_id = $2
      ORDER BY created_at DESC
      LIMIT $3
    `;
    
    const client = await this.postgresPool.connect();
    try {
      const result = await client.query<StoryEventRecord>(sql, [locationId, sessionId, limit]);
      return result.rows;
    } finally {
      client.release();
    }
  }
  
  // Cache management methods
  async cacheKeys(pattern: string): Promise<string[]> {
    if (!this.redisEnabled || !this.redisClient) {
      return [];
    }

    try {
      return await this.redisClient.keys(pattern);
    } catch (error) {
      console.warn('Redis keys operation failed:', error);
      return [];
    }
  }
  
  async cacheFlush(): Promise<void> {
    if (!this.redisEnabled || !this.redisClient) {
      return;
    }

    try {
      await this.redisClient.flushAll();
    } catch (error) {
      console.warn('Redis flush operation failed:', error);
    }
  }
  
  // Game state methods
  async setGameState(sessionId: string, gameState: any): Promise<void> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const sql = `
      UPDATE game_sessions 
      SET game_state = $2, updated_at = NOW()
      WHERE id = $1
    `;
    
    const client = await this.postgresPool.connect();
    try {
      await client.query(sql, [sessionId, gameState]);
      
      // Clear related cache
      if (this.redisEnabled) {
        await this.cacheDel(`game_state:${sessionId}`);
      }
    } finally {
      client.release();
    }
  }
  
  async setPlayerPreferences(playerId: string, preferences: any): Promise<void> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const sql = `
      INSERT INTO player_preferences (player_id, preferences, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW())
      ON CONFLICT (player_id) DO UPDATE SET
        preferences = EXCLUDED.preferences,
        updated_at = NOW()
    `;
    
    const client = await this.postgresPool.connect();
    try {
      await client.query(sql, [playerId, preferences]);
      
      // Clear related cache
      if (this.redisEnabled) {
        await this.cacheDel(`player_preferences:${playerId}`);
      }
    } finally {
      client.release();
    }
  }
  
  // Batch operations
  async batchInsert<T extends DatabaseRecord>(tableName: string, records: T[]): Promise<void> {
    if (!this.isInitialized || !this.postgresPool || records.length === 0) {
      return;
    }

    // This is a simplified implementation - in a real scenario, you'd need
    // to handle different table schemas dynamically
    const queries = records.map(record => ({
      sql: `INSERT INTO ${tableName} (${Object.keys(record).join(', ')}) VALUES (${Object.keys(record).map((_, i) => `$${i + 1}`).join(', ')})`,
      params: Object.values(record)
    }));

    await this.executeTransaction(queries);
  }
  
  async batchUpdate<T extends DatabaseRecord>(tableName: string, updates: Array<{ id: string; data: Partial<T> }>): Promise<void> {
    if (!this.isInitialized || !this.postgresPool || updates.length === 0) {
      return;
    }

    const queries = updates.map(update => {
      const fields = Object.keys(update.data).filter(key => key !== 'id');
      const setClause = fields.map((field, i) => `${field} = $${i + 2}`).join(', ');
      return {
        sql: `UPDATE ${tableName} SET ${setClause}, updated_at = NOW() WHERE id = $1`,
        params: [update.id, ...fields.map(field => (update.data as any)[field])]
      };
    });

    await this.executeTransaction(queries);
  }
  
  // Analytics and statistics
  async getSessionStatistics(sessionId: string): Promise<any> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const queries = [
      { sql: 'SELECT COUNT(*) as character_count FROM characters WHERE session_id = $1', params: [sessionId] },
      { sql: 'SELECT COUNT(*) as conversation_count FROM conversations WHERE session_id = $1', params: [sessionId] },
      { sql: 'SELECT COUNT(*) as memory_count FROM character_memories WHERE session_id = $1', params: [sessionId] },
      { sql: 'SELECT COUNT(*) as event_count FROM story_events WHERE session_id = $1', params: [sessionId] }
    ];

    const client = await this.postgresPool.connect();
    try {
      const results = await Promise.all(
        queries.map(query => client.query(query.sql, query.params))
      );
      
      return {
        characterCount: parseInt(results[0].rows[0].character_count),
        conversationCount: parseInt(results[1].rows[0].conversation_count),
        memoryCount: parseInt(results[2].rows[0].memory_count),
        eventCount: parseInt(results[3].rows[0].event_count)
      };
    } finally {
      client.release();
    }
  }
  
  async getCharacterInteractionCount(characterId: string, sessionId: string): Promise<number> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const sql = `
      SELECT COUNT(*) as interaction_count 
      FROM conversations 
      WHERE character_id = $1 AND session_id = $2
    `;
    
    const client = await this.postgresPool.connect();
    try {
      const result = await client.query(sql, [characterId, sessionId]);
      return parseInt(result.rows[0].interaction_count);
    } finally {
      client.release();
    }
  }
  
  async getPopularLocations(sessionId: string, limit: number = 10): Promise<Array<{ location: string; visits: number }>> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const sql = `
      SELECT location, COUNT(*) as visits
      FROM story_events 
      WHERE session_id = $1
      GROUP BY location
      ORDER BY visits DESC
      LIMIT $2
    `;
    
    const client = await this.postgresPool.connect();
    try {
      const result = await client.query(sql, [sessionId, limit]);
      return result.rows.map(row => ({
        location: row.location,
        visits: parseInt(row.visits)
      }));
    } finally {
      client.release();
    }
  }

  /**
   * 初始化数据库架构
   */
  private async initializeDatabaseSchema(): Promise<void> {
    if (this.schemaInitialized || !this.postgresPool) {
      return;
    }

    const client = await this.postgresPool.connect();
    try {
      console.log('开始初始化数据库架构...');

      // 按照依赖关系顺序创建表
      const schemaSql = `
        -- 创建游戏会话表（无外键依赖）
        CREATE TABLE IF NOT EXISTS game_sessions (
            id VARCHAR(36) PRIMARY KEY,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            player_id VARCHAR(36),
            game_state JSONB,
            is_active BOOLEAN DEFAULT true,
            current_location VARCHAR(100) DEFAULT 'town_square'
        );

        -- 创建玩家偏好设置表
        CREATE TABLE IF NOT EXISTS player_preferences (
            player_id VARCHAR(36) PRIMARY KEY,
            preferences JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- 创建角色表（依赖game_sessions）
        CREATE TABLE IF NOT EXISTS characters (
            id VARCHAR(36) PRIMARY KEY,
            session_id VARCHAR(36) REFERENCES game_sessions(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            personality JSONB,
            background TEXT,
            current_location VARCHAR(100),
            emotional_state JSONB,
            is_active BOOLEAN DEFAULT true,
            character_data JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- 创建角色记忆表（依赖characters和game_sessions）
        CREATE TABLE IF NOT EXISTS character_memories (
            id VARCHAR(36) PRIMARY KEY,
            character_id VARCHAR(36) REFERENCES characters(id) ON DELETE CASCADE,
            session_id VARCHAR(36) REFERENCES game_sessions(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            emotional_weight NUMERIC(3,2) DEFAULT 0.5,
            associated_characters TEXT[],
            tags TEXT[],
            memory_type VARCHAR(20) CHECK (memory_type IN ('dialogue', 'observation', 'action')) DEFAULT 'dialogue',
            significance INTEGER DEFAULT 5,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- 创建对话记录表（依赖game_sessions和characters）
        CREATE TABLE IF NOT EXISTS conversations (
            id VARCHAR(36) PRIMARY KEY,
            session_id VARCHAR(36) REFERENCES game_sessions(id) ON DELETE CASCADE,
            character_id VARCHAR(36) REFERENCES characters(id) ON DELETE CASCADE,
            message_type VARCHAR(20) CHECK (message_type IN ('player_input', 'character_response', 'narration', 'system_message')) DEFAULT 'player_input',
            content TEXT NOT NULL,
            context JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- 创建角色关系表（依赖characters和game_sessions）
        CREATE TABLE IF NOT EXISTS character_relationships (
            id VARCHAR(36) PRIMARY KEY,
            character_id VARCHAR(36) REFERENCES characters(id) ON DELETE CASCADE,
            target_character_id VARCHAR(36) REFERENCES characters(id) ON DELETE CASCADE,
            relationship_type VARCHAR(50),
            strength NUMERIC(3,2) DEFAULT 0.5,
            relationship_data JSONB,
            session_id VARCHAR(36) REFERENCES game_sessions(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(character_id, target_character_id, session_id)
        );

        -- 创建地点表
        CREATE TABLE IF NOT EXISTS locations (
            id VARCHAR(100) PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            description TEXT,
            location_type VARCHAR(50),
            region_id VARCHAR(100),
            position_x NUMERIC(10,2),
            position_y NUMERIC(10,2),
            location_data JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- 创建世界背景故事表
        CREATE TABLE IF NOT EXISTS world_lore (
            id VARCHAR(36) PRIMARY KEY,
            session_id VARCHAR(36) REFERENCES game_sessions(id) ON DELETE CASCADE,
            lore_type VARCHAR(50) NOT NULL,
            title VARCHAR(200) NOT NULL,
            content TEXT NOT NULL,
            inspiration TEXT,
            generation_seed VARCHAR(100),
            metadata JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- 创建故事事件表（依赖game_sessions）
        CREATE TABLE IF NOT EXISTS story_events (
            id VARCHAR(36) PRIMARY KEY,
            session_id VARCHAR(36) REFERENCES game_sessions(id) ON DELETE CASCADE,
            event_type VARCHAR(50),
            description TEXT,
            location VARCHAR(100),
            involved_characters TEXT[],
            impact_level INTEGER DEFAULT 1,
            story_data JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;

      // 执行架构创建SQL
      await client.query(schemaSql);

      // 创建索引以提高查询性能
      const indexesSql = `
        CREATE INDEX IF NOT EXISTS idx_characters_session_id ON characters(session_id);
        CREATE INDEX IF NOT EXISTS idx_characters_active ON characters(is_active);
        CREATE INDEX IF NOT EXISTS idx_character_memories_character_id ON character_memories(character_id);
        CREATE INDEX IF NOT EXISTS idx_character_memories_session_id ON character_memories(session_id);
        CREATE INDEX IF NOT EXISTS idx_character_memories_created_at ON character_memories(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
        CREATE INDEX IF NOT EXISTS idx_conversations_character_id ON conversations(character_id);
        CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_character_relationships_character_id ON character_relationships(character_id);
        CREATE INDEX IF NOT EXISTS idx_character_relationships_session_id ON character_relationships(session_id);
        CREATE INDEX IF NOT EXISTS idx_story_events_session_id ON story_events(session_id);
        CREATE INDEX IF NOT EXISTS idx_story_events_created_at ON story_events(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_locations_type ON locations(location_type);
        CREATE INDEX IF NOT EXISTS idx_locations_region ON locations(region_id);
        CREATE INDEX IF NOT EXISTS idx_world_lore_session_id ON world_lore(session_id);
        CREATE INDEX IF NOT EXISTS idx_world_lore_type ON world_lore(lore_type);
        CREATE INDEX IF NOT EXISTS idx_game_sessions_player_id ON game_sessions(player_id);
        CREATE INDEX IF NOT EXISTS idx_game_sessions_active ON game_sessions(is_active);
      `;

      await client.query(indexesSql);

      // 插入一些基础数据（如果不存在的话）
      await this.insertInitialData(client);

      this.schemaInitialized = true;
      console.log('数据库架构初始化完成');

    } catch (error) {
      console.error('数据库架构初始化失败:', error);
      // 不抛出错误，让系统继续运行
    } finally {
      client.release();
    }
  }

  /**
   * 插入初始化数据
   */
  private async insertInitialData(client: PoolClient): Promise<void> {
    try {
      // 检查是否已有基础数据
      const existingSessionsResult = await client.query('SELECT COUNT(*) as count FROM game_sessions');
      const existingSessionsCount = parseInt(existingSessionsResult.rows[0].count);

      if (existingSessionsCount === 0) {
        console.log('插入初始化数据...');

        // 创建一个示例会话
        const sampleSessionId = uuidv4();
        const samplePlayerId = uuidv4();

        await client.query(`
          INSERT INTO game_sessions (id, player_id, game_state, is_active)
          VALUES ($1, $2, $3, $4)
        `, [
          sampleSessionId,
          samplePlayerId,
          JSON.stringify({
            timeOfDay: 'afternoon',
            weather: 'sunny',
            atmosphere: 'peaceful',
            playerLevel: 1,
            completedQuests: []
          }),
          true
        ]);

        // 创建一些基础角色
        const characters = [
          {
            id: uuidv4(),
            name: '城镇守卫',
            personality: { traits: ['dutiful', 'protective', 'serious'], mood: 'neutral' },
            background: '一位尽职尽责的城镇守卫，负责维护镇中心广场的安全与秩序。',
            current_location: 'town_square'
          },
          {
            id: uuidv4(),
            name: '图书管理员',
            personality: { traits: ['knowledgeable', 'patient', 'helpful'], mood: 'friendly' },
            background: '博学的图书管理员，掌握着古老的知识和智慧。',
            current_location: 'library'
          },
          {
            id: uuidv4(),
            name: '商人',
            personality: { traits: ['friendly', 'talkative', 'business-minded'], mood: 'cheerful' },
            background: '热情的商人，总是eager to share stories and sell goods.',
            current_location: 'market'
          }
        ];

        for (const character of characters) {
          await client.query(`
            INSERT INTO characters (id, session_id, name, personality, background, current_location, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            character.id,
            sampleSessionId,
            character.name,
            JSON.stringify(character.personality),
            character.background,
            character.current_location,
            true
          ]);
        }

        // 插入玩家偏好设置
        await client.query(`
          INSERT INTO player_preferences (player_id, preferences)
          VALUES ($1, $2)
        `, [
          samplePlayerId,
          JSON.stringify({
            language: 'zh',
            difficulty: 'normal',
            narrativeStyle: 'immersive'
          })
        ]);

        console.log('初始化数据插入完成');
      }
    } catch (error) {
      console.warn('插入初始化数据时出现错误:', error);
      // 不抛出错误，让系统继续运行
    }
  }
  
  // Location management methods
  async createLocation(location: any): Promise<any> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const sql = `
      INSERT INTO locations (
        id, name, description, location_type, region_id, 
        position_x, position_y, location_data, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        location_type = EXCLUDED.location_type,
        region_id = EXCLUDED.region_id,
        position_x = EXCLUDED.position_x,
        position_y = EXCLUDED.position_y,
        location_data = EXCLUDED.location_data,
        updated_at = NOW()
      RETURNING *
    `;
    
    const params = [
      location.id,
      location.name,
      location.description,
      location.location_type,
      location.region_id,
      location.position_x,
      location.position_y,
      location.location_data
    ];
    
    const client = await this.postgresPool.connect();
    try {
      const result = await client.query(sql, params);
      const createdLocation = result.rows[0];
      
      // Clear related cache
      if (this.redisEnabled) {
        await this.cacheDel(`location:${location.id}`);
        await this.cacheDel('locations:all');
      }
      
      return createdLocation;
    } finally {
      client.release();
    }
  }

  async getLocation(locationId: string): Promise<any | null> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const cacheKey = `location:${locationId}`;
    
    // Try cache first
    if (this.redisEnabled) {
      const cached = await this.cacheGet(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const sql = `
      SELECT * FROM locations
      WHERE id = $1
    `;
    
    const client = await this.postgresPool.connect();
    try {
      const result = await client.query(sql, [locationId]);
      const location = result.rows.length > 0 ? result.rows[0] : null;
      
      // Cache result for 30 minutes
      if (location && this.redisEnabled) {
        await this.cacheSet(cacheKey, JSON.stringify(location), 1800);
      }
      
      return location;
    } finally {
      client.release();
    }
  }

  async getAllLocations(): Promise<any[]> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const cacheKey = 'locations:all';
    
    // Try cache first
    if (this.redisEnabled) {
      const cached = await this.cacheGet(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const sql = `
      SELECT * FROM locations
      ORDER BY name
    `;
    
    const client = await this.postgresPool.connect();
    try {
      const result = await client.query(sql);
      const locations = result.rows;
      
      // Cache result for 15 minutes
      if (this.redisEnabled) {
        await this.cacheSet(cacheKey, JSON.stringify(locations), 900);
      }
      
      return locations;
    } finally {
      client.release();
    }
  }

  async updateLocation(locationId: string, updates: any): Promise<void> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const setParts = [];
    const params = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      setParts.push(`${key} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }

    if (setParts.length === 0) {
      return;
    }

    setParts.push(`updated_at = NOW()`);
    params.push(locationId);

    const sql = `
      UPDATE locations 
      SET ${setParts.join(', ')}
      WHERE id = $${paramIndex}
    `;
    
    const client = await this.postgresPool.connect();
    try {
      await client.query(sql, params);
      
      // Clear related cache
      if (this.redisEnabled) {
        await this.cacheDel(`location:${locationId}`);
        await this.cacheDel('locations:all');
      }
    } finally {
      client.release();
    }
  }
  
  // World Lore management methods
  async createWorldLore(lore: any): Promise<any> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const sql = `
      INSERT INTO world_lore (
        id, session_id, lore_type, title, content, inspiration, 
        generation_seed, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `;
    
    const params = [
      lore.id,
      lore.session_id,
      lore.lore_type,
      lore.title,
      lore.content,
      lore.inspiration,
      lore.generation_seed,
      lore.metadata
    ];
    
    const client = await this.postgresPool.connect();
    try {
      const result = await client.query(sql, params);
      const createdLore = result.rows[0];
      
      // Clear related cache
      if (this.redisEnabled) {
        await this.cacheDel(`world_lore:${lore.session_id}`);
        await this.cacheDel(`world_lore:${lore.session_id}:${lore.lore_type}`);
      }
      
      return createdLore;
    } finally {
      client.release();
    }
  }

  async getWorldLoreBySession(sessionId: string, loreType?: string): Promise<any[]> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const cacheKey = loreType 
      ? `world_lore:${sessionId}:${loreType}`
      : `world_lore:${sessionId}`;
    
    // Try cache first
    if (this.redisEnabled) {
      const cached = await this.cacheGet(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    let sql = `
      SELECT * FROM world_lore
      WHERE session_id = $1
    `;
    
    const params = [sessionId];
    
    if (loreType) {
      sql += ' AND lore_type = $2';
      params.push(loreType);
    }
    
    sql += ' ORDER BY created_at';
    
    const client = await this.postgresPool.connect();
    try {
      const result = await client.query(sql, params);
      const lore = result.rows;
      
      // Cache result for 30 minutes
      if (this.redisEnabled) {
        await this.cacheSet(cacheKey, JSON.stringify(lore), 1800);
      }
      
      return lore;
    } finally {
      client.release();
    }
  }

  async hasWorldLore(sessionId: string): Promise<boolean> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const sql = `
      SELECT COUNT(*) as count FROM world_lore
      WHERE session_id = $1
    `;
    
    const client = await this.postgresPool.connect();
    try {
      const result = await client.query(sql, [sessionId]);
      return parseInt(result.rows[0].count) > 0;
    } finally {
      client.release();
    }
  }

  async updateWorldLore(loreId: string, updates: any): Promise<void> {
    if (!this.isInitialized || !this.postgresPool) {
      throw new Error('Database not initialized');
    }

    const setParts = [];
    const params = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      setParts.push(`${key} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }

    if (setParts.length === 0) {
      return;
    }

    setParts.push(`updated_at = NOW()`);
    params.push(loreId);

    const sql = `
      UPDATE world_lore 
      SET ${setParts.join(', ')}
      WHERE id = $${paramIndex}
    `;
    
    const client = await this.postgresPool.connect();
    try {
      await client.query(sql, params);
      
      // Clear related cache - we need to get session_id first
      const sessionResult = await client.query('SELECT session_id FROM world_lore WHERE id = $1', [loreId]);
      if (sessionResult.rows.length > 0 && this.redisEnabled) {
        const sessionId = sessionResult.rows[0].session_id;
        await this.cacheDel(`world_lore:${sessionId}`);
        // Clear all lore type caches for this session
        const loreTypes = ['main_story', 'history', 'legend', 'culture', 'geography'];
        for (const type of loreTypes) {
          await this.cacheDel(`world_lore:${sessionId}:${type}`);
        }
      }
    } finally {
      client.release();
    }
  }
}