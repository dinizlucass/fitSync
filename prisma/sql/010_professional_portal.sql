-- FitSync — portal profissional multiusuário e prontuário clínico.
-- Aplicar depois de 009_quiz_leads.sql.

CREATE TYPE "ProfessionalRole" AS ENUM ('OWNER', 'NUTRITIONIST', 'TRAINER');
CREATE TYPE "AssignmentScope" AS ENUM ('NUTRITION', 'TRAINING', 'CLINICAL', 'MESSAGING', 'NOTES');
CREATE TYPE "NoteVisibility" AS ENUM ('PRIVATE', 'CARE_TEAM', 'PATIENT');
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "MealLogSource" AS ENUM ('APP', 'WHATSAPP', 'PROFESSIONAL');
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'REVIEWED', 'NEEDS_ATTENTION');
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "MessageStatus" AS ENUM ('DRAFT', 'PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'RECEIVED');
CREATE TYPE "ExamStatus" AS ENUM ('REQUESTED', 'COLLECTED', 'REVIEWED');

ALTER TABLE workouts ADD COLUMN IF NOT EXISTS "authoredById" TEXT,
  ADD COLUMN IF NOT EXISTS "scheduledWeekdays" INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "changeNote" TEXT;
ALTER TABLE workouts ADD CONSTRAINT workouts_authored_by_fk FOREIGN KEY ("authoredById") REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS workouts_authored_by_idx ON workouts("authoredById");
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS rpe INTEGER,
  ADD COLUMN IF NOT EXISTS "patientFeedback" TEXT;
ALTER TABLE session_sets ADD COLUMN IF NOT EXISTS rpe INTEGER;
ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS source "MealLogSource" NOT NULL DEFAULT 'APP',
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS "photoPath" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS direction "MessageDirection" NOT NULL DEFAULT 'INBOUND',
  ADD COLUMN IF NOT EXISTS status "MessageStatus" NOT NULL DEFAULT 'RECEIVED',
  ADD COLUMN IF NOT EXISTS "professionalId" TEXT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "metaMessageId" TEXT,
  ADD COLUMN IF NOT EXISTS "templateName" TEXT,
  ADD COLUMN IF NOT EXISTS "errorMessage" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "chat_messages_metaMessageId_key" ON chat_messages("metaMessageId") WHERE "metaMessageId" IS NOT NULL;

CREATE TABLE practices (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE practice_members (
  id TEXT PRIMARY KEY, "practiceId" TEXT NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, role "ProfessionalRole" NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("practiceId", "userId")
);
CREATE INDEX practice_members_user_active_idx ON practice_members("userId", active);

CREATE TABLE patient_assignments (
  id TEXT PRIMARY KEY, "practiceId" TEXT NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  "patientId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "professionalId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scopes "AssignmentScope"[] NOT NULL, active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("practiceId", "patientId", "professionalId")
);
CREATE INDEX patient_assignments_professional_idx ON patient_assignments("professionalId", active, "patientId");
CREATE INDEX patient_assignments_patient_idx ON patient_assignments("patientId", active);

CREATE TABLE clinical_audit_logs (
  id TEXT PRIMARY KEY, "practiceId" TEXT NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  "actorId" TEXT NOT NULL REFERENCES users(id), "patientId" TEXT NOT NULL,
  action TEXT NOT NULL, "entityType" TEXT NOT NULL, "entityId" TEXT, metadata JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX clinical_audit_patient_idx ON clinical_audit_logs("patientId", "createdAt");
CREATE INDEX clinical_audit_actor_idx ON clinical_audit_logs("actorId", "createdAt");

CREATE TABLE progress_measurements (
  id TEXT PRIMARY KEY, "patientId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "recordedById" TEXT REFERENCES users(id) ON DELETE SET NULL, date TIMESTAMPTZ NOT NULL DEFAULT now(),
  "bodyFatPct" DOUBLE PRECISION, "waistCm" DOUBLE PRECISION, "hipCm" DOUBLE PRECISION,
  "chestCm" DOUBLE PRECISION, "armCm" DOUBLE PRECISION, "thighCm" DOUBLE PRECISION,
  notes TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX progress_measurements_patient_date_idx ON progress_measurements("patientId", date);

CREATE TABLE progress_photos (
  id TEXT PRIMARY KEY, "patientId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "recordedById" TEXT REFERENCES users(id) ON DELETE SET NULL, "storagePath" TEXT NOT NULL,
  angle TEXT NOT NULL, date TIMESTAMPTZ NOT NULL DEFAULT now(), "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX progress_photos_patient_date_idx ON progress_photos("patientId", date);

CREATE TABLE diet_plans (
  id TEXT PRIMARY KEY, "patientId" TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  "activeVersionId" TEXT UNIQUE, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE diet_plan_versions (
  id TEXT PRIMARY KEY, "planId" TEXT NOT NULL REFERENCES diet_plans(id) ON DELETE CASCADE,
  version INTEGER NOT NULL, status "PlanStatus" NOT NULL DEFAULT 'DRAFT', title TEXT NOT NULL DEFAULT 'Plano alimentar',
  "calorieGoal" INTEGER NOT NULL, "proteinGoalG" DOUBLE PRECISION NOT NULL,
  "carbsGoalG" DOUBLE PRECISION NOT NULL, "fatGoalG" DOUBLE PRECISION NOT NULL,
  notes TEXT, "authoredById" TEXT REFERENCES users(id) ON DELETE SET NULL,
  "publishedAt" TIMESTAMPTZ, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE("planId", version)
);
ALTER TABLE diet_plans ADD CONSTRAINT diet_plans_active_version_fk FOREIGN KEY ("activeVersionId") REFERENCES diet_plan_versions(id) ON DELETE SET NULL;
CREATE INDEX diet_plan_versions_plan_status_idx ON diet_plan_versions("planId", status);
CREATE TABLE diet_plan_meals (
  id TEXT PRIMARY KEY, "versionId" TEXT NOT NULL REFERENCES diet_plan_versions(id) ON DELETE CASCADE,
  "mealType" "MealType" NOT NULL, name TEXT NOT NULL, time TEXT, "order" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX diet_plan_meals_version_order_idx ON diet_plan_meals("versionId", "order");
CREATE TABLE diet_plan_items (
  id TEXT PRIMARY KEY, "mealId" TEXT NOT NULL REFERENCES diet_plan_meals(id) ON DELETE CASCADE,
  "foodId" TEXT REFERENCES foods(id) ON DELETE SET NULL, name TEXT NOT NULL, "quantityG" DOUBLE PRECISION NOT NULL,
  calories DOUBLE PRECISION NOT NULL, "proteinG" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "carbsG" DOUBLE PRECISION NOT NULL DEFAULT 0, "fatG" DOUBLE PRECISION NOT NULL DEFAULT 0,
  substitutions JSONB, "order" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX diet_plan_items_meal_order_idx ON diet_plan_items("mealId", "order");

-- Cardápios atuais viram a versão 1, sem alterar a tabela usada pelo app do paciente.
INSERT INTO diet_plans (id, "patientId") SELECT 'dp_' || md5(id), "userId" FROM diet_templates ON CONFLICT ("patientId") DO NOTHING;
INSERT INTO diet_plan_versions (id, "planId", version, status, title, "calorieGoal", "proteinGoalG", "carbsGoalG", "fatGoalG", "publishedAt")
SELECT 'dpv_' || md5(dt.id), dp.id, 1, 'PUBLISHED', dt.name, dt."calorieGoal",
  COALESCE(p."proteinGoalG",0), COALESCE(p."carbsGoalG",0), COALESCE(p."fatGoalG",0), now()
FROM diet_templates dt JOIN diet_plans dp ON dp."patientId"=dt."userId" LEFT JOIN profiles p ON p."userId"=dt."userId"
ON CONFLICT ("planId", version) DO NOTHING;
INSERT INTO diet_plan_meals (id, "versionId", "mealType", name, "order")
SELECT 'dpm_' || md5(m.id), 'dpv_' || md5(t.id), m."mealType", m."mealName", row_number() OVER (PARTITION BY m."templateId" ORDER BY m.id)::int
FROM diet_template_meals m JOIN diet_templates t ON t.id=m."templateId" ON CONFLICT DO NOTHING;
INSERT INTO diet_plan_items (id, "mealId", "foodId", name, "quantityG", calories, "proteinG", "carbsG", "fatG", "order")
SELECT 'dpi_' || md5(i.id), 'dpm_' || md5(i."mealId"), i."foodId", f.name, i."quantityG",
  f.calories*i."quantityG"/f."servingSize", f."proteinG"*i."quantityG"/f."servingSize",
  f."carbsG"*i."quantityG"/f."servingSize", f."fatG"*i."quantityG"/f."servingSize",
  row_number() OVER (PARTITION BY i."mealId" ORDER BY i.id)::int
FROM diet_template_meal_items i JOIN foods f ON f.id=i."foodId" ON CONFLICT DO NOTHING;
UPDATE diet_plans dp SET "activeVersionId"=v.id FROM diet_plan_versions v WHERE v."planId"=dp.id AND v.version=1;

CREATE TABLE exam_collections (
  id TEXT PRIMARY KEY, "patientId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "collectedAt" TIMESTAMPTZ NOT NULL, laboratory TEXT, status "ExamStatus" NOT NULL DEFAULT 'COLLECTED',
  notes TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX exam_collections_patient_date_idx ON exam_collections("patientId", "collectedAt");
CREATE TABLE exam_results (
  id TEXT PRIMARY KEY, "collectionId" TEXT NOT NULL REFERENCES exam_collections(id) ON DELETE CASCADE,
  marker TEXT NOT NULL, value DOUBLE PRECISION, "textValue" TEXT, unit TEXT,
  "referenceMin" DOUBLE PRECISION, "referenceMax" DOUBLE PRECISION, "outOfRange" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX exam_results_collection_marker_idx ON exam_results("collectionId", marker);
CREATE TABLE exam_requests (
  id TEXT PRIMARY KEY, "patientId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "requestedById" TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, instructions TEXT,
  "dueDate" TIMESTAMPTZ, status "ExamStatus" NOT NULL DEFAULT 'REQUESTED', "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX exam_requests_patient_status_idx ON exam_requests("patientId", status);
CREATE TABLE clinical_documents (
  id TEXT PRIMARY KEY, "patientId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "collectionId" TEXT REFERENCES exam_collections(id) ON DELETE SET NULL, "uploadedById" TEXT REFERENCES users(id) ON DELETE SET NULL,
  "storagePath" TEXT NOT NULL, "fileName" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX clinical_documents_patient_date_idx ON clinical_documents("patientId", "createdAt");
CREATE TABLE professional_notes (
  id TEXT PRIMARY KEY, "patientId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "authorId" TEXT NOT NULL REFERENCES users(id), title TEXT, content TEXT NOT NULL,
  visibility "NoteVisibility" NOT NULL DEFAULT 'PRIVATE', "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX professional_notes_patient_date_idx ON professional_notes("patientId", "createdAt");
CREATE TABLE appointments (
  id TEXT PRIMARY KEY, "patientId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "professionalId" TEXT NOT NULL REFERENCES users(id), "scheduledAt" TIMESTAMPTZ NOT NULL,
  "durationMin" INTEGER NOT NULL DEFAULT 50, status TEXT NOT NULL DEFAULT 'SCHEDULED', notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX appointments_patient_date_idx ON appointments("patientId", "scheduledAt");
CREATE INDEX appointments_professional_date_idx ON appointments("professionalId", "scheduledAt");
CREATE TABLE shared_goals (
  id TEXT PRIMARY KEY, "patientId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "authoredById" TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, "targetValue" DOUBLE PRECISION,
  unit TEXT, "targetDate" TIMESTAMPTZ, "completedAt" TIMESTAMPTZ, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX shared_goals_patient_completed_idx ON shared_goals("patientId", "completedAt");
CREATE TABLE care_conversations (
  id TEXT PRIMARY KEY, "patientId" TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  "humanModeUntil" TIMESTAMPTZ, "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dados clínicos são acessados pela aplicação server-side. RLS nega acesso direto
-- via Data API até políticas específicas serem concedidas para o usuário autenticado.
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['practices','practice_members','patient_assignments','clinical_audit_logs',
    'progress_measurements','progress_photos','diet_plans','diet_plan_versions','diet_plan_meals','diet_plan_items',
    'exam_collections','exam_results','exam_requests','clinical_documents','professional_notes','appointments',
    'shared_goals','care_conversations']
  LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t); END LOOP;
END $$;

-- Buckets privados; paths devem começar pelo ID interno do paciente.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('clinical-documents','clinical-documents',false,10485760,ARRAY['application/pdf','image/jpeg','image/png']),
  ('progress-photos','progress-photos',false,5242880,ARRAY['image/jpeg','image/png','image/webp']),
  ('meal-photos','meal-photos',false,5242880,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;
