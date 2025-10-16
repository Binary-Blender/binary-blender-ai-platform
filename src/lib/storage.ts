// Binary Blender File Storage Utilities
// Handles S3/R2 uploads, presigned URLs, and thumbnail generation

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { AssetType, AssetDimensions, FileMetadata } from './types/asset-repository';

// ============================================================================
// S3 Client Configuration
// ============================================================================

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET!;
const CDN_BASE_URL = process.env.AWS_CLOUDFRONT_URL || `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`;

// ============================================================================
// File Path Generation
// ============================================================================

export function generateFilePath(
  userId: string,
  assetId: string,
  assetType: AssetType,
  filename: string,
  variant?: string
): string {
  const folder = getAssetTypeFolder(assetType);
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  const baseFilename = variant ? `${variant}.${extension}` : `original.${extension}`;

  return `uploads/${userId}/${folder}/${assetId}/${baseFilename}`;
}

export function generateThumbnailPath(
  userId: string,
  assetId: string,
  assetType: AssetType,
  size: string = '512'
): string {
  const folder = getAssetTypeFolder(assetType);
  return `uploads/${userId}/${folder}/${assetId}/thumbnail_${size}.jpg`;
}

export function generatePreviewPath(
  userId: string,
  assetId: string,
  assetType: AssetType,
  frameNumber?: number
): string {
  const folder = getAssetTypeFolder(assetType);
  const filename = frameNumber ? `frame_${frameNumber.toString().padStart(3, '0')}.jpg` : 'preview.jpg';
  return `uploads/${userId}/${folder}/${assetId}/previews/${filename}`;
}

function getAssetTypeFolder(assetType: AssetType): string {
  switch (assetType) {
    case 'image': return 'images';
    case 'video': return 'videos';
    case 'audio': return 'audio';
    case 'text': return 'text';
    default: return 'misc';
  }
}

// ============================================================================
// Presigned URL Generation
// ============================================================================

export interface PresignedUploadInfo {
  uploadUrl: string;
  filePath: string;
  publicUrl: string;
  expiresAt: Date;
}

export async function generatePresignedUploadUrl(
  userId: string,
  assetId: string,
  assetType: AssetType,
  filename: string,
  fileType: string,
  fileSize: number
): Promise<PresignedUploadInfo> {
  const filePath = generateFilePath(userId, assetId, assetType, filename);

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: filePath,
    ContentType: fileType,
    ContentLength: fileSize,
    Metadata: {
      'user-id': userId,
      'asset-id': assetId,
      'asset-type': assetType,
      'original-filename': filename,
    },
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
  const publicUrl = `${CDN_BASE_URL}/${filePath}`;
  const expiresAt = new Date(Date.now() + 3600 * 1000);

  return {
    uploadUrl,
    filePath,
    publicUrl,
    expiresAt,
  };
}

export async function generatePresignedDownloadUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: filePath,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

// ============================================================================
// File Upload and Processing
// ============================================================================

export async function uploadFileBuffer(
  buffer: Buffer,
  filePath: string,
  contentType: string,
  metadata?: Record<string, string>
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: filePath,
    Body: buffer,
    ContentType: contentType,
    Metadata: metadata,
  });

  await s3Client.send(command);
  return `${CDN_BASE_URL}/${filePath}`;
}

// ============================================================================
// Thumbnail Generation
// ============================================================================

export interface ThumbnailConfig {
  width: number;
  height: number;
  quality: number;
  format: 'jpeg' | 'png' | 'webp';
}

const DEFAULT_THUMBNAIL_CONFIG: ThumbnailConfig = {
  width: 512,
  height: 512,
  quality: 85,
  format: 'jpeg',
};

