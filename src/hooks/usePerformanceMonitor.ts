import { useEffect, useState, useCallback } from 'react';

export interface PerformanceMetrics {
  // Processing metrics
  processingTime: number;
  throughput: number; // files per minute
  averageFileSize: number;
  
  // Web Worker metrics
  workerUtilization: number;
  clientSideProcessingRatio: number;
  
  // Memory metrics
  memoryUsage: number;
  peakMemoryUsage: number;
  
  // Network metrics
  networkRequests: number;
  dataTransferred: number;
  
  // User experience metrics
  timeToFirstInteraction: number;
  errorRate: number;
}

export interface ProcessingSession {
  id: string;
  startTime: number;
  endTime?: number;
  operation: string;
  fileSize: number;
  processingMethod: 'client' | 'server';
  success: boolean;
  error?: string;
}

export function usePerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    processingTime: 0,
    throughput: 0,
    averageFileSize: 0,
    workerUtilization: 0,
    clientSideProcessingRatio: 0,
    memoryUsage: 0,
    peakMemoryUsage: 0,
    networkRequests: 0,
    dataTransferred: 0,
    timeToFirstInteraction: 0,
    errorRate: 0,
  });

  const [sessions, setSessions] = useState<ProcessingSession[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
    
    // Monitor memory usage
    if ('memory' in performance) {
      const updateMemoryMetrics = () => {
        const memInfo = (performance as any).memory;
        setMetrics(prev => ({
          ...prev,
          memoryUsage: memInfo.usedJSHeapSize / 1024 / 1024, // MB
          peakMemoryUsage: Math.max(prev.peakMemoryUsage, memInfo.usedJSHeapSize / 1024 / 1024),
        }));
      };

      const memoryInterval = setInterval(updateMemoryMetrics, 1000);
      return () => clearInterval(memoryInterval);
    }
  }, []);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
  }, []);

  // Start a processing session
  const startSession = useCallback((operation: string, fileSize: number, method: 'client' | 'server') => {
    const session: ProcessingSession = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      startTime: performance.now(),
      operation,
      fileSize,
      processingMethod: method,
      success: false,
    };

    setSessions(prev => [...prev, session]);
    return session.id;
  }, []);

  // End a processing session
  const endSession = useCallback((sessionId: string, success: boolean, error?: string) => {
    setSessions(prev => prev.map(session => 
      session.id === sessionId 
        ? { ...session, endTime: performance.now(), success, error }
        : session
    ));
  }, []);

  // Calculate metrics from sessions
  useEffect(() => {
    const completedSessions = sessions.filter(s => s.endTime !== undefined);
    
    if (completedSessions.length === 0) return;

    const totalProcessingTime = completedSessions.reduce(
      (sum, session) => sum + (session.endTime! - session.startTime), 0
    );
    
    const averageProcessingTime = totalProcessingTime / completedSessions.length;
    
    const totalFileSize = completedSessions.reduce(
      (sum, session) => sum + session.fileSize, 0
    );
    
    const averageFileSize = totalFileSize / completedSessions.length;
    
    const clientSideSessions = completedSessions.filter(s => s.processingMethod === 'client');
    const clientSideRatio = clientSideSessions.length / completedSessions.length;
    
    const successfulSessions = completedSessions.filter(s => s.success);
    const errorRate = 1 - (successfulSessions.length / completedSessions.length);
    
    // Calculate throughput (files per minute)
    const sessionTimeSpan = Math.max(...completedSessions.map(s => s.endTime!)) - 
                           Math.min(...completedSessions.map(s => s.startTime));
    const throughput = (completedSessions.length / sessionTimeSpan) * 60000; // per minute

    setMetrics(prev => ({
      ...prev,
      processingTime: averageProcessingTime,
      throughput,
      averageFileSize: averageFileSize / 1024 / 1024, // MB
      clientSideProcessingRatio: clientSideRatio,
      errorRate,
    }));
  }, [sessions]);

  // Monitor network requests
  useEffect(() => {
    if (!isMonitoring) return;

    let requestCount = 0;
    let dataTransferred = 0;

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      requestCount++;
      const response = await originalFetch(...args);
      
      // Estimate data transferred
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        dataTransferred += parseInt(contentLength);
      }
      
      setMetrics(prev => ({
        ...prev,
        networkRequests: requestCount,
        dataTransferred: dataTransferred / 1024 / 1024, // MB
      }));
      
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [isMonitoring]);

  // Monitor Web Worker utilization
  const updateWorkerUtilization = useCallback((isWorkerActive: boolean) => {
    setMetrics(prev => ({
      ...prev,
      workerUtilization: isWorkerActive ? 100 : 0,
    }));
  }, []);

  // Get performance summary
  const getPerformanceSummary = useCallback(() => {
    const completedSessions = sessions.filter(s => s.endTime !== undefined);
    
    return {
      totalSessions: completedSessions.length,
      successRate: completedSessions.length > 0 
        ? (completedSessions.filter(s => s.success).length / completedSessions.length) * 100 
        : 0,
      averageProcessingTime: metrics.processingTime,
      clientSideProcessingPercentage: metrics.clientSideProcessingRatio * 100,
      memoryEfficiency: metrics.peakMemoryUsage > 0 
        ? (1 - metrics.memoryUsage / metrics.peakMemoryUsage) * 100 
        : 100,
      networkEfficiency: metrics.networkRequests > 0 
        ? metrics.dataTransferred / metrics.networkRequests 
        : 0,
    };
  }, [sessions, metrics]);

  // Export metrics for analysis
  const exportMetrics = useCallback(() => {
    const data = {
      metrics,
      sessions: sessions.filter(s => s.endTime !== undefined),
      summary: getPerformanceSummary(),
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pdf-pro-performance-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [metrics, sessions, getPerformanceSummary]);

  // Reset metrics
  const resetMetrics = useCallback(() => {
    setSessions([]);
    setMetrics({
      processingTime: 0,
      throughput: 0,
      averageFileSize: 0,
      workerUtilization: 0,
      clientSideProcessingRatio: 0,
      memoryUsage: 0,
      peakMemoryUsage: 0,
      networkRequests: 0,
      dataTransferred: 0,
      timeToFirstInteraction: 0,
      errorRate: 0,
    });
  }, []);

  // Performance recommendations
  const getRecommendations = useCallback(() => {
    const recommendations: string[] = [];
    
    if (metrics.clientSideProcessingRatio < 0.5) {
      recommendations.push('Consider increasing client-side processing for better performance');
    }
    
    if (metrics.memoryUsage > 100) {
      recommendations.push('High memory usage detected - consider optimizing file processing');
    }
    
    if (metrics.errorRate > 0.1) {
      recommendations.push('High error rate detected - review error handling and file validation');
    }
    
    if (metrics.throughput < 1) {
      recommendations.push('Low throughput detected - consider optimizing processing pipeline');
    }
    
    if (metrics.networkRequests > sessions.length * 2) {
      recommendations.push('High network usage - consider caching or reducing API calls');
    }
    
    return recommendations;
  }, [metrics, sessions]);

  return {
    metrics,
    sessions: sessions.filter(s => s.endTime !== undefined),
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    startSession,
    endSession,
    updateWorkerUtilization,
    getPerformanceSummary,
    getRecommendations,
    exportMetrics,
    resetMetrics,
  };
}

export default usePerformanceMonitor;
