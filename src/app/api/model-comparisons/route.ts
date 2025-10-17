import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  ApiResponse,
  ModelComparison
} from '@/lib/types/asset-repository';

// ============================================================================
// POST /api/model-comparisons - Create a model comparison
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

    const body: {
      title: string;
      asset_ids: string[];
      comparison_criteria: Record<string, any>;
      notes?: string;
      tags?: string[];
    } = await req.json();

    // Validate required fields
    if (!body.title || !body.title.trim()) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Comparison title is required' }
      }, { status: 400 });
    }

    if (!body.asset_ids || body.asset_ids.length < 2) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'At least 2 assets are required for comparison' }
      }, { status: 400 });
    }

    if (body.asset_ids.length > 10) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Maximum 10 assets allowed for comparison' }
      }, { status: 400 });
    }

    // Validate all assets exist and belong to the user
    const { data: assets, error: assetsError } = await supabaseAdmin
      .from('assets')
      .select('id, name, asset_type, generation_params')
      .in('id', body.asset_ids)
      .eq('user_id', session.user.id)
      .eq('status', 'active');

    if (assetsError || (assets?.length || 0) !== body.asset_ids.length) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'INVALID_ASSETS', message: 'One or more assets not found or not accessible' }
      }, { status: 400 });
    }

    // Extract models and generation parameters from assets
    const models = assets?.map(asset => {
      const params = asset.generation_params || {};
      return {
        asset_id: asset.id,
        asset_name: asset.name,
        asset_type: asset.asset_type,
        model: params.model || 'unknown',
        parameters: params
      };
    }) || [];

    // Create the comparison
    const { data: comparison, error } = await supabaseAdmin
      .from('model_comparisons')
      .insert({
        user_id: session.user.id,
        title: body.title.trim(),
        asset_ids: body.asset_ids,
        models,
        comparison_criteria: body.comparison_criteria || {},
        notes: body.notes?.trim() || null,
        tags: body.tags || null,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating model comparison:', error);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to create model comparison' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<ModelComparison>>({
      success: true,
      data: comparison
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/model-comparisons:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// GET /api/model-comparisons - List user's model comparisons
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

    const { searchParams } = new URL(req.url);
    const params = {
      tags: searchParams.get('tags') || undefined,
      search: searchParams.get('search') || undefined,
      sort: searchParams.get('sort') as any || 'created_at',
      order: searchParams.get('order') as 'asc' | 'desc' || 'desc',
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '50'), 100),
    };

    // Build the query
    let query = supabaseAdmin
      .from('model_comparisons')
      .select('*', { count: 'exact' })
      .eq('user_id', session.user.id);

    // Apply filters
    if (params.tags) {
      const tagArray = params.tags.split(',').map(tag => tag.trim());
      for (const tag of tagArray) {
        query = query.contains('tags', [tag]);
      }
    }

    // Full-text search
    if (params.search) {
      query = query.or(
        `title.ilike.%${params.search}%,notes.ilike.%${params.search}%`
      );
    }

    // Sorting
    const sortField = params.sort || 'created_at';
    const sortOrder = params.order || 'desc';
    query = query.order(sortField, { ascending: sortOrder === 'asc' });

    // Pagination
    const offset = (params.page! - 1) * params.limit!;
    query = query.range(offset, offset + params.limit! - 1);

    const { data: comparisons, error, count } = await query;

    if (error) {
      console.error('Error fetching model comparisons:', error);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch model comparisons' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<ModelComparison[]>>({
      success: true,
      data: comparisons || [],
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
    console.error('Error in GET /api/model-comparisons:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}