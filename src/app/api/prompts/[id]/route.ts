import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  ApiResponse,
  UpdatePromptRequest,
  Prompt
} from '@/lib/types/asset-repository';

// ============================================================================
// GET /api/prompts/[id] - Get prompt details
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

    // Fetch the prompt
    const { data: prompt, error: promptError } = await supabaseAdmin
      .from('prompts')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (promptError) {
      console.error('Error fetching prompt:', promptError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch prompt' }
      }, { status: 500 });
    }

    if (!prompt) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Prompt not found' }
      }, { status: 404 });
    }

    return NextResponse.json<ApiResponse<Prompt>>({
      success: true,
      data: prompt
    });

  } catch (error) {
    console.error('Error in GET /api/prompts/[id]:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// PATCH /api/prompts/[id] - Update prompt
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

    const body: UpdatePromptRequest = await req.json();

    // Validate the prompt exists and belongs to the user
    const { data: existingPrompt, error: fetchError } = await supabaseAdmin
      .from('prompts')
      .select('id, name')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching prompt for update:', fetchError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch prompt' }
      }, { status: 500 });
    }

    if (!existingPrompt) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Prompt not found' }
      }, { status: 404 });
    }

    // Check for duplicate name if name is being changed
    if (body.name && body.name.trim() !== existingPrompt.name) {
      const { data: duplicatePrompt } = await supabaseAdmin
        .from('prompts')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('name', body.name.trim())
        .neq('id', id)
        .maybeSingle();

      if (duplicatePrompt) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: { code: 'DUPLICATE_NAME', message: 'A prompt with this name already exists' }
        }, { status: 409 });
      }
    }

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.prompt_text !== undefined) updateData.prompt_text = body.prompt_text.trim();
    if (body.negative_prompt !== undefined) updateData.negative_prompt = body.negative_prompt?.trim() || null;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.asset_types !== undefined) updateData.asset_types = body.asset_types;
    if (body.tags !== undefined) updateData.tags = body.tags;

    // Update the prompt
    const { data: updatedPrompt, error: updateError } = await supabaseAdmin
      .from('prompts')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating prompt:', updateError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to update prompt' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<Prompt>>({
      success: true,
      data: updatedPrompt
    });

  } catch (error) {
    console.error('Error in PATCH /api/prompts/[id]:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// DELETE /api/prompts/[id] - Delete prompt
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

    // Validate the prompt exists and belongs to the user
    const { data: existingPrompt, error: fetchError } = await supabaseAdmin
      .from('prompts')
      .select('id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching prompt for deletion:', fetchError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch prompt' }
      }, { status: 500 });
    }

    if (!existingPrompt) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Prompt not found' }
      }, { status: 404 });
    }

    // Delete the prompt
    const { error: deleteError } = await supabaseAdmin
      .from('prompts')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (deleteError) {
      console.error('Error deleting prompt:', deleteError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to delete prompt' }
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
    console.error('Error in DELETE /api/prompts/[id]:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}