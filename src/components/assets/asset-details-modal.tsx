'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Heart,
  Star,
  Download,
  Copy,
  Edit,
  Trash2,
  ExternalLink,
  RefreshCw,
  Share,
  Eye,
  Clock,
  Zap,
  Tag,
  Image,
  Video,
  Mic,
  FileText,
  Save,
  X
} from 'lucide-react'
import { Asset, AssetType } from '@/lib/types/asset-repository'
import { formatDistanceToNow } from 'date-fns'

interface AssetDetailsModalProps {
  asset: Asset
  onClose: () => void
  onUpdate: () => void
}

export default function AssetDetailsModal({
  asset,
  onClose,
  onUpdate
}: AssetDetailsModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedAsset, setEditedAsset] = useState(asset)
  const [loading, setLoading] = useState(false)
  const [parentAssets, setParentAssets] = useState<Asset[]>([])
  const [childAssets, setChildAssets] = useState<Asset[]>([])
  const [versions, setVersions] = useState([])

  useEffect(() => {
    setEditedAsset(asset)
    loadAssetDetails()
  }, [asset])

  const loadAssetDetails = async () => {
    try {
      const response = await fetch(`/api/assets/${asset.id}`)
      const data = await response.json()
      if (data.success) {
        setParentAssets(data.data.parent_assets || [])
        setChildAssets(data.data.child_assets || [])
        setVersions(data.data.versions || [])
      }
    } catch (error) {
      console.error('Error loading asset details:', error)
    }
  }

  const handleSave = async () => {
    try {
      setLoading(true)
      const updateData = {
        name: editedAsset.name,
        notes: editedAsset.notes,
        tags: editedAsset.tags,
        is_favorite: editedAsset.is_favorite,
        user_rating: editedAsset.user_rating
      }

      const response = await fetch(`/api/assets/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        setIsEditing(false)
        onUpdate()
      }
    } catch (error) {
      console.error('Error updating asset:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleFavorite = async () => {
    const newFavorite = !editedAsset.is_favorite
    setEditedAsset(prev => ({ ...prev, is_favorite: newFavorite }))

    try {
      await fetch(`/api/assets/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorite: newFavorite })
      })
      onUpdate()
    } catch (error) {
      console.error('Error updating favorite:', error)
      setEditedAsset(prev => ({ ...prev, is_favorite: !newFavorite }))
    }
  }

  const handleRatingChange = (rating: number) => {
    setEditedAsset(prev => ({ ...prev, user_rating: rating }))
  }

  const handleRegenerate = async () => {
    try {
      const response = await fetch(`/api/assets/${asset.id}/regenerate`, {
        method: 'POST'
      })
      const data = await response.json()
      if (data.success && data.data.redirect_url) {
        window.open(data.data.redirect_url, '_blank')
      }
    } catch (error) {
      console.error('Error regenerating asset:', error)
    }
  }

  const getAssetIcon = (assetType: AssetType) => {
    switch (assetType) {
      case 'image':
        return <Image className="w-5 h-5" />
      case 'video':
        return <Video className="w-5 h-5" />
      case 'audio':
        return <Mic className="w-5 h-5" />
      default:
        return <FileText className="w-5 h-5" />
    }
  }

  const getAssetTypeColor = (assetType: AssetType) => {
    switch (assetType) {
      case 'image':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'video':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'audio':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const renderStars = (rating: number, interactive = false) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={interactive ? () => handleRatingChange(star) : undefined}
            disabled={!interactive}
            className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
          >
            <Star
              className={`w-4 h-4 ${
                star <= rating
                  ? 'text-yellow-400 fill-current'
                  : 'text-gray-600'
              }`}
            />
          </button>
        ))}
      </div>
    )
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto bg-gray-800 border-gray-700 text-white">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold text-white">
              {isEditing ? (
                <Input
                  value={editedAsset.name || ''}
                  onChange={(e) => setEditedAsset(prev => ({ ...prev, name: e.target.value }))}
                  className="text-2xl font-bold bg-gray-700 border-gray-600 text-white"
                  placeholder="Asset name..."
                />
              ) : (
                editedAsset.name || 'Untitled Asset'
              )}
            </DialogTitle>
            <div className="flex items-center space-x-2">
              {isEditing ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false)
                      setEditedAsset(asset)
                    }}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={loading}
                    className="bg-binary-orange hover:bg-binary-orange/90"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleToggleFavorite}
                    className={`border-gray-600 ${
                      editedAsset.is_favorite
                        ? 'text-red-400 hover:bg-red-500/20'
                        : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${editedAsset.is_favorite ? 'fill-current' : ''}`} />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onClose}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Asset Preview */}
          <div className="space-y-4">
            {/* Asset Preview */}
            <Card className="bg-gray-700 border-gray-600">
              <CardContent className="p-4">
                <div className="aspect-square bg-gray-800 rounded-lg overflow-hidden">
                  {asset.file_url ? (
                    asset.asset_type === 'image' ? (
                      <img
                        src={asset.file_url}
                        alt={asset.name || 'Asset'}
                        className="w-full h-full object-contain"
                      />
                    ) : asset.asset_type === 'video' ? (
                      <video
                        src={asset.file_url}
                        controls
                        className="w-full h-full object-contain"
                        poster={asset.thumbnail_url}
                      />
                    ) : asset.asset_type === 'audio' ? (
                      <div className="w-full h-full flex flex-col items-center justify-center">
                        <Mic className="w-16 h-16 text-gray-400 mb-4" />
                        <audio src={asset.file_url} controls className="w-full max-w-sm" />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {getAssetIcon(asset.asset_type)}
                      </div>
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${getAssetTypeColor(asset.asset_type)}`}>
                        {getAssetIcon(asset.asset_type)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Asset Actions */}
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className={getAssetTypeColor(asset.asset_type)}>
                      {getAssetIcon(asset.asset_type)}
                      <span className="ml-1 capitalize">{asset.asset_type}</span>
                    </Badge>
                    {asset.source_tool && (
                      <Badge variant="outline" className="border-gray-600 text-gray-400">
                        {asset.source_tool}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button size="sm" variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                      <Share className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRegenerate}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-gray-700 border-gray-600">
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 text-gray-400 mr-2" />
                    <div>
                      <p className="text-xs text-gray-400">Created</p>
                      <p className="text-sm font-medium text-white">
                        {formatDistanceToNow(new Date(asset.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-700 border-gray-600">
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <Zap className="w-4 h-4 text-binary-orange mr-2" />
                    <div>
                      <p className="text-xs text-gray-400">Credits Used</p>
                      <p className="text-sm font-medium text-white">
                        {asset.credits_used || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Column - Asset Details */}
          <div className="space-y-4">
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-gray-700">
                <TabsTrigger value="details" className="data-[state=active]:bg-binary-orange">Details</TabsTrigger>
                <TabsTrigger value="lineage" className="data-[state=active]:bg-binary-orange">Lineage</TabsTrigger>
                <TabsTrigger value="generation" className="data-[state=active]:bg-binary-orange">Generation</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                {/* Rating */}
                <Card className="bg-gray-700 border-gray-600">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-white">Rating</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderStars(editedAsset.user_rating || 0, isEditing)}
                  </CardContent>
                </Card>

                {/* Notes */}
                <Card className="bg-gray-700 border-gray-600">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-white">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isEditing ? (
                      <Textarea
                        value={editedAsset.notes || ''}
                        onChange={(e) => setEditedAsset(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Add notes about this asset..."
                        className="bg-gray-600 border-gray-500 text-white placeholder-gray-400"
                        rows={4}
                      />
                    ) : (
                      <p className="text-gray-300 whitespace-pre-wrap">
                        {editedAsset.notes || 'No notes added'}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Tags */}
                <Card className="bg-gray-700 border-gray-600">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-white flex items-center">
                      <Tag className="w-4 h-4 mr-2" />
                      Tags
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isEditing ? (
                      <Input
                        value={editedAsset.tags?.join(', ') || ''}
                        onChange={(e) => setEditedAsset(prev => ({
                          ...prev,
                          tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                        }))}
                        placeholder="Enter tags separated by commas"
                        className="bg-gray-600 border-gray-500 text-white placeholder-gray-400"
                      />
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {editedAsset.tags && editedAsset.tags.length > 0 ? (
                          editedAsset.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="border-gray-600 text-gray-300"
                            >
                              {tag}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-gray-400 text-sm">No tags added</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="lineage" className="space-y-4">
                {/* Parent Assets */}
                {parentAssets.length > 0 && (
                  <Card className="bg-gray-700 border-gray-600">
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-white">Input Assets</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {parentAssets.map((parent) => (
                          <div key={parent.id} className="flex items-center space-x-3 p-2 bg-gray-600 rounded-lg">
                            <div className="w-10 h-10 bg-gray-800 rounded overflow-hidden">
                              {parent.thumbnail_url ? (
                                <img
                                  src={parent.thumbnail_url}
                                  alt={parent.name || 'Asset'}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  {getAssetIcon(parent.asset_type)}
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-white">{parent.name || 'Untitled'}</p>
                              <p className="text-xs text-gray-400">{parent.asset_type}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Child Assets */}
                {childAssets.length > 0 && (
                  <Card className="bg-gray-700 border-gray-600">
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-white">Generated From This</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {childAssets.map((child) => (
                          <div key={child.id} className="flex items-center space-x-3 p-2 bg-gray-600 rounded-lg">
                            <div className="w-10 h-10 bg-gray-800 rounded overflow-hidden">
                              {child.thumbnail_url ? (
                                <img
                                  src={child.thumbnail_url}
                                  alt={child.name || 'Asset'}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  {getAssetIcon(child.asset_type)}
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-white">{child.name || 'Untitled'}</p>
                              <p className="text-xs text-gray-400">{child.asset_type}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {parentAssets.length === 0 && childAssets.length === 0 && (
                  <Card className="bg-gray-700 border-gray-600">
                    <CardContent className="p-8 text-center">
                      <p className="text-gray-400">No lineage information available</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="generation" className="space-y-4">
                <Card className="bg-gray-700 border-gray-600">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-white">Generation Parameters</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs text-gray-300 bg-gray-800 p-3 rounded-lg overflow-auto max-h-64">
                      {JSON.stringify(asset.generation_params, null, 2)}
                    </pre>
                  </CardContent>
                </Card>

                {/* Performance Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  {asset.generation_time_seconds && (
                    <Card className="bg-gray-700 border-gray-600">
                      <CardContent className="p-4">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 text-gray-400 mr-2" />
                          <div>
                            <p className="text-xs text-gray-400">Generation Time</p>
                            <p className="text-sm font-medium text-white">
                              {asset.generation_time_seconds}s
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {asset.api_cost_usd && (
                    <Card className="bg-gray-700 border-gray-600">
                      <CardContent className="p-4">
                        <div className="flex items-center">
                          <span className="text-green-400 mr-2">$</span>
                          <div>
                            <p className="text-xs text-gray-400">API Cost</p>
                            <p className="text-sm font-medium text-white">
                              ${asset.api_cost_usd}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}