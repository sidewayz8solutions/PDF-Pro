import { ReactNode } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DocumentTextIcon,
  HomeIcon,
  CreditCardIcon,
  KeyIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  SparklesIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'
import { useState } from 'react'
import UsageBar from './UsageBar'

interface LayoutProps {
  children: ReactNode
  title?: string
  showUsageBar?: boolean
}

export default function Layout({ children, title, showUsageBar = true }: LayoutProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const navigation = [
    { name: 'Dashboard', href: '/app', icon: HomeIcon },
    { name: 'Tools', href: '/app/tools', icon: DocumentTextIcon },
    { name: 'History', href: '/app/history', icon: ChartBarIcon },
    { name: 'API Keys', href: '/app/api-keys', icon: KeyIcon },
    { name: 'Billing', href: '/app/billing', icon: CreditCardIcon },
    { name: 'Settings', href: '/app/settings', icon: Cog6ToothIcon },
  ]

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' })
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    router.push('/login')
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 lg:hidden"
          >
            <div className="fixed inset-0 bg-black/50" onClick={() => setIsMobileMenuOpen(false)} />
            <motion.nav
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="fixed top-0 left-0 bottom-0 w-64 bg-white shadow-xl"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center">
                    <DocumentTextIcon className="h-8 w-8 text-indigo-600" />
                    <span className="ml-2 text-xl font-bold">PDF Pro</span>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-1">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center px-4 py-3 rounded-lg transition ${
                        router.pathname === item.href
                          ? 'bg-indigo-50 text-indigo-600'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <item.icon className="h-5 w-5 mr-3" />
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <div className="flex items-center h-16 px-6 border-b border-gray-200">
            <DocumentTextIcon className="h-8 w-8 text-indigo-600" />
            <span className="ml-2 text-xl font-bold">PDF Pro</span>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-4 py-3 rounded-lg transition ${
                  router.pathname === item.href
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <item.icon className="h-5 w-5 mr-3" />
                {item.name}
              </Link>
            ))}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <UserCircleIcon className="h-8 w-8 text-gray-400" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-700">
                    {session?.user?.name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {session?.user?.subscription?.plan || 'Free'} Plan
                  </p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="bg-white shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                >
                  <Bars3Icon className="h-6 w-6" />
                </button>
                {title && (
                  <h1 className="ml-4 lg:ml-0 text-xl font-semibold text-gray-900">
                    {title}
                  </h1>
                )}
              </div>

              <div className="flex items-center space-x-4">
                {/* Credits display */}
                <div className="flex items-center space-x-2 px-4 py-2 bg-gray-100 rounded-lg">
                  <SparklesIcon className="h-5 w-5 text-yellow-600" />
                  <span className="font-medium">
                    {session?.user?.creditsRemaining || 0} Credits
                  </span>
                </div>

                <Link
                  href="/pricing"
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Upgrade
                </Link>
              </div>
            </div>
          </div>

          {/* Usage bar */}
          {showUsageBar && session?.user && <UsageBar />}
        </header>

        {/* Page content */}
        <main className="flex-1">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}