import crypto from 'crypto';
import { 
  S3Client, 
  PutObjectCommand, 
  DeleteObjectCommand, 
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { supabaseHelpers } from './supabase';

// AWS S3 Configuration
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET!;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID!;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY!;

if (!AWS_S3_BUCKET || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  throw new Error('Missing AWS S3 configuration. Please check your environment variables.');
}

// Initialize S3 client
export const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

// S3 Storage Service
export class S3StorageService {
  private bucket: string;
  private client: S3Client;

  constructor() {
    this.bucket = AWS_S3_BUCKET;
    this.client = s3Client;
  }

  // Generate unique file key
  generateFileKey(userId: string, originalName: string, operation: string): string {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);
    
    return `users/${userId}/${operation}/${timestamp}-${randomId}-${baseName}${extension}`;
  }

  // Upload file to S3
  async uploadFile(
    buffer: Buffer, 
    key: string, 
    contentType: string = 'application/pdf',
    metadata?: Record<string, string>
  ): Promise<{ url: string; key: string }> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: metadata,
        ServerSideEncryption: 'AES256',
      });

      await this.client.send(command);
      
      const url = `https://${this.bucket}.s3.${AWS_REGION}.amazonaws.com/${key}`;
      return { url, key };
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new Error(`Failed to upload file to S3: ${error}`);
    }
  }

  // Get signed URL for secure file access
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      console.error('S3 signed URL error:', error);
      throw new Error(`Failed to generate signed URL: ${error}`);
    }
  }

  // Get signed URL for file upload (for direct client uploads)
  async getUploadSignedUrl(
    key: string, 
    contentType: string = 'application/pdf',
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
      });

      const signedUrl = await getSignedUrl(this.client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      console.error('S3 upload signed URL error:', error);
      throw new Error(`Failed to generate upload signed URL: ${error}`);
    }
  }

  // Download file from S3
  async downloadFile(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);
      
      if (!response.Body) {
        throw new Error('No file content received');
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const stream = response.Body as any;
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      return Buffer.concat(chunks);
    } catch (error) {
      console.error('S3 download error:', error);
      throw new Error(`Failed to download file from S3: ${error}`);
    }
  }

  // Delete file from S3
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
    } catch (error) {
      console.error('S3 delete error:', error);
      throw new Error(`Failed to delete file from S3: ${error}`);
    }
  }

  // Copy file within S3
  async copyFile(sourceKey: string, destinationKey: string): Promise<string> {
    try {
      const command = new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${sourceKey}`,
        Key: destinationKey,
        ServerSideEncryption: 'AES256',
      });

      await this.client.send(command);
      
      const url = `https://${this.bucket}.s3.${AWS_REGION}.amazonaws.com/${destinationKey}`;
      return url;
    } catch (error) {
      console.error('S3 copy error:', error);
      throw new Error(`Failed to copy file in S3: ${error}`);
    }
  }

  // Get file metadata
  async getFileMetadata(key: string): Promise<any> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);
      return {
        size: response.ContentLength,
        lastModified: response.LastModified,
        contentType: response.ContentType,
        metadata: response.Metadata,
      };
    } catch (error) {
      console.error('S3 metadata error:', error);
      throw new Error(`Failed to get file metadata: ${error}`);
    }
  }

  // List user files
  async listUserFiles(userId: string, prefix?: string): Promise<any[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix || `users/${userId}/`,
        MaxKeys: 1000,
      });

      const response = await this.client.send(command);
      return response.Contents || [];
    } catch (error) {
      console.error('S3 list error:', error);
      throw new Error(`Failed to list user files: ${error}`);
    }
  }

  // Clean up expired files
  async cleanupExpiredFiles(): Promise<number> {
    try {
      // Get expired files from Supabase
      const expiredFiles = await supabaseHelpers.supabaseAdmin
        .from('files')
        .select('s3_key')
        .lt('expires_at', new Date().toISOString())
        .not('s3_key', 'is', null);

      if (expiredFiles.error || !expiredFiles.data) {
        throw new Error(`Failed to get expired files: ${expiredFiles.error?.message}`);
      }

      let deletedCount = 0;

      // Delete files from S3
      for (const file of expiredFiles.data) {
        try {
          await this.deleteFile(file.s3_key);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete file ${file.s3_key}:`, error);
        }
      }

      // Update database to remove expired file records
      if (deletedCount > 0) {
        await supabaseHelpers.supabaseAdmin
          .from('files')
          .delete()
          .lt('expires_at', new Date().toISOString());
      }

      console.log(`Cleaned up ${deletedCount} expired files`);
      return deletedCount;
    } catch (error) {
      console.error('Cleanup error:', error);
      throw new Error(`Failed to cleanup expired files: ${error}`);
    }
  }
}

// Export singleton instance
export const s3Storage = new S3StorageService();

// Helper functions for common operations
export const storageHelpers = {
  // Upload and track file
  async uploadAndTrackFile(
    userId: string,
    file: Buffer,
    originalName: string,
    operation: string,
    metadata?: Record<string, string>
  ) {
    const key = s3Storage.generateFileKey(userId, originalName, operation);
    const { url } = await s3Storage.uploadFile(file, key, 'application/pdf', metadata);
    
    // Create file record in Supabase
    const fileRecord = await supabaseHelpers.createFileRecord({
      user_id: userId,
      original_name: originalName,
      file_size: file.length,
      file_type: 'application/pdf',
      s3_key: key,
      s3_url: url,
      operation_type: operation as any,
      status: 'pending',
    });

    return { fileRecord: fileRecord.data, s3Key: key, s3Url: url };
  },

  // Generate secure download URL
  async generateSecureDownloadUrl(fileId: string, userId: string): Promise<string> {
    // Get file record from Supabase
    const { data: file, error } = await supabaseHelpers.supabaseAdmin
      .from('files')
      .select('s3_key, user_id')
      .eq('id', fileId)
      .eq('user_id', userId)
      .single();

    if (error || !file) {
      throw new Error('File not found or access denied');
    }

    // Generate signed URL
    return await s3Storage.getSignedUrl(file.s3_key, 3600); // 1 hour expiry
  },

  // Get user storage usage
  async getUserStorageUsage(userId: string): Promise<{ totalSize: number; fileCount: number }> {
    const { data: files, error } = await supabaseHelpers.supabaseAdmin
      .from('files')
      .select('file_size')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to get user storage usage: ${error.message}`);
    }

    const totalSize = files?.reduce((sum, file) => sum + file.file_size, 0) || 0;
    const fileCount = files?.length || 0;

    return { totalSize, fileCount };
  },
};

export default s3Storage;
