import { NextRequest, NextResponse } from 'next/server'

interface GenerateLipsyncRequest {
  imageUrl: string
  audioUrl: string
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, audioUrl } = await req.json() as GenerateLipsyncRequest

    if (!imageUrl || !imageUrl.trim()) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      )
    }

    if (!audioUrl || !audioUrl.trim()) {
      return NextResponse.json(
        { error: 'Audio URL is required' },
        { status: 400 }
      )
    }

    if (!process.env.AKOOL_API_KEY) {
      return NextResponse.json(
        { error: 'AKOOL API key not configured' },
        { status: 500 }
      )
    }

    const requestBody = {
      talking_photo_url: imageUrl.trim(),
      audio_url: audioUrl.trim(),
    }

    console.log('Talking photo request body:', JSON.stringify(requestBody, null, 2))

    const createResponse = await fetch('https://openapi.akool.com/api/open/v3/content/video/createbytalkingphoto', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.AKOOL_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      console.error('AKOOL API error:', errorText)
      throw new Error(`AKOOL API error: ${createResponse.status} - ${errorText}`)
    }

    const createData = await createResponse.json()

    if (createData.code !== 1000) {
      console.error('AKOOL API returned error:', createData)
      throw new Error(createData.msg || 'AKOOL API error')
    }

    const videoModelId = createData.data._id

    console.log('Task created:', videoModelId)

    let attempts = 0
    const maxAttempts = 60

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000))

      const statusResponse = await fetch(`https://openapi.akool.com/api/open/v3/content/video/infobymodelid?video_model_id=${videoModelId}`, {
        headers: {
          'x-api-key': process.env.AKOOL_API_KEY!,
        },
      })

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text()
        console.error('Status check error:', errorText)
        throw new Error(`Failed to check status: ${statusResponse.status}`)
      }

      const statusData = await statusResponse.json()
      console.log(`Status check ${attempts + 1}:`, statusData.data.video_status)
      console.log('Full status response:', JSON.stringify(statusData, null, 2))

      if (statusData.data.video_status === 4) {
        throw new Error('Talking photo generation failed')
      }

      if (statusData.data.video_status === 3) {
        const videoUrl = statusData.data.video

        if (!videoUrl) {
          throw new Error('No video URL in response')
        }

        console.log('Talking photo video generated:', videoUrl)
        console.log('Full completion response:', JSON.stringify(statusData, null, 2))

        return NextResponse.json({
          id: videoModelId,
          output: videoUrl,
          status: 'completed',
          metadata: {
            create_time: statusData.data.create_time,
            video_lock_duration: statusData.data.video_lock_duration,
          },
        })
      }

      attempts++
    }

    throw new Error('Talking photo generation timed out after 3 minutes')

  } catch (error) {
    console.error('Talking photo generation error:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate talking photo',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
