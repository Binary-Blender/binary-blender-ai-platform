'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  FolderOpen,
  Folder,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Archive,
  ChevronRight,
  ChevronDown
} from 'lucide-react'
import { Project, Folder as FolderType } from '@/lib/types/asset-repository'

interface ProjectBrowserProps {
  projects: Project[]
  selectedProject: Project | null
  onSelectProject: (project: Project) => void
  currentFolder: FolderType | null
  onSelectFolder: (folder: FolderType | null) => void
}

interface ProjectWithFolders extends Project {
  folders?: FolderType[]
  expanded?: boolean
}

export default function ProjectBrowser({
  projects,
  selectedProject,
  onSelectProject,
  currentFolder,
  onSelectFolder
}: ProjectBrowserProps) {
  const [projectsWithFolders, setProjectsWithFolders] = useState<ProjectWithFolders[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setProjectsWithFolders(
      projects.map(project => ({
        ...project,
        folders: [],
        expanded: project.id === selectedProject?.id
      }))
    )
  }, [projects, selectedProject])

  useEffect(() => {
    if (selectedProject) {
      loadProjectFolders(selectedProject.id)
    }
  }, [selectedProject])

  const loadProjectFolders = async (projectId: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/folders?project_id=${projectId}`)
      const data = await response.json()

      if (data.success) {
        setProjectsWithFolders(prev =>
          prev.map(project =>
            project.id === projectId
              ? { ...project, folders: data.data, expanded: true }
              : project
          )
        )
      }
    } catch (error) {
      console.error('Error loading folders:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleProjectExpansion = (projectId: string) => {
    setProjectsWithFolders(prev =>
      prev.map(project =>
        project.id === projectId
          ? { ...project, expanded: !project.expanded }
          : project
      )
    )
  }

  const filteredProjects = projectsWithFolders.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const FolderTree = ({ folders, parentId = null, level = 0 }: {
    folders: FolderType[],
    parentId?: string | null,
    level?: number
  }) => {
    const foldersAtLevel = folders.filter(folder => folder.parent_folder_id === parentId)

    return (
      <div className={`space-y-1 ${level > 0 ? 'ml-4' : ''}`}>
        {foldersAtLevel.map(folder => (
          <div key={folder.id}>
            <div
              className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${
                currentFolder?.id === folder.id
                  ? 'bg-binary-orange/20 text-binary-orange'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
              onClick={() => onSelectFolder(folder)}
            >
              <Folder className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="text-sm truncate flex-1">{folder.name}</span>
              {folder.color && (
                <div
                  className="w-2 h-2 rounded-full ml-2 flex-shrink-0"
                  style={{ backgroundColor: folder.color }}
                />
              )}
            </div>
            <FolderTree folders={folders} parentId={folder.id} level={level + 1} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Projects</h2>
          <Button
            size="sm"
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400 text-sm"
          />
        </div>
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {filteredProjects.map(project => (
          <Card
            key={project.id}
            className={`border transition-all duration-200 cursor-pointer ${
              selectedProject?.id === project.id
                ? 'border-binary-orange bg-binary-orange/10'
                : 'border-gray-700 bg-gray-800 hover:border-gray-600'
            }`}
          >
            <CardHeader className="p-3 pb-2">
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center flex-1 min-w-0"
                  onClick={() => onSelectProject(project)}
                >
                  <div
                    className="w-3 h-3 rounded-full mr-3 flex-shrink-0"
                    style={{ backgroundColor: project.color || '#6366f1' }}
                  />
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-medium text-white truncate">
                      {project.name}
                    </CardTitle>
                    {project.description && (
                      <p className="text-xs text-gray-400 truncate mt-1">
                        {project.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-1 ml-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleProjectExpansion(project.id)
                    }}
                    className="w-6 h-6 p-0 text-gray-400 hover:text-white"
                  >
                    {project.expanded ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-6 h-6 p-0 text-gray-400 hover:text-white"
                  >
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {project.expanded && (
              <CardContent className="p-3 pt-0">
                {/* Project Stats */}
                <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                  <span>{project.asset_count || 0} assets</span>
                  <span>{new Date(project.created_at).toLocaleDateString()}</span>
                </div>

                {/* Folders */}
                <div className="space-y-1">
                  {/* Root folder option */}
                  <div
                    className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${
                      !currentFolder && selectedProject?.id === project.id
                        ? 'bg-binary-orange/20 text-binary-orange'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                    onClick={() => onSelectFolder(null)}
                  >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    <span className="text-sm">All Assets</span>
                  </div>

                  {/* Folder tree */}
                  {project.folders && project.folders.length > 0 && (
                    <FolderTree folders={project.folders} />
                  )}

                  {/* Add folder button */}
                  <div
                    className="flex items-center p-2 rounded-lg cursor-pointer text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    <span className="text-sm">Add Folder</span>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}

        {filteredProjects.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No projects found</p>
            {searchTerm && (
              <p className="text-xs mt-1">Try a different search term</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}