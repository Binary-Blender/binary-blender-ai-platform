import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const past = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return 'Just now'
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours}h ago`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return `${diffInDays}d ago`
  }

  return formatDate(date)
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function generateRandomId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function getImageAspectRatio(width: number, height: number): string {
  const ratio = width / height

  if (Math.abs(ratio - 1) < 0.1) return 'square'
  if (ratio > 1.2) return 'landscape'
  if (ratio < 0.8) return 'portrait'
  return 'square'
}

export function getToolDisplayName(toolType: string): string {
  switch (toolType) {
    case 'image':
      return 'Image Generation'
    case 'video':
      return 'Video Generation'
    case 'lipsync':
      return 'Lip Sync'
    default:
      return toolType
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'text-green-500'
    case 'failed':
      return 'text-red-500'
    case 'processing':
      return 'text-yellow-500'
    case 'pending':
      return 'text-gray-500'
    default:
      return 'text-gray-500'
  }
}

export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// Credit cost calculations
export const CREDIT_COSTS = {
  image: {
    standard: 1,
    hd: 2,
    batch_multiplier: 1,
  },
  video: {
    base_per_second: 2,
    hd_multiplier: 1.5,
    min_cost: 10,
  },
  lipsync: {
    base_per_10_seconds: 5,
    quality_multiplier: {
      fast: 1,
      balanced: 1.2,
      quality: 1.6,
    },
  },
} as const

export function calculateImageCreditCost(
  count: number = 1,
  isHD: boolean = false
): number {
  const baseCost = isHD ? CREDIT_COSTS.image.hd : CREDIT_COSTS.image.standard
  return baseCost * count
}

export function calculateVideoCreditCost(
  durationSeconds: number,
  isHD: boolean = false
): number {
  const baseCost = CREDIT_COSTS.video.base_per_second * durationSeconds
  const finalCost = isHD ? baseCost * CREDIT_COSTS.video.hd_multiplier : baseCost
  return Math.max(finalCost, CREDIT_COSTS.video.min_cost)
}

export function calculateLipSyncCreditCost(
  durationSeconds: number,
  quality: 'fast' | 'balanced' | 'quality' = 'balanced'
): number {
  const durationIn10SecondBlocks = Math.ceil(durationSeconds / 10)
  const baseCost = CREDIT_COSTS.lipsync.base_per_10_seconds * durationIn10SecondBlocks
  return Math.round(baseCost * CREDIT_COSTS.lipsync.quality_multiplier[quality])
}