import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions: NextAuthOptions = {
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

        // For now, just return a mock user for testing
        // TODO: Implement proper Supabase authentication
        return {
          id: 'test-user-id',
          email: credentials.email,
          name: 'Test User',
          image: null,
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
      // For now, just allow all sign ins
      // TODO: Implement proper Supabase user creation
      console.log('User signing in:', user.email);
      return true;
    },

    async session({ session, token }) {
      if (session?.user && token.sub) {
        session.user.id = token.sub;

        // Add mock subscription data for testing
        session.user.subscription = {
          plan: 'FREE',
          status: 'ACTIVE',
          monthlyCredits: 5
        };
        session.user.creditsRemaining = 5;
      }
      return session;
    },

    async jwt({ token }) {
      return token
    }
  },

  events: {
    async createUser({ user }) {
      // TODO: Implement Supabase user creation
      console.log(`New user created: ${user.email}`);
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

export default NextAuth(authOptions)