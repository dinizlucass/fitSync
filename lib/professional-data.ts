import { AssignmentScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireProfessionalAccess,
  writeClinicalAudit,
} from "@/lib/professional";
import { createAdminClient } from "@/lib/supabase/admin";

export type AttentionLevel = "CRITICAL" | "WARNING" | "INFO" | "REGULAR";

export type PatientListItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  goal: string;
  lastActivity: string | null;
  priority: AttentionLevel;
  priorityReason: string;
};

const goalLabels: Record<string, string> = {
  GAIN_MUSCLE: "Ganho de massa",
  LOSE_FAT: "Perda de gordura",
  RECOMPOSITION: "Recomposição",
  MAINTAIN: "Manutenção",
};

export function calculateAttention(input: {
  abnormalExam: boolean;
  lastActivity: Date | null;
  adherence: number | null;
  nextAppointment: Date | null;
  trend?: "PLATEAU" | "OPPOSITE" | null;
}): { priority: AttentionLevel; reason: string } {
  const now = Date.now();
  if (input.abnormalExam)
    return { priority: "CRITICAL", reason: "Exame fora da referência" };
  if (
    !input.lastActivity ||
    now - input.lastActivity.getTime() >= 7 * 86400000
  ) {
    return { priority: "CRITICAL", reason: "Sem registros há 7 dias" };
  }
  if (input.adherence != null && input.adherence < 0.6) {
    return { priority: "WARNING", reason: "Aderência abaixo de 60%" };
  }
  if (input.trend === "OPPOSITE")
    return { priority: "WARNING", reason: "Evolução oposta à meta" };
  if (input.trend === "PLATEAU")
    return { priority: "WARNING", reason: "Possível platô de evolução" };
  if (
    input.nextAppointment &&
    input.nextAppointment.getTime() - now <= 3 * 86400000
  ) {
    return { priority: "INFO", reason: "Consulta próxima" };
  }
  return { priority: "REGULAR", reason: "Acompanhamento em dia" };
}

export async function listAssignedPatients(input?: {
  query?: string;
  priority?: AttentionLevel | "ALL";
  cursor?: string;
  take?: number;
}) {
  const context = await requireProfessionalAccess();
  const query = input?.query?.trim();
  const take = Math.min(Math.max(input?.take ?? 40, 1), 80);

  const assignments = await prisma.patientAssignment.findMany({
    where: {
      practiceId: context.practiceId,
      active: true,
      ...(context.role === "OWNER" ? {} : { professionalId: context.user.id }),
      ...(query
        ? {
            patient: {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
                { phone: { contains: query } },
              ],
            },
          }
        : {}),
    },
    distinct: ["patientId"],
    orderBy: [{ patientId: "asc" }],
    ...(input?.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    take: take + 1,
    include: {
      patient: {
        include: {
          profile: true,
          mealLogs: { orderBy: { date: "desc" }, take: 14 },
          workoutSessions: { orderBy: { date: "desc" }, take: 1 },
          weightLogs: { orderBy: { date: "desc" }, take: 4 },
          examCollections: {
            include: { results: { where: { outOfRange: true }, take: 1 } },
            orderBy: { collectedAt: "desc" },
            take: 1,
          },
          appointments: {
            where: { scheduledAt: { gte: new Date() }, status: "SCHEDULED" },
            orderBy: { scheduledAt: "asc" },
            take: 1,
          },
        },
      },
    },
  });

  const items: PatientListItem[] = assignments
    .map(({ patient }) => {
      const dates = [
        patient.mealLogs[0]?.date,
        patient.workoutSessions[0]?.date,
        patient.weightLogs[0]?.date,
      ].filter(Boolean) as Date[];
      const lastActivity =
        dates.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
      const activeDays = new Set(
        patient.mealLogs
          .filter((log) => Date.now() - log.date.getTime() <= 7 * 86400000)
          .map((log) => log.date.toISOString().slice(0, 10)),
      ).size;
      const newestWeight = patient.weightLogs[0];
      const oldestWeight = patient.weightLogs.at(-1);
      const delta =
        newestWeight && oldestWeight
          ? newestWeight.weightKg - oldestWeight.weightKg
          : null;
      const trend =
        delta == null || patient.weightLogs.length < 3
          ? null
          : patient.profile?.goalType === "LOSE_FAT" && delta > 0.3
            ? "OPPOSITE"
            : patient.profile?.goalType === "GAIN_MUSCLE" && delta < -0.3
              ? "OPPOSITE"
              : Math.abs(delta) < 0.2
                ? "PLATEAU"
                : null;
      const a = calculateAttention({
        abnormalExam: Boolean(patient.examCollections[0]?.results.length),
        lastActivity,
        adherence: activeDays / 7,
        nextAppointment: patient.appointments[0]?.scheduledAt ?? null,
        trend,
      });
      return {
        id: patient.id,
        name: patient.name ?? "Paciente sem nome",
        email: patient.email,
        phone: patient.phone,
        goal:
          goalLabels[patient.profile?.goalType ?? ""] ?? "Meta não definida",
        lastActivity: lastActivity?.toISOString() ?? null,
        priority: a.priority,
        priorityReason: a.reason,
      };
    })
    .filter(
      (patient) =>
        !input?.priority ||
        input.priority === "ALL" ||
        patient.priority === input.priority,
    );

  return {
    items: items.slice(0, take),
    nextCursor:
      assignments.length > take ? (assignments[take - 1]?.id ?? null) : null,
    context,
  };
}

