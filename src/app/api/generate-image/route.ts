import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

// XP reward for image generation
const IMAGE_XP_REWARD = 20

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not set')
      return NextResponse.json(
        { error: 'OpenAI API key ontbreekt. Voeg OPENAI_API_KEY toe aan je .env.local bestand.' },
        { status: 500 }
      )
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const supabase = await createClient()

    const body = await request.json()
    const { prompt, size = '1024x1024', style = 'vivid', quality = 'standard', tool = 'social-image', clientId } = body

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is vereist' },
        { status: 400 }
      )
    }

    // Get client context if clientId provided
    let clientContextPrompt = ''
    if (clientId) {
      const clientContext = await getClientContextForImage(supabase, clientId)
      if (clientContext) {
        clientContextPrompt = clientContext
      }
    }

    // Enhance prompt for better DALL-E results, including client context
    const enhancedPrompt = `Create a professional marketing image: ${prompt}. ${clientContextPrompt}High quality, suitable for business use, clean design.`

    // Generate image with DALL-E 3
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: enhancedPrompt,
      n: 1,
      size: size as '1024x1024' | '1792x1024' | '1024x1792',
      style: style as 'vivid' | 'natural',
      quality: quality as 'standard' | 'hd',
    })

    const imageData = response.data?.[0]
    const imageUrl = imageData?.url
    const revisedPrompt = imageData?.revised_prompt

    if (!imageUrl) {
      throw new Error('Geen afbeelding ontvangen van DALL-E')
    }

    // Track usage, add XP, and save generation (fire and forget)
    const generationId = await trackImageUsageAndXP(tool, prompt, imageUrl, revisedPrompt || enhancedPrompt, clientId)

    return NextResponse.json({
      success: true,
      imageUrl,
      revisedPrompt,
      generationId,
    })
  } catch (error) {
    console.error('Image generation error:', error)

    if (error instanceof OpenAI.APIError) {
      console.error('OpenAI API Error details:', {
        status: error.status,
        message: error.message,
        code: error.code,
      })

      if (error.status === 401) {
        return NextResponse.json(
          { error: 'Ongeldige OpenAI API key. Controleer je OPENAI_API_KEY.' },
          { status: 401 }
        )
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'Te veel verzoeken of krediet op. Check je OpenAI account.' },
          { status: 429 }
        )
      }
      if (error.status === 400) {
        // More specific error message
        const errorMessage = error.message || ''
        if (errorMessage.includes('content_policy')) {
          return NextResponse.json(
            { error: 'Je prompt bevat content die niet is toegestaan. Probeer een andere beschrijving zonder merknamen of gevoelige content.' },
            { status: 400 }
          )
        }
        if (errorMessage.includes('billing') || errorMessage.includes('quota')) {
          return NextResponse.json(
            { error: 'Je OpenAI account heeft geen krediet meer. Voeg betaalgegevens toe op platform.openai.com.' },
            { status: 400 }
          )
        }
        return NextResponse.json(
          { error: `Prompt afgewezen: ${errorMessage || 'Probeer een andere beschrijving.'}` },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Er ging iets mis bij het genereren van de afbeelding.' },
      { status: 500 }
    )
  }
}

// Get client context for image generation (simplified for visual content)
async function getClientContextForImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string
): Promise<string | null> {
  try {
    // Verify client access
    const { data: clientAccess } = await supabase
      .rpc('has_client_access', { check_client_id: clientId, min_role: 'viewer' })

    if (!clientAccess) {
      return null
    }

    // Fetch client with context
    const { data: client } = await supabase
      .from('clients')
      .select('name, settings')
      .eq('id', clientId)
      .single()

    if (!client) {
      return null
    }

    const clientContext = (client.settings as { context?: Record<string, unknown> })?.context
    if (!clientContext) {
      return null
    }

    const ctx = clientContext as {
      toneOfVoice?: string
      brandVoice?: string
    }

    // Build a concise context for image generation
    const contextParts: string[] = []

    if (ctx.brandVoice) {
      contextParts.push(`Brand style: ${ctx.brandVoice}.`)
    }
    if (ctx.toneOfVoice) {
      contextParts.push(`Visual tone: ${ctx.toneOfVoice}.`)
    }

    return contextParts.length > 0 ? contextParts.join(' ') + ' ' : null
  } catch (error) {
    console.error('Error fetching client context for image:', error)
    return null
  }
}

// Track image usage, add XP to user, and save generation
async function trackImageUsageAndXP(
  tool: string,
  prompt: string,
  imageUrl: string,
  revisedPrompt: string,
  clientId?: string
): Promise<string | null> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log('No authenticated user for image XP tracking')
      return null
    }

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

    // Save generation to database
    const { data: generation, error: genError } = await supabase
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

    if (genError) {
      console.error('Error saving generation:', genError)
    }

    // Update user XP and total generations
    const { data: profile } = await supabase
      .from('profiles')
      .select('xp, total_generations')
      .eq('id', user.id)
      .single()

    if (profile) {
      const newXp = (profile.xp || 0) + IMAGE_XP_REWARD
      const newLevel = Math.floor(newXp / 100) + 1
      const newGenerations = (profile.total_generations || 0) + 1

      await supabase
        .from('profiles')
        .update({
          xp: newXp,
          level: newLevel,
          total_generations: newGenerations,
        })
        .eq('id', user.id)
    }

    return generation?.id || null
  } catch (error) {
    console.error('Error tracking image usage/XP:', error)
    return null
  }
}
