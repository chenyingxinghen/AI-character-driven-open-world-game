import { BaseRepository, AbstractBaseRepository, PaginationOptions, PaginatedResult } from './BaseRepository';
import { DatabaseService } from './DatabaseService';

export interface GameSessionRecord {
  id: string;
  player_id?: string;
  game_state?: any;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  last_activity?: Date;
  metadata?: any;
}

export interface SessionRepository extends BaseRepository<GameSessionRecord> {
  // Session-specific query methods
  findByPlayerId(playerId: string, options?: PaginationOptions): Promise<PaginatedResult<GameSessionRecord>>;
  findActiveSessions(options?: PaginationOptions): Promise<PaginatedResult<GameSessionRecord>>;
  findInactiveSessions(options?: PaginationOptions): Promise<PaginatedResult<GameSessionRecord>>;
  findRecentSessions(hours: number, options?: PaginationOptions): Promise<PaginatedResult<GameSessionRecord>>;
  findExpiredSessions(maxAgeHours: number): Promise<GameSessionRecord[]>;
  activateSession(sessionId: string): Promise<void>;
  deactivateSession(sessionId: string): Promise<void>;
  updateLastActivity(sessionId: string): Promise<void>;
  getSessionMetrics(): Promise<{ totalSessions: number; activeSessions: number; averageSessionDuration: number }>;
  cleanupExpiredSessions(maxAgeHours: number): Promise<number>;
}

export class SessionRepositoryImpl extends AbstractBaseRepository<GameSessionRecord> implements SessionRepository {
  constructor(databaseService: DatabaseService) {
    super(databaseService, 'game_sessions');
  }
  
  async create(item: Omit<GameSessionRecord, 'id' | 'created_at' | 'updated_at'>): Promise<GameSessionRecord> {
    const sessionData = {
      ...item,
      is_active: item.is_active ?? true,
      last_activity: new Date()
    };
    
    return super.create(sessionData);
  }

  async findByPlayerId(playerId: string, options?: PaginationOptions): Promise<PaginatedResult<GameSessionRecord>> {
    return this.findWhere({ player_id: playerId } as Partial<GameSessionRecord>, options);
  }
  
  async findActiveSessions(options?: PaginationOptions): Promise<PaginatedResult<GameSessionRecord>> {
    return this.findWhere({ is_active: true } as Partial<GameSessionRecord>, options);
  }
  
  async findInactiveSessions(options?: PaginationOptions): Promise<PaginatedResult<GameSessionRecord>> {
    return this.findWhere({ is_active: false } as Partial<GameSessionRecord>, options);
  }
  
  async findRecentSessions(hours: number, options?: PaginationOptions): Promise<PaginatedResult<GameSessionRecord>> {
    const { page = 1, limit = 50, sortBy = 'last_activity', sortOrder = 'DESC' } = options || {};
    const offset = (page - 1) * limit;
    
    const countSql = `
      SELECT COUNT(*) as count FROM game_sessions 
      WHERE last_activity >= NOW() - INTERVAL '${hours} hours'
    `;
    const countResult = await this.databaseService.query<{ count: string }>(countSql);
    const total = parseInt(countResult[0].count);
    
    const dataSql = `
      SELECT * FROM game_sessions 
      WHERE last_activity >= NOW() - INTERVAL '${hours} hours'
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $1 OFFSET $2
    `;
    const data = await this.databaseService.query<GameSessionRecord>(dataSql, [limit, offset]);
    
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
  
  async findExpiredSessions(maxAgeHours: number): Promise<GameSessionRecord[]> {
    const sql = `
      SELECT * FROM game_sessions 
      WHERE last_activity < NOW() - INTERVAL '${maxAgeHours} hours'
      ORDER BY last_activity ASC
    `;
    
    return await this.databaseService.query<GameSessionRecord>(sql);
  }
  
  async activateSession(sessionId: string): Promise<void> {
    const sql = `
      UPDATE game_sessions 
      SET is_active = true, last_activity = NOW(), updated_at = NOW()
      WHERE id = $1
    `;
    
    await this.databaseService.query(sql, [sessionId]);
  }
  
  async deactivateSession(sessionId: string): Promise<void> {
    const sql = `
      UPDATE game_sessions 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
    `;
    
    await this.databaseService.query(sql, [sessionId]);
  }
  
  async updateLastActivity(sessionId: string): Promise<void> {
    const sql = `
      UPDATE game_sessions 
      SET last_activity = NOW(), updated_at = NOW()
      WHERE id = $1
    `;
    
    await this.databaseService.query(sql, [sessionId]);
  }
  
  async getSessionMetrics(): Promise<{ totalSessions: number; activeSessions: number; averageSessionDuration: number }> {
    const totalSql = 'SELECT COUNT(*) as count FROM game_sessions';
    const activeSql = 'SELECT COUNT(*) as count FROM game_sessions WHERE is_active = true';
    const durationSql = `
      SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(last_activity, updated_at) - created_at))/3600) as avg_hours
      FROM game_sessions 
      WHERE last_activity IS NOT NULL
    `;
    
    const [totalResult, activeResult, durationResult] = await Promise.all([
      this.databaseService.query<{ count: string }>(totalSql),
      this.databaseService.query<{ count: string }>(activeSql),
      this.databaseService.query<{ avg_hours: string }>(durationSql)
    ]);
    
    return {
      totalSessions: parseInt(totalResult[0].count),
      activeSessions: parseInt(activeResult[0].count),
      averageSessionDuration: parseFloat(durationResult[0].avg_hours) || 0
    };
  }
  
  async cleanupExpiredSessions(maxAgeHours: number): Promise<number> {
    // First get the count of sessions to be deleted
    const countSql = `
      SELECT COUNT(*) as count FROM game_sessions 
      WHERE last_activity < NOW() - INTERVAL '${maxAgeHours} hours'
    `;
    const countResult = await this.databaseService.query<{ count: string }>(countSql);
    const expiredCount = parseInt(countResult[0].count);
    
    if (expiredCount > 0) {
      // Delete expired sessions and all related data using cascade
      const deleteSql = `
        DELETE FROM game_sessions 
        WHERE last_activity < NOW() - INTERVAL '${maxAgeHours} hours'
      `;
      await this.databaseService.query(deleteSql);
    }
    
    return expiredCount;
  }
}