import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Tailwind class merger
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format date to Dutch locale
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...options,
  }).format(new Date(date))
}

// Format relative time
export function formatRelativeTime(date: string | Date) {
  const now = new Date()
  const then = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000)

  if (diffInSeconds < 60) return 'zojuist'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min geleden`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} uur geleden`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} dagen geleden`
  
  return formatDate(date, { day: 'numeric', month: 'short' })
}

// Level titles based on XP
export const levelTitles: Record<number, string> = {
  1: 'Beginner',
  2: 'Starter',
  3: 'Gevorderde',
  4: 'Expert',
  5: 'Meester',
  6: 'Goeroe',
  7: 'Legende',
  8: 'Kampioen',
  9: 'Elite',
  10: 'AI Wizard',
}

// Calculate XP level
export function calculateLevel(xp: number): { level: number; progress: number; xpForNext: number; title: string } {
  const xpPerLevel = 100
  const level = Math.floor(xp / xpPerLevel) + 1
  const xpInCurrentLevel = xp % xpPerLevel
  const progress = (xpInCurrentLevel / xpPerLevel) * 100
  const title = levelTitles[Math.min(level, 10)] || 'AI Wizard'

  return {
    level,
    progress,
    xpForNext: xpPerLevel - xpInCurrentLevel,
    title,
  }
}

// Get XP range for current level
export function getLevelRange(level: number): { min: number; max: number } {
  const xpPerLevel = 100
  return {
    min: (level - 1) * xpPerLevel,
    max: level * xpPerLevel,
  }
}

// Industry options for profile
export const industryOptions = [
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'saas', label: 'SaaS / Software' },
  { value: 'agency', label: 'Marketing Bureau' },
  { value: 'retail', label: 'Retail' },
  { value: 'hospitality', label: 'Horeca' },
  { value: 'healthcare', label: 'Gezondheidszorg' },
  { value: 'finance', label: 'Financiën' },
  { value: 'education', label: 'Onderwijs' },
  { value: 'real-estate', label: 'Vastgoed' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'travel', label: 'Reizen & Toerisme' },
  { value: 'other', label: 'Anders' },
]

// Tone options for profile
export const toneOptions = [
  { value: 'professional', label: 'Professioneel' },
  { value: 'casual', label: 'Casual' },
  { value: 'friendly', label: 'Vriendelijk' },
  { value: 'formal', label: 'Formeel' },
  { value: 'creative', label: 'Creatief' },
]

// Get greeting based on time of day
export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 6) return 'Goedenacht'
  if (hour < 12) return 'Goedemorgen'
  if (hour < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

// Tool display names
export const toolDisplayNames: Record<string, string> = {
  'google-ads-copy': 'Google Ads Teksten',
  'google-ads-feed': 'Feed Management',
  'google-ads-image': 'Google Ads Afbeeldingen',
  'social-copy': 'Social Media Teksten',
  'social-image': 'Social Media Afbeeldingen',
  'seo-content': 'SEO Content',
  'seo-meta': 'Meta Tags Generator',
  'cro-analyzer': 'CRO Analyzer',
}

// Tool icons (Lucide icon names)
export const toolIcons: Record<string, string> = {
  'google-ads-copy': 'Type',
  'google-ads-feed': 'Database',
  'google-ads-image': 'Image',
  'social-copy': 'MessageSquare',
  'social-image': 'Camera',
  'seo-content': 'FileText',
  'seo-meta': 'Tags',
  'cro-analyzer': 'BarChart3',
}

// Truncate text
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return text.slice(0, length) + '...'
}

// Generate initials from name
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// Copy to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// Debounce function
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Format number with Dutch locale
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('nl-NL').format(num)
}

// Format percentage
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}
