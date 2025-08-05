import React from 'react';

import {
  AnimatePresence,
  motion,
} from 'framer-motion';

import {
  ClockIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

export interface ProgressStep {
  id: string;
  name: string;
  status: 'pending' | 'current' | 'complete' | 'error';
  progress?: number;
  message?: string;
  estimatedTime?: number;
}

export interface ProgressIndicatorProps {
  isVisible: boolean;
  progress: number;
  message: string;
  operation: string;
  steps?: ProgressStep[];
  onCancel?: () => void;
  showDetails?: boolean;
  estimatedTimeRemaining?: number;
  processingSpeed?: string;
  fileInfo?: {
    name: string;
    size: number;
    type: string;
  };
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  isVisible,
  progress,
  message,
  operation,
  steps,
  onCancel,
  showDetails = false,
  estimatedTimeRemaining,
  processingSpeed,
  fileInfo
}) => {
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getOperationIcon = (operation: string) => {
    switch (operation.toLowerCase()) {
      case 'compress':
        return '🗜️';
      case 'merge':
        return '📄';
      case 'split':
        return '✂️';
      case 'watermark':
        return '🏷️';
      case 'convert':
        return '🔄';
      case 'extract':
        return '📤';
      case 'protect':
        return '🔒';
      case 'sign':
        return '✍️';
      default:
        return '⚙️';
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            exit={{ y: 20 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getOperationIcon(operation)}</span>
                  <div>
                    <h3 className="font-semibold text-lg capitalize">
                      {operation} PDF
                    </h3>
                    {fileInfo && (
                      <p className="text-blue-100 text-sm">
                        {fileInfo.name} • {formatFileSize(fileInfo.size)}
                      </p>
                    )}
                  </div>
                </div>
                {onCancel && (
                  <button
                    onClick={onCancel}
                    className="p-1 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
                    title="Cancel"
                    aria-label="Cancel"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Progress Content */}
            <div className="p-6">
              {/* Main Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    {Math.round(progress)}% Complete
                  </span>
                  {estimatedTimeRemaining && (
                    <span className="text-sm text-gray-500 flex items-center">
                      <ClockIcon className="w-4 h-4 mr-1" />
                      {formatTime(estimatedTimeRemaining)}
                    </span>
                  )}
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Current Message */}
              <div className="mb-4">
                <p className="text-gray-600 text-sm">{message}</p>
                {processingSpeed && (
                  <p className="text-gray-400 text-xs mt-1">
                    Processing speed: {processingSpeed}
                  </p>
                )}
              </div>

              {/* Detailed Steps */}
              {showDetails && steps && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Processing Steps
                  </h4>
                  {steps.map((step, index) => (
                    <div key={step.id} className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        {step.status === 'complete' && (
                          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        {step.status === 'current' && (
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                            <motion.div
                              className="w-2 h-2 bg-white rounded-full"
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 1, repeat: Infinity }}
                            />
                          </div>
                        )}
                        {step.status === 'pending' && (
                          <div className="w-6 h-6 bg-gray-300 rounded-full" />
                        )}
                        {step.status === 'error' && (
                          <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                            <XMarkIcon className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${
                          step.status === 'complete' ? 'text-green-600' :
                          step.status === 'current' ? 'text-blue-600' :
                          step.status === 'error' ? 'text-red-600' :
                          'text-gray-500'
                        }`}>
                          {step.name}
                        </p>
                        {step.message && (
                          <p className="text-xs text-gray-400 mt-1">{step.message}</p>
                        )}
                        {step.status === 'current' && step.progress !== undefined && (
                          <div className="w-full bg-gray-200 rounded-full h-1 mt-2">
                            <motion.div
                              className="h-full bg-blue-500 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${step.progress}%` }}
                              transition={{ duration: 0.3 }}
                            />
                          </div>
                        )}
                      </div>
                      
                      {step.estimatedTime && step.status === 'current' && (
                        <span className="text-xs text-gray-400">
                          ~{formatTime(step.estimatedTime)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-6 flex justify-end space-x-3">
                {onCancel && (
                  <button
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProgressIndicator;
