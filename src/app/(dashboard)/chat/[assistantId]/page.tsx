'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useSelectedClientId } from '@/stores/client-store'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowLeft,
  Send,
  Loader2,
  Plus,
  MessageSquare,
  Clock,
  Trash2,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react'
import type { Assistant, Conversation, Message } from '@/types'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'

export default function ChatInterfacePage() {
  const params = useParams()
  const assistantId = params.assistantId as string
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedClientId = useSelectedClientId()
  const conversationParam = searchParams.get('conversation')

  const [assistant, setAssistant] = useState<Assistant | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState<string | null>(conversationParam)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [pageLoading, setPageLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchInitialData()
  }, [assistantId])

  useEffect(() => {
    if (conversationParam && conversationParam !== conversationId) {
      setConversationId(conversationParam)
      fetchMessages(conversationParam)
    }
  }, [conversationParam])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchInitialData = async () => {
    setPageLoading(true)

    // Fetch assistant by slug (used from dashboard links) or id
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assistantId)
    const { data: assistantData } = await supabase
      .from('assistants')
      .select('*')
      .eq(isUUID ? 'id' : 'slug', assistantId)
      .single()

    if (assistantData) {
      setAssistant(assistantData)
      // Fetch conversations using the real assistant ID
      await fetchConversations(assistantData.id)
    }

    // Fetch messages if conversation exists
    if (conversationParam) {
      await fetchMessages(conversationParam)
    }

    setPageLoading(false)
  }

  const fetchConversations = async (realAssistantId?: string) => {
    const idToUse = realAssistantId || assistant?.id
    if (!idToUse) return

    const { data: conversationsData } = await supabase
      .from('conversations')
      .select('*')
      .eq('assistant_id', idToUse)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
      .limit(20)

    if (conversationsData) {
      setConversations(conversationsData)
    }
  }

  const fetchMessages = async (convId: string) => {
    const { data: messagesData } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })

    if (messagesData) {
      setMessages(messagesData)
    }
  }

  const startNewConversation = () => {
    setConversationId(null)
    setMessages([])
    router.push(`/chat/${assistantId}`)
  }

  const selectConversation = async (convId: string) => {
    setConversationId(convId)
    await fetchMessages(convId)
    router.push(`/chat/${assistantId}?conversation=${convId}`)
  }

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingId(convId)

    await supabase.from('conversations').delete().eq('id', convId)

    setConversations(prev => prev.filter(c => c.id !== convId))

    if (conversationId === convId) {
      startNewConversation()
    }

    setDeletingId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || isStreaming) return

    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)
    setIsStreaming(true)
    setStreamingContent('')

    // Optimistically add user message
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId || '',
      role: 'user',
      content: userMessage,
      tokens_used: 0,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempUserMessage])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistantId: assistant?.id, // Use real assistant ID, not slug from URL
          conversationId,
          message: userMessage,
          clientId: selectedClientId,
        }),
      })

      if (!response.ok) {
        throw new Error('Chat request failed')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader available')

      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'conversation_id') {
                setConversationId(data.id)
                // Update URL without reload
                window.history.replaceState(
                  null,
                  '',
                  `/chat/${assistantId}?conversation=${data.id}`
                )
              } else if (data.type === 'text') {
                fullContent += data.content
                setStreamingContent(fullContent)
              } else if (data.type === 'done') {
                // Streaming complete
              } else if (data.type === 'error') {
                console.error('Stream error:', data.message)
              }
            } catch {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }
      }

      // Add assistant message
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        conversation_id: conversationId || '',
        role: 'assistant',
        content: fullContent,
        tokens_used: 0,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMessage])
      setStreamingContent('')

      // Refresh conversations list
      await fetchConversations()
    } catch (error) {
      console.error('Chat error:', error)
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id))
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Vandaag'
    if (days === 1) return 'Gisteren'
    if (days < 7) return `${days} dagen geleden`
    return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!assistant) {
    return (
      <div className="text-center py-12">
        <p className="text-surface-600">Assistant niet gevonden</p>
        <Link href="/chat" className="text-primary hover:underline mt-2 inline-block">
          Terug naar overzicht
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] -mx-6 -my-6">
      {/* Sidebar with conversations */}
      <div
        className={cn(
          'border-r border-surface-200 bg-white flex flex-col transition-all duration-300',
          sidebarOpen ? 'w-72' : 'w-0 overflow-hidden'
        )}
      >
        {/* Sidebar header */}
        <div className="p-4 border-b border-surface-200">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/chat"
              className="p-2 hover:bg-surface-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-surface-600" />
            </Link>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                style={{ backgroundColor: assistant.avatar_color }}
              >
                {assistant.avatar_letter}
              </div>
              <div>
                <h2 className="font-semibold text-surface-900">{assistant.name}</h2>
              </div>
            </div>
          </div>
          <Button onClick={startNewConversation} className="w-full" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nieuw gesprek
          </Button>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => selectConversation(conv.id)}
              className={cn(
                'group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors',
                conv.id === conversationId
                  ? 'bg-primary/10 text-surface-900'
                  : 'hover:bg-surface-100 text-surface-600'
              )}
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{conv.title}</p>
                <p className="text-xs text-surface-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDate(conv.updated_at)}
                </p>
              </div>
              <button
                onClick={e => deleteConversation(conv.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-200 rounded transition-all"
                disabled={deletingId === conv.id}
              >
                {deletingId === conv.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 text-surface-400 hover:text-red-500" />
                )}
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="text-sm text-surface-500 text-center py-4">
              Nog geen gesprekken
            </p>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-surface-50">
        {/* Chat header */}
        <div className="h-14 px-4 border-b border-surface-200 bg-white flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-surface-100 rounded-lg transition-colors"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-5 w-5 text-surface-600" />
            ) : (
              <PanelLeft className="h-5 w-5 text-surface-600" />
            )}
          </button>
          {!sidebarOpen && (
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: assistant.avatar_color }}
              >
                {assistant.avatar_letter}
              </div>
              <span className="font-medium text-surface-900">{assistant.name}</span>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white mb-4"
                style={{ backgroundColor: assistant.avatar_color }}
              >
                {assistant.avatar_letter}
              </div>
              <h3 className="text-lg font-semibold text-surface-900">{assistant.name}</h3>
              <p className="text-surface-600 max-w-md mt-2">{assistant.description}</p>
              <p className="text-surface-500 text-sm mt-4">
                Stuur een bericht om het gesprek te starten
              </p>
            </div>
          )}

          {messages.map(message => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: assistant.avatar_color }}
                >
                  {assistant.avatar_letter}
                </div>
              )}
              <Card
                className={cn(
                  'max-w-[80%] px-4 py-3',
                  message.role === 'user'
                    ? 'bg-primary text-white'
                    : 'bg-white'
                )}
              >
                <div
                  className={cn(
                    'prose prose-sm max-w-none',
                    message.role === 'user' && 'prose-invert'
                  )}
                >
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              </Card>
            </div>
          ))}

          {/* Streaming message */}
          {isStreaming && streamingContent && (
            <div className="flex gap-3 justify-start">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ backgroundColor: assistant.avatar_color }}
              >
                {assistant.avatar_letter}
              </div>
              <Card className="max-w-[80%] px-4 py-3 bg-white">
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{streamingContent}</ReactMarkdown>
                </div>
              </Card>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && !streamingContent && (
            <div className="flex gap-3 justify-start">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ backgroundColor: assistant.avatar_color }}
              >
                {assistant.avatar_letter}
              </div>
              <Card className="px-4 py-3 bg-white">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-surface-400" />
                  <span className="text-sm text-surface-500">Aan het typen...</span>
                </div>
              </Card>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="p-4 border-t border-surface-200 bg-white">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Bericht aan ${assistant.name}...`}
              className="resize-none min-h-[44px] max-h-32"
              rows={1}
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </form>
          <p className="text-xs text-surface-500 mt-2 text-center">
            Druk op Enter om te versturen, Shift+Enter voor nieuwe regel
          </p>
        </div>
      </div>
    </div>
  )
}
