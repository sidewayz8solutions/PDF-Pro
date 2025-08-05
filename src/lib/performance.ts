import { performance, PerformanceObserver } from 'perf_hooks';
import { redis } from './redis';

// Performance monitoring configuration
export const performanceConfig = {
  // Metrics collection
  metrics: {
    enabled: true,
    sampleRate: 1.0, // Collect 100% of metrics (adjust for production)
    bufferSize: 1000,
    flushInterval: 30000, // 30 seconds
  },

  // Thresholds for alerts
  thresholds: {
    responseTime: 2000, // 2 seconds
    memoryUsage: 0.8, // 80% of available memory
    cpuUsage: 0.8, // 80% CPU usage
    errorRate: 0.05, // 5% error rate
  },

  // Performance budgets
  budgets: {
    pageLoad: 3000, // 3 seconds
    apiResponse: 1000, // 1 second
    pdfProcessing: 30000, // 30 seconds
    fileUpload: 60000, // 1 minute
  },
};

// Performance metrics collector
export class PerformanceCollector {
  private static metrics: Map<string, any[]> = new Map();
  private static observer: PerformanceObserver | null = null;

  // Initialize performance monitoring
  static initialize(): void {
    if (this.observer) return;

    // Create performance observer
    this.observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        this.recordMetric('performance', {
          name: entry.name,
          type: entry.entryType,
          startTime: entry.startTime,
          duration: entry.duration,
          timestamp: Date.now(),
        });
      }
    });

    // Observe different types of performance entries
    this.observer.observe({ entryTypes: ['measure', 'navigation', 'resource'] });

    // Start periodic system metrics collection
    this.startSystemMetricsCollection();

    console.log('📊 Performance monitoring initialized');
  }

  // Record custom metric
  static recordMetric(category: string, data: any): void {
    if (!performanceConfig.metrics.enabled) return;

    // Sample based on sample rate
    if (Math.random() > performanceConfig.metrics.sampleRate) return;

    if (!this.metrics.has(category)) {
      this.metrics.set(category, []);
    }

    const metrics = this.metrics.get(category)!;
    metrics.push({
      ...data,
      timestamp: Date.now(),
    });

    // Maintain buffer size
    if (metrics.length > performanceConfig.metrics.bufferSize) {
      metrics.shift();
    }

    // Check thresholds
    this.checkThresholds(category, data);
  }

  // Start system metrics collection
  private static startSystemMetricsCollection(): void {
    setInterval(() => {
      this.collectSystemMetrics();
    }, 10000); // Every 10 seconds
  }

  // Collect system metrics
  private static collectSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.recordMetric('system', {
      memory: {
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers,
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      uptime: process.uptime(),
    });
  }

  // Check performance thresholds
  private static checkThresholds(category: string, data: any): void {
    const { thresholds } = performanceConfig;

    // Response time threshold
    if (data.duration && data.duration > thresholds.responseTime) {
      this.recordAlert('response_time', {
        category,
        duration: data.duration,
        threshold: thresholds.responseTime,
        data,
      });
    }

    // Memory usage threshold
    if (data.memory?.heapUsed) {
      const memoryUsageRatio = data.memory.heapUsed / data.memory.heapTotal;
      if (memoryUsageRatio > thresholds.memoryUsage) {
        this.recordAlert('memory_usage', {
          usage: memoryUsageRatio,
          threshold: thresholds.memoryUsage,
          data,
        });
      }
    }
  }

  // Record performance alert
  private static recordAlert(type: string, data: any): void {
    console.warn(`⚠️ Performance alert: ${type}`, data);
    
    // Store alert in Redis for monitoring dashboard
    redis.lpush('performance_alerts', JSON.stringify({
      type,
      data,
      timestamp: Date.now(),
    })).catch(console.error);
  }

  // Get metrics
  static getMetrics(category?: string): any {
    if (category) {
      return this.metrics.get(category) || [];
    }
    
    const allMetrics: any = {};
    for (const [key, value] of this.metrics) {
      allMetrics[key] = value;
    }
    return allMetrics;
  }

  // Clear metrics
  static clearMetrics(category?: string): void {
    if (category) {
      this.metrics.delete(category);
    } else {
      this.metrics.clear();
    }
  }

  // Flush metrics to storage
  static async flushMetrics(): Promise<void> {
    const allMetrics = this.getMetrics();
    
    try {
      await redis.setex(
        `performance_metrics:${Date.now()}`,
        3600, // 1 hour TTL
        JSON.stringify(allMetrics)
      );
      
      this.clearMetrics();
      console.log('📊 Performance metrics flushed to storage');
    } catch (error) {
      console.error('❌ Failed to flush performance metrics:', error);
    }
  }

  // Stop monitoring
  static stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

// Performance timing utilities
export class PerformanceTimer {
  private static timers: Map<string, number> = new Map();

  // Start timing
  static start(label: string): void {
    this.timers.set(label, performance.now());
    performance.mark(`${label}-start`);
  }

