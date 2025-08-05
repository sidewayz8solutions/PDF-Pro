import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

// Initialize S3 client if AWS credentials are provided
const s3Client = null // TODO: Implement when AWS SDK is installed
/*
const s3Client = process.env.AWS_ACCESS_KEY_ID
  ? new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  : null

// For Cloudflare R2 (S3-compatible)
const r2Client = process.env.R2_ACCESS_KEY_ID
  ? new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null
*/

const storageClient = null // TODO: Implement when AWS SDK is installed
const bucketName = process.env.R2_BUCKET_NAME || process.env.S3_BUCKET_NAME || 'pdf-pro-files'

export async function uploadToS3(
  buffer: Buffer,
  filename: string,
  metadata?: Record<string, string>
): Promise<string> {
  // TODO: Implement cloud storage when AWS SDK is installed
  // For now, use local storage fallback
  return uploadToLocal(buffer, filename)

  /* Original implementation - uncomment when AWS SDK is installed
  if (!storageClient) {
    return uploadToLocal(buffer, filename)
  }

  try {
    const key = `uploads/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${filename}`

    await storageClient.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: getContentType(filename),
        Metadata: metadata,
      })
    )

    // Return the public URL or generate a signed URL
    if (process.env.R2_PUBLIC_URL) {
      return `${process.env.R2_PUBLIC_URL}/${key}`
    } else if (process.env.S3_PUBLIC_URL) {
      return `${process.env.S3_PUBLIC_URL}/${key}`
    } else {
      // Generate signed URL for private buckets
      return await getSignedDownloadUrl(key)
    }
  } catch (error) {
    console.error('S3 upload error:', error)
    // Fallback to local storage
    return uploadToLocal(buffer, filename)
  }
  */
}

export async function uploadToLocal(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads')
  const yearMonth = `${new Date().getFullYear()}/${new Date().getMonth() + 1}`
  const fullDir = path.join(uploadDir, yearMonth)
  
  // Ensure directory exists
  await fs.mkdir(fullDir, { recursive: true })
  
  const filePath = path.join(fullDir, filename)
  await fs.writeFile(filePath, buffer)
  
  // Return public URL
  return `/uploads/${yearMonth}/${filename}`
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour
): Promise<string> {
  // TODO: Implement when AWS SDK is installed
  throw new Error('Cloud storage not configured - AWS SDK required')

  /* Original implementation - uncomment when AWS SDK is installed
  if (!storageClient) {
    throw new Error('No storage client configured')
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  })

  return await getSignedUrl(storageClient, command, { expiresIn })
  */
}

export async function deleteFile(key: string): Promise<void> {
  // Delete from local storage only for now
  const filePath = path.join(process.cwd(), 'public', key)
  await fs.unlink(filePath).catch(() => {})

  /* Original cloud storage implementation - uncomment when AWS SDK is installed
  if (!storageClient) {
    // Delete from local storage
    const filePath = path.join(process.cwd(), 'public', key)
    await fs.unlink(filePath).catch(() => {})
    return
  }

  try {
    await storageClient.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    )
  } catch (error) {
    console.error('Delete file error:', error)
  }
  */
}

export function generateUniqueFilename(originalName: string): string {
  const ext = path.extname(originalName)
  const name = path.basename(originalName, ext)
  const uniqueId = crypto.randomBytes(8).toString('hex')
  const timestamp = Date.now()
  
  // Sanitize filename
  const sanitized = name
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .substring(0, 50)
  
  return `${sanitized}_${timestamp}_${uniqueId}${ext}`
}

function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  
  const contentTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
  }
  
  return contentTypes[ext] || 'application/octet-stream'
}

// Cleanup old files (run periodically)
export async function cleanupOldFiles(olderThanDays: number = 1): Promise<void> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

  try {
    // Clean database records
    const deletedFiles = await prisma?.file.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    })

    console.log(`Cleaned up ${deletedFiles?.count || 0} expired files`)

    // For local storage, scan and delete old files
    if (!storageClient) {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads')
      await cleanupLocalDirectory(uploadDir, cutoffDate)
    }
  } catch (error) {
    console.error('Cleanup error:', error)
  }
}

async function cleanupLocalDirectory(dir: string, cutoffDate: Date): Promise<void> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      
      if (entry.isDirectory()) {
        await cleanupLocalDirectory(fullPath, cutoffDate)
      } else {
        const stats = await fs.stat(fullPath)
        if (stats.mtime < cutoffDate) {
          await fs.unlink(fullPath)
        }
      }
    }
  } catch (error) {
    console.error('Local cleanup error:', error)
  }
}