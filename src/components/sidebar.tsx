'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/logo'
import {
  LayoutDashboard,
  MessageSquare,
  Megaphone,
  Share2,
  Search,
  MousePointerClick,
  Settings,
  Users,
  ChevronDown,
  Sparkles,
  Type,
  Database,
  Image,
  FileText,
  Tags,
  BarChart3,
} from 'lucide-react'
import { useState } from 'react'

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  children?: { name: string; href: string; icon: React.ElementType }[]
}

const navigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard
  },
  {
    name: 'AI Chat',
    href: '/chat',
    icon: MessageSquare
  },
  {
    name: 'Google Ads', 
    href: '/google-ads', 
    icon: Megaphone,
    children: [
      { name: 'Ad Teksten', href: '/google-ads/copy', icon: Type },
      { name: 'Feed Management', href: '/google-ads/feed', icon: Database },
      { name: 'Afbeeldingen', href: '/google-ads/images', icon: Image },
    ]
  },
  { 
    name: 'Social Media', 
    href: '/social', 
    icon: Share2,
    children: [
      { name: 'Post Generator', href: '/social/posts', icon: Type },
      { name: 'Afbeeldingen', href: '/social/images', icon: Image },
    ]
  },
  { 
    name: 'SEO', 
    href: '/seo', 
    icon: Search,
    children: [
      { name: 'Content Schrijven', href: '/seo/content', icon: FileText },
      { name: 'Meta Tags', href: '/seo/meta', icon: Tags },
    ]
  },
  { 
    name: 'CRO', 
    href: '/cro', 
    icon: MousePointerClick,
    children: [
      { name: 'URL Analyzer', href: '/cro/analyzer', icon: BarChart3 },
    ]
  },
]

const bottomNavigation: NavItem[] = [
  { name: 'Team', href: '/admin/team', icon: Users },
  { name: 'Instellingen', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState<string[]>([])

  const toggleExpanded = (name: string) => {
    setExpandedItems(prev => 
      prev.includes(name) 
        ? prev.filter(item => item !== name)
        : [...prev, name]
    )
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === href
    return pathname.startsWith(href)
  }

  const isChildActive = (children?: NavItem['children']) => {
    return children?.some(child => pathname === child.href)
  }

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-white border-r border-surface-200">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center px-6 border-b border-surface-100">
          <Link href="/dashboard">
            <Logo size="md" />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
          {navigation.map((item) => {
            const isItemActive = isActive(item.href) || isChildActive(item.children)
            const isExpanded = expandedItems.includes(item.name) || isItemActive
            const Icon = item.icon

            return (
              <div key={item.name}>
                {item.children ? (
                  <>
                    <button
                      onClick={() => toggleExpanded(item.name)}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                        isItemActive
                          ? 'bg-primary/10 text-surface-900'
                          : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5" />
                        {item.name}
                      </div>
                      <ChevronDown 
                        className={cn(
                          'h-4 w-4 transition-transform duration-200',
                          isExpanded && 'rotate-180'
                        )} 
                      />
                    </button>
                    {isExpanded && (
                      <div className="mt-1 ml-4 pl-4 border-l border-surface-200 space-y-1">
                        {item.children.map((child) => {
                          const ChildIcon = child.icon
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={cn(
                                'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors duration-150',
                                pathname === child.href
                                  ? 'bg-primary/10 text-surface-900 font-medium'
                                  : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
                              )}
                            >
                              <ChildIcon className="h-4 w-4" />
                              {child.name}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                      isItemActive
                        ? 'bg-primary/10 text-surface-900'
                        : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                )}
              </div>
            )
          })}
        </nav>

        {/* Bottom Navigation */}
        <div className="border-t border-surface-200 px-4 py-4 space-y-1">
          {bottomNavigation.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                  isActive(item.href)
                    ? 'bg-primary/10 text-surface-900'
                    : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
                )}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            )
          })}
        </div>

        {/* AI Credits indicator */}
        <div className="border-t border-surface-200 p-4">
          <div className="rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-surface-900">AI Credits</span>
            </div>
            <div className="text-2xl font-bold text-surface-900">∞</div>
            <p className="text-xs text-surface-500 mt-1">Unlimited voor team</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
