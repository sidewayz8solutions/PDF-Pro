import React, { useState } from 'react';

import {
  AnimatePresence,
  motion,
} from 'framer-motion';

import {
  ChevronDownIcon,
  ChevronUpIcon,
  PauseIcon,
  PlayIcon,
  QueueListIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

export interface QueueItem {
  id: string;
  fileName: string;
  fileSize: number;
  operation: string;
  status: 'pending' | 'processing' | 'completed' | 'error' | 'paused';
  progress: number;
  message?: string;
  estimatedTime?: number;
  startTime?: number;
  endTime?: number;
  error?: string;
}

export interface ProcessingQueueProps {
  items: QueueItem[];
  isVisible: boolean;
  onToggleVisibility: () => void;
  onRemoveItem: (id: string) => void;
  onClearCompleted: () => void;
  onPauseResume: (id: string) => void;
  onRetry: (id: string) => void;
  totalProgress: number;
}

const ProcessingQueue: React.FC<ProcessingQueueProps> = ({
  items,
  isVisible,
  onToggleVisibility,
  onRemoveItem,
  onClearCompleted,
  onPauseResume,
  onRetry,
  totalProgress
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStatusColor = (status: QueueItem['status']) => {
    switch (status) {
      case 'pending': return 'text-gray-500 bg-gray-100';
      case 'processing': return 'text-blue-600 bg-blue-100';
      case 'completed': return 'text-green-600 bg-green-100';
      case 'error': return 'text-red-600 bg-red-100';
      case 'paused': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-500 bg-gray-100';
    }
  };

  const getOperationIcon = (operation: string) => {
    switch (operation.toLowerCase()) {
      case 'compress': return '🗜️';
      case 'merge': return '📄';
      case 'split': return '✂️';
      case 'watermark': return '🏷️';
      case 'convert': return '🔄';
      case 'extract': return '📤';
      case 'protect': return '🔒';
      case 'sign': return '✍️';
      default: return '⚙️';
    }
  };

  const pendingItems = items.filter(item => item.status === 'pending');
  const processingItems = items.filter(item => item.status === 'processing');
  const completedItems = items.filter(item => item.status === 'completed');
  const errorItems = items.filter(item => item.status === 'error');

  if (!isVisible) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed bottom-4 right-4 z-40"
      >
        <button
          onClick={onToggleVisibility}
          className="bg-white shadow-lg rounded-full p-3 hover:shadow-xl transition-shadow border border-gray-200"
        >
          <QueueListIcon className="w-6 h-6 text-gray-600" />
          {items.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {items.length}
            </span>
          )}
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className="fixed bottom-4 right-4 z-40 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <QueueListIcon className="w-5 h-5 text-gray-600" />
            <h3 className="font-medium text-gray-900">Processing Queue</h3>
            <span className="text-sm text-gray-500">({items.length})</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-gray-200 rounded"
              title={isExpanded ? "Collapse queue" : "Expand queue"}
            >
              {isExpanded ? (
                <ChevronDownIcon className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronUpIcon className="w-4 h-4 text-gray-600" />
              )}
            </button>
            <button
              onClick={onToggleVisibility}
              className="p-1 hover:bg-gray-200 rounded"
              title="Close queue"
            >
              <XMarkIcon className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
        
        {/* Overall Progress */}
        {items.length > 0 && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Overall Progress</span>
              <span>{Math.round(totalProgress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <motion.div
                className="h-full bg-blue-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${totalProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Queue Items */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <QueueListIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No items in queue</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1 min-w-0">
                          <span className="text-lg">{getOperationIcon(item.operation)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {item.fileName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(item.fileSize)} • {item.operation}
                            </p>
                            
                            {/* Status Badge */}
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${getStatusColor(item.status)}`}>
                              {item.status}
                            </span>
                            
                            {/* Progress Bar */}
                            {(item.status === 'processing' || item.status === 'completed') && (
                              <div className="mt-2">
                                <div className="w-full bg-gray-200 rounded-full h-1">
                                  <motion.div
                                    className={`h-full rounded-full ${
                                      item.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                                    }`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${item.progress}%` }}
                                    transition={{ duration: 0.3 }}
                                  />
                                </div>
                                {item.message && (
                                  <p className="text-xs text-gray-400 mt-1">{item.message}</p>
                                )}
                              </div>
                            )}
                            
                            {/* Error Message */}
                            {item.status === 'error' && item.error && (
                              <p className="text-xs text-red-600 mt-1">{item.error}</p>
                            )}
                            
                            {/* Timing Info */}
                            {item.estimatedTime && item.status === 'processing' && (
                              <p className="text-xs text-gray-400 mt-1">
                                Est. {formatTime(item.estimatedTime)} remaining
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center space-x-1 ml-2">
                          {item.status === 'processing' && (
                            <button
                              onClick={() => onPauseResume(item.id)}
                              className="p-1 hover:bg-gray-200 rounded"
                              title="Pause"
                            >
                              <PauseIcon className="w-4 h-4 text-gray-600" />
                            </button>
                          )}
                          
                          {item.status === 'paused' && (
                            <button
                              onClick={() => onPauseResume(item.id)}
                              className="p-1 hover:bg-gray-200 rounded"
                              title="Resume"
                            >
                              <PlayIcon className="w-4 h-4 text-gray-600" />
                            </button>
                          )}
                          
                          {item.status === 'error' && (
                            <button
                              onClick={() => onRetry(item.id)}
                              className="p-1 hover:bg-gray-200 rounded text-blue-600"
                              title="Retry"
                            >
                              <PlayIcon className="w-4 h-4" />
                            </button>
                          )}
                          
                          <button
                            onClick={() => onRemoveItem(item.id)}
                            className="p-1 hover:bg-gray-200 rounded"
                            title="Remove"
                          >
                            <XMarkIcon className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Footer Actions */}
            {items.length > 0 && (
              <div className="border-t border-gray-200 p-3 bg-gray-50">
                <div className="flex justify-between items-center text-xs text-gray-600">
                  <div className="space-x-4">
                    <span>Pending: {pendingItems.length}</span>
                    <span>Processing: {processingItems.length}</span>
                    <span>Completed: {completedItems.length}</span>
                    {errorItems.length > 0 && (
                      <span className="text-red-600">Errors: {errorItems.length}</span>
                    )}
                  </div>
                  
                  {completedItems.length > 0 && (
                    <button
                      onClick={onClearCompleted}
                      className="flex items-center space-x-1 text-gray-600 hover:text-gray-800"
                    >
                      <TrashIcon className="w-3 h-3" />
                      <span>Clear completed</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ProcessingQueue;
