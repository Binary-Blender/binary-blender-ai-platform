import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { generateImageThumbnail, storageService } from '@/lib/storage';
import {
  ApiResponse,
  Asset,
  AssetType
} from '@/lib/types/asset-repository';

// ============================================================================
// POST /api/upload/complete - Complete file upload and process asset
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

    const body = await req.json();
    const { asset_id, success: uploadSuccess, file_url, metadata } = body;

    // Validate required fields
    if (!asset_id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'asset_id is required' }
      }, { status: 400 });
    }

    // Fetch the pending asset record
    const { data: asset, error: assetError } = await supabaseAdmin
      .from('assets')
      .select('*')
      .eq('id', asset_id)
      .eq('user_id', session.user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (assetError) {
      console.error('Error fetching pending asset:', assetError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch upload session' }
      }, { status: 500 });
    }

    if (!asset) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Upload session not found or already completed' }
      }, { status: 404 });
    }

    if (!uploadSuccess) {
      // Mark the asset as failed and return error
      await supabaseAdmin
        .from('assets')
        .update({
          status: 'deleted', // Mark as deleted since upload failed
          updated_at: new Date().toISOString(),
        })
        .eq('id', asset_id);

      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'UPLOAD_FAILED', message: 'File upload failed' }
      }, { status: 400 });
    }

    // Process the uploaded file
    const processedAsset = await processUploadedFile(asset, file_url, metadata);

    return NextResponse.json<ApiResponse<Asset>>({
      success: true,
      data: processedAsset
    });

  } catch (error) {
    console.error('Error in POST /api/upload/complete:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to complete upload' }
    }, { status: 500 });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function processUploadedFile(
  asset: any,
  finalFileUrl?: string,
  metadata?: any
): Promise<Asset> {
  try {
    const updateData: any = {
      status: 'active',
      updated_at: new Date().toISOString(),
    };

    // Use provided file URL or keep the existing one
    if (finalFileUrl) {
      updateData.file_url = finalFileUrl;
    }

    // Update metadata if provided
    if (metadata) {
      if (metadata.width && metadata.height) {
        updateData.dimensions = {
          width: metadata.width,
          height: metadata.height,
          ...(metadata.fps && { fps: metadata.fps }),
        };
      }
      if (metadata.duration) {
        updateData.duration_seconds = metadata.duration;
      }
      if (metadata.file_size) {
        updateData.file_size_bytes = metadata.file_size;
      }
    }

    // Generate thumbnail for images
    if (asset.asset_type === 'image' && asset.file_url) {
      try {
        const thumbnailUrl = await generateThumbnailForAsset(
          asset.user_id,
          asset.id,
          asset.file_url,
          asset.asset_type
        );
        if (thumbnailUrl) {
          updateData.thumbnail_url = thumbnailUrl;
        }
      } catch (thumbnailError) {
        console.error('Error generating thumbnail:', thumbnailError);
        // Don't fail the upload for thumbnail generation errors
      }
    }

    // Generate a proper name if still using the placeholder
    if (asset.name?.startsWith('Uploading ')) {
      updateData.name = generateAssetName(asset.asset_type, asset.mime_type);
    }

    // Update the asset record
    const { data: updatedAsset, error: updateError } = await supabaseAdmin
      .from('assets')
      .update(updateData)
      .eq('id', asset.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating asset after upload:', updateError);
      throw new Error('Failed to update asset');
    }

    return updatedAsset;

  } catch (error) {
    console.error('Error processing uploaded file:', error);

    // Mark the asset as failed
    await supabaseAdmin
      .from('assets')
      .update({
        status: 'deleted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', asset.id);

    throw error;
  }
}

async function generateThumbnailForAsset(
  userId: string,
  assetId: string,
  fileUrl: string,
  assetType: AssetType
): Promise<string | null> {
  try {
    if (assetType !== 'image') {
      return null; // Only generate thumbnails for images for now
    }

    // Download the original file
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Generate thumbnail
    const thumbnailUrl = await generateImageThumbnail(buffer, userId, assetId);
    return thumbnailUrl;

  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return null;
  }
}

function generateAssetName(assetType: AssetType, mimeType?: string): string {
  const timestamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');

  let typeLabel = assetType;
  if (mimeType) {
    const typeMap: Record<string, string> = {
      'image/jpeg': 'JPEG Image',
      'image/png': 'PNG Image',
      'image/webp': 'WebP Image',
      'image/gif': 'GIF Image',
      'video/mp4': 'MP4 Video',
      'video/mov': 'MOV Video',
      'audio/mp3': 'MP3 Audio',
      'audio/wav': 'WAV Audio',
      'text/plain': 'Text File',
      'application/json': 'JSON File',
    };
    typeLabel = typeMap[mimeType] || assetType;
  }

  return `${typeLabel} ${timestamp}`;
}