'use client'

import { useState } from 'react'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Download, Sparkles } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4'
type Model = 'flux-pro' | 'flux-dev' | 'sdxl'

interface GenerationResult {
  id: string
  output: string[]
  status: string
}

export default function ImageGeneratorPage() {
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1')
  const [model, setModel] = useState<Model>('flux-pro')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const { toast } = useToast()

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a prompt',
        variant: 'destructive',
      })
      return
    }

    setIsGenerating(true)
    setGeneratedImages([])

    try {
      const response = await fetch('/api/generate/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          aspectRatio,
          model,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate image')
      }

      const data: GenerationResult = await response.json()

      if (data.output && data.output.length > 0) {
        setGeneratedImages(data.output)
        toast({
          title: 'Success!',
          description: 'Your image has been generated',
        })
      }
    } catch (error) {
      console.error('Generation error:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate image',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = async (imageUrl: string, index: number) => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `generated-image-${index + 1}.png`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download image',
        variant: 'destructive',
      })
    }
  }

  const aspectRatioOptions = [
    { value: '1:1', label: 'Square (1:1)' },
    { value: '16:9', label: 'Landscape (16:9)' },
    { value: '9:16', label: 'Portrait (9:16)' },
    { value: '4:3', label: 'Standard (4:3)' },
    { value: '3:4', label: 'Portrait (3:4)' },
  ]

  const modelOptions = [
    { value: 'flux-pro', label: 'Flux Pro (Fast, High Quality)' },
    { value: 'flux-dev', label: 'Flux Dev (Experimental)' },
    { value: 'sdxl', label: 'SDXL (Versatile)' },
  ]

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Image Generator</h1>
          <p className="text-gray-400 text-lg">
            Create stunning images from text prompts using AI
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Generation Settings</CardTitle>
                <CardDescription className="text-gray-400">
                  Configure your image generation parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="prompt" className="text-white">Prompt</Label>
                  <Input
                    id="prompt"
                    placeholder="Describe the image you want to create..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
                    disabled={isGenerating}
                  />
                  <p className="text-xs text-gray-500">
                    Be specific and descriptive for best results
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model" className="text-white">Model</Label>
                  <Select value={model} onValueChange={(value) => setModel(value as Model)} disabled={isGenerating}>
                    <SelectTrigger id="model" className="bg-gray-900 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700">
                      {modelOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="text-white">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="aspectRatio" className="text-white">Aspect Ratio</Label>
                  <Select value={aspectRatio} onValueChange={(value) => setAspectRatio(value as AspectRatio)} disabled={isGenerating}>
                    <SelectTrigger id="aspectRatio" className="bg-gray-900 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700">
                      {aspectRatioOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="text-white">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt.trim()}
                    className="w-full bg-binary-orange hover:bg-binary-orange/90 text-white"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Image
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    Cost: 1-2 credits per generation
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700 mt-6">
              <CardHeader>
                <CardTitle className="text-white text-sm">Pro Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-gray-400">
                <div className="flex items-start">
                  <div className="w-1.5 h-1.5 bg-binary-orange rounded-full mr-3 mt-2" />
                  <p>Use descriptive adjectives (e.g., "vibrant", "photorealistic", "detailed")</p>
                </div>
                <div className="flex items-start">
                  <div className="w-1.5 h-1.5 bg-binary-orange rounded-full mr-3 mt-2" />
                  <p>Specify the style (e.g., "digital art", "oil painting", "3D render")</p>
                </div>
                <div className="flex items-start">
                  <div className="w-1.5 h-1.5 bg-binary-orange rounded-full mr-3 mt-2" />
                  <p>Include lighting details (e.g., "soft lighting", "golden hour", "dramatic shadows")</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Generated Images</CardTitle>
                <CardDescription className="text-gray-400">
                  Your AI-generated images will appear here
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isGenerating ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Loader2 className="w-12 h-12 text-binary-orange animate-spin" />
                    <p className="text-gray-400">Creating your masterpiece...</p>
                    <p className="text-xs text-gray-500">This may take 10-30 seconds</p>
                  </div>
                ) : generatedImages.length > 0 ? (
                  <div className="space-y-4">
                    {generatedImages.map((imageUrl, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={imageUrl}
                          alt={`Generated image ${index + 1}`}
                          className="w-full rounded-lg"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <Button
                            onClick={() => handleDownload(imageUrl, index)}
                            className="bg-binary-orange hover:bg-binary-orange/90 text-white"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Sparkles className="w-12 h-12 text-gray-600 mb-4" />
                    <p className="text-gray-400 mb-2">No images generated yet</p>
                    <p className="text-sm text-gray-500">
                      Enter a prompt and click Generate to create your first image
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
