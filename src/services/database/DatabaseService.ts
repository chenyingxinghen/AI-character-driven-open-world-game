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
    ssl?: boolean;
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
  useTransaction?: boolean;
  isolationLevel?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
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
  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  healthCheck(): Promise<boolean>;
  
  // Core query methods
  query<T = any>(sql: string, params?: any[], options?: QueryOptions): Promise<T[]>;
  executeTransaction<T>(queries: Array<{ sql: string; params?: any[] }>): Promise<T[]>;
  
  // Session management
  createSession(sessionId: string, playerId?: string, gameState?: any): Promise<void>;
  getSession(sessionId: string): Promise<any>;
  updateSession(sessionId: string, updates: any): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  getPlayerSessions(playerId: string): Promise<any[]>;
  getAllActiveSessions(): Promise<any[]>;
  
  // Character management
  createCharacter(character: Omit<CharacterRecord, 'created_at' | 'updated_at'>): Promise<CharacterRecord>;
  getCharacter(id: string, sessionId: string): Promise<CharacterRecord | null>;
  getSessionCharacters(sessionId: string): Promise<CharacterRecord[]>;
  updateCharacter(characterId: string, sessionId: string, updates: Partial<CharacterRecord>): Promise<void>;
  deleteCharacter(characterId: string, sessionId: string): Promise<void>;
  
  // Memory management
  storeMemory(memory: CharacterMemoryRecord): Promise<void>;
  getCharacterMemories(characterId: string, sessionId: string, limit?: number): Promise<CharacterMemoryRecord[]>;
  searchMemories(characterId: string, sessionId: string, query: string, limit?: number): Promise<CharacterMemoryRecord[]>;
  deleteMemory(memoryId: string): Promise<void>;
  
  // Conversation management
  storeConversation(conversation: ConversationRecord): Promise<void>;
  getCharacterConversations(characterId: string, sessionId: string, limit?: number): Promise<ConversationRecord[]>;
  getConversationHistory(sessionId: string, limit?: number): Promise<ConversationRecord[]>;
  
  // Relationship management
  storeCharacterRelationship(relationship: CharacterRelationshipRecord): Promise<void>;
  getCharacterRelationships(characterId: string, sessionId: string): Promise<CharacterRelationshipRecord[]>;
  updateRelationshipStrength(characterId: string, targetCharacterId: string, sessionId: string, delta: number): Promise<void>;
  
  // Story event management
  storeStoryEvent(event: StoryEventRecord): Promise<void>;
  getStoryEvents(sessionId: string, limit?: number): Promise<StoryEventRecord[]>;
  getStoryEventsByLocation(locationId: string, sessionId: string, limit?: number): Promise<StoryEventRecord[]>;
  
  // Cache management
  cacheGet(key: string): Promise<string | null>;
  cacheSet(key: string, value: string, ttl?: number): Promise<void>;
  cacheDel(key: string): Promise<void>;
  cacheKeys(pattern: string): Promise<string[]>;
  cacheFlush(): Promise<void>;
  
  // Game state queries
  getGameState(sessionId: string): Promise<any>;
  setGameState(sessionId: string, gameState: any): Promise<void>;
  getPlayerPreferences(playerId: string): Promise<any>;
  setPlayerPreferences(playerId: string, preferences: any): Promise<void>;
  
  // Batch operations
  batchInsert<T extends DatabaseRecord>(tableName: string, records: T[]): Promise<void>;
  batchUpdate<T extends DatabaseRecord>(tableName: string, updates: Array<{ id: string; data: Partial<T> }>): Promise<void>;
  
  // Analytics and statistics
  getSessionStatistics(sessionId: string): Promise<any>;
  getCharacterInteractionCount(characterId: string, sessionId: string): Promise<number>;
  getPopularLocations(sessionId: string, limit?: number): Promise<Array<{ location: string; visits: number }>>;
}

