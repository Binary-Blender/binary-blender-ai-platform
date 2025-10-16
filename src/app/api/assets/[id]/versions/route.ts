import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  ApiResponse,
  CreateAssetVersionRequest,
  AssetVersion
} from '@/lib/types/asset-repository';

// ============================================================================
// POST /api/assets/[id]/versions - Create new version of asset
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

    const body: CreateAssetVersionRequest = await req.json();

    // Validate required fields
    if (!body.file_url) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'File URL is required' }
      }, { status: 400 });
    }

    if (!body.generation_params) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Generation parameters are required' }
      }, { status: 400 });
    }

    // Validate the asset exists and belongs to the user
    const { data: asset, error: assetError } = await supabaseAdmin
      .from('assets')
      .select('id, user_id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (assetError) {
      console.error('Error fetching asset for version creation:', assetError);
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

    // Get the next version number
    const { data: lastVersion, error: versionError } = await supabaseAdmin
      .from('asset_versions')
      .select('version_number')
      .eq('asset_id', id)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (versionError) {
      console.error('Error fetching last version:', versionError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to determine version number' }
      }, { status: 500 });
    }

    const nextVersionNumber = (lastVersion?.version_number || 0) + 1;

    // Create the new version
    const { data: newVersion, error: createError } = await supabaseAdmin
      .from('asset_versions')
      .insert({
        asset_id: id,
        version_number: nextVersionNumber,
        file_url: body.file_url,
        thumbnail_url: body.thumbnail_url || null,
        generation_params: body.generation_params,
        credits_used: body.credits_used || 0,
        notes: body.notes?.trim() || null,
      })
      .select('*')
      .single();

    if (createError) {
      console.error('Error creating asset version:', createError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to create asset version' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<AssetVersion>>({
      success: true,
      data: newVersion
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/assets/[id]/versions:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// GET /api/assets/[id]/versions - List all versions of an asset
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

    // Validate the asset exists and belongs to the user
    const { data: asset, error: assetError } = await supabaseAdmin
      .from('assets')
      .select('id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (assetError) {
      console.error('Error fetching asset for versions:', assetError);
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

    // Fetch all versions for this asset
    const { data: versions, error: versionsError } = await supabaseAdmin
      .from('asset_versions')
      .select('*')
      .eq('asset_id', id)
      .order('version_number', { ascending: false });

    if (versionsError) {
      console.error('Error fetching asset versions:', versionsError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch versions' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<AssetVersion[]>>({
      success: true,
      data: versions || []
    });

  } catch (error) {
    console.error('Error in GET /api/assets/[id]/versions:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}