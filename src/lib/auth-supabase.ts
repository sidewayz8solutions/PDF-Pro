import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { supabase, supabaseHelpers } from './supabase';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Sign in with Supabase
          const { data, error } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          });

          if (error || !data.user) {
            return null;
          }

          // Get user profile from our users table
          const { data: userProfile } = await supabaseHelpers.getUserById(data.user.id);

          return {
            id: data.user.id,
            email: data.user.email!,
            name: userProfile?.name || data.user.user_metadata?.name || null,
            image: userProfile?.avatar_url || data.user.user_metadata?.avatar_url || null,
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      }
    })
  ],
  
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        if (account?.provider === 'google') {
          // Check if user exists in Supabase
          const { data: existingUser } = await supabaseHelpers.getUserById(user.id);
          
          if (!existingUser) {
            // Create user in Supabase if doesn't exist
            const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
              email: user.email!,
              user_metadata: {
                name: user.name,
                avatar_url: user.image,
                provider: 'google'
              },
              email_confirm: true
            });

            if (authError) {
              console.error('Failed to create Supabase user:', authError);
              return false;
            }

            // The database trigger will automatically create the user profile and subscription
          } else {
            // Update last login
            await supabaseHelpers.supabaseAdmin
              .from('users')
              .update({ 
                last_login: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', user.id);
          }
        }
        
        return true;
      } catch (error) {
        console.error('SignIn callback error:', error);
        return false;
      }
    },

    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        
        // Get user subscription and profile data
        try {
          const [userProfile, subscription] = await Promise.all([
            supabaseHelpers.getUserById(user.id),
            supabaseHelpers.getUserSubscription(user.id)
          ]);

          token.subscription = subscription.data;
          token.profile = userProfile.data;
        } catch (error) {
          console.error('JWT callback error:', error);
        }
      }
      
      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.subscription = token.subscription as any;
        session.user.profile = token.profile as any;
      }
      
      return session;
    }
  },

  pages: {
    signIn: '/login',
    signUp: '/signup',
    error: '/auth/error',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: process.env.NEXTAUTH_SECRET,
};

// Helper functions for authentication
export const authHelpers = {
  // Register new user
  async registerUser(email: string, password: string, name?: string) {
    try {
      // Create user in Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || '',
          }
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      return { user: data.user, session: data.session };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },

  // Check if user has sufficient credits
  async hasCredits(userId: string, requiredCredits: number): Promise<boolean> {
    try {
      const { data: subscription } = await supabaseHelpers.getUserSubscription(userId);
      
      if (!subscription) {
        return false;
      }

      const { data: user } = await supabaseHelpers.getUserById(userId);
      
      if (!user) {
        return false;
      }

      const remainingCredits = subscription.monthly_credits - user.credits_used;
      return remainingCredits >= requiredCredits;
    } catch (error) {
      console.error('Credits check error:', error);
      return false;
    }
  },

  // Deduct credits from user
  async deductCredits(userId: string, creditsToDeduct: number): Promise<boolean> {
    try {
      const { data: user } = await supabaseHelpers.getUserById(userId);
      
      if (!user) {
        return false;
      }

      const newCreditsUsed = user.credits_used + creditsToDeduct;

      const { error } = await supabaseHelpers.supabaseAdmin
        .from('users')
        .update({ 
          credits_used: newCreditsUsed,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      return !error;
    } catch (error) {
      console.error('Credits deduction error:', error);
      return false;
    }
  },

  // Check if user can access feature
  async canAccessFeature(userId: string, feature: string): Promise<boolean> {
    try {
      const { data: subscription } = await supabaseHelpers.getUserSubscription(userId);
      
      if (!subscription) {
        return false;
      }

      switch (feature) {
        case 'api_access':
          return subscription.api_access;
        case 'priority_processing':
          return subscription.priority_processing;
        case 'custom_branding':
          return subscription.custom_branding;
        case 'large_files':
          return subscription.max_file_size > 10;
        default:
          return true;
      }
    } catch (error) {
      console.error('Feature access check error:', error);
      return false;
    }
  },

  // Validate file size
  async validateFileSize(userId: string, fileSize: number): Promise<boolean> {
    try {
      const { data: subscription } = await supabaseHelpers.getUserSubscription(userId);
      
      if (!subscription) {
        return false;
      }

      const maxSizeBytes = subscription.max_file_size * 1024 * 1024; // Convert MB to bytes
      return fileSize <= maxSizeBytes;
    } catch (error) {
      console.error('File size validation error:', error);
      return false;
    }
  },

  // Create usage record
  async createUsageRecord(
    userId: string,
    operationType: string,
    fileSize: number,
    processingTime: number,
    creditsUsed: number,
    success: boolean,
    errorMessage?: string
  ) {
    try {
      return await supabaseHelpers.createUsageRecord({
        user_id: userId,
        operation_type: operationType as any,
        file_size: fileSize,
        processing_time: processingTime,
        credits_used: creditsUsed,
        success,
        error_message: errorMessage,
      });
    } catch (error) {
      console.error('Usage record creation error:', error);
      throw error;
    }
  },

  // Get user analytics
  async getUserAnalytics(userId: string, period: 'day' | 'week' | 'month' = 'month') {
    try {
      return await supabaseHelpers.getUsageAnalytics(userId, period);
    } catch (error) {
      console.error('Analytics error:', error);
      throw error;
    }
  },

  // Reset monthly credits (called by cron job)
  async resetMonthlyCredits() {
    try {
      const { error } = await supabaseHelpers.supabaseAdmin
        .from('users')
        .update({ 
          credits_used: 0,
          updated_at: new Date().toISOString()
        });

      return !error;
    } catch (error) {
      console.error('Credits reset error:', error);
      return false;
    }
  }
};

export default authOptions;
