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

    const body = await request.json()
    const { prompt, size = '1024x1024', quality = 'medium', tool = 'social-image' } = body

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is vereist' },
        { status: 400 }
      )
    }

    // Enhance prompt for better GPT Image results
    const enhancedPrompt = `Create a professional marketing image: ${prompt}. High quality, suitable for business use, clean design.`

    // Map old sizes to new gpt-image-1 sizes
    const sizeMap: Record<string, '1024x1024' | '1536x1024' | '1024x1536' | 'auto'> = {
      '1024x1024': '1024x1024',
      '1792x1024': '1536x1024',  // landscape
      '1536x1024': '1536x1024',  // landscape (new)
      '1024x1792': '1024x1536',  // portrait
      '1024x1536': '1024x1536',  // portrait (new)
    }
    const mappedSize = sizeMap[size] || '1024x1024'

    // Generate image with GPT Image (gpt-image-1)
    // Note: gpt-image-1 requires organization verification on OpenAI
    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: enhancedPrompt,
      n: 1,
      size: mappedSize,
      quality: quality as 'low' | 'medium' | 'high',
    })

    console.log('OpenAI response:', JSON.stringify(response, null, 2))

    const imageData = response.data?.[0]
    // gpt-image-1 returns base64 encoded images by default
    const b64Image = imageData?.b64_json
    const imageUrl_fromApi = imageData?.url
    const revisedPrompt = imageData?.revised_prompt

    // Handle both base64 and URL responses
    let imageUrl: string
    if (b64Image) {
      imageUrl = `data:image/png;base64,${b64Image}`
    } else if (imageUrl_fromApi) {
      // Fallback: if URL is returned, fetch and convert to base64
      // This handles cases where the model returns URL instead of base64
      const imageResponse = await fetch(imageUrl_fromApi)
      const arrayBuffer = await imageResponse.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      imageUrl = `data:image/png;base64,${base64}`
    } else {
      console.error('No image data in response:', imageData)
      throw new Error('Geen afbeelding ontvangen van GPT Image')
    }

    // Track usage, add XP, and save generation (fire and forget)
    const generationId = await trackImageUsageAndXP(tool, prompt, imageUrl, revisedPrompt || enhancedPrompt)

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
        if (errorMessage.includes('model') || errorMessage.includes('gpt-image')) {
          return NextResponse.json(
            { error: 'gpt-image-1 model is niet beschikbaar. Mogelijk moet je eerst je organisatie verifiëren op platform.openai.com.' },
            { status: 400 }
          )
        }
        return NextResponse.json(
          { error: `Prompt afgewezen: ${errorMessage || 'Probeer een andere beschrijving.'}` },
          { status: 400 }
        )
      }
      if (error.status === 404) {
        return NextResponse.json(
          { error: 'gpt-image-1 model niet gevonden. Controleer of je OpenAI account toegang heeft tot dit model.' },
          { status: 404 }
        )
      }
    }

    // Log the full error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Full error:', errorMessage)

    return NextResponse.json(
      { error: `Er ging iets mis: ${errorMessage}` },
      { status: 500 }
    )
  }
}

// Track image usage, add XP to user, and save generation
async function trackImageUsageAndXP(
  tool: string,
  prompt: string,
  imageUrl: string,
  revisedPrompt: string
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
    })

    // Save generation to database
    const { data: generation, error: genError } = await supabase
      .from('generations')
      .insert({
        user_id: user.id,
        tool,
        input: { prompt },
        output: { imageUrl, revisedPrompt },
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
