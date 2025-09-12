export type ServiceIdentifier<T> = string | symbol | Function;

export interface ServiceMetadata<T> {
  id: ServiceIdentifier<T>;
  type: 'singleton' | 'transient';
  factory: () => T;
}

export class DependencyInjectionContainer {
  private services = new Map<ServiceIdentifier<any>, any>();
  private serviceMetadata = new Map<ServiceIdentifier<any>, ServiceMetadata<any>>();

  register<T>(id: ServiceIdentifier<T>, factory: () => T, type: 'singleton' | 'transient' = 'singleton'): void {
    this.serviceMetadata.set(id, { id, factory, type });
  }

  resolve<T>(id: ServiceIdentifier<T>): T {
    const metadata = this.serviceMetadata.get(id);
    if (!metadata) {
      throw new Error(`Service ${String(id)} is not registered`);
    }

    if (metadata.type === 'singleton') {
      if (!this.services.has(id)) {
        this.services.set(id, metadata.factory());
      }
      return this.services.get(id);
    } else {
      return metadata.factory();
    }
  }

  clear(): void {
    this.services.clear();
  }
}

// 创建全局容器实例
export const container = new DependencyInjectionContainer();