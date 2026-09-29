"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  defaultScopesForRole,
  requireProfessionalAccess,
  writeClinicalAudit,
} from "@/lib/professional";
import { sendWhatsAppMessage, sendWhatsAppTemplate } from "@/lib/whatsapp";

// Server Actions are also submitted directly by native forms; `any` keeps the
// React form action contract while client callers can still inspect ok/message.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ProfessionalActionResult = any;
const ok = (message: string): ProfessionalActionResult => ({
  ok: true,
  message,
});
const fail = (message: string): ProfessionalActionResult => ({
  ok: false,
  message,
});
const text = (value: FormDataEntryValue | null) => String(value ?? "").trim();
const numberOrNull = (value: FormDataEntryValue | null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const refresh = (patientId: string) =>
  revalidatePath(`/pro/pacientes/${patientId}`, "layout");

export async function createMeasurementAction(
  formData: FormData,
): Promise<ProfessionalActionResult> {
  const schema = z.object({
    patientId: z.string().min(1),
    bodyFatPct: z.number().min(1).max(80).nullable(),
    waistCm: z.number().min(20).max(300).nullable(),
    notes: z.string().max(1000),
  });
  const parsed = schema.safeParse({
    patientId: text(formData.get("patientId")),
    bodyFatPct: numberOrNull(formData.get("bodyFatPct")),
    waistCm: numberOrNull(formData.get("waistCm")),
    notes: text(formData.get("notes")),
  });
  if (!parsed.success) return fail("Confira os dados da avaliação.");
  try {
    const context = await requireProfessionalAccess(
      parsed.data.patientId,
      "CLINICAL",
    );
    const row = await prisma.progressMeasurement.create({
      data: {
        ...parsed.data,
        notes: parsed.data.notes || null,
        recordedById: context.user.id,
      },
    });
    await writeClinicalAudit({
      context,
      patientId: parsed.data.patientId,
      action: "CREATE",
      entityType: "PROGRESS_MEASUREMENT",
      entityId: row.id,
    });
    refresh(parsed.data.patientId);
    return ok("Avaliação registrada.");
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Não foi possível registrar.",
    );
  }
}

