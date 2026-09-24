import { FileText, Loader2, Repeat2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import type { Routine, RoutineRun } from "@/lib/routines";
import { scheduleLabel } from "@/lib/schedule-label";
import { latestRoutineRun, routineDateTime, routineNextLabel, routineRunLabel, routineRunTone, routineScheduleState } from "@/lib/routine-display";
import type { Bot } from "@/state/store";
import { BotAvatar } from "@/components/Avatar";

export function RoutineList({ routines, runs, bots, loading, error, onOpen, onLogs }: {
  routines: Routine[];
  runs: RoutineRun[];
  bots?: Bot[];
  loading?: boolean;
  error?: boolean;
  onOpen: (routine: Routine) => void;
  onLogs: (routine: Routine) => void;
}) {
  const sorted = [...routines].sort((a, b) => Number(b.enabled) - Number(a.enabled) || (a.nextRunAt ?? Infinity) - (b.nextRunAt ?? Infinity) || a.name.localeCompare(b.name));
  return (
    <div className="space-y-2.5" aria-label={t("routines.list")}>
      {error && <div role="alert" className="rounded-lg bg-danger/10 border border-danger/20 p-3 text-[12px] text-danger">{t("routines.loadError")}</div>}
      {loading && <p role="status" className="flex items-center gap-2 p-3 text-[12px] text-ink-secondary"><Loader2 size={14} className="animate-spin" />{t("routines.loading")}</p>}
      {!loading && !error && sorted.length === 0 && (
        <div className="rounded-2xl border border-dashed border-hairline/50 p-8 text-center text-ink-secondary">
          <Repeat2 size={24} className="mx-auto mb-2 opacity-50" />
          <p className="text-[13px] font-medium text-ink">{t("routines.empty")}</p>
        </div>
      )}
      {sorted.map((routine) => {
        const latest = latestRoutineRun(routine.id, runs);
        const bot = bots?.find((candidate) => candidate.id === routine.botId);
        const statusState = routineScheduleState(routine);
        return (
          <article
            key={routine.id}
            className="group rounded-xl border border-hairline/50 bg-card p-4 transition-all hover:border-hairline hover:shadow-xs"
            aria-label={routine.name}
          >
            <div className="flex items-start gap-3">
              {bot && (
                <div className="shrink-0 mt-0.5">
                  <BotAvatar bot={bot} state={routine.enabled ? "idle" : "sleeping"} size={28} animated={false} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onOpen(routine)}
                    className="min-w-0 flex-1 text-left cursor-pointer group-hover:text-accent transition-colors"
                  >
                    <span className="block truncate text-[13.5px] font-semibold text-ink">{routine.name}</span>
                    <span className="mt-0.5 block text-[11.5px] text-ink-secondary">
                      {bot && <span className="font-medium text-ink/80">{bot.name} · </span>}
                      {scheduleLabel(routine.schedule)}
                    </span>
                  </button>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                      routine.enabled && routine.nextRunAt != null
                        ? "bg-accent/15 text-accent"
                        : "bg-inset text-ink-secondary"
                    )}
                  >
                    {statusState}
                  </span>
                </div>

                {routineNextLabel(routine) !== statusState && (
                  <div className="mt-1.5 text-[11px] font-mono text-ink-secondary">
                    {routineNextLabel(routine)}
                  </div>
                )}

                <div className="mt-2.5 flex items-center justify-between border-t border-hairline/30 pt-2 text-[11px]">
                  <div className="flex items-center gap-2">
                    {latest ? (
                      <>
                        <span className={cn("font-medium", routineRunTone(latest))}>
                          {t("routines.latestRun", { status: routineRunLabel(latest) })}
                        </span>
                        <span className="text-ink-secondary/60 font-mono">
                          {routineDateTime(latest.finishedAt ?? latest.startedAt ?? latest.scheduledFor)}
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-secondary/70">{t("routines.neverRun")}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onLogs(routine)}
                      aria-label={t("routines.logsFor", { name: routine.name })}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-ink-secondary hover:bg-raised hover:text-ink transition-colors"
                    >
                      <FileText size={12} />
                      {t("routines.logs")}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpen(routine)}
                      className="flex items-center gap-1 rounded-md bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent hover:bg-accent/20 transition-colors"
                    >
                      Details
                    </button>
                  </div>
                </div>

                {latest && (latest.attention || latest.error || latest.output) && (
                  <div className={cn("mt-2 rounded-lg p-2 font-mono text-[10.5px] leading-relaxed line-clamp-2", latest.error ? "bg-danger/10 text-danger" : "bg-inset text-ink-secondary")}>
                    {latest.attention || latest.error || latest.output}
                  </div>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
