import Image from 'next/image'
import { cn } from '@/lib/utils'

export type MarketingTool = 'google-ads' | 'meta' | 'ga4' | 'search-console' | 'shopify'

interface MarketingToolIconProps {
  tool: MarketingTool
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const toolConfig: Record<MarketingTool, { src: string; alt: string }> = {
  'google-ads': {
    src: '/logos/google-ads.svg',
    alt: 'Google Ads',
  },
  'meta': {
    src: '/logos/meta.svg',
    alt: 'Meta Ads',
  },
  'ga4': {
    src: '/logos/ga4.svg',
    alt: 'Google Analytics 4',
  },
  'search-console': {
    src: '/logos/search-console.svg',
    alt: 'Google Search Console',
  },
  'shopify': {
    src: '/logos/shopify.svg',
    alt: 'Shopify',
  },
}

const sizeMap = {
  sm: 16,
  md: 20,
  lg: 24,
}

export function MarketingToolIcon({ tool, size = 'md', className }: MarketingToolIconProps) {
  const config = toolConfig[tool]
  const pixelSize = sizeMap[size]

  return (
    <Image
      src={config.src}
      alt={config.alt}
      width={pixelSize}
      height={pixelSize}
      className={cn('flex-shrink-0', className)}
    />
  )
}