export async function uploadProgressPhotoAction(
  formData: FormData,
): Promise<ProfessionalActionResult> {
  const patientId = text(formData.get("patientId"));
  const angle = text(formData.get("angle")) || "FRONT";
  const file = formData.get("file");
  if (
    !(file instanceof File) ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    return fail("Envie JPG, PNG ou WebP de até 5 MB.");
  try {
    const context = await requireProfessionalAccess(patientId, "CLINICAL");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const storagePath = `${patientId}/${Date.now()}-${safeName}`;
    const supabase = createAdminClient();
    const { error } = await supabase.storage
      .from("progress-photos")
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (error) return fail(error.message);
    const photo = await prisma.progressPhoto.create({
      data: { patientId, recordedById: context.user.id, storagePath, angle },
    });
    await writeClinicalAudit({
      context,
      patientId,
      action: "UPLOAD",
      entityType: "PROGRESS_PHOTO",
      entityId: photo.id,
    });
    refresh(patientId);
    return ok("Foto de evolução enviada.");
  } catch (error) {
    return fail(
      error instanceof Error
        ? error.message
        : "Não foi possível enviar a foto.",
    );
  }
}

export async function createDietVersionAction(
  formData: FormData,
): Promise<ProfessionalActionResult> {
  const schema = z.object({
    patientId: z.string().min(1),
    calorieGoal: z.number().int().min(500).max(10000),
    proteinGoalG: z.number().min(0).max(1000),
    carbsGoalG: z.number().min(0).max(1500),
    fatGoalG: z.number().min(0).max(500),
    notes: z.string().max(3000),
  });
  const parsed = schema.safeParse({
    patientId: text(formData.get("patientId")),
    calorieGoal: Number(formData.get("calorieGoal")),
    proteinGoalG: Number(formData.get("proteinGoalG")),
    carbsGoalG: Number(formData.get("carbsGoalG")),
    fatGoalG: Number(formData.get("fatGoalG")),
    notes: text(formData.get("notes")),
  });
  if (!parsed.success) return fail("Metas do plano inválidas.");
  try {
    const context = await requireProfessionalAccess(
      parsed.data.patientId,
      "NUTRITION",
    );
    const version = await prisma.$transaction(async (tx) => {
      const plan = await tx.dietPlan.upsert({
        where: { patientId: parsed.data.patientId },
        update: {},
        create: { patientId: parsed.data.patientId },
      });
      const latest = await tx.dietPlanVersion.aggregate({
        where: { planId: plan.id },
        _max: { version: true },
      });
      const source = plan.activeVersionId
        ? await tx.dietPlanVersion.findUnique({
            where: { id: plan.activeVersionId },
            include: { meals: { include: { items: true } } },
          })
        : null;
      const draft = await tx.dietPlanVersion.create({
        data: {
          planId: plan.id,
          version: (latest._max.version ?? 0) + 1,
          status: "DRAFT",
          calorieGoal: parsed.data.calorieGoal,
          proteinGoalG: parsed.data.proteinGoalG,
          carbsGoalG: parsed.data.carbsGoalG,
          fatGoalG: parsed.data.fatGoalG,
          notes: parsed.data.notes || null,
          authoredById: context.user.id,
        },
      });
      for (const meal of source?.meals ?? []) {
        await tx.dietPlanMeal.create({
          data: {
            versionId: draft.id,
            mealType: meal.mealType,
            name: meal.name,
            time: meal.time,
            order: meal.order,
            items: {
              create: meal.items.map((item) => ({
                foodId: item.foodId,
                name: item.name,
                quantityG: item.quantityG,
                calories: item.calories,
                proteinG: item.proteinG,
                carbsG: item.carbsG,
                fatG: item.fatG,
                    substitutions:
                      item.substitutions === null
                        ? undefined
                        : (item.substitutions as Prisma.InputJsonValue),
                order: item.order,
              })),
            },
          },
        });
      }
      return draft;
    });
    await writeClinicalAudit({
      context,
      patientId: parsed.data.patientId,
      action: "CREATE",
      entityType: "DIET_PLAN_VERSION",
      entityId: version.id,
    });
    refresh(parsed.data.patientId);
    return ok(`Rascunho v${version.version} criado.`);
  } catch (error) {
    return fail(
      error instanceof Error
        ? error.message
        : "Não foi possível criar o plano.",
    );
  }
}

export async function addDietPlanItemAction(
  formData: FormData,
): Promise<ProfessionalActionResult> {
  const data = {
    patientId: text(formData.get("patientId")),
    versionId: text(formData.get("versionId")),
    mealType: text(formData.get("mealType")),
    mealName: text(formData.get("mealName")),
    itemName: text(formData.get("itemName")),
    quantityG: Number(formData.get("quantityG")),
    calories: Number(formData.get("calories")),
    proteinG: Number(formData.get("proteinG")),
    carbsG: Number(formData.get("carbsG")),
    fatG: Number(formData.get("fatG")),
    substitutions: text(formData.get("substitutions")),
  };
  if (
    !data.patientId ||
    !data.versionId ||
    !data.mealName ||
    !data.itemName ||
    !Number.isFinite(data.quantityG)
  )
    return fail("Preencha a refeição e o alimento.");
  try {
    const context = await requireProfessionalAccess(
      data.patientId,
      "NUTRITION",
    );
    const version = await prisma.dietPlanVersion.findFirst({
      where: {
        id: data.versionId,
        plan: { patientId: data.patientId },
        status: "DRAFT",
      },
    });
    if (!version) return fail("Somente rascunhos podem ser editados.");
    const meal = await prisma.dietPlanMeal.upsert({
      where: { id: `${version.id}:${data.mealType}` },
      update: { name: data.mealName },
      create: {
        id: `${version.id}:${data.mealType}`,
        versionId: version.id,
        mealType: data.mealType as never,
        name: data.mealName,
        order: 0,
      },
    });
    const item = await prisma.dietPlanItem.create({
      data: {
        mealId: meal.id,
        name: data.itemName,
        quantityG: data.quantityG,
        calories: data.calories || 0,
        proteinG: data.proteinG || 0,
        carbsG: data.carbsG || 0,
        fatG: data.fatG || 0,
        substitutions: data.substitutions ? [data.substitutions] : undefined,
      },
    });
    await writeClinicalAudit({
      context,
      patientId: data.patientId,
      action: "CREATE",
      entityType: "DIET_PLAN_ITEM",
      entityId: item.id,
    });
    refresh(data.patientId);
    return ok("Alimento incluído no rascunho.");
  } catch (error) {
    return fail(
      error instanceof Error
        ? error.message
        : "Não foi possível editar o plano.",
    );
  }
}

export async function publishDietVersionAction(
  formData: FormData,
): Promise<ProfessionalActionResult> {
  const patientId = text(formData.get("patientId"));
  const versionId = text(formData.get("versionId"));
  try {
    const context = await requireProfessionalAccess(patientId, "NUTRITION");
    const version = await prisma.dietPlanVersion.findFirst({
      where: { id: versionId, plan: { patientId } },
      include: { plan: true, meals: { include: { items: true } } },
    });
    if (!version) return fail("Versão não encontrada.");
    await prisma.$transaction(async (tx) => {
      await tx.dietPlanVersion.updateMany({
        where: { planId: version.planId, status: "PUBLISHED" },
        data: { status: "ARCHIVED" },
      });
      await tx.dietPlanVersion.update({
        where: { id: version.id },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });
      await tx.dietPlan.update({
        where: { id: version.planId },
        data: { activeVersionId: version.id },
      });
      const template = await tx.dietTemplate.upsert({
        where: { userId: patientId },
        update: { calorieGoal: version.calorieGoal, name: version.title },
        create: {
          userId: patientId,
          calorieGoal: version.calorieGoal,
          name: version.title,
        },
      });
      await tx.dietTemplateMeal.deleteMany({
        where: { templateId: template.id },
      });
      for (const meal of version.meals) {
        const legacyMeal = await tx.dietTemplateMeal.create({
          data: {
            templateId: template.id,
            mealType: meal.mealType,
            mealName: meal.name,
          },
        });
        for (const item of meal.items) {
          const food = item.foodId
            ? await tx.food.findUnique({ where: { id: item.foodId } })
            : await tx.food.upsert({
                where: { name: item.name },
                update: {},
                create: {
                  name: item.name,
                  calories: item.calories,
                  proteinG: item.proteinG,
                  carbsG: item.carbsG,
                  fatG: item.fatG,
                  servingSize: item.quantityG || 100,
                },
              });
          if (food)
            await tx.dietTemplateMealItem.create({
              data: {
                mealId: legacyMeal.id,
                foodId: food.id,
                quantityG: item.quantityG,
              },
            });
        }
      }
    });
    await writeClinicalAudit({
      context,
      patientId,
      action: "PUBLISH",
      entityType: "DIET_PLAN_VERSION",
      entityId: version.id,
    });
    refresh(patientId);
    return ok(`Plano v${version.version} publicado.`);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Não foi possível publicar.",
    );
  }
}

