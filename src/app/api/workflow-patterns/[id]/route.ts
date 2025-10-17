import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  ApiResponse,
  WorkflowPattern
} from '@/lib/types/asset-repository';

// ============================================================================
// GET /api/workflow-patterns/[id] - Get workflow pattern details
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

    // Fetch the workflow pattern (user's own or public)
    const { data: pattern, error: patternError } = await supabaseAdmin
      .from('workflow_patterns')
      .select('*')
      .eq('id', id)
      .or(`user_id.eq.${session.user.id},is_public.eq.true`)
      .maybeSingle();

    if (patternError) {
      console.error('Error fetching workflow pattern:', patternError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch workflow pattern' }
      }, { status: 500 });
    }

    if (!pattern) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Workflow pattern not found' }
      }, { status: 404 });
    }

    return NextResponse.json<ApiResponse<WorkflowPattern>>({
      success: true,
      data: pattern
    });

  } catch (error) {
    console.error('Error in GET /api/workflow-patterns/[id]:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// PATCH /api/workflow-patterns/[id] - Update workflow pattern
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
      name?: string;
      description?: string;
      steps?: Array<{
        step_number: number;
        action_type: string;
        parameters: Record<string, any>;
        notes?: string;
      }>;
      tags?: string[];
      is_public?: boolean;
    } = await req.json();

    // Validate the pattern exists and belongs to the user (only owners can edit)
    const { data: existingPattern, error: fetchError } = await supabaseAdmin
      .from('workflow_patterns')
      .select('id, name')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching workflow pattern for update:', fetchError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch workflow pattern' }
      }, { status: 500 });
    }

    if (!existingPattern) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Workflow pattern not found or not editable' }
      }, { status: 404 });
    }

    // Check for duplicate name if name is being changed
    if (body.name && body.name.trim() !== existingPattern.name) {
      const { data: duplicatePattern } = await supabaseAdmin
        .from('workflow_patterns')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('name', body.name.trim())
        .neq('id', id)
        .maybeSingle();

      if (duplicatePattern) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: { code: 'DUPLICATE_NAME', message: 'A workflow pattern with this name already exists' }
        }, { status: 409 });
      }
    }

    // Validate steps if provided
    if (body.steps) {
      if (body.steps.length === 0) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'At least one workflow step is required' }
        }, { status: 400 });
      }

      for (const step of body.steps) {
        if (!step.action_type || typeof step.step_number !== 'number') {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Each step must have action_type and step_number' }
          }, { status: 400 });
        }
      }
    }

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.steps !== undefined) {
      // Sort steps by step_number
      updateData.steps = body.steps.sort((a, b) => a.step_number - b.step_number);
    }
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.is_public !== undefined) updateData.is_public = body.is_public;

    // Update the pattern
    const { data: updatedPattern, error: updateError } = await supabaseAdmin
      .from('workflow_patterns')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating workflow pattern:', updateError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to update workflow pattern' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<WorkflowPattern>>({
      success: true,
      data: updatedPattern
    });

  } catch (error) {
    console.error('Error in PATCH /api/workflow-patterns/[id]:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// DELETE /api/workflow-patterns/[id] - Delete workflow pattern
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

    // Validate the pattern exists and belongs to the user
    const { data: existingPattern, error: fetchError } = await supabaseAdmin
      .from('workflow_patterns')
      .select('id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching workflow pattern for deletion:', fetchError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch workflow pattern' }
      }, { status: 500 });
    }

    if (!existingPattern) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Workflow pattern not found' }
      }, { status: 404 });
    }

    // Delete the pattern
    const { error: deleteError } = await supabaseAdmin
      .from('workflow_patterns')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (deleteError) {
      console.error('Error deleting workflow pattern:', deleteError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to delete workflow pattern' }
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
    console.error('Error in DELETE /api/workflow-patterns/[id]:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// POST /api/workflow-patterns/[id] - Execute workflow pattern (special action)
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

    const body: {
      action: 'use' | 'duplicate';
      input_parameters?: Record<string, any>;
    } = await req.json();

    if (!body.action) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Action is required (use or duplicate)' }
      }, { status: 400 });
    }

    // Fetch the workflow pattern (user's own or public)
    const { data: pattern, error: patternError } = await supabaseAdmin
      .from('workflow_patterns')
      .select('*')
      .eq('id', id)
      .or(`user_id.eq.${session.user.id},is_public.eq.true`)
      .maybeSingle();

    if (patternError || !pattern) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Workflow pattern not found' }
      }, { status: 404 });
    }

    if (body.action === 'use') {
      // Increment usage counter if it's the user's own pattern
      if (pattern.user_id === session.user.id) {
        await supabaseAdmin
          .from('workflow_patterns')
          .update({ times_used: (pattern.times_used || 0) + 1 })
          .eq('id', id);
      }

      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          pattern,
          action: 'ready_for_execution',
          message: 'Workflow pattern is ready to be executed with your input parameters'
        }
      });

    } else if (body.action === 'duplicate') {
      // Create a copy of the pattern for the current user
      const duplicatedPattern = {
        user_id: session.user.id,
        name: `${pattern.name} (Copy)`,
        description: pattern.description,
        steps: pattern.steps,
        tags: pattern.tags,
        is_public: false,
        times_used: 0,
      };

      const { data: newPattern, error: duplicateError } = await supabaseAdmin
        .from('workflow_patterns')
        .insert(duplicatedPattern)
        .select('*')
        .single();

      if (duplicateError) {
        console.error('Error duplicating workflow pattern:', duplicateError);
        return NextResponse.json<ApiResponse>({
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Failed to duplicate workflow pattern' }
        }, { status: 500 });
      }

      return NextResponse.json<ApiResponse<WorkflowPattern>>({
        success: true,
        data: newPattern
      });
    }

    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid action. Must be "use" or "duplicate"' }
    }, { status: 400 });

  } catch (error) {
    console.error('Error in POST /api/workflow-patterns/[id]:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}