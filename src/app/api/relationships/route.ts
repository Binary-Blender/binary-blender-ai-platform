import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  ApiResponse,
  AssetRelationship,
  RelationshipType
} from '@/lib/types/asset-repository';

// ============================================================================
// POST /api/relationships - Create a new asset relationship
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

    const body: {
      parent_asset_id: string;
      child_asset_id: string;
      relationship_type: RelationshipType;
      notes?: string;
    } = await req.json();

    // Validate required fields
    if (!body.parent_asset_id || !body.child_asset_id || !body.relationship_type) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'parent_asset_id, child_asset_id, and relationship_type are required' }
      }, { status: 400 });
    }

    // Prevent self-relationships
    if (body.parent_asset_id === body.child_asset_id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'An asset cannot have a relationship with itself' }
      }, { status: 400 });
    }

    // Validate both assets exist and belong to the user
    const { data: parentAsset } = await supabaseAdmin
      .from('assets')
      .select('id')
      .eq('id', body.parent_asset_id)
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .maybeSingle();

    const { data: childAsset } = await supabaseAdmin
      .from('assets')
      .select('id')
      .eq('id', body.child_asset_id)
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!parentAsset) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Parent asset not found or not accessible' }
      }, { status: 404 });
    }

    if (!childAsset) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Child asset not found or not accessible' }
      }, { status: 404 });
    }

    // Check for existing relationship
    const { data: existingRel } = await supabaseAdmin
      .from('asset_relationships')
      .select('id')
      .eq('parent_asset_id', body.parent_asset_id)
      .eq('child_asset_id', body.child_asset_id)
      .maybeSingle();

    if (existingRel) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DUPLICATE_RELATIONSHIP', message: 'Relationship already exists between these assets' }
      }, { status: 409 });
    }

    // Create the relationship
    const { data: relationship, error } = await supabaseAdmin
      .from('asset_relationships')
      .insert({
        parent_asset_id: body.parent_asset_id,
        child_asset_id: body.child_asset_id,
        relationship_type: body.relationship_type,
        notes: body.notes?.trim() || null,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating relationship:', error);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to create relationship' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<AssetRelationship>>({
      success: true,
      data: relationship
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/relationships:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// DELETE /api/relationships - Delete a specific relationship
// ============================================================================
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parentAssetId = searchParams.get('parent_asset_id');
    const childAssetId = searchParams.get('child_asset_id');

    if (!parentAssetId || !childAssetId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'parent_asset_id and child_asset_id are required' }
      }, { status: 400 });
    }

    // Verify the user owns both assets
    const { data: parentAsset } = await supabaseAdmin
      .from('assets')
      .select('id')
      .eq('id', parentAssetId)
      .eq('user_id', session.user.id)
      .maybeSingle();

    const { data: childAsset } = await supabaseAdmin
      .from('assets')
      .select('id')
      .eq('id', childAssetId)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (!parentAsset || !childAsset) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'One or both assets not found or not accessible' }
      }, { status: 404 });
    }

    // Delete the relationship
    const { error } = await supabaseAdmin
      .from('asset_relationships')
      .delete()
      .eq('parent_asset_id', parentAssetId)
      .eq('child_asset_id', childAssetId);

    if (error) {
      console.error('Error deleting relationship:', error);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to delete relationship' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        parent_asset_id: parentAssetId,
        child_asset_id: childAssetId,
        action: 'deleted'
      }
    });

  } catch (error) {
    console.error('Error in DELETE /api/relationships:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}