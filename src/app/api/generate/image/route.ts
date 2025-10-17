import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

// Helper function to extract tags from prompt
function extractTagsFromPrompt(prompt: string): string[] {
  const commonWords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can'])

  return prompt
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 2 && !commonWords.has(word))
    .slice(0, 8) // Limit to 8 tags
}

interface GenerateImageRequest {
  prompt: string
  aspectRatio: string
  model: string
  projectId?: string
  saveToRepository?: boolean
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { prompt, aspectRatio, model, projectId, saveToRepository = true } = await req.json() as GenerateImageRequest

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json(
        { error: 'Replicate API token not configured' },
        { status: 500 }
      )
    }

    const aspectRatioMap: Record<string, string> = {
      '1:1': '1:1',
      '16:9': '16:9',
      '9:16': '9:16',
      '4:3': '4:3',
      '3:4': '3:4',
    }

    const modelMap: Record<string, string> = {
      'flux-pro': 'black-forest-labs/flux-pro',
      'flux-dev': 'black-forest-labs/flux-dev',
      'sdxl': 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
    }

    const selectedModel = modelMap[model] || modelMap['flux-pro']
    const selectedAspectRatio = aspectRatioMap[aspectRatio] || '1:1'

    let input: any = {
      prompt: prompt.trim(),
    }

    if (model === 'flux-pro' || model === 'flux-dev') {
      input.aspect_ratio = selectedAspectRatio
      input.output_format = 'png'
      input.output_quality = 90
    } else if (model === 'sdxl') {
      input.width = 1024
      input.height = 1024

      if (selectedAspectRatio === '16:9') {
        input.width = 1344
        input.height = 768
      } else if (selectedAspectRatio === '9:16') {
        input.width = 768
        input.height = 1344
      } else if (selectedAspectRatio === '4:3') {
        input.width = 1152
        input.height = 896
      } else if (selectedAspectRatio === '3:4') {
        input.width = 896
        input.height = 1152
      }
    }

    console.log('Generating image with:', { model: selectedModel, input })

    const prediction = await replicate.predictions.create({
      version: selectedModel.includes(':') ? selectedModel.split(':')[1] : selectedModel,
      input,
    })

    console.log('Full prediction object:', JSON.stringify(prediction, null, 2))

    let finalPrediction = prediction
    while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed') {
      await new Promise(resolve => setTimeout(resolve, 1000))
      finalPrediction = await replicate.predictions.get(finalPrediction.id)
    }

    if (finalPrediction.status === 'failed') {
      throw new Error('Image generation failed: ' + finalPrediction.error)
    }

    console.log('Final prediction with metrics:', JSON.stringify(finalPrediction, null, 2))

    const output = finalPrediction.output

    console.log('Replicate output type:', typeof output)
    console.log('Replicate output keys:', output ? Object.keys(output) : 'null')

    let imageUrls: string[] = []

    // Flux Pro returns a FileOutput object with a url() method
    if (output && typeof output.url === 'function') {
      const urlObj = await output.url()
      const urlString = urlObj.toString()
      console.log('Got URL from output.url():', urlString)
      imageUrls = [urlString]
    }
    // Handle string output
    else if (typeof output === 'string') {
      imageUrls = [output]
    }
    // Handle array output
    else if (Array.isArray(output)) {
      for (const item of output) {
        if (typeof item === 'string') {
          imageUrls.push(item)
        } else if (item && typeof item.url === 'function') {
          imageUrls.push(await item.url())
        } else if (item && typeof item === 'object' && 'url' in item) {
          imageUrls.push(String(item.url))
        }
      }
    }

    console.log('Processed image URLs:', imageUrls)

    // Save to Asset Repository if enabled and user is authenticated
    let assetId = null

    // Check if user ID is a valid UUID
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session?.user?.id || '')

    console.log('Asset Repository save check:', {
      saveToRepository,
      userId: session?.user?.id,
      isValidUUID,
      imageCount: imageUrls.length
    })

    if (saveToRepository && session?.user?.id && isValidUUID && imageUrls.length > 0) {
      try {
        const generationTimeSeconds = finalPrediction.metrics?.predict_time ||
          (finalPrediction.completed_at && finalPrediction.started_at
            ? (new Date(finalPrediction.completed_at).getTime() - new Date(finalPrediction.started_at).getTime()) / 1000
            : null)

        // Calculate dimensions based on aspect ratio and model
        let dimensions = { width: 1024, height: 1024 }
        if (model === 'flux-pro' || model === 'flux-dev') {
          if (selectedAspectRatio === '16:9') {
            dimensions = { width: 1344, height: 768 }
          } else if (selectedAspectRatio === '9:16') {
            dimensions = { width: 768, height: 1344 }
          } else if (selectedAspectRatio === '4:3') {
            dimensions = { width: 1152, height: 896 }
          } else if (selectedAspectRatio === '3:4') {
            dimensions = { width: 896, height: 1152 }
          }
        }

        // Estimate credits used (this should be based on your actual pricing)
        const creditsUsed = model === 'flux-pro' ? 4 : model === 'flux-dev' ? 2 : 1

        const assetData = {
          user_id: session.user.id,
          project_id: projectId || null,
          asset_type: 'image',
          source_app: 'image_studio',
          source_tool: model === 'flux-pro' ? 'flux-pro' : model === 'flux-dev' ? 'flux-dev' : 'sdxl',
          file_url: imageUrls[0],
          thumbnail_url: imageUrls[0], // Same as file_url for images
          generation_params: {
            prompt: prompt.trim(),
            model: selectedModel,
            aspect_ratio: selectedAspectRatio,
            output_format: 'png',
            output_quality: 90,
            prediction_id: finalPrediction.id,
            ...input
          },
          file_size_bytes: null, // We don't have this info from Replicate
          dimensions,
          mime_type: 'image/png',
          credits_used: creditsUsed,
          generation_time_seconds: Math.round(generationTimeSeconds || 0),
          name: `Generated image: ${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}`,
          tags: extractTagsFromPrompt(prompt),
          status: 'active'
        }

        const { data: asset, error: assetError } = await supabaseAdmin
          .from('assets')
          .insert(assetData)
          .select('id')
          .single()

        if (assetError) {
          console.error('Error saving asset to repository:', assetError)
        } else {
          assetId = asset.id
          console.log('Successfully saved asset to repository:', assetId)

          // Now upload the image to S3 and update the asset with permanent URLs
          try {
            const { uploadUrlToS3, generateAssetKey } = await import('@/lib/s3-upload')

            // Generate S3 key for the image
            const imageKey = generateAssetKey(session.user.id, assetId, 'file', imageUrls[0])

            // Upload the image to S3
            const uploadResult = await uploadUrlToS3(imageUrls[0], imageKey, 'image/png')

            if (uploadResult.success && uploadResult.url) {
              // Update the asset with the S3 URLs
              const { error: updateError } = await supabaseAdmin
                .from('assets')
                .update({
                  file_url: uploadResult.url,
                  thumbnail_url: uploadResult.url // For images, thumbnail is the same as the main file
                })
                .eq('id', assetId)

              if (updateError) {
                console.error('Error updating asset with S3 URLs:', updateError)
              } else {
                console.log('Successfully updated asset with S3 URLs:', uploadResult.url)
              }
            } else {
              console.error('Failed to upload image to S3:', uploadResult.error)
            }
          } catch (s3Error) {
            console.error('Error uploading to S3:', s3Error)
            // Don't fail the generation if S3 upload fails
          }
        }
      } catch (assetSaveError) {
        console.error('Error saving to Asset Repository:', assetSaveError)
        // Don't fail the image generation if asset saving fails
      }
    }

    return NextResponse.json({
      id: finalPrediction.id,
      output: imageUrls,
      status: 'completed',
      assetId, // Include the asset ID if saved to repository
      metadata: {
        model: finalPrediction.model,
        createdAt: finalPrediction.created_at,
        startedAt: finalPrediction.started_at,
        completedAt: finalPrediction.completed_at,
        metrics: finalPrediction.metrics,
      },
    })
  } catch (error) {
    console.error('Image generation error:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate image',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