export async function createWorkoutForPatientAction(
  formData: FormData,
): Promise<ProfessionalActionResult> {
  const patientId = text(formData.get("patientId"));
  const name = text(formData.get("name"));
  const days = formData
    .getAll("weekdays")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  if (!name) return fail("Informe o nome do treino.");
  try {
    const context = await requireProfessionalAccess(patientId, "TRAINING");
    const workout = await prisma.workout.create({
      data: {
        userId: patientId,
        name,
        muscleGroups: [],
        authoredById: context.user.id,
        scheduledWeekdays: days,
      },
    });
    await writeClinicalAudit({
      context,
      patientId,
      action: "CREATE",
      entityType: "WORKOUT",
      entityId: workout.id,
    });
    refresh(patientId);
    return ok("Treino criado para o paciente.");
  } catch (error) {
    return fail(
      error instanceof Error
        ? error.message
        : "Não foi possível criar o treino.",
    );
  }
}

export async function addWorkoutExerciseAction(
  formData: FormData,
): Promise<ProfessionalActionResult> {
  const schema = z.object({
    patientId: z.string().min(1),
    workoutId: z.string().min(1),
    name: z.string().min(2).max(120),
    muscleGroup: z.string().min(2).max(80),
    targetSets: z.number().int().min(1).max(20),
    targetReps: z.number().int().min(1).max(200),
  });
  const parsed = schema.safeParse({
    patientId: text(formData.get("patientId")),
    workoutId: text(formData.get("workoutId")),
    name: text(formData.get("name")),
    muscleGroup: text(formData.get("muscleGroup")),
    targetSets: Number(formData.get("targetSets")),
    targetReps: Number(formData.get("targetReps")),
  });
  if (!parsed.success) return fail("Confira exercício, séries e repetições.");
  try {
    const context = await requireProfessionalAccess(
      parsed.data.patientId,
      "TRAINING",
    );
    const workout = await prisma.workout.findFirst({
      where: {
        id: parsed.data.workoutId,
        userId: parsed.data.patientId,
        archived: false,
      },
    });
    if (!workout) return fail("Treino não encontrado para este paciente.");
    const exercise =
      (await prisma.exercise.findFirst({
        where: {
          name: { equals: parsed.data.name, mode: "insensitive" },
          muscleGroup: { equals: parsed.data.muscleGroup, mode: "insensitive" },
        },
      })) ??
      (await prisma.exercise.create({
        data: { name: parsed.data.name, muscleGroup: parsed.data.muscleGroup },
      }));
    const last = await prisma.workoutExercise.aggregate({
      where: { workoutId: workout.id },
      _max: { order: true },
    });
    const entry = await prisma.workoutExercise.create({
      data: {
        workoutId: workout.id,
        exerciseId: exercise.id,
        targetSets: parsed.data.targetSets,
        targetReps: parsed.data.targetReps,
        order: (last._max.order ?? -1) + 1,
      },
    });
    await writeClinicalAudit({
      context,
      patientId: parsed.data.patientId,
      action: "CREATE",
      entityType: "WORKOUT_EXERCISE",
      entityId: entry.id,
    });
    refresh(parsed.data.patientId);
    return ok("Exercício adicionado ao treino.");
  } catch (error) {
    return fail(
      error instanceof Error
        ? error.message
        : "Não foi possível adicionar o exercício.",
    );
  }
}

