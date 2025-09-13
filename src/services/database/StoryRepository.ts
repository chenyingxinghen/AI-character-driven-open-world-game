import { StoryEventRecord } from './DatabaseService';
import { BaseRepository, AbstractBaseRepository, PaginationOptions, PaginatedResult } from './BaseRepository';
import { DatabaseService } from './DatabaseService';

export interface StoryRepository extends BaseRepository<StoryEventRecord> {
  // Story-specific query methods
  findBySessionId(sessionId: string, options?: PaginationOptions): Promise<PaginatedResult<StoryEventRecord>>;
  findByEventType(sessionId: string, eventType: string, options?: PaginationOptions): Promise<PaginatedResult<StoryEventRecord>>;
  findByLocation(sessionId: string, location: string, options?: PaginationOptions): Promise<PaginatedResult<StoryEventRecord>>;
  findByImpactLevel(sessionId: string, minImpactLevel: number, options?: PaginationOptions): Promise<PaginatedResult<StoryEventRecord>>;
  findRecentEvents(sessionId: string, hours?: number): Promise<StoryEventRecord[]>;
  findEventsInvolvingCharacter(sessionId: string, characterId: string, limit?: number): Promise<StoryEventRecord[]>;
  getEventsByTimeRange(sessionId: string, startDate: Date, endDate: Date, limit?: number): Promise<StoryEventRecord[]>;
  getStoryTimeline(sessionId: string): Promise<Array<{ date: string; events: StoryEventRecord[] }>>;
  getEventStatistics(sessionId: string): Promise<{ totalEvents: number; eventsByType: Record<string, number>; eventsByLocation: Record<string, number>; averageImpact: number }>;
}

export class StoryRepositoryImpl extends AbstractBaseRepository<StoryEventRecord> implements StoryRepository {
  constructor(databaseService: DatabaseService) {
    super(databaseService, 'story_events');
  }

  async findBySessionId(sessionId: string, options?: PaginationOptions): Promise<PaginatedResult<StoryEventRecord>> {
    return this.findWhere({ session_id: sessionId } as Partial<StoryEventRecord>, options);
  }

  async findByEventType(sessionId: string, eventType: string, options?: PaginationOptions): Promise<PaginatedResult<StoryEventRecord>> {
    const criteria = {
      session_id: sessionId,
      event_type: eventType
    } as Partial<StoryEventRecord>;
    
    return this.findWhere(criteria, options);
  }
  
  async findByLocation(sessionId: string, location: string, options?: PaginationOptions): Promise<PaginatedResult<StoryEventRecord>> {
    const criteria = {
      session_id: sessionId,
      location: location
    } as Partial<StoryEventRecord>;
    
    return this.findWhere(criteria, options);
  }
  
  async findByImpactLevel(sessionId: string, minImpactLevel: number, options?: PaginationOptions): Promise<PaginatedResult<StoryEventRecord>> {
    const { page = 1, limit = 50, sortBy = 'impact_level', sortOrder = 'DESC' } = options || {};
    const offset = (page - 1) * limit;
    
    const countSql = `
      SELECT COUNT(*) as count FROM story_events 
      WHERE session_id = $1 AND impact_level >= $2
    `;
    const countResult = await this.databaseService.query<{ count: string }>(countSql, [sessionId, minImpactLevel]);
    const total = parseInt(countResult[0].count);
    
    const dataSql = `
      SELECT * FROM story_events 
      WHERE session_id = $1 AND impact_level >= $2
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $3 OFFSET $4
    `;
    const data = await this.databaseService.query<StoryEventRecord>(dataSql, [sessionId, minImpactLevel, limit, offset]);
    
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findRecentEvents(sessionId: string, hours: number = 24): Promise<StoryEventRecord[]> {
    const sql = `
      SELECT * FROM story_events 
      WHERE session_id = $1 AND created_at >= NOW() - INTERVAL '${hours} hours'
      ORDER BY created_at DESC
    `;
    
    return await this.databaseService.query<StoryEventRecord>(sql, [sessionId]);
  }
  
  async findEventsInvolvingCharacter(sessionId: string, characterId: string, limit: number = 50): Promise<StoryEventRecord[]> {
    const sql = `
      SELECT * FROM story_events 
      WHERE session_id = $1 AND $2 = ANY(involved_characters)
      ORDER BY created_at DESC
      LIMIT $3
    `;
    
    return await this.databaseService.query<StoryEventRecord>(sql, [sessionId, characterId, limit]);
  }
  
  async getEventsByTimeRange(sessionId: string, startDate: Date, endDate: Date, limit: number = 100): Promise<StoryEventRecord[]> {
    const sql = `
      SELECT * FROM story_events 
      WHERE session_id = $1 AND created_at BETWEEN $2 AND $3
      ORDER BY created_at ASC
      LIMIT $4
    `;
    
    return await this.databaseService.query<StoryEventRecord>(sql, [sessionId, startDate, endDate, limit]);
  }
  
  async getStoryTimeline(sessionId: string): Promise<Array<{ date: string; events: StoryEventRecord[] }>> {
    const sql = `
      SELECT DATE(created_at) as date, array_agg(row_to_json(story_events.*)) as events
      FROM story_events 
      WHERE session_id = $1
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `;
    
    const result = await this.databaseService.query<{ date: string; events: StoryEventRecord[] }>(sql, [sessionId]);
    return result;
  }
  
  async getEventStatistics(sessionId: string): Promise<{ totalEvents: number; eventsByType: Record<string, number>; eventsByLocation: Record<string, number>; averageImpact: number }> {
    const totalSql = 'SELECT COUNT(*) as count FROM story_events WHERE session_id = $1';
    const typeSql = 'SELECT event_type, COUNT(*) as count FROM story_events WHERE session_id = $1 GROUP BY event_type';
    const locationSql = 'SELECT location, COUNT(*) as count FROM story_events WHERE session_id = $1 GROUP BY location';
    const impactSql = 'SELECT AVG(impact_level) as avg FROM story_events WHERE session_id = $1';
    
    const [totalResult, typeResult, locationResult, impactResult] = await Promise.all([
      this.databaseService.query<{ count: string }>(totalSql, [sessionId]),
      this.databaseService.query<{ event_type: string; count: string }>(typeSql, [sessionId]),
      this.databaseService.query<{ location: string; count: string }>(locationSql, [sessionId]),
      this.databaseService.query<{ avg: string }>(impactSql, [sessionId])
    ]);
    
    const eventsByType: Record<string, number> = {};
    typeResult.forEach(row => {
      eventsByType[row.event_type] = parseInt(row.count);
    });
    
    const eventsByLocation: Record<string, number> = {};
    locationResult.forEach(row => {
      eventsByLocation[row.location] = parseInt(row.count);
    });
    
    return {
      totalEvents: parseInt(totalResult[0].count),
      eventsByType,
      eventsByLocation,
      averageImpact: parseFloat(impactResult[0].avg) || 0
    };
  }
}