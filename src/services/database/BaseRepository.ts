export interface BaseRepository<T> {
  create(item: T): Promise<T>;
  findById(id: string): Promise<T | null>;
  update(id: string, item: Partial<T>): Promise<void>;
  delete(id: string): Promise<void>;
  findAll(): Promise<T[]>;
}