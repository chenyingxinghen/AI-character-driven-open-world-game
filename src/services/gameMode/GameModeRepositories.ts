/**
 * 游戏模式存储库
 * 负责游戏模式相关数据的持久化操作
 */

import { Logger } from '../../services/Logger';
import { DatabaseService } from '../../services/database/DatabaseService';
import { BaseRepository, AbstractBaseRepository } from '../../services/database/BaseRepository';
import {
  GameModeType,
  ModeConfig,
  StoryOutline,
  DeviationRecord,
  InterventionRecord
} from '../../domains/gameMode/valueObjects';
import { GameSession, StoryProgress, DirectorController } from '../../domains/gameMode/entities';

/**
 * 游戏模式会话存储库
 */
export class GameModeSessionRepository extends AbstractBaseRepository<any> {
  constructor(
    protected databaseService: DatabaseService,
    protected logger: Logger
  ) {
    super(databaseService, 'game_mode_sessions');
  }

  /**
   * 创建游戏模式会话
   */
  async createGameModeSession(session: GameSession): Promise<void> {
    const query = `
      INSERT INTO game_mode_sessions (
        id, session_id, mode_type, config, state, player_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    const values = [
      session.id,
      session.id, // 使用相同的ID作为外键
      session.getConfig().mode,
      JSON.stringify(session.getConfig()),
      JSON.stringify(session.getState()),
      session.playerId,
      session.createdAt,
      new Date()
    ];

    try {
      await this.databaseService.query(query, values);
      this.logger.info('Game mode session created', {
        sessionId: session.id,
        mode: session.getConfig().mode,
        component: 'GameModeSessionRepository'
      });
    } catch (error) {
      this.logger.error('Failed to create game mode session', error as Error, {
        sessionId: session.id,
        component: 'GameModeSessionRepository'
      });
      throw error;
    }
  }

  /**
   * 更新游戏模式会话
   */
  async updateGameModeSession(sessionId: string, updates: {
    config?: ModeConfig;
    state?: any;
    updated_at?: Date;
  }): Promise<void> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.config) {
      setClauses.push(`config = $${paramIndex++}`);
      values.push(JSON.stringify(updates.config));
    }

    if (updates.state) {
      setClauses.push(`state = $${paramIndex++}`);
      values.push(JSON.stringify(updates.state));
    }

    setClauses.push(`updated_at = $${paramIndex++}`);
    values.push(updates.updated_at || new Date());

    values.push(sessionId);

    const query = `
      UPDATE game_mode_sessions 
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
    `;

    try {
      await this.databaseService.query(query, values);
      this.logger.debug('Game mode session updated', {
        sessionId,
        component: 'GameModeSessionRepository'
      });
    } catch (error) {
      this.logger.error('Failed to update game mode session', error as Error, {
        sessionId,
        component: 'GameModeSessionRepository'
      });
      throw error;
    }
  }

  /**
   * 获取游戏模式会话
   */
  async getGameModeSession(sessionId: string): Promise<any | null> {
    const query = `
      SELECT * FROM game_mode_sessions 
      WHERE id = $1
    `;

    try {
      const result = await this.databaseService.query<any>(query, [sessionId]);
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      this.logger.error('Failed to get game mode session', error as Error, {
        sessionId,
        component: 'GameModeSessionRepository'
      });
      return null;
    }
  }

  /**
   * 删除游戏模式会话
   */
  async deleteGameModeSession(sessionId: string): Promise<void> {
    const query = `DELETE FROM game_mode_sessions WHERE id = $1`;

    try {
      await this.databaseService.query(query, [sessionId]);
      this.logger.info('Game mode session deleted', {
        sessionId,
        component: 'GameModeSessionRepository'
      });
    } catch (error) {
      this.logger.error('Failed to delete game mode session', error as Error, {
        sessionId,
        component: 'GameModeSessionRepository'
      });
      throw error;
    }
  }

  /**
   * 获取玩家的游戏模式会话
   */
  async getPlayerGameModeSessions(playerId: string, limit: number = 10): Promise<any[]> {
    const query = `
      SELECT * FROM game_mode_sessions 
      WHERE player_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;

    try {
      return await this.databaseService.query<any>(query, [playerId, limit]);
    } catch (error) {
      this.logger.error('Failed to get player game mode sessions', error as Error, {
        playerId,
        component: 'GameModeSessionRepository'
      });
      return [];
    }
  }
}

