import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPresignedUploadUrl, generateUploadKey, getS3PublicUrl } from '@/lib/s3-upload';
import { supabaseAdmin } from '@/lib/supabase';

// ============================================================================
// POST /api/upload/request - Generate presigned upload URL
// ============================================================================
interface UploadRequestBody {
  file_type: string
  file_size: number
  project_id?: string
  asset_type: 'image' | 'video' | 'audio' | 'text'
  file_name?: string
}

interface UploadRequestResponse {
  upload_url: string
  asset_id: string
  file_key: string
  thumbnail_key?: string
  file_url: string
  thumbnail_url?: string
  expires_at: string
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

    const body: UploadRequestBody = await req.json();

    // Validate request body
    if (!body.file_type || !body.file_size || !body.asset_type) {
      return NextResponse.json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'file_type, file_size, and asset_type are required' }
      }, { status: 400 });
    }

    // Validate file size (100MB limit)
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    if (body.file_size > MAX_FILE_SIZE) {
      return NextResponse.json({
        success: false,
        error: { code: 'FILE_TOO_LARGE', message: 'File size exceeds 100MB limit' }
      }, { status: 400 });
    }

    // Validate file type
    const allowedMimeTypes = {
      image: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
      video: ['video/mp4', 'video/mov', 'video/avi', 'video/webm'],
      audio: ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/aac'],
      text: ['text/plain', 'text/markdown', 'application/json']
    };

    if (!allowedMimeTypes[body.asset_type].includes(body.file_type)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: `File type ${body.file_type} not allowed for ${body.asset_type} assets`
        }
      }, { status: 400 });
    }

    // Extract file extension from MIME type
    const extensionMap: Record<string, string> = {
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
      'audio/wav': 'wav',
      'audio/m4a': 'm4a',
      'audio/aac': 'aac',
      'text/plain': 'txt',
      'text/markdown': 'md',
      'application/json': 'json'
    };

    const fileExtension = extensionMap[body.file_type] || 'bin';

    // Generate upload keys and URLs
    const { assetId, fileKey, thumbnailKey } = generateUploadKey(
      session.user.id,
      body.asset_type,
      fileExtension
    );

    // Generate presigned URL for file upload (expires in 1 hour)
    const expiresIn = 3600; // 1 hour
    const uploadUrl = await getPresignedUploadUrl(fileKey, body.file_type, expiresIn);

    // Generate public URLs (these will be valid after upload)
    const fileUrl = getS3PublicUrl(fileKey);
    const thumbnailUrl = body.asset_type !== 'text' ? getS3PublicUrl(thumbnailKey) : undefined;

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Store upload session in database for tracking
    await storeUploadSession(session.user.id, assetId, {
      file_type: body.file_type,
      file_size: body.file_size,
      asset_type: body.asset_type,
      project_id: body.project_id,
      file_key: fileKey,
      thumbnail_key: thumbnailKey,
      file_url: fileUrl,
      thumbnail_url: thumbnailUrl,
    });

    const response: UploadRequestResponse = {
      upload_url: uploadUrl,
      asset_id: assetId,
      file_key: fileKey,
      thumbnail_key: body.asset_type !== 'text' ? thumbnailKey : undefined,
      file_url: fileUrl,
      thumbnail_url: thumbnailUrl,
      expires_at: expiresAt
    };

    return NextResponse.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Error generating upload URL:', error);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to generate upload URL' }
    }, { status: 500 });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function storeUploadSession(
  userId: string,
  assetId: string,
  uploadData: {
    file_type: string;
    file_size: number;
    asset_type: 'image' | 'video' | 'audio' | 'text';
    project_id?: string;
    file_key: string;
    thumbnail_key?: string;
    file_url: string;
    thumbnail_url?: string;
  }
) {
  try {
    // Create an incomplete asset record to track the upload session
    const { data, error } = await supabaseAdmin
      .from('assets')
      .insert({
        id: assetId,
        user_id: userId,
        project_id: uploadData.project_id || null,
        asset_type: uploadData.asset_type,
        file_url: uploadData.file_url,
        thumbnail_url: uploadData.thumbnail_url,
        file_size_bytes: uploadData.file_size,
        mime_type: uploadData.file_type,
        generation_params: {
          upload_session: true,
          uploaded_at: new Date().toISOString(),
          file_type: uploadData.file_type,
          file_size: uploadData.file_size,
          file_key: uploadData.file_key,
          thumbnail_key: uploadData.thumbnail_key,
        },
        credits_used: 0,
        name: `Uploading ${uploadData.asset_type}...`,
        status: 'pending', // Mark as pending until upload is complete
      });

    if (error) {
      console.error('Error storing upload session:', error);
    } else {
      console.log(`✅ Created upload session for asset ${assetId}`);
    }
  } catch (error) {
    console.error('Error in storeUploadSession:', error);
  }
}