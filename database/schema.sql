-- Binary Blender AI Platform Database Schema

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (synced from Skool)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  skool_user_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  avatar_url TEXT,
  membership_tier VARCHAR(50) DEFAULT 'basic',
  credits_remaining INTEGER DEFAULT 100,
  total_credits_purchased INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Credit transactions table
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Positive for additions, negative for usage
  transaction_type VARCHAR(50) NOT NULL, -- 'purchase', 'usage', 'refund', 'bonus', 'monthly_allocation'
  generation_id UUID, -- References generations.id (nullable for non-usage transactions)
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Generations table (all AI outputs)
CREATE TABLE generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tool_type VARCHAR(50) NOT NULL, -- 'image', 'video', 'lipsync'
  input_data JSONB NOT NULL, -- Stores prompts, settings, input file URLs
  output_urls TEXT[] DEFAULT ARRAY[]::TEXT[], -- Array of generated asset URLs
  thumbnail_url TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  credits_used INTEGER DEFAULT 0,
  processing_time_seconds INTEGER,
  external_job_id VARCHAR(255), -- For tracking jobs at AI service providers
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Add foreign key constraint for generation_id in credit_transactions
ALTER TABLE credit_transactions
ADD CONSTRAINT fk_credit_transactions_generation_id
FOREIGN KEY (generation_id) REFERENCES generations(id) ON DELETE SET NULL;

-- Presets/Templates table
CREATE TABLE presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  tool_type VARCHAR(50) NOT NULL,
  settings JSONB NOT NULL,
  is_public BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User preferences table
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  email_notifications BOOLEAN DEFAULT true,
  theme VARCHAR(20) DEFAULT 'dark', -- 'dark', 'light'
  default_image_model VARCHAR(100),
  default_video_model VARCHAR(100),
  preferred_aspect_ratio VARCHAR(20) DEFAULT 'square',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_skool_user_id ON users(skool_user_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_generations_user_id ON generations(user_id);
CREATE INDEX idx_generations_status ON generations(status);
CREATE INDEX idx_generations_tool_type ON generations(tool_type);
CREATE INDEX idx_generations_created_at ON generations(created_at DESC);
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX idx_presets_tool_type ON presets(tool_type);
CREATE INDEX idx_presets_is_public ON presets(is_public);

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

-- RLS Policies for generations table
CREATE POLICY "Users can read own generations" ON generations
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create own generations" ON generations
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own generations" ON generations
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- RLS Policies for credit_transactions table
CREATE POLICY "Users can read own credit transactions" ON credit_transactions
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- RLS Policies for presets table
CREATE POLICY "Users can read public presets" ON presets
  FOR SELECT USING (is_public = true OR auth.uid()::text = created_by::text);

CREATE POLICY "Users can create own presets" ON presets
  FOR INSERT WITH CHECK (auth.uid()::text = created_by::text);

CREATE POLICY "Users can update own presets" ON presets
  FOR UPDATE USING (auth.uid()::text = created_by::text);

CREATE POLICY "Users can delete own presets" ON presets
  FOR DELETE USING (auth.uid()::text = created_by::text);

-- RLS Policies for user_preferences table
CREATE POLICY "Users can manage own preferences" ON user_preferences
  FOR ALL USING (auth.uid()::text = user_id::text);

-- Functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_presets_updated_at BEFORE UPDATE ON presets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get user credit balance
CREATE OR REPLACE FUNCTION get_user_credit_balance(user_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(amount), 0) FROM credit_transactions WHERE user_id = user_uuid;
$$ LANGUAGE SQL;

-- Function to deduct credits (with validation)
CREATE OR REPLACE FUNCTION deduct_credits(
  user_uuid UUID,
  credit_amount INTEGER,
  gen_id UUID,
  description_text TEXT DEFAULT 'AI Generation'
)
RETURNS BOOLEAN AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  -- Get current balance
  SELECT get_user_credit_balance(user_uuid) INTO current_balance;

  -- Check if user has enough credits
  IF current_balance < credit_amount THEN
    RETURN FALSE;
  END IF;

  -- Deduct credits
  INSERT INTO credit_transactions (user_id, amount, transaction_type, generation_id, description)
  VALUES (user_uuid, -credit_amount, 'usage', gen_id, description_text);

  -- Update user's credit cache
  UPDATE users
  SET credits_remaining = get_user_credit_balance(user_uuid),
      updated_at = NOW()
  WHERE id = user_uuid;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to add credits
CREATE OR REPLACE FUNCTION add_credits(
  user_uuid UUID,
  credit_amount INTEGER,
  transaction_type_param VARCHAR(50) DEFAULT 'bonus',
  description_text TEXT DEFAULT 'Credit addition'
)
RETURNS VOID AS $$
BEGIN
  -- Add credits
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description)
  VALUES (user_uuid, credit_amount, transaction_type_param, description_text);

  -- Update user's credit cache
  UPDATE users
  SET credits_remaining = get_user_credit_balance(user_uuid),
      total_credits_purchased = total_credits_purchased + CASE WHEN transaction_type_param = 'purchase' THEN credit_amount ELSE 0 END,
      updated_at = NOW()
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Insert default presets
INSERT INTO presets (name, description, tool_type, settings, is_public, is_featured, created_by) VALUES
('Portrait Photo', 'Professional portrait photography style', 'image', '{"model": "flux-pro", "style": "portrait", "aspect_ratio": "portrait", "steps": 20}', true, true, null),
('Landscape Art', 'Beautiful landscape artwork', 'image', '{"model": "flux-pro", "style": "landscape", "aspect_ratio": "landscape", "steps": 25}', true, true, null),
('Product Shot', 'Clean product photography', 'image', '{"model": "flux-pro", "style": "product", "aspect_ratio": "square", "steps": 20}', true, true, null),
('Cinematic Video', 'Movie-like video generation', 'video', '{"model": "runway-gen3", "duration": 5, "motion": "medium", "style": "cinematic"}', true, true, null),
('Smooth Animation', 'Smooth character animation', 'video', '{"model": "runway-gen3", "duration": 3, "motion": "low", "style": "animation"}', true, true, null);