import { useCallback, useEffect, useRef, useState } from 'react';

export interface WorkerProgress {
  progress: number;
  message: string;
}

export interface WorkerResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  [key: string]: any;
}

export interface WorkerTask {
  id: string;
  type: string;
  data: any;
  options?: any;
  resolve: (result: WorkerResult) => void;
  reject: (error: Error) => void;
}

export function useWebWorker(workerPath: string) {
  const workerRef = useRef<Worker | null>(null);
  const taskQueueRef = useRef<WorkerTask[]>([]);
  const currentTaskRef = useRef<WorkerTask | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<WorkerProgress>({ progress: 0, message: '' });

  // Initialize worker
  useEffect(() => {
    if (typeof window !== 'undefined') {
      workerRef.current = new Worker(workerPath);
      
      workerRef.current.onmessage = (e) => {
        const { type, id, result, error, progress: progressValue, message } = e.data;
        
        switch (type) {
          case 'progress':
            setProgress({ progress: progressValue, message });
            break;
            
          case 'complete':
            if (currentTaskRef.current && currentTaskRef.current.id === id) {
              currentTaskRef.current.resolve(result);
              processNextTask();
            }
            break;
            
          case 'error':
            if (currentTaskRef.current && currentTaskRef.current.id === id) {
              currentTaskRef.current.reject(new Error(error));
              processNextTask();
            }
            break;
        }
      };
      
      workerRef.current.onerror = (error) => {
        console.error('Worker error:', error);
        if (currentTaskRef.current) {
          currentTaskRef.current.reject(new Error('Worker error occurred'));
          processNextTask();
        }
      };
    }
    
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [workerPath]);

  const processNextTask = useCallback(() => {
    if (taskQueueRef.current.length === 0) {
      setIsProcessing(false);
      setProgress({ progress: 0, message: '' });
      currentTaskRef.current = null;
      return;
    }
    
    const nextTask = taskQueueRef.current.shift()!;
    currentTaskRef.current = nextTask;
    
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: nextTask.type,
        data: nextTask.data,
        options: nextTask.options,
        id: nextTask.id
      });
    }
  }, []);

  const executeTask = useCallback(<T = any>(
    type: string,
    data: any,
    options?: any
  ): Promise<WorkerResult<T>> => {
    return new Promise((resolve, reject) => {
      const taskId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const task: WorkerTask = {
        id: taskId,
        type,
        data,
        options,
        resolve,
        reject
      };
      
      taskQueueRef.current.push(task);
      
      if (!isProcessing) {
        setIsProcessing(true);
        processNextTask();
      }
    });
  }, [isProcessing, processNextTask]);

  const cancelCurrentTask = useCallback(() => {
    if (workerRef.current && currentTaskRef.current) {
      // Terminate and recreate worker to cancel current task
      workerRef.current.terminate();
      
      if (typeof window !== 'undefined') {
        workerRef.current = new Worker(workerPath);
        // Re-setup event handlers (same as in useEffect)
        workerRef.current.onmessage = (e) => {
          const { type, id, result, error, progress: progressValue, message } = e.data;
          
          switch (type) {
            case 'progress':
              setProgress({ progress: progressValue, message });
              break;
              
            case 'complete':
              if (currentTaskRef.current && currentTaskRef.current.id === id) {
                currentTaskRef.current.resolve(result);
                processNextTask();
              }
              break;
              
            case 'error':
              if (currentTaskRef.current && currentTaskRef.current.id === id) {
                currentTaskRef.current.reject(new Error(error));
                processNextTask();
              }
              break;
          }
        };
        
        workerRef.current.onerror = (error) => {
          console.error('Worker error:', error);
          if (currentTaskRef.current) {
            currentTaskRef.current.reject(new Error('Worker error occurred'));
            processNextTask();
          }
        };
      }
      
      // Reject current task
      if (currentTaskRef.current) {
        currentTaskRef.current.reject(new Error('Task cancelled'));
      }
      
      // Clear queue and reset state
      taskQueueRef.current = [];
      currentTaskRef.current = null;
      setIsProcessing(false);
      setProgress({ progress: 0, message: '' });
    }
  }, [workerPath, processNextTask]);

  const clearQueue = useCallback(() => {
    // Reject all queued tasks
    taskQueueRef.current.forEach(task => {
      task.reject(new Error('Task cancelled'));
    });
    
    taskQueueRef.current = [];
    
    if (!currentTaskRef.current) {
      setIsProcessing(false);
      setProgress({ progress: 0, message: '' });
    }
  }, []);

  return {
    executeTask,
    cancelCurrentTask,
    clearQueue,
    isProcessing,
    progress,
    queueLength: taskQueueRef.current.length,
    currentTask: currentTaskRef.current?.type || null
  };
}

// Specific hooks for different worker types
export function usePDFWorker() {
  const worker = useWebWorker('/workers/pdf-worker.js');
  
  const compressPDF = useCallback(async (
    file: File,
    options?: { quality?: 'low' | 'medium' | 'high'; removeImages?: boolean }
  ) => {
    const arrayBuffer = await file.arrayBuffer();
    return worker.executeTask('compress', arrayBuffer, options);
  }, [worker]);
  
  const mergePDFs = useCallback(async (
    files: File[],
    options?: any
  ) => {
    const buffers = await Promise.all(files.map(file => file.arrayBuffer()));
    return worker.executeTask('merge', buffers, options);
  }, [worker]);
  
  const splitPDF = useCallback(async (
    file: File,
    options?: { splitEvery?: number; pages?: number[] }
  ) => {
    const arrayBuffer = await file.arrayBuffer();
    return worker.executeTask('split', arrayBuffer, options);
  }, [worker]);
  
  const addWatermark = useCallback(async (
    file: File,
    options?: {
      text?: string;
      opacity?: number;
      fontSize?: number;
      rotation?: number;
      color?: [number, number, number];
    }
  ) => {
    const arrayBuffer = await file.arrayBuffer();
    return worker.executeTask('watermark', arrayBuffer, options);
  }, [worker]);
  
  return {
    ...worker,
    compressPDF,
    mergePDFs,
    splitPDF,
    addWatermark
  };
}

export default useWebWorker;
