import Redis from 'ioredis';

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 10000,
  commandTimeout: 5000,
  family: 4, // IPv4
};

// Create Redis instances
export const redis = new Redis(redisConfig);
export const redisSubscriber = new Redis(redisConfig);
export const redisPublisher = new Redis(redisConfig);

// Redis connection event handlers
redis.on('connect', () => {
  console.log('✅ Redis connected');
});

redis.on('error', (error) => {
  console.error('❌ Redis connection error:', error);
});

redis.on('close', () => {
  console.log('🔌 Redis connection closed');
});

// Session management utilities
export class SessionManager {
  private static readonly SESSION_PREFIX = 'session:';
  private static readonly USER_SESSIONS_PREFIX = 'user_sessions:';
  private static readonly SESSION_TTL = 24 * 60 * 60; // 24 hours

  // Store session data
  static async setSession(sessionId: string, data: any, ttl: number = this.SESSION_TTL): Promise<void> {
    const key = this.SESSION_PREFIX + sessionId;
    await redis.setex(key, ttl, JSON.stringify(data));
    
    // Track user sessions for concurrent session management
    if (data.userId) {
      await this.addUserSession(data.userId, sessionId);
    }
  }

  // Get session data
  static async getSession(sessionId: string): Promise<any | null> {
    const key = this.SESSION_PREFIX + sessionId;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  // Delete session
  static async deleteSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    const key = this.SESSION_PREFIX + sessionId;
    await redis.del(key);
    
    // Remove from user sessions
    if (session?.userId) {
      await this.removeUserSession(session.userId, sessionId);
    }
  }

  // Update session TTL
  static async refreshSession(sessionId: string, ttl: number = this.SESSION_TTL): Promise<void> {
    const key = this.SESSION_PREFIX + sessionId;
    await redis.expire(key, ttl);
  }

  // Add session to user's session list
  private static async addUserSession(userId: string, sessionId: string): Promise<void> {
    const key = this.USER_SESSIONS_PREFIX + userId;
    await redis.sadd(key, sessionId);
    await redis.expire(key, this.SESSION_TTL);
  }

  // Remove session from user's session list
  private static async removeUserSession(userId: string, sessionId: string): Promise<void> {
    const key = this.USER_SESSIONS_PREFIX + userId;
    await redis.srem(key, sessionId);
  }

  // Get all sessions for a user
  static async getUserSessions(userId: string): Promise<string[]> {
    const key = this.USER_SESSIONS_PREFIX + userId;
    return await redis.smembers(key);
  }

  // Invalidate all sessions for a user
  static async invalidateUserSessions(userId: string): Promise<void> {
    const sessions = await this.getUserSessions(userId);
    const pipeline = redis.pipeline();
    
    sessions.forEach(sessionId => {
      pipeline.del(this.SESSION_PREFIX + sessionId);
    });
    
    pipeline.del(this.USER_SESSIONS_PREFIX + userId);
    await pipeline.exec();
  }

  // Clean up expired sessions
  static async cleanupExpiredSessions(): Promise<number> {
    const pattern = this.SESSION_PREFIX + '*';
    const keys = await redis.keys(pattern);
    let cleaned = 0;
    
    for (const key of keys) {
      const ttl = await redis.ttl(key);
      if (ttl === -1) { // No expiration set
        await redis.expire(key, this.SESSION_TTL);
      } else if (ttl === -2) { // Key doesn't exist
        cleaned++;
      }
    }
    
    return cleaned;
  }
}

// Cache management utilities
export class CacheManager {
  private static readonly CACHE_PREFIX = 'cache:';
  private static readonly DEFAULT_TTL = 60 * 60; // 1 hour

  // Set cache with TTL
  static async set(key: string, value: any, ttl: number = this.DEFAULT_TTL): Promise<void> {
    const cacheKey = this.CACHE_PREFIX + key;
    await redis.setex(cacheKey, ttl, JSON.stringify(value));
  }

  // Get from cache
  static async get(key: string): Promise<any | null> {
    const cacheKey = this.CACHE_PREFIX + key;
    const data = await redis.get(cacheKey);
    return data ? JSON.parse(data) : null;
  }

  // Delete from cache
  static async del(key: string): Promise<void> {
    const cacheKey = this.CACHE_PREFIX + key;
    await redis.del(cacheKey);
  }

  // Check if key exists
  static async exists(key: string): Promise<boolean> {
    const cacheKey = this.CACHE_PREFIX + key;
    return (await redis.exists(cacheKey)) === 1;
  }

  // Increment counter
  static async incr(key: string, ttl?: number): Promise<number> {
    const cacheKey = this.CACHE_PREFIX + key;
    const value = await redis.incr(cacheKey);
    
    if (ttl && value === 1) {
      await redis.expire(cacheKey, ttl);
    }
    
    return value;
  }

