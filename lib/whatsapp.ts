const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0'

/**
 * Send a WhatsApp text message via Meta Graph API.
 */
export async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  const phoneId = process.env.META_WHATSAPP_PHONE_ID
  const token = process.env.META_WHATSAPP_TOKEN

  if (!phoneId || !token) {
    throw new Error('WhatsApp credentials not configured')
  }

  const response = await fetch(`${WHATSAPP_API_URL}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: text,
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`WhatsApp API error: ${error}`)
  }
}

/**
 * Download media from Meta's servers.
 * First fetches the media URL, then downloads the binary.
 */
export async function downloadMetaMedia(mediaId: string): Promise<Buffer> {
  const token = process.env.META_WHATSAPP_TOKEN

  if (!token) {
    throw new Error('WhatsApp credentials not configured')
  }

  // Step 1: Get the media URL
  const urlResponse = await fetch(`${WHATSAPP_API_URL}/${mediaId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!urlResponse.ok) {
    throw new Error(`Failed to get media URL: ${await urlResponse.text()}`)
  }

  const { url } = await urlResponse.json() as { url: string }

  // Step 2: Download the binary
  const mediaResponse = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!mediaResponse.ok) {
    throw new Error(`Failed to download media: ${await mediaResponse.text()}`)
  }

  const arrayBuffer = await mediaResponse.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
