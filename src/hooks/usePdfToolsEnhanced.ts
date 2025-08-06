import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

import { supabaseHelpers } from '@/lib/supabase';

export interface ProcessingOptions {
  quality?: 'low' | 'medium' | 'high';
  removeImages?: boolean;
  watermarkText?: string;
  watermarkOpacity?: number;
  splitEvery?: number;
  pages?: number[];
  password?: string;
}

export interface ProcessingResult {
  success: boolean;
  fileId?: string;
  downloadUrl?: string;
  originalSize?: number;
  processedSize?: number;
  compressionRatio?: number;
  processingTime?: number;
  error?: string;
}

export interface FileRecord {
  id: string;
  user_id: string;
  original_name: string;
  file_size: number;
  file_type: string;
  s3_key: string;
  s3_url: string;
  processed_url: string | null;
  operation_type: 'compress' | 'merge' | 'split' | 'watermark' | 'protect' | 'convert' | 'extract' | 'sign';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  processing_time: number | null;
  compression_ratio: number | null;
  pages_count: number | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export interface UserStats {
  totalFiles: number;
  totalStorage: number;
  creditsUsed: number;
  creditsRemaining: number;
  monthlyLimit: number;
}

export function usePdfToolsEnhanced() {
  const { data: session } = useSession();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentOperation, setCurrentOperation] = useState<string | null>(null);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [processingQueue, setProcessingQueue] = useState<FileRecord[]>([]);

  // Load user files and stats
  const loadUserData = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      // Load user files
      const { data: userFiles } = await supabaseHelpers.getUserFiles(session.user.id);
      if (userFiles) {
        setFiles(userFiles);
      }

      // Load user stats
      const [userProfile, subscription] = await Promise.all([
        supabaseHelpers.getUserById(session.user.id),
        supabaseHelpers.getUserSubscription(session.user.id)
      ]);

      if (userProfile.data && subscription.data) {
        setUserStats({
          totalFiles: userProfile.data.total_files_processed,
          totalStorage: userProfile.data.total_storage_used,
          creditsUsed: userProfile.data.credits_used,
          creditsRemaining: subscription.data.monthly_credits - userProfile.data.credits_used,
          monthlyLimit: subscription.data.monthly_credits,
        });
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  }, [session?.user?.id]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!session?.user?.id) return;

    // Subscribe to user files changes
    const filesSubscription = supabaseHelpers.subscribeToUserFiles(
      session.user.id,
      (payload) => {
        console.log('File update:', payload);
        loadUserData(); // Reload data when files change
      }
    );

    // Subscribe to processing queue changes
    const queueSubscription = supabaseHelpers.subscribeToProcessingQueue(
      (payload) => {
        console.log('Queue update:', payload);
        // Update processing queue state
        if (payload.eventType === 'INSERT') {
          setProcessingQueue(prev => [...prev, payload.new]);
        } else if (payload.eventType === 'UPDATE') {
          setProcessingQueue(prev => 
            prev.map(item => 
              item.id === payload.new.id ? payload.new : item
            )
          );
        } else if (payload.eventType === 'DELETE') {
          setProcessingQueue(prev => 
            prev.filter(item => item.id !== payload.old.id)
          );
        }
      }
    );

    return () => {
      filesSubscription.unsubscribe();
      queueSubscription.unsubscribe();
    };
  }, [session?.user?.id, loadUserData]);

  // Load initial data
  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Generic file processing function
  const processFile = useCallback(async (
    endpoint: string,
    file: File,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    setIsProcessing(true);
    setProgress(0);
    setCurrentOperation(endpoint.split('/').pop() || 'processing');

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Add options to form data
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.append(key, value.toString());
        }
      });

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Processing failed');
      }

      // Reload user data to reflect changes
      await loadUserData();

      toast.success('File processed successfully!');
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setCurrentOperation(null);
    }
  }, [session?.user?.id, loadUserData]);

  // Specific operation functions
  const compressPdf = useCallback(async (
    file: File,
    options: { quality?: 'low' | 'medium' | 'high'; removeImages?: boolean } = {}
  ) => {
    return processFile('/api/pdf/compress-enhanced', file, options);
  }, [processFile]);

  const addWatermark = useCallback(async (
    file: File,
    options: { text?: string; opacity?: number } = {}
  ) => {
    return processFile('/api/pdf/watermark-enhanced', file, {
      watermarkText: options.text,
      watermarkOpacity: options.opacity,
    });
  }, [processFile]);

  const splitPdf = useCallback(async (
    file: File,
    options: { splitEvery?: number; pages?: number[] } = {}
  ) => {
    return processFile('/api/pdf/split-enhanced', file, options);
  }, [processFile]);

  const protectPdf = useCallback(async (
    file: File,
    options: { password?: string } = {}
  ) => {
    return processFile('/api/pdf/protect-enhanced', file, options);
  }, [processFile]);

  // Merge multiple PDFs
  const mergePdfs = useCallback(async (files: File[]) => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    setIsProcessing(true);
    setCurrentOperation('merge');

    try {
      const formData = new FormData();
      files.forEach((file, index) => {
        formData.append(`file_${index}`, file);
      });
      formData.append('fileCount', files.length.toString());

      const response = await fetch('/api/pdf/merge-enhanced', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Merge failed');
      }

      await loadUserData();
      toast.success('PDFs merged successfully!');
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Merge failed';
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsProcessing(false);
      setCurrentOperation(null);
    }
  }, [session?.user?.id, loadUserData]);

  // Download file
  const downloadFile = useCallback(async (fileId: string) => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      const response = await fetch(`/api/files/${fileId}/download`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const { downloadUrl } = await response.json();
      
      // Trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = '';
      link.click();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Download failed';
      toast.error(errorMessage);
      throw error;
    }
  }, [session?.user?.id]);

  // Delete file
  const deleteFile = useCallback(async (fileId: string) => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      await loadUserData();
      toast.success('File deleted successfully!');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Delete failed';
      toast.error(errorMessage);
      throw error;
    }
  }, [session?.user?.id, loadUserData]);

  // Get user analytics
  const getAnalytics = useCallback(async (period: 'day' | 'week' | 'month' = 'month') => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      const response = await fetch(`/api/analytics?period=${period}`);
      
      if (!response.ok) {
        throw new Error('Failed to load analytics');
      }

      return await response.json();
    } catch (error) {
      console.error('Analytics error:', error);
      throw error;
    }
  }, [session?.user?.id]);

  return {
    // State
    isProcessing,
    progress,
    currentOperation,
    files,
    userStats,
    processingQueue,
    
    // Actions
    compressPdf,
    addWatermark,
    splitPdf,
    protectPdf,
    mergePdfs,
    downloadFile,
    deleteFile,
    getAnalytics,
    loadUserData,
    
    // Utilities
    hasCredits: userStats ? userStats.creditsRemaining > 0 : false,
    canUpload: !isProcessing,
  };
}

export default usePdfToolsEnhanced;
