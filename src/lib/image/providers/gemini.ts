/**
 * Google Gemini Image Provider
 */

import { GoogleGenAI } from '@google/genai'
import type { ImageProviderAdapter, ProviderGenerateParams, ImageGenerateResult } from '../types'

export class GeminiImageProvider implements ImageProviderAdapter {
  provider = 'gemini' as const
  private client: GoogleGenAI

  constructor() {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY is required')
    }
    this.client = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY })
  }

  async generate(params: ProviderGenerateParams): Promise<ImageGenerateResult> {
    try {
      const { prompt, referenceImage } = params

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

      const response = await this.client.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ role: 'user', parts }],
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      })

      // Log response for debugging
      console.log('Gemini response candidates:', response.candidates?.length)
      console.log('Gemini response promptFeedback:', response.promptFeedback)

      // Check for content filtering
      if (response.promptFeedback?.blockReason) {
        console.log('Content blocked:', response.promptFeedback)
        return {
          success: false,
          error: `Verzoek geblokkeerd door veiligheidsfilter: ${response.promptFeedback.blockReason}`,
        }
      }

      // Extract image from response
      const candidate = response.candidates?.[0]

      // Check finish reason
      if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
        console.log('Unexpected finish reason:', candidate.finishReason)
        if (candidate.finishReason === 'SAFETY') {
          return {
            success: false,
            error: 'Afbeelding geblokkeerd door veiligheidsfilter. Probeer een andere beschrijving.',
          }
        }
        if (candidate.finishReason === 'IMAGE_SAFETY') {
          return {
            success: false,
            error: 'De referentie afbeelding is geblokkeerd door veiligheidsfilter.',
          }
        }
      }

      if (!candidate?.content?.parts) {
        console.log('No candidate parts found. Full response:', JSON.stringify(response, null, 2))
        return {
          success: false,
          error: 'Geen afbeelding ontvangen van Gemini',
        }
      }

      console.log('Found parts:', candidate.content.parts.length)

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
        return {
          success: false,
          error: 'Geen afbeelding ontvangen van Gemini',
        }
      }

      return {
        success: true,
        imageUrl,
        revisedPrompt: textResponse || prompt,
      }
    } catch (error) {
      return this.handleError(error)
    }
  }

  private handleError(error: unknown): ImageGenerateResult {
    // Check for Gemini region restriction
    if (error && typeof error === 'object' && 'message' in error) {
      const message = String((error as { message: string }).message)
      if (message.includes('not available in your country') || message.includes('FAILED_PRECONDITION')) {
        return {
          success: false,
          error: 'Gemini image generation is niet beschikbaar in jouw regio. Gebruik GPT Image als alternatief.',
        }
      }
    }

    console.error('Gemini Image error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Onbekende fout',
    }
  }
}
