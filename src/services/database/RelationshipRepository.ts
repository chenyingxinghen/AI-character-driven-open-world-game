import { CharacterRelationshipRecord } from './DatabaseService';
import { BaseRepository, AbstractBaseRepository, PaginationOptions, PaginatedResult } from './BaseRepository';
import { DatabaseService } from './DatabaseService';

export interface RelationshipRepository extends BaseRepository<CharacterRelationshipRecord> {
  // Relationship-specific query methods
  findByCharacterAndSession(characterId: string, sessionId: string): Promise<CharacterRelationshipRecord[]>;
  findByCharacters(characterId: string, targetCharacterId: string, sessionId: string): Promise<CharacterRelationshipRecord | null>;
  findByType(characterId: string, sessionId: string, relationshipType: string, options?: PaginationOptions): Promise<PaginatedResult<CharacterRelationshipRecord>>;
  findStrongRelationships(characterId: string, sessionId: string, minStrength: number): Promise<CharacterRelationshipRecord[]>;
  findWeakRelationships(characterId: string, sessionId: string, maxStrength: number): Promise<CharacterRelationshipRecord[]>;
  findMutualRelationships(characterId: string, targetCharacterId: string, sessionId: string): Promise<CharacterRelationshipRecord[]>;
  updateStrength(characterId: string, targetCharacterId: string, sessionId: string, delta: number): Promise<void>;
  getRelationshipNetwork(characterId: string, sessionId: string, depth: number): Promise<any>;
  getRelationshipStatistics(characterId: string, sessionId: string): Promise<{ totalRelationships: number; averageStrength: number; relationshipsByType: Record<string, number> }>;
}

export class RelationshipRepositoryImpl extends AbstractBaseRepository<CharacterRelationshipRecord> implements RelationshipRepository {
  constructor(databaseService: DatabaseService) {
    super(databaseService, 'character_relationships');
  }

  async findByCharacterAndSession(characterId: string, sessionId: string): Promise<CharacterRelationshipRecord[]> {
    return this.databaseService.getCharacterRelationships(characterId, sessionId);
  }

  async findByCharacters(characterId: string, targetCharacterId: string, sessionId: string): Promise<CharacterRelationshipRecord | null> {
    const sql = `
      SELECT * FROM character_relationships 
      WHERE character_id = $1 AND target_character_id = $2 AND session_id = $3
      LIMIT 1
    `;
    
    const result = await this.databaseService.query<CharacterRelationshipRecord>(sql, [characterId, targetCharacterId, sessionId]);
    return result.length > 0 ? result[0] : null;
  }

  async findByType(characterId: string, sessionId: string, relationshipType: string, options?: PaginationOptions): Promise<PaginatedResult<CharacterRelationshipRecord>> {
    const criteria = {
      character_id: characterId,
      session_id: sessionId,
      relationship_type: relationshipType
    } as Partial<CharacterRelationshipRecord>;
    
    return this.findWhere(criteria, options);
  }

  async findStrongRelationships(characterId: string, sessionId: string, minStrength: number): Promise<CharacterRelationshipRecord[]> {
    const sql = `
      SELECT * FROM character_relationships 
      WHERE character_id = $1 AND session_id = $2 AND strength >= $3
      ORDER BY strength DESC
    `;
    
    return await this.databaseService.query<CharacterRelationshipRecord>(sql, [characterId, sessionId, minStrength]);
  }
  
  async findWeakRelationships(characterId: string, sessionId: string, maxStrength: number): Promise<CharacterRelationshipRecord[]> {
    const sql = `
      SELECT * FROM character_relationships 
      WHERE character_id = $1 AND session_id = $2 AND strength <= $3
      ORDER BY strength ASC
    `;
    
    return await this.databaseService.query<CharacterRelationshipRecord>(sql, [characterId, sessionId, maxStrength]);
  }
  
  async findMutualRelationships(characterId: string, targetCharacterId: string, sessionId: string): Promise<CharacterRelationshipRecord[]> {
    const sql = `
      SELECT * FROM character_relationships 
      WHERE session_id = $1 AND (
        (character_id = $2 AND target_character_id = $3) OR
        (character_id = $3 AND target_character_id = $2)
      )
    `;
    
    return await this.databaseService.query<CharacterRelationshipRecord>(sql, [sessionId, characterId, targetCharacterId]);
  }
  
  async updateStrength(characterId: string, targetCharacterId: string, sessionId: string, delta: number): Promise<void> {
    await this.databaseService.updateRelationshipStrength(characterId, targetCharacterId, sessionId, delta);
  }
  
  async getRelationshipNetwork(characterId: string, sessionId: string, depth: number): Promise<any> {
    // Build a relationship network up to specified depth
    const visited = new Set<string>();
    const network: any = {
      center: characterId,
      nodes: [],
      edges: []
    };
    
    const exploreLevel = async (currentCharacterId: string, currentDepth: number) => {
      if (currentDepth > depth || visited.has(currentCharacterId)) {
        return;
      }
      
      visited.add(currentCharacterId);
      const relationships = await this.findByCharacterAndSession(currentCharacterId, sessionId);
      
      for (const rel of relationships) {
        network.edges.push({
          from: rel.character_id,
          to: rel.target_character_id,
          type: rel.relationship_type,
          strength: rel.strength
        });
        
        if (!visited.has(rel.target_character_id)) {
          network.nodes.push(rel.target_character_id);
          if (currentDepth < depth) {
            await exploreLevel(rel.target_character_id, currentDepth + 1);
          }
        }
      }
    };
    
    await exploreLevel(characterId, 0);
    return network;
  }
  
  async getRelationshipStatistics(characterId: string, sessionId: string): Promise<{ totalRelationships: number; averageStrength: number; relationshipsByType: Record<string, number> }> {
    const totalSql = 'SELECT COUNT(*) as count FROM character_relationships WHERE character_id = $1 AND session_id = $2';
    const avgSql = 'SELECT AVG(strength) as avg FROM character_relationships WHERE character_id = $1 AND session_id = $2';
    const typeSql = 'SELECT relationship_type, COUNT(*) as count FROM character_relationships WHERE character_id = $1 AND session_id = $2 GROUP BY relationship_type';
    
    const [totalResult, avgResult, typeResult] = await Promise.all([
      this.databaseService.query<{ count: string }>(totalSql, [characterId, sessionId]),
      this.databaseService.query<{ avg: string }>(avgSql, [characterId, sessionId]),
      this.databaseService.query<{ relationship_type: string; count: string }>(typeSql, [characterId, sessionId])
    ]);
    
    const relationshipsByType: Record<string, number> = {};
    typeResult.forEach(row => {
      relationshipsByType[row.relationship_type] = parseInt(row.count);
    });
    
    return {
      totalRelationships: parseInt(totalResult[0].count),
      averageStrength: parseFloat(avgResult[0].avg) || 0,
      relationshipsByType
    };
  }
}