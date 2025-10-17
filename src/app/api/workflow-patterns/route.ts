import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  ApiResponse,
  WorkflowPattern
} from '@/lib/types/asset-repository';

// ============================================================================
// POST /api/workflow-patterns - Create a workflow pattern
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
      name: string;
      description?: string;
      steps: Array<{
        step_number: number;
        action_type: string;
        parameters: Record<string, any>;
        notes?: string;
      }>;
      tags?: string[];
      is_public?: boolean;
    } = await req.json();

    // Validate required fields
    if (!body.name || !body.name.trim()) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Workflow pattern name is required' }
      }, { status: 400 });
    }

    if (!body.steps || body.steps.length === 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'At least one workflow step is required' }
      }, { status: 400 });
    }

    // Validate steps
    for (const step of body.steps) {
      if (!step.action_type || typeof step.step_number !== 'number') {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Each step must have action_type and step_number' }
        }, { status: 400 });
      }
    }

    // Sort steps by step_number
    const sortedSteps = body.steps.sort((a, b) => a.step_number - b.step_number);

    // Check for duplicate pattern name
    const { data: existingPattern } = await supabaseAdmin
      .from('workflow_patterns')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('name', body.name.trim())
      .maybeSingle();

    if (existingPattern) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DUPLICATE_NAME', message: 'A workflow pattern with this name already exists' }
      }, { status: 409 });
    }

    // Create the workflow pattern
    const { data: pattern, error } = await supabaseAdmin
      .from('workflow_patterns')
      .insert({
        user_id: session.user.id,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        steps: sortedSteps,
        tags: body.tags || null,
        is_public: body.is_public || false,
        times_used: 0,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating workflow pattern:', error);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to create workflow pattern' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<WorkflowPattern>>({
      success: true,
      data: pattern
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/workflow-patterns:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// GET /api/workflow-patterns - List workflow patterns
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
      include_public: searchParams.get('include_public') === 'true',
      sort: searchParams.get('sort') as any || 'created_at',
      order: searchParams.get('order') as 'asc' | 'desc' || 'desc',
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '50'), 100),
    };

    // Build the query - include user's patterns and optionally public patterns
    let query = supabaseAdmin
      .from('workflow_patterns')
      .select('*', { count: 'exact' });

    if (params.include_public) {
      query = query.or(`user_id.eq.${session.user.id},is_public.eq.true`);
    } else {
      query = query.eq('user_id', session.user.id);
    }

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
        `name.ilike.%${params.search}%,description.ilike.%${params.search}%`
      );
    }

    // Sorting
    const sortField = params.sort || 'created_at';
    const sortOrder = params.order || 'desc';
    query = query.order(sortField, { ascending: sortOrder === 'asc' });

    // Pagination
    const offset = (params.page! - 1) * params.limit!;
    query = query.range(offset, offset + params.limit! - 1);

    const { data: patterns, error, count } = await query;

    if (error) {
      console.error('Error fetching workflow patterns:', error);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch workflow patterns' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<WorkflowPattern[]>>({
      success: true,
      data: patterns || [],
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
    console.error('Error in GET /api/workflow-patterns:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}