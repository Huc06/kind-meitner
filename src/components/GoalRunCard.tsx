import {
  CheckCircle2,
  CircleAlert,
  Hand,
  Loader2,
  Square,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/cn";
import type { Message } from "@/state/store";
import type { GroupGoalRunCardData } from "../../shared/group-goal-run";
import { Frame } from "@/components/ui/frame";

const DETAIL_LIMIT = 280;

const COPY = {
  working: { label: "Working", tone: "text-accent", border: "border-accent/30" },
  completed: { label: "Completed", tone: "text-success", border: "border-success/30" },
  "needs-input": { label: "Needs your input", tone: "text-warning", border: "border-warning/35" },
  blocked: { label: "Blocked", tone: "text-warning", border: "border-warning/35" },
  "limit-reached": { label: "Turn limit reached", tone: "text-warning", border: "border-warning/35" },
  paused: { label: "Paused", tone: "text-warning", border: "border-warning/35" },
  stopped: { label: "Stopped", tone: "text-ink-secondary", border: "border-hairline/45" },
  failed: { label: "Failed", tone: "text-danger", border: "border-danger/35" },
} satisfies Record<
  GroupGoalRunCardData["status"],
  { label: string; tone: string; border: string }
>;

function compact(value: string | undefined, limit: number): string {
  const clean = value?.replace(/\s+/g, " ").trim() ?? "";
  return clean.length > limit ? `${clean.slice(0, limit - 1).trimEnd()}…` : clean;
}

function StatusIcon({ status }: { status: GroupGoalRunCardData["status"] }) {
  const className = "size-4 shrink-0";
  switch (status) {
    case "working":
      return <Loader2 aria-hidden="true" className={cn(className, "animate-spin text-accent")} />;
    case "completed":
      return <CheckCircle2 aria-hidden="true" className={cn(className, "text-success")} />;
    case "needs-input":
      return <Hand aria-hidden="true" className={cn(className, "text-warning")} />;
    case "blocked":
    case "limit-reached":
    case "paused":
      return <CircleAlert aria-hidden="true" className={cn(className, "text-warning")} />;
    case "stopped":
      return <Square aria-hidden="true" className={cn(className, "text-ink-secondary")} />;
    case "failed":
      return <XCircle aria-hidden="true" className={cn(className, "text-danger")} />;
  }
}

/** One durable terminal receipt for a goal-driven channel run. */
export function GoalRunCard({ message }: { message: Message }) {
  const run = message.goalRun;
  if (!run) {
    const fallback = compact(message.text, DETAIL_LIMIT);
    return fallback ? (
      <div className="w-fit max-w-[min(42rem,88%)] border border-hairline bg-card px-4 py-2.5 text-[14px] leading-relaxed text-ink">
        {fallback}
      </div>
    ) : null;
  }

  const copy = COPY[run.status];
  const goal = compact(run.goal, 180);
  const detail = compact(run.detail, DETAIL_LIMIT);
  const turns = run.status === "working"
    ? `Turn ${Math.min(run.turnCount + 1, run.maxTurns)} of ${run.maxTurns}`
    : `${run.turnCount} ${run.turnCount === 1 ? "turn" : "turns"}`;

  return (
    <Frame
      as="section"
      aria-label={`Goal run: ${copy.label}`}
      title="Goal Run"
      surface="app"
      className="w-full max-w-[680px] bg-card p-4"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center border border-hairline bg-inset">
          <StatusIcon status={run.status} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 className="truncate text-[13.5px] font-medium text-ink">{goal || "Group goal"}</h3>
            <span aria-live="polite" className={cn("font-mono text-[11px] font-medium uppercase", copy.tone)}>
              {copy.label}
            </span>
          </div>
          {detail && <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-ink-secondary">{detail}</p>}
          <p className="mt-1 font-mono text-[11px] text-ink-secondary">
            {run.coordinatorName} coordinating · {turns}
          </p>
        </div>
      </div>
    </Frame>
  );
}
