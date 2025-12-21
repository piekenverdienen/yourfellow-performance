/**
 * Image Generation API Route
 *
 * Uses imageEngine for provider-agnostic image generation.
 * Separate from AI Gateway (text-only).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { imageEngine, type ImageProvider } from '@/lib/image'

// XP reward for image generation
const IMAGE_XP_REWARD = 20

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Parse request (FormData or JSON)
    const contentType = request.headers.get('content-type') || ''
    let prompt: string
    let provider: ImageProvider = 'openai'
    let size = '1024x1024'
    let quality = 'medium'
    let tool = 'social-image'
    let clientId: string | undefined
    let referenceImage: File | null = null

    let model = 'gpt-image'

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      prompt = formData.get('prompt') as string
      model = (formData.get('model') as string) || 'gpt-image'
      provider = model === 'gemini-flash' ? 'gemini' : 'openai'
      size = (formData.get('size') as string) || '1024x1024'
      quality = (formData.get('quality') as string) || 'medium'
      tool = (formData.get('tool') as string) || 'social-image'
      clientId = (formData.get('clientId') as string) || undefined
      referenceImage = formData.get('referenceImage') as File | null
    } else {
      const body = await request.json()
      prompt = body.prompt
      model = body.model || 'gpt-image'
      provider = model === 'gemini-flash' ? 'gemini' : 'openai'
      size = body.size || '1024x1024'
      quality = body.quality || 'medium'
      tool = body.tool || 'social-image'
      clientId = body.clientId
    }

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is vereist' },
        { status: 400 }
      )
    }

    // Get client context if provided
    let enhancedPrompt = prompt
    if (clientId) {
      const clientContext = await getClientContextForImage(supabase, clientId)
      if (clientContext) {
        enhancedPrompt = `${prompt}. ${clientContext}`
      }
    }

    // Add quality suffix
    enhancedPrompt = referenceImage
      ? `${enhancedPrompt} High quality, suitable for business use.`
      : `Create a professional marketing image: ${enhancedPrompt} High quality, suitable for business use, clean design.`

    // Determine the actual model to use
    const actualModel = model === 'gemini-flash' ? 'gemini-2.5-flash-image'
      : model === 'dall-e-3' ? 'dall-e-3'
      : model === 'dall-e-2' ? 'dall-e-2'
      : 'gpt-image-1'

    // Generate image via imageEngine
    const result = await imageEngine.generateImage({
      provider,
      prompt: enhancedPrompt,
      model: actualModel,
      size: size as '1024x1024' | '1536x1024' | '1024x1536',
      quality: quality as 'low' | 'medium' | 'high',
      referenceImage,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Image generatie mislukt' },
        { status: 400 }
      )
    }

    // Track usage and XP (fire and forget)
    const generationId = await trackImageUsageAndXP(
      supabase,
      tool,
      prompt,
      result.imageUrl!,
      result.revisedPrompt || enhancedPrompt,
      clientId
    )

    return NextResponse.json({
      success: true,
      imageUrl: result.imageUrl,
      revisedPrompt: result.revisedPrompt,
      generationId,
      _image: {
        provider,
        model: actualModel,
        size,
        quality,
      },
    })
  } catch (error) {
    console.error('Image generation error:', error)
    return NextResponse.json(
      { error: 'Er ging iets mis bij het genereren van de afbeelding.' },
      { status: 500 }
    )
  }
}

// ============================================
// Helper Functions
// ============================================

async function getClientContextForImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string
): Promise<string | null> {
  try {
    const { data: clientAccess } = await supabase
      .rpc('has_client_access', { check_client_id: clientId, min_role: 'viewer' })

    if (!clientAccess) return null

    const { data: client } = await supabase
      .from('clients')
      .select('name, settings')
      .eq('id', clientId)
      .single()

    if (!client) return null

    const clientContext = (client.settings as { context?: Record<string, unknown> })?.context
    if (!clientContext) return null

    const ctx = clientContext as {
      toneOfVoice?: string
      brandVoice?: string
    }

    const contextParts: string[] = []
    if (ctx.brandVoice) contextParts.push(`Brand style: ${ctx.brandVoice}.`)
    if (ctx.toneOfVoice) contextParts.push(`Visual tone: ${ctx.toneOfVoice}.`)

    return contextParts.length > 0 ? contextParts.join(' ') : null
  } catch (error) {
    console.error('Error fetching client context for image:', error)
    return null
  }
}

async function trackImageUsageAndXP(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tool: string,
  prompt: string,
  imageUrl: string,
  revisedPrompt: string,
  clientId?: string
): Promise<string | null> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return null

    // Insert usage record
    await supabase.from('usage').insert({
      user_id: user.id,
      tool,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      metadata: { type: 'image' },
      client_id: clientId || null,
    })

    // Save generation
    const { data: generation } = await supabase
      .from('generations')
      .insert({
        user_id: user.id,
        tool,
        input: { prompt },
        output: { imageUrl, revisedPrompt },
        client_id: clientId || null,
      })
      .select('id')
      .single()

    // Update XP
    const { data: profile } = await supabase
      .from('profiles')
      .select('xp, total_generations')
      .eq('id', user.id)
      .single()

    if (profile) {
      const newXp = (profile.xp || 0) + IMAGE_XP_REWARD
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

    return generation?.id || null
  } catch (error) {
    console.error('Error tracking image usage/XP:', error)
    return null
  }
}
