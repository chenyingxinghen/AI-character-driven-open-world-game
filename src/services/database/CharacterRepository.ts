import { CharacterRecord } from './DatabaseService';
import { BaseRepository, AbstractBaseRepository, PaginationOptions, PaginatedResult } from './BaseRepository';
import { DatabaseService } from './DatabaseService';

export interface CharacterRepository extends BaseRepository<CharacterRecord> {
  // Character-specific query methods
  findBySessionId(sessionId: string, options?: PaginationOptions): Promise<PaginatedResult<CharacterRecord>>;
  findByName(name: string, sessionId?: string): Promise<CharacterRecord[]>;
  findByLocation(location: string, sessionId: string): Promise<CharacterRecord[]>;
  findActiveInSession(sessionId: string): Promise<CharacterRecord[]>;
  updateLocation(characterId: string, sessionId: string, newLocation: string): Promise<void>;
  updateEmotionalState(characterId: string, sessionId: string, emotionalState: any): Promise<void>;
  deactivateCharacter(characterId: string, sessionId: string): Promise<void>;
  activateCharacter(characterId: string, sessionId: string): Promise<void>;
}

export class CharacterRepositoryImpl extends AbstractBaseRepository<CharacterRecord> implements CharacterRepository {
  constructor(databaseService: DatabaseService) {
    super(databaseService, 'characters');
  }

  async findBySessionId(sessionId: string, options?: PaginationOptions): Promise<PaginatedResult<CharacterRecord>> {
    return this.findWhere({ session_id: sessionId } as Partial<CharacterRecord>, options);
  }

  async findByName(name: string, sessionId?: string): Promise<CharacterRecord[]> {
    let sql = 'SELECT * FROM characters WHERE name ILIKE $1';
    let params: any[] = [`%${name}%`];
    
    if (sessionId) {
      sql += ' AND session_id = $2';
      params.push(sessionId);
    }
    
    return await this.databaseService.query<CharacterRecord>(sql, params);
  }
  
  async findByLocation(location: string, sessionId: string): Promise<CharacterRecord[]> {
    const sql = `
      SELECT * FROM characters 
      WHERE current_location = $1 AND session_id = $2 AND is_active = true
    `;
    
    return await this.databaseService.query<CharacterRecord>(sql, [location, sessionId]);
  }
  
  async findActiveInSession(sessionId: string): Promise<CharacterRecord[]> {
    const sql = `
      SELECT * FROM characters 
      WHERE session_id = $1 AND is_active = true
      ORDER BY created_at ASC
    `;
    
    return await this.databaseService.query<CharacterRecord>(sql, [sessionId]);
  }
  
  async updateLocation(characterId: string, sessionId: string, newLocation: string): Promise<void> {
    const sql = `
      UPDATE characters 
      SET current_location = $3, updated_at = NOW()
      WHERE id = $1 AND session_id = $2
    `;
    
    await this.databaseService.query(sql, [characterId, sessionId, newLocation]);
  }
  
  async updateEmotionalState(characterId: string, sessionId: string, emotionalState: any): Promise<void> {
    const sql = `
      UPDATE characters 
      SET emotional_state = $3, updated_at = NOW()
      WHERE id = $1 AND session_id = $2
    `;
    
    await this.databaseService.query(sql, [characterId, sessionId, emotionalState]);
  }
  
  async deactivateCharacter(characterId: string, sessionId: string): Promise<void> {
    const sql = `
      UPDATE characters 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND session_id = $2
    `;
    
    await this.databaseService.query(sql, [characterId, sessionId]);
  }
  
  async activateCharacter(characterId: string, sessionId: string): Promise<void> {
    const sql = `
      UPDATE characters 
      SET is_active = true, updated_at = NOW()
      WHERE id = $1 AND session_id = $2
    `;
    
    await this.databaseService.query(sql, [characterId, sessionId]);
  }
}