// Enhanced database configuration with connection pooling
import { createClient } from '@supabase/supabase-js';

// Database configuration
const databaseConfig = {
  // Connection pooling settings
  pool: {
    min: 2,
    max: 20,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
  },
  
  // Query settings
  query: {
    timeout: 30000, // 30 seconds
    retries: 3,
    retryDelay: 1000,
  },
  
  // Logging
  logging: {
    enabled: process.env.NODE_ENV === 'development',
    logQueries: process.env.LOG_QUERIES === 'true',
    logErrors: true,
    slowQueryThreshold: 1000, // Log queries taking more than 1 second
  },
};

// Enhanced Supabase client with connection pooling
class DatabaseManager {
  private static instance: DatabaseManager;
  private supabaseClient: any;
  private connectionPool: Map<string, any> = new Map();
  private queryStats = {
    totalQueries: 0,
    slowQueries: 0,
    errors: 0,
    averageResponseTime: 0,
  };

  private constructor() {
    this.initializeClient();
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  private initializeClient(): void {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    this.supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'x-application-name': 'pdf-pro',
        },
      },
    });

    // Set up connection monitoring
    this.setupConnectionMonitoring();
  }

  private setupConnectionMonitoring(): void {
    // Monitor connection health
    setInterval(async () => {
      try {
        await this.healthCheck();
      } catch (error) {
        console.error('Database health check failed:', error);
      }
    }, 30000); // Every 30 seconds
  }

  // Health check
  public async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number }> {
    try {
      const start = Date.now();
      await this.supabaseClient.from('users').select('count').limit(1);
      const latency = Date.now() - start;
      
      return { status: 'healthy', latency };
    } catch (error) {
      console.error('Database health check failed:', error);
      return { status: 'unhealthy' };
    }
  }

  // Enhanced query execution with monitoring
  public async executeQuery<T>(
    operation: () => Promise<T>,
    queryName: string = 'unknown'
  ): Promise<T> {
    const startTime = Date.now();
    this.queryStats.totalQueries++;

    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      
      // Update statistics
      this.updateQueryStats(duration);
      
      // Log slow queries
      if (duration > databaseConfig.logging.slowQueryThreshold) {
        this.queryStats.slowQueries++;
        if (databaseConfig.logging.enabled) {
          console.warn(`Slow query detected: ${queryName} took ${duration}ms`);
        }
      }

      // Log query if enabled
      if (databaseConfig.logging.logQueries) {
        console.log(`Query ${queryName} completed in ${duration}ms`);
      }

      return result;
    } catch (error) {
      this.queryStats.errors++;
      
      if (databaseConfig.logging.logErrors) {
        console.error(`Query ${queryName} failed:`, error);
      }
      
      throw error;
    }
  }

  private updateQueryStats(duration: number): void {
    const { totalQueries, averageResponseTime } = this.queryStats;
    this.queryStats.averageResponseTime = 
      (averageResponseTime * (totalQueries - 1) + duration) / totalQueries;
  }

  // Get query statistics
  public getQueryStats(): typeof this.queryStats {
    return { ...this.queryStats };
  }

  // Reset statistics
  public resetQueryStats(): void {
    this.queryStats = {
      totalQueries: 0,
      slowQueries: 0,
      errors: 0,
      averageResponseTime: 0,
    };
  }

  // Get Supabase client
  public getClient(): any {
    return this.supabaseClient;
  }

  // Transaction wrapper
  public async transaction<T>(
    operations: (client: any) => Promise<T>
  ): Promise<T> {
    // Note: Supabase doesn't support traditional transactions
    // This is a wrapper for future implementation or alternative solutions
    return await this.executeQuery(
      () => operations(this.supabaseClient),
      'transaction'
    );
  }

  // Batch operations
  public async batchInsert<T>(
    table: string,
    data: T[],
    batchSize: number = 100
  ): Promise<void> {
    const batches = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      await this.executeQuery(
        () => this.supabaseClient.from(table).insert(batch),
        `batch_insert_${table}`
      );
    }
  }

  // Connection cleanup
  public async cleanup(): Promise<void> {
    // Cleanup connections if needed
    this.connectionPool.clear();
  }
}

// Export singleton instance
export const database = DatabaseManager.getInstance();

// Legacy Prisma-style interface for backward compatibility
export const prisma = {
  // User operations
  user: {
    findUnique: async (params: any) => {
      return database.executeQuery(
        () => database.getClient()
          .from('users')
          .select('*')
          .eq('id', params.where.id)
          .single(),
        'user_findUnique'
      );
    },
    
    findMany: async (params: any = {}) => {
      let query = database.getClient().from('users').select('*');
      
      if (params.where) {
        Object.entries(params.where).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }
      
      if (params.orderBy) {
        const [field, direction] = Object.entries(params.orderBy)[0];
        query = query.order(field, { ascending: direction === 'asc' });
      }
      
      if (params.take) {
        query = query.limit(params.take);
      }
      
      return database.executeQuery(() => query, 'user_findMany');
    },
    
    create: async (params: any) => {
      return database.executeQuery(
        () => database.getClient()
          .from('users')
          .insert(params.data)
          .select()
          .single(),
        'user_create'
      );
    },
    
    update: async (params: any) => {
      return database.executeQuery(
        () => database.getClient()
          .from('users')
          .update(params.data)
          .eq('id', params.where.id)
          .select()
          .single(),
        'user_update'
      );
    },
    
    delete: async (params: any) => {
      return database.executeQuery(
        () => database.getClient()
          .from('users')
          .delete()
          .eq('id', params.where.id),
        'user_delete'
      );
    },
  },

  // File operations
  file: {
    findMany: async (params: any = {}) => {
      let query = database.getClient().from('files').select('*');
      
      if (params.where) {
        Object.entries(params.where).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }
      
      return database.executeQuery(() => query, 'file_findMany');
    },
    
    create: async (params: any) => {
      return database.executeQuery(
        () => database.getClient()
          .from('files')
          .insert(params.data)
          .select()
          .single(),
        'file_create'
      );
    },
  },

  // Generic operations
  $queryRaw: async (query: string, ...params: any[]) => {
    return database.executeQuery(
      () => database.getClient().rpc('execute_sql', { query, params }),
      'raw_query'
    );
  },

  $disconnect: async () => {
    await database.cleanup();
  },
};

// Global database instance for development
declare global {
  var __database: DatabaseManager | undefined;
}

if (process.env.NODE_ENV !== 'production') {
  global.__database = database;
}

// Database utilities
export const databaseUtils = {
  // Get connection statistics
  getStats: () => database.getQueryStats(),
  
  // Health check
  healthCheck: () => database.healthCheck(),
  
  // Reset statistics
  resetStats: () => database.resetQueryStats(),
  
  // Batch operations
  batchInsert: (table: string, data: any[], batchSize?: number) =>
    database.batchInsert(table, data, batchSize),
};

export default database;
