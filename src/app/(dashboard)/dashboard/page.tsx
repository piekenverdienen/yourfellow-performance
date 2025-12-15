'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useUser } from '@/hooks/use-user'
import { useClientStore } from '@/stores/client-store'
import { WeekOverview, AddEventDialog } from '@/components/calendar'
import {
  Building2,
  ChevronRight,
  MessageSquare,
  Plus,
  Settings,
  Users,
  Sparkles,
  ArrowRight,
  Loader2,
  BarChart3,
  Type,
  Tags,
  Brain,
  Zap,
} from 'lucide-react'
import { AssistantAvatar } from '@/components/assistant-avatars'
import { getGreeting } from '@/lib/utils'
import { cn } from '@/lib/utils'

const quickTools = [
  { name: 'Website Analyseren', icon: BarChart3, href: '/cro/analyzer', color: 'bg-purple-100 text-purple-600' },
  { name: 'Ad Teksten', icon: Type, href: '/google-ads/copy', color: 'bg-blue-100 text-blue-600' },
  { name: 'Meta Tags', icon: Tags, href: '/seo/meta', color: 'bg-green-100 text-green-600' },
]

const aiAssistants = [
  {
    name: 'Max',
    slug: 'max',
    description: 'Helpt met alle marketing vragen',
    color: '#00FFCC',
  },
  {
    name: 'Sam',
    slug: 'sam',
    description: 'Technische implementaties',
    color: '#3B82F6',
  },
  {
    name: 'Sophie',
    slug: 'sophie',
    description: 'Conversie en psychologie',
    color: '#EC4899',
  },
]

