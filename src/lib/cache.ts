import { redis, CacheManager } from './redis';
import { NextApiRequest, NextApiResponse } from 'next';

// Cache configuration
export const cacheConfig = {
  // TTL values in seconds
  ttl: {
    short: 300,        // 5 minutes
    medium: 3600,      // 1 hour
    long: 86400,       // 24 hours
    week: 604800,      // 7 days
    month: 2592000,    // 30 days
    year: 31536000,    // 1 year
  },

  // Cache keys
  keys: {
    user: (userId: string) => `user:${userId}`,
    userFiles: (userId: string) => `user_files:${userId}`,
    userSubscription: (userId: string) => `user_subscription:${userId}`,
    fileMetadata: (fileId: string) => `file_metadata:${fileId}`,
    processingQueue: 'processing_queue',
    analytics: (userId: string, period: string) => `analytics:${userId}:${period}`,
    apiKey: (keyHash: string) => `api_key:${keyHash}`,
    rateLimit: (identifier: string) => `rate_limit:${identifier}`,
  },

  // Cache strategies
  strategies: {
    // Write-through: Write to cache and database simultaneously
    writeThrough: 'write_through',
    
    // Write-behind: Write to cache immediately, database later
    writeBehind: 'write_behind',
    
    // Cache-aside: Application manages cache
    cacheAside: 'cache_aside',
    
    // Read-through: Cache loads data on miss
    readThrough: 'read_through',
  },
};

// Multi-level cache implementation
export class MultiLevelCache {
  private memoryCache: Map<string, { value: any; expires: number }> = new Map();
  private maxMemoryItems: number = 1000;

  // L1: Memory cache (fastest)
  private getFromMemory(key: string): any | null {
    const item = this.memoryCache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return item.value;
  }

  private setInMemory(key: string, value: any, ttlSeconds: number): void {
    // Cleanup if at capacity
    if (this.memoryCache.size >= this.maxMemoryItems) {
      const oldestKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(oldestKey);
    }
    
    this.memoryCache.set(key, {
      value,
      expires: Date.now() + (ttlSeconds * 1000),
    });
  }

  // L2: Redis cache (fast)
  private async getFromRedis(key: string): Promise<any | null> {
    return await CacheManager.get(key);
  }

  private async setInRedis(key: string, value: any, ttlSeconds: number): Promise<void> {
    await CacheManager.set(key, value, ttlSeconds);
  }

  // Get with multi-level fallback
  async get(key: string): Promise<any | null> {
    // Try L1 (memory) first
    let value = this.getFromMemory(key);
    if (value !== null) {
      return value;
    }

    // Try L2 (Redis)
    value = await this.getFromRedis(key);
    if (value !== null) {
      // Backfill L1 cache
      this.setInMemory(key, value, cacheConfig.ttl.short);
      return value;
    }

    return null;
  }

  // Set in all levels
  async set(key: string, value: any, ttlSeconds: number = cacheConfig.ttl.medium): Promise<void> {
    // Set in L1 (memory)
    this.setInMemory(key, value, Math.min(ttlSeconds, cacheConfig.ttl.short));
    
    // Set in L2 (Redis)
    await this.setInRedis(key, value, ttlSeconds);
  }

  // Delete from all levels
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    await CacheManager.del(key);
  }

  // Clear memory cache
  clearMemory(): void {
    this.memoryCache.clear();
  }

  // Get cache statistics
  getStats(): {
    memorySize: number;
    memoryCapacity: number;
    memoryHitRate: number;
  } {
    return {
      memorySize: this.memoryCache.size,
      memoryCapacity: this.maxMemoryItems,
      memoryHitRate: 0, // Would need hit tracking for accurate rate
    };
  }
}

// Cache instance
export const cache = new MultiLevelCache();

// Cache decorators and utilities
export class CacheUtils {
  // Memoize function results
  static memoize<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    keyGenerator: (...args: Parameters<T>) => string,
    ttlSeconds: number = cacheConfig.ttl.medium
  ): T {
    return (async (...args: Parameters<T>) => {
      const key = keyGenerator(...args);
      
      // Try cache first
      let result = await cache.get(key);
      if (result !== null) {
        return result;
      }
      
      // Execute function and cache result
      result = await fn(...args);
      await cache.set(key, result, ttlSeconds);
      
      return result;
    }) as T;
  }

  // Cache with automatic invalidation
  static async cacheWithInvalidation<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = cacheConfig.ttl.medium,
    invalidationKeys: string[] = []
  ): Promise<T> {
    // Check cache
    let result = await cache.get(key);
    if (result !== null) {
      return result;
    }

    // Fetch and cache
    result = await fetchFn();
    await cache.set(key, result, ttlSeconds);

    // Set up invalidation
    for (const invKey of invalidationKeys) {
      await CacheManager.set(`invalidation:${invKey}:${key}`, true, ttlSeconds);
    }

    return result;
  }

  // Invalidate cache by pattern
  static async invalidatePattern(pattern: string): Promise<void> {
    await CacheManager.clearPattern(pattern);
  }

  // Warm up cache
  static async warmUpCache(): Promise<void> {
    console.log('🔥 Warming up cache...');
    
    // Pre-load frequently accessed data
    // This would be customized based on your application's needs
    
    console.log('✅ Cache warm-up completed');
  }
}

