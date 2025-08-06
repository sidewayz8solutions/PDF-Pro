import type {
  NextApiRequest,
  NextApiResponse,
} from 'next';
import { z } from 'zod';

import { generateApiKey } from '@/lib/utils';
import { withAuth } from '@/middleware/auth.middleware';

const signupSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(100),
})

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { supabaseAdmin } = await import('@/lib/supabase');
    const bcrypt = await import('bcryptjs');

    // Validate input
    const result = signupSchema.safeParse(req.body)

    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: result.error.issues
      })
    }

    const { name, email, password } = result.data

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        name,
        email,
        password: hashedPassword,
        provider: 'credentials',
      })
      .select()
      .single();

    if (userError || !user) {
      throw new Error('Failed to create user');
    }

    // Create free subscription
    const { error: subscriptionError } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        user_id: user.id,
        plan: 'FREE',
        status: 'ACTIVE',
        monthly_credits: 5,
        max_file_size: 10,
        api_access: false,
        priority_processing: false,
        custom_branding: false,
        stripe_subscription_id: '',
        stripe_price_id: '',
        stripe_current_period_end: new Date().toISOString(),
      });

    if (subscriptionError) {
      console.error('Failed to create subscription:', subscriptionError);
    }

    // Create default API key
    const apiKey = generateApiKey()
    const { error: apiKeyError } = await supabaseAdmin
      .from('api_keys')
      .insert({
        user_id: user.id,
        name: 'Default API Key',
        key: apiKey,
        requests_per_month: 100,
        is_active: true,
      });

    if (apiKeyError) {
      console.error('Failed to create API key:', apiKeyError);
    }

    // TODO: Send welcome email
    // await sendWelcomeEmail(user.email, user.name)

    // Return success (don't send password back)
    return res.status(201).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        subscription: user.subscription,
      },
      message: 'Account created successfully',
    })

  } catch (error: any) {
    console.error('Signup error:', error)

    // Handle Prisma errors
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Email already registered' })
    }

    return res.status(500).json({
      error: 'Failed to create account',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}

// Export with rate limiting middleware for auth endpoints
export default withAuth(handler, {
  requireAuth: false,
  requireSubscription: false,
  rateLimitType: 'auth',
  validateCSRF: false,
  allowedMethods: ['POST'],
});