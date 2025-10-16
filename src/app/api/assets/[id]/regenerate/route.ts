import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  ApiResponse,
  AssetRegenerateResponse,
  SourceApp
} from '@/lib/types/asset-repository';

// ============================================================================
// POST /api/assets/[id]/regenerate - Prepare asset for regeneration
// ============================================================================
export async function POST(
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

    // Fetch the asset with its generation parameters
    const { data: asset, error: assetError } = await supabaseAdmin
      .from('assets')
      .select('id, asset_type, source_app, source_tool, generation_params, name')
      .eq('id', params.id)
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (assetError) {
      console.error('Error fetching asset for regeneration:', assetError);
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

    // Determine the source app for regeneration
    const sourceApp = asset.source_app as SourceApp;
    if (!sourceApp) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NO_SOURCE_APP', message: 'Asset has no source app defined for regeneration' }
      }, { status: 400 });
    }

    // Build redirect URL with preset parameters
    const redirectUrl = buildRegenerateRedirectUrl(sourceApp, asset.generation_params, asset.id);

    const response: AssetRegenerateResponse = {
      source_app: sourceApp,
      generation_params: asset.generation_params,
      redirect_url: redirectUrl,
    };

    return NextResponse.json<ApiResponse<AssetRegenerateResponse>>({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Error in POST /api/assets/[id]/regenerate:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildRegenerateRedirectUrl(
  sourceApp: SourceApp,
  generationParams: any,
  originalAssetId: string
): string {
  const baseUrls: Record<SourceApp, string> = {
    image_studio: '/image-studio',
    video_studio: '/video-studio',
    lipsync: '/lipsync',
    chat_studio: '/chat-studio',
    asset_repository: '/assets',
  };

  const baseUrl = baseUrls[sourceApp];
  if (!baseUrl) {
    return '/assets';
  }

  // Create URL with preset parameters
  const url = new URL(baseUrl, process.env.NEXTAUTH_URL || 'http://localhost:3000');

  // Add common parameters
  url.searchParams.set('preset', 'regenerate');
  url.searchParams.set('original_asset_id', originalAssetId);

  // Add app-specific parameters
  switch (sourceApp) {
    case 'image_studio':
      if (generationParams.prompt) url.searchParams.set('prompt', generationParams.prompt);
      if (generationParams.negative_prompt) url.searchParams.set('negative_prompt', generationParams.negative_prompt);
      if (generationParams.model) url.searchParams.set('model', generationParams.model);
      if (generationParams.width) url.searchParams.set('width', generationParams.width.toString());
      if (generationParams.height) url.searchParams.set('height', generationParams.height.toString());
      if (generationParams.steps) url.searchParams.set('steps', generationParams.steps.toString());
      if (generationParams.guidance_scale) url.searchParams.set('guidance_scale', generationParams.guidance_scale.toString());
      break;

    case 'video_studio':
      if (generationParams.prompt) url.searchParams.set('prompt', generationParams.prompt);
      if (generationParams.model) url.searchParams.set('model', generationParams.model);
      if (generationParams.duration) url.searchParams.set('duration', generationParams.duration.toString());
      if (generationParams.aspect_ratio) url.searchParams.set('aspect_ratio', generationParams.aspect_ratio);
      break;

    case 'lipsync':
      if (generationParams.image_url) url.searchParams.set('image_url', generationParams.image_url);
      if (generationParams.audio_url) url.searchParams.set('audio_url', generationParams.audio_url);
      break;

    case 'chat_studio':
      if (generationParams.prompt) url.searchParams.set('prompt', generationParams.prompt);
      if (generationParams.model) url.searchParams.set('model', generationParams.model);
      if (generationParams.system_prompt) url.searchParams.set('system_prompt', generationParams.system_prompt);
      break;
  }

  return url.toString();
}