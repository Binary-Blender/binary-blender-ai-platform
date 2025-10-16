import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  ApiResponse,
  UpdateExperimentRequest,
  Experiment
} from '@/lib/types/asset-repository';

// ============================================================================
// GET /api/experiments/[id] - Get experiment details
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

    // Fetch the experiment with related assets
    const { data: experiment, error: experimentError } = await supabaseAdmin
      .from('experiments')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (experimentError) {
      console.error('Error fetching experiment:', experimentError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch experiment' }
      }, { status: 500 });
    }

    if (!experiment) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Experiment not found' }
      }, { status: 404 });
    }

    // Fetch associated assets if any
    let assets = [];
    if (experiment.asset_ids && experiment.asset_ids.length > 0) {
      const { data: assetData, error: assetsError } = await supabaseAdmin
        .from('assets')
        .select('id, asset_type, thumbnail_url, name, created_at')
        .in('id', experiment.asset_ids)
        .eq('user_id', session.user.id)
        .eq('status', 'active');

      if (!assetsError) {
        assets = assetData || [];
      }
    }

    const response = {
      ...experiment,
      assets,
    };

    return NextResponse.json<ApiResponse>({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Error in GET /api/experiments/[id]:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// PATCH /api/experiments/[id] - Update experiment
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

    const body: UpdateExperimentRequest = await req.json();

    // Validate the experiment exists and belongs to the user
    const { data: existingExperiment, error: fetchError } = await supabaseAdmin
      .from('experiments')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching experiment for update:', fetchError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch experiment' }
      }, { status: 500 });
    }

    if (!existingExperiment) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Experiment not found' }
      }, { status: 404 });
    }

    // Validate asset IDs if provided
    if (body.asset_ids && body.asset_ids.length > 0) {
      const { data: assets, error: assetsError } = await supabaseAdmin
        .from('assets')
        .select('id')
        .in('id', body.asset_ids)
        .eq('user_id', session.user.id);

      if (assetsError || (assets?.length || 0) !== body.asset_ids.length) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: { code: 'INVALID_ASSETS', message: 'One or more assets not found or not accessible' }
        }, { status: 400 });
      }
    }

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.hypothesis !== undefined) updateData.hypothesis = body.hypothesis.trim();
    if (body.methodology !== undefined) updateData.methodology = body.methodology?.trim() || null;
    if (body.results !== undefined) updateData.results = body.results?.trim() || null;
    if (body.conclusion !== undefined) updateData.conclusion = body.conclusion?.trim() || null;
    if (body.outcome !== undefined) updateData.outcome = body.outcome;
    if (body.asset_ids !== undefined) updateData.asset_ids = body.asset_ids;
    if (body.tags !== undefined) updateData.tags = body.tags;

    // Update the experiment
    const { data: updatedExperiment, error: updateError } = await supabaseAdmin
      .from('experiments')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_id', session.user.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating experiment:', updateError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to update experiment' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<Experiment>>({
      success: true,
      data: updatedExperiment
    });

  } catch (error) {
    console.error('Error in PATCH /api/experiments/[id]:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// DELETE /api/experiments/[id] - Delete experiment
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

    // Validate the experiment exists and belongs to the user
    const { data: existingExperiment, error: fetchError } = await supabaseAdmin
      .from('experiments')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching experiment for deletion:', fetchError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch experiment' }
      }, { status: 500 });
    }

    if (!existingExperiment) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Experiment not found' }
      }, { status: 404 });
    }

    // Delete the experiment
    const { error: deleteError } = await supabaseAdmin
      .from('experiments')
      .delete()
      .eq('id', params.id)
      .eq('user_id', session.user.id);

    if (deleteError) {
      console.error('Error deleting experiment:', deleteError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to delete experiment' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: params.id,
        action: 'deleted'
      }
    });

  } catch (error) {
    console.error('Error in DELETE /api/experiments/[id]:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}