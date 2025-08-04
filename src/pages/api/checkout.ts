import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'
import Stripe from 'stripe'

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
    
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { priceId } = req.body

    if (!priceId) {
      return res.status(400).json({ error: 'Price ID is required' })
    }

    // Create Stripe checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: session.user.email,
      success_url: `${process.env.NEXTAUTH_URL}/app?success=true`,
      cancel_url: `${process.env.NEXTAUTH_URL}/pricing?canceled=true`,
      metadata: {
        userId: session.user.id || session.user.email,
      },
      subscription_data: {
        metadata: {
          userId: session.user.id || session.user.email,
        },
      },
    })

    res.status(200).json({ sessionId: checkoutSession.id })
  } catch (error: any) {
    console.error('Checkout error:', error)
    res.status(500).json({ 
      error: error.message || 'Internal server error' 
    })
  }
}
