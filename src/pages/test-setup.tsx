import { useState } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { loadStripe } from '@stripe/stripe-js'
import toast, { Toaster } from 'react-hot-toast'
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  CreditCardIcon,
  UserIcon,
} from '@heroicons/react/24/outline'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export default function TestSetupPage() {
  const { data: session, status } = useSession()
  const [testResults, setTestResults] = useState<any>({})
  const [isLoading, setIsLoading] = useState(false)

  const runTests = async () => {
    setIsLoading(true)
    const results: any = {}

    // Test 1: Environment Variables
    results.envVars = {
      nextAuthUrl: !!process.env.NEXTAUTH_URL,
      nextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      googleClientId: !!process.env.GOOGLE_CLIENT_ID,
      googleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      stripePublishable: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      stripeSecret: !!process.env.STRIPE_SECRET_KEY,
      stripePrices: !!(
        process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER &&
        process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL &&
        process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS
      ),
    }

    // Test 2: Stripe Connection
    try {
      const stripe = await stripePromise
      results.stripe = {
        loaded: !!stripe,
        publishableKey: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      }
    } catch (error) {
      results.stripe = { error: 'Failed to load Stripe' }
    }

    // Test 3: API Endpoints
    try {
      const authResponse = await fetch('/api/auth/providers')
      results.authProviders = {
        status: authResponse.status,
        working: authResponse.ok,
      }
    } catch (error) {
      results.authProviders = { error: 'Auth API not accessible' }
    }

    setTestResults(results)
    setIsLoading(false)
  }

  const testStripeCheckout = async () => {
    if (!session) {
      toast.error('Please sign in first to test Stripe')
      return
    }

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER,
        }),
      })

      if (response.ok) {
        toast.success('Stripe checkout API is working!')
      } else {
        const error = await response.json()
        toast.error(`Stripe error: ${error.error}`)
      }
    } catch (error) {
      toast.error('Failed to test Stripe checkout')
    }
  }

  const StatusIcon = ({ status }: { status: boolean | undefined }) => {
    if (status === true) return <CheckCircleIcon className="h-5 w-5 text-green-500" />
    if (status === false) return <XCircleIcon className="h-5 w-5 text-red-500" />
    return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <Toaster position="top-right" />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            🧪 PDF Pro Setup Test
          </h1>

          {/* Current Session Status */}
          <div className="mb-8 p-4 bg-blue-50 rounded-lg">
            <h2 className="text-lg font-semibold mb-2 flex items-center">
              <UserIcon className="h-5 w-5 mr-2" />
              Authentication Status
            </h2>
            {status === 'loading' && <p>Loading session...</p>}
            {status === 'unauthenticated' && (
              <div>
                <p className="text-gray-600 mb-4">Not signed in</p>
                <button
                  onClick={() => signIn('google')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 mr-4"
                >
                  Sign in with Google
                </button>
                <button
                  onClick={() => signIn('credentials')}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Sign in with Email
                </button>
              </div>
            )}
            {status === 'authenticated' && session && (
              <div>
                <p className="text-green-600 mb-2">
                  ✅ Signed in as: {session.user?.email}
                </p>
                <button
                  onClick={() => signOut()}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>

          {/* Test Controls */}
          <div className="mb-8">
            <button
              onClick={runTests}
              disabled={isLoading}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 mr-4"
            >
              {isLoading ? 'Running Tests...' : 'Run Setup Tests'}
            </button>
            
            <button
              onClick={testStripeCheckout}
              disabled={!session}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <CreditCardIcon className="h-5 w-5 inline mr-2" />
              Test Stripe Checkout
            </button>
          </div>

          {/* Test Results */}
          {Object.keys(testResults).length > 0 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-gray-900">Test Results</h2>

              {/* Environment Variables */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-3">Environment Variables</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <StatusIcon status={testResults.envVars?.nextAuthUrl} />
                    <span className="ml-2">NEXTAUTH_URL</span>
                  </div>
                  <div className="flex items-center">
                    <StatusIcon status={testResults.envVars?.nextAuthSecret} />
                    <span className="ml-2">NEXTAUTH_SECRET</span>
                  </div>
                  <div className="flex items-center">
                    <StatusIcon status={testResults.envVars?.googleClientId} />
                    <span className="ml-2">GOOGLE_CLIENT_ID</span>
                  </div>
                  <div className="flex items-center">
                    <StatusIcon status={testResults.envVars?.googleClientSecret} />
                    <span className="ml-2">GOOGLE_CLIENT_SECRET</span>
                  </div>
                  <div className="flex items-center">
                    <StatusIcon status={testResults.envVars?.stripePublishable} />
                    <span className="ml-2">STRIPE_PUBLISHABLE_KEY</span>
                  </div>
                  <div className="flex items-center">
                    <StatusIcon status={testResults.envVars?.stripePrices} />
                    <span className="ml-2">STRIPE_PRICE_IDs</span>
                  </div>
                </div>
              </div>

              {/* Stripe Status */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-3">Stripe Integration</h3>
                <div className="flex items-center">
                  <StatusIcon status={testResults.stripe?.loaded} />
                  <span className="ml-2">Stripe SDK Loaded</span>
                </div>
              </div>

              {/* API Endpoints */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-3">API Endpoints</h3>
                <div className="flex items-center">
                  <StatusIcon status={testResults.authProviders?.working} />
                  <span className="ml-2">NextAuth API</span>
                </div>
              </div>
            </div>
          )}

          {/* Setup Instructions */}
          <div className="mt-8 p-4 bg-yellow-50 rounded-lg">
            <h3 className="text-lg font-medium mb-2">📋 Setup Instructions</h3>
            <p className="text-gray-700 mb-4">
              Follow the instructions in <code>setup-credentials.md</code> to configure:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Google OAuth credentials from Google Cloud Console</li>
              <li>Stripe API keys and product price IDs</li>
              <li>Update the .env.local file with your actual credentials</li>
              <li>Restart the development server after updating environment variables</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