export async function getProfessionalPatient(patientId: string) {
  const context = await requireProfessionalAccess(patientId);
  const patient = await prisma.user.findUnique({
    where: { id: patientId },
    include: {
      profile: true,
      weightLogs: { orderBy: { date: "asc" }, take: 180 },
      progressMeasurements: { orderBy: { date: "desc" }, take: 24 },
      progressPhotos: { orderBy: { date: "desc" }, take: 24 },
      mealLogs: {
        orderBy: { date: "desc" },
        take: 42,
        include: { items: { include: { food: true } } },
      },
      dietPlan: {
        include: {
          activeVersion: {
            include: {
              meals: {
                orderBy: { order: "asc" },
                include: { items: { orderBy: { order: "asc" } } },
              },
            },
          },
          versions: { orderBy: { version: "desc" }, take: 12 },
        },
      },
      workouts: {
        where: { archived: false },
        include: {
          exercises: { include: { exercise: true }, orderBy: { order: "asc" } },
          sessions: {
            orderBy: { date: "desc" },
            take: 8,
            include: { sets: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      examCollections: {
        orderBy: { collectedAt: "desc" },
        include: { results: { orderBy: { marker: "asc" } }, documents: true },
      },
      examRequests: { orderBy: { createdAt: "desc" }, take: 20 },
      clinicalDocuments: { orderBy: { createdAt: "desc" }, take: 30 },
      professionalNotes: {
        where: {
          OR: [
            { authorId: context.user.id },
            { visibility: { in: ["CARE_TEAM", "PATIENT"] } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { author: { select: { name: true } } },
      },
      appointments: {
        orderBy: { scheduledAt: "desc" },
        take: 20,
        include: { professional: { select: { name: true } } },
      },
      sharedGoals: { orderBy: { createdAt: "desc" }, take: 20 },
      chatMessages: {
        orderBy: { createdAt: "desc" },
        take: 40,
        include: { professional: { select: { name: true } } },
      },
      careConversation: true,
    },
  });
  if (!patient) return null;

  let photoUrls: Array<{ id: string; url: string | null }> = [];
  let documentUrls: Array<{ id: string; url: string | null }> = [];
  try {
    const storage = createAdminClient().storage;
    [photoUrls, documentUrls] = await Promise.all([
      Promise.all(
        patient.progressPhotos.map(async (photo) => ({
          id: photo.id,
          url:
            (
              await storage
                .from("progress-photos")
                .createSignedUrl(photo.storagePath, 600)
            ).data?.signedUrl ?? null,
        })),
      ),
      Promise.all(
        patient.clinicalDocuments.map(async (document) => ({
          id: document.id,
          url:
            (
              await storage
                .from("clinical-documents")
                .createSignedUrl(document.storagePath, 600)
            ).data?.signedUrl ?? null,
        })),
      ),
    ]);
  } catch {
    // Clinical data remains available even when Storage is not configured yet.
  }

  await writeClinicalAudit({
    context,
    patientId,
    action: "VIEW",
    entityType: "PATIENT_RECORD",
  });
  return { context, patient, media: { photoUrls, documentUrls } };
}

export async function assertScope(patientId: string, scope: AssignmentScope) {
  return requireProfessionalAccess(patientId, scope);
}