export async function createExamResultAction(
  formData: FormData,
): Promise<ProfessionalActionResult> {
  const patientId = text(formData.get("patientId"));
  const marker = text(formData.get("marker"));
  const value = numberOrNull(formData.get("value"));
  const referenceMin = numberOrNull(formData.get("referenceMin"));
  const referenceMax = numberOrNull(formData.get("referenceMax"));
  if (!marker || value == null) return fail("Informe marcador e resultado.");
  try {
    const context = await requireProfessionalAccess(patientId, "CLINICAL");
    const outOfRange =
      (referenceMin != null && value < referenceMin) ||
      (referenceMax != null && value > referenceMax);
    const collection = await prisma.examCollection.create({
      data: {
        patientId,
        collectedAt: new Date(text(formData.get("collectedAt")) || Date.now()),
        laboratory: text(formData.get("laboratory")) || null,
        results: {
          create: {
            marker,
            value,
            unit: text(formData.get("unit")) || null,
            referenceMin,
            referenceMax,
            outOfRange,
          },
        },
      },
      include: { results: true },
    });
    await writeClinicalAudit({
      context,
      patientId,
      action: "CREATE",
      entityType: "EXAM_COLLECTION",
      entityId: collection.id,
    });
    refresh(patientId);
    return ok(
      outOfRange ? "Exame registrado com alerta." : "Exame registrado.",
    );
  } catch (error) {
    return fail(
      error instanceof Error
        ? error.message
        : "Não foi possível registrar o exame.",
    );
  }
}

