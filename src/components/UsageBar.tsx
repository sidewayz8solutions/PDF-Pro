import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  SparklesIcon, 
  ArrowTrendingUpIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline'
import { calculatePercentage, formatDate } from '@/lib/utils'

export default function UsageBar() {
  const { data: session } = useSession()
  
  if (!session?.user) return null

  const subscription = session.user.subscription
  const creditsUsed = session.user.creditsUsed || 0
  const totalCredits = subscription?.monthlyCredits || 5
  const creditsRemaining = Math.max(0, totalCredits - creditsUsed)
  const usagePercentage = calculatePercentage(creditsUsed, totalCredits)
  const isNearLimit = usagePercentage >= 80
  const isAtLimit = creditsRemaining === 0

  // Calculate days until reset
  const currentPeriodEnd = subscription?.currentPeriodEnd || session.user.lastResetDate
  const daysUntilReset = currentPeriodEnd 
    ? Math.ceil((new Date(currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 30

  return (
    <div className="bg-white border-t border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
          {/* Usage Progress */}
          <div className="flex-1 max-w-2xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <SparklesIcon className="h-5 w-5 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-700">
                  Monthly Usage
                </span>
              </div>
              <span className="text-sm text-gray-600">
                {creditsUsed} / {totalCredits === 99999 ? '∞' : totalCredits} credits used
              </span>
            </div>
            
            {/* Progress Bar */}
            <div className="relative">
              <div className="overflow-hidden h-2 text-xs flex rounded-full bg-gray-200">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(usagePercentage, 100)}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className={`
                    shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center
                    ${isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-yellow-500' : 'bg-indigo-600'}
                  `}
                />
              </div>
              
              {/* Warning indicator */}
              {isNearLimit && !isAtLimit && (
                <div className="absolute -top-1 -right-1">
                  <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
                </div>
              )}
            </div>

            {/* Warning message */}
            {isAtLimit && (
              <p className="mt-2 text-sm text-red-600">
                You've reached your monthly limit. 
                <Link href="/pricing" className="ml-1 font-medium underline">
                  Upgrade to continue
                </Link>
              </p>
            )}
            {isNearLimit && !isAtLimit && (
              <p className="mt-2 text-sm text-yellow-600">
                You're approaching your monthly limit ({creditsRemaining} credits remaining)
              </p>
            )}
          </div>

          {/* Stats and Actions */}
          <div className="flex items-center space-x-4 sm:ml-6">
            {/* Reset date */}
            <div className="flex items-center text-sm text-gray-500">
              <CalendarDaysIcon className="h-4 w-4 mr-1" />
              <span>
                Resets in {daysUntilReset} day{daysUntilReset !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Upgrade button */}
            {subscription?.plan !== 'BUSINESS' && (
              <Link
                href="/pricing"
                className="inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
              >
                <ArrowTrendingUpIcon className="h-4 w-4 mr-1" />
                Upgrade
              </Link>
            )}
          </div>
        </div>

        {/* Additional stats for paid plans */}
        {subscription && subscription.plan !== 'FREE' && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
            <div>
              <p className="text-xs text-gray-500">Plan</p>
              <p className="text-sm font-medium text-gray-900">{subscription.plan}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Max File Size</p>
              <p className="text-sm font-medium text-gray-900">{subscription.maxFileSize}MB</p>
            </div>
            {subscription.apiAccess && (
              <div>
                <p className="text-xs text-gray-500">API Access</p>
                <p className="text-sm font-medium text-green-600">Enabled</p>
              </div>
            )}
            {subscription.priorityProcessing && (
              <div>
                <p className="text-xs text-gray-500">Processing</p>
                <p className="text-sm font-medium text-indigo-600">Priority</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}