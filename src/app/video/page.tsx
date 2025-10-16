'use client'

import { useState } from 'react'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Download, Video as VideoIcon, Upload } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

type Model = 'gen3-alpha-turbo' | 'gen3-alpha'

interface GenerationResult {
  id: string
  output: string
  status: string
}

export default function VideoGeneratorPage() {
  const [prompt, setPrompt] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [model, setModel] = useState<Model>('gen3-alpha-turbo')
  const [duration, setDuration] = useState('5')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedVideo, setGeneratedVideo] = useState<string>('')
  const { toast } = useToast()

  const handleGenerate = async () => {
    if (!prompt.trim() && !imageUrl.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a prompt or provide an image URL',
        variant: 'destructive',
      })
      return
    }

    setIsGenerating(true)
    setGeneratedVideo('')

    try {
      const response = await fetch('/api/generate/video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          imageUrl: imageUrl || undefined,
          model,
          duration: parseInt(duration),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate video')
      }

      const data: GenerationResult = await response.json()

      if (data.output) {
        setGeneratedVideo(data.output)
        toast({
          title: 'Success!',
          description: 'Your video has been generated',
        })
      }
    } catch (error) {
      console.error('Generation error:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate video',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = async (videoUrl: string) => {
    try {
      const response = await fetch(videoUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `generated-video-${Date.now()}.mp4`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download video',
        variant: 'destructive',
      })
    }
  }

  const modelOptions = [
    { value: 'gen3-alpha-turbo', label: 'Gen-3 Alpha Turbo (5-10s)' },
  ]

  const durationOptions = [
    { value: '5', label: '5 seconds' },
    { value: '10', label: '10 seconds' },
  ]

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Video Generator</h1>
          <p className="text-gray-400 text-lg">
            Create stunning videos from text prompts or images using RunwayML
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Generation Settings</CardTitle>
                <CardDescription className="text-gray-400">
                  Configure your video generation parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="prompt" className="text-white">Prompt</Label>
                  <Input
                    id="prompt"
                    placeholder="Describe the video you want to create..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
                    disabled={isGenerating}
                  />
                  <p className="text-xs text-gray-500">
                    Describe the motion, scene, and action
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="imageUrl" className="text-white flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Image URL (Optional)
                  </Label>
                  <Input
                    id="imageUrl"
                    placeholder="https://example.com/image.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
                    disabled={isGenerating}
                  />
                  <p className="text-xs text-gray-500">
                    Provide an image to animate (Image-to-Video)
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
                  <Label htmlFor="duration" className="text-white">Duration</Label>
                  <Select value={duration} onValueChange={setDuration} disabled={isGenerating}>
                    <SelectTrigger id="duration" className="bg-gray-900 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700">
                      {durationOptions.map((option) => (
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
                    disabled={isGenerating || (!prompt.trim() && !imageUrl.trim())}
                    className="w-full bg-binary-orange hover:bg-binary-orange/90 text-white"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <VideoIcon className="w-4 h-4 mr-2" />
                        Generate Video
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    Cost: 10-20 credits per generation (takes 60-120 seconds)
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
                  <p>For image-to-video: provide a clear image URL and describe the motion</p>
                </div>
                <div className="flex items-start">
                  <div className="w-1.5 h-1.5 bg-binary-orange rounded-full mr-3 mt-2" />
                  <p>For text-to-video: be specific about camera movement and action</p>
                </div>
                <div className="flex items-start">
                  <div className="w-1.5 h-1.5 bg-binary-orange rounded-full mr-3 mt-2" />
                  <p>Gen-3 Turbo is faster, Gen-3 Alpha has better quality</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Generated Video</CardTitle>
                <CardDescription className="text-gray-400">
                  Your AI-generated video will appear here
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isGenerating ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Loader2 className="w-12 h-12 text-binary-orange animate-spin" />
                    <p className="text-gray-400">Creating your video...</p>
                    <p className="text-xs text-gray-500">This may take 60-120 seconds</p>
                  </div>
                ) : generatedVideo ? (
                  <div className="space-y-4">
                    <div className="relative group">
                      <video
                        src={generatedVideo}
                        controls
                        className="w-full rounded-lg"
                      />
                      <div className="mt-4 flex gap-2">
                        <Button
                          onClick={() => handleDownload(generatedVideo)}
                          className="flex-1 bg-binary-orange hover:bg-binary-orange/90 text-white"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download Video
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <VideoIcon className="w-12 h-12 text-gray-600 mb-4" />
                    <p className="text-gray-400 mb-2">No video generated yet</p>
                    <p className="text-sm text-gray-500">
                      Enter a prompt and click Generate to create your first video
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