export async function createExamRequestAction(
  formData: FormData,
): Promise<ProfessionalActionResult> {
  const patientId = text(formData.get("patientId"));
  const title = text(formData.get("title"));
  const dueDateText = text(formData.get("dueDate"));
  if (!patientId || title.length < 2 || title.length > 200)
    return fail("Informe a solicitação do exame.");
  try {
    const context = await requireProfessionalAccess(patientId, "CLINICAL");
    const request = await prisma.examRequest.create({
      data: {
        patientId,
        requestedById: context.user.id,
        title,
        instructions: text(formData.get("instructions")) || null,
        dueDate: dueDateText ? new Date(dueDateText) : null,
      },
    });
    await writeClinicalAudit({
      context,
      patientId,
      action: "CREATE",
      entityType: "EXAM_REQUEST",
      entityId: request.id,
    });
    refresh(patientId);
    return ok("Solicitação de exame registrada.");
  } catch (error) {
    return fail(
      error instanceof Error
        ? error.message
        : "Não foi possível criar a solicitação.",
    );
  }
}

export async function uploadClinicalDocumentAction(
  formData: FormData,
): Promise<ProfessionalActionResult> {
  const patientId = text(formData.get("patientId"));
  const file = formData.get("file");
  const allowed = ["application/pdf", "image/jpeg", "image/png"];
  if (
    !(file instanceof File) ||
    !allowed.includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    return fail("Envie PDF, JPG ou PNG de até 10 MB.");
  try {
    const context = await requireProfessionalAccess(patientId, "CLINICAL");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const storagePath = `${patientId}/${Date.now()}-${safeName}`;
    const supabase = createAdminClient();
    const { error } = await supabase.storage
      .from("clinical-documents")
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (error) return fail(error.message);
    const document = await prisma.clinicalDocument.create({
      data: {
        patientId,
        uploadedById: context.user.id,
        storagePath,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      },
    });
    await writeClinicalAudit({
      context,
      patientId,
      action: "UPLOAD",
      entityType: "CLINICAL_DOCUMENT",
      entityId: document.id,
    });
    refresh(patientId);
    return ok("Documento clínico enviado.");
  } catch (error) {
    return fail(
      error instanceof Error
        ? error.message
        : "Não foi possível enviar o documento.",
    );
  }
}

export async function createNoteAction(
  formData: FormData,
): Promise<ProfessionalActionResult> {
  const patientId = text(formData.get("patientId"));
  const content = text(formData.get("content"));
  const visibility = text(formData.get("visibility")) || "PRIVATE";
  if (content.length < 2 || content.length > 10000)
    return fail("A anotação deve ter entre 2 e 10.000 caracteres.");
  try {
    const context = await requireProfessionalAccess(patientId, "NOTES");
    const note = await prisma.professionalNote.create({
      data: {
        patientId,
        authorId: context.user.id,
        title: text(formData.get("title")) || null,
        content,
        visibility: visibility as never,
      },
    });
    await writeClinicalAudit({
      context,
      patientId,
      action: "CREATE",
      entityType: "PROFESSIONAL_NOTE",
      entityId: note.id,
      metadata: { visibility },
    });
    refresh(patientId);
    return ok("Anotação salva.");
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Não foi possível salvar.",
    );
  }
}

