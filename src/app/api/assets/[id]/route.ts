import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  ApiResponse,
  UpdateAssetRequest,
  AssetWithRelations,
  AssetRelationInfo
} from '@/lib/types/asset-repository';

// ============================================================================
// GET /api/assets/[id] - Get asset with full details and lineage
// ============================================================================
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }, { status: 401 });
    }

    // Fetch the main asset
    const { data: asset, error: assetError } = await supabaseAdmin
      .from('assets')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (assetError) {
      console.error('Error fetching asset:', assetError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch asset' }
      }, { status: 500 });
    }

    if (!asset) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Asset not found' }
      }, { status: 404 });
    }

    // Fetch parent relationships
    const { data: parentRels, error: parentError } = await supabaseAdmin
      .from('asset_relationships')
      .select(`
        relationship_type,
        notes,
        parent_asset_id,
        assets!asset_relationships_parent_asset_id_fkey (
          id,
          asset_type,
          thumbnail_url,
          name,
          created_at
        )
      `)
      .eq('child_asset_id', params.id);

    if (parentError) {
      console.error('Error fetching parent relationships:', parentError);
    }

    // Fetch child relationships
    const { data: childRels, error: childError } = await supabaseAdmin
      .from('asset_relationships')
      .select(`
        relationship_type,
        notes,
        child_asset_id,
        assets!asset_relationships_child_asset_id_fkey (
          id,
          asset_type,
          thumbnail_url,
          name,
          created_at
        )
      `)
      .eq('parent_asset_id', params.id);

    if (childError) {
      console.error('Error fetching child relationships:', childError);
    }

    // Fetch asset versions
    const { data: versions, error: versionsError } = await supabaseAdmin
      .from('asset_versions')
      .select('*')
      .eq('asset_id', params.id)
      .order('version_number', { ascending: false });

    if (versionsError) {
      console.error('Error fetching asset versions:', versionsError);
    }

    // Fetch project and folder info if they exist
    let project = null;
    let folder = null;

    if (asset.project_id) {
      const { data: projectData } = await supabaseAdmin
        .from('projects')
        .select('id, name, color')
        .eq('id', asset.project_id)
        .maybeSingle();
      project = projectData;
    }

    if (asset.folder_id) {
      const { data: folderData } = await supabaseAdmin
        .from('folders')
        .select('id, name, path')
        .eq('id', asset.folder_id)
        .maybeSingle();
      folder = folderData;
    }

    // Format the relationships
    const parent_assets: AssetRelationInfo[] = parentRels?.map(rel => ({
      id: (rel.assets as any).id,
      asset_type: (rel.assets as any).asset_type,
      thumbnail_url: (rel.assets as any).thumbnail_url,
      name: (rel.assets as any).name,
      relationship_type: rel.relationship_type as any,
      created_at: (rel.assets as any).created_at,
    })) || [];

    const child_assets: AssetRelationInfo[] = childRels?.map(rel => ({
      id: (rel.assets as any).id,
      asset_type: (rel.assets as any).asset_type,
      thumbnail_url: (rel.assets as any).thumbnail_url,
      name: (rel.assets as any).name,
      relationship_type: rel.relationship_type as any,
      created_at: (rel.assets as any).created_at,
    })) || [];

    const response: AssetWithRelations = {
      ...asset,
      parent_assets,
      child_assets,
      versions: versions || [],
      project,
      folder,
    };

    return NextResponse.json<ApiResponse<AssetWithRelations>>({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Error in GET /api/assets/[id]:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// PATCH /api/assets/[id] - Update asset metadata
// ============================================================================
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }, { status: 401 });
    }

    const body: UpdateAssetRequest = await req.json();

    // Validate the asset exists and belongs to the user
    const { data: existingAsset, error: fetchError } = await supabaseAdmin
      .from('assets')
      .select('id, project_id, folder_id')
      .eq('id', params.id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching asset for update:', fetchError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch asset' }
      }, { status: 500 });
    }

    if (!existingAsset) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Asset not found' }
      }, { status: 404 });
    }

    // Validate project if being changed
    if (body.project_id && body.project_id !== existingAsset.project_id) {
      const { data: project } = await supabaseAdmin
        .from('projects')
        .select('id')
        .eq('id', body.project_id)
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!project) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: { code: 'INVALID_PROJECT', message: 'Project not found or not accessible' }
        }, { status: 400 });
      }
    }

    // Validate folder if being changed
    if (body.folder_id && body.folder_id !== existingAsset.folder_id) {
      const { data: folder } = await supabaseAdmin
        .from('folders')
        .select('id, project_id')
        .eq('id', body.folder_id)
        .maybeSingle();

      if (!folder) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: { code: 'INVALID_FOLDER', message: 'Folder not found' }
        }, { status: 400 });
      }

      // Ensure folder belongs to the target project
      const targetProjectId = body.project_id !== undefined ? body.project_id : existingAsset.project_id;
      if (targetProjectId && folder.project_id !== targetProjectId) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: { code: 'FOLDER_PROJECT_MISMATCH', message: 'Folder does not belong to the target project' }
        }, { status: 400 });
      }
    }

    // Validate user rating
    if (body.user_rating !== undefined && (body.user_rating < 1 || body.user_rating > 5)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'User rating must be between 1 and 5' }
      }, { status: 400 });
    }

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name.trim() || null;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null;
    if (body.is_favorite !== undefined) updateData.is_favorite = body.is_favorite;
    if (body.user_rating !== undefined) updateData.user_rating = body.user_rating;
    if (body.project_id !== undefined) updateData.project_id = body.project_id;
    if (body.folder_id !== undefined) updateData.folder_id = body.folder_id;
    if (body.status !== undefined) updateData.status = body.status;

    // Update the asset
    const { data: updatedAsset, error: updateError } = await supabaseAdmin
      .from('assets')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_id', session.user.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating asset:', updateError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to update asset' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: updatedAsset
    });

  } catch (error) {
    console.error('Error in PATCH /api/assets/[id]:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// DELETE /api/assets/[id] - Delete asset (soft delete by default)
// ============================================================================
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const permanent = searchParams.get('permanent') === 'true';

    // Validate the asset exists and belongs to the user
    const { data: existingAsset, error: fetchError } = await supabaseAdmin
      .from('assets')
      .select('id, asset_type, file_url, thumbnail_url')
      .eq('id', params.id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching asset for deletion:', fetchError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch asset' }
      }, { status: 500 });
    }

    if (!existingAsset) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Asset not found' }
      }, { status: 404 });
    }

    if (permanent) {
      // Permanently delete the asset
      // Note: CASCADE will handle deleting related relationships and versions
      const { error: deleteError } = await supabaseAdmin
        .from('assets')
        .delete()
        .eq('id', params.id)
        .eq('user_id', session.user.id);

      if (deleteError) {
        console.error('Error permanently deleting asset:', deleteError);
        return NextResponse.json<ApiResponse>({
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Failed to delete asset' }
        }, { status: 500 });
      }

      // TODO: Delete associated files from S3
      // This would require calling the storage service to delete files

    } else {
      // Soft delete (mark as deleted)
      const { error: deleteError } = await supabaseAdmin
        .from('assets')
        .update({
          status: 'deleted',
          updated_at: new Date().toISOString()
        })
        .eq('id', params.id)
        .eq('user_id', session.user.id);

      if (deleteError) {
        console.error('Error soft deleting asset:', deleteError);
        return NextResponse.json<ApiResponse>({
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Failed to delete asset' }
        }, { status: 500 });
      }
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: params.id,
        action: permanent ? 'deleted' : 'soft_deleted'
      }
    });

  } catch (error) {
    console.error('Error in DELETE /api/assets/[id]:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}