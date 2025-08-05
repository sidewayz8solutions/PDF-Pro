import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  ClockIcon,
  CpuChipIcon,
  CloudIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';

const PerformanceDashboard: React.FC = () => {
  const {
    metrics,
    sessions,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    getPerformanceSummary,
    getRecommendations,
    exportMetrics,
    resetMetrics,
  } = usePerformanceMonitor();

  const [showDetails, setShowDetails] = useState(false);
  const summary = getPerformanceSummary();
  const recommendations = getRecommendations();

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatSize = (mb: number) => {
    if (mb < 1) return `${(mb * 1024).toFixed(1)}KB`;
    return `${mb.toFixed(1)}MB`;
  };

  const MetricCard: React.FC<{
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ComponentType<any>;
    color: string;
    trend?: 'up' | 'down' | 'neutral';
  }> = ({ title, value, subtitle, icon: Icon, color, trend }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow-md p-6 border-l-4"
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-full`} style={{ backgroundColor: `${color}20` }}>
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center">
          <span className={`text-sm ${
            trend === 'up' ? 'text-green-600' : 
            trend === 'down' ? 'text-red-600' : 
            'text-gray-600'
          }`}>
            {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'} 
            {trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Stable'}
          </span>
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Performance Dashboard</h1>
            <p className="text-gray-600 mt-2">
              Monitor and optimize PDF processing performance
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={isMonitoring ? stopMonitoring : startMonitoring}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                isMonitoring 
                  ? 'bg-red-600 text-white hover:bg-red-700' 
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
            </button>
            
            <button
              onClick={exportMetrics}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              <span>Export</span>
            </button>
            
            <button
              onClick={resetMetrics}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center space-x-2"
            >
              <ArrowPathIcon className="w-4 h-4" />
              <span>Reset</span>
            </button>
          </div>
        </div>
        
        {isMonitoring && (
          <div className="mt-4 flex items-center space-x-2 text-green-600">
            <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Monitoring active</span>
          </div>
        )}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Average Processing Time"
          value={formatTime(metrics.processingTime)}
          subtitle="Per file"
          icon={ClockIcon}
          color="#3B82F6"
          trend="down"
        />
        
        <MetricCard
          title="Throughput"
          value={metrics.throughput.toFixed(1)}
          subtitle="Files per minute"
          icon={ChartBarIcon}
          color="#10B981"
          trend="up"
        />
        
        <MetricCard
          title="Client-side Processing"
          value={`${(metrics.clientSideProcessingRatio * 100).toFixed(1)}%`}
          subtitle="Web worker utilization"
          icon={CpuChipIcon}
          color="#8B5CF6"
          trend="up"
        />
        
        <MetricCard
          title="Memory Usage"
          value={formatSize(metrics.memoryUsage)}
          subtitle={`Peak: ${formatSize(metrics.peakMemoryUsage)}`}
          icon={CloudIcon}
          color="#F59E0B"
          trend="neutral"
        />
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Summary</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Sessions</span>
              <span className="font-medium">{summary.totalSessions}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Success Rate</span>
              <span className={`font-medium ${
                summary.successRate >= 95 ? 'text-green-600' : 
                summary.successRate >= 80 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {summary.successRate.toFixed(1)}%
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Client-side Processing</span>
              <span className="font-medium text-purple-600">
                {summary.clientSideProcessingPercentage.toFixed(1)}%
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Memory Efficiency</span>
              <span className={`font-medium ${
                summary.memoryEfficiency >= 80 ? 'text-green-600' : 
                summary.memoryEfficiency >= 60 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {summary.memoryEfficiency.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Network Metrics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Requests</span>
              <span className="font-medium">{metrics.networkRequests}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Data Transferred</span>
              <span className="font-medium">{formatSize(metrics.dataTransferred)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Avg Request Size</span>
              <span className="font-medium">
                {metrics.networkRequests > 0 
                  ? formatSize(metrics.dataTransferred / metrics.networkRequests)
                  : '0MB'
                }
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Error Rate</span>
              <span className={`font-medium ${
                metrics.errorRate <= 0.05 ? 'text-green-600' : 
                metrics.errorRate <= 0.1 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {(metrics.errorRate * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
          <div className="flex items-start space-x-3">
            <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                Performance Recommendations
              </h3>
              <ul className="space-y-2">
                {recommendations.map((recommendation, index) => (
                  <li key={index} className="text-yellow-700">
                    • {recommendation}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Sessions</h3>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
        </div>
        
        {sessions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No processing sessions recorded yet
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-600">Operation</th>
                  <th className="text-left py-2 font-medium text-gray-600">File Size</th>
                  <th className="text-left py-2 font-medium text-gray-600">Method</th>
                  <th className="text-left py-2 font-medium text-gray-600">Duration</th>
                  <th className="text-left py-2 font-medium text-gray-600">Status</th>
                  {showDetails && (
                    <th className="text-left py-2 font-medium text-gray-600">Details</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sessions.slice(-10).reverse().map((session) => (
                  <tr key={session.id} className="border-b border-gray-100">
                    <td className="py-2">{session.operation}</td>
                    <td className="py-2">{formatSize(session.fileSize / 1024 / 1024)}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        session.processingMethod === 'client' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {session.processingMethod}
                      </span>
                    </td>
                    <td className="py-2">
                      {session.endTime 
                        ? formatTime(session.endTime - session.startTime)
                        : 'Processing...'
                      }
                    </td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        session.success 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {session.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    {showDetails && (
                      <td className="py-2 text-xs text-gray-500">
                        {session.error || 'No additional details'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceDashboard;
