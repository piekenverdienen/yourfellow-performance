import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

interface ChatRequest {
  conversationId?: string
  assistantId: string
  message: string
  clientId?: string // Optional client ID for client-scoped conversations
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'API configuratie ontbreekt' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const body: ChatRequest = await request.json()
    const { conversationId, assistantId, message, clientId } = body

    if (!assistantId || !message) {
      return new Response(
        JSON.stringify({ error: 'Assistant ID en bericht zijn vereist' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Niet ingelogd' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get assistant by ID or slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assistantId)
    const { data: assistant, error: assistantError } = await supabase
      .from('assistants')
      .select('*')
      .eq(isUUID ? 'id' : 'slug', assistantId)
      .eq('is_active', true)
      .single()

    if (assistantError || !assistant) {
      return new Response(
        JSON.stringify({ error: 'Assistant niet gevonden' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get user profile for context
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, company_name, industry, target_audience, brand_voice, preferred_tone')
      .eq('id', user.id)
      .single()

    // Get client context if clientId provided
    let clientContext: Record<string, unknown> | null = null
    let clientName: string | null = null

    if (clientId) {
      // Verify client access
      const { data: clientAccess } = await supabase
        .rpc('has_client_access', { check_client_id: clientId, min_role: 'editor' })

      if (!clientAccess) {
        return new Response(
          JSON.stringify({ error: 'Geen toegang tot deze client' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Fetch client with context
      const { data: client } = await supabase
        .from('clients')
        .select('name, settings')
        .eq('id', clientId)
        .single()

      if (client) {
        clientName = client.name
        clientContext = (client.settings as { context?: Record<string, unknown> })?.context || null
      }
    }

    // Get or create conversation
    let activeConversationId = conversationId

    if (!activeConversationId) {
      // Create new conversation using the real assistant ID from database
      const { data: newConversation, error: createError } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          assistant_id: assistant.id,
          client_id: clientId || null,
          title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
        })
        .select('id')
        .single()

      if (createError || !newConversation) {
        return new Response(
          JSON.stringify({ error: 'Kon gesprek niet aanmaken' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }
      activeConversationId = newConversation.id
    }

    // Get conversation history
    const { data: messages } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', activeConversationId)
      .order('created_at', { ascending: true })
      .limit(50)

    // Build message history for Claude
    const messageHistory: { role: 'user' | 'assistant'; content: string }[] =
      (messages || []).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

    // Add current message
    messageHistory.push({ role: 'user', content: message })

    // Build system prompt with user and client context
    let systemPrompt = assistant.system_prompt

    // Add user context
    if (profile) {
      const contextParts = []
      if (profile.full_name) contextParts.push(`Naam gebruiker: ${profile.full_name}`)
      if (profile.company_name) contextParts.push(`Bedrijf: ${profile.company_name}`)
      if (profile.industry) contextParts.push(`Branche: ${profile.industry}`)
      if (profile.target_audience) contextParts.push(`Doelgroep: ${profile.target_audience}`)
      if (profile.brand_voice) contextParts.push(`Merkstem: ${profile.brand_voice}`)
      if (profile.preferred_tone) contextParts.push(`Voorkeurstoon: ${profile.preferred_tone}`)

      if (contextParts.length > 0) {
        systemPrompt = `${systemPrompt}\n\nCONTEXT GEBRUIKER:\n${contextParts.join('\n')}`
      }
    }

    // Add client context if available
    if (clientContext && clientName) {
      const clientContextParts = [`Je werkt nu voor client: ${clientName}`]

      const ctx = clientContext as {
        proposition?: string
        targetAudience?: string
        usps?: string[]
        toneOfVoice?: string
        brandVoice?: string
        doNots?: string[]
        mustHaves?: string[]
        bestsellers?: string[]
        seasonality?: string[]
        margins?: { min?: number; target?: number }
        activeChannels?: string[]
      }

      if (ctx.proposition) clientContextParts.push(`Propositie: ${ctx.proposition}`)
      if (ctx.targetAudience) clientContextParts.push(`Doelgroep: ${ctx.targetAudience}`)
      if (ctx.usps && ctx.usps.length > 0) clientContextParts.push(`USP's: ${ctx.usps.join(', ')}`)
      if (ctx.toneOfVoice) clientContextParts.push(`Tone of Voice: ${ctx.toneOfVoice}`)
      if (ctx.brandVoice) clientContextParts.push(`Brand Voice: ${ctx.brandVoice}`)
      if (ctx.bestsellers && ctx.bestsellers.length > 0) clientContextParts.push(`Bestsellers: ${ctx.bestsellers.join(', ')}`)
      if (ctx.seasonality && ctx.seasonality.length > 0) clientContextParts.push(`Seizoensgebonden: ${ctx.seasonality.join(', ')}`)
      if (ctx.margins) clientContextParts.push(`Marges: min ${ctx.margins.min || 0}%, target ${ctx.margins.target || 0}%`)
      if (ctx.activeChannels && ctx.activeChannels.length > 0) clientContextParts.push(`Actieve kanalen: ${ctx.activeChannels.join(', ')}`)

      // Compliance rules are critical - add with emphasis
      if (ctx.doNots && ctx.doNots.length > 0) {
        clientContextParts.push(`\n⚠️ VERBODEN (gebruik deze woorden/claims NOOIT): ${ctx.doNots.join(', ')}`)
      }
      if (ctx.mustHaves && ctx.mustHaves.length > 0) {
        clientContextParts.push(`✓ VERPLICHT (altijd toevoegen waar relevant): ${ctx.mustHaves.join(', ')}`)
      }

      systemPrompt = `${systemPrompt}\n\nCLIENT CONTEXT (${clientName}):\n${clientContextParts.join('\n')}`
    }

    // Save user message first
    await supabase.from('messages').insert({
      conversation_id: activeConversationId,
      role: 'user',
      content: message,
    })

    // Create streaming response
    const encoder = new TextEncoder()
    let fullResponse = ''
    let totalTokens = 0

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send conversation ID first
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'conversation_id', id: activeConversationId })}\n\n`)
          )

          const response = await anthropic.messages.create({
            model: assistant.model || 'claude-sonnet-4-20250514',
            max_tokens: assistant.max_tokens || 4096,
            system: systemPrompt,
            messages: messageHistory,
            stream: true,
          })

          for await (const event of response) {
            if (event.type === 'content_block_delta') {
              const delta = event.delta
              if ('text' in delta) {
                fullResponse += delta.text
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'text', content: delta.text })}\n\n`)
                )
              }
            }
            if (event.type === 'message_delta') {
              if (event.usage) {
                totalTokens = event.usage.output_tokens
              }
            }
          }

          // Save assistant message
          await supabase.from('messages').insert({
            conversation_id: activeConversationId,
            role: 'assistant',
            content: fullResponse,
            tokens_used: totalTokens,
          })

          // Update conversation title if it's the first exchange
          if (!conversationId) {
            // Generate a better title based on the conversation
            const titleResponse = await anthropic.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 50,
              messages: [
                {
                  role: 'user',
                  content: `Geef een korte titel (max 5 woorden, Nederlands) voor dit gesprek:\n\nVraag: ${message}\n\nAntwoord begin: ${fullResponse.slice(0, 200)}`,
                },
              ],
            })

            const titleContent = titleResponse.content.find(b => b.type === 'text')
            if (titleContent && 'text' in titleContent) {
              await supabase
                .from('conversations')
                .update({ title: titleContent.text.slice(0, 100) })
                .eq('id', activeConversationId)
            }
          }

          // Track usage and XP
          await trackChatUsage(supabase, user.id, assistant.slug, totalTokens, clientId)

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done', tokens: totalTokens })}\n\n`)
          )
          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Er ging iets mis' })}\n\n`)
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return new Response(
      JSON.stringify({ error: 'Er ging iets mis' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

async function trackChatUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  assistantSlug: string,
  tokens: number,
  clientId?: string
) {
  try {
    // Insert usage record
    await supabase.from('usage').insert({
      user_id: userId,
      tool: `chat-${assistantSlug}`,
      completion_tokens: tokens,
      total_tokens: tokens,
      client_id: clientId || null,
    })

    // Add XP (5 XP per chat message)
    const { data: profile } = await supabase
      .from('profiles')
      .select('xp, total_generations')
      .eq('id', userId)
      .single()

    if (profile) {
      const newXp = (profile.xp || 0) + 5
      const newLevel = Math.floor(newXp / 100) + 1
      const newGenerations = (profile.total_generations || 0) + 1

      await supabase
        .from('profiles')
        .update({
          xp: newXp,
          level: newLevel,
          total_generations: newGenerations,
        })
        .eq('id', userId)
    }
  } catch (error) {
    console.error('Error tracking chat usage:', error)
  }
}