export async function createAppointmentAction(
  formData: FormData,
): Promise<ProfessionalActionResult> {
  const patientId = text(formData.get("patientId"));
  const scheduledAt = new Date(text(formData.get("scheduledAt")));
  if (Number.isNaN(scheduledAt.getTime()))
    return fail("Informe uma data válida.");
  try {
    const context = await requireProfessionalAccess(patientId, "NOTES");
    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        professionalId: context.user.id,
        scheduledAt,
        durationMin: Number(formData.get("durationMin")) || 50,
        notes: text(formData.get("notes")) || null,
      },
    });
    await writeClinicalAudit({
      context,
      patientId,
      action: "CREATE",
      entityType: "APPOINTMENT",
      entityId: appointment.id,
    });
    refresh(patientId);
    return ok("Consulta agendada.");
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Não foi possível agendar.",
    );
  }
}

export async function createSharedGoalAction(
  formData: FormData,
): Promise<ProfessionalActionResult> {
  const patientId = text(formData.get("patientId"));
  const title = text(formData.get("title"));
  const dateText = text(formData.get("targetDate"));
  if (!patientId || title.length < 2 || title.length > 200)
    return fail("Informe uma meta válida.");
  try {
    const context = await requireProfessionalAccess(patientId, "NOTES");
    const goal = await prisma.sharedGoal.create({
      data: {
        patientId,
        authoredById: context.user.id,
        title,
        targetValue: numberOrNull(formData.get("targetValue")),
        unit: text(formData.get("unit")) || null,
        targetDate: dateText ? new Date(dateText) : null,
      },
    });
    await writeClinicalAudit({
      context,
      patientId,
      action: "CREATE",
      entityType: "SHARED_GOAL",
      entityId: goal.id,
    });
    refresh(patientId);
    return ok("Meta compartilhada criada.");
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Não foi possível criar a meta.",
    );
  }
}

