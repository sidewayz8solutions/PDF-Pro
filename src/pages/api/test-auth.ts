import type {
  NextApiRequest,
  NextApiResponse,
} from 'next';
import { getServerSession } from 'next-auth';

import { withAuth } from '@/middleware/auth.middleware';

import { authOptions } from './auth/[...nextauth]';

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const session = await getServerSession(req, res, authOptions);

    return res.status(200).json({
      authenticated: !!session,
      user: session?.user || null,
      session: session || null
    });
  } catch (error: any) {
    console.error('Auth test error:', error);
    return res.status(500).json({
      error: 'Auth test failed',
      details: error.message
    });
  }
}

// Export with rate limiting middleware
export default withAuth(handler, {
  requireAuth: false,
  requireSubscription: false,
  rateLimitType: 'general',
  validateCSRF: false,
  allowedMethods: ['GET'],
});
