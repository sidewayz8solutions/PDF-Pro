import formidable from 'formidable';
import fs from 'fs/promises';
import type {
  NextApiRequest,
  NextApiResponse,
} from 'next';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth-supabase';
import { pdfService } from '@/lib/pdf-service-enhanced';
import { withAuth } from '@/middleware/auth.middleware';

export const config = {
  api: {
    bodyParser: false,
  },
};

interface CompressRequest {
  quality?: 'low' | 'medium' | 'high';
  removeImages?: boolean;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user session
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Parse form data
    const form = formidable({
      maxFileSize: 100 * 1024 * 1024, // 100MB
      keepExtensions: true,
    });

    const [fields, files] = await form.parse(req);

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Validate file type
    if (file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF files are allowed' });
    }

    // Read file buffer
    const fileBuffer = await fs.readFile(file.filepath);

    // Parse compression options
    const options: CompressRequest = {
      quality: (fields.quality?.[0] as any) || 'medium',
      removeImages: fields.removeImages?.[0] === 'true',
    };

    // Process the file
    const result = await pdfService.processFile(
      session.user.id,
      fileBuffer,
      file.originalFilename || 'document.pdf',
      'compress',
      options
    );

    // Clean up temp file
    await fs.unlink(file.filepath).catch(() => {});

    if (!result.success) {
      return res.status(500).json({
        error: result.error || 'Compression failed'
      });
    }

    // Return success response
    res.status(200).json({
      success: true,
      fileId: result.fileId,
      downloadUrl: result.downloadUrl,
      originalSize: result.originalSize,
      compressedSize: result.processedSize,
      compressionRatio: result.compressionRatio,
      processingTime: result.processingTime,
    });

  } catch (error) {
    console.error('Compression error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

// Export with rate limiting middleware
export default withAuth(handler, {
  requireAuth: true,
  requireSubscription: false,
  rateLimitType: 'processing',
  validateCSRF: false,
  allowedMethods: ['POST'],
});
