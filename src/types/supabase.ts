export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
          last_login: string | null
          email_verified: boolean
          credits_used: number
          total_files_processed: number
          total_storage_used: number
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
          last_login?: string | null
          email_verified?: boolean
          credits_used?: number
          total_files_processed?: number
          total_storage_used?: number
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
          last_login?: string | null
          email_verified?: boolean
          credits_used?: number
          total_files_processed?: number
          total_storage_used?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          plan: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'BUSINESS'
          status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'PAUSED'
          stripe_subscription_id: string
          stripe_price_id: string
          stripe_current_period_end: string
          monthly_credits: number
          max_file_size: number
          api_access: boolean
          priority_processing: boolean
          custom_branding: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'BUSINESS'
          status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'PAUSED'
          stripe_subscription_id: string
          stripe_price_id: string
          stripe_current_period_end: string
          monthly_credits: number
          max_file_size: number
          api_access: boolean
          priority_processing: boolean
          custom_branding: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan?: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'BUSINESS'
          status?: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'PAUSED'
          stripe_subscription_id?: string
          stripe_price_id?: string
          stripe_current_period_end?: string
          monthly_credits?: number
          max_file_size?: number
          api_access?: boolean
          priority_processing?: boolean
          custom_branding?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      files: {
        Row: {
          id: string
          user_id: string
          original_name: string
          file_size: number
          file_type: string
          s3_key: string
          s3_url: string
          processed_url: string | null
          operation_type: 'compress' | 'merge' | 'split' | 'watermark' | 'protect' | 'convert' | 'extract' | 'sign'
          status: 'pending' | 'processing' | 'completed' | 'failed'
          error_message: string | null
          processing_time: number | null
          compression_ratio: number | null
          pages_count: number | null
          created_at: string
          updated_at: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          original_name: string
          file_size: number
          file_type: string
          s3_key: string
          s3_url: string
          processed_url?: string | null
          operation_type: 'compress' | 'merge' | 'split' | 'watermark' | 'protect' | 'convert' | 'extract' | 'sign'
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          error_message?: string | null
          processing_time?: number | null
          compression_ratio?: number | null
          pages_count?: number | null
          created_at?: string
          updated_at?: string
          expires_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          original_name?: string
          file_size?: number
          file_type?: string
          s3_key?: string
          s3_url?: string
          processed_url?: string | null
          operation_type?: 'compress' | 'merge' | 'split' | 'watermark' | 'protect' | 'convert' | 'extract' | 'sign'
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          error_message?: string | null
          processing_time?: number | null
          compression_ratio?: number | null
          pages_count?: number | null
          created_at?: string
          updated_at?: string
          expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      usage_records: {
        Row: {
          id: string
          user_id: string
          operation_type: 'compress' | 'merge' | 'split' | 'watermark' | 'protect' | 'convert' | 'extract' | 'sign'
          file_size: number
          processing_time: number
          credits_used: number
          success: boolean
          error_message: string | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          operation_type: 'compress' | 'merge' | 'split' | 'watermark' | 'protect' | 'convert' | 'extract' | 'sign'
          file_size: number
          processing_time: number
          credits_used: number
          success: boolean
          error_message?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          operation_type?: 'compress' | 'merge' | 'split' | 'watermark' | 'protect' | 'convert' | 'extract' | 'sign'
          file_size?: number
          processing_time?: number
          credits_used?: number
          success?: boolean
          error_message?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_records_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      api_keys: {
        Row: {
          id: string
          user_id: string
          name: string
          key_hash: string
          last_used: string | null
          usage_count: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          key_hash: string
          last_used?: string | null
          usage_count?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          key_hash?: string
          last_used?: string | null
          usage_count?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      plan_type: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'BUSINESS'
      subscription_status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'PAUSED'
      operation_type: 'compress' | 'merge' | 'split' | 'watermark' | 'protect' | 'convert' | 'extract' | 'sign'
      file_status: 'pending' | 'processing' | 'completed' | 'failed'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
