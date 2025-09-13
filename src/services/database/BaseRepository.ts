import { DatabaseService } from './DatabaseService';

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BaseRepository<T> {
  // Basic CRUD operations
  create(item: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T>;
  findById(id: string): Promise<T | null>;
  update(id: string, updates: Partial<T>): Promise<void>;
  delete(id: string): Promise<void>;
  
  // Batch operations
  createMany(items: Array<Omit<T, 'id' | 'created_at' | 'updated_at'>>): Promise<T[]>;
  updateMany(updates: Array<{ id: string; data: Partial<T> }>): Promise<void>;
  deleteMany(ids: string[]): Promise<void>;
  
  // Query operations
  findAll(options?: PaginationOptions): Promise<PaginatedResult<T>>;
  findByIds(ids: string[]): Promise<T[]>;
  findWhere(criteria: Partial<T>, options?: PaginationOptions): Promise<PaginatedResult<T>>;
  
  // Count operations
  count(criteria?: Partial<T>): Promise<number>;
  exists(id: string): Promise<boolean>;
  
  // Soft delete (if supported)
  softDelete?(id: string): Promise<void>;
  restore?(id: string): Promise<void>;
  findActive?(options?: PaginationOptions): Promise<PaginatedResult<T>>;
}

export abstract class AbstractBaseRepository<T extends { id: string; created_at?: Date; updated_at?: Date }> implements BaseRepository<T> {
  protected tableName: string;
  protected primaryKey: string = 'id';
  
  constructor(
    protected databaseService: DatabaseService, // Use proper interface
    tableName: string
  ) {
    this.tableName = tableName;
  }
  
  async create(item: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> {
    const id = this.generateId();
    const now = new Date();
    const fullItem = {
      ...item,
      id,
      created_at: now,
      updated_at: now
    } as T;
    
    const fields = Object.keys(fullItem).join(', ');
    const placeholders = Object.keys(fullItem).map((_, i) => `$${i + 1}`).join(', ');
    const values = Object.values(fullItem);
    
    const sql = `
      INSERT INTO ${this.tableName} (${fields})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    const result = await this.databaseService.query<T>(sql, values);
    return result[0];
  }
  
  async findById(id: string): Promise<T | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = $1`;
    const result = await this.databaseService.query<T>(sql, [id]);
    return result.length > 0 ? result[0] : null;
  }
  
  async update(id: string, updates: Partial<T>): Promise<void> {
    const updateFields = Object.keys(updates)
      .filter(key => key !== this.primaryKey && key !== 'created_at')
      .map((key, i) => `${key} = $${i + 2}`)
      .join(', ');
    
    if (updateFields.length === 0) {
      return;
    }
    
    const values = [id, ...Object.keys(updates)
      .filter(key => key !== this.primaryKey && key !== 'created_at')
      .map(key => (updates as any)[key])];
    
    const sql = `
      UPDATE ${this.tableName} 
      SET ${updateFields}, updated_at = NOW()
      WHERE ${this.primaryKey} = $1
    `;
    
    await this.databaseService.query(sql, values);
  }
  
  async delete(id: string): Promise<void> {
    const sql = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = $1`;
    await this.databaseService.query(sql, [id]);
  }
  
  async createMany(items: Array<Omit<T, 'id' | 'created_at' | 'updated_at'>>): Promise<T[]> {
    if (items.length === 0) {
      return [];
    }
    
    const enrichedItems = items.map(item => ({
      ...item,
      id: this.generateId(),
      created_at: new Date(),
      updated_at: new Date()
    })) as T[];
    
    await this.databaseService.batchInsert(this.tableName, enrichedItems as any);
    return enrichedItems;
  }
  
  async updateMany(updates: Array<{ id: string; data: Partial<T> }>): Promise<void> {
    if (updates.length === 0) {
      return;
    }
    
    await this.databaseService.batchUpdate(this.tableName, updates);
  }
  
  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} IN (${placeholders})`;
    await this.databaseService.query(sql, ids);
  }
  
  async findAll(options?: PaginationOptions): Promise<PaginatedResult<T>> {
    const { page = 1, limit = 50, sortBy = this.primaryKey, sortOrder = 'ASC' } = options || {};
    const offset = (page - 1) * limit;
    
    // Get total count
    const countSql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const countResult = await this.databaseService.query<{ count: string }>(countSql);
    const total = parseInt(countResult[0].count);
    
    // Get paginated data
    const dataSql = `
      SELECT * FROM ${this.tableName}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $1 OFFSET $2
    `;
    const data = await this.databaseService.query<T>(dataSql, [limit, offset]);
    
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
  
  async findByIds(ids: string[]): Promise<T[]> {
    if (ids.length === 0) {
      return [];
    }
    
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} IN (${placeholders})`;
    return await this.databaseService.query<T>(sql, ids);
  }
  
  async findWhere(criteria: Partial<T>, options?: PaginationOptions): Promise<PaginatedResult<T>> {
    const { page = 1, limit = 50, sortBy = this.primaryKey, sortOrder = 'ASC' } = options || {};
    const offset = (page - 1) * limit;
    
    const whereClause = Object.keys(criteria)
      .map((key, i) => `${key} = $${i + 1}`)
      .join(' AND ');
    const values = Object.values(criteria);
    
    // Get total count
    const countSql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${whereClause}`;
    const countResult = await this.databaseService.query<{ count: string }>(countSql, values);
    const total = parseInt(countResult[0].count);
    
    // Get paginated data
    const dataSql = `
      SELECT * FROM ${this.tableName}
      WHERE ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;
    const data = await this.databaseService.query<T>(dataSql, [...values, limit, offset]);
    
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
  
  async count(criteria?: Partial<T>): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    let values: any[] = [];
    
    if (criteria && Object.keys(criteria).length > 0) {
      const whereClause = Object.keys(criteria)
        .map((key, i) => `${key} = $${i + 1}`)
        .join(' AND ');
      sql += ` WHERE ${whereClause}`;
      values = Object.values(criteria);
    }
    
    const result = await this.databaseService.query<{ count: string }>(sql, values);
    return parseInt(result[0].count);
  }
  
  async exists(id: string): Promise<boolean> {
    const sql = `SELECT 1 FROM ${this.tableName} WHERE ${this.primaryKey} = $1 LIMIT 1`;
    const result = await this.databaseService.query(sql, [id]);
    return result.length > 0;
  }
  
  protected generateId(): string {
    // Simple UUID v4 generation - in production, use proper UUID library
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}