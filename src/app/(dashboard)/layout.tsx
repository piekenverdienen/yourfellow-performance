'use client'

import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { useUser } from '@/hooks/use-user'
import { Loader2 } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useUser()

  // Format user for header
  const headerUser = user ? {
    name: user.full_name || user.email?.split('@')[0] || 'User',
    email: user.email,
    avatar_url: user.avatar_url,
    xp: user.xp,
  } : undefined

  return (
    <div className="min-h-screen bg-surface-100">
      <Sidebar />
      <div className="pl-64">
        <Header user={headerUser} />
        <main className="p-6">
          {loading ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  )
}
