import { BaseRepository } from './BaseRepository';
import { DatabaseService } from './DatabaseService';

export interface SessionRepository extends BaseRepository<any> {
  createSession(sessionId: string, playerId?: string, gameState?: any): Promise<void>;
  getSession(sessionId: string): Promise<any>;
  updateSession(sessionId: string, updates: any): Promise<void>;
}

export class SessionRepositoryImpl implements SessionRepository {
  constructor(private databaseService: DatabaseService) {}

  async create(item: any): Promise<any> {
    // This would require a specific implementation
    throw new Error('Use createSession method instead');
  }

  async findById(id: string): Promise<any | null> {
    return this.getSession(id);
  }

  async update(id: string, item: Partial<any>): Promise<void> {
    return this.updateSession(id, item);
  }

  async delete(id: string): Promise<void> {
    // In a real implementation, this would delete from the database
    throw new Error('Method not implemented in repository, use database service directly');
  }

  async findAll(): Promise<any[]> {
    // This would require a specific query method in the database service
    throw new Error('Method not implemented in repository, use database service directly');
  }

  async createSession(sessionId: string, playerId?: string, gameState?: any): Promise<void> {
    return this.databaseService.createSession(sessionId, playerId, gameState);
  }

  async getSession(sessionId: string): Promise<any> {
    return this.databaseService.getSession(sessionId);
  }

  async updateSession(sessionId: string, updates: any): Promise<void> {
    return this.databaseService.updateSession(sessionId, updates);
  }
}