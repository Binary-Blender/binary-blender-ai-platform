'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Search,
  Filter,
  X,
  Star,
  Heart,
  Calendar,
  Tag,
  Zap,
  SlidersHorizontal
} from 'lucide-react'
import { AssetType } from '@/lib/types/asset-repository'

interface FilterState {
  search: string
  assetType: AssetType | 'all'
  minRating: number
  maxCredits: number
  favoritesOnly: boolean
  dateRange: 'all' | 'today' | 'week' | 'month' | 'year'
  tags: string[]
  sourceApp: string
  sourceTool: string
  sortBy: 'created_at' | 'updated_at' | 'name' | 'rating' | 'credits_used'
  sortOrder: 'asc' | 'desc'
}

interface SearchFilterProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  onReset: () => void
}

export default function SearchFilter({
  filters,
  onFiltersChange,
  onReset
}: SearchFilterProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [tagInput, setTagInput] = useState('')

  const assetTypeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'image', label: 'Images' },
    { value: 'video', label: 'Videos' },
    { value: 'audio', label: 'Audio' },
    { value: 'text', label: 'Text' },
    { value: 'prompt', label: 'Prompts' },
    { value: 'experiment', label: 'Experiments' }
  ]

  const dateRangeOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'year', label: 'This Year' }
  ]

  const sortOptions = [
    { value: 'created_at', label: 'Date Created' },
    { value: 'updated_at', label: 'Date Modified' },
    { value: 'name', label: 'Name' },
    { value: 'rating', label: 'Rating' },
    { value: 'credits_used', label: 'Credits Used' }
  ]

  const updateFilter = (key: keyof FilterState, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    })
  }

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim()
    if (trimmedTag && !filters.tags.includes(trimmedTag)) {
      updateFilter('tags', [...filters.tags, trimmedTag])
    }
  }

  const removeTag = (tagToRemove: string) => {
    updateFilter('tags', filters.tags.filter(tag => tag !== tagToRemove))
  }

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagInput)
      setTagInput('')
    }
  }

  const getActiveFilterCount = () => {
    let count = 0
    if (filters.search) count++
    if (filters.assetType !== 'all') count++
    if (filters.minRating > 0) count++
    if (filters.maxCredits < 100) count++
    if (filters.favoritesOnly) count++
    if (filters.dateRange !== 'all') count++
    if (filters.tags.length > 0) count++
    if (filters.sourceApp) count++
    if (filters.sourceTool) count++
    return count
  }

  const hasActiveFilters = getActiveFilterCount() > 0

  return (
    <div className="space-y-4">
      {/* Main Search Bar */}
      <div className="flex items-center space-x-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search assets, tags, or notes..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
          />
          {filters.search && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => updateFilter('search', '')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white p-1 h-auto"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        <Select value={filters.assetType} onValueChange={(value) => updateFilter('assetType', value)}>
          <SelectTrigger className="w-40 bg-gray-700 border-gray-600 text-white">
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

        <Select value={filters.sortBy} onValueChange={(value) => updateFilter('sortBy', value)}>
          <SelectTrigger className="w-40 bg-gray-700 border-gray-600 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-700 border-gray-600">
            {sortOptions.map(option => (
              <SelectItem key={option.value} value={option.value} className="text-white hover:bg-gray-600">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
          className="border-gray-600 text-gray-300 hover:bg-gray-700"
        >
          {filters.sortOrder === 'asc' ? '↑' : '↓'}
        </Button>

        <Button
          variant={filters.favoritesOnly ? "default" : "outline"}
          size="sm"
          onClick={() => updateFilter('favoritesOnly', !filters.favoritesOnly)}
          className={filters.favoritesOnly ? "bg-binary-orange" : "border-gray-600 text-gray-300 hover:bg-gray-700"}
        >
          <Heart className={`w-4 h-4 ${filters.favoritesOnly ? 'fill-current' : ''}`} />
        </Button>

        <Popover open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`border-gray-600 text-gray-300 hover:bg-gray-700 ${hasActiveFilters ? 'border-binary-orange text-binary-orange' : ''}`}
            >
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2 bg-binary-orange text-white text-xs">
                  {getActiveFilterCount()}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 bg-gray-800 border-gray-700" align="end">
            <Card className="bg-transparent border-0 shadow-none">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-white flex items-center justify-between">
                  Advanced Filters
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onReset}
                    className="text-gray-400 hover:text-white h-auto p-1"
                  >
                    Reset All
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-6">
                {/* Rating Filter */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-white flex items-center">
                      <Star className="w-4 h-4 mr-2 text-yellow-400" />
                      Minimum Rating
                    </label>
                    <span className="text-sm text-gray-400">{filters.minRating || 'Any'}</span>
                  </div>
                  <Slider
                    value={[filters.minRating]}
                    onValueChange={(value) => updateFilter('minRating', value[0])}
                    max={5}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Credits Filter */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-white flex items-center">
                      <Zap className="w-4 h-4 mr-2 text-binary-orange" />
                      Max Credits Used
                    </label>
                    <span className="text-sm text-gray-400">{filters.maxCredits}</span>
                  </div>
                  <Slider
                    value={[filters.maxCredits]}
                    onValueChange={(value) => updateFilter('maxCredits', value[0])}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Date Range */}
                <div>
                  <label className="text-sm font-medium text-white flex items-center mb-2">
                    <Calendar className="w-4 h-4 mr-2" />
                    Date Range
                  </label>
                  <Select value={filters.dateRange} onValueChange={(value) => updateFilter('dateRange', value)}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-700 border-gray-600">
                      {dateRangeOptions.map(option => (
                        <SelectItem key={option.value} value={option.value} className="text-white hover:bg-gray-600">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tags */}
                <div>
                  <label className="text-sm font-medium text-white flex items-center mb-2">
                    <Tag className="w-4 h-4 mr-2" />
                    Tags
                  </label>
                  <div className="space-y-2">
                    <Input
                      placeholder="Add tag and press Enter"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagInputKeyDown}
                      className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    />
                    {filters.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {filters.tags.map(tag => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="bg-binary-orange/20 text-binary-orange border-binary-orange/30"
                          >
                            {tag}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeTag(tag)}
                              className="ml-1 h-auto p-0 text-binary-orange hover:text-binary-orange/80"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Source App */}
                <div>
                  <label className="text-sm font-medium text-white mb-2 block">Source App</label>
                  <Input
                    placeholder="e.g., image_studio, video_studio"
                    value={filters.sourceApp}
                    onChange={(e) => updateFilter('sourceApp', e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  />
                </div>

                {/* Source Tool */}
                <div>
                  <label className="text-sm font-medium text-white mb-2 block">Source Tool</label>
                  <Input
                    placeholder="e.g., flux-pro, runway, kling"
                    value={filters.sourceTool}
                    onChange={(e) => updateFilter('sourceTool', e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  />
                </div>
              </CardContent>
            </Card>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex items-center space-x-2 flex-wrap">
          <span className="text-sm text-gray-400">Active filters:</span>

          {filters.search && (
            <Badge variant="secondary" className="bg-binary-orange/20 text-binary-orange border-binary-orange/30">
              Search: "{filters.search}"
              <Button
                size="sm"
                variant="ghost"
                onClick={() => updateFilter('search', '')}
                className="ml-1 h-auto p-0 text-binary-orange hover:text-binary-orange/80"
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          )}

          {filters.assetType !== 'all' && (
            <Badge variant="secondary" className="bg-binary-orange/20 text-binary-orange border-binary-orange/30">
              Type: {filters.assetType}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => updateFilter('assetType', 'all')}
                className="ml-1 h-auto p-0 text-binary-orange hover:text-binary-orange/80"
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          )}

          {filters.favoritesOnly && (
            <Badge variant="secondary" className="bg-binary-orange/20 text-binary-orange border-binary-orange/30">
              Favorites Only
              <Button
                size="sm"
                variant="ghost"
                onClick={() => updateFilter('favoritesOnly', false)}
                className="ml-1 h-auto p-0 text-binary-orange hover:text-binary-orange/80"
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          )}

          {filters.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="bg-binary-orange/20 text-binary-orange border-binary-orange/30">
              #{tag}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeTag(tag)}
                className="ml-1 h-auto p-0 text-binary-orange hover:text-binary-orange/80"
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          ))}

          <Button
            size="sm"
            variant="ghost"
            onClick={onReset}
            className="text-gray-400 hover:text-white"
          >
            Clear All
          </Button>
        </div>
      )}
    </div>
  )
}