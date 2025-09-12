import { StoryEventRecord } from './DatabaseService';
import { BaseRepository } from './BaseRepository';
import { DatabaseService } from './DatabaseService';

export interface StoryRepository extends BaseRepository<StoryEventRecord> {
  findBySessionId(sessionId: string, limit?: number): Promise<StoryEventRecord[]>;
  findByEventType(sessionId: string, eventType: string, limit?: number): Promise<StoryEventRecord[]>;
  findRecentEvents(sessionId: string, hours?: number): Promise<StoryEventRecord[]>;
}

export class StoryRepositoryImpl implements StoryRepository {
  constructor(private databaseService: DatabaseService) {}

  async create(item: StoryEventRecord): Promise<StoryEventRecord> {
    await this.databaseService.storeStoryEvent(item);
    return item;
  }

  async findById(id: string): Promise<StoryEventRecord | null> {
    // This would require a specific query method in the database service
    throw new Error('Method not implemented in repository, use database service directly');
  }

  async update(id: string, item: Partial<StoryEventRecord>): Promise<void> {
    // Story events are typically immutable, so update might not be needed
    throw new Error('Story events are typically immutable');
  }

  async delete(id: string): Promise<void> {
    // In a real implementation, this would delete from the database
    throw new Error('Method not implemented in repository, use database service directly');
  }

  async findAll(): Promise<StoryEventRecord[]> {
    // This would require a specific query method in the database service
    throw new Error('Method not implemented in repository, use database service directly');
  }

  async findBySessionId(sessionId: string, limit: number = 50): Promise<StoryEventRecord[]> {
    return this.databaseService.getStoryEvents(sessionId, limit);
  }

  async findByEventType(sessionId: string, eventType: string, limit: number = 50): Promise<StoryEventRecord[]> {
    // In a real implementation, this would query by event type
    // For now, we'll get all events and filter in memory
    const events = await this.findBySessionId(sessionId, limit * 2); // Get more to account for filtering
    return events.filter(event => event.event_type === eventType).slice(0, limit);
  }

  async findRecentEvents(sessionId: string, hours: number = 24): Promise<StoryEventRecord[]> {
    // In a real implementation, this would query by time range
    // For now, we'll get recent events and filter in memory
    const events = await this.findBySessionId(sessionId, 100);
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return events.filter(event => new Date(event.created_at) > cutoffTime);
  }
}