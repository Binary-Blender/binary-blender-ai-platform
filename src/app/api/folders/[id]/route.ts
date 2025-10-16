import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  ApiResponse,
  UpdateFolderRequest,
  Folder
} from '@/lib/types/asset-repository';

// ============================================================================
// GET /api/folders/[id] - Get folder details
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

    // Fetch folder and validate access through project ownership
    const { data: folder, error: folderError } = await supabaseAdmin
      .from('folders')
      .select(`
        *,
        projects!inner (
          id,
          user_id
        )
      `)
      .eq('id', id)
      .eq('projects.user_id', session.user.id)
      .maybeSingle();

    if (folderError) {
      console.error('Error fetching folder:', folderError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch folder' }
      }, { status: 500 });
    }

    if (!folder) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Folder not found' }
      }, { status: 404 });
    }

    // Remove the project data from the response (was only used for validation)
    const { projects, ...folderData } = folder;

    return NextResponse.json<ApiResponse<Folder>>({
      success: true,
      data: folderData
    });

  } catch (error) {
    console.error('Error in GET /api/folders/[id]:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// PATCH /api/folders/[id] - Update folder
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

    const body: UpdateFolderRequest = await req.json();

    // Fetch existing folder and validate access
    const { data: existingFolder, error: fetchError } = await supabaseAdmin
      .from('folders')
      .select(`
        *,
        projects!inner (
          id,
          user_id
        )
      `)
      .eq('id', id)
      .eq('projects.user_id', session.user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching folder for update:', fetchError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch folder' }
      }, { status: 500 });
    }

    if (!existingFolder) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Folder not found' }
      }, { status: 404 });
    }

    // Check for name conflicts if name is being changed
    if (body.name && body.name.trim() !== existingFolder.name) {
      const newName = body.name.trim();

      // Calculate the new path
      const pathParts = existingFolder.path.split('/');
      pathParts[pathParts.length - 1] = newName;
      const newPath = pathParts.join('/');

      // Check for duplicate path
      const { data: duplicateFolder } = await supabaseAdmin
        .from('folders')
        .select('id')
        .eq('project_id', existingFolder.project_id)
        .eq('path', newPath)
        .neq('id', id)
        .maybeSingle();

      if (duplicateFolder) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: { code: 'DUPLICATE_PATH', message: 'A folder with this name already exists in this location' }
        }, { status: 409 });
      }

      // If changing name, we need to update the path and all child folder paths
      if (newPath !== existingFolder.path) {
        // Update all child folder paths
        const { error: childUpdateError } = await supabaseAdmin.rpc(
          'update_folder_paths',
          {
            old_path_prefix: existingFolder.path,
            new_path_prefix: newPath,
            project_id: existingFolder.project_id
          }
        );

        if (childUpdateError) {
          console.error('Error updating child folder paths:', childUpdateError);
          // Don't fail the request, but log the error
        }
      }
    }

    // Build update object
    const updateData: any = {};

    if (body.name !== undefined) {
      const newName = body.name.trim();
      updateData.name = newName;

      // Update path
      const pathParts = existingFolder.path.split('/');
      pathParts[pathParts.length - 1] = newName;
      updateData.path = pathParts.join('/');
    }

    if (body.color !== undefined) updateData.color = body.color;
    if (body.position !== undefined) updateData.position = body.position;

    // Update the folder
    const { data: updatedFolder, error: updateError } = await supabaseAdmin
      .from('folders')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating folder:', updateError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to update folder' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<Folder>>({
      success: true,
      data: updatedFolder
    });

  } catch (error) {
    console.error('Error in PATCH /api/folders/[id]:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// DELETE /api/folders/[id] - Delete folder (moves assets to parent or root)
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

    // Fetch existing folder and validate access
    const { data: existingFolder, error: fetchError } = await supabaseAdmin
      .from('folders')
      .select(`
        *,
        projects!inner (
          id,
          user_id
        )
      `)
      .eq('id', id)
      .eq('projects.user_id', session.user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching folder for deletion:', fetchError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch folder' }
      }, { status: 500 });
    }

    if (!existingFolder) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Folder not found' }
      }, { status: 404 });
    }

    // Move assets to parent folder (or null for root)
    const { error: assetMoveError } = await supabaseAdmin
      .from('assets')
      .update({ folder_id: existingFolder.parent_folder_id })
      .eq('folder_id', id);

    if (assetMoveError) {
      console.error('Error moving assets from deleted folder:', assetMoveError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to move assets from folder' }
      }, { status: 500 });
    }

    // Move child folders to parent folder (or null for root)
    const { error: folderMoveError } = await supabaseAdmin
      .from('folders')
      .update({
        parent_folder_id: existingFolder.parent_folder_id,
        // Update paths to remove the deleted folder from the hierarchy
        // This would require a more complex update, but for now we'll handle it simply
      })
      .eq('parent_folder_id', id);

    if (folderMoveError) {
      console.error('Error moving child folders:', folderMoveError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to move child folders' }
      }, { status: 500 });
    }

    // Delete the folder
    const { error: deleteError } = await supabaseAdmin
      .from('folders')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting folder:', deleteError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to delete folder' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: id,
        action: 'deleted',
        assets_moved_to_parent: true,
        child_folders_moved_to_parent: true
      }
    });

  } catch (error) {
    console.error('Error in DELETE /api/folders/[id]:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}