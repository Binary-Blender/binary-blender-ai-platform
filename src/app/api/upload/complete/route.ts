import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { generateThumbnail } from '@/lib/thumbnail-generator';

// ============================================================================
// POST /api/upload/complete - Complete file upload and process asset
// ============================================================================
interface UploadCompleteBody {
  asset_id: string;
  file_key: string;
  thumbnail_key?: string;
  file_url: string;
  name?: string;
  notes?: string;
  tags?: string[];
  project_id?: string;
  folder_id?: string;
  generation_params?: any;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }, { status: 401 });
    }

    const body: UploadCompleteBody = await req.json();

    // Validate required fields
    if (!body.asset_id || !body.file_key || !body.file_url) {
      return NextResponse.json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'asset_id, file_key, and file_url are required' }
      }, { status: 400 });
    }

    // Fetch the existing asset record to get its details
    const { data: existingAsset, error: fetchError } = await supabaseAdmin
      .from('assets')
      .select('*')
      .eq('id', body.asset_id)
      .eq('user_id', session.user.id)
      .single();

    if (fetchError || !existingAsset) {
      return NextResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Upload session not found' }
      }, { status: 404 });
    }

    // Generate thumbnail if asset type supports it
    let thumbnailUrl = existingAsset.thumbnail_url;
    if (body.thumbnail_key && ['image', 'video', 'audio'].includes(existingAsset.asset_type)) {
      console.log(`🖼️ Generating thumbnail for ${existingAsset.asset_type} asset...`);

      const thumbnailResult = await generateThumbnail(
        existingAsset.asset_type as 'image' | 'video' | 'audio',
        body.file_url,
        body.thumbnail_key
      );

      if (thumbnailResult.success) {
        thumbnailUrl = thumbnailResult.thumbnailUrl;
        console.log(`✅ Thumbnail generated: ${thumbnailUrl}`);
      } else {
        console.warn(`⚠️ Thumbnail generation failed: ${thumbnailResult.error}`);
        // Continue without thumbnail - not a fatal error
      }
    }

    // Update the asset record with complete information
    const updateData = {
      file_url: body.file_url,
      thumbnail_url: thumbnailUrl,
      name: body.name || existingAsset.name,
      notes: body.notes || existingAsset.notes,
      tags: body.tags || existingAsset.tags,
      project_id: body.project_id !== undefined ? body.project_id : existingAsset.project_id,
      folder_id: body.folder_id !== undefined ? body.folder_id : existingAsset.folder_id,
      generation_params: {
        ...existingAsset.generation_params,
        ...body.generation_params,
        upload_completed_at: new Date().toISOString(),
      },
      status: 'active', // Mark as active now that upload is complete
      updated_at: new Date().toISOString(),
    };

    const { data: updatedAsset, error: updateError } = await supabaseAdmin
      .from('assets')
      .update(updateData)
      .eq('id', body.asset_id)
      .eq('user_id', session.user.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating asset:', updateError);
      return NextResponse.json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to update asset' }
      }, { status: 500 });
    }

    console.log(`✅ Upload completed for asset ${body.asset_id}`);

    return NextResponse.json({
      success: true,
      data: updatedAsset
    });

  } catch (error) {
    console.error('Error completing upload:', error);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to complete upload' }
    }, { status: 500 });
  }
}

// ============================================================================
// DELETE /api/upload/complete - Cancel incomplete upload
// ============================================================================
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const assetId = searchParams.get('asset_id');

    if (!assetId) {
      return NextResponse.json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'asset_id is required' }
      }, { status: 400 });
    }

    // Delete the incomplete asset record
    const { error: deleteError } = await supabaseAdmin
      .from('assets')
      .delete()
      .eq('id', assetId)
      .eq('user_id', session.user.id)
      .eq('status', 'pending'); // Only delete if still pending

    if (deleteError) {
      console.error('Error deleting incomplete upload:', deleteError);
      return NextResponse.json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to cancel upload' }
      }, { status: 500 });
    }

    console.log(`🗑️ Cancelled upload for asset ${assetId}`);

    return NextResponse.json({
      success: true,
      data: { message: 'Upload cancelled successfully' }
    });

  } catch (error) {
    console.error('Error cancelling upload:', error);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel upload' }
    }, { status: 500 });
  }
}