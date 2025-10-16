'use client'

import { useState, useRef } from 'react'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Download, Video as VideoIcon, Image as ImageIcon, Music, Upload } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface GenerationResult {
  id: string
  output: string
  status: string
}

export default function LipsyncPage() {
  const [imageUrl, setImageUrl] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isUploadingAudio, setIsUploadingAudio] = useState(false)
  const [generatedVideo, setGeneratedVideo] = useState<string>('')
  const [imagePreview, setImagePreview] = useState<string>('')
  const imageInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Please upload an image file',
        variant: 'destructive',
      })
      return
    }

    setIsUploadingImage(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to upload image')
      }

      const data = await response.json()
      setImageUrl(data.url)
      setImagePreview(data.url)

      toast({
        title: 'Success',
        description: 'Image uploaded successfully',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to upload image',
        variant: 'destructive',
      })
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('audio/')) {
      toast({
        title: 'Error',
        description: 'Please upload an audio file',
        variant: 'destructive',
      })
      return
    }

    setIsUploadingAudio(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to upload audio')
      }

      const data = await response.json()
      setAudioUrl(data.url)

      toast({
        title: 'Success',
        description: 'Audio uploaded successfully',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to upload audio',
        variant: 'destructive',
      })
    } finally {
      setIsUploadingAudio(false)
    }
  }

  const handleGenerate = async () => {
    if (!imageUrl.trim() || !audioUrl.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide both image and audio',
        variant: 'destructive',
      })
      return
    }

    setIsGenerating(true)
    setGeneratedVideo('')

    try {
      const response = await fetch('/api/generate/lipsync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          audioUrl,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate lip sync')
      }

      const data: GenerationResult = await response.json()

      if (data.output) {
        setGeneratedVideo(data.output)
        toast({
          title: 'Success!',
          description: 'Your lip sync video has been generated',
        })
      }
    } catch (error) {
      console.error('Generation error:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate lip sync',
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
      a.download = `lipsync-video-${Date.now()}.mp4`
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

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Lip Sync Generator</h1>
          <p className="text-gray-400 text-lg">
            Animate a photo with audio to create realistic talking videos
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Generation Settings</CardTitle>
                <CardDescription className="text-gray-400">
                  Upload or provide URLs for image and audio files
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="imageUrl" className="text-white flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Image
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="imageUrl"
                      placeholder="https://example.com/image.jpg or upload below"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
                      disabled={isGenerating || isUploadingImage}
                    />
                    <Button
                      onClick={() => imageInputRef.current?.click()}
                      disabled={isGenerating || isUploadingImage}
                      variant="outline"
                      className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                    >
                      {isUploadingImage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                    </Button>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                  {imagePreview && (
                    <div className="mt-2">
                      <img src={imagePreview} alt="Preview" className="w-32 h-32 object-cover rounded" />
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    Clear, front-facing photo with visible face and mouth
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="audioUrl" className="text-white flex items-center gap-2">
                    <Music className="w-4 h-4" />
                    Audio
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="audioUrl"
                      placeholder="https://example.com/audio.mp3 or upload below"
                      value={audioUrl}
                      onChange={(e) => setAudioUrl(e.target.value)}
                      className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
                      disabled={isGenerating || isUploadingAudio}
                    />
                    <Button
                      onClick={() => audioInputRef.current?.click()}
                      disabled={isGenerating || isUploadingAudio}
                      variant="outline"
                      className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                    >
                      {isUploadingAudio ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                    </Button>
                    <input
                      ref={audioInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioUpload}
                      className="hidden"
                    />
                  </div>
                  {audioUrl && audioUrl.startsWith('data:') && (
                    <div className="mt-2">
                      <audio controls className="w-full">
                        <source src={audioUrl} />
                      </audio>
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    MP3, WAV, or other audio formats
                  </p>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || !imageUrl.trim() || !audioUrl.trim()}
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
                        Generate Lip Sync
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    Cost: 5 credits per generation (takes 30-60 seconds)
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
                  <p>Use a clear, front-facing image with visible mouth</p>
                </div>
                <div className="flex items-start">
                  <div className="w-1.5 h-1.5 bg-binary-orange rounded-full mr-3 mt-2" />
                  <p>Audio quality affects the final result quality</p>
                </div>
                <div className="flex items-start">
                  <div className="w-1.5 h-1.5 bg-binary-orange rounded-full mr-3 mt-2" />
                  <p>Works best with speech and vocals</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Generated Video</CardTitle>
                <CardDescription className="text-gray-400">
                  Your lip sync video will appear here
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isGenerating ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Loader2 className="w-12 h-12 text-binary-orange animate-spin" />
                    <p className="text-gray-400">Creating your lip sync video...</p>
                    <p className="text-xs text-gray-500">This may take 30-60 seconds</p>
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
                      Upload or provide URLs for image and audio, then click Generate
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
