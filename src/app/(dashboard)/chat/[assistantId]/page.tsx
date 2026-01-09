'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useSelectedClientId } from '@/stores/client-store'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react'
import type { Assistant, Conversation, Message, ChatActionType, UploadedFile, MessageAttachment } from '@/types'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import { AssistantAvatar } from '@/components/assistant-avatars'
import { ChatActionBar, MultimodalMessage, CHAT_MODELS, IMAGE_MODELS } from '@/components/chat'

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
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [pageLoading, setPageLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
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
    // Fetch messages with their attachments
    const { data: messagesData } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })

    if (messagesData) {
      // Fetch attachments for this conversation
      const { data: attachmentsData } = await supabase
        .from('message_attachments')
        .select('*')
        .eq('conversation_id', convId)

      // Map attachments to their messages
      const messagesWithAttachments = messagesData.map((msg: { id: string } & Record<string, unknown>) => ({
        ...msg,
        attachments: attachmentsData?.filter((att: { message_id: string }) => att.message_id === msg.id) || []
      }))

      setMessages(messagesWithAttachments)
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

  // Upload files to storage and return URLs
  const uploadFiles = async (files: UploadedFile[]): Promise<{
    type: 'image' | 'document'
    url: string
    fileName: string
    fileType: string
    extractedText?: string
  }[]> => {
    const uploadedAttachments: {
      type: 'image' | 'document'
      url: string
      fileName: string
      fileType: string
      extractedText?: string
    }[] = []

    for (const uploadedFile of files) {
      const formData = new FormData()
      formData.append('file', uploadedFile.file)
      if (conversationId) formData.append('conversationId', conversationId)
      if (selectedClientId) formData.append('clientId', selectedClientId)
      if (assistant?.slug) formData.append('assistantSlug', assistant.slug)

      const response = await fetch('/api/chat/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        uploadedAttachments.push({
          type: data.attachment.type,
          url: data.attachment.publicUrl,
          fileName: data.attachment.fileName,
          fileType: data.attachment.fileType,
          extractedText: data.attachment.extractedText,
        })
      }
    }

    return uploadedAttachments
  }

  // Handle image generation
  const handleImageGeneration = async (prompt: string, imageModel?: string): Promise<MessageAttachment | null> => {
    setIsGeneratingImage(true)
    setStatusMessage('Afbeelding genereren...')

    try {
      const response = await fetch('/api/chat/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          conversationId,
          clientId: selectedClientId,
          assistantSlug: assistant?.slug,
          model: imageModel,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Image generation failed')
      }

      const data = await response.json()
      return {
        id: data.image.id || `gen-${Date.now()}`,
        conversation_id: conversationId || '',
        user_id: '',
        attachment_type: 'generated_image',
        file_name: 'generated-image.png',
        file_type: 'image/png',
        file_size: 0,
        file_path: data.image.filePath || '',
        public_url: data.image.url,
        generation_prompt: prompt,
        created_at: new Date().toISOString(),
      }
    } catch (error) {
      console.error('Image generation error:', error)
      return null
    } finally {
      setIsGeneratingImage(false)
    }
  }

  // New submit handler for ChatActionBar
  const handleChatSubmit = async (data: {
    message: string
    action: ChatActionType
    files?: UploadedFile[]
    chatModel?: string
    imageModel?: string
  }) => {
    if (isLoading || isStreaming) return

    const { message, action, files, chatModel, imageModel } = data

    // Get the actual model name from model ID
    const chatModelConfig = CHAT_MODELS.find(m => m.id === chatModel)
    const chatModelName = chatModelConfig?.modelName

    // Handle image generation separately
    if (action === 'image_generate') {
      if (!message.trim()) return

      setIsLoading(true)
      setStreamingContent('')
      setStatusMessage('Afbeelding genereren...')

      // Add user message first
      const tempUserMessage: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: conversationId || '',
        role: 'user',
        content: message,
        content_type: 'image_generation',
        tokens_used: 0,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, tempUserMessage])

      const generatedImage = await handleImageGeneration(message, imageModel)

      // Remove temp message first
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id))

      if (generatedImage) {
        // Messages are now saved in the database by the API
        // Fetch the updated messages to show them with correct IDs
        if (conversationId) {
          await fetchMessages(conversationId)
        } else {
          // Fallback for new conversations - add to local state
          const userMessage: Message = {
            id: `user-${Date.now()}`,
            conversation_id: conversationId || '',
            role: 'user',
            content: message,
            content_type: 'image_generation',
            tokens_used: 0,
            created_at: new Date().toISOString(),
          }
          const assistantMessage: Message = {
            id: `assistant-${Date.now()}`,
            conversation_id: conversationId || '',
            role: 'assistant',
            content: `Hier is de gegenereerde afbeelding op basis van je prompt: "${message}"`,
            content_type: 'image_generation',
            tokens_used: 0,
            created_at: new Date().toISOString(),
            attachments: [generatedImage],
          }
          setMessages(prev => [...prev, userMessage, assistantMessage])
        }
      } else {
        const errorMessage: Message = {
          id: `assistant-${Date.now()}`,
          conversation_id: conversationId || '',
          role: 'assistant',
          content: 'Er ging iets mis bij het genereren van de afbeelding. Probeer het opnieuw met een andere beschrijving.',
          tokens_used: 0,
          created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, errorMessage])
      }

      setIsLoading(false)
      setStatusMessage(null)
      await fetchConversations()
      return
    }

    // Handle regular chat, image analysis, and file analysis
    if (!message.trim() && (!files || files.length === 0)) return

    setIsLoading(true)
    setIsStreaming(true)
    setStreamingContent('')
    setStatusMessage(null)

    // Upload files if present
    let uploadedAttachments: {
      type: 'image' | 'document'
      url: string
      fileName: string
      fileType: string
      extractedText?: string
    }[] = []

    if (files && files.length > 0) {
      setStatusMessage('Bestanden uploaden...')
      uploadedAttachments = await uploadFiles(files)
    }

    // Build user message with attachments for display
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId || '',
      role: 'user',
      content: message,
      content_type: action === 'image_analyze' ? 'multimodal' : action === 'file_analyze' ? 'file_analysis' : 'text',
      tokens_used: 0,
      created_at: new Date().toISOString(),
      attachments: uploadedAttachments.map((att, idx) => ({
        id: `att-${Date.now()}-${idx}`,
        conversation_id: conversationId || '',
        user_id: '',
        attachment_type: att.type as 'image' | 'document',
        file_name: att.fileName,
        file_type: att.fileType,
        file_size: 0,
        file_path: '',
        public_url: att.url,
        created_at: new Date().toISOString(),
      })),
    }
    setMessages(prev => [...prev, tempUserMessage])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistantId: assistant?.id,
          conversationId,
          message,
          clientId: selectedClientId,
          action,
          attachments: uploadedAttachments,
          model: chatModelName,
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
              const streamData = JSON.parse(line.slice(6))

              if (streamData.type === 'conversation_id') {
                setConversationId(streamData.id)
                window.history.replaceState(
                  null,
                  '',
                  `/chat/${assistantId}?conversation=${streamData.id}`
                )
              } else if (streamData.type === 'status') {
                setStatusMessage(streamData.message)
              } else if (streamData.type === 'text') {
                setStatusMessage(null)
                fullContent += streamData.content
                setStreamingContent(fullContent)
              } else if (streamData.type === 'done') {
                setStatusMessage(null)
              } else if (streamData.type === 'error') {
                setStatusMessage(null)
                console.error('Stream error:', streamData.message)
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
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id))
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
      setStatusMessage(null)
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
          'border-r border-surface-200 bg-surface-50/50 flex flex-col transition-all duration-300',
          sidebarOpen ? 'w-72' : 'w-0 overflow-hidden'
        )}
      >
        {/* Sidebar header */}
        <div className="p-4 border-b border-surface-100">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/chat"
              className="p-2 hover:bg-surface-100 rounded-xl transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-surface-500" />
            </Link>
            <div className="flex items-center gap-2.5">
              <AssistantAvatar slug={assistant.slug} size="sm" />
              <h2 className="font-medium text-surface-900 text-sm">{assistant.name}</h2>
            </div>
          </div>
          <Button onClick={startNewConversation} className="w-full rounded-xl" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nieuw gesprek
          </Button>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {conversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => selectConversation(conv.id)}
              className={cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all',
                conv.id === conversationId
                  ? 'bg-white shadow-sm text-surface-900'
                  : 'hover:bg-white/60 text-surface-600'
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate">{conv.title}</p>
                <p className="text-xs text-surface-400 mt-0.5">
                  {formatDate(conv.updated_at)}
                </p>
              </div>
              <button
                onClick={e => deleteConversation(conv.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-surface-100 rounded-lg transition-all"
                disabled={deletingId === conv.id}
              >
                {deletingId === conv.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5 text-surface-400 hover:text-red-500" />
                )}
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="text-xs text-surface-400 text-center py-8">
              Nog geen gesprekken
            </p>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-surface-50">
        {/* Chat header */}
        <div className="h-12 px-4 border-b border-surface-100 bg-white/80 backdrop-blur-sm flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 hover:bg-surface-100 rounded-lg transition-colors"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-4 w-4 text-surface-500" />
            ) : (
              <PanelLeft className="h-4 w-4 text-surface-500" />
            )}
          </button>
          {!sidebarOpen && (
            <div className="flex items-center gap-2">
              <AssistantAvatar slug={assistant.slug} size="sm" />
              <span className="font-medium text-surface-900 text-sm">{assistant.name}</span>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="mb-6">
                <AssistantAvatar slug={assistant.slug} size="lg" className="w-14 h-14" />
              </div>
              <h3 className="text-xl font-semibold text-surface-900 mb-2">{assistant.name}</h3>
              <p className="text-surface-500 max-w-sm text-sm leading-relaxed">
                {assistant.description || 'Hoe kan ik je vandaag helpen?'}
              </p>
            </div>
          )}

          {messages.map(message => (
            <MultimodalMessage
              key={message.id}
              message={message}
              isUser={message.role === 'user'}
              assistantAvatar={<AssistantAvatar slug={assistant.slug} size="sm" />}
            />
          ))}

          {/* Streaming message */}
          {isStreaming && streamingContent && (
            <div className="flex gap-4 justify-start">
              <AssistantAvatar slug={assistant.slug} size="sm" />
              <div className="max-w-[70%] px-5 py-4 bg-surface-50/80 rounded-2xl">
                <div className="prose prose-[15px] max-w-none leading-relaxed prose-p:text-surface-700 prose-p:my-1.5">
                  <ReactMarkdown>{streamingContent}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* Loading indicator with status */}
          {isLoading && !streamingContent && (
            <div className="flex gap-4 justify-start">
              <AssistantAvatar slug={assistant.slug} size="sm" />
              <div className="px-5 py-4 bg-surface-50/80 rounded-2xl">
                <div className="flex items-center gap-2.5">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm text-surface-500">
                    {statusMessage || 'Aan het typen...'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area with multimodal actions */}
        <ChatActionBar
          onSubmit={handleChatSubmit}
          isLoading={isLoading || isStreaming}
          placeholder={`Bericht aan ${assistant.name}...`}
        />
      </div>
    </div>
  )
}
