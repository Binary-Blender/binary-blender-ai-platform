import { NextRequest, NextResponse } from 'next/server'

interface GenerateVideoRequest {
  prompt: string
  imageUrl?: string
  model: string
  duration: number
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, imageUrl, model, duration } = await req.json() as GenerateVideoRequest

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    if (!process.env.RUNWAYML_API_KEY) {
      return NextResponse.json(
        { error: 'RunwayML API key not configured' },
        { status: 500 }
      )
    }

    const modelMap: Record<string, string> = {
      'gen3-alpha-turbo': 'gen3a_turbo',
      'gen3-alpha': 'gen3a',
    }

    // Prepare request body based on whether we have an image
    const hasImage = imageUrl && imageUrl.trim()

    // text-to-video only supports veo3 with duration 8
    // image-to-video supports gen3a_turbo, gen3a, gen4_turbo, veo3
    const selectedModel = hasImage
      ? (modelMap[model] || modelMap['gen3-alpha-turbo'])
      : 'veo3'

    const requestBody: any = {
      promptText: prompt.trim(),
      model: selectedModel,
    }

    if (hasImage) {
      requestBody.promptImage = imageUrl.trim()
      requestBody.duration = duration
    } else {
      requestBody.ratio = '1280:720'
      requestBody.duration = 8
    }

    // Use appropriate endpoint based on whether we have an image
    const endpoint = hasImage
      ? 'https://api.dev.runwayml.com/v1/image_to_video'
      : 'https://api.dev.runwayml.com/v1/text_to_video'

    console.log('Request body being sent to', endpoint, ':', JSON.stringify(requestBody, null, 2))

    // Create generation task
    const createResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RUNWAYML_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify(requestBody),
    })

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      console.error('RunwayML API error:', errorText)
      throw new Error(`RunwayML API error: ${createResponse.status} - ${errorText}`)
    }

    const createData = await createResponse.json()
    const taskId = createData.id

    console.log('Task created:', taskId)

    // Poll for completion (max 3 minutes)
    let attempts = 0
    const maxAttempts = 60 // 60 attempts * 3 seconds = 3 minutes

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000)) // Wait 3 seconds

      const statusResponse = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.RUNWAYML_API_KEY}`,
          'X-Runway-Version': '2024-11-06',
        },
      })

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text()
        console.error('Status check error:', errorText)
        throw new Error(`Failed to check status: ${statusResponse.status}`)
      }

      const statusData = await statusResponse.json()
      console.log(`Status check ${attempts + 1}:`, statusData.status)
      console.log('Full status response:', JSON.stringify(statusData, null, 2))

      if (statusData.status === 'SUCCEEDED') {
        const videoUrl = statusData.output?.[0] || statusData.artifacts?.[0]?.url

        if (!videoUrl) {
          throw new Error('No video URL in response')
        }

        console.log('Video generated:', videoUrl)
        console.log('Full completion response:', JSON.stringify(statusData, null, 2))

        return NextResponse.json({
          id: taskId,
          output: videoUrl,
          status: 'completed',
          metadata: {
            createdAt: statusData.createdAt,
            progressRatio: statusData.progressRatio,
            progressText: statusData.progressText,
          },
        })
      }

      if (statusData.status === 'FAILED') {
        throw new Error(statusData.failure || 'Video generation failed')
      }

      attempts++
    }

    throw new Error('Video generation timed out after 3 minutes')

  } catch (error) {
    console.error('Video generation error:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate video',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
