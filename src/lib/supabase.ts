import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side client with service role key for admin operations
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

// Database types
export interface User {
  id: string
  skool_user_id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  membership_tier: string
  credits_remaining: number
  total_credits_purchased: number
  is_active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface Generation {
  id: string
  user_id: string
  tool_type: 'image' | 'video' | 'lipsync'
  input_data: any
  output_urls: string[]
  thumbnail_url: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  credits_used: number
  processing_time_seconds: number | null
  external_job_id: string | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export interface CreditTransaction {
  id: string
  user_id: string
  amount: number
  transaction_type: 'purchase' | 'usage' | 'refund' | 'bonus' | 'monthly_allocation'
  generation_id: string | null
  description: string | null
  metadata: any
  created_at: string
}

export interface Preset {
  id: string
  name: string
  description: string | null
  tool_type: 'image' | 'video' | 'lipsync'
  settings: any
  is_public: boolean
  is_featured: boolean
  created_by: string | null
  usage_count: number
  created_at: string
  updated_at: string
}

export interface UserPreferences {
  id: string
  user_id: string
  email_notifications: boolean
  theme: 'dark' | 'light'
  default_image_model: string | null
  default_video_model: string | null
  preferred_aspect_ratio: string | null
  created_at: string
  updated_at: string
}