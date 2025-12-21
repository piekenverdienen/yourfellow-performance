'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useSelectedClientId } from '@/stores/client-store'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  Plus,
  MessageSquare,
  Clock,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  ChevronDown,
  BookOpen,
  Image as ImageIcon,
  Sparkles,
  FileText,
} from 'lucide-react'
import type { Assistant, Conversation, Message, ChatActionType, UploadedFile, MessageAttachment } from '@/types'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import { AssistantAvatar } from '@/components/assistant-avatars'
import { ChatActionBar, MultimodalMessage } from '@/components/chat'

// Available models for selection
const AVAILABLE_MODELS = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'Anthropic' },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'Anthropic' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
]

// Available image generation models
const IMAGE_MODELS = [
  { id: 'dall-e-3', name: 'DALL-E 3', provider: 'OpenAI', description: 'Hoogste kwaliteit, meest creatief' },
  { id: 'dall-e-2', name: 'DALL-E 2', provider: 'OpenAI', description: 'Sneller, goedkoper' },
  { id: 'gpt-image-1', name: 'GPT Image', provider: 'OpenAI', description: 'Nieuwe model met editing' },
]

export default function MiaPage() {
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
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-20250514')
  const [showModelSelector, setShowModelSelector] = useState(false)
  const [selectedImageModel, setSelectedImageModel] = useState('dall-e-3')
  const [showImageModelSelector, setShowImageModelSelector] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchInitialData()
  }, [])

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

    // Fetch Mia assistant by slug
    const { data: assistantData } = await supabase
      .from('assistants')
      .select('*')
      .eq('slug', 'mia')
      .single()

    if (assistantData) {
      setAssistant(assistantData)
      setSelectedModel(assistantData.model || 'claude-sonnet-4-20250514')
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
    // Fetch messages
    const { data: messagesData } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })

    // Fetch attachments for this conversation
    const { data: attachmentsData } = await supabase
      .from('message_attachments')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })

    if (messagesData) {
      // Merge attachments with their messages
      const messagesWithAttachments = messagesData.map((message: Message) => {
        const messageAttachments = attachmentsData?.filter(
          (att: MessageAttachment) => att.message_id === message.id
        ) || []
        return {
          ...message,
          attachments: messageAttachments.length > 0 ? messageAttachments : undefined,
        }
      })
      setMessages(messagesWithAttachments)
    }
  }

  const startNewConversation = () => {
    setConversationId(null)
    setMessages([])
    router.push('/mia')
  }

  const selectConversation = async (convId: string) => {
    setConversationId(convId)
    await fetchMessages(convId)
    router.push(`/mia?conversation=${convId}`)
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
      formData.append('assistantSlug', 'mia')

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

  // Submit handler for ChatActionBar
  const handleChatSubmit = async (data: {
    message: string
    action: ChatActionType
    files?: UploadedFile[]
  }) => {
    if (isLoading || isStreaming) return

    const { message, action, files } = data

    // Handle image generation separately
    if (action === 'image_generate') {
      if (!message.trim()) return

      setIsLoading(true)
      setStreamingContent('')
      const modelName = IMAGE_MODELS.find(m => m.id === selectedImageModel)?.name || 'DALL-E 3'
      setStatusMessage(`Afbeelding genereren met ${modelName}...`)

      try {
        // Create conversation if needed
        let activeConversationId = conversationId
        if (!activeConversationId) {
          const { data: newConv } = await supabase
            .from('conversations')
            .insert({
              assistant_id: assistant?.id,
              title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
              client_id: selectedClientId || null,
            })
            .select('id')
            .single()

          if (newConv) {
            activeConversationId = newConv.id
            setConversationId(newConv.id)
            window.history.replaceState(null, '', `/mia?conversation=${newConv.id}`)
          }
        }

        // Save user message to database
        const { data: savedUserMessage } = await supabase
          .from('messages')
          .insert({
            conversation_id: activeConversationId,
            role: 'user',
            content: message,
            content_type: 'image_generation',
            tokens_used: 0,
          })
          .select()
          .single()

        // Add user message to UI
        if (savedUserMessage) {
          setMessages(prev => [...prev, savedUserMessage])
        }

        // Generate the image
        const response = await fetch('/api/chat/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: message,
            conversationId: activeConversationId,
            clientId: selectedClientId,
            assistantSlug: 'mia',
            model: selectedImageModel,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Image generation failed')
        }

        const imageData = await response.json()

        // Save assistant message to database
        const assistantContent = `Hier is de gegenereerde afbeelding op basis van je prompt: "${message}"`
        const { data: savedAssistantMessage } = await supabase
          .from('messages')
          .insert({
            conversation_id: activeConversationId,
            role: 'assistant',
            content: assistantContent,
            content_type: 'image_generation',
            tokens_used: 0,
          })
          .select()
          .single()

        if (savedAssistantMessage && imageData.image?.id) {
          // Link the attachment to the assistant message
          await supabase
            .from('message_attachments')
            .update({ message_id: savedAssistantMessage.id })
            .eq('id', imageData.image.id)

          // Add assistant message with attachment to UI
          const messageWithAttachment: Message = {
            ...savedAssistantMessage,
            attachments: [{
              id: imageData.image.id,
              conversation_id: activeConversationId || '',
              user_id: '',
              attachment_type: 'generated_image',
              file_name: 'generated-image.png',
              file_type: 'image/png',
              file_size: 0,
              file_path: imageData.image.filePath || '',
              public_url: imageData.image.url,
              generation_prompt: message,
              created_at: new Date().toISOString(),
            }],
          }
          setMessages(prev => [...prev, messageWithAttachment])
        }

        // Update conversation timestamp
        if (activeConversationId) {
          await supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', activeConversationId)
        }
      } catch (error) {
        console.error('Image generation error:', error)
        // Show error message in UI
        const errorMsg: Message = {
          id: `error-${Date.now()}`,
          conversation_id: conversationId || '',
          role: 'assistant',
          content: 'Er ging iets mis bij het genereren van de afbeelding. Probeer het opnieuw met een andere beschrijving.',
          tokens_used: 0,
          created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, errorMsg])
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
          model: selectedModel,
          action,
          attachments: uploadedAttachments,
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
                  `/mia?conversation=${streamData.id}`
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
        <p className="text-surface-600">Mia is nog niet geconfigureerd</p>
        <p className="text-sm text-surface-500 mt-2">
          Voer de Mia seed migration uit in Supabase om haar te activeren.
        </p>
        <Link href="/chat" className="text-primary hover:underline mt-4 inline-block">
          Terug naar AI Chat
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
            <div className="flex items-center gap-3">
              <AssistantAvatar slug="mia" size="md" />
              <div>
                <h2 className="font-semibold text-surface-900">{assistant.name}</h2>
                <p className="text-xs text-surface-500">Marketing Consultant</p>
              </div>
            </div>
          </div>
          <Button onClick={startNewConversation} className="w-full" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nieuw gesprek
          </Button>
          <Link href="/mia/knowledge" className="block mt-2">
            <Button variant="outline" className="w-full" size="sm">
              <BookOpen className="h-4 w-4 mr-2" />
              Kennisbank
            </Button>
          </Link>
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
              Nog geen gesprekken met Mia
            </p>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-surface-50">
        {/* Chat header */}
        <div className="h-14 px-4 border-b border-surface-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
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
                <AssistantAvatar slug="mia" size="sm" />
                <span className="font-medium text-surface-900">{assistant.name}</span>
              </div>
            )}
          </div>

          {/* Model Selectors */}
          <div className="flex items-center gap-2">
            {/* Image Model Selector */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowImageModelSelector(!showImageModelSelector)
                  setShowModelSelector(false)
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-surface-100 hover:bg-surface-200 rounded-lg transition-colors"
              >
                <Sparkles className="h-4 w-4 text-surface-500" />
                <span className="text-surface-600">
                  {IMAGE_MODELS.find(m => m.id === selectedImageModel)?.name || 'DALL-E 3'}
                </span>
                <ChevronDown className={cn(
                  "h-4 w-4 text-surface-400 transition-transform",
                  showImageModelSelector && "rotate-180"
                )} />
              </button>
              {showImageModelSelector && (
                <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-surface-200 py-1 z-10">
                  {IMAGE_MODELS.map(model => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setSelectedImageModel(model.id)
                        setShowImageModelSelector(false)
                      }}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm hover:bg-surface-50 transition-colors",
                        selectedImageModel === model.id && "bg-primary/10 text-primary"
                      )}
                    >
                      <div className="font-medium">{model.name}</div>
                      <div className="text-xs text-surface-500">{model.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Text Model Selector */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowModelSelector(!showModelSelector)
                  setShowImageModelSelector(false)
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-surface-100 hover:bg-surface-200 rounded-lg transition-colors"
              >
                <MessageSquare className="h-4 w-4 text-surface-500" />
                <span className="text-surface-600">
                  {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || 'Model'}
                </span>
                <ChevronDown className={cn(
                  "h-4 w-4 text-surface-400 transition-transform",
                  showModelSelector && "rotate-180"
                )} />
              </button>
              {showModelSelector && (
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-surface-200 py-1 z-10">
                  {AVAILABLE_MODELS.map(model => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(model.id)
                        setShowModelSelector(false)
                      }}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm hover:bg-surface-50 transition-colors",
                        selectedModel === model.id && "bg-primary/10 text-primary"
                      )}
                    >
                      <div className="font-medium">{model.name}</div>
                      <div className="text-xs text-surface-500">{model.provider}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="mb-4">
                <AssistantAvatar slug="mia" size="lg" className="w-16 h-16" />
              </div>
              <h3 className="text-lg font-semibold text-surface-900">{assistant.name}</h3>
              <p className="text-surface-600 max-w-md mt-2">{assistant.description}</p>
              <p className="text-surface-500 text-sm mt-4">
                Vraag me alles over Google Ads, SEO, Social Media of marketing in het algemeen.
              </p>
              {!selectedClientId && (
                <p className="text-amber-600 text-sm mt-2 bg-amber-50 px-4 py-2 rounded-lg">
                  Tip: Selecteer een klant in de header voor klant-specifieke context
                </p>
              )}
            </div>
          )}

          {messages.map(message => (
            <MultimodalMessage
              key={message.id}
              message={message}
              isUser={message.role === 'user'}
              assistantAvatar={<AssistantAvatar slug="mia" size="sm" />}
            />
          ))}

          {/* Streaming message */}
          {isStreaming && streamingContent && (
            <div className="flex gap-3 justify-start">
              <AssistantAvatar slug="mia" size="sm" />
              <Card className="max-w-[80%] px-4 py-3 bg-white">
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{streamingContent}</ReactMarkdown>
                </div>
              </Card>
            </div>
          )}

          {/* Loading indicator with status */}
          {isLoading && !streamingContent && (
            <div className="flex gap-3 justify-start">
              <AssistantAvatar slug="mia" size="sm" />
              <Card className="px-4 py-3 bg-white">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-surface-400" />
                  <span className="text-sm text-surface-500">
                    {statusMessage || 'Mia denkt na...'}
                  </span>
                </div>
              </Card>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area with multimodal actions */}
        <ChatActionBar
          onSubmit={handleChatSubmit}
          isLoading={isLoading || isStreaming}
          placeholder="Stel Mia een vraag..."
        />
      </div>
    </div>
  )
}
