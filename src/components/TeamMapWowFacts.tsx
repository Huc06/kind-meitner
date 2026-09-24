import {
  Gauge,
  Timer,
  Users,
  GitBranch,
  MessageSquare,
  ArrowLeftRight,
  Link2,
  CheckCircle2,
  ShieldAlert,
  ListChecks,
  FlaskConical,
  Zap,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { WowFacts } from "@/lib/team-map-workflow";
import type { ActivityKind } from "@/lib/team-map-demo-ui";

function formatMs(ms: number | null): string {
  if (ms === null) return "Not measured";
  if (ms < 1000) return `${ms} ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec % 1 === 0 ? sec : sec.toFixed(1)} s`;
  const min = Math.floor(sec / 60);
  const rem = Math.round(sec % 60);
  return `${min}m ${rem}s`;
}

function formatSpeedup(value: number | null): string {
  if (value === null) return "Not measured";
  return `${value % 1 === 0 ? value : value.toFixed(2)}×`;
}

interface MetricItem {
  id: string;
  label: string;
  value: string | number;
  icon: typeof Gauge;
  empty?: boolean;
  filterKind?: ActivityKind;
  explanation: string;
  supportingCount?: number;
}

export function TeamMapWowFacts({
  facts,
  activeMetricId,
  onSelectMetric,
  onResetMetric,
  className,
}: {
  facts: WowFacts;
  activeMetricId?: string | null;
  onSelectMetric?: (metric: { id: string; filterKind?: ActivityKind; explanation: string }) => void;
  onResetMetric?: () => void;
  className?: string;
}) {
  const metrics: MetricItem[] = [
    {
      id: "agents",
      label: "Participating agents",
      value: facts.agentCount,
      icon: Users,
      explanation: `${facts.agentCount} distinct agents coordinated in this workflow session.`,
      supportingCount: facts.agentCount,
    },
    {
      id: "concurrent",
      label: "Peak concurrent",
      value: facts.maxConcurrentActiveAgents,
      icon: Gauge,
      explanation: `Observed up to ${facts.maxConcurrentActiveAgents} agents actively working simultaneously on independent branches.`,
      supportingCount: facts.maxConcurrentActiveAgents,
    },
    {
      id: "branches",
      label: "Parallel branches",
      value: facts.parallelBranchCount,
      icon: GitBranch,
      filterKind: "branch",
      explanation: `${facts.parallelBranchCount} independent work streams ran concurrently (Discovery, Terms, Escrow).`,
      supportingCount: facts.parallelBranchCount,
    },
    {
      id: "messages",
      label: "Messages exchanged",
      value: facts.agentMessages,
      icon: MessageSquare,
      filterKind: "message",
      explanation: `${facts.agentMessages} verified agent-to-agent communication turns recorded in event history.`,
      supportingCount: facts.agentMessages,
    },
    {
      id: "transfers",
      label: "Ownership transfers",
      value: facts.ownershipTransfers,
      icon: ArrowLeftRight,
      filterKind: "transfer",
      explanation: `${facts.ownershipTransfers} task ownership handoff prevented stalling with full context preserved.`,
      supportingCount: facts.ownershipTransfers,
    },
    {
      id: "blocked",
      label: "Blocked recovered",
      value: facts.blockedRecovered,
      icon: ShieldAlert,
      filterKind: "help",
      explanation: `${facts.blockedRecovered} blocked dependency resolved via direct agent-to-agent help request.`,
      supportingCount: facts.blockedRecovered,
    },
    {
      id: "reviews",
      label: "Reviews completed",
      value: facts.reviewsCompleted,
      icon: CheckCircle2,
      filterKind: "review",
      explanation: `${facts.reviewsCompleted} convergence review completed: changes requested, revised, and approved.`,
      supportingCount: facts.reviewsCompleted,
    },
    {
      id: "tasks",
      label: "Tasks completed",
      value: facts.tasksCompleted,
      icon: ListChecks,
      filterKind: "task",
      explanation: `${facts.tasksCompleted} of ${facts.tasksCompleted} workflow tasks finished and verified.`,
      supportingCount: facts.tasksCompleted,
    },
    {
      id: "deps",
      label: "Dependencies resolved",
      value: facts.dependenciesResolved,
      icon: Link2,
      explanation: `${facts.dependenciesResolved} task dependencies unblocked through peer deliverable handoffs.`,
      supportingCount: facts.dependenciesResolved,
    },
    {
      id: "elapsed",
      label: "Workflow duration",
      value: formatMs(facts.elapsedMs),
      icon: Timer,
      empty: facts.elapsedMs === null,
      explanation: `Observed parallel critical path time from start to completion.`,
    },
    {
      id: "sequential",
      label: "Estimated sequential",
      value: formatMs(facts.estimatedSequentialMs),
      icon: Timer,
      empty: facts.estimatedSequentialMs === null,
      explanation: `Sum of all active task durations if executed one after another sequentially.`,
    },
    {
      id: "speedup",
      label: "Parallel speedup",
      value: formatSpeedup(facts.speedup),
      icon: Zap,
      empty: facts.speedup === null,
      explanation: `Calculated as estimated sequential duration divided by observed parallel duration.`,
    },
    {
      id: "saved",
      label: "Time saved",
      value: formatMs(facts.timeSavedMs),
      icon: Timer,
      empty: facts.timeSavedMs === null,
      explanation: `Time saved by running independent branches in parallel rather than sequentially.`,
    },
    {
      id: "tests",
      label: "Tests executed",
      value: facts.testsExecuted === null ? "Not measured" : facts.testsExecuted,
      icon: FlaskConical,
      empty: facts.testsExecuted === null,
      explanation: "Tests executed in isolated verification runner (null displayed as Not measured).",
    },
  ];

  const activeMetric = metrics.find((m) => m.id === activeMetricId);

  return (
    <section
      aria-label="Workflow facts"
      className={cn("overflow-hidden rounded-2xl border border-white/[0.08] bg-[#15171A]", className)}
    >
      {/* Header (48-52px) */}
      <div className="flex h-12 items-center justify-between border-b border-white/[0.08] px-5">
        <div className="flex items-center gap-2.5">
          <Zap size={15} className="text-accent" aria-hidden="true" />
          <h3 className="text-[15px] font-semibold text-white/90">Workflow facts</h3>
          <span className="text-[12px] text-white/45">Derived from events</span>
        </div>

        <span className="text-[12px] text-white/45 hidden sm:inline">
          Select a metric to inspect supporting events
        </span>
      </div>

      {/* Responsive CSS Grid */}
      <div className="grid grid-cols-2 divide-x divide-y divide-white/[0.06] sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
        {metrics.map((m) => {
          const isSelected = activeMetricId === m.id;
          const Icon = m.icon;

          return (
            <button
              key={m.id}
              type="button"
              role="button"
              aria-selected={isSelected}
              onClick={() => {
                if (isSelected) {
                  onResetMetric?.();
                } else {
                  onSelectMetric?.({
                    id: m.id,
                    filterKind: m.filterKind,
                    explanation: m.explanation,
                  });
                }
              }}
              className={cn(
                "relative flex min-h-[82px] cursor-pointer flex-col justify-between p-3.5 text-left outline-none transition-colors",
                isSelected
                  ? "bg-[#1C2025] ring-inset ring-2 ring-accent/60"
                  : "bg-transparent hover:bg-[#20242A]/60",
                "focus-visible:ring-2 focus-visible:ring-accent",
              )}
            >
              {/* Top: Icon + Label */}
              <div className="flex items-start justify-between gap-1.5">
                <span className="line-clamp-2 text-[11.5px] font-medium leading-tight text-white/60">
                  {m.label}
                </span>
                <Icon size={13} className="shrink-0 text-white/35 mt-0.5" aria-hidden="true" />
              </div>

              {/* Bottom: Metric Value */}
              <div
                className={cn(
                  "font-mono text-[20px] font-semibold tabular-nums leading-none",
                  m.empty ? "text-white/40 font-normal text-[14px]" : "text-white/95",
                )}
              >
                {m.value}
              </div>

              {/* Selected indicator line */}
              {isSelected && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {/* Compact Contextual Inspector Bar */}
      {activeMetric && (
        <div
          role="region"
          aria-label="Metric calculation details"
          className="flex flex-wrap items-center justify-between gap-3 border-t border-accent/20 bg-[#1C2025] px-5 py-3 text-[12.5px]"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Sparkles size={14} className="shrink-0 text-accent" aria-hidden="true" />
            <div className="min-w-0">
              <span className="font-semibold text-white/90">{activeMetric.label}:</span>{" "}
              <span className="text-white/70">{activeMetric.explanation}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onResetMetric}
            className="flex items-center gap-1.5 rounded-[6px] border border-white/[0.12] bg-white/[0.04] px-2.5 py-1 text-[11.5px] font-medium text-white/80 hover:bg-white/[0.08] hover:text-white"
          >
            <X size={12} aria-hidden="true" />
            <span>Reset filter</span>
          </button>
        </div>
      )}
    </section>
  );
}
