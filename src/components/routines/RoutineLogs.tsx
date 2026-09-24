import { useState } from "react";
import { CircleAlert, FileText, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import type { RoutineRun } from "@/lib/routines";
import { routineDateTime, routineRunLabel, routineRunTime } from "@/lib/routine-display";
import type { Bot } from "@/state/store";
import { BotAvatar } from "@/components/Avatar";

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
  return (
    <section className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:p-6" aria-label={t("routines.logs")}>
      <div>
        <h2 className="text-[17px] font-semibold text-ink">{t("routines.logs")}</h2>
        <p className="mt-0.5 text-[12px] text-ink-secondary">{t("routines.logsHint")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-hairline/50 bg-card px-3 py-2 text-ink-secondary focus-within:border-accent">
          <Search size={14} className="shrink-0 text-ink-secondary/60" />
          <input
            aria-label={t("routines.searchLogs")}
            placeholder={t("routines.searchLogs")}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setLimit(50); }}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-secondary/40"
          />
        </label>
        <select
          aria-label={t("routines.filterStatus")}
          value={status}
          onChange={(event) => { setStatus(event.target.value); setLimit(50); }}
          className="rounded-lg border border-hairline/50 bg-card px-3 py-2 text-[12px] text-ink outline-none focus:border-accent"
        >
          <option value="all">{t("routines.allStatuses")}</option>
          {(["queued", "running", "waiting", "completed", "failed", "missed", "cancelled"] as const).map((value) => (
            <option key={value} value={value}>{t(`routines.status.${value}`)}</option>
          ))}
        </select>
      </div>
      {routineId && (
        <div className="flex items-center gap-2 text-[12px] text-ink-secondary">
          {t("routines.filteredRoutine")}
          <button type="button" onClick={onClearRoutine} className="text-accent hover:underline font-medium">
            {t("routines.showAll")}
          </button>
        </div>
      )}
      {error && <p role="alert" className="flex items-center gap-2 rounded-lg bg-danger/10 border border-danger/20 p-3 text-[12px] text-danger"><CircleAlert size={14} />{t("routines.loadError")}</p>}
      {loading && <p role="status" className="flex items-center gap-2 p-3 text-[12px] text-ink-secondary"><Loader2 size={14} className="animate-spin" />{t("routines.loading")}</p>}
      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-hairline/50 p-10 text-center text-ink-secondary">
          <FileText size={24} className="mx-auto mb-2 opacity-40" />
          <p className="text-[13px] font-medium text-ink">{runs.length ? t("routines.noMatchingRuns") : t("routines.noRuns")}</p>
        </div>
      )}
      <div className="space-y-2">
        {filtered.slice(0, limit).map((run) => {
          const bot = bots.find((candidate) => candidate.id === run.botId);
          return (
            <button
              type="button"
              key={run.id}
              onClick={() => onOpen(run)}
              aria-label={t("routines.openRun", { name: run.routineName, status: routineRunLabel(run) })}
              className="group block w-full rounded-xl border border-hairline/50 bg-card p-4 text-left transition-all hover:border-hairline hover:shadow-xs cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  {bot && (
                    <div className="shrink-0 mt-0.5">
                      <BotAvatar bot={bot} size={22} animated={false} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-ink group-hover:text-accent transition-colors">
                      {run.routineName}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-ink-secondary">
                      {bot && <span className="font-medium text-ink/70">{bot.name} · </span>}
                      <span className="font-mono">{routineDateTime(run.scheduledFor)}</span>
                      <span> · {t(`routines.trigger.${run.triggerSource ?? (run.manual ? "manual" : "schedule")}`)}</span>
                    </span>
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                    run.status === "completed"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : run.status === "failed"
                        ? "bg-danger/15 text-danger"
                        : run.status === "running"
                          ? "bg-accent/15 text-accent animate-pulse"
                          : "bg-warning/15 text-warning",
                  )}
                >
                  {routineRunLabel(run)}
                </span>
              </div>
              {run.output && (
                <div className="mt-2.5 rounded-lg border border-hairline/35 bg-inset/50 p-2.5 font-mono text-[11px] leading-relaxed text-ink-secondary line-clamp-2">
                  {run.output}
                </div>
              )}
              {run.error && (
                <div className="mt-2.5 rounded-lg bg-danger/10 p-2.5 text-[11.5px] text-danger">
                  {run.error}
                </div>
              )}
            </button>
          );
        })}
      </div>
      {filtered.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((current) => current + 50)}
          className="rounded-lg border border-hairline/50 bg-card px-4 py-2 text-[12px] font-medium text-ink hover:bg-raised transition-colors"
        >
          {t("routines.loadMore")}
        </button>
      )}
    </section>
  );
}
