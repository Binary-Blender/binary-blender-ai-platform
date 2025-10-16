import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateAssetId, generatePresignedUploadUrl, validateFile } from '@/lib/storage';
import {
  ApiResponse,
  UploadRequest,
  UploadResponse,
  AssetType
} from '@/lib/types/asset-repository';

// ============================================================================
// POST /api/upload/request - Generate presigned upload URL
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

    const body: UploadRequest = await req.json();

    // Validate required fields
    if (!body.file_type) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'file_type is required' }
      }, { status: 400 });
    }

    if (!body.file_size || body.file_size <= 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'file_size must be greater than 0' }
      }, { status: 400 });
    }

    if (!body.asset_type) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'asset_type is required' }
      }, { status: 400 });
    }

    // Generate a temporary filename from the MIME type
    const filename = generateFilenameFromMimeType(body.file_type, body.asset_type);

    // Validate file type and size
    const validation = await validateFile(filename, body.file_size, body.asset_type);
    if (!validation.isValid) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'INVALID_FILE', message: validation.error || 'Invalid file' }
      }, { status: 400 });
    }

    // Generate asset ID
    const assetId = generateAssetId();

    // Generate presigned upload URL
    const uploadInfo = await generatePresignedUploadUrl(
      session.user.id,
      assetId,
      body.asset_type,
      filename,
      body.file_type,
      body.file_size
    );

    const response: UploadResponse = {
      upload_url: uploadInfo.uploadUrl,
      asset_id: assetId,
      expires_at: uploadInfo.expiresAt.toISOString(),
    };

    // Store upload session in database for tracking
    // This helps us clean up incomplete uploads and associate them with assets later
    await storeUploadSession(session.user.id, assetId, {
      file_type: body.file_type,
      file_size: body.file_size,
      asset_type: body.asset_type,
      project_id: body.project_id,
      upload_url: uploadInfo.uploadUrl,
      file_path: uploadInfo.filePath,
      public_url: uploadInfo.publicUrl,
      expires_at: uploadInfo.expiresAt,
    });

    return NextResponse.json<ApiResponse<UploadResponse>>({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Error in POST /api/upload/request:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to generate upload URL' }
    }, { status: 500 });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateFilenameFromMimeType(mimeType: string, assetType: AssetType): string {
  const timestamp = Date.now();

  // Map MIME types to file extensions
  const mimeToExtension: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/mov': 'mov',
    'video/avi': 'avi',
    'video/webm': 'webm',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
    'text/plain': 'txt',
    'text/markdown': 'md',
    'application/json': 'json',
  };

  const extension = mimeToExtension[mimeType.toLowerCase()] || 'bin';
  return `${assetType}-${timestamp}.${extension}`;
}

async function storeUploadSession(
  userId: string,
  assetId: string,
  uploadData: {
    file_type: string;
    file_size: number;
    asset_type: AssetType;
    project_id?: string;
    upload_url: string;
    file_path: string;
    public_url: string;
    expires_at: Date;
  }
) {
  try {
    // For now, we'll use a simple approach and create an incomplete asset record
    // In production, you might want a separate upload_sessions table
    const { data, error } = await supabaseAdmin
      .from('assets')
      .insert({
        id: assetId,
        user_id: userId,
        project_id: uploadData.project_id || null,
        asset_type: uploadData.asset_type,
        file_url: uploadData.public_url,
        file_size_bytes: uploadData.file_size,
        mime_type: uploadData.file_type,
        generation_params: {
          upload_session: true,
          uploaded_at: new Date().toISOString(),
          file_type: uploadData.file_type,
          file_size: uploadData.file_size,
        },
        credits_used: 0,
        name: `Uploading ${uploadData.asset_type}...`,
        status: 'pending', // Mark as pending until upload is complete
      });

    if (error) {
      console.error('Error storing upload session:', error);
    }
  } catch (error) {
    console.error('Error in storeUploadSession:', error);
  }
}

// Note: Import supabaseAdmin at the top of the file
import { supabaseAdmin } from '@/lib/supabase';