import { buffer } from 'micro';
import type {
  NextApiRequest,
  NextApiResponse,
} from 'next';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

// Disable body parsing, we need raw body for webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
}

// Plan mapping
const PLAN_MAPPING: Record<string, { plan: string; credits: number }> = {
  [process.env.STRIPE_PRICE_STARTER!]: { plan: 'STARTER', credits: 100 },
  [process.env.STRIPE_PRICE_PROFESSIONAL!]: { plan: 'PROFESSIONAL', credits: 500 },
  [process.env.STRIPE_PRICE_BUSINESS!]: { plan: 'BUSINESS', credits: 99999 }, // Effectively unlimited
  [process.env.STRIPE_PRICE_STARTER_ANNUAL!]: { plan: 'STARTER', credits: 100 },
  [process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL!]: { plan: 'PROFESSIONAL', credits: 500 },
  [process.env.STRIPE_PRICE_BUSINESS_ANNUAL!]: { plan: 'BUSINESS', credits: 99999 },
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
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  try {
    // TODO: Implement Supabase webhook handlers
    console.log('Stripe webhook received:', event.type);
            where: {
              userId: session.client_reference_id!,
            },
            create: {
              userId: session.client_reference_id!,
              stripeSubscriptionId: subscription.id,
              stripePriceId: priceId,
              stripeCurrentPeriodEnd: new Date(
                subscription.current_period_end * 1000
              ),
              plan: planDetails.plan as any,
              status: 'ACTIVE',
              monthlyCredits: planDetails.credits,
              maxFileSize: 
                planDetails.plan === 'STARTER' ? 50 :
                planDetails.plan === 'PROFESSIONAL' ? 200 : 1000,
              apiAccess: ['PROFESSIONAL', 'BUSINESS'].includes(planDetails.plan),
              priorityProcessing: ['PROFESSIONAL', 'BUSINESS'].includes(planDetails.plan),
              customBranding: planDetails.plan === 'BUSINESS',
            },
            update: {
              stripeSubscriptionId: subscription.id,
              stripePriceId: priceId,
              stripeCurrentPeriodEnd: new Date(
                subscription.current_period_end * 1000
              ),
              plan: planDetails.plan as any,
              status: 'ACTIVE',
              monthlyCredits: planDetails.credits,
            },
          })

          // Update user's Stripe customer ID
          await prisma.user.update({
            where: { id: session.client_reference_id! },
            data: {
              stripeCustomerId: session.customer as string,
              monthlyCredits: planDetails.credits,
              creditsUsed: 0, // Reset on new subscription
            },
          })

          console.log(`Subscription created/updated for user ${session.client_reference_id}`)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const priceId = subscription.items.data[0].price.id
        const planDetails = PLAN_MAPPING[priceId]

        if (planDetails) {
          await prisma.subscription.update({
            where: {
              stripeSubscriptionId: subscription.id,
            },
            data: {
              stripePriceId: priceId,
              stripeCurrentPeriodEnd: new Date(
                subscription.current_period_end * 1000
              ),
              plan: planDetails.plan as any,
              status: subscription.status === 'active' ? 'ACTIVE' : 'PAST_DUE',
              monthlyCredits: planDetails.credits,
            },
          })

          console.log(`Subscription updated: ${subscription.id}`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        // Cancel subscription in database
        const dbSubscription = await prisma.subscription.update({
          where: {
            stripeSubscriptionId: subscription.id,
          },
          data: {
            status: 'CANCELED',
          },
          include: {
            user: true,
          },
        })

        // Reset user to free plan
        await prisma.user.update({
          where: { id: dbSubscription.userId },
          data: {
            monthlyCredits: 5, // Free tier
            creditsUsed: 0,
          },
        })

        console.log(`Subscription canceled: ${subscription.id}`)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        
        if (invoice.subscription) {
          const subscription = await prisma.subscription.findUnique({
            where: {
              stripeSubscriptionId: invoice.subscription as string,
            },
            include: {
              user: true,
            },
          })

          if (subscription) {
            // Reset monthly credits
            await prisma.user.update({
              where: { id: subscription.userId },
              data: {
                creditsUsed: 0,
                lastResetDate: new Date(),
              },
            })

            // TODO: Send receipt email
            console.log(`Payment succeeded for subscription: ${invoice.subscription}`)
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        
        if (invoice.subscription) {
          await prisma.subscription.update({
            where: {
              stripeSubscriptionId: invoice.subscription as string,
            },
            data: {
              status: 'PAST_DUE',
            },
          })

          // TODO: Send payment failed email
          console.log(`Payment failed for subscription: ${invoice.subscription}`)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    res.status(200).json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    res.status(500).json({ error: 'Webhook handler failed' })
  }
}