  // Set with pattern-based expiration
  static async setWithPattern(pattern: string, key: string, value: any, ttl: number = this.DEFAULT_TTL): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}${pattern}:${key}`;
    await redis.setex(cacheKey, ttl, JSON.stringify(value));
  }

  // Get all keys matching pattern
  static async getByPattern(pattern: string): Promise<Record<string, any>> {
    const searchPattern = `${this.CACHE_PREFIX}${pattern}:*`;
    const keys = await redis.keys(searchPattern);
    const result: Record<string, any> = {};
    
    if (keys.length > 0) {
      const values = await redis.mget(keys);
      keys.forEach((key, index) => {
        const shortKey = key.replace(`${this.CACHE_PREFIX}${pattern}:`, '');
        result[shortKey] = values[index] ? JSON.parse(values[index]!) : null;
      });
    }
    
    return result;
  }

  // Clear all cache with pattern
  static async clearPattern(pattern: string): Promise<number> {
    const searchPattern = `${this.CACHE_PREFIX}${pattern}:*`;
    const keys = await redis.keys(searchPattern);
    
    if (keys.length > 0) {
      return await redis.del(...keys);
    }
    
    return 0;
  }
}

// Rate limiting utilities
export class RateLimiter {
  private static readonly RATE_LIMIT_PREFIX = 'rate_limit:';

  // Check and increment rate limit
  static async checkLimit(
    identifier: string,
    limit: number,
    windowSeconds: number,
    cost: number = 1
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = this.RATE_LIMIT_PREFIX + identifier;
    const now = Math.floor(Date.now() / 1000);
    const window = Math.floor(now / windowSeconds) * windowSeconds;
    const windowKey = `${key}:${window}`;
    
    const pipeline = redis.pipeline();
    pipeline.multi();
    pipeline.incrby(windowKey, cost);
    pipeline.expire(windowKey, windowSeconds);
    pipeline.exec();
    
    const results = await pipeline.exec();
    const current = results?.[1]?.[1] as number || 0;
    
    const allowed = current <= limit;
    const remaining = Math.max(0, limit - current);
    const resetTime = window + windowSeconds;
    
    return { allowed, remaining, resetTime };
  }

  // Get current usage
  static async getCurrentUsage(identifier: string, windowSeconds: number): Promise<number> {
    const key = this.RATE_LIMIT_PREFIX + identifier;
    const now = Math.floor(Date.now() / 1000);
    const window = Math.floor(now / windowSeconds) * windowSeconds;
    const windowKey = `${key}:${window}`;
    
    const current = await redis.get(windowKey);
    return current ? parseInt(current) : 0;
  }
}

// Processing queue utilities
export class ProcessingQueue {
  private static readonly QUEUE_PREFIX = 'queue:';
  private static readonly PROCESSING_PREFIX = 'processing:';

  // Add job to queue
  static async addJob(queueName: string, jobData: any, priority: number = 0): Promise<string> {
    const jobId = `job:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    const job = {
      id: jobId,
      data: jobData,
      priority,
      createdAt: new Date().toISOString(),
    };
    
    const queueKey = this.QUEUE_PREFIX + queueName;
    await redis.zadd(queueKey, priority, JSON.stringify(job));
    
    return jobId;
  }

  // Get next job from queue
  static async getNextJob(queueName: string): Promise<any | null> {
    const queueKey = this.QUEUE_PREFIX + queueName;
    const jobs = await redis.zrevrange(queueKey, 0, 0);
    
    if (jobs.length === 0) {
      return null;
    }
    
    const job = JSON.parse(jobs[0]);
    await redis.zrem(queueKey, jobs[0]);
    
    // Move to processing
    const processingKey = this.PROCESSING_PREFIX + queueName;
    await redis.setex(processingKey + ':' + job.id, 300, JSON.stringify(job)); // 5 min timeout
    
    return job;
  }

  // Mark job as completed
  static async completeJob(queueName: string, jobId: string): Promise<void> {
    const processingKey = this.PROCESSING_PREFIX + queueName + ':' + jobId;
    await redis.del(processingKey);
  }

  // Get queue length
  static async getQueueLength(queueName: string): Promise<number> {
    const queueKey = this.QUEUE_PREFIX + queueName;
    return await redis.zcard(queueKey);
  }
}

// Health check
export async function checkRedisHealth(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number }> {
  try {
    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;
    
    return { status: 'healthy', latency };
  } catch (error) {
    console.error('Redis health check failed:', error);
    return { status: 'unhealthy' };
  }
}

// Graceful shutdown
export async function closeRedisConnections(): Promise<void> {
  await Promise.all([
    redis.disconnect(),
    redisSubscriber.disconnect(),
    redisPublisher.disconnect(),
  ]);
}

export default redis;
