import { CharacterMemoryRecord } from './DatabaseService';
import { BaseRepository, AbstractBaseRepository, PaginationOptions, PaginatedResult } from './BaseRepository';
import { DatabaseService } from './DatabaseService';

export interface MemoryRepository extends BaseRepository<CharacterMemoryRecord> {
  // Memory-specific query methods
  findByCharacterAndSession(characterId: string, sessionId: string, limit?: number): Promise<CharacterMemoryRecord[]>;
  findByCharacterAndType(characterId: string, sessionId: string, memoryType: string, options?: PaginationOptions): Promise<PaginatedResult<CharacterMemoryRecord>>;
  findByCharacterAndTag(characterId: string, sessionId: string, tag: string, options?: PaginationOptions): Promise<PaginatedResult<CharacterMemoryRecord>>;
  findSignificantMemories(characterId: string, sessionId: string, minSignificance: number, options?: PaginationOptions): Promise<PaginatedResult<CharacterMemoryRecord>>;
  searchMemories(characterId: string, sessionId: string, query: string, limit?: number): Promise<CharacterMemoryRecord[]>;
  findByEmotionalWeight(characterId: string, sessionId: string, minWeight: number, limit?: number): Promise<CharacterMemoryRecord[]>;
  findRecentMemories(characterId: string, sessionId: string, hours: number, limit?: number): Promise<CharacterMemoryRecord[]>;
  findAssociatedMemories(characterId: string, sessionId: string, associatedCharacterId: string, limit?: number): Promise<CharacterMemoryRecord[]>;
}

export class MemoryRepositoryImpl extends AbstractBaseRepository<CharacterMemoryRecord> implements MemoryRepository {
  constructor(databaseService: DatabaseService) {
    super(databaseService, 'character_memories');
  }

  async findByCharacterAndSession(characterId: string, sessionId: string, limit: number = 50): Promise<CharacterMemoryRecord[]> {
    return this.databaseService.getCharacterMemories(characterId, sessionId, limit);
  }

  async findByCharacterAndType(characterId: string, sessionId: string, memoryType: string, options?: PaginationOptions): Promise<PaginatedResult<CharacterMemoryRecord>> {
    const criteria = {
      character_id: characterId,
      session_id: sessionId,
      memory_type: memoryType
    } as Partial<CharacterMemoryRecord>;
    
    return this.findWhere(criteria, options);
  }

  async findByCharacterAndTag(characterId: string, sessionId: string, tag: string, options?: PaginationOptions): Promise<PaginatedResult<CharacterMemoryRecord>> {
    const { page = 1, limit = 50, sortBy = 'created_at', sortOrder = 'DESC' } = options || {};
    const offset = (page - 1) * limit;
    
    // Use SQL array operations to find memories with specific tags
    const countSql = `
      SELECT COUNT(*) as count FROM character_memories 
      WHERE character_id = $1 AND session_id = $2 AND $3 = ANY(tags)
    `;
    const countResult = await this.databaseService.query<{ count: string }>(countSql, [characterId, sessionId, tag]);
    const total = parseInt(countResult[0].count);
    
    const dataSql = `
      SELECT * FROM character_memories 
      WHERE character_id = $1 AND session_id = $2 AND $3 = ANY(tags)
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $4 OFFSET $5
    `;
    const data = await this.databaseService.query<CharacterMemoryRecord>(dataSql, [characterId, sessionId, tag, limit, offset]);
    
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findSignificantMemories(characterId: string, sessionId: string, minSignificance: number, options?: PaginationOptions): Promise<PaginatedResult<CharacterMemoryRecord>> {
    const { page = 1, limit = 50, sortBy = 'significance', sortOrder = 'DESC' } = options || {};
    const offset = (page - 1) * limit;
    
    const countSql = `
      SELECT COUNT(*) as count FROM character_memories 
      WHERE character_id = $1 AND session_id = $2 AND significance >= $3
    `;
    const countResult = await this.databaseService.query<{ count: string }>(countSql, [characterId, sessionId, minSignificance]);
    const total = parseInt(countResult[0].count);
    
    const dataSql = `
      SELECT * FROM character_memories 
      WHERE character_id = $1 AND session_id = $2 AND significance >= $3
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $4 OFFSET $5
    `;
    const data = await this.databaseService.query<CharacterMemoryRecord>(dataSql, [characterId, sessionId, minSignificance, limit, offset]);
    
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
  
  async searchMemories(characterId: string, sessionId: string, query: string, limit: number = 50): Promise<CharacterMemoryRecord[]> {
    return this.databaseService.searchMemories(characterId, sessionId, query, limit);
  }
  
  async findByEmotionalWeight(characterId: string, sessionId: string, minWeight: number, limit: number = 50): Promise<CharacterMemoryRecord[]> {
    const sql = `
      SELECT * FROM character_memories 
      WHERE character_id = $1 AND session_id = $2 AND emotional_weight >= $3
      ORDER BY emotional_weight DESC, created_at DESC
      LIMIT $4
    `;
    
    return await this.databaseService.query<CharacterMemoryRecord>(sql, [characterId, sessionId, minWeight, limit]);
  }
  
  async findRecentMemories(characterId: string, sessionId: string, hours: number, limit: number = 50): Promise<CharacterMemoryRecord[]> {
    const sql = `
      SELECT * FROM character_memories 
      WHERE character_id = $1 AND session_id = $2 
        AND created_at >= NOW() - INTERVAL '${hours} hours'
      ORDER BY created_at DESC
      LIMIT $3
    `;
    
    return await this.databaseService.query<CharacterMemoryRecord>(sql, [characterId, sessionId, limit]);
  }
  
  async findAssociatedMemories(characterId: string, sessionId: string, associatedCharacterId: string, limit: number = 50): Promise<CharacterMemoryRecord[]> {
    const sql = `
      SELECT * FROM character_memories 
      WHERE character_id = $1 AND session_id = $2 AND $3 = ANY(associated_characters)
      ORDER BY significance DESC, created_at DESC
      LIMIT $4
    `;
    
    return await this.databaseService.query<CharacterMemoryRecord>(sql, [characterId, sessionId, associatedCharacterId, limit]);
  }
}