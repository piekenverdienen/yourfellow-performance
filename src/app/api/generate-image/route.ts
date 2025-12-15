import { NextRequest, NextResponse } from 'next/server'
import OpenAI, { toFile } from 'openai'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '@/lib/supabase/server'

// XP reward for image generation
const IMAGE_XP_REWARD = 20

// Types for image generation result
interface ImageGenerationResult {
  imageUrl: string
  revisedPrompt?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check content type to determine how to parse the request
    const contentType = request.headers.get('content-type') || ''
    let prompt: string
    let model = 'gpt-image'
    let size = '1024x1024'
    let quality = 'medium'
    let tool = 'social-image'
    let clientId: string | undefined
    let referenceImageFile: File | null = null

    if (contentType.includes('multipart/form-data')) {
      // Parse FormData (with reference image)
      const formData = await request.formData()
      prompt = formData.get('prompt') as string
      model = (formData.get('model') as string) || 'gpt-image'
      size = (formData.get('size') as string) || '1024x1024'
      quality = (formData.get('quality') as string) || 'medium'
      tool = (formData.get('tool') as string) || 'social-image'
      clientId = (formData.get('clientId') as string) || undefined
      referenceImageFile = formData.get('referenceImage') as File | null
    } else {
      // Parse JSON (without reference image)
      const body = await request.json()
      prompt = body.prompt
      model = body.model || 'gpt-image'
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

    // Get client context if clientId provided
    let clientContextPrompt = ''
    if (clientId) {
      const clientContext = await getClientContextForImage(supabase, clientId)
      if (clientContext) {
        clientContextPrompt = clientContext
      }
    }

    // Enhance prompt for better results, including client context
    const enhancedPrompt = referenceImageFile
      ? `${prompt}. ${clientContextPrompt}High quality, suitable for business use.`
      : `Create a professional marketing image: ${prompt}. ${clientContextPrompt}High quality, suitable for business use, clean design.`

    // Generate image based on selected model
    let result: ImageGenerationResult

    if (model === 'gemini-flash') {
      result = await generateWithGemini(enhancedPrompt, size, referenceImageFile)
    } else {
      result = await generateWithOpenAI(enhancedPrompt, size, quality, referenceImageFile)
    }

    // Track usage, add XP, and save generation (fire and forget)
    const generationId = await trackImageUsageAndXP(tool, prompt, result.imageUrl, result.revisedPrompt || enhancedPrompt, clientId)

    return NextResponse.json({
      success: true,
      imageUrl: result.imageUrl,
      revisedPrompt: result.revisedPrompt,
      generationId,
    })
  } catch (error) {
    console.error('Image generation error:', error)

    // Check for Gemini region restriction
    if (isGeminiRegionError(error)) {
      return NextResponse.json(
        { error: 'Gemini image generation is niet beschikbaar in jouw regio. Gebruik GPT Image als alternatief, of probeer een VPN naar de VS.' },
        { status: 400 }
      )
    }

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

// Check for Gemini-specific errors
function isGeminiRegionError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: string }).message)
    return message.includes('not available in your country') ||
           message.includes('FAILED_PRECONDITION')
  }
  return false
}

// Generate image with OpenAI GPT Image
async function generateWithOpenAI(
  prompt: string,
  size: string,
  quality: string,
  referenceImage: File | null
): Promise<ImageGenerationResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key ontbreekt. Voeg OPENAI_API_KEY toe aan je .env.local bestand.')
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  // Map sizes for backwards compatibility
  const sizeMapping: Record<string, string> = {
    '1792x1024': '1536x1024',
    '1024x1792': '1024x1536',
  }
  const mappedSize = sizeMapping[size] || size

  let response: OpenAI.Images.ImagesResponse

  if (referenceImage) {
    // Use images.edit when there's a reference image
    const imageBuffer = await referenceImage.arrayBuffer()
    const imageFile = await toFile(imageBuffer, referenceImage.name, {
      type: referenceImage.type,
    })

    response = await openai.images.edit({
      model: 'gpt-image-1',
      image: imageFile,
      prompt,
      n: 1,
      size: mappedSize as '1024x1024' | '1536x1024' | '1024x1536',
    })
  } else {
    response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: mappedSize as '1024x1024' | '1536x1024' | '1024x1536',
      quality: quality as 'low' | 'medium' | 'high',
    })
  }

  const imageData = response.data?.[0]
  const b64Image = imageData?.b64_json
  const imageUrl = imageData?.url

  let finalImageUrl: string
  if (b64Image) {
    finalImageUrl = `data:image/png;base64,${b64Image}`
  } else if (imageUrl) {
    finalImageUrl = imageUrl
  } else {
    throw new Error('Geen afbeelding ontvangen van GPT Image')
  }

  return {
    imageUrl: finalImageUrl,
    revisedPrompt: imageData?.revised_prompt,
  }
}

// Generate image with Google Gemini 2.0 Flash
async function generateWithGemini(
  prompt: string,
  size: string,
  referenceImage: File | null
): Promise<ImageGenerationResult> {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error('Google API key ontbreekt. Voeg GOOGLE_API_KEY toe aan je .env.local bestand.')
  }

  const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY })

  // Map size to aspect ratio
  const aspectRatioMapping: Record<string, string> = {
    '1024x1024': '1:1',
    '1536x1024': '3:2',
    '1024x1536': '2:3',
  }
  const aspectRatio = aspectRatioMapping[size] || '1:1'

  // Build content parts
  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = []

  // Add reference image if provided
  if (referenceImage) {
    const imageBuffer = await referenceImage.arrayBuffer()
    const base64Image = Buffer.from(imageBuffer).toString('base64')
    parts.push({
      inlineData: {
        data: base64Image,
        mimeType: referenceImage.type,
      },
    })
  }

  // Add prompt
  parts.push({ text: prompt })

  const response = await genAI.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: [{ role: 'user', parts }],
    config: {
      responseModalities: ['IMAGE', 'TEXT'],
    },
  })

  // Extract image from response
  const candidate = response.candidates?.[0]
  if (!candidate?.content?.parts) {
    throw new Error('Geen afbeelding ontvangen van Gemini')
  }

  let imageUrl: string | undefined
  let textResponse: string | undefined

  for (const part of candidate.content.parts) {
    if ('inlineData' in part && part.inlineData) {
      const { data, mimeType } = part.inlineData
      imageUrl = `data:${mimeType};base64,${data}`
    }
    if ('text' in part && part.text) {
      textResponse = part.text
    }
  }

  if (!imageUrl) {
    throw new Error('Geen afbeelding ontvangen van Gemini')
  }

  return {
    imageUrl,
    revisedPrompt: textResponse || prompt,
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
