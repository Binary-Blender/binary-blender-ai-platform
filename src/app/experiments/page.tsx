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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  FlaskConical,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Tag,
  FileText,
  MoreVertical,
  TrendingUp,
  Target,
  Microscope,
  BarChart3,
  Lightbulb
} from 'lucide-react'
import { Experiment, ExperimentOutcome } from '@/lib/types/asset-repository'
import { formatDistanceToNow } from 'date-fns'

export default function ExperimentsPage() {
  const { data: session } = useSession()
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [filteredExperiments, setFilteredExperiments] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOutcome, setSelectedOutcome] = useState<ExperimentOutcome | 'all'>('all')
  const [sortBy, setSortBy] = useState<'created_at' | 'updated_at' | 'title'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingExperiment, setEditingExperiment] = useState<Experiment | null>(null)
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null)

  // Form state for creating/editing experiments
  const [formData, setFormData] = useState({
    title: '',
    hypothesis: '',
    methodology: '',
    results: '',
    conclusion: '',
    outcome: null as ExperimentOutcome | null,
    asset_ids: [] as string[],
    tags: [] as string[]
  })

  useEffect(() => {
    loadExperiments()
  }, [])

  useEffect(() => {
    filterExperiments()
  }, [experiments, searchQuery, selectedOutcome, sortBy, sortOrder])

  const loadExperiments = async () => {
    try {
      const response = await fetch('/api/experiments')
      const data = await response.json()
      if (data.success) {
        setExperiments(data.data)
      }
    } catch (error) {
      console.error('Error loading experiments:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterExperiments = () => {
    let filtered = [...experiments]

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(experiment =>
        experiment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        experiment.hypothesis.toLowerCase().includes(searchQuery.toLowerCase()) ||
        experiment.methodology?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        experiment.results?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        experiment.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    // Outcome filter
    if (selectedOutcome !== 'all') {
      filtered = filtered.filter(experiment => experiment.outcome === selectedOutcome)
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal
      switch (sortBy) {
        case 'title':
          aVal = a.title
          bVal = b.title
          break
        case 'updated_at':
          aVal = new Date(a.updated_at).getTime()
          bVal = new Date(b.updated_at).getTime()
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

    setFilteredExperiments(filtered)
  }

  const handleCreateExperiment = async () => {
    try {
      const response = await fetch('/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setIsCreateModalOpen(false)
        resetForm()
        loadExperiments()
      }
    } catch (error) {
      console.error('Error creating experiment:', error)
    }
  }

  const handleUpdateExperiment = async () => {
    if (!editingExperiment) return

    try {
      const response = await fetch(`/api/experiments/${editingExperiment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setEditingExperiment(null)
        resetForm()
        loadExperiments()
      }
    } catch (error) {
      console.error('Error updating experiment:', error)
    }
  }

  const handleDeleteExperiment = async (experimentId: string) => {
    if (!confirm('Are you sure you want to delete this experiment?')) return

    try {
      const response = await fetch(`/api/experiments/${experimentId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        loadExperiments()
      }
    } catch (error) {
      console.error('Error deleting experiment:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      hypothesis: '',
      methodology: '',
      results: '',
      conclusion: '',
      outcome: null,
      asset_ids: [],
      tags: []
    })
  }

  const openEditModal = (experiment: Experiment) => {
    setFormData({
      title: experiment.title,
      hypothesis: experiment.hypothesis,
      methodology: experiment.methodology || '',
      results: experiment.results || '',
      conclusion: experiment.conclusion || '',
      outcome: experiment.outcome,
      asset_ids: experiment.asset_ids || [],
      tags: experiment.tags || []
    })
    setEditingExperiment(experiment)
  }

  const getOutcomeIcon = (outcome: ExperimentOutcome | null) => {
    switch (outcome) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'partial':
        return <AlertCircle className="w-4 h-4 text-yellow-400" />
      case 'failure':
        return <XCircle className="w-4 h-4 text-red-400" />
      default:
        return <FlaskConical className="w-4 h-4 text-gray-400" />
    }
  }

  const getOutcomeColor = (outcome: ExperimentOutcome | null) => {
    switch (outcome) {
      case 'success':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'partial':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'failure':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const outcomeOptions = [
    { value: 'all', label: 'All Outcomes' },
    { value: 'success', label: 'Success' },
    { value: 'partial', label: 'Partial Success' },
    { value: 'failure', label: 'Failure' }
  ]

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
            <h1 className="text-3xl font-bold text-white">Experiments</h1>
            <p className="text-gray-400 mt-1">
              Document your AI experiments and learnings for future reference
            </p>
          </div>
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-binary-orange hover:bg-binary-orange/90">
                <Plus className="w-4 h-4 mr-2" />
                New Experiment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto bg-gray-800 border-gray-700 text-white">
              <DialogHeader>
                <DialogTitle>{editingExperiment ? 'Edit Experiment' : 'Document New Experiment'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Experiment title..."
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="bg-gray-700 border-gray-600 text-white"
                />
                <Textarea
                  placeholder="What is your hypothesis?"
                  value={formData.hypothesis}
                  onChange={(e) => setFormData(prev => ({ ...prev, hypothesis: e.target.value }))}
                  className="bg-gray-700 border-gray-600 text-white"
                  rows={3}
                />
                <Textarea
                  placeholder="Describe your methodology..."
                  value={formData.methodology}
                  onChange={(e) => setFormData(prev => ({ ...prev, methodology: e.target.value }))}
                  className="bg-gray-700 border-gray-600 text-white"
                  rows={4}
                />
                <Textarea
                  placeholder="What were the results?"
                  value={formData.results}
                  onChange={(e) => setFormData(prev => ({ ...prev, results: e.target.value }))}
                  className="bg-gray-700 border-gray-600 text-white"
                  rows={4}
                />
                <Textarea
                  placeholder="What conclusions can you draw?"
                  value={formData.conclusion}
                  onChange={(e) => setFormData(prev => ({ ...prev, conclusion: e.target.value }))}
                  className="bg-gray-700 border-gray-600 text-white"
                  rows={3}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Select value={formData.outcome || ''} onValueChange={(value: ExperimentOutcome) => setFormData(prev => ({ ...prev, outcome: value }))}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue placeholder="Select outcome" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-700 border-gray-600">
                      {outcomeOptions.slice(1).map(option => (
                        <SelectItem key={option.value} value={option.value} className="text-white hover:bg-gray-600">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Tags (comma-separated)..."
                    value={formData.tags.join(', ')}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                    }))}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => {
                    setIsCreateModalOpen(false)
                    setEditingExperiment(null)
                    resetForm()
                  }}>
                    Cancel
                  </Button>
                  <Button
                    onClick={editingExperiment ? handleUpdateExperiment : handleCreateExperiment}
                    className="bg-binary-orange hover:bg-binary-orange/90"
                  >
                    {editingExperiment ? 'Update' : 'Create'}
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
                placeholder="Search experiments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              />
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Select value={selectedOutcome} onValueChange={(value: ExperimentOutcome | 'all') => setSelectedOutcome(value)}>
              <SelectTrigger className="w-40 bg-gray-700 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                {outcomeOptions.map(option => (
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
                <SelectItem value="title" className="text-white hover:bg-gray-600">Title</SelectItem>
                <SelectItem value="updated_at" className="text-white hover:bg-gray-600">Updated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Experiments Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredExperiments.map(experiment => (
            <Card key={experiment.id} className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-white text-lg mb-2 line-clamp-2">
                      {experiment.title}
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      {experiment.outcome && (
                        <Badge variant="outline" className={getOutcomeColor(experiment.outcome)}>
                          {getOutcomeIcon(experiment.outcome)}
                          <span className="ml-1 capitalize">{experiment.outcome}</span>
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Hypothesis */}
                <div>
                  <div className="flex items-center mb-2">
                    <Target className="w-4 h-4 text-binary-orange mr-2" />
                    <span className="text-sm font-medium text-white">Hypothesis</span>
                  </div>
                  <p className="text-sm text-gray-300 line-clamp-2">
                    {experiment.hypothesis}
                  </p>
                </div>

                {/* Quick Preview */}
                {experiment.results && (
                  <div>
                    <div className="flex items-center mb-2">
                      <BarChart3 className="w-4 h-4 text-green-400 mr-2" />
                      <span className="text-sm font-medium text-white">Results</span>
                    </div>
                    <p className="text-sm text-gray-300 line-clamp-2">
                      {experiment.results}
                    </p>
                  </div>
                )}

                {/* Tags */}
                {experiment.tags && experiment.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {experiment.tags.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs border-gray-600 text-gray-400">
                        {tag}
                      </Badge>
                    ))}
                    {experiment.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs border-gray-600 text-gray-400">
                        +{experiment.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Meta */}
                <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-700">
                  <span>
                    {formatDistanceToNow(new Date(experiment.created_at), { addSuffix: true })}
                  </span>
                  {experiment.asset_ids && experiment.asset_ids.length > 0 && (
                    <span>{experiment.asset_ids.length} assets</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedExperiment(experiment)}
                    className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    <Eye className="w-3 h-3 mr-2" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditModal(experiment)}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteExperiment(experiment.id)}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredExperiments.length === 0 && (
          <div className="text-center py-12">
            <FlaskConical className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Experiments Found</h3>
            <p className="text-gray-400 mb-4">
              {searchQuery || selectedOutcome !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Start documenting your AI experiments to track learnings'
              }
            </p>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-binary-orange hover:bg-binary-orange/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Document First Experiment
            </Button>
          </div>
        )}

        {/* Edit Modal */}
        <Dialog open={!!editingExperiment} onOpenChange={() => setEditingExperiment(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto bg-gray-800 border-gray-700 text-white">
            <DialogHeader>
              <DialogTitle>Edit Experiment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Experiment title..."
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="bg-gray-700 border-gray-600 text-white"
              />
              <Textarea
                placeholder="What is your hypothesis?"
                value={formData.hypothesis}
                onChange={(e) => setFormData(prev => ({ ...prev, hypothesis: e.target.value }))}
                className="bg-gray-700 border-gray-600 text-white"
                rows={3}
              />
              <Textarea
                placeholder="Describe your methodology..."
                value={formData.methodology}
                onChange={(e) => setFormData(prev => ({ ...prev, methodology: e.target.value }))}
                className="bg-gray-700 border-gray-600 text-white"
                rows={4}
              />
              <Textarea
                placeholder="What were the results?"
                value={formData.results}
                onChange={(e) => setFormData(prev => ({ ...prev, results: e.target.value }))}
                className="bg-gray-700 border-gray-600 text-white"
                rows={4}
              />
              <Textarea
                placeholder="What conclusions can you draw?"
                value={formData.conclusion}
                onChange={(e) => setFormData(prev => ({ ...prev, conclusion: e.target.value }))}
                className="bg-gray-700 border-gray-600 text-white"
                rows={3}
              />
              <div className="grid grid-cols-2 gap-4">
                <Select value={formData.outcome || ''} onValueChange={(value: ExperimentOutcome) => setFormData(prev => ({ ...prev, outcome: value }))}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder="Select outcome" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    {outcomeOptions.slice(1).map(option => (
                      <SelectItem key={option.value} value={option.value} className="text-white hover:bg-gray-600">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Tags (comma-separated)..."
                  value={formData.tags.join(', ')}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                  }))}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => {
                  setEditingExperiment(null)
                  resetForm()
                }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateExperiment}
                  className="bg-binary-orange hover:bg-binary-orange/90"
                >
                  Update
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Experiment Modal */}
        <Dialog open={!!selectedExperiment} onOpenChange={() => setSelectedExperiment(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto bg-gray-800 border-gray-700 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl">{selectedExperiment?.title}</DialogTitle>
            </DialogHeader>
            {selectedExperiment && (
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-gray-700">
                  <TabsTrigger value="overview" className="data-[state=active]:bg-binary-orange">Overview</TabsTrigger>
                  <TabsTrigger value="methodology" className="data-[state=active]:bg-binary-orange">Method</TabsTrigger>
                  <TabsTrigger value="results" className="data-[state=active]:bg-binary-orange">Results</TabsTrigger>
                  <TabsTrigger value="conclusion" className="data-[state=active]:bg-binary-orange">Conclusion</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <Card className="bg-gray-700 border-gray-600">
                    <CardHeader>
                      <CardTitle className="flex items-center text-white">
                        <Target className="w-5 h-5 mr-2 text-binary-orange" />
                        Hypothesis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-300 whitespace-pre-wrap">{selectedExperiment.hypothesis}</p>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-gray-700 border-gray-600">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">Outcome</span>
                          {selectedExperiment.outcome && (
                            <Badge className={getOutcomeColor(selectedExperiment.outcome)}>
                              {getOutcomeIcon(selectedExperiment.outcome)}
                              <span className="ml-1 capitalize">{selectedExperiment.outcome}</span>
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gray-700 border-gray-600">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">Created</span>
                          <span className="text-sm text-white">
                            {formatDistanceToNow(new Date(selectedExperiment.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {selectedExperiment.tags && selectedExperiment.tags.length > 0 && (
                    <Card className="bg-gray-700 border-gray-600">
                      <CardHeader>
                        <CardTitle className="flex items-center text-white text-sm">
                          <Tag className="w-4 h-4 mr-2" />
                          Tags
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {selectedExperiment.tags.map(tag => (
                            <Badge key={tag} variant="outline" className="border-gray-600 text-gray-300">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="methodology" className="space-y-4">
                  <Card className="bg-gray-700 border-gray-600">
                    <CardHeader>
                      <CardTitle className="flex items-center text-white">
                        <Microscope className="w-5 h-5 mr-2 text-binary-orange" />
                        Methodology
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-300 whitespace-pre-wrap">
                        {selectedExperiment.methodology || 'No methodology documented'}
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="results" className="space-y-4">
                  <Card className="bg-gray-700 border-gray-600">
                    <CardHeader>
                      <CardTitle className="flex items-center text-white">
                        <BarChart3 className="w-5 h-5 mr-2 text-binary-orange" />
                        Results
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-300 whitespace-pre-wrap">
                        {selectedExperiment.results || 'No results documented'}
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="conclusion" className="space-y-4">
                  <Card className="bg-gray-700 border-gray-600">
                    <CardHeader>
                      <CardTitle className="flex items-center text-white">
                        <Lightbulb className="w-5 h-5 mr-2 text-binary-orange" />
                        Conclusion
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-300 whitespace-pre-wrap">
                        {selectedExperiment.conclusion || 'No conclusion documented'}
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}