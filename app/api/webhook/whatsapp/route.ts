import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendWhatsAppMessage, downloadMetaMedia } from '@/lib/whatsapp'
import { analyzeFoodImage } from '@/lib/openai'
import { runCoach } from '@/lib/coach/coach'
import { dayRange } from '@/lib/coach/shared'

/**
 * Verifica a assinatura HMAC-SHA256 do corpo bruto contra o header
 * X-Hub-Signature-256 enviado pela Meta. Usa comparação timing-safe.
 */
function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret || !signatureHeader) return false

  const expected = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex')

  const a = Buffer.from(signatureHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }

  return new Response('Forbidden', { status: 403 })
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()

    if (!verifyMetaSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)

    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    if (!value?.messages?.length) {
      return Response.json({ status: 'no_messages' })
    }

    const message = value.messages[0]
    const from = message.from as string
    const messageType = message.type as string

    // Find user by phone
    const user = await prisma.user.findFirst({
      where: { phone: from },
      include: { profile: true },
    })

    if (!user) {
      await sendWhatsAppMessage(from,
        '👋 Olá! Para usar o FitSync pelo WhatsApp, cadastre seu número no app em *Configurações → WhatsApp*.\n\nAcesse: https://fit-sync-eight-zeta.vercel.app'
      )
      return Response.json({ status: 'user_not_found' })
    }

    if (messageType === 'text') {
      const text = message.text.body as string

      // Coach conversacional (Sync): entende a intenção, lê dados reais via tools,
      // age (registra/ajusta) e responde no estilo WhatsApp.
      try {
        const reply = await runCoach({ userId: user.id, message: text, channel: 'whatsapp' })
        await sendWhatsAppMessage(from, reply)
      } catch (e) {
        console.error('Coach error:', e)
        await sendWhatsAppMessage(from, 'Deu um probleminha aqui pra processar sua mensagem. Tenta de novo daqui a pouco? 🙏')
      }
    } else if (messageType === 'image') {
      // Handle food image
      try {
        const mediaId = message.image.id as string
        const mediaBuffer = await downloadMetaMedia(mediaId)

        // Convert to base64 data URL for OpenAI
        const base64 = mediaBuffer.toString('base64')
        const mimeType = message.image.mime_type ?? 'image/jpeg'
        const imageUrl = `data:${mimeType};base64,${base64}`

        const parsed = await analyzeFoodImage(imageUrl)

        // Dia no fuso America/Sao_Paulo (evita a refeição cair no dia seguinte à noite)
        const { start, end } = dayRange()
        let mealLog = await prisma.mealLog.findFirst({
          where: {
            userId: user.id,
            mealType: 'SNACK',
            date: { gte: start, lte: end },
          },
        })

        if (!mealLog) {
          mealLog = await prisma.mealLog.create({
            data: { userId: user.id, date: start, mealType: 'SNACK' },
          })
        }

        for (const item of parsed.items) {
          let food = await prisma.food.findFirst({ where: { name: { contains: item.name, mode: 'insensitive' } } })
          if (!food) {
            food = await prisma.food.create({
              data: {
                name: item.name,
                calories: item.calories,
                proteinG: item.proteinG,
                carbsG: item.carbsG,
                fatG: item.fatG,
                servingSize: item.quantityG,
              },
            })
          }
          await prisma.mealItem.create({
            data: { mealLogId: mealLog.id, foodId: food.id, quantityG: item.quantityG },
          })
        }

        let reply = `📸 *Refeição identificada!*\n\n`
        for (const item of parsed.items) {
          reply += `• ${item.name} (~${item.quantityG}g) — ${Math.round(item.calories)} kcal\n`
        }
        reply += `\n*Total: ${Math.round(parsed.totalCalories)} kcal*\n`
        reply += `P: ${Math.round(parsed.totalProteinG)}g · C: ${Math.round(parsed.totalCarbsG)}g · G: ${Math.round(parsed.totalFatG)}g`

        await sendWhatsAppMessage(from, reply)
      } catch {
        await sendWhatsAppMessage(from, '❌ Não consegui analisar a imagem. Tente enviar uma foto mais clara.')
      }
    }

    return Response.json({ status: 'ok' })
  } catch (e) {
    console.error('WhatsApp webhook error:', e)
    return Response.json({ status: 'error' }, { status: 500 })
  }
}
