'use client'

import { ReactNode, useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Menu,
  X,
  Home,
  Image,
  Video,
  Mic,
  User,
  CreditCard,
  History,
  Settings,
  LogOut,
  Coins,
  FolderOpen,
  FileText,
  FlaskConical,
} from 'lucide-react'

interface DashboardLayoutProps {
  children: ReactNode
}

const navigationItems = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Image Generator', href: '/image', icon: Image },
  { name: 'Video Generator', href: '/video', icon: Video },
  { name: 'Lip Sync', href: '/lipsync', icon: Mic },
  { name: 'Assets', href: '/assets', icon: FolderOpen },
  { name: 'Prompts', href: '/prompts', icon: FileText },
  { name: 'Experiments', href: '/experiments', icon: FlaskConical },
  { name: 'History', href: '/history', icon: History },
  { name: 'Profile', href: '/profile', icon: User },
  { name: 'Credits', href: '/credits', icon: CreditCard },
]

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  console.log('DashboardLayout: status=', status, 'session=', session)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  if (status === 'loading') {
    console.log('DashboardLayout: Showing loading spinner')
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-binary-orange"></div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth/signin' })
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-gray-800 border-r border-gray-700">
          {/* Logo */}
          <div className="flex items-center h-16 px-6 bg-gray-900">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-binary-orange rounded-full flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-white">Binary AI</span>
            </div>
          </div>

          {/* Credits Display */}
          <div className="px-6 py-4 border-b border-gray-700">
            <Card className="bg-gray-700 border-gray-600 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Coins className="w-4 h-4 text-binary-orange mr-2" />
                  <span className="text-sm text-gray-300">Credits</span>
                </div>
                <span className="text-lg font-bold text-binary-orange">
                  {session?.user ? '100' : '0'} {/* TODO: Get from database */}
                </span>
              </div>
            </Card>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-binary-orange text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* User Menu */}
          <div className="px-4 py-6 border-t border-gray-700">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center mr-3">
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <User className="w-5 h-5 text-gray-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {session?.user?.name || 'User'}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {session?.user?.email}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Link
                href="/settings"
                className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4 mr-3" />
                Settings
              </Link>
              <button
                onClick={handleSignOut}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4 mr-3" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu Button */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between h-16 px-4 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-binary-orange rounded-full flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">Binary AI</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-gray-300 hover:text-white hover:bg-gray-700"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setIsMobileMenuOpen(false)} />
            <div className="fixed top-0 left-0 w-64 h-full bg-gray-800 border-r border-gray-700">
              {/* Mobile navigation content - similar to desktop sidebar */}
              <div className="flex flex-col h-full">
                <div className="flex items-center h-16 px-6 bg-gray-900 border-b border-gray-700">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-binary-orange rounded-full flex items-center justify-center mr-3">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" />
                      </svg>
                    </div>
                    <span className="text-xl font-bold text-white">Binary AI</span>
                  </div>
                </div>

                <div className="px-6 py-4 border-b border-gray-700">
                  <Card className="bg-gray-700 border-gray-600 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Coins className="w-4 h-4 text-binary-orange mr-2" />
                        <span className="text-sm text-gray-300">Credits</span>
                      </div>
                      <span className="text-lg font-bold text-binary-orange">100</span>
                    </div>
                  </Card>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-2">
                  {navigationItems.map((item) => {
                    const isActive = pathname === item.href
                    const Icon = item.icon

                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                          isActive
                            ? 'bg-binary-orange text-white'
                            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                        }`}
                      >
                        <Icon className="w-5 h-5 mr-3" />
                        {item.name}
                      </Link>
                    )
                  })}
                </nav>

                <div className="px-4 py-6 border-t border-gray-700">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center mr-3">
                      {session?.user?.image ? (
                        <img
                          src={session.user.image}
                          alt={session.user.name || 'User'}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <User className="w-5 h-5 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {session?.user?.name || 'User'}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {session?.user?.email}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Link
                      href="/settings"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg transition-colors"
                    >
                      <Settings className="w-4 h-4 mr-3" />
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false)
                        handleSignOut()
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4 mr-3" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}