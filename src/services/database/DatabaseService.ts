export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
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

// Base interface for database service
export interface DatabaseService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query(sql: string, params?: any[], options?: QueryOptions): Promise<any[]>;
  getCharacter(id: string, sessionId: string): Promise<CharacterRecord | null>;
  getCharacterMemories(characterId: string, sessionId: string, limit: number): Promise<CharacterMemoryRecord[]>;
  getCharacterConversations(characterId: string, sessionId: string, limit: number): Promise<ConversationRecord[]>;
  getCharacterRelationships(characterId: string, sessionId: string): Promise<CharacterRelationshipRecord[]>;
  getSessionCharacters(sessionId: string): Promise<CharacterRecord[]>;
  storeMemory(memory: CharacterMemoryRecord): Promise<void>;
  updateCharacter(characterId: string, sessionId: string, updates: Partial<CharacterRecord>): Promise<void>;
  updateSession(sessionId: string, updates: any): Promise<void>;
  
  // 新增方法
  createSession(sessionId: string, playerId?: string, gameState?: any): Promise<void>;
  getSession(sessionId: string): Promise<any>;
  storeConversation(conversation: ConversationRecord): Promise<void>;
  storeCharacterRelationship(relationship: CharacterRelationshipRecord): Promise<void>;
  storeStoryEvent(event: StoryEventRecord): Promise<void>;
  getStoryEvents(sessionId: string, limit: number): Promise<StoryEventRecord[]>;
  
  // 缓存相关方法
  cacheGet(key: string): Promise<string | null>;
  cacheSet(key: string, value: string, ttl?: number): Promise<void>;
  cacheDel(key: string): Promise<void>;
}

export class MockDatabaseService implements DatabaseService {
  async connect(): Promise<void> {
    // 在完整实现中，这将连接到数据库
    console.log(`Connecting to database`);
  }

  async disconnect(): Promise<void> {
    // 在完整实现中，这将断开数据库连接
    console.log('Disconnecting from database');
  }

  async query(sql: string, params?: any[], options?: QueryOptions): Promise<any[]> {
    // 在完整实现中，这将执行数据库查询
    console.log(`Executing query: ${sql}`);
    return [];
  }

  async getCharacter(id: string, sessionId: string): Promise<CharacterRecord | null> {
    // 在完整实现中，这将从数据库获取角色记录
    return null;
  }

  async getCharacterMemories(characterId: string, sessionId: string, limit: number): Promise<CharacterMemoryRecord[]> {
    // 在完整实现中，这将从数据库获取角色记忆
    return [];
  }

  async getCharacterConversations(characterId: string, sessionId: string, limit: number): Promise<ConversationRecord[]> {
    // 在完整实现中，这将从数据库获取角色对话
    return [];
  }

  async getCharacterRelationships(characterId: string, sessionId: string): Promise<CharacterRelationshipRecord[]> {
    // 在完整实现中，这将从数据库获取角色关系
    return [];
  }

  async getSessionCharacters(sessionId: string): Promise<CharacterRecord[]> {
    // 在完整实现中，这将从数据库获取会话中的所有角色
    return [];
  }

  async storeMemory(memory: CharacterMemoryRecord): Promise<void> {
    // 在完整实现中，这将存储角色记忆到数据库
  }

  async updateCharacter(characterId: string, sessionId: string, updates: Partial<CharacterRecord>): Promise<void> {
    // 在完整实现中，这将更新角色记录
  }

  async updateSession(sessionId: string, updates: any): Promise<void> {
    // 在完整实现中，这将更新会话记录
  }
  
  // 新增方法的Mock实现
  async createSession(sessionId: string, playerId?: string, gameState?: any): Promise<void> {
    // 在完整实现中，这将创建会话记录
  }

  async getSession(sessionId: string): Promise<any> {
    // 在完整实现中，这将获取会话记录
    return null;
  }

  async storeConversation(conversation: ConversationRecord): Promise<void> {
    // 在完整实现中，这将存储对话记录
  }

  async storeCharacterRelationship(relationship: CharacterRelationshipRecord): Promise<void> {
    // 在完整实现中，这将存储角色关系记录
  }

  async storeStoryEvent(event: StoryEventRecord): Promise<void> {
    // 在完整实现中，这将存储故事事件记录
  }

  async getStoryEvents(sessionId: string, limit: number): Promise<StoryEventRecord[]> {
    // 在完整实现中，这将获取故事事件记录
    return [];
  }
  
  // 缓存相关方法的Mock实现
  async cacheGet(key: string): Promise<string | null> {
    // 在完整实现中，这将从缓存获取数据
    return null;
  }

  async cacheSet(key: string, value: string, ttl?: number): Promise<void> {
    // 在完整实现中，这将设置缓存数据
  }

  async cacheDel(key: string): Promise<void> {
    // 在完整实现中，这将删除缓存数据
  }
}