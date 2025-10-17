import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { uploadUrlToS3, generateAssetKey, isS3Url } from '@/lib/s3-upload'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }, { status: 401 })
    }

    const { assetId, migrateAll } = await req.json()

    if (migrateAll) {
      // Migrate all assets for the user
      return await migrateAllUserAssets(session.user.id)
    } else if (assetId) {
      // Migrate a specific asset
      return await migrateSingleAsset(assetId, session.user.id)
    } else {
      return NextResponse.json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Either assetId or migrateAll must be provided' }
      }, { status: 400 })
    }
  } catch (error) {
    console.error('Error in migrate-to-s3 API:', error)
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to migrate assets' }
    }, { status: 500 })
  }
}

async function migrateSingleAsset(assetId: string, userId: string) {
  try {
    // Get the asset
    const { data: asset, error: fetchError } = await supabaseAdmin
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !asset) {
      return NextResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Asset not found' }
      }, { status: 404 })
    }

    const result = await migrateAssetUrls(asset)

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Error migrating single asset:', error)
    return NextResponse.json({
      success: false,
      error: { code: 'MIGRATION_ERROR', message: 'Failed to migrate asset' }
    }, { status: 500 })
  }
}

async function migrateAllUserAssets(userId: string) {
  try {
    // Get all assets that need migration (have external URLs)
    const { data: assets, error: fetchError } = await supabaseAdmin
      .from('assets')
      .select('*')
      .eq('user_id', userId)

    if (fetchError) {
      return NextResponse.json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch assets' }
      }, { status: 500 })
    }

    const results = {
      total: assets.length,
      migrated: 0,
      skipped: 0,
      failed: 0,
      details: [] as any[]
    }

    for (const asset of assets) {
      try {
        // Skip if already using S3 URLs
        const thumbnailIsS3 = !asset.thumbnail_url || isS3Url(asset.thumbnail_url)
        const fileIsS3 = !asset.file_url || isS3Url(asset.file_url)

        if (thumbnailIsS3 && fileIsS3) {
          results.skipped++
          results.details.push({
            assetId: asset.id,
            status: 'skipped',
            reason: 'Already using S3 URLs'
          })
          continue
        }

        const migrationResult = await migrateAssetUrls(asset)

        if (migrationResult.success) {
          results.migrated++
          results.details.push({
            assetId: asset.id,
            status: 'migrated',
            thumbnailUrl: migrationResult.newThumbnailUrl,
            fileUrl: migrationResult.newFileUrl
          })
        } else {
          results.failed++
          results.details.push({
            assetId: asset.id,
            status: 'failed',
            error: migrationResult.error
          })
        }
      } catch (error) {
        results.failed++
        results.details.push({
          assetId: asset.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: results
    })
  } catch (error) {
    console.error('Error migrating all assets:', error)
    return NextResponse.json({
      success: false,
      error: { code: 'MIGRATION_ERROR', message: 'Failed to migrate assets' }
    }, { status: 500 })
  }
}

async function migrateAssetUrls(asset: any) {
  const userId = asset.user_id
  const assetId = asset.id
  let newThumbnailUrl = asset.thumbnail_url
  let newFileUrl = asset.file_url
  let hasChanges = false
  const errors: string[] = []

  // Migrate thumbnail_url if it's not already S3
  if (asset.thumbnail_url && !isS3Url(asset.thumbnail_url)) {
    try {
      const thumbnailKey = generateAssetKey(userId, assetId, 'thumbnail', asset.thumbnail_url)
      const uploadResult = await uploadUrlToS3(asset.thumbnail_url, thumbnailKey)

      if (uploadResult.success) {
        newThumbnailUrl = uploadResult.url
        hasChanges = true
        console.log(`✅ Migrated thumbnail for asset ${assetId}:`, uploadResult.url)
      } else {
        errors.push(`Thumbnail migration failed: ${uploadResult.error}`)
        console.error(`❌ Failed to migrate thumbnail for asset ${assetId}:`, uploadResult.error)
      }
    } catch (error) {
      const errorMsg = `Thumbnail migration error: ${error instanceof Error ? error.message : 'Unknown error'}`
      errors.push(errorMsg)
      console.error(`❌ Error migrating thumbnail for asset ${assetId}:`, error)
    }
  }

  // Migrate file_url if it's not already S3
  if (asset.file_url && !isS3Url(asset.file_url)) {
    try {
      const fileKey = generateAssetKey(userId, assetId, 'file', asset.file_url)
      const uploadResult = await uploadUrlToS3(asset.file_url, fileKey)

      if (uploadResult.success) {
        newFileUrl = uploadResult.url
        hasChanges = true
        console.log(`✅ Migrated file for asset ${assetId}:`, uploadResult.url)
      } else {
        errors.push(`File migration failed: ${uploadResult.error}`)
        console.error(`❌ Failed to migrate file for asset ${assetId}:`, uploadResult.error)
      }
    } catch (error) {
      const errorMsg = `File migration error: ${error instanceof Error ? error.message : 'Unknown error'}`
      errors.push(errorMsg)
      console.error(`❌ Error migrating file for asset ${assetId}:`, error)
    }
  }

  // Update the database with new URLs if there were changes
  if (hasChanges) {
    try {
      const { error: updateError } = await supabaseAdmin
        .from('assets')
        .update({
          thumbnail_url: newThumbnailUrl,
          file_url: newFileUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', assetId)

      if (updateError) {
        errors.push(`Database update failed: ${updateError.message}`)
        console.error(`❌ Failed to update database for asset ${assetId}:`, updateError)
      } else {
        console.log(`✅ Updated database for asset ${assetId}`)
      }
    } catch (error) {
      const errorMsg = `Database update error: ${error instanceof Error ? error.message : 'Unknown error'}`
      errors.push(errorMsg)
      console.error(`❌ Error updating database for asset ${assetId}:`, error)
    }
  }

  return {
    success: errors.length === 0,
    newThumbnailUrl,
    newFileUrl,
    hasChanges,
    error: errors.length > 0 ? errors.join('; ') : undefined
  }
}