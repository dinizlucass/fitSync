import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  CalendarDays,
  Dumbbell,
  FileText,
  MessageCircle,
  NotebookPen,
  Salad,
  Scale,
  TestTube2,
  TrendingUp,
} from "lucide-react";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import SubmitButton from "@/components/professional/SubmitButton";
import WeightChart from "@/components/charts/WeightChart";
import { getProfessionalPatient } from "@/lib/professional-data";
import {
  addDietPlanItemAction,
  addWorkoutExerciseAction,
  createAppointmentAction,
  createDietVersionAction,
  createExamRequestAction,
  createExamResultAction,
  createMeasurementAction,
  createNoteAction,
  createSharedGoalAction,
  createWorkoutForPatientAction,
  publishDietVersionAction,
  releaseConversationToAiAction,
  sendProfessionalMessageAction,
  uploadClinicalDocumentAction,
  uploadProgressPhotoAction,
} from "@/app/actions/professional";

const tabs = [
  ["evolucao", "Evolução"],
  ["plano-alimentar", "Plano alimentar"],
  ["diario", "Diário"],
  ["treinos", "Treinos"],
  ["exames", "Exames"],
  ["anotacoes", "Anotações"],
] as const;
type Tab = (typeof tabs)[number][0];
const validTabs = new Set(tabs.map(([key]) => key));
const fmt = (date: Date | string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(date));
const num = (value?: number | null, suffix = "") =>
  value == null ? "—" : `${value.toFixed(1)}${suffix}`;
const field =
  "w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-emerald-500";

