-- =====================================================
-- PDF-Pro Complete Supabase Setup
-- Copy and paste this entire file into Supabase SQL Editor
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE plan_type AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'BUSINESS');
CREATE TYPE subscription_status AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'PAUSED', 'TRIALING');
CREATE TYPE operation_type AS ENUM ('compress', 'merge', 'split', 'watermark', 'protect', 'convert', 'extract', 'sign');
CREATE TYPE file_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE processing_priority AS ENUM ('low', 'normal', 'high', 'urgent');

-- =====================================================
-- TABLES
-- =====================================================

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    email_verified BOOLEAN DEFAULT FALSE,
    credits_used INTEGER DEFAULT 0,
    total_files_processed INTEGER DEFAULT 0,
    total_storage_used BIGINT DEFAULT 0,
    preferences JSONB DEFAULT '{}',
    timezone TEXT DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT TRUE
);

-- Subscriptions table
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    plan plan_type NOT NULL DEFAULT 'FREE',
    status subscription_status NOT NULL DEFAULT 'ACTIVE',
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    stripe_price_id TEXT,
    stripe_current_period_end TIMESTAMP WITH TIME ZONE,
    monthly_credits INTEGER NOT NULL DEFAULT 5,
    max_file_size INTEGER NOT NULL DEFAULT 10,
    api_access BOOLEAN NOT NULL DEFAULT FALSE,
    priority_processing BOOLEAN NOT NULL DEFAULT FALSE,
    custom_branding BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Files table
CREATE TABLE public.files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    original_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type TEXT NOT NULL,
    s3_key TEXT NOT NULL,
    s3_url TEXT NOT NULL,
    processed_s3_key TEXT,
    processed_url TEXT,
    operation_type operation_type NOT NULL,
    status file_status NOT NULL DEFAULT 'pending',
    priority processing_priority DEFAULT 'normal',
    error_message TEXT,
    processing_time INTEGER,
    compression_ratio DECIMAL(5,2),
    pages_count INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    started_processing_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Usage records table
CREATE TABLE public.usage_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    file_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
    operation_type operation_type NOT NULL,
    file_size BIGINT NOT NULL,
    processing_time INTEGER NOT NULL,
    credits_used INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API keys table
CREATE TABLE public.api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    last_used TIMESTAMP WITH TIME ZONE,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Processing queue table
CREATE TABLE public.processing_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    priority processing_priority DEFAULT 'normal',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- File shares table
CREATE TABLE public.file_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    share_token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    download_count INTEGER DEFAULT 0,
    max_downloads INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_created_at ON public.users(created_at);
CREATE INDEX idx_users_is_active ON public.users(is_active);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);

CREATE INDEX idx_files_user_id ON public.files(user_id);
CREATE INDEX idx_files_status ON public.files(status);
CREATE INDEX idx_files_operation_type ON public.files(operation_type);
CREATE INDEX idx_files_created_at ON public.files(created_at);
CREATE INDEX idx_files_expires_at ON public.files(expires_at);

CREATE INDEX idx_usage_records_user_id ON public.usage_records(user_id);
CREATE INDEX idx_usage_records_created_at ON public.usage_records(created_at);
CREATE INDEX idx_usage_records_operation_type ON public.usage_records(operation_type);

CREATE INDEX idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX idx_api_keys_is_active ON public.api_keys(is_active);

