import type {
  NextApiRequest,
  NextApiResponse,
} from 'next';
import { getServerSession } from 'next-auth';
import Stripe from 'stripe';

import { authOptions } from './auth/[...nextauth]';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const session = await getServerSession(req, res, authOptions)
    
    if (!session || !session.user?.email) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { priceId } = req.body

    if (!priceId) {
      return res.status(400).json({ error: 'Price ID is required' })
    }

    // Create or retrieve Stripe customer
    let customer
    
    if (session.user.stripeCustomerId) {
      customer = await stripe.customers.retrieve(session.user.stripeCustomerId)
    } else {
      // Search for existing customer by email
      const customers = await stripe.customers.list({
        email: session.user.email,
        limit: 1,
      })

      if (customers.data.length > 0) {
        customer = customers.data[0]
      } else {
        // Create new customer
        customer = await stripe.customers.create({
          email: session.user.email,
          name: session.user.name || undefined,
          metadata: {
            userId: session.user.id,
          },
        })
      }
    }

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      mode: 'subscription',
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXTAUTH_URL}/app?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/pricing?canceled=true`,
      client_reference_id: session.user.id,
      subscription_data: {
        metadata: {
          userId: session.user.id,
        },
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel',
          },
        },
      },
      metadata: {
        userId: session.user.id,
      },
    })

    return res.status(200).json({ 
      sessionId: checkoutSession.id,
      url: checkoutSession.url 
    })
  } catch (error: any) {
    console.error('Checkout error:', error)
    return res.status(500).json({ 
      error: 'Failed to create checkout session',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}