/**
 * 故事大纲存储库
 */
export class StoryOutlineRepository extends AbstractBaseRepository<any> {
  constructor(
    protected databaseService: DatabaseService,
    protected logger: Logger
  ) {
    super(databaseService, 'story_outlines');
  }

  /**
   * 创建故事大纲
   */
  async createStoryOutline(outline: StoryOutline): Promise<void> {
    const query = `
      INSERT INTO story_outlines (
        id, title, genre, summary, acts, characters, locations, 
        themes, estimated_duration, tags, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `;

    const values = [
      outline.id,
      outline.title,
      outline.genre,
      outline.summary,
      JSON.stringify(outline.acts),
      JSON.stringify(outline.characters),
      JSON.stringify(outline.locations),
      outline.themes,
      outline.estimatedDuration,
      outline.tags,
      new Date(),
      new Date()
    ];

    try {
      await this.databaseService.query(query, values);
      this.logger.info('Story outline created', {
        outlineId: outline.id,
        title: outline.title,
        component: 'StoryOutlineRepository'
      });
    } catch (error) {
      this.logger.error('Failed to create story outline', error as Error, {
        outlineId: outline.id,
        component: 'StoryOutlineRepository'
      });
      throw error;
    }
  }

  /**
   * 获取故事大纲
   */
  async getStoryOutline(outlineId: string): Promise<StoryOutline | null> {
    const query = `SELECT * FROM story_outlines WHERE id = $1`;

    try {
      const result = await this.databaseService.query<any>(query, [outlineId]);
      if (result.length === 0) return null;

      const row = result[0];
      return {
        id: row.id,
        title: row.title,
        genre: row.genre,
        summary: row.summary,
        acts: JSON.parse(row.acts),
        characters: JSON.parse(row.characters),
        locations: JSON.parse(row.locations),
        themes: row.themes,
        estimatedDuration: row.estimated_duration,
        tags: row.tags
      };
    } catch (error) {
      this.logger.error('Failed to get story outline', error as Error, {
        outlineId,
        component: 'StoryOutlineRepository'
      });
      return null;
    }
  }

