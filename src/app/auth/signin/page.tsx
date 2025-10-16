'use client'

import { signIn, getSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle } from 'lucide-react'

export default function SignInPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [devCredentials, setDevCredentials] = useState({
    email: 'chris@binary-blender.com',
    name: 'Chris Bender'
  })

  useEffect(() => {
    // Check if user is already signed in
    getSession().then(session => {
      if (session) {
        router.push('/dashboard')
      }
    })
  }, [router])

  const handleSkoolSignIn = async () => {
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn('skool', {
        callbackUrl: '/dashboard',
        redirect: false,
      })

      if (result?.error) {
        setError('Failed to sign in with Skool. Please try again.')
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDevSignIn = async () => {
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn('development', {
        email: devCredentials.email,
        name: devCredentials.name,
        callbackUrl: '/dashboard',
        redirect: false,
      })

      if (result?.error) {
        setError('Failed to sign in. Please try again.')
      } else if (result?.url) {
        router.push(result.url)
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-800 border-gray-700">
        <CardHeader className="text-center">
          <div className="mx-auto w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" />
            </svg>
          </div>
          <CardTitle className="text-2xl font-bold text-white">Binary Blender AI</CardTitle>
          <CardDescription className="text-gray-400">
            Sign in to access your AI toolkit
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          {/* Skool Sign In */}
          <Button
            onClick={handleSkoolSignIn}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? 'Signing in...' : 'Sign in with Skool'}
          </Button>

          {/* Development Sign In (only in dev mode) */}
          {process.env.NODE_ENV === 'development' && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-600" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-gray-800 px-2 text-gray-400">Development Only</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-gray-300">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={devCredentials.email}
                    onChange={(e) => setDevCredentials(prev => ({ ...prev, email: e.target.value }))}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="name" className="text-gray-300">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={devCredentials.name}
                    onChange={(e) => setDevCredentials(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <Button
                  onClick={handleDevSignIn}
                  disabled={isLoading}
                  variant="outline"
                  className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  {isLoading ? 'Signing in...' : 'Development Sign In'}
                </Button>
              </div>
            </>
          )}

          <div className="text-center text-sm text-gray-400">
            <p>Binary Blender AI Platform</p>
            <p>For TAO Skool community members</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}