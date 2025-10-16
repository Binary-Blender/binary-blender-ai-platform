import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  ApiResponse,
  CreatePromptRequest,
  PromptListParams,
  Prompt,
  PromptCategory,
  AssetType
} from '@/lib/types/asset-repository';

// ============================================================================
// GET /api/prompts - List user's prompts
// ============================================================================
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }, { status: 401 });
    }

    // Check if user ID is a valid UUID
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.user.id);
    if (!isValidUUID) {
      return NextResponse.json<ApiResponse<Prompt[]>>({
        success: true,
        data: [],
        meta: {
          pagination: {
            page: 1,
            limit: 50,
            total: 0,
            totalPages: 0
          }
        }
      });
    }

    const { searchParams } = new URL(req.url);
    const params: PromptListParams = {
      category: searchParams.get('category') as PromptCategory || undefined,
      asset_type: searchParams.get('asset_type') as AssetType || undefined,
      tags: searchParams.get('tags') || undefined,
      search: searchParams.get('search') || undefined,
      sort: searchParams.get('sort') as any || 'created_at',
      order: searchParams.get('order') as 'asc' | 'desc' || 'desc',
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '50'), 100),
    };

    // Build the query
    let query = supabaseAdmin
      .from('prompts')
      .select('*', { count: 'exact' })
      .eq('user_id', session.user.id);

    // Apply filters
    if (params.category) {
      query = query.eq('category', params.category);
    }

    if (params.asset_type) {
      query = query.contains('asset_types', [params.asset_type]);
    }

    // Tag filtering (AND logic)
    if (params.tags) {
      const tagArray = params.tags.split(',').map(tag => tag.trim());
      for (const tag of tagArray) {
        query = query.contains('tags', [tag]);
      }
    }

    // Full-text search
    if (params.search) {
      query = query.or(
        `name.ilike.%${params.search}%,prompt_text.ilike.%${params.search}%`
      );
    }

    // Sorting
    const sortField = params.sort || 'created_at';
    const sortOrder = params.order || 'desc';
    query = query.order(sortField, { ascending: sortOrder === 'asc' });

    // Pagination
    const offset = (params.page! - 1) * params.limit!;
    query = query.range(offset, offset + params.limit! - 1);

    const { data: prompts, error, count } = await query;

    if (error) {
      console.error('Error fetching prompts:', error);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch prompts' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<Prompt[]>>({
      success: true,
      data: prompts || [],
      meta: {
        pagination: {
          page: params.page!,
          limit: params.limit!,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / params.limit!)
        }
      }
    });

  } catch (error) {
    console.error('Error in GET /api/prompts:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// POST /api/prompts - Save prompt to library
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

    // Check if user ID is a valid UUID
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.user.id);
    if (!isValidUUID) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'INVALID_SESSION', message: 'Please sign out and sign back in' }
      }, { status: 400 });
    }

    const body: CreatePromptRequest = await req.json();

    // Validate required fields
    if (!body.name || !body.name.trim()) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Prompt name is required' }
      }, { status: 400 });
    }

    if (!body.prompt_text || !body.prompt_text.trim()) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Prompt text is required' }
      }, { status: 400 });
    }

    // Check for duplicate prompt name
    const { data: existingPrompt } = await supabaseAdmin
      .from('prompts')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('name', body.name.trim())
      .maybeSingle();

    if (existingPrompt) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DUPLICATE_NAME', message: 'A prompt with this name already exists' }
      }, { status: 409 });
    }

    // Create the prompt
    const { data: prompt, error } = await supabaseAdmin
      .from('prompts')
      .insert({
        user_id: session.user.id,
        name: body.name.trim(),
        prompt_text: body.prompt_text.trim(),
        negative_prompt: body.negative_prompt?.trim() || null,
        category: body.category || null,
        asset_types: body.asset_types || null,
        tags: body.tags || null,
        times_used: 0,
        is_public: false,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating prompt:', error);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to create prompt' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<Prompt>>({
      success: true,
      data: prompt
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/prompts:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}