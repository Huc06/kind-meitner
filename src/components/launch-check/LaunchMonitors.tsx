import { useState } from "react";

import { api } from "@/state/store";
import { t } from "@/lib/i18n";
import type { Routine, RoutineRun } from "@/lib/routines";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { cadenceOf } from "./launch-runs";

const CADENCE_KEY = {
  minute: "launch.schedule.everyMinute",
  hour: "launch.schedule.everyHour",
  other: "launch.schedule.custom",
} as const;

/** Persisted monitors for this room: the same routines the scheduler runs. */
export function LaunchMonitors({ monitors, runs, onChanged, onError }: {
  monitors: Routine[];
  runs: RoutineRun[];
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Routine | null>(null);

  const act = async (id: string, path: string, init: RequestInit) => {
    if (busy) return;
    setBusy(id);
    try {
      await api(path, init);
      await onChanged();
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="launch-monitors-title" className="rounded border border-hairline bg-surface p-4">
      <h2 id="launch-monitors-title" className="label-mono text-ink-secondary">{t("launch.monitors.title")}</h2>
      {monitors.length === 0 && <p className="mt-2 text-[12.5px] text-ink-secondary">{t("launch.monitors.empty")}</p>}
      <ul className="mt-2 space-y-3">
        {monitors.map((routine) => {
          const own = runs.filter((run) => run.routineId === routine.id).sort((a, b) => b.createdAt - a.createdAt);
          const last = own.find((run) => run.finishedAt !== undefined);
          return (
            <li key={routine.id} className="rounded border border-hairline bg-inset p-2.5 text-[12.5px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{routine.name}</span>
                <span className="label-mono text-ink-secondary">
                  {routine.enabled ? t("launch.status.active") : t("launch.status.paused")}
                </span>
              </div>
              <dl className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
                <dt className="text-ink-secondary">{t("launch.schedule.frequency")}</dt>
                <dd>{t(CADENCE_KEY[cadenceOf(routine)])}</dd>
                <dt className="text-ink-secondary">{t("launch.monitors.lastRun")}</dt>
                <dd>
                  {last?.finishedAt
                    ? t("launch.monitors.lastRunValue", { time: new Date(last.finishedAt).toLocaleTimeString(), status: last.status })
                    : t("launch.monitors.never")}
                </dd>
                <dt className="text-ink-secondary">{t("launch.monitors.nextRun")}</dt>
                <dd>{routine.enabled && routine.nextRunAt ? new Date(routine.nextRunAt).toLocaleTimeString() : t("launch.monitors.none")}</dd>
              </dl>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy === routine.id}
                  onClick={() => void act(routine.id, `/api/routines/${routine.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !routine.enabled }) })}
                >
                  {routine.enabled ? t("launch.monitors.pause") : t("launch.monitors.resume")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy === routine.id}
                  onClick={() => void act(routine.id, `/api/routines/${routine.id}/run`, { method: "POST" })}
                >
                  {t("launch.monitors.runNow")}
                </Button>
                <Button size="sm" variant="secondary" aria-expanded={historyFor === routine.id} onClick={() => setHistoryFor(historyFor === routine.id ? null : routine.id)}>
                  {t("launch.monitors.history")}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy === routine.id}
                  onClick={() => setDeleting(routine)}
                >
                  {t("launch.monitors.delete")}
                </Button>
              </div>
              {historyFor === routine.id && (
                <ol className="mt-2 space-y-0.5 border-t border-hairline pt-2 font-mono text-[11.5px]">
                  {own.length === 0 && <li className="text-ink-secondary">{t("launch.monitors.never")}</li>}
                  {own.slice(0, 20).map((run) => (
                    <li key={run.id}>
                      {new Date(run.startedAt ?? run.scheduledFor).toLocaleTimeString()} · {run.status}
                      {run.error ? ` · ${run.error}` : ""}
                    </li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={deleting !== null}
        title={t("launch.monitors.deleteTitle")}
        body={t("launch.monitors.deleteConfirm", { name: deleting?.name ?? "" })}
        confirmLabel={t("launch.monitors.delete")}
        tone="danger"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target) void act(target.id, `/api/routines/${target.id}`, { method: "DELETE" });
        }}
      />
    </section>
  );
}
