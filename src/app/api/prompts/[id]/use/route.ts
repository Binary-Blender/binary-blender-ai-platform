import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ApiResponse } from '@/lib/types/asset-repository';

// ============================================================================
// POST /api/prompts/[id]/use - Increment usage counter
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

    // Validate the prompt exists and belongs to the user
    const { data: existingPrompt, error: fetchError } = await supabaseAdmin
      .from('prompts')
      .select('id, times_used')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching prompt for use tracking:', fetchError);
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

    // Increment usage counter and update last used timestamp
    const { data: updatedPrompt, error: updateError } = await supabaseAdmin
      .from('prompts')
      .update({
        times_used: (existingPrompt.times_used || 0) + 1,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select('id, times_used, last_used_at')
      .single();

    if (updateError) {
      console.error('Error updating prompt usage:', updateError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to update prompt usage' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: id,
        times_used: updatedPrompt.times_used,
        last_used_at: updatedPrompt.last_used_at,
      }
    });

  } catch (error) {
    console.error('Error in POST /api/prompts/[id]/use:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}