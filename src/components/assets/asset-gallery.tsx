'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Heart,
  Star,
  Download,
  Eye,
  MoreVertical,
  Image,
  Video,
  Mic,
  FileText,
  Clock,
  Zap,
  Copy,
  Edit,
  Trash2,
  ExternalLink
} from 'lucide-react'
import { Asset, AssetType } from '@/lib/types/asset-repository'
import { formatDistanceToNow } from 'date-fns'
import AssetImage from '@/components/ui/asset-image'

interface AssetGalleryProps {
  assets: Asset[]
  viewMode: 'grid' | 'list'
  loading: boolean
  onSelectAsset: (asset: Asset) => void
  onAssetUpdate: () => void
}

export default function AssetGallery({
  assets,
  viewMode,
  loading,
  onSelectAsset,
  onAssetUpdate
}: AssetGalleryProps) {
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set())



  const getAssetIcon = (assetType: AssetType) => {
    switch (assetType) {
      case 'image':
        return <Image className="w-4 h-4" />
      case 'video':
        return <Video className="w-4 h-4" />
      case 'audio':
        return <Mic className="w-4 h-4" />
      default:
        return <FileText className="w-4 h-4" />
    }
  }

  const getAssetTypeColor = (assetType: AssetType) => {
    switch (assetType) {
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

  const toggleAssetSelection = (assetId: string) => {
    const newSelected = new Set(selectedAssets)
    if (newSelected.has(assetId)) {
      newSelected.delete(assetId)
    } else {
      newSelected.add(assetId)
    }
    setSelectedAssets(newSelected)
  }

  const handleToggleFavorite = async (asset: Asset, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const response = await fetch(`/api/assets/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorite: !asset.is_favorite })
      })

      if (response.ok) {
        onAssetUpdate()
      }
    } catch (error) {
      console.error('Error updating favorite:', error)
    }
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3 h-3 ${
              star <= rating
                ? 'text-yellow-400 fill-current'
                : 'text-gray-600'
            }`}
          />
        ))}
      </div>
    )
  }

  // Show loading state only if we explicitly have loading=true AND no assets
  if (loading && assets.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-binary-orange"></div>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Loading Assets...</h3>
          <p className="text-gray-400">Fetching your assets from the repository</p>
        </div>
      </div>
    )
  }

  if (assets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
            <div className="text-center">
            <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Image className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No Assets Found</h3>
            <p className="text-gray-400 mb-4">
              Start creating assets or adjust your search filters
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (viewMode === 'grid') {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {assets.map((asset) => (
            <Card
              key={asset.id}
              className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-all duration-200 cursor-pointer group"
              onClick={() => onSelectAsset(asset)}
            >
              <CardContent className="p-4">
                {/* Asset Preview */}
                <div className="aspect-square bg-gray-700 rounded-lg mb-3 overflow-hidden relative">
                  <AssetImage
                    src={asset.thumbnail_url}
                    fallbackSrc={asset.file_url}
                    alt={asset.name || 'Asset'}
                    assetType={asset.asset_type}
                    className="w-full h-full object-cover"
                    fallbackClassName="w-12 h-12"
                  />

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectAsset(asset)
                        }}
                        className="bg-white/90 text-black hover:bg-white"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => handleToggleFavorite(asset, e)}
                        className={`${
                          asset.is_favorite
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : 'bg-white/90 text-black hover:bg-white'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${asset.is_favorite ? 'fill-current' : ''}`} />
                      </Button>
                    </div>
                  </div>

                  {/* Asset Type Badge */}
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className={`text-xs ${getAssetTypeColor(asset.asset_type)} border-0`}>
                      {getAssetIcon(asset.asset_type)}
                      <span className="ml-1 capitalize">{asset.asset_type}</span>
                    </Badge>
                  </div>

                  {/* Favorite Indicator */}
                  {asset.is_favorite && (
                    <div className="absolute top-2 right-2">
                      <Heart className="w-4 h-4 text-red-400 fill-current" />
                    </div>
                  )}
                </div>

                {/* Asset Info */}
                <div className="space-y-2">
                  <h3 className="font-medium text-white text-sm truncate">
                    {asset.name || 'Untitled Asset'}
                  </h3>

                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>
                      {formatDistanceToNow(new Date(asset.created_at), { addSuffix: true })}
                    </span>
                    {asset.credits_used > 0 && (
                      <div className="flex items-center">
                        <Zap className="w-3 h-3 mr-1 text-binary-orange" />
                        <span>{asset.credits_used}</span>
                      </div>
                    )}
                  </div>

                  {/* Rating */}
                  {asset.user_rating && (
                    <div className="flex items-center justify-between">
                      {renderStars(asset.user_rating)}
                    </div>
                  )}

                  {/* Tags */}
                  {asset.tags && asset.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {asset.tags.slice(0, 2).map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="text-xs px-1 py-0 border-gray-600 text-gray-400"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {asset.tags.length > 2 && (
                        <Badge
                          variant="outline"
                          className="text-xs px-1 py-0 border-gray-600 text-gray-400"
                        >
                          +{asset.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // List View
  return (
    <div className="p-6">
      <div className="space-y-3">
        {assets.map((asset) => (
          <Card
            key={asset.id}
            className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-colors cursor-pointer"
            onClick={() => onSelectAsset(asset)}
          >
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                {/* Thumbnail */}
                <div className="w-16 h-16 bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                  <AssetImage
                    src={asset.thumbnail_url}
                    fallbackSrc={asset.file_url}
                    alt={asset.name || 'Asset'}
                    assetType={asset.asset_type}
                    className="w-full h-full object-cover"
                    fallbackClassName="w-8 h-8"
                  />
                </div>

                {/* Asset Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-medium text-white truncate">
                      {asset.name || 'Untitled Asset'}
                    </h3>
                    <Badge variant="secondary" className={`text-xs ${getAssetTypeColor(asset.asset_type)} border-0`}>
                      {asset.asset_type}
                    </Badge>
                    {asset.is_favorite && (
                      <Heart className="w-4 h-4 text-red-400 fill-current" />
                    )}
                  </div>

                  <div className="flex items-center space-x-4 text-sm text-gray-400">
                    <span>
                      {formatDistanceToNow(new Date(asset.created_at), { addSuffix: true })}
                    </span>
                    {asset.source_tool && (
                      <span>via {asset.source_tool}</span>
                    )}
                    {asset.credits_used > 0 && (
                      <div className="flex items-center">
                        <Zap className="w-3 h-3 mr-1 text-binary-orange" />
                        <span>{asset.credits_used} credits</span>
                      </div>
                    )}
                    {asset.user_rating && (
                      <div className="flex items-center">
                        {renderStars(asset.user_rating)}
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {asset.tags && asset.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {asset.tags.slice(0, 4).map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="text-xs px-1 py-0 border-gray-600 text-gray-400"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {asset.tags.length > 4 && (
                        <Badge
                          variant="outline"
                          className="text-xs px-1 py-0 border-gray-600 text-gray-400"
                        >
                          +{asset.tags.length - 4} more
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => handleToggleFavorite(asset, e)}
                    className="text-gray-400 hover:text-white"
                  >
                    <Heart className={`w-4 h-4 ${asset.is_favorite ? 'fill-current text-red-400' : ''}`} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-gray-400 hover:text-white"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}