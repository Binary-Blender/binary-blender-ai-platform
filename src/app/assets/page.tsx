'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Filter,
  Grid,
  List,
  Star,
  Heart,
  Eye,
  Download,
  FolderPlus,
  Plus,
  Image,
  Video,
  Mic,
  FileText,
  Settings,
  Trash2,
  MoreVertical
} from 'lucide-react'
import { Asset, Project, Folder, AssetType } from '@/lib/types/asset-repository'
import ProjectBrowser from '@/components/assets/project-browser'
import AssetGallery from '@/components/assets/asset-gallery'
import AssetDetailsModal from '@/components/assets/asset-details-modal'
import FolderNavigation from '@/components/assets/folder-navigation'
import SearchFilter from '@/components/assets/search-filter'

export default function AssetsPage() {
  const { data: session } = useSession()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([])
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAssetType, setSelectedAssetType] = useState<AssetType | 'all'>('all')
  const [sortBy, setSortBy] = useState<'created_at' | 'name' | 'rating'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showFavorites, setShowFavorites] = useState(false)

  // Load projects on mount
  useEffect(() => {
    console.log('Assets page: useEffect for loadProjects triggered, session:', session)
    loadProjects()
  }, [session])

  // Load assets when project or folder changes, or initially for unorganized assets
  useEffect(() => {
    console.log('Assets page: useEffect for loadAssets triggered, session:', session, 'selectedProject:', selectedProject, 'currentFolder:', currentFolder)
    loadAssets()
  }, [selectedProject, currentFolder, session])

  // Filter and sort assets
  useEffect(() => {
    console.log('Assets page: Filter useEffect triggered with assets:', assets.length, 'assets')
    let filtered = [...assets]

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(asset =>
        asset.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    // Asset type filter
    if (selectedAssetType !== 'all') {
      filtered = filtered.filter(asset => asset.asset_type === selectedAssetType)
    }

    // Favorites filter
    if (showFavorites) {
      filtered = filtered.filter(asset => asset.is_favorite)
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal
      switch (sortBy) {
        case 'name':
          aVal = a.name || ''
          bVal = b.name || ''
          break
        case 'rating':
          aVal = a.user_rating || 0
          bVal = b.user_rating || 0
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

    console.log('Assets page: Setting filteredAssets to:', filtered.length, 'assets')
    setFilteredAssets(filtered)
  }, [assets, searchQuery, selectedAssetType, sortBy, sortOrder, showFavorites])

  const loadProjects = async () => {
    try {
      console.log('Assets page: loadProjects called, making API request to /api/projects')
      const response = await fetch('/api/projects')
      console.log('Assets page: loadProjects response status:', response.status)
      const data = await response.json()
      console.log('Assets page: loadProjects response data:', data)
      if (data.success) {
        setProjects(data.data)
        console.log('Assets page: Projects set, count:', data.data.length)
        if (data.data.length > 0 && !selectedProject) {
          setSelectedProject(data.data[0])
          console.log('Assets page: Selected first project:', data.data[0])
        }
      } else {
        console.error('Assets page: loadProjects failed:', data.error)
      }
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAssets = async () => {
    try {
      const params = new URLSearchParams({
        limit: '100'
      })

      if (selectedProject) {
        params.append('project_id', selectedProject.id)
        console.log('Assets page: loadAssets for project:', selectedProject.id)

        if (currentFolder) {
          params.append('folder_id', currentFolder.id)
          console.log('Assets page: loadAssets for folder:', currentFolder.id)
        }
      } else {
        // Load unorganized assets (assets without a project)
        params.append('unorganized', 'true')
        console.log('Assets page: loadAssets for unorganized assets')
      }

      const url = `/api/assets?${params}`
      console.log('Assets page: loadAssets making API request to:', url)
      const response = await fetch(url)
      console.log('Assets page: loadAssets response status:', response.status)
      const data = await response.json()
      console.log('Assets page: loadAssets response data:', data)
      if (data.success) {
        setAssets(data.data)
        console.log('Assets page: Assets set, count:', data.data.length)
      } else {
        console.error('Assets page: loadAssets failed:', data.error)
      }
    } catch (error) {
      console.error('Error loading assets:', error)
    }
  }

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

  const assetTypeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'image', label: 'Images' },
    { value: 'video', label: 'Videos' },
    { value: 'audio', label: 'Audio' },
    { value: 'text', label: 'Text' }
  ]

  if (loading && projects.length === 0) {
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
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex-none p-6 border-b border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white">Asset Repository</h1>
              <p className="text-gray-400 mt-1">
                Organize and manage all your AI-generated assets
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
              </Button>
              <Button
                size="sm"
                className="bg-binary-orange hover:bg-binary-orange/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search assets, tags, or notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                />
              </div>
            </div>
            <div className="flex items-center space-x-3">
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

              <Select value={sortBy} onValueChange={(value: 'created_at' | 'name' | 'rating') => setSortBy(value)}>
                <SelectTrigger className="w-32 bg-gray-700 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="created_at" className="text-white hover:bg-gray-600">Date</SelectItem>
                  <SelectItem value="name" className="text-white hover:bg-gray-600">Name</SelectItem>
                  <SelectItem value="rating" className="text-white hover:bg-gray-600">Rating</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant={showFavorites ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFavorites(!showFavorites)}
                className={showFavorites ? "bg-binary-orange" : "border-gray-600 text-gray-300 hover:bg-gray-700"}
              >
                <Heart className={`w-4 h-4 ${showFavorites ? 'fill-current' : ''}`} />
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Projects and Folders */}
          <div className="w-80 flex-none border-r border-gray-700 overflow-auto">
            <ProjectBrowser
              projects={projects}
              selectedProject={selectedProject}
              onSelectProject={setSelectedProject}
              currentFolder={currentFolder}
              onSelectFolder={setCurrentFolder}
            />
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedProject ? (
              <>
                {/* Breadcrumb */}
                <div className="flex-none px-6 py-4 border-b border-gray-700">
                  <FolderNavigation
                    project={selectedProject}
                    currentFolder={currentFolder}
                    onNavigate={setCurrentFolder}
                  />
                </div>

                {/* Asset Gallery */}
                <div className="flex-1 overflow-auto">
                  {console.log('Assets page: Rendering AssetGallery with props:', {
                    assetsCount: filteredAssets.length,
                    loading,
                    viewMode,
                    firstAsset: filteredAssets[0]?.id
                  })}
                  <AssetGallery
                    assets={filteredAssets}
                    viewMode={viewMode}
                    loading={loading}
                    onSelectAsset={setSelectedAsset}
                    onAssetUpdate={loadAssets}
                  />
                </div>
              </>
            ) : (
              <>
                {/* Unorganized Assets Header */}
                <div className="flex-none px-6 py-4 border-b border-gray-700">
                  <h2 className="text-lg font-semibold text-white">Unorganized Assets</h2>
                  <p className="text-sm text-gray-400">Assets not assigned to any project</p>
                </div>

                {/* Asset Gallery for Unorganized Assets */}
                <div className="flex-1 overflow-auto">
                  {console.log('Assets page: Rendering Unorganized AssetGallery with props:', {
                    assetsCount: filteredAssets.length,
                    loading,
                    viewMode,
                    firstAsset: filteredAssets[0]?.id
                  })}
                  <AssetGallery
                    assets={filteredAssets}
                    viewMode={viewMode}
                    loading={loading}
                    onSelectAsset={setSelectedAsset}
                    onAssetUpdate={loadAssets}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Asset Details Modal */}
        {selectedAsset && (
          <AssetDetailsModal
            asset={selectedAsset}
            onClose={() => setSelectedAsset(null)}
            onUpdate={loadAssets}
          />
        )}
      </div>
    </DashboardLayout>
  )
}