export class MockDatabaseService implements DatabaseService {
  private connected = false;
  
  async connect(): Promise<void> {
    console.log('Mock: Connecting to database');
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    console.log('Mock: Disconnecting from database');
    this.connected = false;
  }
  
  isConnected(): boolean {
    return this.connected;
  }
  
  async healthCheck(): Promise<boolean> {
    return this.connected;
  }

  async query<T = any>(sql: string, params?: any[], options?: QueryOptions): Promise<T[]> {
    console.log(`Mock: Executing query: ${sql} with params:`, params);
    return [] as T[];
  }
  
  async executeTransaction<T>(queries: Array<{ sql: string; params?: any[] }>): Promise<T[]> {
    console.log('Mock: Executing transaction with', queries.length, 'queries');
    return [] as T[];
  }

  // Session management
  async createSession(sessionId: string, playerId?: string, gameState?: any): Promise<void> {
    console.log(`Mock: Creating session ${sessionId} for player ${playerId}`);
  }

  async getSession(sessionId: string): Promise<any> {
    console.log(`Mock: Getting session ${sessionId}`);
    return null;
  }
  
  async deleteSession(sessionId: string): Promise<void> {
    console.log(`Mock: Deleting session ${sessionId}`);
  }
  
  async getPlayerSessions(playerId: string): Promise<any[]> {
    console.log(`Mock: Getting sessions for player ${playerId}`);
    return [];
  }
  
  async getAllActiveSessions(): Promise<any[]> {
    console.log('Mock: Getting all active sessions');
    return [];
  }
  
  // Character management
  async createCharacter(character: Omit<CharacterRecord, 'created_at' | 'updated_at'>): Promise<CharacterRecord> {
    console.log(`Mock: Creating character ${character.name}`);
    return {
      ...character,
      created_at: new Date(),
      updated_at: new Date()
    } as CharacterRecord;
  }

  async getCharacter(id: string, sessionId: string): Promise<CharacterRecord | null> {
    console.log(`Mock: Getting character ${id} in session ${sessionId}`);
    return null;
  }
  
  async deleteCharacter(characterId: string, sessionId: string): Promise<void> {
    console.log(`Mock: Deleting character ${characterId} from session ${sessionId}`);
  }

  async getCharacterMemories(characterId: string, sessionId: string, limit: number = 50): Promise<CharacterMemoryRecord[]> {
    console.log(`Mock: Getting memories for character ${characterId}`);
    return [];
  }

  async getCharacterConversations(characterId: string, sessionId: string, limit: number = 50): Promise<ConversationRecord[]> {
    console.log(`Mock: Getting conversations for character ${characterId}`);
    return [];
  }

  async getCharacterRelationships(characterId: string, sessionId: string): Promise<CharacterRelationshipRecord[]> {
    console.log(`Mock: Getting relationships for character ${characterId}`);
    return [];
  }

  async getSessionCharacters(sessionId: string): Promise<CharacterRecord[]> {
    console.log(`Mock: Getting characters for session ${sessionId}`);
    return [];
  }

  // Memory management
  async storeMemory(memory: CharacterMemoryRecord): Promise<void> {
    console.log(`Mock: Storing memory for character ${memory.character_id}`);
  }
  
  async searchMemories(characterId: string, sessionId: string, query: string, limit: number = 50): Promise<CharacterMemoryRecord[]> {
    console.log(`Mock: Searching memories for character ${characterId} with query: ${query}`);
    return [];
  }
  
  async deleteMemory(memoryId: string): Promise<void> {
    console.log(`Mock: Deleting memory ${memoryId}`);
  }

  async updateCharacter(characterId: string, sessionId: string, updates: Partial<CharacterRecord>): Promise<void> {
    console.log(`Mock: Updating character ${characterId} in session ${sessionId}`);
  }

  async updateSession(sessionId: string, updates: any): Promise<void> {
    console.log(`Mock: Updating session ${sessionId}`);
  }

