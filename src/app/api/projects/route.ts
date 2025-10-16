import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  ApiResponse,
  CreateProjectRequest,
  ProjectListParams,
  ProjectWithStats
} from '@/lib/types/asset-repository';

// ============================================================================
// GET /api/projects - List user's projects
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
      return NextResponse.json<ApiResponse<ProjectWithStats[]>>({
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
    const params: ProjectListParams = {
      archived: searchParams.get('archived') === 'true',
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '50'), 100),
    };

    // Build query with asset counts
    let query = supabaseAdmin
      .from('project_summaries')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('is_archived', params.archived || false)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false });

    // Apply pagination
    const offset = (params.page! - 1) * params.limit!;
    query = query.range(offset, offset + params.limit! - 1);

    const { data: projects, error, count } = await query;

    if (error) {
      console.error('Error fetching projects:', error);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch projects' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<ProjectWithStats[]>>({
      success: true,
      data: projects || [],
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
    console.error('Error in GET /api/projects:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// POST /api/projects - Create new project
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

    // Check if user ID is a valid UUID
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.user.id);
    if (!isValidUUID) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'INVALID_SESSION', message: 'Please sign out and sign back in' }
      }, { status: 400 });
    }

    const body: CreateProjectRequest = await req.json();

    // Validate required fields
    if (!body.name || !body.name.trim()) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Project name is required' }
      }, { status: 400 });
    }

    // Check for duplicate project name
    const { data: existingProject } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('name', body.name.trim())
      .maybeSingle();

    if (existingProject) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DUPLICATE_NAME', message: 'A project with this name already exists' }
      }, { status: 409 });
    }

    // Get the next position for ordering
    const { data: lastProject } = await supabaseAdmin
      .from('projects')
      .select('position')
      .eq('user_id', session.user.id)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextPosition = (lastProject?.position || 0) + 1;

    // Create the project
    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .insert({
        user_id: session.user.id,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        color: body.color || '#6366f1',
        position: nextPosition,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating project:', error);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to create project' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: project
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/projects:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}