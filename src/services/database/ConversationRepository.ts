import { ConversationRecord } from './DatabaseService';
import { BaseRepository, AbstractBaseRepository, PaginationOptions, PaginatedResult } from './BaseRepository';
import { DatabaseService } from './DatabaseService';

export interface ConversationRepository extends BaseRepository<ConversationRecord> {
  // Conversation-specific query methods
  findByCharacterAndSession(characterId: string, sessionId: string, limit?: number): Promise<ConversationRecord[]>;
  findBySessionId(sessionId: string, options?: PaginationOptions): Promise<PaginatedResult<ConversationRecord>>;
  findByMessageType(sessionId: string, messageType: string, options?: PaginationOptions): Promise<PaginatedResult<ConversationRecord>>;
  findRecentConversations(characterId: string, sessionId: string, hours?: number): Promise<ConversationRecord[]>;
  findConversationHistory(sessionId: string, limit?: number): Promise<ConversationRecord[]>;
  searchConversations(sessionId: string, query: string, limit?: number): Promise<ConversationRecord[]>;
  getConversationStatistics(sessionId: string): Promise<{ totalMessages: number; messagesByType: Record<string, number>; uniqueCharacters: number }>;
}

export class ConversationRepositoryImpl extends AbstractBaseRepository<ConversationRecord> implements ConversationRepository {
  constructor(databaseService: DatabaseService) {
    super(databaseService, 'conversations');
  }

  async findByCharacterAndSession(characterId: string, sessionId: string, limit: number = 50): Promise<ConversationRecord[]> {
    return this.databaseService.getCharacterConversations(characterId, sessionId, limit);
  }

  async findBySessionId(sessionId: string, options?: PaginationOptions): Promise<PaginatedResult<ConversationRecord>> {
    return this.findWhere({ session_id: sessionId } as Partial<ConversationRecord>, options);
  }
  
  async findByMessageType(sessionId: string, messageType: string, options?: PaginationOptions): Promise<PaginatedResult<ConversationRecord>> {
    const criteria = {
      session_id: sessionId,
      message_type: messageType
    } as Partial<ConversationRecord>;
    
    return this.findWhere(criteria, options);
  }

  async findRecentConversations(characterId: string, sessionId: string, hours: number = 24): Promise<ConversationRecord[]> {
    const sql = `
      SELECT * FROM conversations 
      WHERE character_id = $1 AND session_id = $2 
        AND created_at >= NOW() - INTERVAL '${hours} hours'
      ORDER BY created_at DESC
    `;
    
    return await this.databaseService.query<ConversationRecord>(sql, [characterId, sessionId]);
  }
  
  async findConversationHistory(sessionId: string, limit: number = 100): Promise<ConversationRecord[]> {
    return this.databaseService.getConversationHistory(sessionId, limit);
  }
  
  async searchConversations(sessionId: string, query: string, limit: number = 50): Promise<ConversationRecord[]> {
    const sql = `
      SELECT * FROM conversations 
      WHERE session_id = $1 AND content ILIKE $2
      ORDER BY created_at DESC
      LIMIT $3
    `;
    
    return await this.databaseService.query<ConversationRecord>(sql, [sessionId, `%${query}%`, limit]);
  }
  
  async getConversationStatistics(sessionId: string): Promise<{ totalMessages: number; messagesByType: Record<string, number>; uniqueCharacters: number }> {
    const totalSql = 'SELECT COUNT(*) as count FROM conversations WHERE session_id = $1';
    const typeSql = 'SELECT message_type, COUNT(*) as count FROM conversations WHERE session_id = $1 GROUP BY message_type';
    const charactersSql = 'SELECT COUNT(DISTINCT character_id) as count FROM conversations WHERE session_id = $1 AND character_id IS NOT NULL';
    
    const [totalResult, typeResult, charactersResult] = await Promise.all([
      this.databaseService.query<{ count: string }>(totalSql, [sessionId]),
      this.databaseService.query<{ message_type: string; count: string }>(typeSql, [sessionId]),
      this.databaseService.query<{ count: string }>(charactersSql, [sessionId])
    ]);
    
    const messagesByType: Record<string, number> = {};
    typeResult.forEach(row => {
      messagesByType[row.message_type] = parseInt(row.count);
    });
    
    return {
      totalMessages: parseInt(totalResult[0].count),
      messagesByType,
      uniqueCharacters: parseInt(charactersResult[0].count)
    };
  }
}