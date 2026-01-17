'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/logo'
import { MarketingToolIcon, type MarketingTool } from '@/components/marketing-tool-icon'
import {
  LayoutDashboard,
  MessageSquare,
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
  Trophy,
  Flame,
  Zap,
  TrendingUp,
  SearchCheck,
  SlidersHorizontal,
  Layers,
  AlertTriangle,
  BrainCircuit,
  Shield,
  UserCheck,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useUser } from '@/hooks/use-user'
import { calculateLevel } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  color?: string
  marketingTool?: MarketingTool
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
    name: 'Leaderboard',
    href: '/leaderboard',
    icon: Trophy,
    color: 'text-amber-600 bg-amber-100'
  },
  {
    name: 'Klanten',
    href: '/clients',
    icon: Building2,
    color: 'text-emerald-600 bg-emerald-100'
  },
  {
    name: 'Alerts',
    href: '/alerts',
    icon: AlertTriangle,
    color: 'text-red-600 bg-red-100'
  },
  {
    name: 'AI Chat',
    href: '/chat',
    icon: MessageSquare,
    color: 'text-violet-600 bg-violet-100'
  },
  {
    name: 'Content Hub',
    href: '/viral-hub',
    icon: TrendingUp,
    color: 'text-rose-600 bg-rose-100'
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
    icon: LayoutDashboard,
    marketingTool: 'google-ads',
    color: 'text-red-600 bg-white',
    children: [
      { name: 'Overview', href: '/google-ads', icon: LayoutDashboard },
      { name: 'Dashboard', href: '/google-ads/dashboard', icon: BarChart3 },
      { name: 'PMax Analysis', href: '/google-ads/pmax', icon: Layers },
      { name: 'AI Insights', href: '/google-ads/insights', icon: BrainCircuit },
      { name: '_section_Tools', href: '', icon: Settings },
      { name: 'Ad Teksten', href: '/google-ads/copy', icon: Type },
      { name: 'Feed Management', href: '/google-ads/feed', icon: Database },
      { name: 'Afbeeldingen', href: '/google-ads/images', icon: Image },
    ]
  },
  {
    name: 'Meta Ads',
    href: '/meta-ads',
    icon: LayoutDashboard,
    marketingTool: 'meta',
    color: 'text-[#0081FB] bg-white',
    children: [
      { name: 'Dashboard', href: '/meta-ads', icon: LayoutDashboard },
      { name: 'Performance', href: '/meta-ads/performance', icon: BarChart3 },
      { name: 'Fatigue Alerts', href: '/meta-ads/fatigue', icon: AlertTriangle },
      { name: 'AI Insights', href: '/meta-ads/insights', icon: BrainCircuit },
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
      // Dashboard
      { name: 'Dashboard', href: '/seo', icon: LayoutDashboard },
      // Content sectie
      { name: '_section_Content', href: '', icon: FileText },
      { name: 'Content Advisor', href: '/seo/advisor', icon: TrendingUp },
      { name: 'Content Creatie', href: '/seo/content', icon: Sparkles },
      { name: 'Meta Tags', href: '/seo/meta', icon: Tags },
      // Techniek sectie
      { name: '_section_Techniek', href: '', icon: Code2 },
      { name: 'Search Console', href: '/seo/queries', icon: SearchCheck },
      { name: 'Schema Markup', href: '/seo/schema', icon: Code2 },
      // Autoriteit sectie
      { name: '_section_Autoriteit', href: '', icon: Layers },
      { name: 'Topical Authority', href: '/seo/clusters', icon: Layers },
      // Instellingen
      { name: '_section_', href: '', icon: Settings },
      { name: 'Instellingen', href: '/seo/settings', icon: SlidersHorizontal },
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

// Admin-only navigation items
const adminNavigation: NavItem[] = [
  { name: 'Toegangsverzoeken', href: '/admin/memberships', icon: UserCheck, color: 'text-amber-600 bg-amber-100' },
]

export function Sidebar() {
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const { user } = useUser()
  const [streak, setStreak] = useState<{ currentStreak: number; isActive: boolean }>({ currentStreak: 0, isActive: false })
  const [pendingMembershipsCount, setPendingMembershipsCount] = useState(0)

  const isOrgAdmin = user?.role === 'admin'

  // Fetch streak data
  useEffect(() => {
    async function fetchStreak() {
      try {
        const res = await fetch('/api/streaks')
        if (res.ok) {
          const data = await res.json()
          setStreak({ currentStreak: data.currentStreak || 0, isActive: data.isActive || false })
        }
      } catch {
        // Streak endpoint might not exist yet
      }
    }
    if (user) {
      fetchStreak()
    }
  }, [user])

  // Fetch pending memberships count for admins
  useEffect(() => {
    async function fetchPendingCount() {
      if (!isOrgAdmin) return
      try {
        const res = await fetch('/api/admin/memberships')
        if (res.ok) {
          const data = await res.json()
          setPendingMembershipsCount(data.count || 0)
        }
      } catch {
        // Endpoint might not exist yet
      }
    }
    fetchPendingCount()
    // Refresh every 60 seconds
    const interval = setInterval(fetchPendingCount, 60000)
    return () => clearInterval(interval)
  }, [isOrgAdmin])

  const levelInfo = user ? calculateLevel(user.xp || 0) : null

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
                          {item.marketingTool ? (
                            <MarketingToolIcon tool={item.marketingTool} size="md" />
                          ) : (
                            <Icon className={cn(
                              'h-[18px] w-[18px]',
                              isItemActive ? iconText : 'text-surface-500'
                            )} />
                          )}
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
                        {item.children.map((child, childIndex) => {
                          const ChildIcon = child.icon
                          const isChildItemActive = pathname === child.href

                          // Section header
                          if (child.name.startsWith('_section_')) {
                            const sectionName = child.name.replace('_section_', '')
                            if (!sectionName) return <div key={childIndex} className="pt-2" />
                            return (
                              <div key={childIndex} className="pt-3 pb-1 px-3">
                                <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                                  {sectionName}
                                </span>
                              </div>
                            )
                          }

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
                      {item.marketingTool ? (
                        <MarketingToolIcon tool={item.marketingTool} size="md" />
                      ) : (
                        <Icon className={cn(
                          'h-[18px] w-[18px]',
                          isItemActive ? iconText : 'text-surface-500'
                        )} />
                      )}
                    </div>
                    {item.name}
                  </Link>
                )}
              </div>
            )
          })}
        </nav>

        {/* Admin Section - Only visible for org admins */}
        {isOrgAdmin && (
          <div className="border-t border-surface-200 px-3 py-4 space-y-1">
            <div className="flex items-center gap-2 px-3 pb-2">
              <Shield className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Admin</span>
            </div>
            {adminNavigation.map((item) => {
              const Icon = item.icon
              const isItemActive = isActive(item.href)
              const [iconText, iconBg] = (item.color || 'text-surface-500 bg-surface-100').split(' ')
              const showBadge = item.href === '/admin/memberships' && pendingMembershipsCount > 0

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
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
                  {showBadge && (
                    <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold bg-amber-500 text-white rounded-full">
                      {pendingMembershipsCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )}

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

        {/* XP & Streak indicator */}
        <div className="border-t border-surface-200 p-4">
          <Link href="/leaderboard">
            <div className="rounded-xl bg-gradient-to-br from-amber-500/10 via-primary/10 to-emerald-500/10 p-4 border border-primary/10 hover:border-primary/30 transition-colors cursor-pointer">
              {/* Level & XP */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/20">
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-surface-900">
                      Level {levelInfo?.level || 1}
                    </span>
                    <p className="text-xs text-surface-500">{levelInfo?.title || 'Beginner'}</p>
                  </div>
                </div>
                {streak.currentStreak > 0 && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100">
                    <Flame className={cn(
                      "h-4 w-4",
                      streak.isActive ? "text-orange-500" : "text-surface-400"
                    )} />
                    <span className={cn(
                      "text-sm font-bold",
                      streak.isActive ? "text-orange-600" : "text-surface-400"
                    )}>
                      {streak.currentStreak}
                    </span>
                  </div>
                )}
              </div>

              {/* XP Progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-surface-600">{user?.xp || 0} XP</span>
                  <span className="text-surface-400">{Math.round(levelInfo?.progress || 0)}%</span>
                </div>
                <Progress value={levelInfo?.progress || 0} className="h-1.5" />
              </div>
            </div>
          </Link>
        </div>
      </div>
    </aside>
  )
}
