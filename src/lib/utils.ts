import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { nanoid } from 'nanoid'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateCertificateNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = nanoid(8).toUpperCase()
  return `CERT-${timestamp}-${random}`
}

export function formatPrice(amountCentimes: number, currency = 'XOF'): string {
  const safeCurrency = currency && currency.length === 3 ? currency : 'XOF'
  return new Intl.NumberFormat('fr-BF', {
    style: 'currency',
    currency: safeCurrency,
    maximumFractionDigits: 0,
  }).format(amountCentimes / 100)
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}m`
  return `${m}m${s.toString().padStart(2, '0')}s`
}
