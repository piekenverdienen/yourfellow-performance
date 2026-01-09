'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import {
  FileText,
  Sparkles,
  Download,
  ExternalLink,
  X,
} from 'lucide-react'
import type { Message, MessageAttachment } from '@/types'

interface MultimodalMessageProps {
  message: Message
  isUser: boolean
  assistantAvatar?: React.ReactNode
}

interface ImageModalProps {
  src: string
  alt: string
  onClose: () => void
}

function ImageModal({ src, alt, onClose }: ImageModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
      >
        <X className="h-6 w-6" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-full object-contain rounded-lg"
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}

function AttachmentPreview({ attachment }: { attachment: MessageAttachment }) {
  const [showModal, setShowModal] = useState(false)

  if (attachment.attachment_type === 'image' || attachment.attachment_type === 'generated_image') {
    return (
      <>
        <div
          className="relative group cursor-pointer"
          onClick={() => setShowModal(true)}
        >
          <img
            src={attachment.public_url}
            alt={attachment.file_name}
            className="max-w-[300px] max-h-[200px] rounded-lg object-cover"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center">
            <ExternalLink className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          {attachment.attachment_type === 'generated_image' && (
            <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-primary/90 text-white text-xs rounded-full">
              <Sparkles className="h-3 w-3" />
              <span>AI Gegenereerd</span>
            </div>
          )}
        </div>
        {showModal && (
          <ImageModal
            src={attachment.public_url}
            alt={attachment.file_name}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    )
  }

  // Document attachment
  return (
    <a
      href={attachment.public_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 bg-surface-100 hover:bg-surface-200 rounded-lg transition-colors group"
    >
      <div className="p-2 bg-surface-200 group-hover:bg-surface-300 rounded-lg transition-colors">
        <FileText className="h-5 w-5 text-surface-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment.file_name}</p>
        <p className="text-xs text-surface-500">
          {(attachment.file_size / 1024).toFixed(1)} KB
        </p>
      </div>
      <Download className="h-4 w-4 text-surface-400 group-hover:text-surface-600 transition-colors" />
    </a>
  )
}

export function MultimodalMessage({
  message,
  isUser,
  assistantAvatar,
}: MultimodalMessageProps) {
  const hasAttachments = message.attachments && message.attachments.length > 0
  const isImageGeneration = message.content_type === 'image_generation'
  const isMultimodal = message.content_type === 'multimodal'
  const isFileAnalysis = message.content_type === 'file_analysis'

  return (
    <div
      className={cn(
        'flex gap-4',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && assistantAvatar}
      <div className={cn('flex flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
        {/* Attachments (show before text for user messages) */}
        {isUser && hasAttachments && (
          <div className="flex flex-wrap gap-2 max-w-[75%]">
            {message.attachments!.map(attachment => (
              <AttachmentPreview key={attachment.id} attachment={attachment} />
            ))}
          </div>
        )}

        {/* Message content */}
        {message.content && (
          <div
            className={cn(
              'rounded-2xl inline-block',
              isUser
                ? 'bg-gradient-to-br from-surface-800 to-surface-900 text-white px-4 py-2.5 shadow-md max-w-[70%]'
                : 'bg-surface-50/80 px-5 py-4 max-w-[70%]'
            )}
          >
            <div
              className={cn(
                'text-[15px] leading-relaxed whitespace-pre-wrap',
                isUser
                  ? 'text-white'
                  : 'text-surface-700'
              )}
            >
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="my-0">{children}</p>,
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Attachments (show after text for assistant messages - generated images) */}
        {!isUser && hasAttachments && (
          <div className="flex flex-wrap gap-2 max-w-[75%]">
            {message.attachments!.map(attachment => (
              <AttachmentPreview key={attachment.id} attachment={attachment} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
