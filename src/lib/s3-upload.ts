import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const BUCKET_NAME = process.env.AWS_S3_BUCKET!

export interface UploadResult {
  success: boolean
  url?: string
  key?: string
  error?: string
}

/**
 * Upload a file from a URL to S3
 */
export async function uploadUrlToS3(
  sourceUrl: string,
  destinationKey: string,
  contentType?: string
): Promise<UploadResult> {
  try {
    // Fetch the file from the source URL
    const response = await fetch(sourceUrl)
    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch source URL: ${response.status} ${response.statusText}`
      }
    }

    const buffer = await response.arrayBuffer()
    const detectedContentType = contentType || response.headers.get('content-type') || 'application/octet-stream'

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: destinationKey,
      Body: new Uint8Array(buffer),
      ContentType: detectedContentType,
      // Make the object publicly readable
      ACL: 'public-read',
    })

    await s3Client.send(command)

    const s3Url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${destinationKey}`

    return {
      success: true,
      url: s3Url,
      key: destinationKey
    }
  } catch (error) {
    console.error('Error uploading to S3:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Generate a unique S3 key for an asset
 */
export function generateAssetKey(
  userId: string,
  assetId: string,
  type: 'thumbnail' | 'file',
  originalUrl?: string
): string {
  const timestamp = new Date().getTime()

  // Try to get file extension from the original URL
  let extension = ''
  if (originalUrl) {
    const urlParts = originalUrl.split('.')
    const lastPart = urlParts[urlParts.length - 1]
    // Common image/video extensions
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'mov', 'avi'].includes(lastPart.toLowerCase())) {
      extension = `.${lastPart.toLowerCase()}`
    }
  }

  // Default extensions based on type
  if (!extension) {
    extension = type === 'thumbnail' ? '.png' : '.png'
  }

  return `assets/${userId}/${assetId}/${type}_${timestamp}${extension}`
}

/**
 * Check if a URL is already an S3 URL
 */
export function isS3Url(url: string): boolean {
  return url.includes(BUCKET_NAME) || url.includes('s3.amazonaws.com')
}

/**
 * Get a presigned URL for private S3 objects (if needed later)
 */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  return await getSignedUrl(s3Client, command, { expiresIn })
}

/**
 * Generate a presigned URL for direct client upload to S3
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ACL: 'public-read', // Make uploaded files publicly accessible
  })

  return await getSignedUrl(s3Client, command, { expiresIn })
}

/**
 * Generate asset key for direct uploads
 */
export function generateUploadKey(
  userId: string,
  assetType: 'image' | 'video' | 'audio' | 'text',
  fileExtension: string
): { assetId: string; fileKey: string; thumbnailKey: string } {
  const assetId = crypto.randomUUID()
  const timestamp = new Date().getTime()

  const fileKey = `uploads/${userId}/${assetType}s/${assetId}/original_${timestamp}.${fileExtension}`
  const thumbnailKey = `uploads/${userId}/${assetType}s/${assetId}/thumbnail_${timestamp}.jpg`

  return { assetId, fileKey, thumbnailKey }
}

/**
 * Get public URL for an S3 object
 */
export function getS3PublicUrl(key: string): string {
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
}