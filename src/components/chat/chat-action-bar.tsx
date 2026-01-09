'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Plus,
  Send,
  Loader2,
  Image as ImageIcon,
  Sparkles,
  FileText,
  MessageSquare,
  X,
  Upload,
  Square,
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
  onCancel?: () => void
  isLoading: boolean
  placeholder?: string
  disabled?: boolean
  showModelSelector?: boolean
}

interface ActionOption {
  id: ChatActionType
  label: string
  description: string
  icon: React.ReactNode
  acceptedFiles?: string
}

const ACTION_OPTIONS: ActionOption[] = [
  {
    id: 'chat',
    label: 'Tekst chat',
    description: 'Normale tekst conversatie',
    icon: <MessageSquare className="h-4 w-4" />,
  },
  {
    id: 'image_analyze',
    label: 'Afbeelding analyseren',
    description: 'Upload een afbeelding voor analyse',
    icon: <ImageIcon className="h-4 w-4" />,
    acceptedFiles: 'image/jpeg,image/png,image/webp,image/gif',
  },
  {
    id: 'image_generate',
    label: 'Afbeelding genereren',
    description: 'Genereer een afbeelding met AI',
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    id: 'file_analyze',
    label: 'Bestand analyseren',
    description: 'Upload PDF, DOCX of CSV',
    icon: <FileText className="h-4 w-4" />,
    acceptedFiles: 'application/pdf,.pdf,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,text/csv,.csv',
  },
]

export function ChatActionBar({
  onSubmit,
  onCancel,
  isLoading,
  placeholder = 'Typ een bericht...',
  disabled = false,
  showModelSelector = true,
}: ChatActionBarProps) {
  const [input, setInput] = useState('')
  const [selectedAction, setSelectedAction] = useState<ChatActionType>('chat')
  const [showActionMenu, setShowActionMenu] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [selectedChatModel, setSelectedChatModel] = useState<ChatModelId>('claude-sonnet')
  const [selectedImageModel, setSelectedImageModel] = useState<ImageModelId>('dall-e-3')

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentAction = ACTION_OPTIONS.find(a => a.id === selectedAction)

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

  const handleActionSelect = (action: ChatActionType) => {
    setSelectedAction(action)
    setShowActionMenu(false)

    // Open file picker if action requires files
    const actionConfig = ACTION_OPTIONS.find(a => a.id === action)
    if (actionConfig?.acceptedFiles && fileInputRef.current) {
      fileInputRef.current.accept = actionConfig.acceptedFiles
      fileInputRef.current.click()
    }

    textareaRef.current?.focus()
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
        return 'Beschrijf wat je wilt weten over de afbeelding...'
      case 'image_generate':
        return 'Beschrijf de afbeelding die je wilt genereren...'
      case 'file_analyze':
        return 'Stel een vraag over het bestand...'
      default:
        return placeholder
    }
  }

  return (
    <div
      className={cn(
        'relative p-4 border-t border-surface-200 bg-white',
        isDragging && 'ring-2 ring-primary ring-inset bg-primary/5'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/10 z-10 pointer-events-none">
          <div className="flex items-center gap-2 text-primary font-medium">
            <Upload className="h-5 w-5" />
            <span>Sleep bestand hier</span>
          </div>
        </div>
      )}

      {/* Uploaded files preview */}
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {uploadedFiles.map(file => (
            <div
              key={file.id}
              className="relative group flex items-center gap-2 px-3 py-2 bg-surface-100 rounded-lg"
            >
              {file.preview ? (
                <img
                  src={file.preview}
                  alt={file.file.name}
                  className="w-10 h-10 object-cover rounded"
                />
              ) : (
                <FileText className="h-5 w-5 text-surface-500" />
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate max-w-[150px]">
                  {file.file.name}
                </span>
                <span className="text-xs text-surface-500">
                  {(file.file.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <button
                onClick={() => removeFile(file.id)}
                className="absolute -top-1 -right-1 p-1 bg-surface-200 hover:bg-surface-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        {/* Action menu button */}
        <div className="relative">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowActionMenu(!showActionMenu)}
            className={cn(
              'shrink-0 h-[44px] w-[44px] p-0',
              selectedAction !== 'chat' && 'border-primary text-primary'
            )}
            disabled={disabled}
          >
            {currentAction?.icon || <Plus className="h-5 w-5" />}
          </Button>

          {/* Action dropdown */}
          {showActionMenu && (
            <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-lg shadow-lg border border-surface-200 py-1 z-20">
              {ACTION_OPTIONS.map(action => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleActionSelect(action.id)}
                  className={cn(
                    'w-full px-3 py-2 text-left hover:bg-surface-50 transition-colors flex items-start gap-3',
                    selectedAction === action.id && 'bg-primary/10'
                  )}
                >
                  <span className={cn(
                    'mt-0.5',
                    selectedAction === action.id ? 'text-primary' : 'text-surface-500'
                  )}>
                    {action.icon}
                  </span>
                  <div>
                    <div className={cn(
                      'font-medium text-sm',
                      selectedAction === action.id && 'text-primary'
                    )}>
                      {action.label}
                    </div>
                    <div className="text-xs text-surface-500">{action.description}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text input */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            className="resize-none min-h-[44px] max-h-32 pr-10"
            rows={1}
            disabled={isLoading || disabled}
          />
          {/* Quick file upload button inside textarea */}
          {selectedAction === 'chat' && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-surface-100 rounded text-surface-400 hover:text-surface-600 transition-colors"
              disabled={disabled}
            >
              <Upload className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Submit/Stop button */}
        {isLoading && onCancel ? (
          <Button
            type="button"
            onClick={onCancel}
            variant="destructive"
            className="shrink-0 h-[44px]"
          >
            <Square className="h-4 w-4 mr-1.5 fill-current" />
            Stop
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={
              (!input.trim() && uploadedFiles.length === 0) ||
              isLoading ||
              disabled ||
              ((selectedAction === 'image_analyze' || selectedAction === 'file_analyze') && uploadedFiles.length === 0)
            }
            className="shrink-0 h-[44px]"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        )}
      </form>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileInputChange}
        multiple
        accept={currentAction?.acceptedFiles}
      />

      {/* Model selector and help text */}
      <div className="flex items-center justify-between mt-2">
        {showModelSelector && (
          <div className="flex items-center gap-2">
            {selectedAction === 'image_generate' ? (
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
        <p className={cn(
          "text-xs text-surface-500",
          !showModelSelector && "text-center w-full"
        )}>
          {selectedAction === 'chat' && 'Enter om te versturen, Shift+Enter voor nieuwe regel'}
          {selectedAction === 'image_analyze' && 'Upload een afbeelding en stel een vraag'}
          {selectedAction === 'image_generate' && 'Beschrijf de afbeelding die je wilt maken'}
          {selectedAction === 'file_analyze' && 'Upload een bestand (PDF, DOCX, CSV) en stel een vraag'}
        </p>
      </div>
    </div>
  )
}
