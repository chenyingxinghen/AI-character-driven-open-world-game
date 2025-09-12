import { Pool, PoolClient, QueryResult } from 'pg';
import { createClient, RedisClientType } from 'redis';
import { v4 as uuidv4 } from 'uuid';

export interface DatabaseConfig {
  postgres: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  };
  redis?: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
}

export interface QueryOptions {
  timeout?: number;
  retries?: number;
}

export interface DatabaseRecord {
  id: string;
  created_at: Date;
  updated_at: Date;
}

export interface CharacterRecord extends DatabaseRecord {
  name: string;
  personality: any;
  background: string;
  current_location: string;
  emotional_state: any;
  is_active: boolean;
  character_data?: any;
  session_id: string;
}

export interface CharacterMemoryRecord extends DatabaseRecord {
  character_id: string;
  session_id: string;
  content: string;
  emotional_weight: number;
  associated_characters: string[];
  tags: string[];
  memory_type: 'dialogue' | 'observation' | 'action';
  significance: number;
}

export interface ConversationRecord extends DatabaseRecord {
  session_id: string;
  character_id: string;
  message_type: 'player_input' | 'character_response' | 'narration' | 'system_message';
  content: string;
  context?: any;
}

export interface CharacterRelationshipRecord extends DatabaseRecord {
  character_id: string;
  target_character_id: string;
  relationship_type: string;
  strength: number;
  relationship_data?: any;
  session_id: string;
}

export interface StoryEventRecord extends DatabaseRecord {
  session_id: string;
  event_type: string;
  description: string;
  location: string;
  involved_characters: string[];
  impact_level: number;
  story_data?: any;
}

export class RealDatabaseService {
  private postgresPool?: Pool;
  private redisClient?: any; // Use 'any' type to avoid Redis client type issues
  private redisEnabled = false;
  private isInitialized = false;

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

  async disconnect(): Promise<void> {
    try {
      console.log('Shutting down database connections...');

      if (this.postgresPool) {
        await this.postgresPool.end();
      }

      if (this.redisClient) {
        await this.redisClient.quit();
      }

      this.isInitialized = false;
      console.log('Database connections shut down successfully');

    } catch (error) {
      console.error('Error shutting down database connections:', error);
      throw error;
    }
  }

  async query<T extends QueryResultRow>(sql: string, params?: any[], options?: QueryOptions): Promise<T[]> {
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
}