'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw
} from 'lucide-react'

interface MigrationResult {
  total: number
  migrated: number
  skipped: number
  failed: number
  details: Array<{
    assetId: string
    status: 'migrated' | 'skipped' | 'failed'
    reason?: string
    error?: string
    thumbnailUrl?: string
    fileUrl?: string
  }>
}

interface AssetMigrationPanelProps {
  onMigrationComplete?: () => void
}

export default function AssetMigrationPanel({ onMigrationComplete }: AssetMigrationPanelProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<MigrationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleMigrateAll = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/assets/migrate-to-s3', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ migrateAll: true }),
      })

      const data = await response.json()

      if (data.success) {
        setResult(data.data)
        if (onMigrationComplete) {
          onMigrationComplete()
        }
      } else {
        setError(data.error?.message || 'Migration failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'migrated':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'skipped':
        return <Clock className="w-4 h-4 text-yellow-400" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'migrated':
        return 'bg-green-500/20 text-green-400'
      case 'skipped':
        return 'bg-yellow-500/20 text-yellow-400'
      case 'failed':
        return 'bg-red-500/20 text-red-400'
      default:
        return 'bg-gray-500/20 text-gray-400'
    }
  }

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center text-white">
          <Upload className="w-5 h-5 mr-2" />
          Asset Migration to S3
        </CardTitle>
        <p className="text-sm text-gray-400">
          Migrate your assets from temporary URLs to permanent S3 storage
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {!result && !error && (
            <div className="flex items-center space-x-4">
              <Button
                onClick={handleMigrateAll}
                disabled={isLoading}
                className="bg-binary-orange hover:bg-binary-orange/80"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Migrating...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Migrate All Assets
                  </>
                )}
              </Button>
              <div className="text-sm text-gray-400">
                This will copy assets with expired URLs to your S3 bucket
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center space-x-2 p-3 bg-red-900/20 border border-red-600 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-red-400">{error}</span>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{result.total}</div>
                  <div className="text-sm text-gray-400">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{result.migrated}</div>
                  <div className="text-sm text-gray-400">Migrated</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">{result.skipped}</div>
                  <div className="text-sm text-gray-400">Skipped</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">{result.failed}</div>
                  <div className="text-sm text-gray-400">Failed</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Migration Progress</span>
                  <span className="text-white">
                    {result.migrated + result.skipped} / {result.total} completed
                  </span>
                </div>
                <Progress
                  value={(result.migrated + result.skipped) / result.total * 100}
                  className="w-full"
                />
              </div>

              {/* Details */}
              {result.details.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-white">Migration Details</h4>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {result.details.map((detail, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-gray-700/50 rounded"
                      >
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(detail.status)}
                          <span className="text-sm text-gray-300 font-mono">
                            {detail.assetId.substring(0, 8)}...
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className={getStatusColor(detail.status)}>
                            {detail.status}
                          </Badge>
                          {detail.reason && (
                            <span className="text-xs text-gray-400">{detail.reason}</span>
                          )}
                          {detail.error && (
                            <span className="text-xs text-red-400" title={detail.error}>
                              Error
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-2">
                <Button
                  onClick={() => {
                    setResult(null)
                    setError(null)
                  }}
                  variant="outline"
                  size="sm"
                >
                  Reset
                </Button>
                {onMigrationComplete && (
                  <Button
                    onClick={onMigrationComplete}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Refresh Assets
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}