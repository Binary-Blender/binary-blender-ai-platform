'use client'

import { useSession } from 'next-auth/react'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Image,
  Video,
  Mic,
  TrendingUp,
  Clock,
  Star,
  ArrowRight,
  Zap
} from 'lucide-react'
import Link from 'next/link'

const toolCards = [
  {
    name: 'Image Generator',
    description: 'Create stunning images from text prompts',
    icon: Image,
    href: '/image',
    color: 'bg-purple-500',
    cost: '1-2 credits',
    features: ['Text to Image', 'Image to Image', 'Multiple styles', 'HD output'],
  },
  {
    name: 'Video Generator',
    description: 'Transform images into dynamic videos',
    icon: Video,
    href: '/video',
    color: 'bg-blue-500',
    cost: '10-20 credits',
    features: ['Text to Video', 'Image to Video', 'Motion control', 'HD quality'],
  },
  {
    name: 'Lip Sync',
    description: 'Sync lips to any audio track perfectly',
    icon: Mic,
    href: '/lipsync',
    color: 'bg-green-500',
    cost: '5-8 credits',
    features: ['Audio sync', 'High quality', 'Fast processing', 'Multiple formats'],
  },
]

const recentGenerations = [
  {
    id: '1',
    type: 'image',
    title: 'Cyberpunk cityscape',
    status: 'completed',
    createdAt: '2 hours ago',
    thumbnail: '/placeholder-image.jpg',
  },
  {
    id: '2',
    type: 'video',
    title: 'Dancing character animation',
    status: 'processing',
    createdAt: '5 minutes ago',
    thumbnail: '/placeholder-video.jpg',
  },
  {
    id: '3',
    type: 'lipsync',
    title: 'Product presentation sync',
    status: 'completed',
    createdAt: '1 day ago',
    thumbnail: '/placeholder-lipsync.jpg',
  },
]

const featuredPresets = [
  {
    name: 'Portrait Photo',
    type: 'image',
    description: 'Professional portrait style',
    usageCount: 234,
  },
  {
    name: 'Cinematic Video',
    type: 'video',
    description: 'Movie-like video generation',
    usageCount: 156,
  },
  {
    name: 'Product Demo',
    type: 'lipsync',
    description: 'Perfect for product presentations',
    usageCount: 89,
  },
]

export default function DashboardPage() {
  const { data: session } = useSession()

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back, {session?.user?.name || 'Creator'}!
          </h1>
          <p className="text-gray-400 text-lg">
            Ready to create something amazing with AI? Choose your tool below.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-binary-orange/20 rounded-lg">
                  <Zap className="w-6 h-6 text-binary-orange" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-400">Credits Remaining</p>
                  <p className="text-2xl font-bold text-white">100</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-400">Generations This Month</p>
                  <p className="text-2xl font-bold text-white">24</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Clock className="w-6 h-6 text-blue-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-400">Processing Time Saved</p>
                  <p className="text-2xl font-bold text-white">12h</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Star className="w-6 h-6 text-purple-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-400">Membership Tier</p>
                  <p className="text-2xl font-bold text-white">Premium</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Tools */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">AI Tools</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {toolCards.map((tool) => {
              const Icon = tool.icon
              return (
                <Card key={tool.name} className="bg-gray-800 border-gray-700 hover:border-binary-orange/50 transition-all duration-300 group">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className={`p-3 ${tool.color} rounded-lg`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
                        {tool.cost}
                      </span>
                    </div>
                    <CardTitle className="text-white">{tool.name}</CardTitle>
                    <CardDescription className="text-gray-400">
                      {tool.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 mb-6">
                      {tool.features.map((feature, index) => (
                        <div key={index} className="flex items-center text-sm text-gray-300">
                          <div className="w-1.5 h-1.5 bg-binary-orange rounded-full mr-3" />
                          {feature}
                        </div>
                      ))}
                    </div>
                    <Link href={tool.href}>
                      <Button className="w-full bg-binary-orange hover:bg-binary-orange/90 text-white group-hover:bg-binary-orange/80">
                        Get Started
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Generations */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Recent Generations</h2>
              <Link href="/history">
                <Button variant="ghost" className="text-binary-orange hover:text-binary-orange/80">
                  View All
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
            <div className="space-y-4">
              {recentGenerations.map((item) => (
                <Card key={item.id} className="bg-gray-800 border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                        {item.type === 'image' && <Image className="w-6 h-6 text-gray-400" />}
                        {item.type === 'video' && <Video className="w-6 h-6 text-gray-400" />}
                        {item.type === 'lipsync' && <Mic className="w-6 h-6 text-gray-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {item.title}
                        </p>
                        <p className="text-sm text-gray-400">{item.createdAt}</p>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs ${
                        item.status === 'completed'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {item.status}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Featured Presets */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Featured Presets</h2>
              <Button variant="ghost" className="text-binary-orange hover:text-binary-orange/80">
                Browse All
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
            <div className="space-y-4">
              {featuredPresets.map((preset, index) => (
                <Card key={index} className="bg-gray-800 border-gray-700 hover:border-binary-orange/50 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white">{preset.name}</p>
                        <p className="text-sm text-gray-400">{preset.description}</p>
                      </div>
                      <div className="flex items-center text-sm text-gray-400">
                        <Star className="w-4 h-4 mr-1" />
                        {preset.usageCount}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* TAO Quote */}
        <Card className="mt-8 bg-gradient-to-r from-binary-orange/10 to-binary-blue/10 border-binary-orange/20">
          <CardContent className="p-8 text-center">
            <p className="text-xl text-white mb-4 italic">
              "The way that can be spoken of is not the constant way"
            </p>
            <p className="text-gray-400">
              - Tao Te Ching, embracing the power of AI orchestration
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}