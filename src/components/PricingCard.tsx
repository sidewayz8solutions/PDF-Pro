import { motion } from 'framer-motion'
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface Feature {
  text: string
  included: boolean
}

interface PricingCardProps {
  plan: {
    name: string
    price: number
    priceId?: string
    period?: 'month' | 'year'
    description?: string
    credits: number | 'unlimited'
    features: (string | Feature)[]
    highlighted?: boolean
    buttonText?: string
    buttonVariant?: 'primary' | 'secondary' | 'outline'
  }
  onSelect?: () => void
  loading?: boolean
  disabled?: boolean
  currentPlan?: boolean
}

export default function PricingCard({
  plan,
  onSelect,
  loading = false,
  disabled = false,
  currentPlan = false,
}: PricingCardProps) {
  const isHighlighted = plan.highlighted && !currentPlan

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative ${isHighlighted ? 'z-10' : ''}`}
    >
      <div
        className={`
          relative bg-white rounded-2xl shadow-sm overflow-hidden
          ${isHighlighted ? 'ring-2 ring-indigo-600 scale-105' : 'border border-gray-200'}
          ${currentPlan ? 'ring-2 ring-green-500' : ''}
        `}
      >
        {/* Badge */}
        {isHighlighted && (
          <div className="absolute top-0 right-0 bg-indigo-600 text-white px-4 py-1 text-sm font-medium rounded-bl-lg">
            Most Popular
          </div>
        )}
        {currentPlan && (
          <div className="absolute top-0 right-0 bg-green-500 text-white px-4 py-1 text-sm font-medium rounded-bl-lg">
            Current Plan
          </div>
        )}

        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
            {plan.description && (
              <p className="mt-2 text-sm text-gray-600">{plan.description}</p>
            )}
          </div>

          {/* Price */}
          <div className="text-center mb-6">
            <div className="flex items-baseline justify-center">
              {plan.price === 0 ? (
                <span className="text-5xl font-bold text-gray-900">Free</span>
              ) : (
                <>
                  <span className="text-5xl font-bold text-gray-900">${plan.price}</span>
                  <span className="ml-1 text-xl text-gray-500">/{plan.period || 'month'}</span>
                </>
              )}
            </div>
            <div className="mt-2 text-sm text-gray-600">
              {plan.credits === 'unlimited' ? 'Unlimited' : plan.credits} PDFs per month
            </div>
          </div>

          {/* Features */}
          <ul className="space-y-3 mb-8">
            {plan.features.map((feature, index) => {
              const isFeatureObject = typeof feature === 'object'
              const text = isFeatureObject ? feature.text : feature
              const included = isFeatureObject ? feature.included : true

              return (
                <li key={index} className="flex items-start">
                  {included ? (
                    <CheckIcon className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                  ) : (
                    <XMarkIcon className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                  )}
                  <span className={`text-sm ${included ? 'text-gray-700' : 'text-gray-400'}`}>
                    {text}
                  </span>
                </li>
              )
            })}
          </ul>

          {/* Button */}
          <button
            onClick={onSelect}
            disabled={disabled || loading || currentPlan}
            className={`
              w-full py-3 px-4 rounded-lg font-medium transition-all
              ${currentPlan
                ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                : plan.buttonVariant === 'primary' || isHighlighted
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : plan.buttonVariant === 'outline'
                ? 'bg-white text-gray-700 border-2 border-gray-300 hover:border-gray-400'
                : 'bg-gray-900 text-white hover:bg-gray-800'
              }
              ${loading ? 'opacity-50 cursor-wait' : ''}
              ${disabled && !currentPlan ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {loading ? (
              <span className="inline-flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : currentPlan ? (
              'Current Plan'
            ) : (
              plan.buttonText || 'Get Started'
            )}
          </button>
        </div>
      </div>
    </motion.div>
  )
}