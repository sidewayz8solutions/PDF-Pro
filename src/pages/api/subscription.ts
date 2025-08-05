import {
  NextApiRequest,
  NextApiResponse,
} from 'next';
import { getServerSession } from 'next-auth/next';
import Stripe from 'stripe';

import { authOptions } from './auth/[...nextauth]';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*, subscriptions(*)')
      .eq('email', session.user.email)
      .single();

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (req.method === 'GET') {
      // Get current subscription status
      let subscriptionDetails = null

      if (user.subscription?.stripeSubscriptionId) {
        try {
          const stripeSubscription = await stripe.subscriptions.retrieve(
            user.subscription.stripeSubscriptionId
          )

          subscriptionDetails = {
            ...user.subscription,
            stripeStatus: stripeSubscription.status,
            currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          }
        } catch (error) {
          console.error('Error fetching Stripe subscription:', error)
        }
      }

      return res.status(200).json({
        subscription: subscriptionDetails || user.subscription,
        credits: user.monthlyCredits,
        creditsUsed: user.creditsUsed,
      })
    }

    if (req.method === 'DELETE') {
      // Cancel subscription
      if (!user.subscription?.stripeSubscriptionId) {
        return res.status(400).json({ error: 'No active subscription found' })
      }

      try {
        await stripe.subscriptions.update(
          user.subscription.stripeSubscriptionId,
          {
            cancel_at_period_end: true,
          }
        )

        return res.status(200).json({
          message: 'Subscription will be canceled at the end of the current period'
        })
      } catch (error: any) {
        console.error('Error canceling subscription:', error)
        return res.status(500).json({
          error: 'Failed to cancel subscription'
        })
      }
    }

    if (req.method === 'POST') {
      // Reactivate subscription
      const { action } = req.body

      if (action === 'reactivate' && user.subscription?.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.update(
            user.subscription.stripeSubscriptionId,
            {
              cancel_at_period_end: false,
            }
          )

          return res.status(200).json({
            message: 'Subscription reactivated successfully'
          })
        } catch (error: any) {
          console.error('Error reactivating subscription:', error)
          return res.status(500).json({
            error: 'Failed to reactivate subscription'
          })
        }
      }

      if (action === 'portal') {
        // Create customer portal session
        if (!user.stripeCustomerId) {
          return res.status(400).json({ error: 'No customer ID found' })
        }

        try {
          const portalSession = await stripe.billingPortal.sessions.create({
            customer: user.stripeCustomerId,
            return_url: `${process.env.NEXTAUTH_URL}/app/settings`,
          })

          return res.status(200).json({ url: portalSession.url })
        } catch (error: any) {
          console.error('Error creating portal session:', error)
          return res.status(500).json({
            error: 'Failed to create billing portal session'
          })
        }
      }
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error: any) {
    console.error('Subscription API error:', error)
    return res.status(500).json({
      error: error.message || 'Internal server error'
    })
  }
}
