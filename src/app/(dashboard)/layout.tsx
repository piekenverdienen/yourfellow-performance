import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // TODO: Get user from Supabase session
  const mockUser = {
    name: 'Diederik',
    email: 'diederik@yourfellow.nl',
    avatar_url: null,
    xp: 7,
  }

  return (
    <div className="min-h-screen bg-surface-100">
      <Sidebar />
      <div className="pl-64">
        <Header user={mockUser} />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
