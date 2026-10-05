import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Play, Radio, Send } from "lucide-react";

import { api, ApiError, type Message } from "@/state/store";
import { t } from "@/lib/i18n";
import type { Routine, RoutineRun } from "@/lib/routines";
import { interpretLaunchRequest, MONITOR_CRON, type LaunchPlan, type MonitorCadence } from "@/lib/launch-check";
import { Button } from "@/components/ui/button";
import { OKX_DEMO_IDENTITY, OKX_DEMO_TOOLS } from "../../../shared/okx-demo-identity";
import { cadenceOf, healthOf, serviceChecks, type ServiceCheck } from "./launch-runs";
import { LaunchActivityLog } from "./LaunchActivityLog";
import { LaunchExplanation, LaunchHealthBadge, LaunchRunDetails } from "./LaunchResult";
import { LaunchMonitors } from "./LaunchMonitors";
import { LaunchWorkflow } from "./LaunchWorkflow";

type Room = { id: string; threadId: string; name: string; messages: Message[] };
type Coordinator = { id: string; name: string };

/** One chat turn. Coordinator replies are produced by this screen's
 * rule-based coordinator from real results, never by a model. */
type ChatEntry =
  | { id: string; who: "user"; text: string }
  | { id: string; who: "coordinator"; kind: "text"; text: string }
  | { id: string; who: "coordinator"; kind: "plan"; plan: LaunchPlan; started: boolean }
  | { id: string; who: "coordinator"; kind: "explain"; checkId: string }
  | { id: string; who: "coordinator"; kind: "schedule"; cadence: MonitorCadence; team: boolean; state: "review" | "started" | "cancelled" };

const CHAT_KEY = "kind-meitner:launch-check-chat";
const FINISHED_KEY = {
  working: "launch.chat.finished.working",
  attention: "launch.chat.finished.attention",
  unverified: "launch.chat.finished.unverified",
} as const;
const POLL_MS = 4_000;
const STARTS_KEY = "kind-meitner:launch-check-starts";

/** The okx-task routine prompt: the same live service check, repeated. */
const MONITOR_PROMPT = `okx-tool:${JSON.stringify({
  toolName: OKX_DEMO_TOOLS.endpoint,
  endpointUrl: OKX_DEMO_IDENTITY.endpointUrl,
  arguments: { endpointUrl: OKX_DEMO_IDENTITY.endpointUrl },
})}`;

function loadChat(): ChatEntry[] {
  try {
    const raw = sessionStorage.getItem(CHAT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ChatEntry[]) : [];
  } catch {
    return [];
  }
}

const newId = () => crypto.randomUUID();

