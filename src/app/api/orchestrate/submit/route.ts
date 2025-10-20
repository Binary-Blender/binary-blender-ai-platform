import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Orchestration Engine - Workflow Submission Endpoint
 *
 * Created: October 20, 2025
 * Purpose: Accept workflow requests from customers and trigger AI coordination via TAO Bridge
 *
 * Workflow:
 * 1. Customer submits workflow request
 * 2. Endpoint creates workflow record in database
 * 3. Sends notification to Aria via TAO Bridge
 * 4. Aria analyzes and breaks down into tasks
 * 5. Aria coordinates with Kai for execution
 * 6. Results returned to customer
 */

const TAO_BRIDGE_API = process.env.TAO_BRIDGE_API || 'https://tao-bridge-server.fly.dev';

interface WorkflowRequest {
  title: string;
  description?: string;
  request_data: {
    type?: 'video_generation' | 'image_generation' | 'lipsync' | 'complex_workflow' | 'custom';
    inputs?: Record<string, any>;
    deliverables?: string[];
    constraints?: Record<string, any>;
  };
  priority?: number;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    // 2. Parse and validate request
    const body: WorkflowRequest = await req.json();

    if (!body.title) {
      return NextResponse.json(
        { error: 'Missing required field: title' },
        { status: 400 }
      );
    }

    if (!body.request_data) {
      return NextResponse.json(
        { error: 'Missing required field: request_data' },
        { status: 400 }
      );
    }

    const priority = body.priority && body.priority >= 1 && body.priority <= 5 ? body.priority : 3;

    // 3. Create workflow record in database

    const { data: workflow, error: dbError } = await supabaseAdmin
      .from('workflows')
      .insert({
        user_id: session.user.id,
        title: body.title,
        description: body.description || null,
        request_data: body.request_data,
        status: 'pending',
        assigned_to: 'aria', // Always starts with Aria for analysis
        priority: priority,
      })
      .select()
      .single();

    if (dbError || !workflow) {
      console.error('Database error creating workflow:', dbError);
      return NextResponse.json(
        { error: 'Failed to create workflow', details: dbError?.message },
        { status: 500 }
      );
    }

    // 4. Notify Aria via TAO Bridge
    try {
      const taoMessage = {
        from: 'system',
        to: 'aria',
        type: 'workflow_notification',
        content: `🎯 NEW WORKFLOW SUBMITTED\n\nWorkflow ID: ${workflow.id}\nUser: ${session.user.email}\nTitle: ${body.title}\nDescription: ${body.description || 'No description'}\nPriority: ${priority}\n\nPlease analyze this workflow and coordinate with Kai for execution.\n\nAccess full details:\nGET /api/orchestrate/${workflow.id}`,
        metadata: {
          workflow_id: workflow.id,
          user_id: session.user.id,
          priority: priority,
          timestamp: new Date().toISOString(),
        }
      };

      const taoResponse = await fetch(`${TAO_BRIDGE_API}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taoMessage),
      });

      if (!taoResponse.ok) {
        console.error('TAO Bridge notification failed:', await taoResponse.text());
        // Don't fail the request - workflow is created, just log the notification failure
      } else {
        console.log(`✅ TAO Bridge notification sent for workflow ${workflow.id}`);
      }
    } catch (taoError) {
      console.error('Error sending TAO Bridge notification:', taoError);
      // Continue - workflow is created even if notification fails
    }

    // 5. Update workflow status to 'analyzing'
    await supabaseAdmin
      .from('workflows')
      .update({ status: 'analyzing' })
      .eq('id', workflow.id);

    // 6. Return success response
    return NextResponse.json({
      success: true,
      workflow: {
        id: workflow.id,
        title: workflow.title,
        status: 'analyzing',
        created_at: workflow.created_at,
      },
      message: 'Workflow submitted successfully. Aria is analyzing your request.',
      next_steps: [
        `Check status: GET /api/orchestrate/status/${workflow.id}`,
        'You will receive updates as the workflow progresses',
        'Expected completion time: varies by complexity'
      ]
    });

  } catch (error: any) {
    console.error('Error in orchestrate/submit:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve workflow submission form/documentation
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/orchestrate/submit',
    method: 'POST',
    description: 'Submit a workflow request for AI-coordinated execution',
    authentication: 'Required - NextAuth session',
    request_body: {
      title: {
        type: 'string',
        required: true,
        description: 'Human-readable workflow title',
        example: 'Create promotional video from product images'
      },
      description: {
        type: 'string',
        required: false,
        description: 'Detailed description of desired output',
        example: 'Take 5 product images and create a 30-second promotional video with transitions and background music'
      },
      request_data: {
        type: 'object',
        required: true,
        description: 'Workflow parameters and requirements',
        properties: {
          type: {
            type: 'string',
            enum: ['video_generation', 'image_generation', 'lipsync', 'complex_workflow', 'custom'],
            description: 'Type of workflow'
          },
          inputs: {
            type: 'object',
            description: 'Input files, URLs, prompts, etc.'
          },
          deliverables: {
            type: 'array',
            description: 'List of expected outputs'
          },
          constraints: {
            type: 'object',
            description: 'Budget, timeline, quality requirements'
          }
        }
      },
      priority: {
        type: 'number',
        required: false,
        min: 1,
        max: 5,
        default: 3,
        description: '1=lowest, 5=highest'
      }
    },
    response: {
      success: true,
      workflow: {
        id: 'uuid',
        title: 'string',
        status: 'analyzing',
        created_at: 'timestamp'
      },
      message: 'string',
      next_steps: ['array of strings']
    },
    examples: [
      {
        title: 'Generate marketing video',
        description: 'Create a 30-second product showcase video',
        request_data: {
          type: 'video_generation',
          inputs: {
            product_images: ['url1', 'url2', 'url3'],
            product_name: 'Amazing Product',
            tagline: 'The future is here'
          },
          deliverables: ['1080p MP4 video', 'thumbnail image'],
          constraints: {
            duration: '30 seconds',
            style: 'modern and energetic'
          }
        },
        priority: 4
      }
    ]
  });
}
