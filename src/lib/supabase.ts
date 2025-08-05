import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Client-side Supabase client (for browser)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Server-side Supabase client (with service role key)
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Helper functions for common operations
export const supabaseHelpers = {
  // User management
  async createUser(email: string, password: string, metadata?: any) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: metadata,
      email_confirm: true,
    });
    return { data, error };
  },

  async getUserById(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  async updateUserMetadata(userId: string, metadata: any) {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: metadata,
    });
    return { data, error };
  },

  // File management
  async createFileRecord(fileData: {
    user_id: string;
    original_name: string;
    file_size: number;
    file_type: string;
    s3_key: string;
    s3_url: string;
    operation_type: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
  }) {
    const { data, error } = await supabaseAdmin
      .from('files')
      .insert(fileData)
      .select()
      .single();
    return { data, error };
  },

  async updateFileStatus(fileId: string, status: string, processedUrl?: string) {
    const updateData: any = { status, updated_at: new Date().toISOString() };
    if (processedUrl) {
      updateData.processed_url = processedUrl;
    }

    const { data, error } = await supabaseAdmin
      .from('files')
      .update(updateData)
      .eq('id', fileId)
      .select()
      .single();
    return { data, error };
  },

  async getUserFiles(userId: string, limit = 50) {
    const { data, error } = await supabaseAdmin
      .from('files')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data, error };
  },

  // Subscription management
  async createSubscription(subscriptionData: {
    user_id: string;
    plan: string;
    status: string;
    stripe_subscription_id: string;
    stripe_price_id: string;
    stripe_current_period_end: string;
    monthly_credits: number;
    max_file_size: number;
    api_access: boolean;
    priority_processing: boolean;
    custom_branding: boolean;
  }) {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .insert(subscriptionData)
      .select()
      .single();
    return { data, error };
  },

  async updateSubscription(userId: string, updateData: any) {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select()
      .single();
    return { data, error };
  },

  async getUserSubscription(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();
    return { data, error };
  },

  // Usage tracking
  async createUsageRecord(usageData: {
    user_id: string;
    operation_type: string;
    file_size: number;
    processing_time: number;
    credits_used: number;
    success: boolean;
  }) {
    const { data, error } = await supabaseAdmin
      .from('usage_records')
      .insert(usageData)
      .select()
      .single();
    return { data, error };
  },

  async getUserUsage(userId: string, startDate?: string, endDate?: string) {
    let query = supabaseAdmin
      .from('usage_records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;
    return { data, error };
  },

  // Analytics
  async getUsageAnalytics(userId: string, period: 'day' | 'week' | 'month' = 'month') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const { data, error } = await supabaseAdmin
      .from('usage_records')
      .select('operation_type, credits_used, file_size, success, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    return { data, error };
  },

  // Real-time subscriptions
  subscribeToUserFiles(userId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`user_files_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'files',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();
  },

  subscribeToProcessingQueue(callback: (payload: any) => void) {
    return supabase
      .channel('processing_queue')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'files',
          filter: 'status=eq.processing',
        },
        callback
      )
      .subscribe();
  },
};

export default supabase;
