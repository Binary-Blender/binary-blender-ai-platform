import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  ApiResponse,
  SearchResult,
  SearchFilters
} from '@/lib/types/asset-repository';

// ============================================================================
// GET /api/search - Universal search across all entities
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

    const { searchParams } = new URL(req.url);
    const filters: SearchFilters = {
      query: searchParams.get('q') || searchParams.get('query') || '',
      asset_types: searchParams.get('asset_types')?.split(',').filter(Boolean) as any,
      source_apps: searchParams.get('source_apps')?.split(',').filter(Boolean) as any,
      tags: searchParams.get('tags')?.split(',').filter(Boolean),
      categories: searchParams.get('categories')?.split(',').filter(Boolean) as any,
      min_rating: searchParams.get('min_rating') ? parseInt(searchParams.get('min_rating')!) : undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      project_id: searchParams.get('project_id') || undefined,
      folder_id: searchParams.get('folder_id') || undefined,
      include_assets: searchParams.get('include_assets') !== 'false',
      include_prompts: searchParams.get('include_prompts') !== 'false',
      include_experiments: searchParams.get('include_experiments') !== 'false',
      limit: Math.min(parseInt(searchParams.get('limit') || '50'), 100),
    };

    if (!filters.query) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Search query is required' }
      }, { status: 400 });
    }

    const results: SearchResult = {
      query: filters.query,
      assets: [],
      prompts: [],
      experiments: [],
      total_results: 0,
    };

    const searchPromises: Promise<any>[] = [];

    // Search assets
    if (filters.include_assets) {
      const assetSearch = searchAssets(session.user.id, filters);
      searchPromises.push(assetSearch);
    }

    // Search prompts
    if (filters.include_prompts) {
      const promptSearch = searchPrompts(session.user.id, filters);
      searchPromises.push(promptSearch);
    }

    // Search experiments
    if (filters.include_experiments) {
      const experimentSearch = searchExperiments(session.user.id, filters);
      searchPromises.push(experimentSearch);
    }

    const searchResults = await Promise.allSettled(searchPromises);

    let resultIndex = 0;

    // Process asset results
    if (filters.include_assets) {
      const assetResult = searchResults[resultIndex++];
      if (assetResult.status === 'fulfilled') {
        results.assets = assetResult.value?.data || [];
      }
    }

    // Process prompt results
    if (filters.include_prompts) {
      const promptResult = searchResults[resultIndex++];
      if (promptResult.status === 'fulfilled') {
        results.prompts = promptResult.value?.data || [];
      }
    }

    // Process experiment results
    if (filters.include_experiments) {
      const experimentResult = searchResults[resultIndex];
      if (experimentResult.status === 'fulfilled') {
        results.experiments = experimentResult.value?.data || [];
      }
    }

    results.total_results =
      results.assets.length +
      results.prompts.length +
      results.experiments.length;

    return NextResponse.json<ApiResponse<SearchResult>>({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Error in GET /api/search:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function searchAssets(userId: string, filters: SearchFilters) {
  let query = supabaseAdmin
    .from('assets')
    .select('id, asset_type, name, thumbnail_url, created_at, tags, user_rating, notes')
    .eq('user_id', userId)
    .eq('status', 'active');

  // Full-text search on name and notes
  if (filters.query) {
    query = query.textSearch('name,notes', filters.query, {
      type: 'websearch',
      config: 'english'
    });
  }

  // Apply filters
  if (filters.asset_types?.length) {
    query = query.in('asset_type', filters.asset_types);
  }

  if (filters.source_apps?.length) {
    query = query.in('source_app', filters.source_apps);
  }

  if (filters.tags?.length) {
    for (const tag of filters.tags) {
      query = query.contains('tags', [tag]);
    }
  }

  if (filters.min_rating) {
    query = query.gte('user_rating', filters.min_rating);
  }

  if (filters.date_from) {
    query = query.gte('created_at', filters.date_from);
  }

  if (filters.date_to) {
    query = query.lte('created_at', filters.date_to);
  }

  if (filters.project_id) {
    query = query.eq('project_id', filters.project_id);
  }

  if (filters.folder_id) {
    query = query.eq('folder_id', filters.folder_id);
  }

  query = query
    .order('created_at', { ascending: false })
    .limit(Math.min(filters.limit || 20, 20));

  return await query;
}

async function searchPrompts(userId: string, filters: SearchFilters) {
  let query = supabaseAdmin
    .from('prompts')
    .select('id, name, prompt_text, category, created_at, tags, times_used')
    .eq('user_id', userId);

  // Search in name and prompt_text
  if (filters.query) {
    query = query.or(
      `name.ilike.%${filters.query}%,prompt_text.ilike.%${filters.query}%`
    );
  }

  // Apply category filter
  if (filters.categories?.length) {
    query = query.in('category', filters.categories);
  }

  if (filters.tags?.length) {
    for (const tag of filters.tags) {
      query = query.contains('tags', [tag]);
    }
  }

  if (filters.date_from) {
    query = query.gte('created_at', filters.date_from);
  }

  if (filters.date_to) {
    query = query.lte('created_at', filters.date_to);
  }

  query = query
    .order('created_at', { ascending: false })
    .limit(Math.min(filters.limit || 20, 20));

  return await query;
}

async function searchExperiments(userId: string, filters: SearchFilters) {
  let query = supabaseAdmin
    .from('experiments')
    .select('id, title, hypothesis, outcome, created_at, tags')
    .eq('user_id', userId);

  // Search in title, hypothesis, methodology, results
  if (filters.query) {
    query = query.or(
      `title.ilike.%${filters.query}%,hypothesis.ilike.%${filters.query}%,methodology.ilike.%${filters.query}%,results.ilike.%${filters.query}%`
    );
  }

  if (filters.tags?.length) {
    for (const tag of filters.tags) {
      query = query.contains('tags', [tag]);
    }
  }

  if (filters.date_from) {
    query = query.gte('created_at', filters.date_from);
  }

  if (filters.date_to) {
    query = query.lte('created_at', filters.date_to);
  }

  query = query
    .order('created_at', { ascending: false })
    .limit(Math.min(filters.limit || 20, 20));

  return await query;
}