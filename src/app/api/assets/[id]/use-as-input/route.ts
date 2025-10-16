import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  ApiResponse,
  AssetUseAsInputRequest,
  AssetUseAsInputResponse,
  SourceApp
} from '@/lib/types/asset-repository';

// ============================================================================
// POST /api/assets/[id]/use-as-input - Prepare asset as input for another tool
// ============================================================================
export async function POST(
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

    const body: AssetUseAsInputRequest = await req.json();

    // Validate target app
    if (!body.target_app) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Target app is required' }
      }, { status: 400 });
    }

    // Fetch the asset
    const { data: asset, error: assetError } = await supabaseAdmin
      .from('assets')
      .select('id, asset_type, file_url, thumbnail_url, name, mime_type')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (assetError) {
      console.error('Error fetching asset for input use:', assetError);
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

    // Validate compatibility between asset type and target app
    const compatibility = validateAssetAppCompatibility(asset.asset_type, body.target_app);
    if (!compatibility.compatible) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: 'INCOMPATIBLE_ASSET',
          message: compatibility.reason || 'Asset type not compatible with target app'
        }
      }, { status: 400 });
    }

    // Build redirect URL
    const redirectUrl = buildInputRedirectUrl(body.target_app, asset);

    const response: AssetUseAsInputResponse = {
      asset_id: asset.id,
      file_url: asset.file_url || undefined,
      redirect_url: redirectUrl,
    };

    return NextResponse.json<ApiResponse<AssetUseAsInputResponse>>({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Error in POST /api/assets/[id]/use-as-input:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

interface CompatibilityResult {
  compatible: boolean;
  reason?: string;
}

function validateAssetAppCompatibility(
  assetType: string,
  targetApp: SourceApp
): CompatibilityResult {
  const compatibilityMatrix: Record<SourceApp, string[]> = {
    image_studio: ['text', 'prompt'], // Can use text/prompts as input
    video_studio: ['image', 'text', 'prompt'], // Can use images and text as input
    lipsync: ['image', 'audio'], // Needs both image and audio
    chat_studio: ['text', 'prompt', 'image'], // Can use text, prompts, and images
    asset_repository: ['image', 'video', 'audio', 'text', 'prompt'], // Can view all
  };

  const allowedTypes = compatibilityMatrix[targetApp] || [];

  if (!allowedTypes.includes(assetType)) {
    return {
      compatible: false,
      reason: `${assetType} assets cannot be used as input for ${targetApp}`
    };
  }

  return { compatible: true };
}

function buildInputRedirectUrl(targetApp: SourceApp, asset: any): string {
  const baseUrls: Record<SourceApp, string> = {
    image_studio: '/image-studio',
    video_studio: '/video-studio',
    lipsync: '/lipsync',
    chat_studio: '/chat-studio',
    asset_repository: '/assets',
  };

  const baseUrl = baseUrls[targetApp];
  if (!baseUrl) {
    return '/assets';
  }

  const url = new URL(baseUrl, process.env.NEXTAUTH_URL || 'http://localhost:3000');

  // Add common parameters
  url.searchParams.set('input_asset_id', asset.id);
  url.searchParams.set('input_type', asset.asset_type);

  // Add app-specific parameters
  switch (targetApp) {
    case 'image_studio':
      if (asset.asset_type === 'prompt' || asset.asset_type === 'text') {
        // Use as prompt input
        url.searchParams.set('mode', 'prompt_input');
      }
      break;

    case 'video_studio':
      if (asset.asset_type === 'image') {
        url.searchParams.set('input_image_url', asset.file_url);
        url.searchParams.set('mode', 'image_to_video');
      } else if (asset.asset_type === 'prompt' || asset.asset_type === 'text') {
        url.searchParams.set('mode', 'prompt_input');
      }
      break;

    case 'lipsync':
      if (asset.asset_type === 'image') {
        url.searchParams.set('image_url', asset.file_url);
      } else if (asset.asset_type === 'audio') {
        url.searchParams.set('audio_url', asset.file_url);
      }
      break;

    case 'chat_studio':
      if (asset.asset_type === 'image') {
        url.searchParams.set('image_url', asset.file_url);
        url.searchParams.set('mode', 'image_analysis');
      } else if (asset.asset_type === 'text' || asset.asset_type === 'prompt') {
        url.searchParams.set('mode', 'text_input');
      }
      break;

    case 'asset_repository':
      // Just view the asset
      return `/assets/${asset.id}`;
  }

  return url.toString();
}