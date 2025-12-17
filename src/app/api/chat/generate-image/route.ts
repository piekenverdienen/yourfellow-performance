import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

type ImageModel = 'dall-e-3' | 'dall-e-2' | 'gpt-image-1'

interface GenerateImageRequest {
  prompt: string
  conversationId?: string
  clientId?: string
  assistantSlug?: string
  model?: ImageModel
  size?: '1024x1024' | '1792x1024' | '1024x1792' | '512x512' | '256x256'
  quality?: 'standard' | 'hd' | 'low' | 'medium' | 'high'
  style?: 'vivid' | 'natural'
}

export async function POST(request: NextRequest) {
  try {
    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API is niet geconfigureerd' },
        { status: 500 }
      )
    }

    const supabase = await createClient()

    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Niet ingelogd' },
        { status: 401 }
      )
    }

    const body: GenerateImageRequest = await request.json()
    const {
      prompt,
      conversationId,
      clientId,
      assistantSlug,
      model = 'dall-e-3',
      size: requestedSize,
      quality: requestedQuality,
      style = 'vivid',
    } = body

    // Model-specific defaults and validations
    const getModelConfig = (modelId: ImageModel) => {
      switch (modelId) {
        case 'dall-e-2':
          return {
            model: 'dall-e-2' as const,
            size: (requestedSize && ['256x256', '512x512', '1024x1024'].includes(requestedSize)
              ? requestedSize : '1024x1024') as '256x256' | '512x512' | '1024x1024',
            quality: undefined, // DALL-E 2 doesn't support quality
            style: undefined, // DALL-E 2 doesn't support style
            supportsN: true,
          }
        case 'gpt-image-1':
          return {
            model: 'gpt-image-1' as const,
            size: (requestedSize && ['1024x1024', '1536x1024', '1024x1536'].includes(requestedSize)
              ? requestedSize : '1024x1024') as '1024x1024' | '1536x1024' | '1024x1536',
            quality: (requestedQuality && ['low', 'medium', 'high'].includes(requestedQuality)
              ? requestedQuality : 'medium') as 'low' | 'medium' | 'high',
            style: undefined, // GPT Image doesn't support style
            supportsN: true,
          }
        case 'dall-e-3':
        default:
          return {
            model: 'dall-e-3' as const,
            size: (requestedSize && ['1024x1024', '1792x1024', '1024x1792'].includes(requestedSize)
              ? requestedSize : '1024x1024') as '1024x1024' | '1792x1024' | '1024x1792',
            quality: (requestedQuality === 'hd' ? 'hd' : 'standard') as 'standard' | 'hd',
            style: style,
            supportsN: false, // DALL-E 3 only supports n=1
          }
      }
    }

    const modelConfig = getModelConfig(model)

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'Prompt is verplicht' },
        { status: 400 }
      )
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Generate image using selected model
    // gpt-image-1 uses a different API format (no response_format, returns base64)
    let imageArrayBuffer: ArrayBuffer
    let revisedPrompt: string | undefined

    if (model === 'gpt-image-1') {
      // GPT Image model - uses different API parameters
      const gptImageRequest = {
        model: 'gpt-image-1' as const,
        prompt: prompt,
        n: 1,
        size: modelConfig.size as '1024x1024' | '1536x1024' | '1024x1536',
        quality: modelConfig.quality as 'low' | 'medium' | 'high',
      }

      const response = await openai.images.generate(gptImageRequest)

      if (!response.data || response.data.length === 0) {
        return NextResponse.json(
          { error: 'Geen afbeelding gegenereerd' },
          { status: 500 }
        )
      }

      // gpt-image-1 returns base64 data (b64_json)
      const imageData = response.data[0]
      if (imageData.b64_json) {
        // Decode base64 to ArrayBuffer
        const binaryString = atob(imageData.b64_json)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        imageArrayBuffer = bytes.buffer
      } else if (imageData.url) {
        // Fallback to URL if available
        const imageResponse = await fetch(imageData.url)
        if (!imageResponse.ok) {
          throw new Error('Failed to fetch generated image')
        }
        imageArrayBuffer = await imageResponse.arrayBuffer()
      } else {
        return NextResponse.json(
          { error: 'Geen afbeelding gegenereerd' },
          { status: 500 }
        )
      }

      revisedPrompt = imageData.revised_prompt
    } else {
      // DALL-E 2/3 - standard API with URL response
      const dalleRequest: Parameters<typeof openai.images.generate>[0] = {
        model: modelConfig.model,
        prompt: prompt,
        n: 1,
        size: modelConfig.size as '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792',
        response_format: 'url',
      }

      // Add optional parameters based on model support
      if (modelConfig.quality !== undefined) {
        dalleRequest.quality = modelConfig.quality as 'standard' | 'hd'
      }
      if (modelConfig.style !== undefined) {
        dalleRequest.style = modelConfig.style
      }

      const response = await openai.images.generate(dalleRequest)

      if (!response.data || response.data.length === 0) {
        return NextResponse.json(
          { error: 'Geen afbeelding gegenereerd' },
          { status: 500 }
        )
      }

      const generatedImageUrl = response.data[0].url
      revisedPrompt = response.data[0].revised_prompt

      if (!generatedImageUrl) {
        return NextResponse.json(
          { error: 'Geen afbeelding gegenereerd' },
          { status: 500 }
        )
      }

      // Download the generated image (OpenAI URLs expire)
      const imageResponse = await fetch(generatedImageUrl)
      if (!imageResponse.ok) {
        throw new Error('Failed to fetch generated image')
      }

      imageArrayBuffer = await imageResponse.arrayBuffer()
    }

    // Generate unique file path
    const date = new Date().toISOString().split('T')[0]
    const randomId = Math.random().toString(36).substring(2, 15)
    const filePath = `${user.id}/${date}/generated-${randomId}.png`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(filePath, imageArrayBuffer, {
        contentType: 'image/png',
        cacheControl: '31536000',
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      // Return error - we can't provide a fallback URL for base64 responses
      return NextResponse.json(
        { error: 'Afbeelding kon niet worden opgeslagen' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(filePath)

    const publicUrl = urlData.publicUrl

    // Create attachment record
    let attachmentId: string | null = null
    if (conversationId) {
      const { data: attachment, error: attachmentError } = await supabase
        .from('message_attachments')
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          attachment_type: 'generated_image',
          file_name: `generated-${randomId}.png`,
          file_type: 'image/png',
          file_size: imageArrayBuffer.byteLength,
          file_path: filePath,
          public_url: publicUrl,
          generation_prompt: prompt,
          client_id: clientId || null,
          assistant_slug: assistantSlug || null,
        })
        .select('id')
        .single()

      if (!attachmentError && attachment) {
        attachmentId = attachment.id
      }
    }

    // Log usage with model info
    await supabase.from('usage').insert({
      user_id: user.id,
      tool: 'image-generation',
      action_type: 'image_generate',
      model: modelConfig.model,
      total_tokens: 0, // Image generation doesn't use tokens in the same way
      client_id: clientId || null,
    })

    // Update XP
    const { data: profile } = await supabase
      .from('profiles')
      .select('xp, total_generations')
      .eq('id', user.id)
      .single()

    if (profile) {
      const xpToAdd = 15 // Higher XP for image generation
      const newXp = (profile.xp || 0) + xpToAdd
      const newLevel = Math.floor(newXp / 100) + 1

      await supabase
        .from('profiles')
        .update({
          xp: newXp,
          level: newLevel,
          total_generations: (profile.total_generations || 0) + 1,
        })
        .eq('id', user.id)
    }

    // Parse dimensions from model config size
    const [width, height] = modelConfig.size.split('x').map(Number)

    return NextResponse.json({
      success: true,
      image: {
        id: attachmentId,
        url: publicUrl,
        filePath: filePath,
        isTemporary: false,
        prompt: prompt,
        revisedPrompt: revisedPrompt,
        model: modelConfig.model,
        width,
        height,
      },
    })
  } catch (error) {
    console.error('Image generation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Check for specific OpenAI errors
    if (errorMessage.includes('content_policy')) {
      return NextResponse.json(
        { error: 'De prompt is in strijd met de content richtlijnen. Probeer een andere beschrijving.' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Er ging iets mis bij het genereren van de afbeelding' },
      { status: 500 }
    )
  }
}
