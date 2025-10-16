import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  ApiResponse,
  CreateFolderRequest,
  FolderListParams,
  Folder
} from '@/lib/types/asset-repository';

// ============================================================================
// GET /api/folders - List folders in project
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
    const params: FolderListParams = {
      project_id: searchParams.get('project_id')!,
      parent_folder_id: searchParams.get('parent_folder_id') || undefined,
    };

    // Validate required project_id
    if (!params.project_id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'project_id parameter is required' }
      }, { status: 400 });
    }

    // Validate the project exists and belongs to the user
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('id', params.project_id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (projectError) {
      console.error('Error validating project:', projectError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to validate project' }
      }, { status: 500 });
    }

    if (!project) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found or not accessible' }
      }, { status: 404 });
    }

    // Build the query
    let query = supabaseAdmin
      .from('folders')
      .select('*')
      .eq('project_id', params.project_id)
      .order('position', { ascending: true })
      .order('name', { ascending: true });

    // Filter by parent folder
    if (params.parent_folder_id) {
      query = query.eq('parent_folder_id', params.parent_folder_id);
    } else {
      query = query.is('parent_folder_id', null);
    }

    const { data: folders, error } = await query;

    if (error) {
      console.error('Error fetching folders:', error);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch folders' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<Folder[]>>({
      success: true,
      data: folders || []
    });

  } catch (error) {
    console.error('Error in GET /api/folders:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}

// ============================================================================
// POST /api/folders - Create folder in project
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

    const body: CreateFolderRequest = await req.json();

    // Validate required fields
    if (!body.project_id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'project_id is required' }
      }, { status: 400 });
    }

    if (!body.name || !body.name.trim()) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Folder name is required' }
      }, { status: 400 });
    }

    // Validate the project exists and belongs to the user
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('id', body.project_id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (projectError) {
      console.error('Error validating project:', projectError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to validate project' }
      }, { status: 500 });
    }

    if (!project) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found or not accessible' }
      }, { status: 404 });
    }

    // Validate parent folder if provided
    let parentPath = '';
    if (body.parent_folder_id) {
      const { data: parentFolder, error: parentError } = await supabaseAdmin
        .from('folders')
        .select('id, path, project_id')
        .eq('id', body.parent_folder_id)
        .eq('project_id', body.project_id)
        .maybeSingle();

      if (parentError) {
        console.error('Error validating parent folder:', parentError);
        return NextResponse.json<ApiResponse>({
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Failed to validate parent folder' }
        }, { status: 500 });
      }

      if (!parentFolder) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Parent folder not found' }
        }, { status: 404 });
      }

      parentPath = parentFolder.path;
    }

    // Generate the folder path
    const folderName = body.name.trim();
    const folderPath = parentPath ? `${parentPath}/${folderName}` : `/${folderName}`;

    // Check for duplicate folder path in the project
    const { data: existingFolder } = await supabaseAdmin
      .from('folders')
      .select('id')
      .eq('project_id', body.project_id)
      .eq('path', folderPath)
      .maybeSingle();

    if (existingFolder) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DUPLICATE_PATH', message: 'A folder with this name already exists in this location' }
      }, { status: 409 });
    }

    // Get the next position for ordering
    const { data: lastFolder } = await supabaseAdmin
      .from('folders')
      .select('position')
      .eq('project_id', body.project_id)
      .eq('parent_folder_id', body.parent_folder_id || null)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextPosition = (lastFolder?.position || 0) + 1;

    // Create the folder
    const { data: folder, error } = await supabaseAdmin
      .from('folders')
      .insert({
        project_id: body.project_id,
        parent_folder_id: body.parent_folder_id || null,
        name: folderName,
        path: folderPath,
        color: body.color || null,
        position: nextPosition,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating folder:', error);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to create folder' }
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<Folder>>({
      success: true,
      data: folder
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/folders:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }, { status: 500 });
  }
}