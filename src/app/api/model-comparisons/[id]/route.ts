import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  ApiResponse,
  ModelComparison
} from '@/lib/types/asset-repository';

// ============================================================================
// GET /api/model-comparisons/[id] - Get model comparison details
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

    // Fetch the comparison
    const { data: comparison, error: comparisonError } = await supabaseAdmin
      .from('model_comparisons')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (comparisonError) {
      console.error('Error fetching model comparison:', comparisonError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch model comparison' }
      }, { status: 500 });
    }

    if (!comparison) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Model comparison not found' }
      }, { status: 404 });
    }

    // Fetch associated assets if any
    let assets = [];
    if (comparison.asset_ids && comparison.asset_ids.length > 0) {
      const { data: assetData, error: assetsError } = await supabaseAdmin
        .from('assets')
        .select('id, asset_type, thumbnail_url, name, file_url, created_at, generation_params, user_rating')
        .in('id', comparison.asset_ids)
        .eq('user_id', session.user.id)
        .eq('status', 'active');

      if (!assetsError) {
        assets = assetData || [];
      }
    }

    const response = {
      ...comparison,
      assets,
    };

    return NextResponse.json<ApiResponse>({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Error in GET /api/model-comparisons/[id]:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// PATCH /api/model-comparisons/[id] - Update model comparison
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

    const body: {
      title?: string;
      comparison_criteria?: Record<string, any>;
      notes?: string;
      tags?: string[];
    } = await req.json();

    // Validate the comparison exists and belongs to the user
    const { data: existingComparison, error: fetchError } = await supabaseAdmin
      .from('model_comparisons')
      .select('id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching model comparison for update:', fetchError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch model comparison' }
      }, { status: 500 });
    }

    if (!existingComparison) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Model comparison not found' }
      }, { status: 404 });
    }

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.comparison_criteria !== undefined) updateData.comparison_criteria = body.comparison_criteria;
    if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null;
    if (body.tags !== undefined) updateData.tags = body.tags;

    // Update the comparison
    const { data: updatedComparison, error: updateError } = await supabaseAdmin
      .from('model_comparisons')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating model comparison:', updateError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to update model comparison' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<ModelComparison>>({
      success: true,
      data: updatedComparison
    });

  } catch (error) {
    console.error('Error in PATCH /api/model-comparisons/[id]:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// DELETE /api/model-comparisons/[id] - Delete model comparison
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

    // Validate the comparison exists and belongs to the user
    const { data: existingComparison, error: fetchError } = await supabaseAdmin
      .from('model_comparisons')
      .select('id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching model comparison for deletion:', fetchError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch model comparison' }
      }, { status: 500 });
    }

    if (!existingComparison) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Model comparison not found' }
      }, { status: 404 });
    }

    // Delete the comparison
    const { error: deleteError } = await supabaseAdmin
      .from('model_comparisons')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (deleteError) {
      console.error('Error deleting model comparison:', deleteError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to delete model comparison' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: id,
        action: 'deleted'
      }
    });

  } catch (error) {
    console.error('Error in DELETE /api/model-comparisons/[id]:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}