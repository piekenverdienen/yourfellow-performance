import { Resend } from 'resend'

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY)

// Default from address - must be verified domain in Resend
const DEFAULT_FROM = process.env.EMAIL_FROM || 'workflows@yourfellow.com'

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
  replyTo?: string
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send an email using Resend
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { to, subject, html, text, from, replyTo } = options

  // Check if API key is configured
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not configured - email not sent')
    return {
      success: false,
      error: 'Email service not configured. Add RESEND_API_KEY to your environment.',
    }
  }

  try {
    const result = await resend.emails.send({
      from: from || DEFAULT_FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || text || '',
      text: text,
      replyTo: replyTo,
    })

    if (result.error) {
      console.error('[Email] Failed to send:', result.error)
      return {
        success: false,
        error: result.error.message,
      }
    }

    console.log('[Email] Sent successfully:', result.data?.id)
    return {
      success: true,
      messageId: result.data?.id,
    }
  } catch (error) {
    console.error('[Email] Error sending email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send a workflow output email
 */
export async function sendWorkflowEmail(options: {
  to: string
  subject: string
  content: string
  workflowName?: string
}): Promise<SendEmailResult> {
  const { to, subject, content, workflowName } = options

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%);
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
            margin-bottom: 0;
          }
          .content {
            background: #f9fafb;
            padding: 24px;
            border: 1px solid #e5e7eb;
            border-top: none;
            border-radius: 0 0 8px 8px;
          }
          .workflow-badge {
            display: inline-block;
            background: rgba(255,255,255,0.2);
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            margin-top: 8px;
          }
          .footer {
            margin-top: 24px;
            padding-top: 16px;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0; font-size: 20px;">${subject}</h1>
          ${workflowName ? `<span class="workflow-badge">Workflow: ${workflowName}</span>` : ''}
        </div>
        <div class="content">
          ${content.replace(/\n/g, '<br>')}
        </div>
        <div class="footer">
          Deze email is automatisch gegenereerd door YourFellow.
        </div>
      </body>
    </html>
  `

  return sendEmail({
    to,
    subject,
    html,
    text: content,
  })
}