export async function sendProfessionalMessageAction(
  formData: FormData,
): Promise<ProfessionalActionResult> {
  const patientId = text(formData.get("patientId"));
  const body = text(formData.get("body"));
  if (body.length < 1 || body.length > 1000)
    return fail("A mensagem deve ter até 1.000 caracteres.");
  try {
    const context = await requireProfessionalAccess(patientId, "MESSAGING");
    const patient = await prisma.user.findUnique({
      where: { id: patientId },
      select: { phone: true },
    });
    if (!patient?.phone)
      return fail("Este paciente ainda não vinculou o WhatsApp.");
    const lastInbound = await prisma.chatMessage.findFirst({
      where: { userId: patientId, channel: "whatsapp", direction: "INBOUND" },
      orderBy: { createdAt: "desc" },
    });
    const inWindow = Boolean(
      lastInbound &&
      Date.now() - lastInbound.createdAt.getTime() < 24 * 60 * 60 * 1000,
    );
    if (!inWindow && !process.env.META_PROFESSIONAL_TEMPLATE_NAME) {
      await prisma.chatMessage.create({
        data: {
          userId: patientId,
          role: "professional",
          content: body,
          channel: "whatsapp",
          direction: "OUTBOUND",
          status: "DRAFT",
          professionalId: context.user.id,
          templateName: "professional_followup_pt_br",
        },
      });
      refresh(patientId);
      return fail(
        "Template profissional ainda não configurado. Mensagem salva como rascunho.",
      );
    }
    const metaMessageId = inWindow
      ? await sendWhatsAppMessage(patient.phone, body)
      : await sendWhatsAppTemplate(patient.phone, body);
    const message = await prisma.chatMessage.create({
      data: {
        userId: patientId,
        role: "professional",
        content: body,
        channel: "whatsapp",
        direction: "OUTBOUND",
        status: "SENT",
        professionalId: context.user.id,
        metaMessageId,
        templateName: inWindow
          ? null
          : process.env.META_PROFESSIONAL_TEMPLATE_NAME,
      },
    });
    await prisma.careConversation.upsert({
      where: { patientId },
      update: { humanModeUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      create: {
        patientId,
        humanModeUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    await writeClinicalAudit({
      context,
      patientId,
      action: "SEND",
      entityType: "WHATSAPP_MESSAGE",
      entityId: message.id,
    });
    refresh(patientId);
    return ok("Mensagem enviada; IA pausada por 24 horas.");
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Não foi possível enviar.",
    );
  }
}

export async function releaseConversationToAiAction(
  formData: FormData,
): Promise<ProfessionalActionResult> {
  const patientId = text(formData.get("patientId"));
  try {
    const context = await requireProfessionalAccess(patientId, "MESSAGING");
    await prisma.careConversation.upsert({
      where: { patientId },
      update: { humanModeUntil: null },
      create: { patientId },
    });
    await writeClinicalAudit({
      context,
      patientId,
      action: "RELEASE_AI",
      entityType: "CARE_CONVERSATION",
    });
    refresh(patientId);
    return ok("Conversa devolvida para a IA.");
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Não foi possível atualizar.",
    );
  }
}

export async function inviteProfessionalAction(
  formData: FormData,
): Promise<ProfessionalActionResult> {
  const email = text(formData.get("email")).toLowerCase();
  const role = text(formData.get("role"));
  if (
    !z.string().email().safeParse(email).success ||
    !["NUTRITIONIST", "TRAINER"].includes(role)
  )
    return fail("Convite inválido.");
  try {
    const context = await requireProfessionalAccess();
    if (context.role !== "OWNER")
      return fail("Somente o proprietário pode convidar profissionais.");
    const supabase = createAdminClient();
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fitsync.app.br"}/pro`,
    });
    if (error || !data.user)
      return fail(error?.message ?? "Não foi possível enviar o convite.");
    const user = await prisma.user.upsert({
      where: { supabaseId: data.user.id },
      update: { email },
      create: { supabaseId: data.user.id, email },
    });
    await prisma.practiceMember.upsert({
      where: {
        practiceId_userId: { practiceId: context.practiceId, userId: user.id },
      },
      update: { role: role as never, active: true },
      create: {
        practiceId: context.practiceId,
        userId: user.id,
        role: role as never,
      },
    });
    revalidatePath("/pro/equipe");
    return ok("Convite enviado por e-mail.");
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Não foi possível convidar.",
    );
  }
}

export async function assignPatientAction(
  formData: FormData,
): Promise<ProfessionalActionResult> {
  const patientEmail = text(formData.get("patientEmail")).toLowerCase();
  const professionalEmail = text(
    formData.get("professionalEmail"),
  ).toLowerCase();
  try {
    const context = await requireProfessionalAccess();
    if (context.role !== "OWNER")
      return fail("Somente o proprietário pode atribuir pacientes.");
    const [patient, member] = await Promise.all([
      prisma.user.findUnique({ where: { email: patientEmail } }),
      prisma.practiceMember.findFirst({
        where: {
          practiceId: context.practiceId,
          active: true,
          user: { email: professionalEmail },
        },
      }),
    ]);
    if (!patient || !member)
      return fail("Paciente ou profissional não encontrado.");
    await prisma.patientAssignment.upsert({
      where: {
        practiceId_patientId_professionalId: {
          practiceId: context.practiceId,
          patientId: patient.id,
          professionalId: member.userId,
        },
      },
      update: { active: true, scopes: defaultScopesForRole(member.role) },
      create: {
        practiceId: context.practiceId,
        patientId: patient.id,
        professionalId: member.userId,
        scopes: defaultScopesForRole(member.role),
      },
    });
    revalidatePath("/pro");
    return ok("Paciente atribuído.");
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Não foi possível atribuir.",
    );
  }
}
