import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Orchestration Engine - Workflow Status Endpoint
 *
 * Created: October 20, 2025
 * Purpose: Check status and progress of submitted workflows
 */

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    const workflowId = params.id;

    // 2. Fetch workflow from database
    const { data: workflow, error: workflowError } = await supabaseAdmin
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .eq('user_id', session.user.id) // User can only see their own workflows
      .single();

    if (workflowError || !workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // 3. Fetch related tasks
    const { data: tasks, error: tasksError } = await supabaseAdmin
      .from('workflow_tasks')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('execution_order', { ascending: true });

    if (tasksError) {
      console.error('Error fetching workflow tasks:', tasksError);
    }

    // 4. Calculate progress
    const totalTasks = tasks?.length || 0;
    const completedTasks = tasks?.filter(t => t.status === 'completed').length || 0;
    const failedTasks = tasks?.filter(t => t.status === 'failed').length || 0;
    const inProgressTasks = tasks?.filter(t => t.status === 'in_progress').length || 0;

    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // 5. Return status
    return NextResponse.json({
      success: true,
      workflow: {
        id: workflow.id,
        title: workflow.title,
        description: workflow.description,
        status: workflow.status,
        assigned_to: workflow.assigned_to,
        priority: workflow.priority,
        created_at: workflow.created_at,
        updated_at: workflow.updated_at,
        completed_at: workflow.completed_at,
        error_message: workflow.error_message,
      },
      progress: {
        percentage: progress,
        total_tasks: totalTasks,
        completed: completedTasks,
        in_progress: inProgressTasks,
        failed: failedTasks,
        pending: totalTasks - completedTasks - failedTasks - inProgressTasks,
      },
      tasks: tasks?.map(task => ({
        id: task.id,
        title: task.title,
        type: task.task_type,
        status: task.status,
        assigned_to: task.assigned_to,
        execution_order: task.execution_order,
        created_at: task.created_at,
        started_at: task.started_at,
        completed_at: task.completed_at,
        error_message: task.error_message,
      })) || [],
      result_data: workflow.result_data,
    });

  } catch (error: any) {
    console.error('Error in orchestrate/status:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    );
  }
}
