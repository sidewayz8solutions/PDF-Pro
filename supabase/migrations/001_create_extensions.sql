-- Enable necessary extensions for PDF-Pro
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create custom types for the application
CREATE TYPE plan_type AS ENUM (
    'FREE', 
    'STARTER', 
    'PROFESSIONAL', 
    'BUSINESS'
);

CREATE TYPE subscription_status AS ENUM (
    'ACTIVE', 
    'PAST_DUE', 
    'CANCELED', 
    'PAUSED',
    'TRIALING',
    'INCOMPLETE',
    'INCOMPLETE_EXPIRED',
    'UNPAID'
);

CREATE TYPE operation_type AS ENUM (
    'compress', 
    'merge', 
    'split', 
    'watermark', 
    'protect', 
    'convert', 
    'extract', 
    'sign',
    'rotate',
    'crop',
    'optimize'
);

CREATE TYPE file_status AS ENUM (
    'pending', 
    'processing', 
    'completed', 
    'failed',
    'cancelled',
    'expired'
);

CREATE TYPE processing_priority AS ENUM (
    'low',
    'normal', 
    'high',
    'urgent'
);

CREATE TYPE notification_type AS ENUM (
    'processing_complete',
    'processing_failed',
    'credit_low',
    'subscription_expiring',
    'file_expired',
    'system_maintenance'
);