  /**
   * 获取按类型分类的故事大纲
   */
  async getStoryOutlinesByGenre(genre: string, limit: number = 10): Promise<StoryOutline[]> {
    const query = `
      SELECT * FROM story_outlines 
      WHERE genre = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;

    try {
      const results = await this.databaseService.query<any>(query, [genre, limit]);
      return results.map((row: any) => ({
        id: row.id,
        title: row.title,
        genre: row.genre,
        summary: row.summary,
        acts: JSON.parse(row.acts),
        characters: JSON.parse(row.characters),
        locations: JSON.parse(row.locations),
        themes: row.themes,
        estimatedDuration: row.estimated_duration,
        tags: row.tags
      }));
    } catch (error) {
      this.logger.error('Failed to get story outlines by genre', error as Error, {
        genre,
        component: 'StoryOutlineRepository'
      });
      return [];
    }
  }

  /**
   * 搜索故事大纲
   */
  async searchStoryOutlines(searchTerm: string, limit: number = 20): Promise<StoryOutline[]> {
    const query = `
      SELECT * FROM story_outlines 
      WHERE title ILIKE $1 OR summary ILIKE $1 OR $2 = ANY(tags)
      ORDER BY created_at DESC 
      LIMIT $3
    `;

    const searchPattern = `%${searchTerm}%`;

    try {
      const results = await this.databaseService.query<any>(query, [searchPattern, searchTerm, limit]);
      return results.map((row: any) => ({
        id: row.id,
        title: row.title,
        genre: row.genre,
        summary: row.summary,
        acts: JSON.parse(row.acts),
        characters: JSON.parse(row.characters),
        locations: JSON.parse(row.locations),
        themes: row.themes,
        estimatedDuration: row.estimated_duration,
        tags: row.tags
      }));
    } catch (error) {
      this.logger.error('Failed to search story outlines', error as Error, {
        searchTerm,
        component: 'StoryOutlineRepository'
      });
      return [];
    }
  }
}

/**
 * 故事进展存储库
 */
export class StoryProgressRepository extends AbstractBaseRepository<any> {
  constructor(
    protected databaseService: DatabaseService,
    protected logger: Logger
  ) {
    super(databaseService, 'story_progress');
  }

  /**
   * 创建故事进展记录
   */
  async createStoryProgress(progress: StoryProgress): Promise<void> {
    const query = `
      INSERT INTO story_progress (
        id, session_id, story_outline_id, current_act, completed_plot_points,
        completion_percentage, story_variables, started_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    const values = [
      progress.id,
      progress.sessionId,
      progress.storyOutline.id,
      progress.getCurrentAct(),
      progress.getCompletedPlotPoints(),
      progress.getCompletionPercentage(),
      JSON.stringify(Array.from(progress['storyVariables'] || new Map())),
      progress.startedAt,
      new Date()
    ];

    try {
      await this.databaseService.query(query, values);
      this.logger.info('Story progress created', {
        progressId: progress.id,
        sessionId: progress.sessionId,
        component: 'StoryProgressRepository'
      });
    } catch (error) {
      this.logger.error('Failed to create story progress', error as Error, {
        progressId: progress.id,
        component: 'StoryProgressRepository'
      });
      throw error;
    }
  }

  /**
   * 更新故事进展
   */
  async updateStoryProgress(progressId: string, updates: {
    current_act?: number;
    completed_plot_points?: string[];
    completion_percentage?: number;
    story_variables?: any;
  }): Promise<void> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.current_act !== undefined) {
      setClauses.push(`current_act = $${paramIndex++}`);
      values.push(updates.current_act);
    }

    if (updates.completed_plot_points) {
      setClauses.push(`completed_plot_points = $${paramIndex++}`);
      values.push(updates.completed_plot_points);
    }

    if (updates.completion_percentage !== undefined) {
      setClauses.push(`completion_percentage = $${paramIndex++}`);
      values.push(updates.completion_percentage);
    }

    if (updates.story_variables) {
      setClauses.push(`story_variables = $${paramIndex++}`);
      values.push(JSON.stringify(updates.story_variables));
    }

    setClauses.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());

    values.push(progressId);

    const query = `
      UPDATE story_progress 
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
    `;

    try {
      await this.databaseService.query(query, values);
      this.logger.debug('Story progress updated', {
        progressId,
        component: 'StoryProgressRepository'
      });
    } catch (error) {
      this.logger.error('Failed to update story progress', error as Error, {
        progressId,
        component: 'StoryProgressRepository'
      });
      throw error;
    }
  }

  /**
   * 获取会话的故事进展
   */
  async getStoryProgressBySession(sessionId: string): Promise<any | null> {
    const query = `
      SELECT sp.*, so.* FROM story_progress sp
      JOIN story_outlines so ON sp.story_outline_id = so.id
      WHERE sp.session_id = $1
    `;

    try {
      const result = await this.databaseService.query<any>(query, [sessionId]);
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      this.logger.error('Failed to get story progress by session', error as Error, {
        sessionId,
        component: 'StoryProgressRepository'
      });
      return null;
    }
  }
}

/**
 * 偏离记录存储库
 */
export class DeviationRecordRepository extends AbstractBaseRepository<any> {
  constructor(
    protected databaseService: DatabaseService,
    protected logger: Logger
  ) {
    super(databaseService, 'deviation_records');
  }

