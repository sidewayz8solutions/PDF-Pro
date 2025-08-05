import { s3Storage, storageHelpers } from './aws-s3';
import { supabaseHelpers } from './supabase';
import { authHelpers } from './auth-supabase';
import { PDFConverter } from './pdf/PDFConverter';

export interface ProcessingOptions {
  quality?: 'low' | 'medium' | 'high';
  removeImages?: boolean;
  watermarkText?: string;
  watermarkOpacity?: number;
  splitEvery?: number;
  pages?: number[];
  password?: string;
  permissions?: any;
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
  metadata?: any;
}

export class EnhancedPDFService {
  private converter: PDFConverter;

  constructor() {
    this.converter = new PDFConverter();
  }

  // Main processing method with full integration
  async processFile(
    userId: string,
    file: Buffer,
    originalName: string,
    operation: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    let fileRecord: any = null;

    try {
      // 1. Validate user permissions and credits
      const hasCredits = await authHelpers.hasCredits(userId, 1);
      if (!hasCredits) {
        throw new Error('Insufficient credits');
      }

      const canProcess = await authHelpers.validateFileSize(userId, file.length);
      if (!canProcess) {
        throw new Error('File size exceeds plan limit');
      }

      // 2. Upload original file to S3 and create database record
      const uploadResult = await storageHelpers.uploadAndTrackFile(
        userId,
        file,
        originalName,
        operation,
        {
          originalSize: file.length.toString(),
          operation,
          userId
        }
      );

      fileRecord = uploadResult.fileRecord;

      if (!fileRecord) {
        throw new Error('Failed to create file record');
      }

      // 3. Update file status to processing
      await supabaseHelpers.updateFileStatus(fileRecord.id, 'processing');

      // 4. Process the file based on operation type
      let processedBuffer: Buffer;
      let metadata: any = {};

      switch (operation) {
        case 'compress':
          const compressResult = await this.converter.compressPDF(file, {
            quality: options.quality || 'medium',
            removeImages: options.removeImages || false
          });
          processedBuffer = compressResult.buffer;
          metadata = {
            compressionRatio: compressResult.compressionRatio,
            originalSize: file.length,
            compressedSize: processedBuffer.length
          };
          break;

        case 'watermark':
          processedBuffer = await this.converter.addWatermark(file, {
            text: options.watermarkText || 'WATERMARK',
            opacity: options.watermarkOpacity || 0.3
          });
          break;

        case 'split':
          const splitResult = await this.converter.splitPDF(file, {
            splitEvery: options.splitEvery,
            pages: options.pages
          });
          // For split, we'll return the first file and store others separately
          processedBuffer = splitResult.files[0];
          metadata = {
            totalFiles: splitResult.files.length,
            splitType: options.pages ? 'pages' : 'every'
          };
          break;

        case 'protect':
          processedBuffer = await this.converter.protectPDF(file, {
            password: options.password || 'protected',
            permissions: options.permissions
          });
          break;

        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }

      // 5. Upload processed file to S3
      const processedKey = s3Storage.generateFileKey(userId, `processed_${originalName}`, operation);
      const { url: processedUrl } = await s3Storage.uploadFile(
        processedBuffer,
        processedKey,
        'application/pdf',
        {
          ...metadata,
          processedAt: new Date().toISOString(),
          operation
        }
      );

      // 6. Update file record with processed file info
      const processingTime = Date.now() - startTime;
      await supabaseHelpers.updateFileStatus(fileRecord.id, 'completed', processedUrl);

      // Update additional metadata
      await supabaseHelpers.supabaseAdmin
        .from('files')
        .update({
          processing_time: processingTime,
          compression_ratio: metadata.compressionRatio,
          pages_count: metadata.totalFiles || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', fileRecord.id);

      // 7. Deduct credits and create usage record
      await authHelpers.deductCredits(userId, 1);
      await authHelpers.createUsageRecord(
        userId,
        operation,
        file.length,
        processingTime,
        1,
        true
      );

      // 8. Update user statistics
      await this.updateUserStats(userId, file.length);

      // 9. Generate secure download URL
      const downloadUrl = await storageHelpers.generateSecureDownloadUrl(fileRecord.id, userId);

      return {
        success: true,
        fileId: fileRecord.id,
        downloadUrl,
        originalSize: file.length,
        processedSize: processedBuffer.length,
        compressionRatio: metadata.compressionRatio,
        processingTime,
        metadata
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update file record with error status
      if (fileRecord) {
        await supabaseHelpers.updateFileStatus(fileRecord.id, 'failed');
        await supabaseHelpers.supabaseAdmin
          .from('files')
          .update({
            error_message: errorMessage,
            processing_time: processingTime,
            updated_at: new Date().toISOString()
          })
          .eq('id', fileRecord.id);
      }

      // Create usage record for failed operation
      await authHelpers.createUsageRecord(
        userId,
        operation,
        file.length,
        processingTime,
        0, // No credits deducted for failed operations
        false,
        errorMessage
      );

      return {
        success: false,
        error: errorMessage,
        processingTime
      };
    }
  }

  // Batch processing for multiple files
  async processBatch(
    userId: string,
    files: { buffer: Buffer; name: string }[],
    operation: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];

    for (const file of files) {
      const result = await this.processFile(
        userId,
        file.buffer,
        file.name,
        operation,
        options
      );
      results.push(result);
    }

    return results;
  }

  // Merge multiple PDFs
  async mergePDFs(
    userId: string,
    files: { buffer: Buffer; name: string }[],
    outputName: string = 'merged.pdf'
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      // Validate credits and permissions
      const hasCredits = await authHelpers.hasCredits(userId, files.length);
      if (!hasCredits) {
        throw new Error('Insufficient credits for merge operation');
      }

      // Merge PDFs
      const mergedBuffer = await this.converter.mergePDFs(files.map(f => f.buffer));

      // Upload merged file
      const uploadResult = await storageHelpers.uploadAndTrackFile(
        userId,
        mergedBuffer,
        outputName,
        'merge',
        {
          originalFiles: files.length.toString(),
          totalSize: files.reduce((sum, f) => sum + f.buffer.length, 0).toString()
        }
      );

      const processingTime = Date.now() - startTime;

      // Update file record
      await supabaseHelpers.updateFileStatus(uploadResult.fileRecord.id, 'completed');
      await supabaseHelpers.supabaseAdmin
        .from('files')
        .update({
          processing_time: processingTime,
          updated_at: new Date().toISOString()
        })
        .eq('id', uploadResult.fileRecord.id);

      // Deduct credits and create usage record
      await authHelpers.deductCredits(userId, files.length);
      await authHelpers.createUsageRecord(
        userId,
        'merge',
        files.reduce((sum, f) => sum + f.buffer.length, 0),
        processingTime,
        files.length,
        true
      );

      // Generate download URL
      const downloadUrl = await storageHelpers.generateSecureDownloadUrl(
        uploadResult.fileRecord.id,
        userId
      );

      return {
        success: true,
        fileId: uploadResult.fileRecord.id,
        downloadUrl,
        originalSize: files.reduce((sum, f) => sum + f.buffer.length, 0),
        processedSize: mergedBuffer.length,
        processingTime,
        metadata: { filesCount: files.length }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Merge failed';
      
      await authHelpers.createUsageRecord(
        userId,
        'merge',
        files.reduce((sum, f) => sum + f.buffer.length, 0),
        Date.now() - startTime,
        0,
        false,
        errorMessage
      );

      return {
        success: false,
        error: errorMessage,
        processingTime: Date.now() - startTime
      };
    }
  }

  // Get user's file history
  async getUserFiles(userId: string, limit: number = 50) {
    return await supabaseHelpers.getUserFiles(userId, limit);
  }

  // Get file by ID with access control
  async getFile(fileId: string, userId: string) {
    const { data: file, error } = await supabaseHelpers.supabaseAdmin
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', userId)
      .single();

    if (error || !file) {
      throw new Error('File not found or access denied');
    }

    return file;
  }

  // Delete file and cleanup S3
  async deleteFile(fileId: string, userId: string) {
    const file = await this.getFile(fileId, userId);
    
    // Delete from S3
    await s3Storage.deleteFile(file.s3_key);
    if (file.processed_url) {
      // Extract key from processed URL and delete
      const processedKey = file.processed_url.split('.amazonaws.com/')[1];
      if (processedKey) {
        await s3Storage.deleteFile(processedKey);
      }
    }

    // Delete from database
    const { error } = await supabaseHelpers.supabaseAdmin
      .from('files')
      .delete()
      .eq('id', fileId)
      .eq('user_id', userId);

    if (error) {
      throw new Error('Failed to delete file record');
    }

    return { success: true };
  }

  // Update user statistics
  private async updateUserStats(userId: string, fileSize: number) {
    const { data: user } = await supabaseHelpers.getUserById(userId);
    
    if (user) {
      await supabaseHelpers.supabaseAdmin
        .from('users')
        .update({
          total_files_processed: user.total_files_processed + 1,
          total_storage_used: user.total_storage_used + fileSize,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
    }
  }

  // Get processing queue status
  async getProcessingQueue(userId?: string) {
    let query = supabaseHelpers.supabaseAdmin
      .from('files')
      .select('id, original_name, operation_type, status, created_at, user_id')
      .eq('status', 'processing')
      .order('created_at', { ascending: true });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    
    if (error) {
      throw new Error('Failed to get processing queue');
    }

    return data || [];
  }
}

// Export singleton instance
export const pdfService = new EnhancedPDFService();
export default pdfService;