CREATE INDEX idx_processing_queue_scheduled_for ON public.processing_queue(scheduled_for);
CREATE INDEX idx_processing_queue_priority ON public.processing_queue(priority);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, name, avatar_url, email_verified)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.email_confirmed_at IS NOT NULL
    );
    
    -- Create default free subscription
    INSERT INTO public.subscriptions (
        user_id, plan, status, stripe_subscription_id, stripe_price_id,
        stripe_current_period_end, monthly_credits, max_file_size,
        api_access, priority_processing, custom_branding
    ) VALUES (
        NEW.id, 'FREE', 'ACTIVE', 'free_' || NEW.id, 'price_free',
        NOW() + INTERVAL '1 year', 5, 10, FALSE, FALSE, FALSE
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired files
CREATE OR REPLACE FUNCTION public.cleanup_expired_files()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.files 
    WHERE expires_at < NOW() 
    AND status IN ('completed', 'failed');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user analytics
CREATE OR REPLACE FUNCTION public.get_user_analytics(
    user_uuid UUID,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days'
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_operations', COUNT(*),
        'successful_operations', COUNT(*) FILTER (WHERE success = true),
        'total_credits_used', COALESCE(SUM(credits_used), 0),
        'total_data_processed', COALESCE(SUM(file_size), 0),
        'avg_processing_time', COALESCE(AVG(processing_time), 0),
        'operations_by_type', json_object_agg(operation_type, operation_count)
    ) INTO result
    FROM (
        SELECT 
            operation_type,
            COUNT(*) as operation_count,
            success,
            credits_used,
            file_size,
            processing_time
        FROM public.usage_records 
        WHERE user_id = user_uuid 
        AND created_at >= start_date
        GROUP BY operation_type, success, credits_used, file_size, processing_time
    ) analytics;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON public.files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON public.api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_shares ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Subscriptions policies
CREATE POLICY "Users can view own subscription" ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription" ON public.subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

-- Files policies
CREATE POLICY "Users can view own files" ON public.files
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own files" ON public.files
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own files" ON public.files
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own files" ON public.files
    FOR DELETE USING (auth.uid() = user_id);

-- Usage records policies
CREATE POLICY "Users can view own usage records" ON public.usage_records
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage records" ON public.usage_records
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- API keys policies
CREATE POLICY "Users can view own API keys" ON public.api_keys
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own API keys" ON public.api_keys
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys" ON public.api_keys
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys" ON public.api_keys
    FOR DELETE USING (auth.uid() = user_id);

-- Processing queue policies
CREATE POLICY "Users can view own queue items" ON public.processing_queue
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own queue items" ON public.processing_queue
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- File shares policies
CREATE POLICY "Users can view own file shares" ON public.file_shares
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own file shares" ON public.file_shares
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own file shares" ON public.file_shares
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own file shares" ON public.file_shares
    FOR DELETE USING (auth.uid() = user_id);

-- Public access for shared files (with valid token)
CREATE POLICY "Public can access shared files" ON public.file_shares
    FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

-- =====================================================
-- VIEWS (for easier querying)
-- =====================================================

-- View for user statistics
CREATE OR REPLACE VIEW public.user_stats AS
SELECT
    u.id,
    u.email,
    u.name,
    u.created_at,
    u.credits_used,
    u.total_files_processed,
    u.total_storage_used,
    s.plan,
    s.monthly_credits,
    s.monthly_credits - u.credits_used AS credits_remaining,
    COUNT(f.id) AS active_files,
    COUNT(f.id) FILTER (WHERE f.status = 'processing') AS processing_files
FROM public.users u
LEFT JOIN public.subscriptions s ON u.id = s.user_id
LEFT JOIN public.files f ON u.id = f.user_id AND f.expires_at > NOW()
GROUP BY u.id, u.email, u.name, u.created_at, u.credits_used,
         u.total_files_processed, u.total_storage_used, s.plan, s.monthly_credits;

-- View for recent activity
CREATE OR REPLACE VIEW public.recent_activity AS
SELECT
    ur.id,
    ur.user_id,
    u.email,
    ur.operation_type,
    ur.file_size,
    ur.processing_time,
    ur.success,
    ur.created_at,
    f.original_name
FROM public.usage_records ur
JOIN public.users u ON ur.user_id = u.id
LEFT JOIN public.files f ON ur.file_id = f.id
ORDER BY ur.created_at DESC;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

SELECT 'PDF-Pro Supabase setup completed successfully! 🚀' as message;
