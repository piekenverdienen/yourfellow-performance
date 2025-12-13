'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  Bell, 
  Settings,
  LogOut,
  User,
  ChevronDown,
  Star,
} from 'lucide-react'
import { cn, getGreeting, calculateLevel } from '@/lib/utils'

interface HeaderProps {
  user?: {
    name: string
    email: string
    avatar_url?: string | null
    xp: number
  }
}

export function Header({ user }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  const levelInfo = user ? calculateLevel(user.xp) : null

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-xl border-b border-surface-200">
      <div className="flex h-full items-center justify-between px-6">
        {/* Search */}
        <div className="w-96">
          <Input
            placeholder="Zoek tools, klanten, of acties..."
            leftIcon={<Search className="h-4 w-4" />}
            className="bg-surface-50"
          />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Level badge */}
          {levelInfo && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-100">
              <Star className="h-4 w-4 text-primary fill-primary" />
              <span className="text-sm font-medium">Level {levelInfo.level}</span>
              <span className="text-xs text-surface-500">
                {user?.xp} XP
              </span>
            </div>
          )}

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-xl hover:bg-surface-100 transition-colors"
            >
              <Bell className="h-5 w-5 text-surface-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
            </button>

            {showNotifications && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowNotifications(false)} 
                />
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-lg border border-surface-200 z-20 overflow-hidden">
                  <div className="px-4 py-3 border-b border-surface-100">
                    <h3 className="font-semibold text-surface-900">Notificaties</h3>
                  </div>
                  <div className="p-4 text-center text-sm text-surface-500">
                    Geen nieuwe notificaties
                  </div>
                </div>
              </>
            )}
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 p-2 pr-3 rounded-xl hover:bg-surface-100 transition-colors"
            >
              <Avatar 
                name={user?.name || 'User'} 
                src={user?.avatar_url}
                size="sm"
              />
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-surface-900">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-surface-500">
                  {user?.email || 'user@yourfellow.nl'}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-surface-400" />
            </button>

            {showUserMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowUserMenu(false)} 
                />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-lg border border-surface-200 z-20 overflow-hidden">
                  <div className="px-4 py-3 border-b border-surface-100">
                    <p className="font-medium text-surface-900">{user?.name || 'User'}</p>
                    <p className="text-sm text-surface-500">{user?.email || 'user@yourfellow.nl'}</p>
                  </div>
                  <div className="py-2">
                    <a 
                      href="/settings/profile" 
                      className="flex items-center gap-3 px-4 py-2 text-sm text-surface-700 hover:bg-surface-50"
                    >
                      <User className="h-4 w-4" />
                      Mijn Profiel
                    </a>
                    <a 
                      href="/settings" 
                      className="flex items-center gap-3 px-4 py-2 text-sm text-surface-700 hover:bg-surface-50"
                    >
                      <Settings className="h-4 w-4" />
                      Instellingen
                    </a>
                  </div>
                  <div className="border-t border-surface-100 py-2">
                    <button 
                      className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
                    >
                      <LogOut className="h-4 w-4" />
                      Uitloggen
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
