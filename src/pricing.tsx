import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { loadStripe } from '@stripe/stripe-js'
import toast, { Toaster } from 'react-hot-toast'
import {
  CheckIcon,
  XMarkIcon,
  SparklesIcon,
  RocketLaunchIcon,
  BuildingOfficeIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface PricingPlan {
  name: string
  price: number
  priceId: string
  priceIdAnnual: string
  credits: number
  features: string[]
  notIncluded?: string[]
  highlighted?: boolean
  icon: any
  color: string
}

const plans: PricingPlan[] = [
  {
    name: 'Free',
    price: 0,
    priceId: '',
    priceIdAnnual: '',
    credits: 5,
    features: [
      '5 PDF operations per month',
      'Files up to 10MB',
      'Basic compression',
      'Standard processing speed',
      'Download for 24 hours',
    ],
    notIncluded: [
      'API access',
      'Priority support',
      'Batch processing',
    ],
    icon: SparklesIcon,
    color: 'gray',
  },
  {
    name: 'Starter',
    price: 9,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER!,
    priceIdAnnual: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_ANNUAL!,
    credits: 100,
    features: [
      '100 PDF operations per month',
      'Files up to 50MB',
      'Advanced compression',
      'Priority processing',
      'Batch operations',
      'Download for 7 days',
      'Email support',
      'No watermarks',
    ],
    notIncluded: [
      'API access',
      'Custom branding',
    ],
    icon: RocketLaunchIcon,
    color: 'blue',
  },
  {
    name: 'Professional',
    price: 29,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL!,
    priceIdAnnual: process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL_ANNUAL!,
    credits: 500,
    features: [
      '500 PDF operations per month',
      'Files up to 200MB',
      'Maximum compression quality',
      'Instant processing',
      'API access (1,000 calls/month)',
      'Custom watermarks',
      'OCR included',
      'Download for 30 days',
      'Priority email support',
      'Advanced analytics',
    ],
    highlighted: true,
    icon: SparklesIcon,
    color: 'indigo',
  },
  {
    name: 'Business',
    price: 99,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS!,
    priceIdAnnual: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_ANNUAL!,
    credits: 99999, // Unlimited
    features: [
      'Unlimited PDF operations',
      'Files up to 1GB',
      'All features included',
      'API access (10,000 calls/month)',
      'Custom integrations',
      'White-label options',
      'SLA guarantee',
      'Dedicated account manager',
      '24/7 phone support',
      'Custom data retention',
    ],
    icon: BuildingOfficeIcon,
    color: 'purple',
  },
]

export default function PricingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [isAnnual, setIsAnnual] = useState(false)
  const [isLoading, setIsLoading] = useState<string | null>(null)

  const handleSubscribe = async (priceId: string, planName: string) => {
    if (!session) {
      router.push('/login')
      return
    }

    setIsLoading(planName)

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: isAnnual && priceId !== '' ? 
            plans.find(p => p.priceId === priceId)?.priceIdAnnual : 
            priceId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      // Redirect to Stripe Checkout
      const stripe = await stripePromise
      const { error } = await stripe!.redirectToCheckout({
        sessionId: data.sessionId,
      })

      if (error) {
        throw error
      }
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong')
      setIsLoading(null)
    }
  }

  const getButtonText = (plan: PricingPlan) => {
    if (plan.price === 0) {
      return session ? 'Current Plan' : 'Get Started Free'
    }
    if (isLoading === plan.name) {
      return 'Loading...'
    }
    if (session?.user?.subscription?.plan === plan.name.toUpperCase()) {
      return 'Current Plan'
    }
    return 'Upgrade Now'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="flex items-center">
              <DocumentTextIcon className="h-8 w-8 text-indigo-600 mr-2" />
              <span className="text-xl font-bold">PDF Pro</span>
            </Link>
            <div className="flex items-center space-x-6">
              <Link href="/app" className="text-gray-600 hover:text-gray-900">
                Dashboard
              </Link>
              {session ? (
                <span className="text-sm text-gray-600">
                  {session.user?.email}
                </span>
              ) : (
                <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Pricing Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Choose Your Plan
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Start free, upgrade anytime. No hidden fees.
            </p>

            {/* Annual/Monthly Toggle */}
            <div className="inline-flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setIsAnnual(false)}
                className={`px-4 py-2 rounded-md transition ${
                  !isAnnual
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setIsAnnual(true)}
                className={`px-4 py-2 rounded-md transition ${
                  isAnnual
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600'
                }`}
              >
                Annual
                <span className="ml-1 text-green-600 text-sm font-medium">
                  Save 20%
                </span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`relative rounded-2xl bg-white p-8 shadow-lg ${
                  plan.highlighted
                    ? 'ring-2 ring-indigo-600 scale-105'
                    : 'border border-gray-200'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-indigo-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <plan.icon className={`h-10 w-10 text-${plan.color}-600 mb-4`} />
                  <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-4xl font-bold text-gray-900">
                      ${isAnnual && plan.price > 0 ? Math.floor(plan.price * 0.8) : plan.price}
                    </span>
                    {plan.price > 0 && (
                      <span className="ml-1 text-gray-500">
                        /{isAnnual ? 'mo' : 'month'}
                      </span>
                    )}
                  </div>
                  {isAnnual && plan.price > 0 && (
                    <p className="mt-1 text-sm text-green-600">
                      ${Math.floor(plan.price * 0.8 * 12)}/year
                    </p>
                  )}
                  <p className="mt-2 text-gray-600">
                    {plan.credits === 99999 ? 'Unlimited' : plan.credits} PDFs/month
                  </p>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <CheckIcon className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                  {plan.notIncluded?.map((feature) => (
                    <li key={feature} className="flex items-start opacity-50">
                      <XMarkIcon className="h-5 w-5 text-gray-400 mr-2 flex-shrink-0" />
                      <span className="text-sm text-gray-500">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.priceId, plan.name)}
                  disabled={
                    isLoading !== null ||
                    (session?.user?.subscription?.plan === plan.name.toUpperCase() && plan.price > 0)
                  }
                  className={`w-full py-3 px-4 rounded-lg font-medium transition ${
                    plan.highlighted
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  } ${
                    isLoading !== null || 
                    (session?.user?.subscription?.plan === plan.name.toUpperCase() && plan.price > 0)
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  }`}
                >
                  {getButtonText(plan)}
                </button>
              </motion.div>
            ))}
          </div>

          {/* FAQ Section */}
          <div className="mt-20">
            <h2 className="text-3xl font-bold text-center mb-12">
              Frequently Asked Questions
            </h2>
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  Can I change plans anytime?
                </h3>
                <p className="text-gray-600">
                  Yes! You can upgrade or downgrade your plan at any time. 
                  Changes take effect immediately, and we'll prorate any charges.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  What happens if I exceed my limits?
                </h3>
                <p className="text-gray-600">
                  We'll notify you when you're close to your limit. You can 
                  upgrade your plan or purchase additional credits as needed.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  Is there a free trial?
                </h3>
                <p className="text-gray-600">
                  Better than a trial - start with our Free plan and upgrade 
                  only when you need more. No credit card required to start.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  Do you offer refunds?
                </h3>
                <p className="text-gray-600">
                  Yes, we offer a 30-day money-back guarantee. If you're not 
                  satisfied, contact support for a full refund.
                </p>
              </div>
            </div>
          </div>

          {/* Money Back Guarantee */}
          <div className="mt-12 text-center">
            <div className="inline-flex items-center px-6 py-3 bg-green-100 rounded-full">
              <CurrencyDollarIcon className="h-6 w-6 text-green-600 mr-2" />
              <span className="text-green-800 font-medium">
                30-day money-back guarantee on all paid plans
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

         