export default function DashboardPage() {
  const { user, loading: userLoading } = useUser()
  const { clients, selectedClient, isLoading: clientsLoading, fetchClients, selectClient } = useClientStore()
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [calendarKey, setCalendarKey] = useState(0)

  const greeting = getGreeting()
  const userName = user?.full_name || user?.email?.split('@')[0] || 'Gebruiker'
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const handleEventAdded = () => {
    setCalendarKey(prev => prev + 1)
  }

  const getRoleBadge = (role: string) => {
    const roleConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      owner: { label: 'Eigenaar', variant: 'default' },
      admin: { label: 'Beheerder', variant: 'default' },
      editor: { label: 'Bewerker', variant: 'secondary' },
      viewer: { label: 'Kijker', variant: 'outline' },
    }
    const config = roleConfig[role] || { label: role, variant: 'outline' }
    return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>
  }

  if (userLoading || clientsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* 2/3 - 1/3 Layout */}
      <div className="flex gap-6">
        {/* Main Content - 2/3 */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Welcome Header - Premium Gradient */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-surface-900 via-surface-800 to-surface-900 p-6 md:p-8">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

            <div className="relative flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <span className="text-primary text-sm font-medium">YourFellow Performance Agency</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  Welkom {userName} in de Growth Suite.
                </h1>
                <p className="text-surface-400 max-w-md">
                  {selectedClient
                    ? `Je werkt momenteel aan ${selectedClient.name}. Gebruik de AI tools om content te genereren.`
                    : 'Selecteer een client om te beginnen met AI-powered marketing.'}
                </p>
              </div>
              {selectedClient && (
                <div className="hidden md:flex items-center gap-3 px-5 py-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/10">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    {selectedClient.logo_url ? (
                      <img
                        src={selectedClient.logo_url}
                        alt={selectedClient.name}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="text-lg font-bold text-primary">
                        {selectedClient.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-surface-400">Actieve client</p>
                    <p className="font-semibold text-white">{selectedClient.name}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Clients Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-surface-500" />
                <h2 className="text-lg font-semibold text-surface-900">Mijn Clients</h2>
                <Badge variant="secondary" className="ml-2">{clients.length}</Badge>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Link href="/clients">
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Nieuwe Client
                    </Button>
                  </Link>
                )}
                <Link href="/clients">
                  <Button variant="ghost" size="sm">
                    Alle clients
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>

            {clients.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Building2 className="h-12 w-12 text-surface-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-surface-900 mb-2">
                    Nog geen clients
                  </h3>
                  <p className="text-surface-600 mb-4">
                    {isAdmin
                      ? 'Voeg je eerste client toe om te beginnen met YourFellow.'
                      : 'Je hebt nog geen toegang tot clients. Vraag een admin om je toe te voegen.'}
                  </p>
                  {isAdmin && (
                    <Link href="/clients">
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Eerste Client Toevoegen
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {clients.slice(0, 4).map((client) => (
                  <Card
                    key={client.id}
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-lg',
                      selectedClient?.id === client.id && 'ring-2 ring-primary'
                    )}
                    onClick={() => selectClient(client)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          {client.logo_url ? (
                            <img
                              src={client.logo_url}
                              alt={client.name}
                              className="w-12 h-12 rounded-xl object-cover"
                            />
                          ) : (
                            <span className="text-xl font-bold text-primary">
                              {client.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-surface-900 truncate">{client.name}</h3>
                            {selectedClient?.id === client.id && (
                              <Badge variant="default" className="text-xs">Actief</Badge>
                            )}
                          </div>
                          <p className="text-sm text-surface-600 line-clamp-1 mb-2">
                            {client.description || 'Geen beschrijving'}
                          </p>
                          {getRoleBadge(client.role)}
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <Link href={`/clients/${client.id}`} className="flex-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="sm" className="w-full">
                            <Settings className="h-4 w-4 mr-1" />
                            Beheer
                          </Button>
                        </Link>
                        <Link href={`/clients/${client.id}?tab=context`} onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" title="AI Context bewerken">
                            <Brain className="h-4 w-4" />
                          </Button>
                        </Link>
                        {['owner', 'admin'].includes(client.role) && (
                          <Link href={`/clients/${client.id}?tab=team`} onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" title="Team beheren">
                              <Users className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* AI Assistants & Quick Tools Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AI Assistants */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-surface-500" />
                <h2 className="text-lg font-semibold text-surface-900">AI Assistenten</h2>
              </div>
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm text-surface-600 mb-2">
                    {selectedClient
                      ? `Chat met onze AI assistenten over ${selectedClient.name}`
                      : 'Selecteer eerst een client om context-aware hulp te krijgen'}
                  </p>
                  {aiAssistants.map((assistant) => (
                    <Link
                      key={assistant.slug}
                      href={`/chat/${assistant.slug}`}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-50 transition-all hover:shadow-sm border border-transparent hover:border-surface-200 group"
                    >
                      <AssistantAvatar slug={assistant.slug} size="md" />
                      <div className="flex-1">
                        <p className="font-medium text-surface-900">{assistant.name}</p>
                        <p className="text-xs text-surface-500">{assistant.description}</p>
                      </div>
                      <MessageSquare className="h-4 w-4 text-surface-400 group-hover:text-primary transition-colors" />
                    </Link>
                  ))}
                  <Link href="/chat" className="block">
                    <Button variant="outline" className="w-full mt-2">
                      Alle gesprekken bekijken
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </section>

            {/* Quick Tools */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-surface-500" />
                <h2 className="text-lg font-semibold text-surface-900">Snelle Tools</h2>
              </div>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-surface-600 mb-4">
                    {selectedClient
                      ? `Genereer content voor ${selectedClient.name}`
                      : 'Gebruik onze AI tools voor marketing taken'}
                  </p>
                  <div className="space-y-2">
                    {quickTools.map((tool) => {
                      const Icon = tool.icon
                      return (
                        <Link
                          key={tool.name}
                          href={tool.href}
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-50 transition-colors border border-transparent hover:border-surface-200"
                        >
                          <div className={cn('p-2.5 rounded-xl', tool.color)}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <span className="font-medium text-surface-700">{tool.name}</span>
                          <ChevronRight className="h-4 w-4 text-surface-400 ml-auto" />
                        </Link>
                      )
                    })}
                  </div>

                  {selectedClient && (
                    <div className="mt-4 p-3 bg-primary/5 rounded-xl border border-primary/10">
                      <div className="flex items-center gap-2 text-sm">
                        <Brain className="h-4 w-4 text-primary" />
                        <span className="text-surface-700">
                          AI output wordt aangepast aan <strong>{selectedClient.name}</strong>
                        </span>
                      </div>
                    </div>
                  )}

                  {!selectedClient && clients.length > 0 && (
                    <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                      <div className="flex items-center gap-2 text-sm text-amber-800">
                        <Building2 className="h-4 w-4" />
                        <span>Selecteer een client voor gepersonaliseerde output</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </div>
        </div>

        {/* Calendar Sidebar - 1/3 */}
        <div className="hidden lg:block w-80 flex-shrink-0">
          <div className="sticky top-6">
            <WeekOverview
              key={calendarKey}
              onAddEvent={() => setShowAddEvent(true)}
              selectedClientId={selectedClient?.id}
            />
          </div>
        </div>
      </div>

      {/* Add Event Dialog */}
      <AddEventDialog
        open={showAddEvent}
        onOpenChange={setShowAddEvent}
        onEventAdded={handleEventAdded}
        clients={clients}
        selectedClientId={selectedClient?.id}
        isAdmin={isAdmin}
      />
    </div>
  )
}