  // Conversation management
  async storeConversation(conversation: ConversationRecord): Promise<void> {
    console.log(`Mock: Storing conversation for session ${conversation.session_id}`);
  }
  
  async getConversationHistory(sessionId: string, limit: number = 50): Promise<ConversationRecord[]> {
    console.log(`Mock: Getting conversation history for session ${sessionId}`);
    return [];
  }
  
  // Relationship management
  async storeCharacterRelationship(relationship: CharacterRelationshipRecord): Promise<void> {
    console.log(`Mock: Storing relationship between ${relationship.character_id} and ${relationship.target_character_id}`);
  }
  
  async updateRelationshipStrength(characterId: string, targetCharacterId: string, sessionId: string, delta: number): Promise<void> {
    console.log(`Mock: Updating relationship strength by ${delta} between ${characterId} and ${targetCharacterId}`);
  }
  
  // Story event management
  async storeStoryEvent(event: StoryEventRecord): Promise<void> {
    console.log(`Mock: Storing story event: ${event.event_type}`);
  }
  
  async getStoryEventsByLocation(locationId: string, sessionId: string, limit: number = 50): Promise<StoryEventRecord[]> {
    console.log(`Mock: Getting story events for location ${locationId}`);
    return [];
  }

  async getStoryEvents(sessionId: string, limit: number = 50): Promise<StoryEventRecord[]> {
    console.log(`Mock: Getting story events for session ${sessionId}`);
    return [];
  }
  
  // Cache management
  async cacheGet(key: string): Promise<string | null> {
    console.log(`Mock: Getting cache key ${key}`);
    return null;
  }

  async cacheSet(key: string, value: string, ttl?: number): Promise<void> {
    console.log(`Mock: Setting cache key ${key} with TTL ${ttl}`);
  }

  async cacheDel(key: string): Promise<void> {
    console.log(`Mock: Deleting cache key ${key}`);
  }
  
  async cacheKeys(pattern: string): Promise<string[]> {
    console.log(`Mock: Getting cache keys matching pattern ${pattern}`);
    return [];
  }
  
  async cacheFlush(): Promise<void> {
    console.log('Mock: Flushing all cache');
  }
  
  // Game state queries
  async getGameState(sessionId: string): Promise<any> {
    console.log(`Mock: Getting game state for session ${sessionId}`);
    return null;
  }
  
  async setGameState(sessionId: string, gameState: any): Promise<void> {
    console.log(`Mock: Setting game state for session ${sessionId}`);
  }

  async getPlayerPreferences(playerId: string): Promise<any> {
    console.log(`Mock: Getting player preferences for ${playerId}`);
    return null;
  }
  
  async setPlayerPreferences(playerId: string, preferences: any): Promise<void> {
    console.log(`Mock: Setting player preferences for ${playerId}`);
  }
  
  // Batch operations
  async batchInsert<T extends DatabaseRecord>(tableName: string, records: T[]): Promise<void> {
    console.log(`Mock: Batch inserting ${records.length} records into ${tableName}`);
  }
  
  async batchUpdate<T extends DatabaseRecord>(tableName: string, updates: Array<{ id: string; data: Partial<T> }>): Promise<void> {
    console.log(`Mock: Batch updating ${updates.length} records in ${tableName}`);
  }
  
  // Analytics and statistics
  async getSessionStatistics(sessionId: string): Promise<any> {
    console.log(`Mock: Getting session statistics for ${sessionId}`);
    return {};
  }
  
  async getCharacterInteractionCount(characterId: string, sessionId: string): Promise<number> {
    console.log(`Mock: Getting interaction count for character ${characterId}`);
    return 0;
  }
  
  async getPopularLocations(sessionId: string, limit: number = 10): Promise<Array<{ location: string; visits: number }>> {
    console.log(`Mock: Getting popular locations for session ${sessionId}`);
    return [];
  }
}