import { FileText, Loader2, Repeat2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonClass } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { t } from "@/lib/i18n";
import type { Routine, RoutineRun } from "@/lib/routines";
import { scheduleLabel } from "@/lib/schedule-label";
import { latestRoutineRun, routineDateTime, routineNextLabel, routineRunLabel, routineRunTone, routineScheduleState } from "@/lib/routine-display";
import type { Bot } from "@/state/store";
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
  return <div className="space-y-3" aria-label={t("routines.list")}>
    {error && <div role="alert" className="border border-danger/30 bg-danger/10 p-3 font-mono text-[12px] text-danger">{t("routines.loadError")}</div>}
    {loading && <p role="status" className="flex items-center gap-2 p-3 font-mono text-[12px] text-ink-secondary"><Loader2 size={14} className="animate-spin" />{t("routines.loading")}</p>}
    {!loading && !error && sorted.length === 0 && <div className="border border-dashed border-hairline bg-card p-6 text-center text-[13px] text-ink-secondary"><Repeat2 size={20} className="mx-auto mb-2 opacity-60 text-ink-secondary" />{t("routines.empty")}</div>}
    {sorted.map((routine) => {
      const latest = latestRoutineRun(routine.id, runs);
      const bot = bots?.find((candidate) => candidate.id === routine.botId);
      return <article key={routine.id} className="border border-hairline bg-card p-3.5 transition-colors hover:border-ink-secondary/60" aria-label={routine.name}>
        <div className="flex items-start gap-2">
          <button type="button" onClick={() => onOpen(routine)} className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[13px] font-semibold text-ink hover:underline">{routine.name}</span>
            <span className="mt-1 block font-mono text-[11px] leading-relaxed text-ink-secondary">{bot && `${bot.name} · `}{scheduleLabel(routine.schedule)}</span>
          </button>
          <Tag tone={routine.enabled && routine.nextRunAt != null ? "accent" : "neutral"} variant="soft" size="sm">{routineScheduleState(routine)}</Tag>
        </div>
        {routineNextLabel(routine) !== routineScheduleState(routine) && <div className="mt-2 font-mono text-[11px] text-ink-secondary">{routineNextLabel(routine)}</div>}
        <div className="mt-2 flex items-start justify-between gap-2 border-t border-hairline/40 pt-2">
          <div className="min-w-0 text-[11.5px]">
            {latest ? <><span className={routineRunTone(latest)}>{t("routines.latestRun", { status: routineRunLabel(latest) })}</span><span className="block font-mono text-[10.5px] tabular-nums text-ink-secondary">{routineDateTime(latest.finishedAt ?? latest.startedAt ?? latest.scheduledFor)}</span></> : <span className="font-mono text-[11px] text-ink-secondary">{t("routines.neverRun")}</span>}
          </div>
          <button type="button" onClick={() => onLogs(routine)} aria-label={t("routines.logsFor", { name: routine.name })} className={buttonClass({ variant: "ghost", size: "xs" })}><FileText size={12} />{t("routines.logs")}</button>
        </div>
        {latest && (latest.attention || latest.error || latest.output) && <p className={cn("mt-2 line-clamp-2 whitespace-pre-wrap text-[11.5px] leading-relaxed", latest.error ? "font-mono text-danger" : "text-ink-secondary")}>{latest.attention || latest.error || latest.output}</p>}
      </article>;
    })}
  </div>;
}
