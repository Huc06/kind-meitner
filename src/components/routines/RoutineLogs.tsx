import { useState } from "react";
import { CircleAlert, FileText, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";
import { Tag } from "@/components/ui/tag";
import { t } from "@/lib/i18n";
import type { RoutineRun } from "@/lib/routines";
import { routineDateTime, routineRunLabel, routineRunTime } from "@/lib/routine-display";
import type { Bot } from "@/state/store";

function runTone(run: RoutineRun): "success" | "danger" | "warning" | "accent" | "neutral" {
  if (run.status === "completed") {
    return run.goalStatus === "blocked" ? "danger" : "success";
  }
  if (run.status === "failed" || run.status === "missed") return "danger";
  if (run.status === "waiting") return "warning";
  if (run.status === "running" || run.status === "queued") return "accent";
  return "neutral";
}
export function RoutineLogs({ runs, bots, loading, error, routineId, onClearRoutine, onOpen }: {
  runs: RoutineRun[];
  bots: Bot[];
  loading?: boolean;
  error?: boolean;
  routineId?: string;
  onClearRoutine: () => void;
  onOpen: (run: RoutineRun) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [limit, setLimit] = useState(50);
  const filtered = runs.filter((run) => (!routineId || run.routineId === routineId) && (status === "all" || run.status === status)
    && `${run.routineName} ${bots.find((bot) => bot.id === run.botId)?.name ?? ""} ${run.output ?? ""} ${run.error ?? ""} ${run.attention ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => routineRunTime(b) - routineRunTime(a));
  return <section className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:p-6" aria-label={t("routines.logs")}>
    <div><h2 className="text-[17px] font-semibold text-ink">{t("routines.logs")}</h2><p className="mt-1 text-[12px] text-ink-secondary">{t("routines.logsHint")}</p></div>
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative flex min-w-[200px] flex-1 items-center">
        <Search size={14} className="pointer-events-none absolute left-3 text-ink-secondary" />
        <input
          aria-label={t("routines.searchLogs")}
          placeholder={t("routines.searchLogs")}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setLimit(50); }}
          className={cn(fieldClass, "h-9 min-w-0 flex-1 pl-9 text-[12px]")}
        />
      </label>
      <select
        aria-label={t("routines.filterStatus")}
        value={status}
        onChange={(event) => { setStatus(event.target.value); setLimit(50); }}
        style={{ colorScheme: "var(--code-color-scheme)" }}
        className={cn(fieldClass, "h-9 w-auto pr-8 font-mono text-[12px] cursor-pointer")}
      >
        <option value="all">{t("routines.allStatuses")}</option>
        {(["queued", "running", "waiting", "completed", "failed", "missed", "cancelled"] as const).map((value) => (
          <option key={value} value={value}>{t(`routines.status.${value}`)}</option>
        ))}
      </select>
    </div>
    {routineId && <div className="flex items-center gap-2 font-mono text-[11px] text-ink-secondary">{t("routines.filteredRoutine")}<button type="button" onClick={onClearRoutine} className="text-accent underline hover:no-underline">{t("routines.showAll")}</button></div>}
    {error && <p role="alert" className="flex items-center gap-2 border border-danger/30 bg-danger/10 p-3 font-mono text-[12px] text-danger"><CircleAlert size={14} />{t("routines.loadError")}</p>}
    {loading && <p role="status" className="flex items-center gap-2 font-mono text-[12px] text-ink-secondary"><Loader2 size={14} className="animate-spin" />{t("routines.loading")}</p>}
    {!loading && !error && filtered.length === 0 && <div className="border border-dashed border-hairline bg-card p-10 text-center text-[13px] text-ink-secondary"><FileText size={24} className="mx-auto mb-3 opacity-50" />{runs.length ? t("routines.noMatchingRuns") : t("routines.noRuns")}</div>}
    {filtered.length > 0 && (
      <div className="border border-hairline bg-card">
        <div className="label-mono flex items-center justify-between frame-rule-below px-4 py-2.5 text-ink-secondary">
          <span>RUN / ROUTINE</span>
          <span>STATUS</span>
        </div>
        <div>
          {filtered.slice(0, limit).map((run) => {
            const bot = bots.find((candidate) => candidate.id === run.botId);
            return (
              <button
                type="button"
                key={run.id}
                onClick={() => onOpen(run)}
                aria-label={t("routines.openRun", { name: run.routineName, status: routineRunLabel(run) })}
                className="group block w-full frame-rule-below px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-raised-hover"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-ink group-hover:underline">{run.routineName}</span>
                    <span className="mt-1 block font-mono text-[11px] text-ink-secondary">
                      {bot?.name ?? t("routines.unavailableBot")} · {routineDateTime(run.scheduledFor)} · {t(`routines.trigger.${run.triggerSource ?? (run.manual ? "manual" : "schedule")}`)}
                    </span>
                  </div>
                  <Tag tone={runTone(run)} variant="soft" size="sm">{routineRunLabel(run)}</Tag>
                </div>
                <p className={cn("mt-2 line-clamp-2 whitespace-pre-wrap text-[11.5px] leading-relaxed", run.error ? "font-mono text-danger" : "text-ink-secondary")}>
                  {run.attention || run.error || run.output || t("routines.noOutput")}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    )}
    {filtered.length > limit && (
      <button type="button" onClick={() => setLimit((current) => current + 50)} className={buttonClass({ variant: "secondary", size: "sm" })}>
        {t("routines.loadMore")}
      </button>
    )}
  </section>;
}