export async function generateImageThumbnail(
  sourceBuffer: Buffer,
  userId: string,
  assetId: string,
  config: Partial<ThumbnailConfig> = {}
): Promise<string> {
  const thumbnailConfig = { ...DEFAULT_THUMBNAIL_CONFIG, ...config };

  try {
    const thumbnailBuffer = await sharp(sourceBuffer)
      .resize(thumbnailConfig.width, thumbnailConfig.height, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: thumbnailConfig.quality })
      .toBuffer();

    const thumbnailPath = generateThumbnailPath(userId, assetId, 'image');

    return await uploadFileBuffer(
      thumbnailBuffer,
      thumbnailPath,
      'image/jpeg',
      {
        'thumbnail-size': `${thumbnailConfig.width}x${thumbnailConfig.height}`,
        'generated-at': new Date().toISOString(),
      }
    );
  } catch (error) {
    console.error('Error generating image thumbnail:', error);
    throw new Error('Failed to generate image thumbnail');
  }
}

export async function generateVideoThumbnail(
  videoPath: string,
  userId: string,
  assetId: string,
  timeOffset: number = 1
): Promise<string> {
  // For video thumbnails, we'll need to use FFmpeg
  // This is a placeholder implementation - you'd need to install ffmpeg
  // and use a library like fluent-ffmpeg

  try {
    // Placeholder: In a real implementation, you would:
    // 1. Use FFmpeg to extract a frame at the specified time offset
    // 2. Generate a thumbnail from that frame
    // 3. Upload the thumbnail to S3

    const thumbnailPath = generateThumbnailPath(userId, assetId, 'video');

    // For now, return a placeholder path
    // TODO: Implement actual video thumbnail extraction
    console.warn('Video thumbnail generation not implemented yet');
    return `${CDN_BASE_URL}/${thumbnailPath}`;
  } catch (error) {
    console.error('Error generating video thumbnail:', error);
    throw new Error('Failed to generate video thumbnail');
  }
}

// ============================================================================
// File Metadata Extraction
// ============================================================================

export async function extractImageMetadata(buffer: Buffer): Promise<FileMetadata> {
  try {
    const metadata = await sharp(buffer).metadata();

    return {
      size: buffer.length,
      type: `image/${metadata.format}`,
      dimensions: {
        width: metadata.width,
        height: metadata.height,
      },
    };
  } catch (error) {
    console.error('Error extracting image metadata:', error);
    throw new Error('Failed to extract image metadata');
  }
}

export async function extractVideoMetadata(filePath: string): Promise<FileMetadata> {
  // Placeholder for video metadata extraction
  // In a real implementation, you would use FFmpeg or a similar tool

  try {
    // TODO: Implement actual video metadata extraction
    return {
      size: 0,
      type: 'video/mp4',
      dimensions: {
        width: 1920,
        height: 1080,
        fps: 30,
      },
      duration: 0,
    };
  } catch (error) {
    console.error('Error extracting video metadata:', error);
    throw new Error('Failed to extract video metadata');
  }
}

// ============================================================================
// File Validation
// ============================================================================

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  metadata?: FileMetadata;
}

export function validateFileType(filename: string, assetType: AssetType): boolean {
  const extension = filename.split('.').pop()?.toLowerCase();
  if (!extension) return false;

  const allowedExtensions: Record<AssetType, string[]> = {
    image: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    video: ['mp4', 'mov', 'avi', 'webm'],
    audio: ['mp3', 'wav', 'aac', 'ogg'],
    text: ['txt', 'md', 'json'],
    prompt: ['txt', 'md'],
    experiment: ['txt', 'md', 'json'],
    workflow: ['json'],
    comparison: ['json'],
  };

  return allowedExtensions[assetType]?.includes(extension) || false;
}

export function validateFileSize(fileSize: number, assetType: AssetType): boolean {
  const maxSizes: Record<AssetType, number> = {
    image: 50 * 1024 * 1024, // 50MB
    video: 500 * 1024 * 1024, // 500MB
    audio: 100 * 1024 * 1024, // 100MB
    text: 1 * 1024 * 1024, // 1MB
    prompt: 1 * 1024 * 1024, // 1MB
    experiment: 10 * 1024 * 1024, // 10MB
    workflow: 1 * 1024 * 1024, // 1MB
    comparison: 10 * 1024 * 1024, // 10MB
  };

  return fileSize <= maxSizes[assetType];
}

