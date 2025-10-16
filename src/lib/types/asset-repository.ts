// Binary Blender Asset Repository Types
// Complete type definitions for the Asset Repository Module

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

// ============================================================================
// Core Entity Types
// ============================================================================

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  color: string; // Hex color
  is_archived: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithStats extends Project {
  asset_count?: number;
  stats?: {
    total_assets: number;
    by_type: Record<AssetType, number>;
    total_credits_used: number;
  };
}

export interface Folder {
  id: string;
  project_id: string;
  parent_folder_id?: string;
  name: string;
  path: string; // Computed path like "/folder1/subfolder2"
  color?: string;
  position: number;
  created_at: string;
}

export interface Asset {
  id: string;
  user_id: string;
  project_id?: string;
  folder_id?: string;

  // Asset classification
  asset_type: AssetType;
  source_app?: SourceApp;
  source_tool?: string;

  // Content storage
  file_url?: string;
  text_content?: string;
  thumbnail_url?: string;
  preview_urls?: string[]; // For video frames, etc.

  // Complete generation context
  generation_params: GenerationParams;

  // Asset lineage
  parent_asset_ids?: string[];

  // File metadata
  file_size_bytes?: number;
  duration_seconds?: number;
  dimensions?: AssetDimensions;
  mime_type?: string;

  // Cost and performance tracking
  credits_used: number;
  generation_time_seconds?: number;
  api_cost_usd?: number;

  // User organization
  name?: string;
  tags?: string[];
  notes?: string;
  is_favorite: boolean;
  user_rating?: number; // 1-5

