import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Users,
  ListTodo,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { DEMO_LABEL } from "@/lib/team-map-demo";
import {
  computeWowFacts,
  type AgentPresence,
  type TaskState,
  type WorkflowSnapshot,
} from "@/lib/team-map-workflow";
import {
  getDemoFullSnapshot,
  getDemoTimelineSteps,
  snapshotAtDemoStep,
  type ActivityKind,
} from "@/lib/team-map-demo-ui";
import { TeamMapActivityFeed } from "./TeamMapActivityFeed";
import { TeamMapWowFacts } from "./TeamMapWowFacts";
import { TeamMapWorkflowDrawer } from "./TeamMapWorkflowDrawer";
import { TeamMapWorkflowGraph } from "./TeamMapWorkflowGraph";
import { TeamMapAgentAvatar } from "./TeamMapAgentAvatar";

const PRESENCE_OPTIONS: Array<AgentPresence | "all"> = [
  "all",
  "idle",
  "working",
  "waiting",
  "blocked",
  "reviewing",
  "completed",
  "offline",
];

const TASK_STATE_OPTIONS: Array<TaskState | "all"> = [
  "all",
  "queued",
  "active",
  "waiting",
  "blocked",
  "reviewing",
  "completed",
  "failed",
];

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function taskDot(state: TaskState): string {
  switch (state) {
    case "active":
      return "bg-success";
    case "blocked":
    case "failed":
      return "bg-danger";
    case "waiting":
    case "queued":
      return "bg-warning";
    case "reviewing":
      return "bg-accent";
    case "completed":
      return "bg-success/60";
    default:
      return "bg-ink-secondary/35";
  }
}

