import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  ApiResponse,
  UpdateProjectRequest,
  ProjectDetailsParams,
  ProjectWithStats,
  Asset
} from '@/lib/types/asset-repository';

// ============================================================================
// GET /api/projects/[id] - Get project details with assets
// ============================================================================
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const queryParams: ProjectDetailsParams = {
      include_assets: searchParams.get('include_assets') !== 'false',
      asset_limit: parseInt(searchParams.get('asset_limit') || '20'),
    };

    // Fetch project details
    const { data: project, error: projectError } = await supabaseAdmin
      .from('project_summaries')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (projectError) {
      console.error('Error fetching project:', projectError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch project' }
      }, { status: 500 });
    }

    if (!project) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' }
      }, { status: 404 });
    }

    let assets: Asset[] = [];
    if (queryParams.include_assets) {
      const { data: assetData, error: assetsError } = await supabaseAdmin
        .from('assets')
        .select(`
          id,
          asset_type,
          thumbnail_url,
          name,
          tags,
          is_favorite,
          user_rating,
          credits_used,
          file_size_bytes,
          created_at
        `)
        .eq('project_id', params.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(queryParams.asset_limit!);

      if (assetsError) {
        console.error('Error fetching project assets:', assetsError);
        // Don't fail the whole request, just log the error
      } else {
        assets = assetData || [];
      }
    }

    const response: ProjectWithStats & { assets?: Asset[] } = {
      ...project,
      ...(queryParams.include_assets && { assets }),
    };

    return NextResponse.json<ApiResponse>({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Error in GET /api/projects/[id]:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// PATCH /api/projects/[id] - Update project
// ============================================================================
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }, { status: 401 });
    }

    const body: UpdateProjectRequest = await req.json();

    // Validate the project exists and belongs to the user
    const { data: existingProject, error: fetchError } = await supabaseAdmin
      .from('projects')
      .select('id, name')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching project for update:', fetchError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch project' }
      }, { status: 500 });
    }

    if (!existingProject) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' }
      }, { status: 404 });
    }

    // Check for duplicate name if name is being changed
    if (body.name && body.name.trim() !== existingProject.name) {
      const { data: duplicateProject } = await supabaseAdmin
        .from('projects')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('name', body.name.trim())
        .neq('id', id)
        .maybeSingle();

      if (duplicateProject) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: { code: 'DUPLICATE_NAME', message: 'A project with this name already exists' }
        }, { status: 409 });
      }
    }

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.is_archived !== undefined) updateData.is_archived = body.is_archived;
    if (body.position !== undefined) updateData.position = body.position;

    // Update the project
    const { data: updatedProject, error: updateError } = await supabaseAdmin
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating project:', updateError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to update project' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: updatedProject
    });

  } catch (error) {
    console.error('Error in PATCH /api/projects/[id]:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// DELETE /api/projects/[id] - Archive or permanently delete project
// ============================================================================
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const permanent = searchParams.get('permanent') === 'true';

    // Validate the project exists and belongs to the user
    const { data: existingProject, error: fetchError } = await supabaseAdmin
      .from('projects')
      .select('id, is_archived')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching project for deletion:', fetchError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch project' }
      }, { status: 500 });
    }

    if (!existingProject) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' }
      }, { status: 404 });
    }

    if (permanent) {
      // Permanently delete the project
      // Note: CASCADE will handle deleting related folders and assets
      const { error: deleteError } = await supabaseAdmin
        .from('projects')
        .delete()
        .eq('id', id)
        .eq('user_id', session.user.id);

      if (deleteError) {
        console.error('Error permanently deleting project:', deleteError);
        return NextResponse.json<ApiResponse>({
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Failed to delete project' }
        }, { status: 500 });
      }

      // TODO: Also delete associated files from S3
      // This would require listing all assets in the project and deleting their files

    } else {
      // Soft delete (archive) the project
      const { error: archiveError } = await supabaseAdmin
        .from('projects')
        .update({
          is_archived: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', session.user.id);

      if (archiveError) {
        console.error('Error archiving project:', archiveError);
        return NextResponse.json<ApiResponse>({
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Failed to archive project' }
        }, { status: 500 });
      }
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: id,
        action: permanent ? 'deleted' : 'archived'
      }
    });

  } catch (error) {
    console.error('Error in DELETE /api/projects/[id]:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}