export default async function ProfessionalPatientPage({
  params,
}: {
  params: Promise<{ patientId: string; tab: string }>;
}) {
  const { patientId, tab: rawTab } = await params;
  if (!validTabs.has(rawTab as Tab)) notFound();
  const result = await getProfessionalPatient(patientId);
  if (!result) notFound();
  const { patient } = result;
  const tab = rawTab as Tab;
  const latestWeight =
    patient.weightLogs.at(-1)?.weightKg ?? patient.profile?.weightKg;
  const activeDiet = patient.dietPlan?.activeVersion;
  const humanMode = Boolean(
    patient.careConversation?.humanModeUntil &&
    patient.careConversation.humanModeUntil > new Date(),
  );

  return (
    <main className="min-h-screen pb-24">
      <header
        className="sticky top-0 z-10 border-b bg-white/95 px-4 py-4 backdrop-blur dark:bg-zinc-950/95 lg:top-0 lg:px-8"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">
                  {patient.name ?? "Paciente sem nome"}
                </h1>
                {patient.phone ? (
                  <Badge tone="success">WhatsApp ativo</Badge>
                ) : (
                  <Badge tone="warning">WhatsApp não vinculado</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                {patient.email} ·{" "}
                {patient.profile?.goalType ?? "Meta não definida"}
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`#mensagem`}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"
                style={{ borderColor: "var(--color-border)" }}
              >
                <MessageCircle className="h-4 w-4" />
                Mensagem
              </Link>
              <Link
                href={`#novo-registro`}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
              >
                Novo registro
              </Link>
            </div>
          </div>
          <nav
            className="mt-4 flex gap-1 overflow-x-auto pb-1"
            aria-label="Seções do paciente"
          >
            {tabs.map(([key, label]) => (
              <Link
                key={key}
                href={`/pro/pacientes/${patientId}/${key}`}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${tab === key ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl space-y-5 p-4 lg:p-8">
        {tab === "evolucao" && (
          <Evolution
            patient={patient}
            patientId={patientId}
            latestWeight={latestWeight}
          />
        )}
        {tab === "evolucao" && (
          <MediaUpload patientId={patientId} kind="photo" />
        )}
        {tab === "plano-alimentar" && (
          <DietPlan
            patient={patient}
            patientId={patientId}
            activeDiet={activeDiet}
          />
        )}
        {tab === "diario" && <Diary patient={patient} />}
        {tab === "treinos" && (
          <Training patient={patient} patientId={patientId} />
        )}
        {tab === "exames" && <Exams patient={patient} patientId={patientId} />}
        {tab === "exames" && (
          <MediaUpload patientId={patientId} kind="document" />
        )}
        {tab === "anotacoes" && (
          <Notes patient={patient} patientId={patientId} />
        )}
        <Messaging
          patient={patient}
          patientId={patientId}
          humanMode={humanMode}
        />
      </div>
    </main>
  );
}

function Evolution({
  patient,
  patientId,
  latestWeight,
}: {
  patient: any;
  patientId: string;
  latestWeight?: number | null;
}) {
  const latest = patient.progressMeasurements[0];
  const abnormal = patient.examCollections.some((collection: any) =>
    collection.results.some((result: any) => result.outOfRange),
  );
  return (
    <>
      {abnormal && (
        <Alert tone="danger" title="Há exames fora da faixa de referência">
          Revise a aba Exames antes do próximo retorno.
        </Alert>
      )}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={<Scale />}
          label="Peso atual"
          value={num(latestWeight, " kg")}
          detail={`${patient.weightLogs.length} registros`}
        />
        <Metric
          icon={<Activity />}
          label="Gordura corporal"
          value={num(latest?.bodyFatPct, "%")}
          detail="Última avaliação"
        />
        <Metric
          icon={<TrendingUp />}
          label="Cintura"
          value={num(latest?.waistCm, " cm")}
          detail="Medida mais recente"
        />
        <Metric
          icon={<Dumbbell />}
          label="Treinos ativos"
          value={String(patient.workouts.length)}
          detail={`${patient.workouts.reduce((n: number, w: any) => n + w.sessions.length, 0)} sessões recentes`}
        />
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <div className="mb-4">
            <h2 className="font-semibold">Evolução do peso</h2>
            <p className="text-xs text-zinc-500">
              Histórico registrado pelo paciente
            </p>
          </div>
          {patient.weightLogs.length > 1 ? (
            <WeightChart
              data={patient.weightLogs.map((row: any) => ({
                date: row.date.toISOString(),
                weight: row.weightKg,
              }))}
            />
          ) : (
            <Empty text="Registre ao menos dois pesos para exibir o gráfico." />
          )}
        </Card>
        <Card>
          <h2 className="font-semibold">Últimas medidas</h2>
          <div
            className="mt-4 divide-y"
            style={{ borderColor: "var(--color-border)" }}
          >
            {[
              ["Gordura", latest?.bodyFatPct, "%"],
              ["Cintura", latest?.waistCm, " cm"],
              ["Quadril", latest?.hipCm, " cm"],
              ["Braço", latest?.armCm, " cm"],
              ["Coxa", latest?.thighCm, " cm"],
            ].map(([label, value, suffix]) => (
              <div
                className="flex justify-between py-2 text-sm"
                key={String(label)}
              >
                <span className="text-zinc-500">{label}</span>
                <strong>{num(value as number | null, suffix as string)}</strong>
              </div>
            ))}
          </div>
        </Card>
      </section>
      <div id="novo-registro" className="scroll-mt-40">
        <Card>
          <h2 className="font-semibold">Nova avaliação</h2>
          <form
            action={createMeasurementAction}
            className="mt-4 grid gap-3 md:grid-cols-4"
          >
            <input type="hidden" name="patientId" value={patientId} />
            <input
              className={field}
              name="bodyFatPct"
              type="number"
              step="0.1"
              placeholder="Gordura %"
            />
            <input
              className={field}
              name="waistCm"
              type="number"
              step="0.1"
              placeholder="Cintura cm"
            />
            <input className={field} name="notes" placeholder="Observações" />
            <SubmitButton>Registrar avaliação</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}

function DietPlan({
  patient,
  patientId,
  activeDiet,
}: {
  patient: any;
  patientId: string;
  activeDiet: any;
}) {
  const drafts =
    patient.dietPlan?.versions.filter(
      (version: any) => version.status === "DRAFT",
    ) ?? [];
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-4">
        <Metric
          icon={<Salad />}
          label="Calorias"
          value={`${activeDiet?.calorieGoal ?? patient.profile?.calorieGoal ?? 0} kcal`}
          detail="Meta publicada"
        />
        <Metric
          label="Proteína"
          value={`${activeDiet?.proteinGoalG ?? patient.profile?.proteinGoalG ?? 0} g`}
          detail="Meta diária"
        />
        <Metric
          label="Carboidratos"
          value={`${activeDiet?.carbsGoalG ?? patient.profile?.carbsGoalG ?? 0} g`}
          detail="Meta diária"
        />
        <Metric
          label="Gorduras"
          value={`${activeDiet?.fatGoalG ?? patient.profile?.fatGoalG ?? 0} g`}
          detail="Meta diária"
        />
      </section>
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">
              Plano ativo {activeDiet && `· v${activeDiet.version}`}
            </h2>
            <p className="text-xs text-zinc-500">
              Somente versões publicadas aparecem para o paciente.
            </p>
          </div>
          {activeDiet && <Badge tone="success">Publicado</Badge>}
        </div>
        <div className="mt-5 space-y-4">
          {activeDiet?.meals.length ? (
            activeDiet.meals.map((meal: any) => (
              <div
                key={meal.id}
                className="rounded-xl border p-4"
                style={{ borderColor: "var(--color-border)" }}
              >
                <div className="flex justify-between">
                  <h3 className="font-semibold">{meal.name}</h3>
                  <span className="text-xs text-zinc-500">{meal.time}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {meal.items.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>
                        {item.name}{" "}
                        <span className="text-zinc-500">
                          ({item.quantityG}g)
                        </span>
                      </span>
                      <span>{Math.round(item.calories)} kcal</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <Empty text="Nenhum plano publicado." />
          )}
        </div>
      </Card>
      <section className="grid gap-5 xl:grid-cols-2" id="novo-registro">
        <Card>
          <h2 className="font-semibold">Criar nova versão</h2>
          <form
            action={createDietVersionAction}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <input type="hidden" name="patientId" value={patientId} />
            <input
              className={field}
              required
              name="calorieGoal"
              type="number"
              placeholder="Calorias"
              defaultValue={
                activeDiet?.calorieGoal ?? patient.profile?.calorieGoal ?? ""
              }
            />
            <input
              className={field}
              required
              name="proteinGoalG"
              type="number"
              placeholder="Proteína (g)"
              defaultValue={
                activeDiet?.proteinGoalG ?? patient.profile?.proteinGoalG ?? ""
              }
            />
            <input
              className={field}
              required
              name="carbsGoalG"
              type="number"
              placeholder="Carboidratos (g)"
              defaultValue={
                activeDiet?.carbsGoalG ?? patient.profile?.carbsGoalG ?? ""
              }
            />
            <input
              className={field}
              required
              name="fatGoalG"
              type="number"
              placeholder="Gorduras (g)"
              defaultValue={
                activeDiet?.fatGoalG ?? patient.profile?.fatGoalG ?? ""
              }
            />
            <textarea
              className={`${field} sm:col-span-2`}
              name="notes"
              placeholder="Orientações do plano"
            />
            <div className="sm:col-span-2">
              <SubmitButton>Criar rascunho</SubmitButton>
            </div>
          </form>
        </Card>
        <Card>
          <h2 className="font-semibold">Rascunhos</h2>
          <div className="mt-4 space-y-3">
            {drafts.length ? (
              drafts.map((draft: any) => (
                <div
                  key={draft.id}
                  className="flex items-center justify-between rounded-xl border p-3"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <div>
                    <p className="text-sm font-semibold">
                      Versão {draft.version}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {draft.calorieGoal} kcal · criada em{" "}
                      {fmt(draft.createdAt)}
                    </p>
                  </div>
                  <form action={publishDietVersionAction}>
                    <input type="hidden" name="patientId" value={patientId} />
                    <input type="hidden" name="versionId" value={draft.id} />
                    <SubmitButton variant="secondary">Publicar</SubmitButton>
                  </form>
                </div>
              ))
            ) : (
              <Empty text="Nenhum rascunho pendente." />
            )}
          </div>
        </Card>
      </section>
      {drafts[0] && (
        <Card>
          <h2 className="font-semibold">
            Adicionar alimento à versão {drafts[0].version}
          </h2>
          <form
            action={addDietPlanItemAction}
            className="mt-4 grid gap-3 md:grid-cols-4"
          >
            <input type="hidden" name="patientId" value={patientId} />
            <input type="hidden" name="versionId" value={drafts[0].id} />
            <select className={field} name="mealType">
              <option value="BREAKFAST">Café da manhã</option>
              <option value="LUNCH">Almoço</option>
              <option value="SNACK">Lanche</option>
              <option value="DINNER">Jantar</option>
              <option value="CEIA">Ceia</option>
            </select>
            <input
              className={field}
              name="mealName"
              required
              placeholder="Nome da refeição"
            />
            <input
              className={field}
              name="itemName"
              required
              placeholder="Alimento"
            />
            <input
              className={field}
              name="quantityG"
              type="number"
              required
              placeholder="Quantidade (g)"
            />
            <input
              className={field}
              name="calories"
              type="number"
              placeholder="kcal"
            />
            <input
              className={field}
              name="proteinG"
              type="number"
              placeholder="Proteína"
            />
            <input
              className={field}
              name="carbsG"
              type="number"
              placeholder="Carbo"
            />
            <input
              className={field}
              name="fatG"
              type="number"
              placeholder="Gordura"
            />
            <input
              className={`${field} md:col-span-3`}
              name="substitutions"
              placeholder="Substituição opcional"
            />
            <SubmitButton>Adicionar</SubmitButton>
          </form>
        </Card>
      )}
    </>
  );
}

function Diary({ patient }: { patient: any }) {
  const logs = patient.mealLogs;
  const totals = (log: any) =>
    log.items.reduce(
      (sum: any, item: any) => ({
        calories:
          sum.calories +
          (item.food.calories * item.quantityG) / item.food.servingSize,
        protein:
          sum.protein +
          (item.food.proteinG * item.quantityG) / item.food.servingSize,
      }),
      { calories: 0, protein: 0 },
    );
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        <Metric
          label="Registros (6 semanas)"
          value={String(logs.length)}
          detail="Refeições registradas"
        />
        <Metric
          label="Com foto"
          value={String(logs.filter((log: any) => log.photoPath).length)}
          detail="Originais privados"
        />
        <Metric
          label="Precisam de atenção"
          value={String(
            logs.filter((log: any) => log.reviewStatus === "NEEDS_ATTENTION")
              .length,
          )}
          detail="Marcadas para retorno"
        />
      </section>
      <Card>
        <h2 className="font-semibold">Diário alimentar</h2>
        <div className="mt-4 space-y-3">
          {logs.length ? (
            logs.map((log: any) => {
              const total = totals(log);
              return (
                <article
                  key={log.id}
                  className="rounded-xl border p-4"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        {log.mealType} · {fmt(log.date)}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {log.source} · {log.items.length} itens
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {Math.round(total.calories)} kcal
                      </p>
                      <p className="text-xs text-zinc-500">
                        P {Math.round(total.protein)}g
                      </p>
                    </div>
                  </div>
                  {log.note && <p className="mt-3 text-sm">{log.note}</p>}
                  {log.photoPath && (
                    <Badge className="mt-3" tone="info">
                      Foto privada disponível
                    </Badge>
                  )}
                </article>
              );
            })
          ) : (
            <Empty text="Nenhuma refeição registrada." />
          )}
        </div>
      </Card>
    </>
  );
}

function Training({ patient, patientId }: { patient: any; patientId: string }) {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        <Metric
          label="Treinos ativos"
          value={String(patient.workouts.length)}
          detail="Divisões em uso"
        />
        <Metric
          label="Sessões recentes"
          value={String(
            patient.workouts.reduce(
              (n: number, w: any) => n + w.sessions.length,
              0,
            ),
          )}
          detail="Últimos registros"
        />
        <Metric
          label="Carga e PSE"
          value="Disponível"
          detail="Por série e sessão"
        />
      </section>
      <div className="grid gap-4 xl:grid-cols-2">
        {patient.workouts.map((workout: any) => (
          <Card key={workout.id}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold">{workout.name}</h2>
                <p className="text-xs text-zinc-500">
                  Dias:{" "}
                  {workout.scheduledWeekdays.length
                    ? workout.scheduledWeekdays.join(", ")
                    : "não definidos"}
                </p>
              </div>
              <Badge>{workout.exercises.length} exercícios</Badge>
            </div>
            <div className="mt-4 divide-y">
              {workout.exercises.map((entry: any) => (
                <div
                  key={entry.id}
                  className="flex justify-between py-2 text-sm"
                >
                  <span>{entry.exercise.name}</span>
                  <span className="text-zinc-500">
                    {entry.targetSets} × {entry.targetReps}
                  </span>
                </div>
              ))}
            </div>
            {workout.sessions[0] && (
              <p className="mt-4 text-xs text-zinc-500">
                Última sessão: {fmt(workout.sessions[0].date)} · PSE{" "}
                {workout.sessions[0].rpe ?? "—"}
              </p>
            )}
          </Card>
        ))}
      </div>
      {patient.workouts.length === 0 && (
        <Card>
          <Empty text="Nenhum treino ativo." />
        </Card>
      )}
      <section className="grid gap-5 xl:grid-cols-2" id="novo-registro">
        <Card>
          <h2 className="font-semibold">Novo treino</h2>
          <form
            action={createWorkoutForPatientAction}
            className="mt-4 space-y-3"
          >
            <input type="hidden" name="patientId" value={patientId} />
            <input
              className={field}
              name="name"
              required
              placeholder="Ex.: Treino A — superiores"
            />
            <div
              className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2"
              style={{ borderColor: "var(--color-border)" }}
            >
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(
                (day, index) => (
                  <label key={day} className="flex items-center gap-1 text-xs">
                    <input type="checkbox" name="weekdays" value={index} />
                    {day}
                  </label>
                ),
              )}
            </div>
            <SubmitButton>Criar treino</SubmitButton>
          </form>
        </Card>
        <Card>
          <h2 className="font-semibold">Adicionar exercício</h2>
          {patient.workouts.length ? (
            <form
              action={addWorkoutExerciseAction}
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              <input type="hidden" name="patientId" value={patientId} />
              <select className={`${field} sm:col-span-2`} name="workoutId">
                {patient.workouts.map((workout: any) => (
                  <option key={workout.id} value={workout.id}>
                    {workout.name}
                  </option>
                ))}
              </select>
              <input
                className={field}
                name="name"
                required
                placeholder="Exercício"
              />
              <input
                className={field}
                name="muscleGroup"
                required
                placeholder="Grupo muscular"
              />
              <input
                className={field}
                name="targetSets"
                type="number"
                min="1"
                defaultValue="3"
              />
              <input
                className={field}
                name="targetReps"
                type="number"
                min="1"
                defaultValue="10"
              />
              <div className="sm:col-span-2">
                <SubmitButton>Adicionar exercício</SubmitButton>
              </div>
            </form>
          ) : (
            <Empty text="Crie um treino antes de adicionar exercícios." />
          )}
        </Card>
      </section>
    </>
  );
}

function Exams({ patient, patientId }: { patient: any; patientId: string }) {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        <Metric
          icon={<TestTube2 />}
          label="Coletas"
          value={String(patient.examCollections.length)}
          detail="Histórico clínico"
        />
        <Metric
          label="Fora da faixa"
          value={String(
            patient.examCollections
              .flatMap((c: any) => c.results)
              .filter((r: any) => r.outOfRange).length,
          )}
          detail="Marcadores sinalizados"
        />
        <Metric
          label="Solicitações"
          value={String(
            patient.examRequests.filter((r: any) => r.status === "REQUESTED")
              .length,
          )}
          detail="Pendentes"
        />
      </section>
      <Card>
        <h2 className="font-semibold">Resultados longitudinais</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="pb-3">Data</th>
                <th>Marcador</th>
                <th>Resultado</th>
                <th>Referência</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {patient.examCollections
                .flatMap((collection: any) =>
                  collection.results.map((result: any) => ({
                    ...result,
                    collectedAt: collection.collectedAt,
                  })),
                )
                .map((result: any) => (
                  <tr
                    key={result.id}
                    className="border-t"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    <td className="py-3">{fmt(result.collectedAt)}</td>
                    <td>{result.marker}</td>
                    <td className="font-semibold">
                      {result.value ?? result.textValue} {result.unit}
                    </td>
                    <td>
                      {result.referenceMin ?? "—"} –{" "}
                      {result.referenceMax ?? "—"}
                    </td>
                    <td>
                      <Badge tone={result.outOfRange ? "danger" : "success"}>
                        {result.outOfRange ? "Alterado" : "Dentro da faixa"}
                      </Badge>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {patient.examCollections.length === 0 && (
            <Empty text="Nenhum exame registrado." />
          )}
        </div>
      </Card>
      <section className="grid gap-5 xl:grid-cols-2" id="novo-registro">
        <Card>
          <h2 className="font-semibold">Registrar resultado</h2>
          <form
            action={createExamResultAction}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <input type="hidden" name="patientId" value={patientId} />
            <input className={field} name="collectedAt" type="date" required />
            <input
              className={field}
              name="laboratory"
              placeholder="Laboratório"
            />
            <input
              className={field}
              name="marker"
              required
              placeholder="Marcador"
            />
            <input
              className={field}
              name="value"
              type="number"
              step="0.01"
              required
              placeholder="Resultado"
            />
            <input className={field} name="unit" placeholder="Unidade" />
            <input
              className={field}
              name="referenceMin"
              type="number"
              step="0.01"
              placeholder="Referência mín."
            />
            <input
              className={field}
              name="referenceMax"
              type="number"
              step="0.01"
              placeholder="Referência máx."
            />
            <SubmitButton>Registrar exame</SubmitButton>
          </form>
        </Card>
        <Card>
          <h2 className="font-semibold">Solicitar exames</h2>
          <form action={createExamRequestAction} className="mt-4 space-y-3">
            <input type="hidden" name="patientId" value={patientId} />
            <input
              className={field}
              name="title"
              required
              placeholder="Ex.: Hemograma e perfil lipídico"
            />
            <input className={field} name="dueDate" type="date" />
            <textarea
              className={field}
              name="instructions"
              placeholder="Orientações para a coleta"
            />
            <SubmitButton>Criar solicitação</SubmitButton>
          </form>
          <div className="mt-4 space-y-2">
            {patient.examRequests.slice(0, 4).map((request: any) => (
              <div
                key={request.id}
                className="flex items-center justify-between rounded-lg border p-3 text-sm"
                style={{ borderColor: "var(--color-border)" }}
              >
                <span>{request.title}</span>
                <Badge
                  tone={request.status === "REQUESTED" ? "warning" : "neutral"}
                >
                  {request.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </>
  );
}

function Notes({ patient, patientId }: { patient: any; patientId: string }) {
  return (
    <>
      <section className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="font-semibold">Linha do tempo profissional</h2>
          <div className="mt-4 space-y-4">
            {patient.professionalNotes.length ? (
              patient.professionalNotes.map((note: any) => (
                <article
                  key={note.id}
                  className="border-l-2 pl-4"
                  style={{
                    borderColor:
                      note.visibility === "PATIENT"
                        ? "var(--color-primary)"
                        : "var(--color-border-strong)",
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">
                      {note.title ?? "Anotação"}
                    </p>
                    <Badge
                      tone={
                        note.visibility === "PATIENT"
                          ? "success"
                          : note.visibility === "CARE_TEAM"
                            ? "info"
                            : "neutral"
                      }
                    >
                      {note.visibility}
                    </Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {note.content}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    {note.author.name ?? "Profissional"} · {fmt(note.createdAt)}
                  </p>
                </article>
              ))
            ) : (
              <Empty text="Nenhuma anotação." />
            )}
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold">Consultas</h2>
          <div className="mt-4 space-y-3">
            {patient.appointments.map((appointment: any) => (
              <div
                key={appointment.id}
                className="rounded-xl border p-3"
                style={{ borderColor: "var(--color-border)" }}
              >
                <p className="text-sm font-semibold">
                  {fmt(appointment.scheduledAt)}
                </p>
                <p className="text-xs text-zinc-500">
                  {appointment.professional.name} · {appointment.durationMin}{" "}
                  min · {appointment.status}
                </p>
              </div>
            ))}
            {patient.appointments.length === 0 && (
              <Empty text="Nenhuma consulta agendada." />
            )}
          </div>
        </Card>
      </section>
      <section className="grid gap-5 xl:grid-cols-2" id="novo-registro">
        <Card>
          <h2 className="font-semibold">Nova anotação</h2>
          <form action={createNoteAction} className="mt-4 space-y-3">
            <input type="hidden" name="patientId" value={patientId} />
            <input
              className={field}
              name="title"
              placeholder="Título opcional"
            />
            <textarea
              className={`${field} min-h-28`}
              required
              name="content"
              placeholder="Contexto clínico, decisões e próximos passos"
            />
            <select className={field} name="visibility" defaultValue="PRIVATE">
              <option value="PRIVATE">Privada — somente autor</option>
              <option value="CARE_TEAM">Equipe de cuidado</option>
              <option value="PATIENT">Compartilhada com paciente</option>
            </select>
            <SubmitButton>Salvar anotação</SubmitButton>
          </form>
        </Card>
        <Card>
          <h2 className="font-semibold">Agendar consulta</h2>
          <form action={createAppointmentAction} className="mt-4 space-y-3">
            <input type="hidden" name="patientId" value={patientId} />
            <input
              className={field}
              name="scheduledAt"
              type="datetime-local"
              required
            />
            <input
              className={field}
              name="durationMin"
              type="number"
              defaultValue="50"
            />
            <textarea
              className={field}
              name="notes"
              placeholder="Pauta da consulta"
            />
            <SubmitButton>Agendar</SubmitButton>
          </form>
        </Card>
      </section>
      <Card>
        <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="font-semibold">Nova meta compartilhada</h2>
            <form
              action={createSharedGoalAction}
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              <input type="hidden" name="patientId" value={patientId} />
              <input
                className={`${field} sm:col-span-2`}
                name="title"
                required
                placeholder="Objetivo do acompanhamento"
              />
              <input
                className={field}
                name="targetValue"
                type="number"
                step="0.1"
                placeholder="Valor-alvo"
              />
              <input className={field} name="unit" placeholder="Unidade" />
              <input
                className={`${field} sm:col-span-2`}
                name="targetDate"
                type="date"
              />
              <div className="sm:col-span-2">
                <SubmitButton>Criar meta</SubmitButton>
              </div>
            </form>
          </div>
          <div>
            <h2 className="font-semibold">Metas em acompanhamento</h2>
            <div className="mt-4 space-y-2">
              {patient.sharedGoals.length ? (
                patient.sharedGoals.map((goal: any) => (
                  <div
                    key={goal.id}
                    className="rounded-lg border p-3"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    <p className="text-sm font-semibold">{goal.title}</p>
                    <p className="text-xs text-zinc-500">
                      {goal.targetValue != null
                        ? `${goal.targetValue} ${goal.unit ?? ""}`
                        : "Meta qualitativa"}
                      {goal.targetDate ? ` · até ${fmt(goal.targetDate)}` : ""}
                    </p>
                  </div>
                ))
              ) : (
                <Empty text="Nenhuma meta compartilhada." />
              )}
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}

function Messaging({
  patient,
  patientId,
  humanMode,
}: {
  patient: any;
  patientId: string;
  humanMode: boolean;
}) {
  return (
    <div id="mensagem" className="scroll-mt-40">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <MessageCircle className="h-4 w-4" />
              Retorno pelo WhatsApp
            </h2>
            <p className="text-xs text-zinc-500">
              Texto livre na janela de 24h; fora dela, template aprovado.
            </p>
          </div>
          {humanMode && <Badge tone="warning">Atendimento humano ativo</Badge>}
        </div>
        <div className="mt-4 grid gap-5 xl:grid-cols-[1fr_1.2fr]">
          <div className="space-y-3">
            <form action={sendProfessionalMessageAction} className="space-y-3">
              <input type="hidden" name="patientId" value={patientId} />
              <textarea
                className={`${field} min-h-28`}
                name="body"
                required
                disabled={!patient.phone}
                placeholder={
                  patient.phone
                    ? "Escreva um retorno objetivo para o paciente…"
                    : "Paciente sem WhatsApp vinculado"
                }
              />
              <SubmitButton>Enviar retorno</SubmitButton>
            </form>
            {humanMode && (
              <form action={releaseConversationToAiAction}>
                <input type="hidden" name="patientId" value={patientId} />
                <SubmitButton variant="outline">
                  Devolver conversa para IA
                </SubmitButton>
              </form>
            )}
          </div>
          <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900">
            {patient.chatMessages
              .slice(0, 12)
              .reverse()
              .map((message: any) => (
                <div
                  key={message.id}
                  className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${message.direction === "OUTBOUND" ? "ml-auto bg-emerald-100 dark:bg-emerald-950" : "bg-white dark:bg-zinc-800"}`}
                >
                  <p>{message.content}</p>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    {message.role === "professional"
                      ? (message.professional?.name ?? "Profissional")
                      : message.role}{" "}
                    · {message.status} · {fmt(message.createdAt)}
                  </p>
                </div>
              ))}
            {patient.chatMessages.length === 0 && (
              <Empty text="Sem mensagens registradas." />
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2 text-zinc-500">
        {icon && <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </Card>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="py-8 text-center text-sm text-zinc-500">{text}</div>;
}

function MediaUpload({
  patientId,
  kind,
}: {
  patientId: string;
  kind: "photo" | "document";
}) {
  const isPhoto = kind === "photo";
  return (
    <Card>
      <h2 className="font-semibold">
        {isPhoto ? "Foto de evolução" : "Documento clínico"}
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        Arquivo privado, disponível apenas para a equipe autorizada.
      </p>
      <form
        action={
          isPhoto ? uploadProgressPhotoAction : uploadClinicalDocumentAction
        }
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="patientId" value={patientId} />
        {isPhoto && (
          <select className={field} name="angle">
            <option value="FRONT">Frente</option>
            <option value="SIDE">Lateral</option>
            <option value="BACK">Costas</option>
          </select>
        )}
        <input
          className={field}
          type="file"
          name="file"
          required
          accept={
            isPhoto
              ? "image/jpeg,image/png,image/webp"
              : "application/pdf,image/jpeg,image/png"
          }
        />
        <SubmitButton>Enviar arquivo</SubmitButton>
      </form>
    </Card>
  );
}
