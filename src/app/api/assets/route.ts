import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  ApiResponse,
  CreateAssetRequest,
  AssetListParams,
  Asset,
  AssetType,
  SourceApp
} from '@/lib/types/asset-repository';

// ============================================================================
// GET /api/assets - List assets with filtering
// ============================================================================
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }, { status: 401 });
    }

    // Check if user ID is a valid UUID
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.user.id);
    if (!isValidUUID) {
      return NextResponse.json<ApiResponse<Asset[]>>({
        success: true,
        data: [],
        meta: {
          pagination: {
            page: 1,
            limit: 50,
            total: 0,
            totalPages: 0
          }
        }
      });
    }

    const { searchParams } = new URL(req.url);
    const params: AssetListParams = {
      project_id: searchParams.get('project_id') || undefined,
      folder_id: searchParams.get('folder_id') || undefined,
      asset_type: searchParams.get('asset_type') as AssetType || undefined,
      source_app: searchParams.get('source_app') as SourceApp || undefined,
      source_tool: searchParams.get('source_tool') || undefined,
      tags: searchParams.get('tags') || undefined,
      favorite: searchParams.get('favorite') === 'true' ? true : undefined,
      min_rating: searchParams.get('min_rating') ? parseInt(searchParams.get('min_rating')!) : undefined,
      search: searchParams.get('search') || undefined,
      sort: searchParams.get('sort') as any || 'created_at',
      order: searchParams.get('order') as 'asc' | 'desc' || 'desc',
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '50'), 100),
    };

    const unorganized = searchParams.get('unorganized') === 'true';

    console.log('Assets API Debug:', {
      userId: session.user.id,
      isValidUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.user.id),
      unorganized,
      projectId: params.project_id
    });

    // Build the query
    let query = supabaseAdmin
      .from('assets')
      .select(`
        id,
        project_id,
        folder_id,
        asset_type,
        source_app,
        source_tool,
        file_url,
        thumbnail_url,
        name,
        tags,
        notes,
        is_favorite,
        user_rating,
        credits_used,
        file_size_bytes,
        duration_seconds,
        dimensions,
        mime_type,
        status,
        created_at,
        updated_at
      `, { count: 'exact' })
      .eq('user_id', session.user.id)
      .eq('status', 'active');

    // Apply filters
    if (unorganized) {
      // Show assets without a project (unorganized assets)
      query = query.is('project_id', null);
    } else if (params.project_id) {
      query = query.eq('project_id', params.project_id);
    }

    if (params.folder_id) {
      query = query.eq('folder_id', params.folder_id);
    }
    if (params.asset_type) {
      query = query.eq('asset_type', params.asset_type);
    }
    if (params.source_app) {
      query = query.eq('source_app', params.source_app);
    }
    if (params.source_tool) {
      query = query.eq('source_tool', params.source_tool);
    }
    if (params.favorite) {
      query = query.eq('is_favorite', true);
    }
    if (params.min_rating) {
      query = query.gte('user_rating', params.min_rating);
    }

    // Tag filtering (AND logic)
    if (params.tags) {
      const tagArray = params.tags.split(',').map(tag => tag.trim());
      for (const tag of tagArray) {
        query = query.contains('tags', [tag]);
      }
    }

    // Full-text search
    if (params.search) {
      query = query.textSearch('name,notes', params.search, {
        type: 'websearch',
        config: 'english'
      });
    }

    // Sorting
    const sortField = params.sort || 'created_at';
    const sortOrder = params.order || 'desc';
    query = query.order(sortField, { ascending: sortOrder === 'asc' });

    // Pagination
    const offset = (params.page! - 1) * params.limit!;
    query = query.range(offset, offset + params.limit! - 1);

    const { data: assets, error, count } = await query;

    console.log('Assets API Query Result:', {
      assetsCount: assets?.length || 0,
      totalCount: count,
      error: error?.message,
      firstAsset: assets?.[0]?.id
    });

    if (error) {
      console.error('Error fetching assets:', error);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch assets' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<Asset[]>>({
      success: true,
      data: assets || [],
      meta: {
        pagination: {
          page: params.page!,
          limit: params.limit!,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / params.limit!)
        }
      }
    });

  } catch (error) {
    console.error('Error in GET /api/assets:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// POST /api/assets - Create new asset
// ============================================================================
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }, { status: 401 });
    }

    const body: CreateAssetRequest = await req.json();

    // Validate required fields
    if (!body.asset_type) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Asset type is required' }
      }, { status: 400 });
    }

    if (!body.generation_params) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Generation parameters are required' }
      }, { status: 400 });
    }

    // Validate project exists if provided
    if (body.project_id) {
      const { data: project, error: projectError } = await supabaseAdmin
        .from('projects')
        .select('id')
        .eq('id', body.project_id)
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (projectError || !project) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: { code: 'INVALID_PROJECT', message: 'Project not found or not accessible' }
        }, { status: 400 });
      }
    }

    // Validate folder exists if provided
    if (body.folder_id) {
      const { data: folder, error: folderError } = await supabaseAdmin
        .from('folders')
        .select('id, project_id')
        .eq('id', body.folder_id)
        .maybeSingle();

      if (folderError || !folder) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: { code: 'INVALID_FOLDER', message: 'Folder not found' }
        }, { status: 400 });
      }

      // Ensure folder belongs to the specified project
      if (body.project_id && folder.project_id !== body.project_id) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: { code: 'FOLDER_PROJECT_MISMATCH', message: 'Folder does not belong to the specified project' }
        }, { status: 400 });
      }
    }

    // Handle asset relationships if parent assets are specified
    if (body.parent_asset_ids && body.parent_asset_ids.length > 0) {
      const { data: parentAssets, error: parentsError } = await supabaseAdmin
        .from('assets')
        .select('id')
        .in('id', body.parent_asset_ids)
        .eq('user_id', session.user.id);

      if (parentsError || (parentAssets?.length || 0) !== body.parent_asset_ids.length) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: { code: 'INVALID_PARENT_ASSETS', message: 'One or more parent assets not found' }
        }, { status: 400 });
      }
    }

    // Generate a name if not provided
    const assetName = body.name || generateDefaultAssetName(body.asset_type, body.source_tool);

    // Create the asset
    const { data: asset, error } = await supabaseAdmin
      .from('assets')
      .insert({
        user_id: session.user.id,
        project_id: body.project_id || null,
        folder_id: body.folder_id || null,
        asset_type: body.asset_type,
        source_app: body.source_app || null,
        source_tool: body.source_tool || null,
        file_url: body.file_url || null,
        text_content: body.text_content || null,
        thumbnail_url: body.thumbnail_url || null,
        preview_urls: body.preview_urls || null,
        generation_params: body.generation_params,
        parent_asset_ids: body.parent_asset_ids || null,
        file_size_bytes: body.file_size_bytes || null,
        duration_seconds: body.duration_seconds || null,
        dimensions: body.dimensions || null,
        mime_type: body.mime_type || null,
        credits_used: body.credits_used || 0,
        generation_time_seconds: body.generation_time_seconds || null,
        api_cost_usd: body.api_cost_usd || null,
        name: assetName,
        tags: body.tags || null,
        notes: body.notes || null,
        is_favorite: false,
        status: 'active',
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating asset:', error);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to create asset' }
      }, { status: 500 });
    }

    // Create explicit asset relationships if parent assets were specified
    if (body.parent_asset_ids && body.parent_asset_ids.length > 0) {
      const relationships = body.parent_asset_ids.map(parentId => ({
        parent_asset_id: parentId,
        child_asset_id: asset.id,
        relationship_type: 'input', // Default relationship type
      }));

      const { error: relationshipError } = await supabaseAdmin
        .from('asset_relationships')
        .insert(relationships);

      if (relationshipError) {
        console.error('Error creating asset relationships:', relationshipError);
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: asset
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/assets:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateDefaultAssetName(assetType: AssetType, sourceTool?: string): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  const tool = sourceTool ? `${sourceTool}-` : '';

  switch (assetType) {
    case 'image':
      return `${tool}image-${timestamp}`;
    case 'video':
      return `${tool}video-${timestamp}`;
    case 'audio':
      return `${tool}audio-${timestamp}`;
    case 'text':
      return `${tool}text-${timestamp}`;
    case 'prompt':
      return `Prompt-${timestamp}`;
    case 'experiment':
      return `Experiment-${timestamp}`;
    case 'workflow':
      return `Workflow-${timestamp}`;
    case 'comparison':
      return `Comparison-${timestamp}`;
    default:
      return `Asset-${timestamp}`;
  }
}