export function LaunchCheckView({ onExit }: { onExit: () => void }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [coordinator, setCoordinator] = useState<Coordinator | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [runs, setRuns] = useState<RoutineRun[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatEntry[]>(loadChat);
  /** When this browser started each hand-run check (the click time). */
  const [manualStarts, setManualStarts] = useState<number[]>(() => {
    try {
      const parsed: unknown = JSON.parse(sessionStorage.getItem(STARTS_KEY) ?? "[]");
      return Array.isArray(parsed) ? parsed.filter((value): value is number => typeof value === "number") : [];
    } catch {
      return [];
    }
  });
  const [draft, setDraft] = useState("");
  const [checking, setChecking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [initialChatLength] = useState(() => chat.length);
  const shownCount = useRef(initialChatLength);
  /** The plan behind the check now in flight, so its follow-ups run once. */
  const pendingPlan = useRef<{ plan: LaunchPlan; afterCount: number } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [launch, routineState] = await Promise.all([
        api("/api/launch-check"),
        api("/api/routines"),
      ]);
      setRoom(launch.room);
      setCoordinator(launch.coordinator);
      setRoutines(routineState.routines ?? []);
      setRuns(routineState.runs ?? []);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await api("/api/launch-check", { method: "POST" });
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error));
        return;
      }
      if (!cancelled) await refresh();
    })();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refresh]);

  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_KEY, JSON.stringify(chat.slice(-60)));
    } catch {
      // Chat history is a convenience; the activity log lives on the server.
    }
    // Follow new entries only; restoring history on load must not scroll the
    // page away from the header and primary actions.
    if (chat.length > shownCount.current) chatEndRef.current?.scrollIntoView({ block: "nearest" });
    shownCount.current = chat.length;
  }, [chat]);

  const monitors = useMemo(
    () => routines.filter((routine) => routine.target === "okx-task" && room && routine.groupId === room.id),
    [routines, room],
  );
  // Runs carry their room, so a deleted monitor's past runs keep their history.
  const monitorRuns = useMemo(
    () => runs.filter((run) => run.target === "okx-task" && room && run.groupId === room.id),
    [runs, room],
  );
  const checks = useMemo(() => serviceChecks(room?.messages ?? [], monitorRuns), [room, monitorRuns]);
  const latest: ServiceCheck | undefined = checks[checks.length - 1];
  const say = (entry: ChatEntry) => setChat((current) => [...current, entry]);

  // When a check started from a plan lands, follow the plan: explain, then
  // offer the monitor for review. Nothing is scheduled without a click.
  useEffect(() => {
    const pending = pendingPlan.current;
    if (!pending || checks.length <= pending.afterCount || !latest) return;
    pendingPlan.current = null;
    say({ id: newId(), who: "coordinator", kind: "text", text: t(FINISHED_KEY[healthOf(latest)]) });
    if (pending.plan.explain) say({ id: newId(), who: "coordinator", kind: "explain", checkId: latest.id });
    if (pending.plan.monitor) {
      say({ id: newId(), who: "coordinator", kind: "schedule", cadence: pending.plan.monitor, team: false, state: "review" });
    }
  }, [checks.length, latest]);

  const runCheck = async (plan: LaunchPlan | null) => {
    if (!room || checking) return;
    setChecking(true);
    setActionError(null);
    setManualStarts((current) => {
      const next = [...current, Date.now()].slice(-40);
      try {
        sessionStorage.setItem(STARTS_KEY, JSON.stringify(next));
      } catch {
        // Start times are a convenience for the log; results live on the server.
      }
      return next;
    });
    pendingPlan.current = plan ? { plan, afterCount: checks.length } : null;
    try {
      await api("/api/okx/execute-agent-tool", {
        method: "POST",
        body: JSON.stringify({
          endpointUrl: OKX_DEMO_IDENTITY.endpointUrl,
          toolName: OKX_DEMO_TOOLS.endpoint,
          arguments: { endpointUrl: OKX_DEMO_IDENTITY.endpointUrl },
          targetThreadId: room.threadId,
        }),
      });
    } catch (error) {
      // A failed call is still recorded in the room by the server; only a
      // transport failure (nothing recorded) needs its own message here.
      if (!(error instanceof ApiError) || error.status !== 400) {
        pendingPlan.current = null;
        setActionError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      await refresh();
      setChecking(false);
    }
  };

  const startMonitor = async (entryId: string, cadence: MonitorCadence, team: boolean) => {
    if (!room || !coordinator) return;
    setActionError(null);
    const existing = monitors.find((routine) => routine.enabled && cadenceOf(routine) === cadence);
    if (existing) {
      setChat((current) => current.map((entry) => (entry.id === entryId && entry.who === "coordinator" && entry.kind === "schedule" ? { ...entry, state: "started" } : entry)));
      say({ id: newId(), who: "coordinator", kind: "text", text: t("launch.chat.monitorExists", { name: existing.name }) });
      return;
    }
    try {
      await api("/api/routines", {
        method: "POST",
        body: JSON.stringify({
          name: t(team ? "launch.monitor.nameTeam" : cadence === "minute" ? "launch.monitor.nameDemo" : "launch.monitor.nameHourly"),
          prompt: MONITOR_PROMPT,
          target: "okx-task",
          botId: coordinator.id,
          groupId: room.id,
          schedule: { type: "cron", expression: MONITOR_CRON[cadence], timeZone: "UTC" },
          enabled: true,
        }),
      });
      setChat((current) => current.map((entry) => (entry.id === entryId && entry.who === "coordinator" && entry.kind === "schedule" ? { ...entry, state: "started" } : entry)));
      say({ id: newId(), who: "coordinator", kind: "text", text: t(cadence === "minute" ? "launch.chat.monitorStartedMinute" : "launch.chat.monitorStartedHour") });
      await refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    say({ id: newId(), who: "user", text });
    const intent = interpretLaunchRequest(text, Boolean(latest));
    if (intent.kind === "plan") {
      say({ id: newId(), who: "coordinator", kind: "text", text: t("launch.chat.planIntro") });
      say({ id: newId(), who: "coordinator", kind: "plan", plan: intent.plan, started: false });
    } else if (intent.kind === "explain") {
      say(latest
        ? { id: newId(), who: "coordinator", kind: "explain", checkId: latest.id }
        : { id: newId(), who: "coordinator", kind: "text", text: t("launch.chat.noResultYet") });
    } else if (intent.kind === "schedule") {
      say({ id: newId(), who: "coordinator", kind: "schedule", cadence: intent.cadence, team: intent.team, state: "review" });
    } else {
      say({ id: newId(), who: "coordinator", kind: "text", text: t("launch.chat.unknown") });
    }
  };

  const updateEntry = (id: string, update: (entry: ChatEntry) => ChatEntry) =>
    setChat((current) => current.map((entry) => (entry.id === id ? update(entry) : entry)));

  const activeMonitor = monitors.find((routine) => routine.enabled) ?? null;
  const running = checking || monitorRuns.some((run) => run.status === "running" || run.status === "queued");

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-app text-ink">
      <header className="border-b border-hairline px-4 py-4 sm:px-6 max-[768px]:pl-14">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[20px] font-semibold leading-tight">{t("launch.title")}</h1>
            <p className="mt-1 text-[13px] text-ink-secondary">{t("launch.subtitle")}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={onExit}>
            <ArrowLeft size={12} aria-hidden="true" />
            {t("launch.exit")}
          </Button>
        </div>
        <div className="mx-auto mt-3 flex max-w-6xl flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => composerRef.current?.focus()}>
            <Send size={12} aria-hidden="true" />
            {t("launch.action.ask")}
          </Button>
          <Button size="sm" variant="primary" disabled={!room || checking} onClick={() => void runCheck(null)}>
            <Play size={12} aria-hidden="true" />
            {checking ? t("launch.action.checking") : t("launch.action.run")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!room || Boolean(activeMonitor)}
            onClick={() => {
              // One pending review at a time: reuse it rather than stacking another.
              if (chat.some((entry) => entry.who === "coordinator" && entry.kind === "schedule" && entry.state === "review")) return;
              say({ id: newId(), who: "coordinator", kind: "schedule", cadence: "minute", team: false, state: "review" });
            }}
          >
            <Radio size={12} aria-hidden="true" />
            {activeMonitor ? t("launch.action.monitorOn") : t("launch.action.monitor")}
          </Button>
        </div>
      </header>

      {loadError && (
        <p role="alert" className="mx-auto mt-4 w-full max-w-6xl px-4 text-[12px] text-danger sm:px-6">
          {t("launch.error.load", { error: loadError })}
        </p>
      )}
      {actionError && (
        <p role="alert" className="mx-auto mt-4 w-full max-w-6xl px-4 text-[12px] text-danger sm:px-6">
          {t("launch.error.action", { error: actionError })}
        </p>
      )}

      <main className="mx-auto grid w-full min-w-0 max-w-6xl flex-1 gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="launch-chat-title" className="flex min-w-0 flex-col rounded border border-hairline bg-surface">
          <h2 id="launch-chat-title" className="border-b border-hairline px-4 py-2.5 text-[13px] font-semibold">
            {t("launch.chat.title")}
          </h2>
          <ol className="flex min-h-[220px] flex-1 flex-col gap-3 px-4 py-3">
            {chat.length === 0 && <li className="text-[12.5px] text-ink-secondary">{t("launch.chat.empty")}</li>}
            {chat.map((entry) => (
              <li key={entry.id} className={entry.who === "user" ? "self-end max-w-[85%]" : "max-w-full"}>
                {entry.who === "user" ? (
                  <p className="rounded bg-raised px-3 py-2 text-[13px]">{entry.text}</p>
                ) : (
                  <div className="space-y-1">
                    {entry.kind !== "explain" && <p className="label-mono text-ink-secondary">{t("launch.role.coordinator")}</p>}
                    {entry.kind === "text" && <p className="text-[13px] leading-relaxed">{entry.text}</p>}
                    {entry.kind === "plan" && (
                      <PlanCard
                        plan={entry.plan}
                        started={entry.started}
                        busy={checking}
                        onChange={(plan) => updateEntry(entry.id, (current) => (current.who === "coordinator" && current.kind === "plan" ? { ...current, plan } : current))}
                        onRun={() => {
                          updateEntry(entry.id, (current) => (current.who === "coordinator" && current.kind === "plan" ? { ...current, started: true } : current));
                          say({ id: newId(), who: "coordinator", kind: "text", text: t("launch.chat.checkerStarted") });
                          void runCheck(entry.plan);
                        }}
                      />
                    )}
                    {entry.kind === "explain" && (() => {
                      const check = checks.find((candidate) => candidate.id === entry.checkId);
                      return check ? (
                        <LaunchExplanation check={check} onDetails={() => setDetailsFor(check.id)} />
                      ) : (
                        <p className="text-[13px] text-ink-secondary">{t("launch.chat.resultGone")}</p>
                      );
                    })()}
                    {entry.kind === "schedule" && (
                      <ScheduleCard
                        cadence={entry.cadence}
                        team={entry.team}
                        state={entry.state}
                        onStart={() => void startMonitor(entry.id, entry.cadence, entry.team)}
                        onCancel={() => updateEntry(entry.id, (current) => (current.who === "coordinator" && current.kind === "schedule" ? { ...current, state: "cancelled" } : current))}
                      />
                    )}
                  </div>
                )}
              </li>
            ))}
            <div ref={chatEndRef} />
          </ol>
          <form onSubmit={submit} className="border-t border-hairline p-3">
            <label htmlFor="launch-composer" className="label-mono text-ink-secondary">
              {t("launch.composer.responding")}
            </label>
            <div className="mt-1.5 flex items-end gap-2">
              <textarea
                id="launch-composer"
                ref={composerRef}
                rows={2}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={t("launch.composer.placeholder")}
                className="min-w-0 flex-1 resize-none rounded border border-hairline bg-inset px-2.5 py-2 text-[13px] text-ink placeholder:text-ink-secondary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
              />
              <Button type="submit" size="sm" disabled={!draft.trim()} aria-label={t("launch.composer.send")}>
                <Send size={12} aria-hidden="true" />
              </Button>
            </div>
          </form>
        </section>

        <div className="flex min-w-0 flex-col gap-5">
          <section aria-labelledby="launch-latest-title" className="rounded border border-hairline bg-surface p-4">
            <h2 id="launch-latest-title" className="label-mono text-ink-secondary">{t("launch.latest.title")}</h2>
            {latest ? (
              <div className="mt-2 space-y-2">
                <LaunchHealthBadge check={latest} />
                <p className="text-[12px] text-ink-secondary">
                  {t("launch.latest.meta", { time: new Date(latest.at).toLocaleTimeString() })}
                </p>
                <Button size="sm" variant="secondary" onClick={() => setDetailsFor(detailsFor === latest.id ? null : latest.id)} aria-expanded={detailsFor === latest.id}>
                  {t("launch.details.open")}
                </Button>
              </div>
            ) : (
              <p className="mt-2 text-[13px] text-ink-secondary">{running ? t("launch.latest.running") : t("launch.latest.none")}</p>
            )}
            {detailsFor && (() => {
              const check = checks.find((candidate) => candidate.id === detailsFor);
              return check ? <LaunchRunDetails check={check} onClose={() => setDetailsFor(null)} /> : null;
            })()}
          </section>

          <LaunchActivityLog checks={checks} runs={monitorRuns} manualStarts={manualStarts} monitor={activeMonitor} checking={checking} onDetails={setDetailsFor} />
          <LaunchWorkflow latest={latest ?? null} running={running} monitor={activeMonitor} hasMonitor={monitors.length > 0} coordinatorName={coordinator?.name ?? null} />
          <LaunchMonitors monitors={monitors} runs={monitorRuns} onChanged={refresh} onError={setActionError} />
        </div>
      </main>
    </div>
  );
}

