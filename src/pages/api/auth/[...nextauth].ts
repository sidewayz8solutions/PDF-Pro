import NextAuth, { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { generateApiKey } from '@/lib/utils'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // Email/Password authentication
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user || !user.password) {
          throw new Error('Invalid credentials')
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          throw new Error('Invalid credentials')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      }
    }),
    
    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  
  callbacks: {
    async signIn({ user, account, profile }) {
      // Create default subscription for new users
      if (account?.provider === 'google') {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
          include: { subscription: true }
        })

        if (!existingUser) {
          // New user - will be created by adapter
          return true
        }

        // Existing user logging in with Google
        if (!existingUser.subscription) {
          await prisma.subscription.create({
            data: {
              userId: existingUser.id,
              plan: 'FREE',
              status: 'ACTIVE',
              monthlyCredits: 5,
              maxFileSize: 10,
              apiAccess: false,
              priorityProcessing: false,
              customBranding: false,
            }
          })
        }
      }
      
      return true
    },
    
    async session({ session, token }) {
      if (session?.user && token.sub) {
        session.user.id = token.sub
        
        // Get user's subscription info
        const user = await prisma.user.findUnique({
          where: { id: token.sub },
          include: { subscription: true }
        })
        
        if (user) {
          session.user.subscription = user.subscription
          session.user.creditsRemaining = 
            (user.subscription?.monthlyCredits || user.monthlyCredits) - user.creditsUsed
        }
      }
      return session
    },
    
    async jwt({ token }) {
      return token
    }
  },
  
  events: {
    async createUser({ user }) {
      // Create free subscription for new users
      await prisma.subscription.create({
        data: {
          userId: user.id,
          plan: 'FREE',
          status: 'ACTIVE',
          monthlyCredits: 5,
          maxFileSize: 10,
          apiAccess: false,
          priorityProcessing: false,
          customBranding: false,
        }
      })

      // Create default API key
      const apiKey = generateApiKey()
      await prisma.apiKey.create({
        data: {
          userId: user.id,
          name: 'Default API Key',
          key: apiKey,
          requestsPerMonth: 100,
          isActive: true,
        }
      })

      // TODO: Send welcome email
      console.log(`New user created: ${user.email}`)
    }
  },
  
  pages: {
    signIn: '/login',
    signOut: '/logout',
    error: '/auth/error',
    verifyRequest: '/auth/verify',
  },
  
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  
  secret: process.env.NEXTAUTH_SECRET,
}

export default NextAuth(authOptions)0