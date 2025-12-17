import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

// Use Node.js runtime for file processing
export const runtime = 'nodejs'

interface ExtractRequest {
  documentId: string
}

export async function POST(request: NextRequest) {
  try {
    const body: ExtractRequest = await request.json()
    const { documentId } = body

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Niet ingelogd' },
        { status: 401 }
      )
    }

    // Get document metadata
    const { data: doc, error: docError } = await supabase
      .from('knowledge_documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docError || !doc) {
      return NextResponse.json(
        { error: 'Document niet gevonden' },
        { status: 404 }
      )
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('knowledge-documents')
      .download(doc.file_path)

    if (downloadError || !fileData) {
      await updateDocumentError(supabase, documentId, 'Kon bestand niet downloaden')
      return NextResponse.json(
        { error: 'Kon bestand niet downloaden' },
        { status: 500 }
      )
    }

    let extractedContent = ''

    try {
      // Extract text based on file type
      if (doc.file_type === 'txt' || doc.file_type === 'md') {
        // Plain text - just read it
        extractedContent = await fileData.text()
      } else if (doc.file_type === 'pdf' || doc.file_type === 'docx' || doc.file_type === 'doc' || doc.file_type === 'xlsx' || doc.file_type === 'xls') {
        // For PDF, Word, Excel - use Claude to extract text
        // Convert to base64
        const arrayBuffer = await fileData.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')

        // Determine media type
        const mediaType = getMediaType(doc.file_type)

        if (doc.file_type === 'pdf') {
          // Use Claude's PDF support
          extractedContent = await extractWithClaude(base64, mediaType, doc.name)
        } else {
          // For other formats, try to extract what we can
          // Note: DOCX/XLSX require specialized parsing
          extractedContent = await extractOfficeDocument(fileData, doc.file_type, doc.name)
        }
      } else {
        await updateDocumentError(supabase, documentId, `Onbekend bestandstype: ${doc.file_type}`)
        return NextResponse.json(
          { error: 'Onbekend bestandstype' },
          { status: 400 }
        )
      }

      // Update document with extracted content
      const { error: updateError } = await supabase
        .from('knowledge_documents')
        .update({
          content: extractedContent,
          is_processed: true,
          processing_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId)

      if (updateError) {
        throw updateError
      }

      return NextResponse.json({
        success: true,
        contentLength: extractedContent.length,
      })

    } catch (extractError) {
      const errorMessage = extractError instanceof Error ? extractError.message : 'Extractie mislukt'
      await updateDocumentError(supabase, documentId, errorMessage)
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Knowledge extract error:', error)
    return NextResponse.json(
      { error: 'Er ging iets mis' },
      { status: 500 }
    )
  }
}

async function updateDocumentError(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  error: string
) {
  await supabase
    .from('knowledge_documents')
    .update({
      processing_error: error,
      is_processed: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId)
}

function getMediaType(fileType: string): string {
  const types: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
  }
  return types[fileType] || 'application/octet-stream'
}

async function extractWithClaude(base64: string, mediaType: string, fileName: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key niet geconfigureerd')
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  // Note: Document type requires Anthropic SDK with document support
  // Using 'as any' to bypass type checking for document block
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64,
            },
          } as unknown as Anthropic.TextBlockParam,
          {
            type: 'text',
            text: `Extract all the text content from this document "${fileName}".

Return ONLY the extracted text, preserving the structure and formatting as much as possible.
If it's a template or checklist, keep the structure intact.
Do not add any commentary or analysis - just extract the raw text content.

If the document is in Dutch, keep it in Dutch.`,
          },
        ],
      },
    ],
  })

  const textBlock = response.content.find(block => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Geen tekst kunnen extraheren')
  }

  return textBlock.text
}

async function extractOfficeDocument(fileData: Blob, fileType: string, fileName: string): Promise<string> {
  // For DOCX/XLSX files, we can try to extract text using Claude
  // by converting to base64 and using document understanding

  const arrayBuffer = await fileData.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const mediaType = getMediaType(fileType)

  // Try using Claude for document understanding
  return extractWithClaude(base64, mediaType, fileName)
}