function PlanCard({ plan, started, busy, onChange, onRun }: {
  plan: LaunchPlan;
  started: boolean;
  busy: boolean;
  onChange: (plan: LaunchPlan) => void;
  onRun: () => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="rounded border border-hairline bg-inset p-3 text-[13px]">
      <p className="font-semibold">{t("launch.plan.title")}</p>
      <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
        <li>{t("launch.plan.check")}</li>
        {plan.explain && <li>{t("launch.plan.explain")}</li>}
        {plan.monitor && <li>{t(plan.monitor === "minute" ? "launch.plan.monitorMinute" : "launch.plan.monitorHour")}</li>}
      </ol>
      {editing && !started && (
        <fieldset className="mt-2 space-y-1.5 border-t border-hairline pt-2">
          <legend className="sr-only">{t("launch.plan.review")}</legend>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={plan.explain} onChange={(event) => onChange({ ...plan, explain: event.target.checked })} />
            {t("launch.plan.explain")}
          </label>
          <label className="flex flex-wrap items-center gap-2">
            {t("launch.plan.monitorLabel")}
            <select
              value={plan.monitor ?? "off"}
              onChange={(event) => onChange({ ...plan, monitor: event.target.value === "off" ? null : (event.target.value as MonitorCadence) })}
              className="rounded border border-hairline bg-surface px-2 py-1 text-[12.5px]"
            >
              <option value="off">{t("launch.plan.monitorOff")}</option>
              <option value="minute">{t("launch.plan.monitorMinute")}</option>
              <option value="hour">{t("launch.plan.monitorHour")}</option>
            </select>
          </label>
        </fieldset>
      )}
      <p className="mt-2 text-[12px] text-ink-secondary">{t("launch.plan.safety")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" disabled={started || busy} onClick={onRun}>
          {started ? t("launch.plan.started") : t("launch.action.run")}
        </Button>
        {!started && (
          <Button size="sm" variant="secondary" onClick={() => setEditing((open) => !open)} aria-expanded={editing}>
            {t("launch.plan.review")}
          </Button>
        )}
      </div>
    </div>
  );
}

function ScheduleCard({ cadence, team, state, onStart, onCancel }: {
  cadence: MonitorCadence;
  team: boolean;
  state: "review" | "started" | "cancelled";
  onStart: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded border border-hairline bg-inset p-3 text-[13px]">
      {cadence === "minute" && <p className="label-mono text-warning">{t("launch.schedule.demoLabel")}</p>}
      <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
        <dt className="text-ink-secondary">{t("launch.schedule.name")}</dt>
        <dd>{t(team ? "launch.monitor.nameTeam" : cadence === "minute" ? "launch.monitor.nameDemo" : "launch.monitor.nameHourly")}</dd>
        <dt className="text-ink-secondary">{t("launch.schedule.frequency")}</dt>
        <dd>{t(cadence === "minute" ? "launch.schedule.everyMinute" : "launch.schedule.everyHour")}</dd>
        <dt className="text-ink-secondary">{t("launch.schedule.action")}</dt>
        <dd>{t("launch.schedule.actionValue")}</dd>
        <dt className="text-ink-secondary">{t("launch.schedule.alerts")}</dt>
        <dd>{t("launch.schedule.alertsValue")}</dd>
        <dt className="text-ink-secondary">{t("launch.schedule.mode")}</dt>
        <dd>{t("launch.schedule.modeValue")}</dd>
      </dl>
      {team && (
        <div className="mt-2 border-t border-hairline pt-2">
          <p className="font-semibold">{t("launch.schedule.teamTitle")}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            <li>{t("launch.schedule.teamCoordinator")}</li>
            <li>{t("launch.schedule.teamChecker")}</li>
            <li>{t("launch.schedule.teamExplainer")}</li>
            <li>{t("launch.schedule.teamMonitor")}</li>
          </ul>
        </div>
      )}
      {cadence === "minute" && <p className="mt-2 text-[12px] text-ink-secondary">{t("launch.schedule.demoNote")}</p>}
      {state === "review" ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="primary" onClick={onStart}>{t("launch.schedule.start")}</Button>
          <Button size="sm" variant="secondary" onClick={onCancel}>{t("launch.schedule.cancel")}</Button>
        </div>
      ) : (
        <p className="mt-2 text-[12px] text-ink-secondary">
          {state === "started" ? t("launch.schedule.started") : t("launch.schedule.cancelled")}
        </p>
      )}
    </div>
  );
}
