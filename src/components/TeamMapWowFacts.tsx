import { Gauge, Timer, Users, GitBranch, MessageSquare, ArrowLeftRight, Link2, CheckCircle2, ShieldAlert, ListChecks, FlaskConical, Zap } from "lucide-react";
import { cn } from "@/lib/cn";
import type { WowFacts } from "@/lib/team-map-workflow";

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

function Fact({
  icon: Icon,
  label,
  value,
  empty,
}: {
  icon: typeof Gauge;
  label: string;
  value: string | number;
  empty?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-hairline/40 bg-card px-3 py-2.5">
      <Icon size={14} className="mt-0.5 shrink-0 text-ink-secondary" />
      <div className="min-w-0">
        <p className="text-[10.5px] uppercase tracking-wide text-ink-secondary">{label}</p>
        <p className={cn("mt-0.5 text-[13px] font-semibold tabular-nums", empty ? "text-ink-secondary font-medium" : "text-ink")}>
          {value}
        </p>
      </div>
    </div>
  );
}

export function TeamMapWowFacts({ facts, className }: { facts: WowFacts; className?: string }) {
  return (
    <section aria-label="Workflow facts" className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 px-0.5">
        <Zap size={14} className="text-accent" />
        <h3 className="text-[12px] font-semibold text-ink">Workflow facts</h3>
        <span className="text-[10.5px] text-ink-secondary">Derived from events only</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Fact icon={Users} label="Agents" value={facts.agentCount} />
        <Fact icon={Gauge} label="Peak concurrent" value={facts.maxConcurrentActiveAgents} />
        <Fact icon={GitBranch} label="Parallel branches" value={facts.parallelBranchCount} />
        <Fact icon={MessageSquare} label="Messages" value={facts.agentMessages} />
        <Fact icon={ArrowLeftRight} label="Ownership transfers" value={facts.ownershipTransfers} />
        <Fact icon={Link2} label="Deps resolved" value={facts.dependenciesResolved} />
        <Fact icon={CheckCircle2} label="Reviews" value={facts.reviewsCompleted} />
        <Fact icon={ShieldAlert} label="Blocked recovered" value={facts.blockedRecovered} />
        <Fact icon={ListChecks} label="Tasks completed" value={facts.tasksCompleted} />
        <Fact icon={Timer} label="Elapsed" value={formatMs(facts.elapsedMs)} empty={facts.elapsedMs === null} />
        <Fact icon={Timer} label="Est. sequential" value={formatMs(facts.estimatedSequentialMs)} empty={facts.estimatedSequentialMs === null} />
        <Fact icon={Zap} label="Speedup" value={formatSpeedup(facts.speedup)} empty={facts.speedup === null} />
        <Fact icon={Timer} label="Time saved" value={formatMs(facts.timeSavedMs)} empty={facts.timeSavedMs === null} />
        <Fact
          icon={FlaskConical}
          label="Tests executed"
          value={facts.testsExecuted === null ? "Not measured" : facts.testsExecuted}
          empty={facts.testsExecuted === null}
        />
      </div>
    </section>
  );
}
