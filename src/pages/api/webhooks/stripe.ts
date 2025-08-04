import { NextApiRequest, NextApiResponse } from 'next'
import { buffer } from 'micro'
import Stripe from 'stripe'
import { prisma } from '../../../lib/prisma'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const buf = await buffer(req)
  const sig = req.headers['stripe-signature']!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(buf, sig, endpointSecret)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).json({ error: `Webhook Error: ${err.message}` })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        break

      case 'customer.subscription.updated':
        const updatedSubscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(updatedSubscription)
        break

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(deletedSubscription)
        break

      case 'invoice.payment_succeeded':
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentSucceeded(invoice)
        break

      case 'invoice.payment_failed':
        const failedInvoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(failedInvoice)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    res.status(200).json({ received: true })
  } catch (error: any) {
    console.error('Webhook handler error:', error)
    res.status(500).json({ error: 'Webhook handler failed' })
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId
  const customerEmail = session.customer_email

  if (!userId && !customerEmail) {
    console.error('No user identifier found in checkout session')
    return
  }

  try {
    // Get subscription details
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string
    )

    // Determine plan based on price ID
    const priceId = subscription.items.data[0].price.id
    let plan = 'FREE'
    let credits = 5

    if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER) {
      plan = 'STARTER'
      credits = 100
    } else if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL) {
      plan = 'PROFESSIONAL'
      credits = 500
    } else if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS) {
      plan = 'BUSINESS'
      credits = 99999
    }

    // Find user
    const user = await prisma.user.findFirst({
      where: userId ? { id: userId } : { email: customerEmail! }
    })

    if (user) {
      // Update user's Stripe customer ID
      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripeCustomerId: session.customer as string,
          monthlyCredits: credits,
        },
      })

      // Create or update subscription
      await prisma.subscription.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
          plan: plan as any,
          status: subscription.status === 'active' ? 'ACTIVE' : 'INACTIVE',
          monthlyCredits: credits,
          maxFileSize: plan === 'STARTER' ? 50 : plan === 'PROFESSIONAL' ? 200 : plan === 'BUSINESS' ? 1000 : 10,
        },
        update: {
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
          plan: plan as any,
          status: subscription.status === 'active' ? 'ACTIVE' : 'INACTIVE',
          monthlyCredits: credits,
          maxFileSize: plan === 'STARTER' ? 50 : plan === 'PROFESSIONAL' ? 200 : plan === 'BUSINESS' ? 1000 : 10,
        },
      })

      console.log(`Updated subscription for user ${user.id}: ${plan}`)
    }
  } catch (error) {
    console.error('Error handling checkout completed:', error)
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    const existingSubscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
      include: { user: true },
    })

    if (existingSubscription) {
      await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          status: subscription.status === 'active' ? 'ACTIVE' : 'INACTIVE',
          stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
        },
      })

      console.log(`Updated subscription status for user ${existingSubscription.userId}: ${subscription.status}`)
    }
  } catch (error) {
    console.error('Error handling subscription updated:', error)
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    const existingSubscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
      include: { user: true },
    })

    if (existingSubscription) {
      // Update subscription to canceled
      await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          plan: 'FREE',
          status: 'CANCELED',
          monthlyCredits: 5,
          maxFileSize: 10,
        },
      })

      // Reset user's monthly credits
      await prisma.user.update({
        where: { id: existingSubscription.userId },
        data: {
          monthlyCredits: 5,
          stripeCustomerId: null,
        },
      })

      console.log(`Canceled subscription for user ${existingSubscription.userId}`)
    }
  } catch (error) {
    console.error('Error handling subscription deleted:', error)
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  // Handle successful recurring payments
  console.log(`Payment succeeded for invoice ${invoice.id}`)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // Handle failed payments
  console.log(`Payment failed for invoice ${invoice.id}`)
}
