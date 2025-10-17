import sharp from 'sharp';
import { uploadUrlToS3 } from './s3-upload';

export interface ThumbnailGenerationResult {
  success: boolean;
  thumbnailUrl?: string;
  error?: string;
}

/**
 * Generate a thumbnail from an image URL and upload it to S3
 */
export async function generateImageThumbnail(
  sourceImageUrl: string,
  destinationKey: string,
  size: number = 512
): Promise<ThumbnailGenerationResult> {
  try {
    // Fetch the original image
    const response = await fetch(sourceImageUrl);
    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch image: ${response.status} ${response.statusText}`
      };
    }

    const imageBuffer = await response.arrayBuffer();

    // Generate thumbnail using Sharp
    const thumbnailBuffer = await sharp(Buffer.from(imageBuffer))
      .resize(size, size, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({
        quality: 85,
        progressive: true
      })
      .toBuffer();

    // Create a blob URL for the thumbnail
    const thumbnailBlob = new Blob([thumbnailBuffer], { type: 'image/jpeg' });
    const thumbnailUrl = URL.createObjectURL(thumbnailBlob);

    // Upload the thumbnail to S3
    const uploadResult = await uploadBlobToS3(thumbnailBlob, destinationKey, 'image/jpeg');

    // Clean up the blob URL
    URL.revokeObjectURL(thumbnailUrl);

    if (!uploadResult.success) {
      return {
        success: false,
        error: uploadResult.error
      };
    }

    return {
      success: true,
      thumbnailUrl: uploadResult.url
    };

  } catch (error) {
    console.error('Error generating image thumbnail:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Generate a thumbnail from the first frame of a video
 * Note: This is a simplified version. For full video processing, you'd use FFmpeg
 */
export async function generateVideoThumbnail(
  sourceVideoUrl: string,
  destinationKey: string,
  size: number = 512
): Promise<ThumbnailGenerationResult> {
  try {
    // For now, we'll create a placeholder thumbnail for videos
    // In a full implementation, you'd extract the first frame using FFmpeg
    const placeholderThumbnail = await generatePlaceholderThumbnail('video', size);

    // Upload the placeholder to S3
    const uploadResult = await uploadBlobToS3(placeholderThumbnail, destinationKey, 'image/jpeg');

    if (!uploadResult.success) {
      return {
        success: false,
        error: uploadResult.error
      };
    }

    return {
      success: true,
      thumbnailUrl: uploadResult.url
    };

  } catch (error) {
    console.error('Error generating video thumbnail:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Generate a waveform thumbnail for audio files
 */
export async function generateAudioThumbnail(
  sourceAudioUrl: string,
  destinationKey: string,
  size: number = 512
): Promise<ThumbnailGenerationResult> {
  try {
    // Generate a placeholder waveform thumbnail
    const waveformThumbnail = await generatePlaceholderThumbnail('audio', size);

    // Upload the thumbnail to S3
    const uploadResult = await uploadBlobToS3(waveformThumbnail, destinationKey, 'image/jpeg');

    if (!uploadResult.success) {
      return {
        success: false,
        error: uploadResult.error
      };
    }

    return {
      success: true,
      thumbnailUrl: uploadResult.url
    };

  } catch (error) {
    console.error('Error generating audio thumbnail:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Generate a text preview thumbnail
 */
export async function generateTextThumbnail(
  textContent: string,
  destinationKey: string,
  size: number = 512
): Promise<ThumbnailGenerationResult> {
  try {
    // Create a text preview image
    const textThumbnail = await generateTextPreviewImage(textContent, size);

    // Upload the thumbnail to S3
    const uploadResult = await uploadBlobToS3(textThumbnail, destinationKey, 'image/jpeg');

    if (!uploadResult.success) {
      return {
        success: false,
        error: uploadResult.error
      };
    }

    return {
      success: true,
      thumbnailUrl: uploadResult.url
    };

  } catch (error) {
    console.error('Error generating text thumbnail:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Generate a placeholder thumbnail for different asset types
 */
async function generatePlaceholderThumbnail(
  assetType: 'video' | 'audio',
  size: number
): Promise<Blob> {
  const colors = {
    video: '#3b82f6', // Blue
    audio: '#10b981', // Green
  };

  const icons = {
    video: '🎬',
    audio: '🎵',
  };

  // Create an SVG placeholder
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${colors[assetType]}" rx="12"/>
      <text x="50%" y="45%" font-family="system-ui" font-size="${size * 0.15}"
            text-anchor="middle" fill="white" dominant-baseline="central">
        ${icons[assetType]}
      </text>
      <text x="50%" y="65%" font-family="system-ui" font-size="${size * 0.08}"
            text-anchor="middle" fill="white" dominant-baseline="central" opacity="0.8">
        ${assetType.toUpperCase()}
      </text>
    </svg>
  `;

  // Convert SVG to image using Sharp
  const imageBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  return new Blob([imageBuffer], { type: 'image/png' });
}

/**
 * Generate a text preview image
 */
async function generateTextPreviewImage(
  text: string,
  size: number
): Promise<Blob> {
  // Truncate text for preview
  const previewText = text.length > 200 ? text.substring(0, 200) + '...' : text;

  // Create an SVG with text content
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f8fafc" rx="12"/>
      <foreignObject x="20" y="20" width="${size - 40}" height="${size - 40}">
        <div xmlns="http://www.w3.org/1999/xhtml" style="
          font-family: system-ui, -apple-system, sans-serif;
          font-size: ${size * 0.03}px;
          line-height: 1.4;
          color: #1f2937;
          padding: 10px;
          word-wrap: break-word;
          overflow: hidden;
        ">
          ${previewText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
        </div>
      </foreignObject>
      <text x="20" y="${size - 30}" font-family="system-ui" font-size="${size * 0.05}"
            fill="#6b7280" opacity="0.7">
        TEXT
      </text>
    </svg>
  `;

  // Convert SVG to image using Sharp
  const imageBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  return new Blob([imageBuffer], { type: 'image/png' });
}

/**
 * Upload a Blob to S3 (helper function)
 */
async function uploadBlobToS3(
  blob: Blob,
  destinationKey: string,
  contentType: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Convert blob to buffer
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Use our existing S3 upload function by creating a temporary data URL
    const base64Data = buffer.toString('base64');
    const dataUrl = `data:${contentType};base64,${base64Data}`;

    // For now, we'll use the existing uploadUrlToS3 function
    // In a more robust implementation, you'd upload the buffer directly
    return await uploadUrlToS3(dataUrl, destinationKey, contentType);

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Main thumbnail generation function that routes to the appropriate generator
 */
export async function generateThumbnail(
  assetType: 'image' | 'video' | 'audio' | 'text',
  sourceUrl: string,
  destinationKey: string,
  textContent?: string,
  size: number = 512
): Promise<ThumbnailGenerationResult> {
  switch (assetType) {
    case 'image':
      return generateImageThumbnail(sourceUrl, destinationKey, size);
    case 'video':
      return generateVideoThumbnail(sourceUrl, destinationKey, size);
    case 'audio':
      return generateAudioThumbnail(sourceUrl, destinationKey, size);
    case 'text':
      return generateTextThumbnail(textContent || '', destinationKey, size);
    default:
      return {
        success: false,
        error: `Unsupported asset type: ${assetType}`
      };
  }
}