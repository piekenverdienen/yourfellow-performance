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
  GitBranch,
  Building2,
  Code2,
} from 'lucide-react'
import { useState } from 'react'

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  color?: string
  children?: { name: string; href: string; icon: React.ElementType }[]
}

const navigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    color: 'text-blue-600 bg-blue-100'
  },
  {
    name: 'Klanten',
    href: '/clients',
    icon: Building2,
    color: 'text-emerald-600 bg-emerald-100'
  },
  {
    name: 'AI Chat',
    href: '/chat',
    icon: MessageSquare,
    color: 'text-violet-600 bg-violet-100'
  },
  {
    name: 'Workflows',
    href: '/workflows',
    icon: GitBranch,
    color: 'text-orange-600 bg-orange-100'
  },
  {
    name: 'Google Ads',
    href: '/google-ads',
    icon: Megaphone,
    color: 'text-red-600 bg-red-100',
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
    color: 'text-pink-600 bg-pink-100',
    children: [
      { name: 'Post Generator', href: '/social/posts', icon: Type },
      { name: 'Afbeeldingen', href: '/social/images', icon: Image },
    ]
  },
  {
    name: 'SEO',
    href: '/seo',
    icon: Search,
    color: 'text-teal-600 bg-teal-100',
    children: [
      { name: 'Content Schrijven', href: '/seo/content', icon: FileText },
      { name: 'Meta Tags', href: '/seo/meta', icon: Tags },
      { name: 'Schema Markup', href: '/seo/schema', icon: Code2 },
    ]
  },
  {
    name: 'CRO',
    href: '/cro',
    icon: MousePointerClick,
    color: 'text-purple-600 bg-purple-100',
    children: [
      { name: 'URL Analyzer', href: '/cro/analyzer', icon: BarChart3 },
    ]
  },
]

const bottomNavigation: NavItem[] = [
  { name: 'Team', href: '/admin/team', icon: Users, color: 'text-slate-600 bg-slate-100' },
  { name: 'Instellingen', href: '/settings', icon: Settings, color: 'text-slate-600 bg-slate-100' },
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
        <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-1">
          {navigation.map((item) => {
            const isItemActive = isActive(item.href) || isChildActive(item.children)
            const isExpanded = expandedItems.includes(item.name) || isItemActive
            const Icon = item.icon
            const [iconText, iconBg] = (item.color || 'text-surface-500 bg-surface-100').split(' ')

            return (
              <div key={item.name}>
                {item.children ? (
                  <>
                    <button
                      onClick={() => toggleExpanded(item.name)}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                        isItemActive
                          ? 'bg-surface-100 text-surface-900 shadow-sm'
                          : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
                          isItemActive ? iconBg : 'bg-surface-100',
                        )}>
                          <Icon className={cn(
                            'h-[18px] w-[18px]',
                            isItemActive ? iconText : 'text-surface-500'
                          )} />
                        </div>
                        {item.name}
                      </div>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 text-surface-400 transition-transform duration-200',
                          isExpanded && 'rotate-180'
                        )}
                      />
                    </button>
                    {isExpanded && (
                      <div className="mt-1 ml-5 pl-4 border-l-2 border-surface-200 space-y-1">
                        {item.children.map((child) => {
                          const ChildIcon = child.icon
                          const isChildItemActive = pathname === child.href
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150',
                                isChildItemActive
                                  ? `${iconBg} ${iconText} font-medium`
                                  : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
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
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                      isItemActive
                        ? 'bg-surface-100 text-surface-900 shadow-sm'
                        : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
                    )}
                  >
                    <div className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
                      isItemActive ? iconBg : 'bg-surface-100',
                    )}>
                      <Icon className={cn(
                        'h-[18px] w-[18px]',
                        isItemActive ? iconText : 'text-surface-500'
                      )} />
                    </div>
                    {item.name}
                  </Link>
                )}
              </div>
            )
          })}
        </nav>

        {/* Bottom Navigation */}
        <div className="border-t border-surface-200 px-3 py-4 space-y-1">
          {bottomNavigation.map((item) => {
            const Icon = item.icon
            const isItemActive = isActive(item.href)
            const [iconText, iconBg] = (item.color || 'text-surface-500 bg-surface-100').split(' ')

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  isItemActive
                    ? 'bg-surface-100 text-surface-900 shadow-sm'
                    : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
                )}
              >
                <div className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
                  isItemActive ? iconBg : 'bg-surface-100',
                )}>
                  <Icon className={cn(
                    'h-[18px] w-[18px]',
                    isItemActive ? iconText : 'text-surface-500'
                  )} />
                </div>
                {item.name}
              </Link>
            )
          })}
        </div>

        {/* AI Credits indicator */}
        <div className="border-t border-surface-200 p-4">
          <div className="rounded-xl bg-gradient-to-br from-violet-500/10 via-primary/10 to-emerald-500/10 p-4 border border-primary/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/20">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
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
