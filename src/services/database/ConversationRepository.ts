import { ConversationRecord } from './DatabaseService';
import { BaseRepository } from './BaseRepository';
import { DatabaseService } from './DatabaseService';

export interface ConversationRepository extends BaseRepository<ConversationRecord> {
  findByCharacterAndSession(characterId: string, sessionId: string, limit?: number): Promise<ConversationRecord[]>;
  findBySessionId(sessionId: string, limit?: number): Promise<ConversationRecord[]>;
  findRecentConversations(characterId: string, sessionId: string, hours?: number): Promise<ConversationRecord[]>;
}

export class ConversationRepositoryImpl implements ConversationRepository {
  constructor(private databaseService: DatabaseService) {}

  async create(item: ConversationRecord): Promise<ConversationRecord> {
    await this.databaseService.storeConversation(item);
    return item;
  }

  async findById(id: string): Promise<ConversationRecord | null> {
    // This would require a specific query method in the database service
    throw new Error('Method not implemented in repository, use database service directly');
  }

  async update(id: string, item: Partial<ConversationRecord>): Promise<void> {
    // Conversations are typically immutable, so update might not be needed
    throw new Error('Conversations are typically immutable');
  }

  async delete(id: string): Promise<void> {
    // In a real implementation, this would delete from the database
    throw new Error('Method not implemented in repository, use database service directly');
  }

  async findAll(): Promise<ConversationRecord[]> {
    // This would require a specific query method in the database service
    throw new Error('Method not implemented in repository, use database service directly');
  }

  async findByCharacterAndSession(characterId: string, sessionId: string, limit: number = 50): Promise<ConversationRecord[]> {
    return this.databaseService.getCharacterConversations(characterId, sessionId, limit);
  }

  async findBySessionId(sessionId: string, limit: number = 100): Promise<ConversationRecord[]> {
    // This would require a specific query method in the database service
    // For now, we'll need to get session characters first and then get conversations for each
    const characters = await this.databaseService.getSessionCharacters(sessionId);
    const allConversations: ConversationRecord[] = [];
    
    for (const character of characters) {
      const conversations = await this.databaseService.getCharacterConversations(character.id, sessionId, Math.ceil(limit / characters.length));
      allConversations.push(...conversations);
    }
    
    // Sort by created_at and limit
    return allConversations
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  async findRecentConversations(characterId: string, sessionId: string, hours: number = 24): Promise<ConversationRecord[]> {
    // In a real implementation, this would query by time range
    // For now, we'll get recent conversations and filter in memory
    const conversations = await this.findByCharacterAndSession(characterId, sessionId, 100);
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return conversations.filter(conv => new Date(conv.created_at) > cutoffTime);
  }
}