  // Status
  status: AssetStatus;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface AssetWithRelations extends Asset {
  parent_assets?: AssetRelationInfo[];
  child_assets?: AssetRelationInfo[];
  versions?: AssetVersion[];
  project?: Pick<Project, 'id' | 'name' | 'color'>;
  folder?: Pick<Folder, 'id' | 'name' | 'path'>;
}

export interface AssetRelationInfo {
  id: string;
  asset_type: AssetType;
  thumbnail_url?: string;
  name?: string;
  relationship_type: RelationshipType;
  created_at: string;
}

export interface AssetRelationship {
  id: string;
  parent_asset_id: string;
  child_asset_id: string;
  relationship_type: RelationshipType;
  notes?: string;
  created_at: string;
}

export interface AssetVersion {
  id: string;
  asset_id: string;
  version_number: number;
  file_url: string;
  thumbnail_url?: string;
  generation_params: GenerationParams;
  credits_used: number;
  notes?: string;
  created_at: string;
}

export interface Prompt {
  id: string;
  user_id: string;
  name: string;
  prompt_text: string;
  negative_prompt?: string;
  category?: PromptCategory;
  asset_types?: AssetType[];
  tags?: string[];
  times_used: number;
  avg_rating?: number;
  last_used_at?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface Experiment {
  id: string;
  user_id: string;
  title: string;
  hypothesis: string;
  methodology?: string;
  results?: string;
  conclusion?: string;
  outcome?: ExperimentOutcome;
  asset_ids?: string[];
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface ModelComparison {
  id: string;
  user_id: string;
  tool_type: ToolType;
  models_compared: string[];
  input_params: GenerationParams;
  results: Record<string, ComparisonResult>;
  winner?: string;
  notes?: string;
  created_at: string;
}

export interface ComparisonResult {
  asset_id: string;
  rating: number;
  notes?: string;
}

export interface WorkflowPattern {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  example_asset_ids?: string[];
  times_used: number;
  avg_rating?: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStep {
  step: number;
  app: SourceApp;
  action: string;
  params: Record<string, any>;
  output_name: string;
}

// ============================================================================
// Enum Types
// ============================================================================

export type AssetType =
  | 'image'
  | 'video'
  | 'audio'
  | 'text'
  | 'prompt'
  | 'experiment'
  | 'workflow'
  | 'comparison';

export type SourceApp =
  | 'image_studio'
  | 'video_studio'
  | 'lipsync'
  | 'chat_studio'
  | 'asset_repository';

export type AssetStatus = 'active' | 'archived' | 'deleted';

export type RelationshipType =
  | 'input'
  | 'variation'
  | 'enhancement'
  | 'remix'
  | 'iteration';

export type PromptCategory =
  | 'character'
  | 'scene'
  | 'style'
  | 'technical'
  | 'workflow';

export type ExperimentOutcome = 'success' | 'partial' | 'failure';

export type ToolType = 'image' | 'video' | 'audio' | 'text';

// ============================================================================
// Data Structure Types
// ============================================================================

export interface AssetDimensions {
  width?: number;
  height?: number;
  fps?: number;
}

export interface GenerationParams {
  [key: string]: any; // Flexible structure for different tools
  prompt?: string;
  negative_prompt?: string;
  model?: string;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
  guidance_scale?: number;
  timestamp?: string;
}

// ============================================================================
// Request/Response Types for API
// ============================================================================

// Projects
export interface CreateProjectRequest {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  color?: string;
  is_archived?: boolean;
  position?: number;
}

export interface ProjectListParams extends PaginationParams {
  archived?: boolean;
}

export interface ProjectDetailsParams {
  include_assets?: boolean;
  asset_limit?: number;
}

// Assets
export interface CreateAssetRequest {
  project_id?: string;
  folder_id?: string;
  asset_type: AssetType;
  source_app?: SourceApp;
  source_tool?: string;
  file_url?: string;
  text_content?: string;
  thumbnail_url?: string;
  preview_urls?: string[];
  generation_params: GenerationParams;
  parent_asset_ids?: string[];
  file_size_bytes?: number;
  duration_seconds?: number;
  dimensions?: AssetDimensions;
  mime_type?: string;
  credits_used: number;
  generation_time_seconds?: number;
  api_cost_usd?: number;
  name?: string;
  tags?: string[];
  notes?: string;
}

export interface UpdateAssetRequest {
  name?: string;
  tags?: string[];
  notes?: string;
  is_favorite?: boolean;
  user_rating?: number;
  project_id?: string;
  folder_id?: string;
  status?: AssetStatus;
}

export interface AssetListParams extends PaginationParams {
  project_id?: string;
  folder_id?: string;
  asset_type?: AssetType;
  source_app?: SourceApp;
  source_tool?: string;
  tags?: string; // Comma-separated
  favorite?: boolean;
  min_rating?: number;
  search?: string;
  sort?: 'created_at' | 'updated_at' | 'name' | 'rating' | 'credits_used';
  order?: 'asc' | 'desc';
}

export interface AssetRegenerateResponse {
  source_app: SourceApp;
  generation_params: GenerationParams;
  redirect_url: string;
}

export interface AssetUseAsInputRequest {
  target_app: SourceApp;
}

export interface AssetUseAsInputResponse {
  asset_id: string;
  file_url?: string;
  redirect_url: string;
}

export interface CreateAssetVersionRequest {
  file_url: string;
  thumbnail_url?: string;
  generation_params: GenerationParams;
  credits_used: number;
  notes?: string;
}

// Folders
export interface CreateFolderRequest {
  project_id: string;
  parent_folder_id?: string;
  name: string;
  color?: string;
}

export interface UpdateFolderRequest {
  name?: string;
  color?: string;
  position?: number;
}

export interface FolderListParams {
  project_id: string;
  parent_folder_id?: string;
}

// Prompts
export interface CreatePromptRequest {
  name: string;
  prompt_text: string;
  negative_prompt?: string;
  category?: PromptCategory;
  asset_types?: AssetType[];
  tags?: string[];
}

export interface UpdatePromptRequest {
  name?: string;
  prompt_text?: string;
  negative_prompt?: string;
  category?: PromptCategory;
  asset_types?: AssetType[];
  tags?: string[];
}

export interface PromptListParams extends PaginationParams {
  category?: PromptCategory;
  asset_type?: AssetType;
  tags?: string; // Comma-separated
  search?: string;
  sort?: 'name' | 'times_used' | 'avg_rating' | 'created_at';
  order?: 'asc' | 'desc';
}

// Experiments
export interface CreateExperimentRequest {
  title: string;
  hypothesis: string;
  methodology?: string;
  results?: string;
  conclusion?: string;
  outcome?: ExperimentOutcome;
  asset_ids?: string[];
  tags?: string[];
}

export interface UpdateExperimentRequest {
  title?: string;
  hypothesis?: string;
  methodology?: string;
  results?: string;
  conclusion?: string;
  outcome?: ExperimentOutcome;
  asset_ids?: string[];
  tags?: string[];
}

export interface ExperimentListParams extends PaginationParams {
  outcome?: ExperimentOutcome;
  tags?: string; // Comma-separated
  search?: string;
  sort?: 'created_at' | 'title' | 'outcome';
  order?: 'asc' | 'desc';
}

// Model Comparisons
export interface CreateComparisonRequest {
  tool_type: ToolType;
  models_compared: string[];
  input_params: GenerationParams;
  results: Record<string, ComparisonResult>;
  winner?: string;
  notes?: string;
}

export interface ComparisonListParams extends PaginationParams {
  tool_type?: ToolType;
  winner?: string;
  sort?: 'created_at' | 'tool_type';
  order?: 'asc' | 'desc';
}

// Workflow Patterns
export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  steps: WorkflowStep[];
  example_asset_ids?: string[];
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  steps?: WorkflowStep[];
  example_asset_ids?: string[];
}

export interface WorkflowListParams extends PaginationParams {
  is_public?: boolean;
  search?: string;
  sort?: 'name' | 'times_used' | 'avg_rating' | 'created_at';
  order?: 'asc' | 'desc';
}

export interface ExecuteWorkflowRequest {
  user_params: Record<string, any>;
}

// ============================================================================
// File Upload Types
// ============================================================================

export interface UploadRequest {
  file_type: string;
  file_size: number;
  project_id?: string;
  asset_type: AssetType;
}

export interface UploadResponse {
  upload_url: string;
  asset_id: string;
  expires_at: string;
}

export interface FileMetadata {
  size: number;
  type: string;
  dimensions?: AssetDimensions;
  duration?: number;
}

// ============================================================================
// Search and Filter Types
// ============================================================================

export interface SearchFilters {
  asset_types?: AssetType[];
  source_apps?: SourceApp[];
  date_range?: {
    start: string;
    end: string;
  };
  rating_range?: {
    min: number;
    max: number;
  };
  tags?: string[];
  has_files?: boolean;
  has_favorites?: boolean;
}

export interface SearchResult {
  assets: Asset[];
  prompts: Prompt[];
  experiments: Experiment[];
  total_results: number;
  facets: {
    asset_types: Record<AssetType, number>;
    source_apps: Record<SourceApp, number>;
    tags: Record<string, number>;
  };
}

// ============================================================================
// Statistics and Analytics Types
// ============================================================================

export interface UserStats {
  total_assets: number;
  assets_by_type: Record<AssetType, number>;
  total_credits_used: number;
  favorite_tools: Array<{
    tool: string;
    usage_count: number;
  }>;
  top_tags: Array<{
    tag: string;
    usage_count: number;
  }>;
  generation_history: Array<{
    date: string;
    assets_created: number;
    credits_used: number;
  }>;
}

export interface ProjectStats {
  total_assets: number;
  assets_by_type: Record<AssetType, number>;
  total_credits_used: number;
  total_file_size: number;
  creation_timeline: Array<{
    date: string;
    count: number;
  }>;
}

// ============================================================================
// Utility Types
// ============================================================================

export type SortOrder = 'asc' | 'desc';

export type DatabaseRecord<T> = T & {
  created_at: string;
  updated_at: string;
};

export type CreateRecord<T> = Omit<T, 'id' | 'created_at' | 'updated_at'>;

export type UpdateRecord<T> = Partial<Omit<T, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;