import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { Playbook, ClientContext } from '@/types'

// POST /api/playbooks/run - Execute a playbook
export async function POST(request: NextRequest) {
  try {
    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is not set')
      return NextResponse.json(
        { error: 'API configuratie ontbreekt. Contacteer de beheerder.' },
        { status: 500 }
      )
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const body = await request.json()
    const { playbookSlug, inputs, clientId } = body

    // Validate input
    if (!playbookSlug) {
      return NextResponse.json({ error: 'Playbook slug is verplicht' }, { status: 400 })
    }

    // Fetch playbook
    const { data: playbook, error: playbookError } = await supabase
      .from('playbooks')
      .select('*')
      .eq('slug', playbookSlug)
      .eq('status', 'published')
      .single()

    if (playbookError || !playbook) {
      return NextResponse.json({ error: 'Playbook niet gevonden of niet gepubliceerd' }, { status: 404 })
    }

    // Check client access if clientId provided
    if (clientId) {
      const { data: clientAccess } = await supabase
        .rpc('has_client_access', { check_client_id: clientId, min_role: 'editor' })

      if (!clientAccess) {
        return NextResponse.json({ error: 'Geen toegang tot deze client' }, { status: 403 })
      }
    }

    // Create playbook run record
    const { data: run, error: runError } = await supabase
      .from('playbook_runs')
      .insert({
        org_id: user.id,
        client_id: clientId || null,
        playbook_id: playbook.id,
        playbook_version: playbook.version,
        inputs: inputs || {},
        status: 'running',
        created_by: user.id,
      })
      .select()
      .single()

    if (runError) {
      console.error('Error creating playbook run:', runError)
      return NextResponse.json({ error: 'Fout bij starten playbook' }, { status: 500 })
    }

    // Build prompt from template
    let prompt = playbook.prompt_template as string

    // Replace input placeholders
    const inputData = inputs || {}
    for (const [key, value] of Object.entries(inputData)) {
      const placeholder = `{{${key}}}`
      const valueStr = Array.isArray(value) ? value.join(', ') : String(value)
      prompt = prompt.replace(new RegExp(placeholder, 'g'), valueStr)
    }

    // Get client context if clientId provided
    let clientContext: ClientContext | null = null
    let clientName = ''

    if (clientId) {
      const { data: client } = await supabase
        .from('clients')
        .select('name, settings')
        .eq('id', clientId)
        .single()

      if (client) {
        clientName = client.name
        clientContext = (client.settings as { context?: ClientContext })?.context || null
      }
    }

    // Replace client context placeholders
    if (clientContext) {
      prompt = prompt.replace(/{{client_name}}/g, clientName)
      prompt = prompt.replace(/{{client_context\.proposition}}/g, clientContext.proposition || '')
      prompt = prompt.replace(/{{client_context\.targetAudience}}/g, clientContext.targetAudience || '')
      prompt = prompt.replace(/{{client_context\.toneOfVoice}}/g, clientContext.toneOfVoice || '')
      prompt = prompt.replace(/{{client_context\.brandVoice}}/g, clientContext.brandVoice || '')
      prompt = prompt.replace(/{{client_context\.usps}}/g, clientContext.usps?.join(', ') || '')
      prompt = prompt.replace(/{{client_context\.doNots}}/g, clientContext.doNots?.join(', ') || '')
      prompt = prompt.replace(/{{client_context\.mustHaves}}/g, clientContext.mustHaves?.join(', ') || '')

      // Handle conditional blocks {{#if client_context}}...{{/if}}
      prompt = prompt.replace(/{{#if client_context}}([\s\S]*?){{\/if}}/g, '$1')
      prompt = prompt.replace(/{{#if client_context\.doNots}}([\s\S]*?){{\/if}}/g,
        clientContext.doNots?.length ? '$1' : '')
      prompt = prompt.replace(/{{#if client_context\.mustHaves}}([\s\S]*?){{\/if}}/g,
        clientContext.mustHaves?.length ? '$1' : '')
    } else {
      // Remove conditional blocks if no client context
      prompt = prompt.replace(/{{#if client_context}}[\s\S]*?{{\/if}}/g, '')
    }

    // Clean up any remaining optional conditionals
    prompt = prompt.replace(/{{#if \w+}}[\s\S]*?{{\/if}}/g, '')

    // Build system prompt
    const systemPrompt = `Je bent een AI assistent die gestructureerde output genereert.
Je output MOET altijd valide JSON zijn die exact voldoet aan het gevraagde schema.
Geef ALLEEN de JSON terug, geen uitleg of markdown code blocks.
${clientContext ? `\nJe werkt voor ${clientName}.` : ''}`

    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: playbook.estimated_tokens * 2 || 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    })

    // Extract text content
    const textContent = message.content.find(block => block.type === 'text')
    let resultText = textContent ? textContent.text : ''

    // Strip markdown code blocks if present
    if (resultText.startsWith('```')) {
      resultText = resultText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }
    resultText = resultText.trim()

    // Parse and validate JSON output
    let output: Record<string, unknown>
    try {
      output = JSON.parse(resultText)
    } catch (parseError) {
      // Retry once with fix instruction
      console.log('First parse failed, retrying with fix instruction')

      const retryMessage = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: playbook.estimated_tokens * 2 || 2048,
        system: systemPrompt,
        messages: [
          { role: 'user', content: prompt },
          { role: 'assistant', content: resultText },
          {
            role: 'user',
            content: `De vorige output was geen valide JSON. Geef de output opnieuw als valide JSON die voldoet aan dit schema: ${JSON.stringify(playbook.output_schema)}\n\nAlleen de JSON, geen uitleg.`
          }
        ],
      })

      const retryContent = retryMessage.content.find(block => block.type === 'text')
      let retryText = retryContent ? retryContent.text : ''

      // Strip markdown code blocks if present
      if (retryText.startsWith('```')) {
        retryText = retryText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }
      retryText = retryText.trim()

      try {
        output = JSON.parse(retryText)

        // Update token usage with retry
        const totalPromptTokens = (message.usage?.input_tokens || 0) + (retryMessage.usage?.input_tokens || 0)
        const totalCompletionTokens = (message.usage?.output_tokens || 0) + (retryMessage.usage?.output_tokens || 0)

        // Update run with output
        await supabase
          .from('playbook_runs')
          .update({
            output,
            status: 'completed',
            prompt_tokens: totalPromptTokens,
            completion_tokens: totalCompletionTokens,
            total_tokens: totalPromptTokens + totalCompletionTokens,
            completed_at: new Date().toISOString(),
          })
          .eq('id', run.id)

        // Track usage and XP
        trackUsageAndXP(
          supabase,
          user.id,
          `playbook:${playbookSlug}`,
          playbook.xp_reward,
          totalPromptTokens + totalCompletionTokens,
          totalPromptTokens,
          totalCompletionTokens,
          clientId
        )

        return NextResponse.json({
          success: true,
          runId: run.id,
          output,
          tokens_used: totalPromptTokens + totalCompletionTokens,
        })
      } catch {
        // Both attempts failed
        await supabase
          .from('playbook_runs')
          .update({
            status: 'failed',
            error_message: 'Output kon niet worden geparsed als JSON',
            completed_at: new Date().toISOString(),
          })
          .eq('id', run.id)

        return NextResponse.json(
          {
            error: 'De AI genereerde geen valide JSON output. Probeer het opnieuw.',
            runId: run.id
          },
          { status: 500 }
        )
      }
    }

    // Calculate tokens
    const promptTokens = message.usage?.input_tokens || 0
    const completionTokens = message.usage?.output_tokens || 0
    const totalTokens = promptTokens + completionTokens

    // Update run with output
    await supabase
      .from('playbook_runs')
      .update({
        output,
        status: 'completed',
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id)

    // Track usage and XP (fire and forget)
    trackUsageAndXP(
      supabase,
      user.id,
      `playbook:${playbookSlug}`,
      playbook.xp_reward,
      totalTokens,
      promptTokens,
      completionTokens,
      clientId
    )

    return NextResponse.json({
      success: true,
      runId: run.id,
      output,
      tokens_used: totalTokens,
    })

  } catch (error) {
    console.error('Playbook run error:', error)

    // Handle specific Anthropic errors
    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          { error: 'Ongeldige API key. Controleer de configuratie.' },
          { status: 401 }
        )
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'Te veel verzoeken. Wacht even en probeer opnieuw.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Er ging iets mis bij het uitvoeren van de playbook.' },
      { status: 500 }
    )
  }
}

// Track usage and XP
async function trackUsageAndXP(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  tool: string,
  xpReward: number,
  totalTokens: number,
  promptTokens: number,
  completionTokens: number,
  clientId?: string
) {
  try {
    // Insert usage record
    await supabase.from('usage').insert({
      user_id: userId,
      tool,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      client_id: clientId || null,
    })

    // Update user XP and total generations
    const { data: profile } = await supabase
      .from('profiles')
      .select('xp, total_generations')
      .eq('id', userId)
      .single()

    if (profile) {
      const newXp = (profile.xp || 0) + xpReward
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
    console.error('Error tracking usage/XP:', error)
  }
}
