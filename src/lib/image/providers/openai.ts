/**
 * OpenAI Image Provider (GPT Image / DALL-E)
 */

import OpenAI, { toFile } from 'openai'
import type { ImageProviderAdapter, ProviderGenerateParams, ImageGenerateResult } from '../types'

export class OpenAIImageProvider implements ImageProviderAdapter {
  provider = 'openai' as const
  private client: OpenAI

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required')
    }
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }

  async generate(params: ProviderGenerateParams): Promise<ImageGenerateResult> {
    try {
      const { prompt, model = 'gpt-image-1', size, quality, referenceImage } = params

      // Determine actual model to use
      const actualModel = model === 'dall-e-3' ? 'dall-e-3' : model === 'dall-e-2' ? 'dall-e-2' : 'gpt-image-1'

      // Map sizes for backwards compatibility
      const sizeMapping: Record<string, string> = {
        '1792x1024': '1536x1024',
        '1024x1792': '1024x1536',
      }
      const mappedSize = sizeMapping[size] || size

      let response: OpenAI.Images.ImagesResponse

      if (referenceImage) {
        // Use images.edit when there's a reference image (only gpt-image-1 supports this)
        const imageBuffer = await referenceImage.arrayBuffer()
        const imageFile = await toFile(imageBuffer, referenceImage.name, {
          type: referenceImage.type,
        })

        response = await this.client.images.edit({
          model: 'gpt-image-1',
          image: imageFile,
          prompt,
          n: 1,
          size: mappedSize as '1024x1024' | '1536x1024' | '1024x1536',
        })
      } else if (actualModel === 'dall-e-3') {
        // DALL-E 3 uses different parameters
        response = await this.client.images.generate({
          model: 'dall-e-3',
          prompt,
          n: 1,
          size: mappedSize as '1024x1024' | '1792x1024' | '1024x1792',
          quality: quality === 'high' ? 'hd' : 'standard',
          style: 'vivid',
        })
      } else if (actualModel === 'dall-e-2') {
        // DALL-E 2 has limited sizes
        const dalle2Size = ['256x256', '512x512', '1024x1024'].includes(size) ? size : '1024x1024'
        response = await this.client.images.generate({
          model: 'dall-e-2',
          prompt,
          n: 1,
          size: dalle2Size as '256x256' | '512x512' | '1024x1024',
        })
      } else {
        // GPT Image 1
        response = await this.client.images.generate({
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
        return {
          success: false,
          error: 'Geen afbeelding ontvangen van GPT Image',
        }
      }

      return {
        success: true,
        imageUrl: finalImageUrl,
        revisedPrompt: imageData?.revised_prompt,
      }
    } catch (error) {
      return this.handleError(error)
    }
  }

  private handleError(error: unknown): ImageGenerateResult {
    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        return { success: false, error: 'Ongeldige OpenAI API key.' }
      }
      if (error.status === 429) {
        return { success: false, error: 'Te veel verzoeken of krediet op.' }
      }
      if (error.status === 400) {
        const message = error.message || ''
        if (message.includes('content_policy')) {
          return { success: false, error: 'Prompt bevat content die niet is toegestaan.' }
        }
        if (message.includes('billing') || message.includes('quota')) {
          return { success: false, error: 'OpenAI account heeft geen krediet meer.' }
        }
        return { success: false, error: `Prompt afgewezen: ${message}` }
      }
    }

    console.error('OpenAI Image error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Onbekende fout',
    }
  }
}