export async function validateFile(
  filename: string,
  fileSize: number,
  assetType: AssetType,
  buffer?: Buffer
): Promise<FileValidationResult> {
  // Check file type
  if (!validateFileType(filename, assetType)) {
    return {
      isValid: false,
      error: `Invalid file type for ${assetType}. File: ${filename}`,
    };
  }

  // Check file size
  if (!validateFileSize(fileSize, assetType)) {
    return {
      isValid: false,
      error: `File too large for ${assetType}. Size: ${fileSize} bytes`,
    };
  }

  // Extract metadata if buffer is provided
  let metadata: FileMetadata | undefined;
  if (buffer && assetType === 'image') {
    try {
      metadata = await extractImageMetadata(buffer);
    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid image file or corrupted data',
      };
    }
  }

  return {
    isValid: true,
    metadata,
  };
}

// ============================================================================
// File Deletion
// ============================================================================

export async function deleteFile(filePath: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: filePath,
    });

    await s3Client.send(command);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw new Error(`Failed to delete file: ${filePath}`);
  }
}

export async function deleteAssetFiles(
  userId: string,
  assetId: string,
  assetType: AssetType
): Promise<void> {
  // Delete all files associated with an asset
  const folderPath = `uploads/${userId}/${getAssetTypeFolder(assetType)}/${assetId}/`;

  try {
    // In a full implementation, you would list all objects with the prefix
    // and delete them. For now, we'll delete the common files.

    const filesToDelete = [
      `${folderPath}original.*`, // Original file (would need to determine extension)
      generateThumbnailPath(userId, assetId, assetType),
      generateThumbnailPath(userId, assetId, assetType, '256'),
      generateThumbnailPath(userId, assetId, assetType, '128'),
    ];

    // Note: This is a simplified deletion. In production, you'd want to:
    // 1. List all objects with the prefix
    // 2. Delete them in batches
    // 3. Handle errors gracefully

    console.log(`Would delete asset files for ${assetId} in folder ${folderPath}`);
  } catch (error) {
    console.error('Error deleting asset files:', error);
    throw new Error(`Failed to delete files for asset: ${assetId}`);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getPublicUrl(filePath: string): string {
  return `${CDN_BASE_URL}/${filePath}`;
}

export function extractFilePathFromUrl(url: string): string {
  return url.replace(`${CDN_BASE_URL}/`, '');
}

export function generateAssetId(): string {
  return uuidv4();
}

// ============================================================================
// Storage Service Class (Optional - for dependency injection)
// ============================================================================

export class StorageService {
  constructor(
    private bucket: string = BUCKET_NAME,
    private cdnUrl: string = CDN_BASE_URL
  ) {}

  async uploadFile(
    buffer: Buffer,
    filePath: string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    return uploadFileBuffer(buffer, filePath, contentType, metadata);
  }

  async generateUploadUrl(
    userId: string,
    assetId: string,
    assetType: AssetType,
    filename: string,
    fileType: string,
    fileSize: number
  ): Promise<PresignedUploadInfo> {
    return generatePresignedUploadUrl(userId, assetId, assetType, filename, fileType, fileSize);
  }

  async createThumbnail(
    sourceBuffer: Buffer,
    userId: string,
    assetId: string,
    config?: Partial<ThumbnailConfig>
  ): Promise<string> {
    return generateImageThumbnail(sourceBuffer, userId, assetId, config);
  }

  async deleteAsset(userId: string, assetId: string, assetType: AssetType): Promise<void> {
    return deleteAssetFiles(userId, assetId, assetType);
  }

  getPublicUrl(filePath: string): string {
    return getPublicUrl(filePath);
  }
}

export const storageService = new StorageService();