  /**
   * 创建偏离记录
   */
  async createDeviationRecord(sessionId: string, record: DeviationRecord): Promise<void> {
    const query = `
      INSERT INTO deviation_records (
        id, session_id, player_action, expected_action, deviation_score,
        current_plot_point, impact, description, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    const values = [
      record.id,
      sessionId,
      record.playerAction,
      record.expectedAction,
      record.deviationScore,
      record.currentPlotPoint,
      record.impact,
      record.description,
      record.timestamp
    ];

    try {
      await this.databaseService.query(query, values);
    } catch (error) {
      this.logger.error('Failed to create deviation record', error as Error);
      throw error;
    }
  }

  /**
   * 获取会话的偏离记录
   */
  async getDeviationRecords(sessionId: string, limit: number = 50): Promise<DeviationRecord[]> {
    const query = `
      SELECT * FROM deviation_records 
      WHERE session_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;

    try {
      const results = await this.databaseService.query<any>(query, [sessionId, limit]);
      return results.map((row: any) => ({
        id: row.id,
        timestamp: row.created_at,
        playerAction: row.player_action,
        expectedAction: row.expected_action,
        deviationScore: row.deviation_score,
        currentPlotPoint: row.current_plot_point,
        impact: row.impact,
        description: row.description
      }));
    } catch (error) {
      this.logger.error('Failed to get deviation records', error as Error);
      return [];
    }
  }
}

/**
 * 干预记录存储库
 */
export class InterventionRecordRepository extends AbstractBaseRepository<any> {
  constructor(
    protected databaseService: DatabaseService,
    protected logger: Logger
  ) {
    super(databaseService, 'intervention_records');
  }

  /**
   * 创建干预记录
   */
  async createInterventionRecord(sessionId: string, record: InterventionRecord): Promise<void> {
    const query = `
      INSERT INTO intervention_records (
        id, session_id, intervention_type, intensity, trigger_reason,
        outcome, effectiveness, player_reaction, notes, applied_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;

    const values = [
      record.id,
      sessionId,
      record.interventionType,
      record.intensity,
      record.trigger,
      record.outcome,
      record.effectiveness,
      record.playerReaction,
      record.notes,
      record.timestamp
    ];

    try {
      await this.databaseService.query(query, values);
    } catch (error) {
      this.logger.error('Failed to create intervention record', error as Error);
      throw error;
    }
  }

  /**
   * 获取会话的干预记录
   */
  async getInterventionRecords(sessionId: string, limit: number = 50): Promise<InterventionRecord[]> {
    const query = `
      SELECT * FROM intervention_records 
      WHERE session_id = $1 
      ORDER BY applied_at DESC 
      LIMIT $2
    `;

    try {
      const results = await this.databaseService.query<any>(query, [sessionId, limit]);
      return results.map((row: any) => ({
        id: row.id,
        timestamp: row.applied_at,
        interventionType: row.intervention_type,
        intensity: row.intensity,
        trigger: row.trigger_reason,
        outcome: row.outcome,
        effectiveness: row.effectiveness,
        playerReaction: row.player_reaction,
        notes: row.notes
      }));
    } catch (error) {
      this.logger.error('Failed to get intervention records', error as Error);
      return [];
    }
  }

  /**
   * 获取干预统计
   */
  async getInterventionStatistics(sessionId: string): Promise<{
    totalInterventions: number;
    successfulInterventions: number;
    averageEffectiveness: number;
    interventionsByType: Record<string, number>;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_interventions,
        COUNT(CASE WHEN outcome = 'successful' THEN 1 END) as successful_interventions,
        AVG(effectiveness) as average_effectiveness,
        intervention_type,
        COUNT(*) as type_count
      FROM intervention_records 
      WHERE session_id = $1
      GROUP BY intervention_type
    `;

    try {
      const results = await this.databaseService.query<any>(query, [sessionId]);
      
      const stats = {
        totalInterventions: 0,
        successfulInterventions: 0,
        averageEffectiveness: 0,
        interventionsByType: {} as Record<string, number>
      };

      if (results.length > 0) {
        stats.totalInterventions = parseInt(results[0].total_interventions) || 0;
        stats.successfulInterventions = parseInt(results[0].successful_interventions) || 0;
        stats.averageEffectiveness = parseFloat(results[0].average_effectiveness) || 0;
        
        results.forEach((row: any) => {
          stats.interventionsByType[row.intervention_type] = parseInt(row.type_count) || 0;
        });
      }

      return stats;
    } catch (error) {
      this.logger.error('Failed to get intervention statistics', error as Error);
      return {
        totalInterventions: 0,
        successfulInterventions: 0,
        averageEffectiveness: 0,
        interventionsByType: {}
      };
    }
  }
}