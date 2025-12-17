import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

// Max file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
]

function getFileType(mimeType: string): 'image' | 'document' | null {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return 'image'
  if (ALLOWED_DOCUMENT_TYPES.includes(mimeType)) return 'document'
  return null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Niet ingelogd' },
        { status: 401 }
      )
    }

    // Get form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const conversationId = formData.get('conversationId') as string | null
    const clientId = formData.get('clientId') as string | null
    const assistantSlug = formData.get('assistantSlug') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'Geen bestand gevonden' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Bestand is te groot (max 50MB)' },
        { status: 400 }
      )
    }

    // Validate file type
    const fileType = getFileType(file.type)
    if (!fileType) {
      return NextResponse.json(
        { error: 'Bestandstype niet ondersteund' },
        { status: 400 }
      )
    }

    // Generate unique file path: {user_id}/{date}/{random}-{filename}
    const date = new Date().toISOString().split('T')[0]
    const randomId = Math.random().toString(36).substring(2, 15)
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `${user.id}/${date}/${randomId}-${safeFileName}`

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer()
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        cacheControl: '31536000', // 1 year cache
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Upload mislukt: ' + uploadError.message },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(filePath)

    const publicUrl = urlData.publicUrl

    // Create attachment record (without message_id initially)
    const attachmentData = {
      conversation_id: conversationId || null,
      user_id: user.id,
      attachment_type: fileType,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      file_path: filePath,
      public_url: publicUrl,
      client_id: clientId || null,
      assistant_slug: assistantSlug || null,
    }

    // Only insert if we have a conversation ID
    // Otherwise, we'll create the attachment record when the message is sent
    let attachmentId: string | null = null
    if (conversationId) {
      const { data: attachment, error: attachmentError } = await supabase
        .from('message_attachments')
        .insert(attachmentData)
        .select('id')
        .single()

      if (attachmentError) {
        console.error('Attachment record error:', attachmentError)
        // Don't fail - the file is uploaded, we can still use it
      } else {
        attachmentId = attachment.id
      }
    }

    // Extract text from documents (for future RAG integration)
    let extractedText: string | null = null
    if (fileType === 'document') {
      // TODO: Implement text extraction
      // For now, we'll handle this in the chat API when processing the message
      // Future: Call document extraction service here
    }

    return NextResponse.json({
      success: true,
      attachment: {
        id: attachmentId,
        type: fileType,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        filePath,
        publicUrl,
        extractedText,
      },
    })
  } catch (error) {
    console.error('Upload API error:', error)
    return NextResponse.json(
      { error: 'Er ging iets mis bij het uploaden' },
      { status: 500 }
    )
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
