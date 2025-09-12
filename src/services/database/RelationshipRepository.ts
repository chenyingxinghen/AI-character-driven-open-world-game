import { CharacterRelationshipRecord } from './DatabaseService';
import { BaseRepository } from './BaseRepository';
import { DatabaseService } from './DatabaseService';

export interface RelationshipRepository extends BaseRepository<CharacterRelationshipRecord> {
  findByCharacterAndSession(characterId: string, sessionId: string): Promise<CharacterRelationshipRecord[]>;
  findByCharacters(characterId: string, targetCharacterId: string, sessionId: string): Promise<CharacterRelationshipRecord | null>;
  findByType(characterId: string, sessionId: string, relationshipType: string): Promise<CharacterRelationshipRecord[]>;
  findStrongRelationships(characterId: string, sessionId: string, minStrength: number): Promise<CharacterRelationshipRecord[]>;
}

export class RelationshipRepositoryImpl implements RelationshipRepository {
  constructor(private databaseService: DatabaseService) {}

  async create(item: CharacterRelationshipRecord): Promise<CharacterRelationshipRecord> {
    await this.databaseService.storeCharacterRelationship(item);
    return item;
  }

  async findById(id: string): Promise<CharacterRelationshipRecord | null> {
    // This would require a specific query method in the database service
    throw new Error('Method not implemented in repository, use database service directly');
  }

  async update(id: string, item: Partial<CharacterRelationshipRecord>): Promise<void> {
    // Relationships can be updated by creating a new record with the same ID
    await this.databaseService.storeCharacterRelationship({ ...item, id } as CharacterRelationshipRecord);
  }

  async delete(id: string): Promise<void> {
    // In a real implementation, this would delete from the database
    throw new Error('Method not implemented in repository, use database service directly');
  }

  async findAll(): Promise<CharacterRelationshipRecord[]> {
    // This would require a specific query method in the database service
    throw new Error('Method not implemented in repository, use database service directly');
  }

  async findByCharacterAndSession(characterId: string, sessionId: string): Promise<CharacterRelationshipRecord[]> {
    return this.databaseService.getCharacterRelationships(characterId, sessionId);
  }

  async findByCharacters(characterId: string, targetCharacterId: string, sessionId: string): Promise<CharacterRelationshipRecord | null> {
    // In a real implementation, this would query by both character IDs
    // For now, we'll get relationships and filter in memory
    const relationships = await this.findByCharacterAndSession(characterId, sessionId);
    const relationship = relationships.find(rel => rel.target_character_id === targetCharacterId);
    return relationship || null;
  }

  async findByType(characterId: string, sessionId: string, relationshipType: string): Promise<CharacterRelationshipRecord[]> {
    // In a real implementation, this would query by relationship type
    // For now, we'll get relationships and filter in memory
    const relationships = await this.findByCharacterAndSession(characterId, sessionId);
    return relationships.filter(rel => rel.relationship_type === relationshipType);
  }

  async findStrongRelationships(characterId: string, sessionId: string, minStrength: number): Promise<CharacterRelationshipRecord[]> {
    // In a real implementation, this would query by strength
    // For now, we'll get relationships and filter in memory
    const relationships = await this.findByCharacterAndSession(characterId, sessionId);
    return relationships.filter(rel => rel.strength >= minStrength);
  }
}