// HTTP cache middleware
export function httpCacheMiddleware(
  ttlSeconds: number = cacheConfig.ttl.medium,
  varyHeaders: string[] = ['Accept-Encoding']
) {
  return (req: NextApiRequest, res: NextApiResponse, next: () => void) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key from URL and relevant headers
    const cacheKey = `http:${req.url}:${varyHeaders.map(h => req.headers[h.toLowerCase()]).join(':')}`;

    // Try to serve from cache
    cache.get(cacheKey).then(cachedResponse => {
      if (cachedResponse) {
        // Set cache headers
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
        
        // Send cached response
        res.status(cachedResponse.status).json(cachedResponse.data);
        return;
      }

      // Cache miss - continue to handler
      res.setHeader('X-Cache', 'MISS');
      
      // Intercept response to cache it
      const originalJson = res.json;
      res.json = function(data: any) {
        // Cache the response
        cache.set(cacheKey, {
          status: res.statusCode,
          data,
        }, ttlSeconds);
        
        // Set cache headers
        res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
        
        // Send response
        return originalJson.call(this, data);
      };

      next();
    }).catch(() => {
      // Cache error - continue without caching
      next();
    });
  };
}

// Smart cache invalidation
export class SmartCacheInvalidation {
  private static dependencies: Map<string, Set<string>> = new Map();

  // Register cache dependencies
  static addDependency(cacheKey: string, dependsOn: string[]): void {
    for (const dep of dependsOn) {
      if (!this.dependencies.has(dep)) {
        this.dependencies.set(dep, new Set());
      }
      this.dependencies.get(dep)!.add(cacheKey);
    }
  }

  // Invalidate cache and all dependents
  static async invalidate(key: string): Promise<void> {
    // Invalidate the key itself
    await cache.delete(key);

    // Invalidate all dependent keys
    const dependents = this.dependencies.get(key);
    if (dependents) {
      for (const dependent of dependents) {
        await cache.delete(dependent);
        // Recursively invalidate dependents
        await this.invalidate(dependent);
      }
    }
  }

  // Clear all dependencies
  static clearDependencies(): void {
    this.dependencies.clear();
  }
}

// Cache warming strategies
export class CacheWarming {
  private static warmingJobs: Map<string, NodeJS.Timeout> = new Map();

  // Schedule cache warming
  static scheduleWarming(
    key: string,
    fetchFn: () => Promise<any>,
    intervalMinutes: number = 30
  ): void {
    // Clear existing job
    const existingJob = this.warmingJobs.get(key);
    if (existingJob) {
      clearInterval(existingJob);
    }

    // Schedule new job
    const job = setInterval(async () => {
      try {
        const data = await fetchFn();
        await cache.set(key, data, cacheConfig.ttl.long);
        console.log(`🔥 Cache warmed for key: ${key}`);
      } catch (error) {
        console.error(`❌ Cache warming failed for key ${key}:`, error);
      }
    }, intervalMinutes * 60 * 1000);

    this.warmingJobs.set(key, job);
  }

  // Stop cache warming
  static stopWarming(key: string): void {
    const job = this.warmingJobs.get(key);
    if (job) {
      clearInterval(job);
      this.warmingJobs.delete(key);
    }
  }

  // Stop all warming jobs
  static stopAllWarming(): void {
    for (const [key, job] of this.warmingJobs) {
      clearInterval(job);
    }
    this.warmingJobs.clear();
  }
}

// Cache health monitoring
export class CacheHealthMonitor {
  private static metrics = {
    hits: 0,
    misses: 0,
    errors: 0,
    totalRequests: 0,
  };

  // Record cache hit
  static recordHit(): void {
    this.metrics.hits++;
    this.metrics.totalRequests++;
  }

  // Record cache miss
  static recordMiss(): void {
    this.metrics.misses++;
    this.metrics.totalRequests++;
  }

  // Record cache error
  static recordError(): void {
    this.metrics.errors++;
  }

  // Get cache statistics
  static getStats(): {
    hitRate: number;
    missRate: number;
    errorRate: number;
    totalRequests: number;
  } {
    const { hits, misses, errors, totalRequests } = this.metrics;
    
    return {
      hitRate: totalRequests > 0 ? hits / totalRequests : 0,
      missRate: totalRequests > 0 ? misses / totalRequests : 0,
      errorRate: totalRequests > 0 ? errors / totalRequests : 0,
      totalRequests,
    };
  }

  // Reset statistics
  static resetStats(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      totalRequests: 0,
    };
  }
}

export default cache;
