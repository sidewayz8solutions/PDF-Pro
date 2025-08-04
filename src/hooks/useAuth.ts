import { useState, useEffect, useCallback } from 'react'
import { useSession, signIn, signOut, getSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'

interface User {
  id: string
  email: string
  name?: string | null
  image?: string | null
  subscription?: {
    stripeSubscriptionId: string | undefined
    plan: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'BUSINESS'
    status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'PAUSED'
    monthlyCredits: number
    maxFileSize: number
    apiAccess: boolean
    priorityProcessing: boolean
    customBranding: boolean
    stripeCurrentPeriodEnd?: Date
  }
  creditsRemaining?: number
  stripeCustomerId?: string
}

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
}

interface LoginCredentials {
  email: string
  password: string
}

interface SignupData {
  email: string
  password: string
  name?: string
}

export function useAuth() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  })

  // Update auth state when session changes
  useEffect(() => {
    setAuthState({
      user: session?.user as User | null,
      isLoading: status === 'loading',
      isAuthenticated: !!session?.user,
      error: null,
    })
  }, [session, status])

  // Login with email and password
  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }))
      
      const result = await signIn('credentials', {
        email: credentials.email,
        password: credentials.password,
        redirect: false,
      })

      if (result?.error) {
        throw new Error(result.error)
      }

      if (result?.ok) {
        toast.success('Successfully logged in!')
        router.push('/app')
        return { success: true }
      }

      throw new Error('Login failed')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed'
      setAuthState(prev => ({ ...prev, error: errorMessage, isLoading: false }))
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [router])

  // Login with Google
  const loginWithGoogle = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }))
      
      const result = await signIn('google', {
        callbackUrl: '/app',
      })

      if (result?.error) {
        throw new Error(result.error)
      }

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Google login failed'
      setAuthState(prev => ({ ...prev, error: errorMessage, isLoading: false }))
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [])

  // Signup with email and password
  const signup = useCallback(async (data: SignupData) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }))
      
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Signup failed')
      }

      toast.success('Account created successfully! Please log in.')
      router.push('/login')
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Signup failed'
      setAuthState(prev => ({ ...prev, error: errorMessage, isLoading: false }))
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [router])

  // Logout
  const logout = useCallback(async () => {
    try {
      await signOut({ callbackUrl: '/' })
      toast.success('Successfully logged out!')
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Logout failed'
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [])

  // Refresh session data
  const refreshSession = useCallback(async () => {
    try {
      await getSession()
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh session'
      setAuthState(prev => ({ ...prev, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }, [])

  // Update user profile
  const updateProfile = useCallback(async (data: { name?: string; email?: string }) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }))
      
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update profile')
      }

      await refreshSession()
      toast.success('Profile updated successfully!')
      return { success: true, data: result }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile'
      setAuthState(prev => ({ ...prev, error: errorMessage, isLoading: false }))
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [refreshSession])

  // Change password
  const changePassword = useCallback(async (data: { currentPassword: string; newPassword: string }) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }))
      
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to change password')
      }

      toast.success('Password changed successfully!')
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to change password'
      setAuthState(prev => ({ ...prev, error: errorMessage, isLoading: false }))
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [])

  // Check if user has specific permission
  const hasPermission = useCallback((permission: 'apiAccess' | 'priorityProcessing' | 'customBranding'): boolean => {
    if (!authState.user?.subscription || authState.user.subscription.status !== 'ACTIVE') {
      return false
    }
    return authState.user.subscription[permission] === true
  }, [authState.user])

  // Check if user can access specific feature
  const canAccessFeature = useCallback((feature: 'watermark' | 'extract' | 'protect' | 'sign' | 'api'): boolean => {
    if (!authState.user?.subscription || authState.user.subscription.status !== 'ACTIVE') {
      return feature === 'watermark' // Free users can watermark
    }
    
    const plan = authState.user.subscription.plan
    
    switch (feature) {
      case 'watermark':
        return true // All plans
      case 'extract':
        return ['STARTER', 'PROFESSIONAL', 'BUSINESS'].includes(plan)
      case 'protect':
        return ['PROFESSIONAL', 'BUSINESS'].includes(plan)
      case 'sign':
        return plan === 'BUSINESS'
      case 'api':
        return ['PROFESSIONAL', 'BUSINESS'].includes(plan)
      default:
        return false
    }
  }, [authState.user])

  // Get remaining credits
  const getRemainingCredits = useCallback((): number => {
    if (!authState.user?.subscription) return 0
    return authState.user.subscription.monthlyCredits - (authState.user.creditsRemaining || 0)
  }, [authState.user])

  // Check if user has enough credits
  const hasCredits = useCallback((required: number = 1): boolean => {
    return getRemainingCredits() >= required
  }, [getRemainingCredits])

  return {
    // State
    ...authState,
    
    // Actions
    login,
    loginWithGoogle,
    signup,
    logout,
    refreshSession,
    updateProfile,
    changePassword,
    
    // Utilities
    hasPermission,
    canAccessFeature,
    getRemainingCredits,
    hasCredits,
  }
}
