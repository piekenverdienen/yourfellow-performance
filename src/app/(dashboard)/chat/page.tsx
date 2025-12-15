'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageSquare, Clock, Trash2, Loader2 } from 'lucide-react'
import { AssistantAvatar } from '@/components/assistant-avatars'
import type { Assistant, Conversation } from '@/types'

export default function ChatPage() {
  const router = useRouter()
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)

    // Fetch assistants
    const { data: assistantsData } = await supabase
      .from('assistants')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')

    if (assistantsData) {
      setAssistants(assistantsData)
    }

    // Fetch recent conversations
    const { data: conversationsData } = await supabase
      .from('conversations')
      .select('*, assistant:assistants(*)')
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
      .limit(10)

    if (conversationsData) {
      setConversations(conversationsData)
    }

    setLoading(false)
  }

  const startNewChat = (assistantId: string) => {
    router.push(`/chat/${assistantId}`)
  }

  const continueChat = (conversationId: string, assistantId: string) => {
    router.push(`/chat/${assistantId}?conversation=${conversationId}`)
  }

  const deleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingId(conversationId)

    await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId)

    setConversations(prev => prev.filter(c => c.id !== conversationId))
    setDeletingId(null)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return 'Vandaag'
    } else if (days === 1) {
      return 'Gisteren'
    } else if (days < 7) {
      return `${days} dagen geleden`
    } else {
      return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Chat met AI</h1>
        <p className="text-surface-600 mt-1">
          Kies een assistent om mee te chatten of ga verder met een eerder gesprek
        </p>
      </div>

      {/* AI Assistants Grid */}
      <div>
        <h2 className="text-lg font-semibold text-surface-900 mb-4">AI Assistants</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {assistants.map((assistant) => (
            <Card
              key={assistant.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => startNewChat(assistant.id)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <AssistantAvatar slug={assistant.slug} size="lg" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-surface-900">{assistant.name}</h3>
                    <p className="text-sm text-surface-600 mt-1 line-clamp-2">
                      {assistant.description}
                    </p>
                  </div>
                </div>
                <Button className="w-full mt-4" variant="outline">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Start gesprek
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Conversations */}
      {conversations.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-surface-900 mb-4">Recente gesprekken</h2>
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <Card
                key={conversation.id}
                className="cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => continueChat(conversation.id, conversation.assistant_id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <AssistantAvatar
                      slug={conversation.assistant?.slug || ''}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-surface-500">
                          {conversation.assistant?.name}
                        </span>
                        <span className="text-surface-300">•</span>
                        <span className="text-xs text-surface-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(conversation.updated_at)}
                        </span>
                      </div>
                      <p className="font-medium text-surface-900 truncate">
                        {conversation.title}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-surface-400 hover:text-red-500 shrink-0"
                      onClick={(e) => deleteConversation(conversation.id, e)}
                      disabled={deletingId === conversation.id}
                    >
                      {deletingId === conversation.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {assistants.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageSquare className="h-12 w-12 text-surface-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-surface-900">Geen assistants beschikbaar</h3>
            <p className="text-surface-600 mt-1">
              Voer eerst de database setup uit om de AI assistants toe te voegen.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
