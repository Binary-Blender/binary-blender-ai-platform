'use client'

import { ChevronRight, Home, Folder } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Project, Folder as FolderType } from '@/lib/types/asset-repository'

interface FolderNavigationProps {
  project: Project
  currentFolder: FolderType | null
  onNavigate: (folder: FolderType | null) => void
}

export default function FolderNavigation({
  project,
  currentFolder,
  onNavigate
}: FolderNavigationProps) {
  // Build breadcrumb path
  const buildBreadcrumbPath = () => {
    const path = []
    let folder = currentFolder

    // Add current folder and work backwards through parent folders
    while (folder) {
      path.unshift(folder)
      // Note: We'd need to fetch parent folder data to build complete path
      // For now, just show the current folder
      break
    }

    return path
  }

  const breadcrumbPath = buildBreadcrumbPath()

  return (
    <div className="flex items-center space-x-2 text-sm">
      {/* Project Root */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onNavigate(null)}
        className={`p-2 h-auto ${
          !currentFolder
            ? 'text-binary-orange bg-binary-orange/10'
            : 'text-gray-400 hover:text-white hover:bg-gray-700'
        }`}
      >
        <Home className="w-4 h-4 mr-1" />
        <span className="font-medium">{project.name}</span>
      </Button>

      {/* Breadcrumb Path */}
      {breadcrumbPath.map((folder, index) => (
        <div key={folder.id} className="flex items-center space-x-2">
          <ChevronRight className="w-4 h-4 text-gray-500" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate(folder)}
            className={`p-2 h-auto ${
              index === breadcrumbPath.length - 1
                ? 'text-binary-orange bg-binary-orange/10'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <Folder className="w-4 h-4 mr-1" />
            <span>{folder.name}</span>
          </Button>
        </div>
      ))}

      {/* Current folder indicator if we have a folder selected */}
      {currentFolder && breadcrumbPath.length === 0 && (
        <div className="flex items-center space-x-2">
          <ChevronRight className="w-4 h-4 text-gray-500" />
          <div className="flex items-center p-2 text-binary-orange bg-binary-orange/10 rounded">
            <Folder className="w-4 h-4 mr-1" />
            <span>{currentFolder.name}</span>
          </div>
        </div>
      )}
    </div>
  )
}