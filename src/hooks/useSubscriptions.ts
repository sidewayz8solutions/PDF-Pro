import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'
import { loadStripe } from '@stripe/stripe-js'
import toast from 'react-hot-toast'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface PlanFeatures {
  monthlyCredits: number
  maxFileSize: number
  apiCalls: number
  supportLevel: string
  processingPriority: string
  dataRetention: number
  features: string[]
}

interface Plan {
  id: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'BUSINESS'
  name: string
  price: {
    monthly: number
    annual: number
  }
  stripePriceId: {
    monthly: string
    annual: string
  }
  features: PlanFeatures
  popular?: boolean
}

interface Subscription {
  id: string
  plan: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'BUSINESS'
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'PAUSED'
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  stripeSubscriptionId?: string
}

interface UsageStats {
  creditsUsed: number
  creditsRemaining: number
  apiCallsUsed: number
  apiCallsRemaining: number
  storageUsed: number
  currentPeriodStart: Date
  currentPeriodEnd: Date
}

export function useSubscriptions() {
  const { user, isAuthenticated, refreshSession } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)

  // Available plans configuration
  const plans: Plan[] = [
    {
      id: 'FREE',
      name: 'Free',
      price: { monthly: 0, annual: 0 },
      stripePriceId: { monthly: '', annual: '' },
      features: {
        monthlyCredits: 5,
        maxFileSize: 10,
        apiCalls: 0,
        supportLevel: 'Community',
        processingPriority: 'Standard',
        dataRetention: 1,
        features: ['Basic PDF tools', 'Watermarking', 'Community support'],
      },
    },
    {
      id: 'STARTER',
      name: 'Starter',
      price: { monthly: 9, annual: 86 },
      stripePriceId: {
        monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER!,
        annual: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_ANNUAL!,
      },
      features: {
        monthlyCredits: 100,
        maxFileSize: 50,
        apiCalls: 0,
        supportLevel: 'Email',
        processingPriority: 'Priority',
        dataRetention: 7,
        features: ['All PDF tools', 'Content extraction', 'Email support', 'Priority processing'],
      },
    },
    {
      id: 'PROFESSIONAL',
      name: 'Professional',
      price: { monthly: 29, annual: 278 },
      stripePriceId: {
        monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL!,
        annual: process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL_ANNUAL!,
      },
      popular: true,
      features: {
        monthlyCredits: 500,
        maxFileSize: 200,
        apiCalls: 1000,
        supportLevel: 'Priority',
        processingPriority: 'Instant',
        dataRetention: 30,
        features: ['Everything in Starter', 'PDF protection', 'API access', 'Priority support'],
      },
    },
    {
      id: 'BUSINESS',
      name: 'Business',
      price: { monthly: 99, annual: 950 },
      stripePriceId: {
        monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS!,
        annual: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_ANNUAL!,
      },
      features: {
        monthlyCredits: 99999,
        maxFileSize: 1000,
        apiCalls: 10000,
        supportLevel: '24/7',
        processingPriority: 'Instant',
        dataRetention: 365,
        features: ['Everything in Professional', 'Digital signatures', 'Custom branding', '24/7 support'],
      },
    },
  ]

  // Get current subscription
  const currentSubscription: Subscription | null = user?.subscription ? {
    id: user.subscription.plan,
    plan: user.subscription.plan,
    status: user.subscription.status,
    currentPeriodEnd: user.subscription.stripeCurrentPeriodEnd || new Date(),
    cancelAtPeriodEnd: false, // Would need to fetch from Stripe
    stripeSubscriptionId: user.subscription.stripeSubscriptionId,
  } : null

  // Get current plan details
  const currentPlan = plans.find(plan => plan.id === currentSubscription?.plan) || plans[0]

  // Fetch usage statistics
  const fetchUsageStats = useCallback(async () => {
    if (!isAuthenticated) return

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/user/usage')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch usage stats')
      }

      setUsageStats(data)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch usage stats'
      setError(errorMessage)
      console.error('Usage stats error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  // Load usage stats on mount and when user changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchUsageStats()
    }
  }, [isAuthenticated, fetchUsageStats])

  // Create checkout session
  const createCheckoutSession = useCallback(async (
    planId: string,
    billing: 'monthly' | 'annual' = 'monthly'
  ) => {
    if (!isAuthenticated) {
      toast.error('Please log in to subscribe')
      return { success: false, error: 'Not authenticated' }
    }

    try {
      setIsLoading(true)
      setError(null)

      const plan = plans.find(p => p.id === planId)
      if (!plan) {
        throw new Error('Invalid plan selected')
      }

      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: plan.stripePriceId[billing],
          planId,
          billing,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      const stripe = await stripePromise
      if (!stripe) {
        throw new Error('Stripe failed to load')
      }

      const { error } = await stripe.redirectToCheckout({
        sessionId: data.sessionId,
      })

      if (error) {
        throw new Error(error.message)
      }

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start checkout'
      setError(errorMessage)
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, plans])

  // Create customer portal session
  const createPortalSession = useCallback(async () => {
    if (!isAuthenticated || !currentSubscription?.stripeSubscriptionId) {
      toast.error('No active subscription found')
      return { success: false, error: 'No active subscription' }
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create portal session')
      }

      window.location.href = data.url
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to open billing portal'
      setError(errorMessage)
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, currentSubscription])

  // Cancel subscription
  const cancelSubscription = useCallback(async () => {
    if (!currentSubscription?.stripeSubscriptionId) {
      toast.error('No active subscription found')
      return { success: false, error: 'No active subscription' }
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: currentSubscription.stripeSubscriptionId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel subscription')
      }

      await refreshSession()
      toast.success('Subscription cancelled successfully')
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel subscription'
      setError(errorMessage)
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }, [currentSubscription, refreshSession])

  // Get plan by ID
  const getPlan = useCallback((planId: string) => {
    return plans.find(plan => plan.id === planId)
  }, [plans])

  // Check if user can upgrade to a plan
  const canUpgradeTo = useCallback((planId: string): boolean => {
    const targetPlan = getPlan(planId)
    if (!targetPlan || !currentPlan) return false
    
    const planHierarchy = ['FREE', 'STARTER', 'PROFESSIONAL', 'BUSINESS']
    const currentIndex = planHierarchy.indexOf(currentPlan.id)
    const targetIndex = planHierarchy.indexOf(targetPlan.id)
    
    return targetIndex > currentIndex
  }, [currentPlan, getPlan])

  // Calculate savings for annual billing
  const getAnnualSavings = useCallback((planId: string): number => {
    const plan = getPlan(planId)
    if (!plan) return 0
    
    const monthlyTotal = plan.price.monthly * 12
    const annualPrice = plan.price.annual
    return monthlyTotal - annualPrice
  }, [getPlan])

  return {
    // Data
    plans,
    currentPlan,
    currentSubscription,
    usageStats,
    
    // State
    isLoading,
    error,
    
    // Actions
    createCheckoutSession,
    createPortalSession,
    cancelSubscription,
    fetchUsageStats,
    
    // Utilities
    getPlan,
    canUpgradeTo,
    getAnnualSavings,
  }
}