export function TeamMapDemoPanel({ className }: { className?: string }) {
  const steps = useMemo(() => getDemoTimelineSteps(), []);
  const fullSnapshot = useMemo(() => getDemoFullSnapshot(), []);
  const reducedMotion = usePrefersReducedMotion();

  const [step, setStep] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [presenceFilter, setPresenceFilter] = useState<AgentPresence | "all">("all");
  const [taskStateFilter, setTaskStateFilter] = useState<TaskState | "all">("all");
  const [branchFilter, setBranchFilter] = useState<string | "all">("all");
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<ActivityKind | "all">("all");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const currentStep = steps.find((s) => s.step === step) ?? steps[0];
  const snapshot: WorkflowSnapshot = useMemo(
    () => snapshotAtDemoStep(fullSnapshot, step, steps),
    [fullSnapshot, step, steps],
  );
  const facts = useMemo(() => computeWowFacts(snapshot), [snapshot]);

  const branches = useMemo(() => {
    const ids = new Set<string>();
    for (const t of snapshot.tasks) {
      if (t.branchId) ids.add(t.branchId);
    }
    return [...ids].sort();
  }, [snapshot.tasks]);

  const agents = useMemo(() => {
    return snapshot.agents.filter((a) => {
      if (presenceFilter !== "all" && a.presence !== presenceFilter) return false;
      return true;
    });
  }, [snapshot.agents, presenceFilter]);

  const tasks = useMemo(() => {
    return snapshot.tasks.filter((t) => {
      if (taskStateFilter !== "all" && t.state !== taskStateFilter) return false;
      if (branchFilter !== "all" && t.branchId !== branchFilter) return false;
      return true;
    });
  }, [snapshot.tasks, taskStateFilter, branchFilter]);

  const go = useCallback(
    (next: number) => {
      setStep(Math.min(steps.length, Math.max(1, next)));
    },
    [steps.length],
  );

  useEffect(() => {
    if (!playing) return;
    if (step >= steps.length) {
      setPlaying(false);
      return;
    }
    const delay = reducedMotion ? 900 : 1400;
    const timer = window.setTimeout(() => go(step + 1), delay);
    return () => window.clearTimeout(timer);
  }, [playing, step, steps.length, go, reducedMotion]);

  const selectAgent = (id: string) => {
    setSelectedAgentId(id);
    setSelectedTaskId(null);
    setAgentFilter(id);
  };
  const selectTask = (id: string) => {
    setSelectedTaskId(id);
    const t = snapshot.tasks.find((task) => task.id === id);
    if (t) setSelectedAgentId(t.ownerAgentId);
    setTaskFilter(id);
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden bg-app", className)}>
      <div
        role="status"
        className="flex shrink-0 items-center gap-2 border-b border-warning/30 bg-warning/10 px-6 py-2 text-[12px] text-warning"
      >
        <AlertTriangle size={14} className="shrink-0" />
        <span className="font-medium">{DEMO_LABEL}</span>
        <span className="text-warning/80">Marketplace workflow simulation — not live settlement.</span>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-hairline/40 bg-panel px-6 py-3">
        <button
          type="button"
          aria-label="Previous step"
          disabled={step <= 1}
          onClick={() => { setPlaying(false); go(step - 1); }}
          className="rounded-lg border border-hairline/60 p-2 text-ink-secondary hover:bg-control disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          aria-label={playing ? "Pause demo" : "Play demo"}
          onClick={() => setPlaying((p) => !p)}
          className="rounded-lg border border-hairline/60 p-2 text-ink-secondary hover:bg-control"
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          type="button"
          aria-label="Next step"
          disabled={step >= steps.length}
          onClick={() => { setPlaying(false); go(step + 1); }}
          className="rounded-lg border border-hairline/60 p-2 text-ink-secondary hover:bg-control disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          aria-label="Reset demo"
          onClick={() => { setPlaying(false); go(1); }}
          className="rounded-lg border border-hairline/60 p-2 text-ink-secondary hover:bg-control"
        >
          <RotateCcw size={15} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-ink">
            Step {step}/{steps.length}: {currentStep?.label}
          </p>
          <p className="truncate text-[11.5px] text-ink-secondary">{currentStep?.detail}</p>
        </div>

        <div className="flex items-center gap-1" aria-label="Timeline progress">
          {steps.map((s) => (
            <button
              key={s.step}
              type="button"
              aria-label={`Go to step ${s.step}`}
              aria-current={s.step === step ? "step" : undefined}
              onClick={() => { setPlaying(false); go(s.step); }}
              className={cn(
                "h-2 w-2 rounded-full",
                s.step === step ? "bg-accent" : s.step < step ? "bg-accent/40" : "bg-ink-secondary/25",
                !reducedMotion && s.step === step && "motion-safe:scale-125",
              )}
            />
          ))}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-hairline/40 px-6 py-2 text-[11.5px]">
        <span className="text-ink-secondary">Filters</span>
        <select
          aria-label="Filter by presence"
          value={presenceFilter}
          onChange={(e) => setPresenceFilter(e.target.value as AgentPresence | "all")}
          className="rounded-md border border-hairline/50 bg-inset px-2 py-1 text-ink"
        >
          {PRESENCE_OPTIONS.map((p) => (
            <option key={p} value={p}>{p === "all" ? "All presence" : p}</option>
          ))}
        </select>
        <select
          aria-label="Filter by task state"
          value={taskStateFilter}
          onChange={(e) => setTaskStateFilter(e.target.value as TaskState | "all")}
          className="rounded-md border border-hairline/50 bg-inset px-2 py-1 text-ink"
        >
          {TASK_STATE_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === "all" ? "All task states" : s}</option>
          ))}
        </select>
        <select
          aria-label="Filter by branch"
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="rounded-md border border-hairline/50 bg-inset px-2 py-1 text-ink"
        >
          <option value="all">All branches</option>
          {branches.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        {(presenceFilter !== "all" || taskStateFilter !== "all" || branchFilter !== "all" || agentFilter || taskFilter) && (
          <button
            type="button"
            className="text-accent hover:underline"
            onClick={() => {
              setPresenceFilter("all");
              setTaskStateFilter("all");
              setBranchFilter("all");
              setAgentFilter(null);
              setTaskFilter(null);
              setKindFilter("all");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* 1. Spatial 2D Workflow DAG Map */}
            <TeamMapWorkflowGraph
              snapshot={snapshot}
              currentStep={step}
              selectedTaskId={selectedTaskId}
              selectedAgentId={selectedAgentId}
              onSelectTask={selectTask}
              onSelectAgent={selectAgent}
            />

            {/* 2. Interactive Facts with Metric Drill-down to Feed */}
            <div>
              <TeamMapWowFacts
                facts={facts}
                onSelectMetric={(metric) => {
                  if (metric.filterKind) setKindFilter(metric.filterKind);
                }}
                onResetMetric={() => setKindFilter("all")}
              />
            </div>

            {/* 3. Detailed Agent & Task Overview */}
            <div className="grid gap-4 lg:grid-cols-2">
              <section aria-label="Demo agents">
                <div className="mb-2 flex items-center gap-2">
                  <Users size={14} className="text-ink-secondary" />
                  <h3 className="text-[12px] font-semibold text-ink">Agents Overview</h3>
                  <span className="text-[10.5px] text-ink-secondary">{agents.length}</span>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {agents.map((agent) => {
                    const hot = currentStep?.agentId === agent.id || selectedAgentId === agent.id;
                    return (
                      <li key={agent.id}>
                        <button
                          type="button"
                          onClick={() => selectAgent(agent.id)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left transition",
                            hot
                              ? "border-accent/60 ring-1 ring-accent/20"
                              : "border-hairline/40 hover:border-ink-secondary/40",
                            !reducedMotion && hot && "motion-safe:shadow-md",
                          )}
                        >
                          <TeamMapAgentAvatar
                            agentId={agent.id}
                            name={agent.name}
                            presence={agent.presence}
                            size={36}
                            interactive={false}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-ink">{agent.name}</span>
                            <span className="block truncate text-[11px] capitalize text-ink-secondary">
                              {agent.role} · {agent.presence}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {agents.length === 0 && (
                    <li className="col-span-full text-[12px] text-ink-secondary">No agents match this filter.</li>
                  )}
                </ul>
              </section>

              <section aria-label="Demo tasks">
                <div className="mb-2 flex items-center gap-2">
                  <ListTodo size={14} className="text-ink-secondary" />
                  <h3 className="text-[12px] font-semibold text-ink">Task Pipeline</h3>
                  <span className="text-[10.5px] text-ink-secondary">{tasks.length}</span>
                </div>
                <ul className="space-y-2">
                  {tasks.map((task) => {
                    const hot =
                      currentStep?.taskId === task.id ||
                      selectedTaskId === task.id ||
                      (currentStep?.branchId != null && currentStep.branchId === task.branchId);
                    const owner = snapshot.agents.find((a) => a.id === task.ownerAgentId);
                    return (
                      <li key={task.id}>
                        <button
                          type="button"
                          onClick={() => selectTask(task.id)}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-xl border bg-card px-3 py-2.5 text-left transition",
                            hot
                              ? "border-accent/60 ring-1 ring-accent/20"
                              : "border-hairline/40 hover:border-ink-secondary/40",
                          )}
                        >
                          <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", taskDot(task.state))} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-ink">{task.title}</span>
                            <span className="mt-0.5 block text-[11px] capitalize text-ink-secondary">
                              {task.state} · {task.progress}% · {owner?.name ?? task.ownerAgentId}
                              {task.branchId ? ` · ${task.branchId}` : ""}
                            </span>
                            <span
                              className="mt-1.5 block h-1 overflow-hidden rounded-full bg-inset"
                              aria-hidden
                            >
                              <span
                                className={cn(
                                  "block h-full rounded-full bg-accent",
                                  !reducedMotion && "transition-[width] duration-300",
                                )}
                                style={{ width: `${Math.min(100, Math.max(0, task.progress))}%` }}
                              />
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {tasks.length === 0 && (
                    <li className="text-[12px] text-ink-secondary">No tasks match this filter.</li>
                  )}
                </ul>
              </section>
            </div>

            <div className="mt-5 h-[280px]">
              <TeamMapActivityFeed
                snapshot={snapshot}
                agentFilter={agentFilter}
                taskFilter={taskFilter}
                kindFilter={kindFilter}
                onAgentFilter={setAgentFilter}
                onTaskFilter={setTaskFilter}
                onKindFilter={setKindFilter}
                onSelectAgent={selectAgent}
                onSelectTask={selectTask}
                highlightAgentId={currentStep?.agentId}
                highlightTaskId={currentStep?.taskId}
                className="h-full"
              />
            </div>
          </div>
        </div>

        {(selectedAgentId || selectedTaskId) && (
          <TeamMapWorkflowDrawer
            snapshot={snapshot}
            agentId={selectedAgentId}
            taskId={selectedTaskId}
            onClose={() => {
              setSelectedAgentId(null);
              setSelectedTaskId(null);
            }}
            onSelectAgent={selectAgent}
            onSelectTask={selectTask}
          />
        )}
      </div>
    </div>
  );
}
