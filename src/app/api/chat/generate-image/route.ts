import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

interface GenerateImageRequest {
  prompt: string
  conversationId?: string
  clientId?: string
  assistantSlug?: string
  size?: '1024x1024' | '1792x1024' | '1024x1792'
  quality?: 'standard' | 'hd'
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
      size = '1024x1024',
      quality = 'standard',
      style = 'vivid',
    } = body

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

    // Generate image using DALL-E 3
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: size,
      quality: quality,
      style: style,
      response_format: 'url',
    })

    if (!response.data || response.data.length === 0) {
      return NextResponse.json(
        { error: 'Geen afbeelding gegenereerd' },
        { status: 500 }
      )
    }

    const generatedImageUrl = response.data[0].url
    const revisedPrompt = response.data[0].revised_prompt

    if (!generatedImageUrl) {
      return NextResponse.json(
        { error: 'Geen afbeelding gegenereerd' },
        { status: 500 }
      )
    }

    // Download the generated image and upload to Supabase Storage
    // (OpenAI URLs expire after a while)
    const imageResponse = await fetch(generatedImageUrl)
    if (!imageResponse.ok) {
      throw new Error('Failed to fetch generated image')
    }

    const imageBlob = await imageResponse.blob()
    const arrayBuffer = await imageBlob.arrayBuffer()

    // Generate unique file path
    const date = new Date().toISOString().split('T')[0]
    const randomId = Math.random().toString(36).substring(2, 15)
    const filePath = `${user.id}/${date}/generated-${randomId}.png`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(filePath, arrayBuffer, {
        contentType: 'image/png',
        cacheControl: '31536000',
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      // Return OpenAI URL as fallback (will expire)
      return NextResponse.json({
        success: true,
        image: {
          url: generatedImageUrl,
          isTemporary: true,
          prompt: prompt,
          revisedPrompt: revisedPrompt,
        },
      })
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
          file_size: arrayBuffer.byteLength,
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

    // Log usage
    await supabase.from('usage').insert({
      user_id: user.id,
      tool: 'image-generation',
      action_type: 'image_generate',
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

    return NextResponse.json({
      success: true,
      image: {
        id: attachmentId,
        url: publicUrl,
        filePath: filePath,
        isTemporary: false,
        prompt: prompt,
        revisedPrompt: revisedPrompt,
        width: parseInt(size.split('x')[0]),
        height: parseInt(size.split('x')[1]),
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
