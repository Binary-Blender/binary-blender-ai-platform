'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  Search,
  Plus,
  Star,
  Copy,
  Edit,
  Trash2,
  Eye,
  TrendingUp,
  Clock,
  Tag,
  FileText,
  Image,
  Video,
  Mic,
  MoreVertical
} from 'lucide-react'
import { Prompt, AssetType } from '@/lib/types/asset-repository'
import { formatDistanceToNow } from 'date-fns'

export default function PromptsPage() {
  const { data: session } = useSession()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [filteredPrompts, setFilteredPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedAssetType, setSelectedAssetType] = useState<AssetType | 'all'>('all')
  const [sortBy, setSortBy] = useState<'created_at' | 'times_used' | 'avg_rating' | 'name'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)

  // Form state for creating/editing prompts
  const [formData, setFormData] = useState({
    name: '',
    prompt_text: '',
    negative_prompt: '',
    category: '',
    asset_types: [] as AssetType[],
    tags: [] as string[]
  })

  useEffect(() => {
    loadPrompts()
  }, [])

  useEffect(() => {
    filterPrompts()
  }, [prompts, searchQuery, selectedCategory, selectedAssetType, sortBy, sortOrder])

  const loadPrompts = async () => {
    try {
      const response = await fetch('/api/prompts')
      const data = await response.json()
      if (data.success) {
        setPrompts(data.data)
      }
    } catch (error) {
      console.error('Error loading prompts:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterPrompts = () => {
    let filtered = [...prompts]

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(prompt =>
        prompt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prompt.prompt_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prompt.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(prompt => prompt.category === selectedCategory)
    }

    // Asset type filter
    if (selectedAssetType !== 'all') {
      filtered = filtered.filter(prompt =>
        prompt.asset_types?.includes(selectedAssetType)
      )
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal
      switch (sortBy) {
        case 'name':
          aVal = a.name
          bVal = b.name
          break
        case 'times_used':
          aVal = a.times_used || 0
          bVal = b.times_used || 0
          break
        case 'avg_rating':
          aVal = a.avg_rating || 0
          bVal = b.avg_rating || 0
          break
        default:
          aVal = new Date(a.created_at).getTime()
          bVal = new Date(b.created_at).getTime()
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })

    setFilteredPrompts(filtered)
  }

  const handleCreatePrompt = async () => {
    try {
      const response = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setIsCreateModalOpen(false)
        resetForm()
        loadPrompts()
      }
    } catch (error) {
      console.error('Error creating prompt:', error)
    }
  }

  const handleUpdatePrompt = async () => {
    if (!editingPrompt) return

    try {
      const response = await fetch(`/api/prompts/${editingPrompt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setEditingPrompt(null)
        resetForm()
        loadPrompts()
      }
    } catch (error) {
      console.error('Error updating prompt:', error)
    }
  }

  const handleDeletePrompt = async (promptId: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return

    try {
      const response = await fetch(`/api/prompts/${promptId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        loadPrompts()
      }
    } catch (error) {
      console.error('Error deleting prompt:', error)
    }
  }

  const handleUsePrompt = async (promptId: string) => {
    try {
      await fetch(`/api/prompts/${promptId}/use`, {
        method: 'POST'
      })
      loadPrompts() // Refresh to show updated usage count
    } catch (error) {
      console.error('Error tracking prompt usage:', error)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // You could add a toast notification here
  }

  const resetForm = () => {
    setFormData({
      name: '',
      prompt_text: '',
      negative_prompt: '',
      category: '',
      asset_types: [],
      tags: []
    })
  }

  const openEditModal = (prompt: Prompt) => {
    setFormData({
      name: prompt.name,
      prompt_text: prompt.prompt_text,
      negative_prompt: prompt.negative_prompt || '',
      category: prompt.category || '',
      asset_types: prompt.asset_types || [],
      tags: prompt.tags || []
    })
    setEditingPrompt(prompt)
  }

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'character', label: 'Character' },
    { value: 'scene', label: 'Scene' },
    { value: 'style', label: 'Style' },
    { value: 'technical', label: 'Technical' },
    { value: 'workflow', label: 'Workflow' }
  ]

  const assetTypeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'image', label: 'Images' },
    { value: 'video', label: 'Videos' },
    { value: 'audio', label: 'Audio' }
  ]

  const getAssetTypeIcon = (assetType: AssetType) => {
    switch (assetType) {
      case 'image':
        return <Image className="w-3 h-3" />
      case 'video':
        return <Video className="w-3 h-3" />
      case 'audio':
        return <Mic className="w-3 h-3" />
      default:
        return <FileText className="w-3 h-3" />
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-binary-orange"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Prompt Library</h1>
            <p className="text-gray-400 mt-1">
              Save and organize your best prompts for reuse across tools
            </p>
          </div>
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-binary-orange hover:bg-binary-orange/90">
                <Plus className="w-4 h-4 mr-2" />
                Add Prompt
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-gray-800 border-gray-700 text-white">
              <DialogHeader>
                <DialogTitle>{editingPrompt ? 'Edit Prompt' : 'Create New Prompt'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Prompt name..."
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-gray-700 border-gray-600 text-white"
                />
                <Textarea
                  placeholder="Enter your prompt..."
                  value={formData.prompt_text}
                  onChange={(e) => setFormData(prev => ({ ...prev, prompt_text: e.target.value }))}
                  className="bg-gray-700 border-gray-600 text-white"
                  rows={4}
                />
                <Textarea
                  placeholder="Negative prompt (optional)..."
                  value={formData.negative_prompt}
                  onChange={(e) => setFormData(prev => ({ ...prev, negative_prompt: e.target.value }))}
                  className="bg-gray-700 border-gray-600 text-white"
                  rows={2}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-700 border-gray-600">
                      {categories.slice(1).map(category => (
                        <SelectItem key={category.value} value={category.value} className="text-white hover:bg-gray-600">
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Asset types would need a multi-select component */}
                </div>
                <Input
                  placeholder="Tags (comma-separated)..."
                  value={formData.tags.join(', ')}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                  }))}
                  className="bg-gray-700 border-gray-600 text-white"
                />
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => {
                    setIsCreateModalOpen(false)
                    setEditingPrompt(null)
                    resetForm()
                  }}>
                    Cancel
                  </Button>
                  <Button
                    onClick={editingPrompt ? handleUpdatePrompt : handleCreatePrompt}
                    className="bg-binary-orange hover:bg-binary-orange/90"
                  >
                    {editingPrompt ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search prompts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              />
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-40 bg-gray-700 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                {categories.map(category => (
                  <SelectItem key={category.value} value={category.value} className="text-white hover:bg-gray-600">
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedAssetType} onValueChange={(value: AssetType | 'all') => setSelectedAssetType(value)}>
              <SelectTrigger className="w-32 bg-gray-700 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                {assetTypeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value} className="text-white hover:bg-gray-600">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-32 bg-gray-700 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                <SelectItem value="created_at" className="text-white hover:bg-gray-600">Date</SelectItem>
                <SelectItem value="name" className="text-white hover:bg-gray-600">Name</SelectItem>
                <SelectItem value="times_used" className="text-white hover:bg-gray-600">Usage</SelectItem>
                <SelectItem value="avg_rating" className="text-white hover:bg-gray-600">Rating</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Prompts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPrompts.map(prompt => (
            <Card key={prompt.id} className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-white text-lg truncate">{prompt.name}</CardTitle>
                    <div className="flex items-center space-x-2 mt-1">
                      {prompt.category && (
                        <Badge variant="outline" className="border-gray-600 text-gray-400 text-xs">
                          {prompt.category}
                        </Badge>
                      )}
                      {prompt.asset_types && prompt.asset_types.map(type => (
                        <Badge key={type} variant="outline" className="border-gray-600 text-gray-400 text-xs">
                          {getAssetTypeIcon(type)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Prompt Text */}
                <div className="bg-gray-700 rounded-lg p-3">
                  <p className="text-sm text-gray-300 line-clamp-3">
                    {prompt.prompt_text}
                  </p>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center space-x-3">
                    {prompt.times_used > 0 && (
                      <div className="flex items-center">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        <span>{prompt.times_used}</span>
                      </div>
                    )}
                    {prompt.avg_rating && (
                      <div className="flex items-center">
                        {renderStars(Math.round(prompt.avg_rating))}
                      </div>
                    )}
                  </div>
                  <span>
                    {formatDistanceToNow(new Date(prompt.created_at), { addSuffix: true })}
                  </span>
                </div>

                {/* Tags */}
                {prompt.tags && prompt.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {prompt.tags.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs border-gray-600 text-gray-400">
                        {tag}
                      </Badge>
                    ))}
                    {prompt.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs border-gray-600 text-gray-400">
                        +{prompt.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      copyToClipboard(prompt.prompt_text)
                      handleUsePrompt(prompt.id)
                    }}
                    className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    <Copy className="w-3 h-3 mr-2" />
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditModal(prompt)}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeletePrompt(prompt.id)}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredPrompts.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Prompts Found</h3>
            <p className="text-gray-400 mb-4">
              {searchQuery || selectedCategory !== 'all' || selectedAssetType !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Create your first prompt to get started'
              }
            </p>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-binary-orange hover:bg-binary-orange/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add First Prompt
            </Button>
          </div>
        )}

        {/* Edit Modal */}
        <Dialog open={!!editingPrompt} onOpenChange={() => setEditingPrompt(null)}>
          <DialogContent className="max-w-2xl bg-gray-800 border-gray-700 text-white">
            <DialogHeader>
              <DialogTitle>Edit Prompt</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Prompt name..."
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="bg-gray-700 border-gray-600 text-white"
              />
              <Textarea
                placeholder="Enter your prompt..."
                value={formData.prompt_text}
                onChange={(e) => setFormData(prev => ({ ...prev, prompt_text: e.target.value }))}
                className="bg-gray-700 border-gray-600 text-white"
                rows={4}
              />
              <Textarea
                placeholder="Negative prompt (optional)..."
                value={formData.negative_prompt}
                onChange={(e) => setFormData(prev => ({ ...prev, negative_prompt: e.target.value }))}
                className="bg-gray-700 border-gray-600 text-white"
                rows={2}
              />
              <div className="grid grid-cols-2 gap-4">
                <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    {categories.slice(1).map(category => (
                      <SelectItem key={category.value} value={category.value} className="text-white hover:bg-gray-600">
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                placeholder="Tags (comma-separated)..."
                value={formData.tags.join(', ')}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                }))}
                className="bg-gray-700 border-gray-600 text-white"
              />
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => {
                  setEditingPrompt(null)
                  resetForm()
                }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdatePrompt}
                  className="bg-binary-orange hover:bg-binary-orange/90"
                >
                  Update
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}