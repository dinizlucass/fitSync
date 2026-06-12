import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendWhatsAppMessage, downloadMetaMedia } from '@/lib/whatsapp'
import { parseWorkoutMessage, parseMealMessage, analyzeFoodImage } from '@/lib/openai'

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
        '👋 Olá! Para usar o FitSync pelo WhatsApp, cadastre seu número no app em *Configurações*.\n\nAcesse: fitsync.app'
      )
      return Response.json({ status: 'user_not_found' })
    }

    if (messageType === 'text') {
      const text = message.text.body as string
      const lowerText = text.toLowerCase()

      // Detect if it's a workout or meal message
      const workoutKeywords = ['treino', 'supino', 'rosca', 'agachamento', 'leg', 'puxada', 'remada', 'desenvolvimento', 'kg', 'série', 'rep', 'exerc']
      const mealKeywords = ['comi', 'almocei', 'jantei', 'café', 'lanche', 'refeição', 'gramas', 'arroz', 'frango', 'proteína', 'kcal', 'caloria']

      const isWorkout = workoutKeywords.some(kw => lowerText.includes(kw))
      const isMeal = mealKeywords.some(kw => lowerText.includes(kw))

      if (isWorkout && !isMeal) {
        try {
          const parsed = await parseWorkoutMessage(text)

          // Save workout session if user has a workout
          const latestWorkout = await prisma.workout.findFirst({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
          })

          if (latestWorkout) {
            const sessionSets = []
            for (const ex of parsed.exercises) {
              let exercise = await prisma.exercise.findFirst({ where: { name: { contains: ex.name, mode: 'insensitive' } } })
              if (!exercise) {
                exercise = await prisma.exercise.create({ data: { name: ex.name, muscleGroup: 'Outros' } })
              }
              for (let i = 0; i < ex.sets.length; i++) {
                sessionSets.push({
                  exerciseId: exercise.id,
                  setNumber: i + 1,
                  weightKg: ex.sets[i].weight,
                  reps: ex.sets[i].reps,
                  isPersonalRecord: false,
                })
              }
            }

            await prisma.workoutSession.create({
              data: {
                userId: user.id,
                workoutId: latestWorkout.id,
                sets: { create: sessionSets },
              },
            })
          }

          // Format reply
          let reply = '✅ *Treino registrado!*\n\n'
          for (const ex of parsed.exercises) {
            reply += `💪 *${ex.name}*\n`
            for (const set of ex.sets) {
              reply += `  • ${set.weight ? `${set.weight}kg` : '—'} × ${set.reps ?? '—'} reps\n`
            }
            reply += '\n'
          }
          reply += 'Ótimo treino! 🔥'

          await sendWhatsAppMessage(from, reply)
        } catch {
          await sendWhatsAppMessage(from, '❌ Não consegui interpretar seu treino. Tente ser mais específico, ex: "Supino 4x8 80kg"')
        }
      } else if (isMeal) {
        try {
          const parsed = await parseMealMessage(text)

          // Create meal log
          const today = new Date()
          let mealLog = await prisma.mealLog.findFirst({
            where: {
              userId: user.id,
              mealType: 'SNACK',
              date: { gte: new Date(today.setHours(0, 0, 0, 0)) },
            },
          })

          if (!mealLog) {
            mealLog = await prisma.mealLog.create({
              data: { userId: user.id, date: new Date(), mealType: 'SNACK' },
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

          const calorieGoal = user.profile?.calorieGoal ?? 2000
          const reply = `🍽️ *Refeição registrada!*\n\n` +
            `Calorias: *${Math.round(parsed.totalCalories)} kcal*\n` +
            `🥩 Proteína: ${Math.round(parsed.totalProteinG)}g\n` +
            `🍚 Carboidratos: ${Math.round(parsed.totalCarbsG)}g\n` +
            `🫒 Gordura: ${Math.round(parsed.totalFatG)}g\n\n` +
            `Meta diária: ${Math.round(calorieGoal)} kcal`

          await sendWhatsAppMessage(from, reply)
        } catch {
          await sendWhatsAppMessage(from, '❌ Não consegui interpretar sua refeição. Tente descrever os alimentos e quantidades.')
        }
      } else {
        await sendWhatsAppMessage(from,
          '👋 Olá! Você pode me enviar:\n\n' +
          '💪 *Treino*: "Supino 4x8 80kg, rosca 3x12 20kg"\n' +
          '🍽️ *Refeição*: "Almocei arroz 150g, frango 200g"\n' +
          '📸 *Foto* da sua refeição para análise automática'
        )
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

        const today = new Date()
        let mealLog = await prisma.mealLog.findFirst({
          where: {
            userId: user.id,
            mealType: 'SNACK',
            date: { gte: new Date(today.setHours(0, 0, 0, 0)) },
          },
        })

        if (!mealLog) {
          mealLog = await prisma.mealLog.create({
            data: { userId: user.id, date: new Date(), mealType: 'SNACK' },
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
