import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  ApiResponse,
  CreateExperimentRequest,
  ExperimentListParams,
  Experiment,
  ExperimentOutcome
} from '@/lib/types/asset-repository';

// ============================================================================
// GET /api/experiments - List experiments
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
    const params: ExperimentListParams = {
      outcome: searchParams.get('outcome') as ExperimentOutcome || undefined,
      tags: searchParams.get('tags') || undefined,
      search: searchParams.get('search') || undefined,
      sort: searchParams.get('sort') as any || 'created_at',
      order: searchParams.get('order') as 'asc' | 'desc' || 'desc',
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '50'), 100),
    };

    // Build the query
    let query = supabaseAdmin
      .from('experiments')
      .select('*', { count: 'exact' })
      .eq('user_id', session.user.id);

    // Apply filters
    if (params.outcome) {
      query = query.eq('outcome', params.outcome);
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
      query = query.or(
        `title.ilike.%${params.search}%,hypothesis.ilike.%${params.search}%,methodology.ilike.%${params.search}%,results.ilike.%${params.search}%`
      );
    }

    // Sorting
    const sortField = params.sort || 'created_at';
    const sortOrder = params.order || 'desc';
    query = query.order(sortField, { ascending: sortOrder === 'asc' });

    // Pagination
    const offset = (params.page! - 1) * params.limit!;
    query = query.range(offset, offset + params.limit! - 1);

    const { data: experiments, error, count } = await query;

    if (error) {
      console.error('Error fetching experiments:', error);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch experiments' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<Experiment[]>>({
      success: true,
      data: experiments || [],
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
    console.error('Error in GET /api/experiments:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// POST /api/experiments - Document new experiment
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

    const body: CreateExperimentRequest = await req.json();

    // Validate required fields
    if (!body.title || !body.title.trim()) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Experiment title is required' }
      }, { status: 400 });
    }

    if (!body.hypothesis || !body.hypothesis.trim()) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Experiment hypothesis is required' }
      }, { status: 400 });
    }

    // Validate asset IDs if provided
    if (body.asset_ids && body.asset_ids.length > 0) {
      const { data: assets, error: assetsError } = await supabaseAdmin
        .from('assets')
        .select('id')
        .in('id', body.asset_ids)
        .eq('user_id', session.user.id);

      if (assetsError || (assets?.length || 0) !== body.asset_ids.length) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: { code: 'INVALID_ASSETS', message: 'One or more assets not found or not accessible' }
        }, { status: 400 });
      }
    }

    // Create the experiment
    const { data: experiment, error } = await supabaseAdmin
      .from('experiments')
      .insert({
        user_id: session.user.id,
        title: body.title.trim(),
        hypothesis: body.hypothesis.trim(),
        methodology: body.methodology?.trim() || null,
        results: body.results?.trim() || null,
        conclusion: body.conclusion?.trim() || null,
        outcome: body.outcome || null,
        asset_ids: body.asset_ids || null,
        tags: body.tags || null,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating experiment:', error);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to create experiment' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<Experiment>>({
      success: true,
      data: experiment
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/experiments:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}