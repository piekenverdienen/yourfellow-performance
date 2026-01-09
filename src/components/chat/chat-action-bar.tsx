'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Send,
  Loader2,
  Paperclip,
  Image as ImageIcon,
  Sparkles,
  FileText,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatActionType, UploadedFile } from '@/types'
import { ModelSelector, ImageModelSelector } from './model-selector'
import type { ChatModelId, ImageModelId } from './model-selector'

interface ChatActionBarProps {
  onSubmit: (data: {
    message: string
    action: ChatActionType
    files?: UploadedFile[]
    chatModel?: string
    imageModel?: string
  }) => void
  isLoading: boolean
  placeholder?: string
  disabled?: boolean
  showModelSelector?: boolean
}

interface ActionPill {
  id: ChatActionType | 'attach'
  label: string
  icon: React.ReactNode
  acceptedFiles?: string
}

const ACTION_PILLS: ActionPill[] = [
  {
    id: 'attach',
    label: 'Bijlage',
    icon: <Paperclip className="h-3.5 w-3.5" />,
    acceptedFiles: 'image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,text/csv,.csv',
  },
  {
    id: 'image_generate',
    label: 'Genereer',
    icon: <Sparkles className="h-3.5 w-3.5" />,
  },
]

export function ChatActionBar({
  onSubmit,
  isLoading,
  placeholder = 'Typ een bericht...',
  disabled = false,
  showModelSelector = true,
}: ChatActionBarProps) {
  const [input, setInput] = useState('')
  const [selectedAction, setSelectedAction] = useState<ChatActionType>('chat')
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [selectedChatModel, setSelectedChatModel] = useState<ChatModelId>('claude-sonnet')
  const [selectedImageModel, setSelectedImageModel] = useState<ImageModelId>('dall-e-3')

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() && uploadedFiles.length === 0) return
    if (isLoading || disabled) return

    // Validation for actions that require files
    if ((selectedAction === 'image_analyze' || selectedAction === 'file_analyze') && uploadedFiles.length === 0) {
      return
    }

    onSubmit({
      message: input.trim(),
      action: selectedAction,
      files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
      chatModel: selectedChatModel,
      imageModel: selectedImageModel,
    })

    // Reset state
    setInput('')
    setUploadedFiles([])
    if (selectedAction !== 'chat') {
      setSelectedAction('chat')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handlePillClick = (pill: ActionPill) => {
    if (pill.id === 'attach') {
      // Open file picker
      if (fileInputRef.current) {
        fileInputRef.current.accept = pill.acceptedFiles || ''
        fileInputRef.current.click()
      }
    } else if (pill.id === 'image_generate') {
      setSelectedAction(pill.id)
      textareaRef.current?.focus()
    }
  }

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return

    const newFiles: UploadedFile[] = Array.from(files).map(file => ({
      id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      status: 'pending' as const,
    }))

    setUploadedFiles(prev => [...prev, ...newFiles])

    // Auto-select appropriate action based on file type
    if (newFiles.some(f => f.file.type.startsWith('image/'))) {
      setSelectedAction('image_analyze')
    } else {
      setSelectedAction('file_analyze')
    }
  }, [])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files)
    e.target.value = '' // Reset so same file can be selected again
  }

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => {
      const files = prev.filter(f => f.id !== fileId)
      // Reset action if no files left
      if (files.length === 0 && (selectedAction === 'image_analyze' || selectedAction === 'file_analyze')) {
        setSelectedAction('chat')
      }
      return files
    })
  }

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }

  const getPlaceholder = () => {
    switch (selectedAction) {
      case 'image_analyze':
        return 'Wat wil je weten over deze afbeelding?'
      case 'image_generate':
        return 'Beschrijf de afbeelding die je wilt genereren...'
      case 'file_analyze':
        return 'Stel een vraag over het bestand...'
      default:
        return placeholder
    }
  }

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)

    // Auto-resize
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
  }

  const isImageGenerateMode = selectedAction === 'image_generate'

  return (
    <div
      className={cn(
        'relative px-4 py-3 bg-white border-t border-surface-200',
        isDragging && 'ring-2 ring-primary ring-inset bg-primary/5'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/10 z-10 pointer-events-none rounded-2xl">
          <div className="flex items-center gap-2 text-primary font-medium">
            <Paperclip className="h-5 w-5" />
            <span>Sleep bestand hier</span>
          </div>
        </div>
      )}

      {/* Main input container */}
      <div className={cn(
        'relative bg-surface-50 rounded-2xl border border-surface-200 transition-all',
        'focus-within:border-surface-300 focus-within:bg-white focus-within:shadow-sm',
        isDragging && 'border-primary'
      )}>
        {/* Uploaded files preview - inside the container */}
        {uploadedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 pb-0">
            {uploadedFiles.map(file => (
              <div
                key={file.id}
                className="relative group flex items-center gap-2 px-3 py-2 bg-white border border-surface-200 rounded-xl shadow-sm"
              >
                {file.preview ? (
                  <img
                    src={file.preview}
                    alt={file.file.name}
                    className="w-10 h-10 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-10 h-10 bg-surface-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-surface-500" />
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate max-w-[120px]">
                    {file.file.name}
                  </span>
                  <span className="text-xs text-surface-500">
                    {(file.file.size / 1024).toFixed(0)} KB
                  </span>
                </div>
                <button
                  onClick={() => removeFile(file.id)}
                  className="p-1 hover:bg-surface-100 rounded-full text-surface-400 hover:text-surface-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Image generate mode indicator */}
        {isImageGenerateMode && uploadedFiles.length === 0 && (
          <div className="flex items-center gap-2 px-4 pt-3 pb-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
              <Sparkles className="h-3 w-3" />
              <span>Afbeelding genereren</span>
              <button
                onClick={() => setSelectedAction('chat')}
                className="ml-1 hover:bg-primary/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder={getPlaceholder()}
          className={cn(
            'w-full bg-transparent px-4 py-3 text-surface-900 placeholder:text-surface-400',
            'resize-none outline-none',
            'min-h-[52px] max-h-[200px]'
          )}
          rows={1}
          disabled={isLoading || disabled}
        />

        {/* Bottom bar with pills and send button */}
        <div className="flex items-center justify-between px-3 pb-3">
          {/* Left side: Action pills */}
          <div className="flex items-center gap-1.5">
            {ACTION_PILLS.map(pill => (
              <button
                key={pill.id}
                type="button"
                onClick={() => handlePillClick(pill)}
                disabled={disabled || isLoading}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                  'border border-surface-200 hover:border-surface-300',
                  'text-surface-600 hover:text-surface-900 hover:bg-surface-100',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  pill.id === selectedAction && 'bg-primary/10 border-primary/30 text-primary'
                )}
              >
                {pill.icon}
                <span>{pill.label}</span>
              </button>
            ))}
          </div>

          {/* Right side: Send button */}
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={
              (!input.trim() && uploadedFiles.length === 0) ||
              isLoading ||
              disabled ||
              ((selectedAction === 'image_analyze' || selectedAction === 'file_analyze') && uploadedFiles.length === 0)
            }
            className={cn(
              'rounded-full h-9 w-9 p-0 shrink-0',
              'bg-primary hover:bg-primary/90 text-black',
              'disabled:bg-surface-200 disabled:text-surface-400'
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileInputChange}
        multiple
      />

      {/* Model selector - below input, right aligned */}
      {showModelSelector && (
        <div className="flex items-center justify-end mt-2">
          {isImageGenerateMode ? (
            <ImageModelSelector
              value={selectedImageModel}
              onChange={setSelectedImageModel}
              disabled={isLoading || disabled}
              compact
            />
          ) : (
            <ModelSelector
              value={selectedChatModel}
              onChange={setSelectedChatModel}
              disabled={isLoading || disabled}
              compact
            />
          )}
        </div>
      )}
    </div>
  )
}
