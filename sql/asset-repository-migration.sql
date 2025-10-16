-- ============================================================================
-- Binary Blender Asset Repository Database Migration
-- Version: 1.0
-- Date: October 16, 2025
-- ============================================================================

-- ============================================================================
-- PROJECTS: Top-level organization containers
-- ============================================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Project metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  thumbnail_url TEXT, -- Auto-generated from first asset
  color VARCHAR(7) DEFAULT '#6366f1', -- Hex color for UI (default: indigo)

  -- Organization
  is_archived BOOLEAN DEFAULT false,
  position INTEGER DEFAULT 0, -- User-defined sort order

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Indexes
  CONSTRAINT projects_user_name_unique UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_projects_user_active ON projects(user_id, is_archived, position);

-- ============================================================================
-- FOLDERS: Hierarchical organization within projects
-- ============================================================================
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,

  -- Folder metadata
  name VARCHAR(255) NOT NULL,
  path TEXT NOT NULL, -- Computed path: "/folder1/subfolder2"
  color VARCHAR(7), -- Optional folder color

  -- Organization
  position INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT folders_project_path_unique UNIQUE (project_id, path)
);

CREATE INDEX IF NOT EXISTS idx_folders_project ON folders(project_id, parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_folders_path ON folders(project_id, path);

-- ============================================================================
-- ASSETS: The heart of the system
-- ============================================================================
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,

  -- Asset classification
  asset_type VARCHAR(50) NOT NULL, -- 'image', 'video', 'audio', 'text', 'prompt', 'experiment', 'workflow', 'comparison'
  source_app VARCHAR(50), -- 'image_studio', 'video_studio', 'lipsync', 'chat_studio'
  source_tool VARCHAR(50), -- 'flux-pro', 'flux-dev', 'runway', 'kling', 'claude'

  -- Content storage
  file_url TEXT, -- For media assets (S3/R2 URL)
  text_content TEXT, -- For text outputs, prompts, notes
  thumbnail_url TEXT, -- Preview image
  preview_urls JSONB, -- Array of preview URLs for video frames: ["frame1.jpg", "frame2.jpg"]

  -- Complete generation context (CRITICAL for reproducibility)
  generation_params JSONB NOT NULL, -- All prompts, settings, model info needed to recreate
  /*
    Example structure:
    {
      "prompt": "cyberpunk cityscape at night",
      "negative_prompt": "blurry, low quality",
      "model": "flux-pro-1.1",
      "width": 1024,
      "height": 1024,
      "steps": 30,
      "seed": 12345,
      "guidance_scale": 7.5,
      "timestamp": "2025-10-16T10:30:00Z"
    }
  */

  -- Asset lineage (parent relationships)
  parent_asset_ids UUID[], -- Array of asset IDs used as inputs

  -- File metadata
  file_size_bytes BIGINT,
  duration_seconds NUMERIC(10, 2), -- For video/audio
  dimensions JSONB, -- {"width": 1024, "height": 1024, "fps": 30}
  mime_type VARCHAR(100),

  -- Cost and performance tracking
  credits_used INTEGER NOT NULL DEFAULT 0,
  generation_time_seconds INTEGER, -- How long it took to generate
  api_cost_usd NUMERIC(10, 4), -- Actual API cost for cost tracking

  -- User organization
  name VARCHAR(255), -- User-provided name (defaults to generated name)
  tags TEXT[], -- Flexible tagging
  notes TEXT, -- User notes
  is_favorite BOOLEAN DEFAULT false,
  user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),

  -- Status tracking
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'archived', 'deleted'

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_assets_user ON assets(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id, asset_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_folder ON assets(folder_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_source ON assets(source_app, source_tool);
CREATE INDEX IF NOT EXISTS idx_assets_tags ON assets USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_assets_favorite ON assets(user_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_assets_rating ON assets(user_id, user_rating) WHERE user_rating IS NOT NULL;

-- Full-text search on name and notes
CREATE INDEX IF NOT EXISTS idx_assets_text_search ON assets USING GIN(
  to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(notes, ''))
);

-- ============================================================================
-- ASSET_RELATIONSHIPS: Explicit workflow tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS asset_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  child_asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL, -- 'input', 'variation', 'enhancement', 'remix', 'iteration'

  -- Optional context about the relationship
  notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Prevent duplicate relationships
  CONSTRAINT unique_asset_relationship UNIQUE (parent_asset_id, child_asset_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_asset_rel_parent ON asset_relationships(parent_asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_rel_child ON asset_relationships(child_asset_id);

-- ============================================================================
-- ASSET_VERSIONS: Track iterative refinements
-- ============================================================================
CREATE TABLE IF NOT EXISTS asset_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,

  -- Version content
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  generation_params JSONB NOT NULL,

  -- Version metadata
  credits_used INTEGER NOT NULL DEFAULT 0,
  notes TEXT, -- What changed in this version

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_asset_version UNIQUE (asset_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_asset_versions ON asset_versions(asset_id, version_number DESC);

-- ============================================================================
-- PROMPTS: Reusable prompt library
-- ============================================================================
CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Prompt content
  name VARCHAR(255) NOT NULL,
  prompt_text TEXT NOT NULL,
  negative_prompt TEXT,

  -- Classification
  category VARCHAR(100), -- 'character', 'scene', 'style', 'technical', 'workflow'
  asset_types TEXT[], -- Which asset types this prompt works for: ['image', 'video']
  tags TEXT[],

  -- Usage tracking
  times_used INTEGER DEFAULT 0,
  avg_rating NUMERIC(3, 2), -- Calculated from asset ratings
  last_used_at TIMESTAMP WITH TIME ZONE,

  -- Sharing
  is_public BOOLEAN DEFAULT false, -- Share with community (future feature)

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prompts_user ON prompts(user_id, category);
CREATE INDEX IF NOT EXISTS idx_prompts_public ON prompts(is_public, avg_rating DESC) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_prompts_tags ON prompts USING GIN(tags);

-- ============================================================================
-- EXPERIMENTS: Documented learnings
-- ============================================================================
CREATE TABLE IF NOT EXISTS experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Experiment structure
  title VARCHAR(255) NOT NULL,
  hypothesis TEXT NOT NULL,
  methodology TEXT,
  results TEXT,
  conclusion TEXT,

  -- Success rating
  outcome VARCHAR(20), -- 'success', 'partial', 'failure'

  -- Linked assets
  asset_ids UUID[], -- Assets created during this experiment

  -- Organization
  tags TEXT[],

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_experiments_user ON experiments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_experiments_outcome ON experiments(user_id, outcome);
CREATE INDEX IF NOT EXISTS idx_experiments_tags ON experiments USING GIN(tags);

-- ============================================================================
-- MODEL_COMPARISONS: Track which models work best
-- ============================================================================
CREATE TABLE IF NOT EXISTS model_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Comparison setup
  tool_type VARCHAR(50) NOT NULL, -- 'image', 'video', 'audio'
  models_compared TEXT[] NOT NULL, -- ['flux-dev', 'flux-pro', 'sdxl']
  input_params JSONB NOT NULL, -- Common settings across all models

  -- Results
  results JSONB NOT NULL, -- {"flux-dev": {"asset_id": "xxx", "rating": 4, "notes": "..."}}
  winner VARCHAR(100), -- Which model won

  -- Additional context
  notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comparisons_user ON model_comparisons(user_id, tool_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comparisons_winner ON model_comparisons(tool_type, winner);

-- ============================================================================
-- WORKFLOW_PATTERNS: Saved orchestration recipes
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Workflow metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Workflow definition
  steps JSONB NOT NULL,
  /*
    Example structure:
    [
      {
        "step": 1,
        "app": "image_studio",
        "action": "generate",
        "params": {"prompt": "{{user_prompt}}", "model": "flux-pro"},
        "output_name": "base_image"
      },
      {
        "step": 2,
        "app": "video_studio",
        "action": "animate",
        "params": {"input": "{{base_image}}", "duration": 5},
        "output_name": "animated_video"
      }
    ]
  */

  -- Example outputs
  example_asset_ids UUID[], -- Example results from this workflow

  -- Usage tracking
  times_used INTEGER DEFAULT 0,
  avg_rating NUMERIC(3, 2),

  -- Sharing
  is_public BOOLEAN DEFAULT false,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflows_user ON workflow_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_public ON workflow_patterns(is_public, avg_rating DESC) WHERE is_public = true;

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamps
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;
DROP TRIGGER IF EXISTS update_prompts_updated_at ON prompts;
DROP TRIGGER IF EXISTS update_experiments_updated_at ON experiments;
DROP TRIGGER IF EXISTS update_workflows_updated_at ON workflow_patterns;

-- Create triggers
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompts_updated_at BEFORE UPDATE ON prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_experiments_updated_at BEFORE UPDATE ON experiments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflow_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA: Default projects and folders for new users
-- ============================================================================

-- Function to create default data for new users (can be called from the app)
CREATE OR REPLACE FUNCTION create_default_user_data(target_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Create a default "My First Project"
  INSERT INTO projects (user_id, name, description, color, position)
  VALUES (
    target_user_id,
    'My First Project',
    'Welcome to Binary Blender! Start creating amazing AI assets.',
    '#6366f1',
    0
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS: Helpful views for common queries
-- ============================================================================

-- Project summary with asset counts
CREATE OR REPLACE VIEW project_summaries AS
SELECT
  p.id,
  p.user_id,
  p.name,
  p.description,
  p.thumbnail_url,
  p.color,
  p.is_archived,
  p.position,
  p.created_at,
  p.updated_at,
  COALESCE(asset_counts.total_assets, 0) as asset_count,
  COALESCE(asset_counts.total_credits, 0) as total_credits_used,
  asset_counts.by_type as assets_by_type
FROM projects p
LEFT JOIN (
  SELECT
    project_id,
    COUNT(*) as total_assets,
    SUM(credits_used) as total_credits,
    json_object_agg(asset_type, type_count) as by_type
  FROM (
    SELECT
      project_id,
      asset_type,
      COUNT(*) as type_count,
      SUM(credits_used) as credits_used
    FROM assets
    WHERE status = 'active'
    GROUP BY project_id, asset_type
  ) asset_type_counts
  GROUP BY project_id
) asset_counts ON p.id = asset_counts.project_id;

-- Asset lineage view (shows parent/child relationships)
CREATE OR REPLACE VIEW asset_lineage AS
SELECT
  a.id,
  a.name,
  a.asset_type,
  a.thumbnail_url,
  a.created_at,
  parent_rels.parents,
  child_rels.children
FROM assets a
LEFT JOIN (
  SELECT
    ar.child_asset_id,
    json_agg(json_build_object(
      'id', pa.id,
      'name', pa.name,
      'asset_type', pa.asset_type,
      'relationship_type', ar.relationship_type
    )) as parents
  FROM asset_relationships ar
  JOIN assets pa ON ar.parent_asset_id = pa.id
  GROUP BY ar.child_asset_id
) parent_rels ON a.id = parent_rels.child_asset_id
LEFT JOIN (
  SELECT
    ar.parent_asset_id,
    json_agg(json_build_object(
      'id', ca.id,
      'name', ca.name,
      'asset_type', ca.asset_type,
      'relationship_type', ar.relationship_type
    )) as children
  FROM asset_relationships ar
  JOIN assets ca ON ar.child_asset_id = ca.id
  GROUP BY ar.parent_asset_id
) child_rels ON a.id = child_rels.parent_asset_id;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log the completion
DO $$
BEGIN
  RAISE NOTICE 'Binary Blender Asset Repository migration completed successfully!';
  RAISE NOTICE 'Tables created: projects, folders, assets, asset_relationships, asset_versions, prompts, experiments, model_comparisons, workflow_patterns';
  RAISE NOTICE 'Views created: project_summaries, asset_lineage';
  RAISE NOTICE 'Functions created: update_updated_at_column, create_default_user_data';
END $$;