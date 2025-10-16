'use client'

import { useState } from 'react'
import { Image, Video, Mic, FileText } from 'lucide-react'
import { AssetType } from '@/lib/types/asset-repository'

interface AssetImageProps {
  src?: string | null
  alt: string
  assetType: AssetType
  className?: string
  fallbackClassName?: string
}

export default function AssetImage({
  src,
  alt,
  assetType,
  className = "w-full h-full object-cover",
  fallbackClassName = "w-12 h-12"
}: AssetImageProps) {
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const getAssetIcon = (type: AssetType) => {
    switch (type) {
      case 'image':
        return <Image className={fallbackClassName} />
      case 'video':
        return <Video className={fallbackClassName} />
      case 'audio':
        return <Mic className={fallbackClassName} />
      default:
        return <FileText className={fallbackClassName} />
    }
  }

  const getAssetTypeColor = (type: AssetType) => {
    switch (type) {
      case 'image':
        return 'bg-purple-500/20 text-purple-400'
      case 'video':
        return 'bg-blue-500/20 text-blue-400'
      case 'audio':
        return 'bg-green-500/20 text-green-400'
      default:
        return 'bg-gray-500/20 text-gray-400'
    }
  }

  // If no src or image failed to load, show fallback
  if (!src || imageError) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className={`rounded-lg flex items-center justify-center ${getAssetTypeColor(assetType)}`}>
          {getAssetIcon(assetType)}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative">
      {isLoading && (
        <div className="w-full h-full flex items-center justify-center absolute inset-0 bg-gray-700 rounded-lg">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={className}
        onLoad={() => {
          setIsLoading(false)
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ Image loaded:', src)
          }
        }}
        onError={() => {
          setIsLoading(false)
          setImageError(true)
          if (process.env.NODE_ENV === 'development') {
            console.error('❌ Image failed to load:', src)
          }
        }}
        style={{ display: isLoading ? 'none' : 'block' }}
      />
    </div>
  )
}