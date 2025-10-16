'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard')
    } else if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <Card className="w-full max-w-md bg-gray-800 border-gray-700">
          <CardHeader className="text-center">
            <div className="mx-auto w-20 h-20 bg-binary-orange rounded-full flex items-center justify-center mb-4 animate-pulse">
              <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" />
              </svg>
            </div>
            <CardTitle className="text-2xl font-bold text-white">Binary Blender AI</CardTitle>
            <CardDescription className="text-gray-400">
              Loading...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-gray-800 border-gray-700">
        <CardHeader className="text-center">
          <div className="mx-auto w-24 h-24 bg-binary-orange rounded-full flex items-center justify-center mb-6">
            <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" />
            </svg>
          </div>
          <CardTitle className="text-3xl font-bold text-white mb-2">
            Binary Blender AI Platform
          </CardTitle>
          <CardDescription className="text-gray-300 text-lg">
            AI-powered toolkit for TAO Skool community members
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="space-y-3 text-gray-300">
            <p>🎨 Advanced Image Generation</p>
            <p>🎬 Professional Video Creation</p>
            <p>🎭 Realistic Lip Sync Technology</p>
            <p>💳 Credit-based system</p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => router.push('/auth/signin')}
              className="w-full bg-binary-orange hover:bg-binary-orange/90 text-white"
              size="lg"
            >
              Get Started
            </Button>

            <p className="text-sm text-gray-400">
              Exclusive access for TAO Skool members
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}