  // End timing and record
  static end(label: string, metadata?: any): number {
    const startTime = this.timers.get(label);
    if (!startTime) {
      console.warn(`Timer '${label}' was not started`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    performance.mark(`${label}-end`);
    performance.measure(label, `${label}-start`, `${label}-end`);

    // Record metric
    PerformanceCollector.recordMetric('timing', {
      label,
      duration,
      metadata,
    });

    this.timers.delete(label);
    return duration;
  }

  // Time a function execution
  static async time<T>(
    label: string,
    fn: () => Promise<T>,
    metadata?: any
  ): Promise<{ result: T; duration: number }> {
    this.start(label);
    try {
      const result = await fn();
      const duration = this.end(label, metadata);
      return { result, duration };
    } catch (error) {
      this.end(label, { ...metadata, error: true });
      throw error;
    }
  }

  // Time a synchronous function
  static timeSync<T>(
    label: string,
    fn: () => T,
    metadata?: any
  ): { result: T; duration: number } {
    this.start(label);
    try {
      const result = fn();
      const duration = this.end(label, metadata);
      return { result, duration };
    } catch (error) {
      this.end(label, { ...metadata, error: true });
      throw error;
    }
  }
}

// API performance middleware
export function performanceMiddleware(label?: string) {
  return (req: any, res: any, next: any) => {
    const requestLabel = label || `${req.method} ${req.route?.path || req.url}`;
    const startTime = performance.now();

    // Record request start
    PerformanceCollector.recordMetric('request_start', {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    // Override res.end to capture response time
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      const duration = performance.now() - startTime;
      
      // Record request completion
      PerformanceCollector.recordMetric('request_complete', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        contentLength: res.get('content-length'),
      });

      // Check performance budget
      const budget = performanceConfig.budgets.apiResponse;
      if (duration > budget) {
        PerformanceCollector.recordMetric('budget_violation', {
          type: 'api_response',
          duration,
          budget,
          url: req.url,
        });
      }

      originalEnd.apply(this, args);
    };

    next();
  };
}

// PDF processing performance tracker
export class PDFPerformanceTracker {
  private static operations: Map<string, {
    startTime: number;
    operation: string;
    fileSize: number;
    userId: string;
  }> = new Map();

  // Start tracking PDF operation
  static startOperation(
    operationId: string,
    operation: string,
    fileSize: number,
    userId: string
  ): void {
    this.operations.set(operationId, {
      startTime: performance.now(),
      operation,
      fileSize,
      userId,
    });

    PerformanceCollector.recordMetric('pdf_operation_start', {
      operationId,
      operation,
      fileSize,
      userId,
    });
  }

  // End tracking PDF operation
  static endOperation(
    operationId: string,
    success: boolean,
    outputSize?: number,
    error?: string
  ): number {
    const operationData = this.operations.get(operationId);
    if (!operationData) {
      console.warn(`PDF operation '${operationId}' was not started`);
      return 0;
    }

    const duration = performance.now() - operationData.startTime;
    const compressionRatio = outputSize && operationData.fileSize 
      ? ((operationData.fileSize - outputSize) / operationData.fileSize) * 100
      : undefined;

    // Record completion
    PerformanceCollector.recordMetric('pdf_operation_complete', {
      operationId,
      operation: operationData.operation,
      duration,
      success,
      inputSize: operationData.fileSize,
      outputSize,
      compressionRatio,
      userId: operationData.userId,
      error,
    });

    // Check performance budget
    const budget = performanceConfig.budgets.pdfProcessing;
    if (duration > budget) {
      PerformanceCollector.recordMetric('budget_violation', {
        type: 'pdf_processing',
        operation: operationData.operation,
        duration,
        budget,
        fileSize: operationData.fileSize,
      });
    }

    this.operations.delete(operationId);
    return duration;
  }

  // Get active operations
  static getActiveOperations(): any[] {
    const active = [];
    const now = performance.now();
    
    for (const [id, data] of this.operations) {
      active.push({
        id,
        ...data,
        elapsed: now - data.startTime,
      });
    }
    
    return active;
  }
}

// Performance analytics
export class PerformanceAnalytics {
  // Calculate percentiles
  static calculatePercentiles(values: number[]): {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  } {
    if (values.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      p50: sorted[Math.floor(len * 0.5)],
      p90: sorted[Math.floor(len * 0.9)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)],
    };
  }

  // Get performance summary
  static getPerformanceSummary(category: string): any {
    const metrics = PerformanceCollector.getMetrics(category);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const durations = metrics
      .filter((m: any) => m.duration)
      .map((m: any) => m.duration);

    const percentiles = this.calculatePercentiles(durations);
    const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;

    return {
      count: metrics.length,
      average,
      ...percentiles,
      min: Math.min(...durations),
      max: Math.max(...durations),
    };
  }

  // Generate performance report
  static generateReport(): any {
    const categories = ['timing', 'request_complete', 'pdf_operation_complete', 'system'];
    const report: any = {
      timestamp: new Date().toISOString(),
      categories: {},
    };

    for (const category of categories) {
      const summary = this.getPerformanceSummary(category);
      if (summary) {
        report.categories[category] = summary;
      }
    }

    return report;
  }
}

// Initialize performance monitoring
if (typeof window === 'undefined') {
  // Server-side only
  PerformanceCollector.initialize();
  
  // Flush metrics periodically
  setInterval(() => {
    PerformanceCollector.flushMetrics();
  }, performanceConfig.metrics.flushInterval);
}

export default PerformanceCollector;
