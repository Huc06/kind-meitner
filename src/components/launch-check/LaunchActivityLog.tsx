import { useEffect, useState } from "react";

import { t } from "@/lib/i18n";
import type { Routine, RoutineRun } from "@/lib/routines";
import { cn } from "@/lib/cn";
import { healthOf, type ServiceCheck } from "./launch-runs";
import { healthLabel } from "./LaunchResult";

type Tone = "neutral" | "good" | "attention" | "bad";
type Entry = { key: string; at: number; text: string; tone: Tone; alert: boolean; checkId?: string };

const TONE: Record<Tone, string> = {
  neutral: "bg-ink-secondary",
  good: "bg-success",
  attention: "bg-warning",
  bad: "bg-danger",
};

function countdown(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Real steps only: each line maps to a recorded check message or a persisted
 * monitor run, with its own timestamp. Nothing here is animated progress. */
export function LaunchActivityLog({ checks, runs, monitor, checking, onDetails }: {
  checks: ServiceCheck[];
  runs: RoutineRun[];
  monitor: Routine | null;
  checking: boolean;
  onDetails: (checkId: string) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!monitor?.nextRunAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [monitor?.nextRunAt]);

  const runNumber = new Map([...runs].sort((a, b) => a.createdAt - b.createdAt).map((run, index) => [run.id, index + 1]));
  const paired = new Set(checks.map((check) => check.monitorRun?.id).filter(Boolean));
  const entries: Entry[] = [];

  for (const check of checks) {
    const run = check.monitorRun;
    const n = run ? runNumber.get(run.id) ?? 0 : 0;
    if (run?.startedAt) {
      entries.push({ key: `${check.id}-start`, at: run.startedAt, text: t("launch.log.monitorStarted", { n }), tone: "neutral", alert: false });
    }
    const health = healthOf(check);
    entries.push({
      key: `${check.id}-result`,
      at: check.at,
      text: check.data
        ? t("launch.log.responded", { result: healthLabel(health) })
        : t("launch.log.unreachable", { error: check.error || t("launch.explain.noDetail") }),
      tone: health === "working" ? "good" : health === "attention" ? "attention" : "bad",
      alert: health !== "working",
      checkId: check.id,
    });
    if (check.data) {
      const comparison = check.comparison;
      entries.push({
        key: `${check.id}-explain`,
        at: check.at + 1,
        text: !comparison
          ? t("launch.log.explainedFirst")
          : comparison.changed
            ? t("launch.log.changed", { from: comparison.verdictFrom, to: comparison.verdictTo, count: comparison.checks.length })
            : t("launch.log.unchanged"),
        tone: comparison?.changed ? "attention" : "neutral",
        alert: Boolean(comparison?.changed),
      });
    }
    if (run?.finishedAt) {
      entries.push({ key: `${check.id}-done`, at: run.finishedAt + 2, text: t("launch.log.monitorDone", { n }), tone: "neutral", alert: false });
    }
  }

  for (const run of runs) {
    if (paired.has(run.id)) continue;
    const n = runNumber.get(run.id) ?? 0;
    if (run.status === "failed" || run.status === "missed" || run.status === "cancelled") {
      entries.push({
        key: `${run.id}-failed`,
        at: run.finishedAt ?? run.scheduledFor,
        text: t("launch.log.monitorFailed", { n, error: run.error || run.status }),
        tone: "bad",
        alert: true,
      });
    } else if (run.status === "running" || run.status === "queued") {
      entries.push({ key: `${run.id}-running`, at: run.startedAt ?? run.scheduledFor, text: t("launch.log.monitorRunning", { n }), tone: "neutral", alert: false });
    }
  }

  entries.sort((a, b) => b.at - a.at);

  return (
    <section aria-labelledby="launch-log-title" className="rounded border border-hairline bg-surface p-4">
      <h2 id="launch-log-title" className="label-mono text-ink-secondary">{t("launch.log.title")}</h2>
      <ul className="mt-2 space-y-1.5 text-[12.5px]">
        {checking && (
          <li className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
            <span>{t("launch.log.checking")}</span>
          </li>
        )}
        {monitor?.enabled && monitor.nextRunAt && (
          <li className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
            <span>
              {t("launch.log.next", { time: new Date(monitor.nextRunAt).toLocaleTimeString(), countdown: countdown(monitor.nextRunAt - now) })}
            </span>
          </li>
        )}
        {entries.length === 0 && !checking && <li className="text-ink-secondary">{t("launch.log.empty")}</li>}
        {entries.slice(0, 40).map((entry) => (
          <li key={entry.key} className="flex items-start gap-2">
            <span aria-hidden="true" className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", TONE[entry.tone])} />
            <span className="min-w-0 flex-1">
              <time className="mr-2 font-mono text-[11.5px] text-ink-secondary" dateTime={new Date(entry.at).toISOString()}>
                {new Date(entry.at).toLocaleTimeString()}
              </time>
              {entry.text}
              {entry.alert && <span className="ml-2 label-mono text-warning">{t("launch.log.alert")}</span>}
              {entry.checkId !== undefined && (
                <button
                  type="button"
                  onClick={() => onDetails(entry.checkId ?? "")}
                  className="ml-2 rounded text-[12px] text-ink-secondary underline underline-offset-2 hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
                >
                  {t("launch.details.open")}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
