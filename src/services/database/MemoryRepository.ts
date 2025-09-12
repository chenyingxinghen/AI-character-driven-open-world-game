import { CharacterMemoryRecord } from './DatabaseService';
import { BaseRepository } from './BaseRepository';
import { DatabaseService } from './DatabaseService';

export interface MemoryRepository extends BaseRepository<CharacterMemoryRecord> {
  findByCharacterAndSession(characterId: string, sessionId: string, limit?: number): Promise<CharacterMemoryRecord[]>;
  findByCharacterAndType(characterId: string, sessionId: string, memoryType: string, limit?: number): Promise<CharacterMemoryRecord[]>;
  findByCharacterAndTag(characterId: string, sessionId: string, tag: string, limit?: number): Promise<CharacterMemoryRecord[]>;
  findSignificantMemories(characterId: string, sessionId: string, minSignificance: number, limit?: number): Promise<CharacterMemoryRecord[]>;
}

export class MemoryRepositoryImpl implements MemoryRepository {
  constructor(private databaseService: DatabaseService) {}

  async create(item: CharacterMemoryRecord): Promise<CharacterMemoryRecord> {
    await this.databaseService.storeMemory(item);
    return item;
  }

  async findById(id: string): Promise<CharacterMemoryRecord | null> {
    // This would require a specific query method in the database service
    throw new Error('Method not implemented in repository, use database service directly');
  }

  async update(id: string, item: Partial<CharacterMemoryRecord>): Promise<void> {
    // Memories are typically immutable, so update might not be needed
    throw new Error('Memories are typically immutable');
  }

  async delete(id: string): Promise<void> {
    // In a real implementation, this would delete from the database
    throw new Error('Method not implemented in repository, use database service directly');
  }

  async findAll(): Promise<CharacterMemoryRecord[]> {
    // This would require a specific query method in the database service
    throw new Error('Method not implemented in repository, use database service directly');
  }

  async findByCharacterAndSession(characterId: string, sessionId: string, limit: number = 50): Promise<CharacterMemoryRecord[]> {
    return this.databaseService.getCharacterMemories(characterId, sessionId, limit);
  }

  async findByCharacterAndType(characterId: string, sessionId: string, memoryType: string, limit: number = 50): Promise<CharacterMemoryRecord[]> {
    // In a real implementation, this would query by memory type
    // For now, we'll get memories and filter in memory
    const memories = await this.findByCharacterAndSession(characterId, sessionId, limit * 2); // Get more to account for filtering
    return memories.filter(memory => memory.memory_type === memoryType).slice(0, limit);
  }

  async findByCharacterAndTag(characterId: string, sessionId: string, tag: string, limit: number = 50): Promise<CharacterMemoryRecord[]> {
    // In a real implementation, this would query by tag
    // For now, we'll get memories and filter in memory
    const memories = await this.findByCharacterAndSession(characterId, sessionId, limit * 3); // Get more to account for filtering
    return memories.filter(memory => memory.tags.includes(tag)).slice(0, limit);
  }

  async findSignificantMemories(characterId: string, sessionId: string, minSignificance: number, limit: number = 50): Promise<CharacterMemoryRecord[]> {
    // In a real implementation, this would query by significance
    // For now, we'll get memories and filter in memory
    const memories = await this.findByCharacterAndSession(characterId, sessionId, limit * 2); // Get more to account for filtering
    return memories.filter(memory => memory.significance >= minSignificance).slice(0, limit);
  }
}