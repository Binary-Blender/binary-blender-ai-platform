'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface CreateProjectModalProps {
  open: boolean
  onClose: () => void
  onProjectCreated: () => void
}

const colorOptions = [
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Yellow', value: '#eab308' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Teal', value: '#14b8a6' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Gray', value: '#6b7280' },
]

export default function CreateProjectModal({
  open,
  onClose,
  onProjectCreated
}: CreateProjectModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#6366f1'
  })
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Project name is required',
        variant: 'destructive'
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          color: formData.color
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Project created successfully',
        })

        // Reset form
        setFormData({
          name: '',
          description: '',
          color: '#6366f1'
        })

        onProjectCreated()
        onClose()
      } else {
        toast({
          title: 'Error',
          description: data.error?.message || 'Failed to create project',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error creating project:', error)
      toast({
        title: 'Error',
        description: 'Failed to create project',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white">Create New Project</DialogTitle>
          <DialogDescription className="text-gray-400">
            Create a new project to organize your AI-generated assets.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-white">
              Project Name *
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter project name..."
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              disabled={isLoading}
              maxLength={255}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-white">
              Description
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Optional project description..."
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 min-h-[80px]"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-white">Project Color</Label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                  className={`w-8 h-8 rounded-full border-2 ${
                    formData.color === color.value
                      ? 'border-white border-2'
                      : 'border-gray-600'
                  }`}
                  style={{ backgroundColor: color.value }}
                  disabled={isLoading}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.name.trim()}
              className="bg-binary-orange hover:bg-binary-orange/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}