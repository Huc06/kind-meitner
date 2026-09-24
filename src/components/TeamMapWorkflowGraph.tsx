import { useMemo } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type {
  WorkflowSnapshot,
  TaskState,
  AgentPresence,
} from "@/lib/team-map-workflow";
import { TeamMapAgentAvatar } from "./TeamMapAgentAvatar";

export interface TeamMapWorkflowGraphProps {
  snapshot: WorkflowSnapshot;
  currentStep?: number;
  selectedTaskId?: string | null;
  selectedAgentId?: string | null;
  onSelectTask: (taskId: string) => void;
  onSelectAgent: (agentId: string) => void;
  className?: string;
}

function taskStateBadge(state: TaskState): { label: string; tone: string } {
  switch (state) {
    case "active":
      return { label: "Running", tone: "bg-success/15 text-success border-success/30" };
    case "blocked":
      return { label: "BLOCKED", tone: "bg-danger/15 text-danger border-danger/40 animate-pulse font-bold" };
    case "waiting":
      return { label: "Waiting", tone: "bg-warning/15 text-warning border-warning/30" };
    case "reviewing":
      return { label: "In Review", tone: "bg-accent/20 text-accent border-accent/40 font-semibold" };
    case "completed":
      return { label: "Completed", tone: "bg-success/10 text-success/80 border-success/20" };
    case "failed":
      return { label: "Failed", tone: "bg-danger/20 text-danger border-danger/40" };
    default:
      return { label: "Queued", tone: "bg-inset text-ink-secondary border-hairline/40" };
  }
}

function presenceBadge(presence: AgentPresence): { label: string; tone: string } {
  switch (presence) {
    case "working":
      return { label: "Working", tone: "bg-success/20 text-success" };
    case "blocked":
      return { label: "Blocked", tone: "bg-danger/20 text-danger" };
    case "waiting":
      return { label: "Waiting", tone: "bg-warning/20 text-warning" };
    case "reviewing":
      return { label: "Reviewing", tone: "bg-accent/20 text-accent" };
    case "completed":
      return { label: "Done", tone: "bg-success/10 text-success/80" };
    case "offline":
      return { label: "Offline", tone: "bg-control text-ink-secondary" };
    default:
      return { label: "Idle", tone: "bg-inset text-ink-secondary" };
  }
}

export function TeamMapWorkflowGraph({
  snapshot,
  currentStep: _currentStep,
  selectedTaskId,
  selectedAgentId: _selectedAgentId,
  onSelectTask,
  onSelectAgent,
  className,
}: TeamMapWorkflowGraphProps) {
  const agentsById = useMemo(
    () => new Map(snapshot.agents.map((a) => [a.id, a])),
    [snapshot.agents],
  );

  const tasksById = useMemo(
    () => new Map(snapshot.tasks.map((t) => [t.id, t])),
    [snapshot.tasks],
  );

  // Retrieve active transfer information if any
  const transfers = snapshot.transfers;
  const latestTransfer = transfers[transfers.length - 1];

  // Check if risk asked discovery for help
  const hasHelpRequest = snapshot.messages.some(
    (m) => (m.kind === "help" || m.kind === "help_requested") && m.fromAgentId === "risk",
  );

  // DAG Column 1: Objective (Coordinator)
  const intakeTask = tasksById.get("intake");
  const coordinatorAgent = agentsById.get("coordinator");

  // DAG Column 2: Parallel Branches
  const discoverTask = tasksById.get("discover");
  const discoveryAgent = agentsById.get("discovery");

  const riskTask = tasksById.get("risk-eval");
  const riskAgent = agentsById.get("risk");

  const escrowTask = tasksById.get("escrow-prep");

  const negotiateTask = tasksById.get("negotiate");
  const negotiationAgent = agentsById.get("negotiation");

  // DAG Column 3: Review Convergence
  const reviewTask = tasksById.get("review");
  const reviewerAgent = agentsById.get("reviewer");

  return (
    <div
      className={cn(
        "relative min-h-[580px] w-full select-none overflow-x-auto rounded-2xl border border-hairline/50 bg-[#121417] p-6 text-ink shadow-inner",
        className,
      )}
      style={{
        backgroundImage:
          "radial-gradient(circle, color-mix(in srgb, var(--color-ink-secondary) 15%, transparent) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      {/* Header Legend */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-hairline/30 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-accent" />
          <h2 className="text-[13px] font-semibold text-ink">Autonomous Workflow DAG</h2>
          <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[10.5px] font-medium text-accent">
            Live 2D Spatial Map
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-secondary">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-success" /> Running / Active
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-danger animate-pulse" /> Blocked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-accent" /> In Review / Converging
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-warning" /> Hand-off transferred
          </span>
        </div>
      </div>

      {/* Spatial Workflow Canvas */}
      <div className="relative min-w-[980px] py-4">
        {/* SVG Connecting Paths & Dependency Arrows */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <marker
              id="dag-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="rgba(255,255,255,0.3)" />
            </marker>
            <marker
              id="dag-arrow-active"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--color-accent, #6366f1)" />
            </marker>
            <marker
              id="dag-arrow-help"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
            </marker>
          </defs>

          {/* 1. Branching Out: Coordinator (x: 230, y: 220) -> Discovery (x: 390, y: 80) */}
          <path
            d="M 230 220 C 310 220, 320 80, 390 80"
            fill="none"
            stroke={discoverTask?.state === "active" || discoverTask?.state === "completed" ? "var(--color-accent, #6366f1)" : "rgba(255,255,255,0.15)"}
            strokeWidth={discoverTask?.state === "active" ? "2.5" : "1.5"}
            strokeDasharray={discoverTask?.state === "active" ? "4 3" : undefined}
            markerEnd={discoverTask?.state === "active" ? "url(#dag-arrow-active)" : "url(#dag-arrow)"}
          />

          {/* Coordinator -> Risk (x: 390, y: 200) */}
          <path
            d="M 230 220 C 310 220, 320 200, 390 200"
            fill="none"
            stroke={riskTask?.state === "active" || riskTask?.state === "completed" ? "var(--color-accent, #6366f1)" : "rgba(255,255,255,0.15)"}
            strokeWidth={riskTask?.state === "active" ? "2.5" : "1.5"}
            markerEnd={riskTask?.state === "active" ? "url(#dag-arrow-active)" : "url(#dag-arrow)"}
          />

          {/* Coordinator -> Escrow (x: 390, y: 330) */}
          <path
            d="M 230 220 C 310 220, 320 330, 390 330"
            fill="none"
            stroke={escrowTask?.state === "active" || escrowTask?.state === "completed" ? "var(--color-accent, #6366f1)" : "rgba(255,255,255,0.15)"}
            strokeWidth={escrowTask?.state === "active" ? "2.5" : "1.5"}
            markerEnd={escrowTask?.state === "active" ? "url(#dag-arrow-active)" : "url(#dag-arrow)"}
          />

          {/* 2. Help Request Edge: Risk (x: 500, y: 200) -> Discovery (x: 500, y: 115) */}
          {hasHelpRequest && (
            <g>
              <path
                d="M 500 170 C 500 145, 500 135, 500 115"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeDasharray="4 3"
                markerEnd="url(#dag-arrow-help)"
              />
              <rect x="440" y="130" width="120" height="20" rx="4" fill="#1e180a" stroke="#f59e0b" strokeWidth="1" />
              <text x="500" y="144" fill="#fbbf24" fontSize="10" fontWeight="600" textAnchor="middle" fontFamily="sans-serif">
                asks for help ↗
              </text>
            </g>
          )}

          {/* 3. Dependency Edge: Escrow / Risk -> Negotiation (x: 490, y: 460) */}
          <path
            d="M 520 220 C 560 220, 560 450, 490 460"
            fill="none"
            stroke={negotiateTask?.state === "blocked" ? "var(--color-danger, #ef4444)" : "rgba(255,255,255,0.15)"}
            strokeWidth="1.5"
            strokeDasharray={negotiateTask?.state === "blocked" ? "3 3" : undefined}
          />

          {/* 4. Convergence: Discovery (x: 640, y: 80) -> Reviewer (x: 730, y: 240) */}
          <path
            d="M 640 80 C 700 80, 690 230, 730 240"
            fill="none"
            stroke={reviewTask?.state === "active" || reviewTask?.state === "completed" ? "var(--color-accent, #6366f1)" : "rgba(255,255,255,0.18)"}
            strokeWidth={reviewTask?.state === "active" ? "2.5" : "1.5"}
            markerEnd={reviewTask?.state === "active" ? "url(#dag-arrow-active)" : "url(#dag-arrow)"}
          />

          {/* Risk -> Reviewer */}
          <path
            d="M 640 200 C 685 200, 690 240, 730 240"
            fill="none"
            stroke={reviewTask?.state === "active" || reviewTask?.state === "completed" ? "var(--color-accent, #6366f1)" : "rgba(255,255,255,0.18)"}
            strokeWidth={reviewTask?.state === "active" ? "2.5" : "1.5"}
            markerEnd={reviewTask?.state === "active" ? "url(#dag-arrow-active)" : "url(#dag-arrow)"}
          />

          {/* Negotiation / Escrow -> Reviewer */}
          <path
            d="M 640 460 C 700 460, 690 250, 730 250"
            fill="none"
            stroke={reviewTask?.state === "active" || reviewTask?.state === "completed" ? "var(--color-accent, #6366f1)" : "rgba(255,255,255,0.18)"}
            strokeWidth={reviewTask?.state === "active" ? "2.5" : "1.5"}
            markerEnd={reviewTask?.state === "active" ? "url(#dag-arrow-active)" : "url(#dag-arrow)"}
          />

          {/* Reviewer -> Completion (x: 870 -> 910) */}
          <path
            d="M 870 245 L 910 245"
            fill="none"
            stroke={snapshot.tasks.every((t) => t.state === "completed") ? "var(--color-success, #22c55e)" : "rgba(255,255,255,0.18)"}
            strokeWidth="2"
            markerEnd="url(#dag-arrow)"
          />
        </svg>

        {/* 4-Column Layout */}
        <div className="grid grid-cols-[230px_1fr_210px_140px] items-start gap-8">
          {/* COLUMN 1: Objective & Coordinator */}
          <div className="space-y-4 pt-16">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
              <span>Stage 1</span>
              <span>·</span>
              <span>Objective</span>
            </div>

            <article
              onClick={() => {
                if (intakeTask) onSelectTask(intakeTask.id);
                if (coordinatorAgent) onSelectAgent(coordinatorAgent.id);
              }}
              className={cn(
                "cursor-pointer rounded-2xl border bg-card/90 p-4 transition-all hover:border-accent/60",
                selectedTaskId === "intake" ? "border-accent ring-2 ring-accent/25" : "border-hairline/60",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-accent">Marketplace Objective</span>
                {intakeTask && (
                  <span className={cn("rounded-md border px-2 py-0.5 text-[10px]", taskStateBadge(intakeTask.state).tone)}>
                    {taskStateBadge(intakeTask.state).label}
                  </span>
                )}
              </div>

              <h4 className="mt-2 text-[13px] font-semibold leading-snug text-ink">
                B2B Industrial Sensor Sourcing
              </h4>
              <p className="mt-1 text-[11px] text-ink-secondary">
                Target close in 48h with escrow protection
              </p>

              {coordinatorAgent && (
                <div className="mt-4 flex items-center justify-between border-t border-hairline/30 pt-3">
                  <div className="flex items-center gap-2">
                    <TeamMapAgentAvatar
                      agentId={coordinatorAgent.id}
                      name={coordinatorAgent.name}
                      presence={coordinatorAgent.presence}
                      size={24}
                    />
                    <span className="text-[12px] font-medium text-ink">{coordinatorAgent.name}</span>
                  </div>
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", presenceBadge(coordinatorAgent.presence).tone)}>
                    {presenceBadge(coordinatorAgent.presence).label}
                  </span>
                </div>
              )}
            </article>
          </div>

          {/* COLUMN 2: Parallel Work Branches */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
              <span>Stage 2 · Parallel Agent Branches</span>
              <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] lowercase tracking-normal text-accent">
                concurrent execution
              </span>
            </div>

            <div className="space-y-4">
              {/* Branch A: Discovery */}
              {discoverTask && (
                <article
                  onClick={() => {
                    onSelectTask(discoverTask.id);
                    if (discoveryAgent) onSelectAgent(discoveryAgent.id);
                  }}
                  className={cn(
                    "cursor-pointer rounded-2xl border bg-card/90 p-4 transition-all hover:border-accent/60",
                    selectedTaskId === "discover" ? "border-accent ring-2 ring-accent/25" : "border-hairline/60",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-emerald-400">Branch 1 · Catalog Discovery</span>
                    <span className={cn("rounded-md border px-2 py-0.5 text-[10px]", taskStateBadge(discoverTask.state).tone)}>
                      {taskStateBadge(discoverTask.state).label}
                    </span>
                  </div>
                  <h4 className="mt-1 text-[13px] font-semibold text-ink">{discoverTask.title}</h4>

                  {/* Progress bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-inset">
                      <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${discoverTask.progress}%` }} />
                    </div>
                    <span className="text-[11px] tabular-nums text-ink-secondary">{discoverTask.progress}%</span>
                  </div>

                  {discoveryAgent && (
                    <div className="mt-3 flex items-center justify-between border-t border-hairline/30 pt-2.5">
                      <div className="flex items-center gap-2">
                        <TeamMapAgentAvatar
                          agentId={discoveryAgent.id}
                          name={discoveryAgent.name}
                          presence={discoveryAgent.presence}
                          size={22}
                        />
                        <span className="text-[12px] font-medium text-ink">{discoveryAgent.name}</span>
                      </div>
                      <span className={cn("rounded px-1.5 py-0.5 text-[10px]", presenceBadge(discoveryAgent.presence).tone)}>
                        {presenceBadge(discoveryAgent.presence).label}
                      </span>
                    </div>
                  )}
                </article>
              )}

              {/* Branch B: Risk Evaluator */}
              {riskTask && (
                <article
                  onClick={() => {
                    onSelectTask(riskTask.id);
                    if (riskAgent) onSelectAgent(riskAgent.id);
                  }}
                  className={cn(
                    "cursor-pointer rounded-2xl border bg-card/90 p-4 transition-all hover:border-accent/60",
                    selectedTaskId === "risk-eval" ? "border-accent ring-2 ring-accent/25" : "border-hairline/60",
                    riskAgent?.presence === "working" && "border-accent/40 shadow-[0_0_15px_rgba(99,102,241,0.15)]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-indigo-400">Branch 2 · Counterparty Risk</span>
                    <span className={cn("rounded-md border px-2 py-0.5 text-[10px]", taskStateBadge(riskTask.state).tone)}>
                      {taskStateBadge(riskTask.state).label}
                    </span>
                  </div>
                  <h4 className="mt-1 text-[13px] font-semibold text-ink">{riskTask.title}</h4>

                  {/* Progress bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-inset">
                      <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${riskTask.progress}%` }} />
                    </div>
                    <span className="text-[11px] tabular-nums text-ink-secondary">{riskTask.progress}%</span>
                  </div>

                  {riskAgent && (
                    <div className="mt-3 flex items-center justify-between border-t border-hairline/30 pt-2.5">
                      <div className="flex items-center gap-2">
                        <TeamMapAgentAvatar
                          agentId={riskAgent.id}
                          name={riskAgent.name}
                          presence={riskAgent.presence}
                          size={22}
                        />
                        <span className="text-[12px] font-medium text-ink">{riskAgent.name}</span>
                      </div>
                      <span className={cn("rounded px-1.5 py-0.5 text-[10px]", presenceBadge(riskAgent.presence).tone)}>
                        {presenceBadge(riskAgent.presence).label}
                      </span>
                    </div>
                  )}
                </article>
              )}

              {/* Branch C: Escrow & Ownership Transfer */}
              {escrowTask && (
                <article
                  onClick={() => {
                    onSelectTask(escrowTask.id);
                    const owner = agentsById.get(escrowTask.ownerAgentId);
                    if (owner) onSelectAgent(owner.id);
                  }}
                  className={cn(
                    "cursor-pointer rounded-2xl border bg-card/90 p-4 transition-all hover:border-accent/60",
                    selectedTaskId === "escrow-prep" ? "border-accent ring-2 ring-accent/25" : "border-hairline/60",
                    transfers.length > 0 && "ring-1 ring-warning/30",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-amber-400">Branch 3 · Payment Protection</span>
                    <span className={cn("rounded-md border px-2 py-0.5 text-[10px]", taskStateBadge(escrowTask.state).tone)}>
                      {taskStateBadge(escrowTask.state).label}
                    </span>
                  </div>
                  <h4 className="mt-1 text-[13px] font-semibold text-ink">{escrowTask.title}</h4>

                  {/* Transfer Banner */}
                  {latestTransfer && (
                    <div className="mt-2.5 rounded-lg border border-warning/30 bg-warning/10 p-2 text-[11px] text-warning">
                      <div className="flex items-center justify-between font-semibold">
                        <span>Handoff: Escrow → Negotiation</span>
                        <span className="text-[10px]">Context preserved</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-warning/90">
                        {latestTransfer.reason}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between text-[9.5px] text-ink-secondary">
                        <span>4 msgs, 2 artifacts transferred</span>
                        <span className="text-warning">Resumed at {escrowTask.progress}%</span>
                      </div>
                    </div>
                  )}

                  {/* Progress bar */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-inset">
                      <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${escrowTask.progress}%` }} />
                    </div>
                    <span className="text-[11px] tabular-nums text-ink-secondary">{escrowTask.progress}%</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-hairline/30 pt-2.5">
                    <div className="flex items-center gap-2">
                      <TeamMapAgentAvatar
                        agentId={escrowTask.ownerAgentId}
                        name={agentsById.get(escrowTask.ownerAgentId)?.name ?? escrowTask.ownerAgentId}
                        presence={agentsById.get(escrowTask.ownerAgentId)?.presence ?? "working"}
                        size={22}
                      />
                      <span className="text-[12px] font-medium text-ink">
                        {agentsById.get(escrowTask.ownerAgentId)?.name ?? escrowTask.ownerAgentId}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px]",
                        presenceBadge(agentsById.get(escrowTask.ownerAgentId)?.presence ?? "working").tone,
                      )}
                    >
                      {presenceBadge(agentsById.get(escrowTask.ownerAgentId)?.presence ?? "working").label}
                    </span>
                  </div>
                </article>
              )}

              {/* Branch D: Negotiation (Blocked until dependencies complete) */}
              {negotiateTask && (
                <article
                  onClick={() => {
                    onSelectTask(negotiateTask.id);
                    if (negotiationAgent) onSelectAgent(negotiationAgent.id);
                  }}
                  className={cn(
                    "cursor-pointer rounded-2xl border bg-card/90 p-4 transition-all hover:border-accent/60",
                    selectedTaskId === "negotiate" ? "border-accent ring-2 ring-accent/25" : "border-hairline/60",
                    negotiateTask.state === "blocked" && "border-danger/60 bg-danger/5 shadow-[0_0_15px_rgba(239,68,68,0.15)]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-rose-400">Commercial Terms</span>
                    <span className={cn("rounded-md border px-2 py-0.5 text-[10px]", taskStateBadge(negotiateTask.state).tone)}>
                      {taskStateBadge(negotiateTask.state).label}
                    </span>
                  </div>
                  <h4 className="mt-1 text-[13px] font-semibold text-ink">{negotiateTask.title}</h4>

                  {negotiateTask.state === "blocked" && (
                    <div className="mt-2 flex items-center gap-1.5 rounded-md bg-danger/10 px-2 py-1 text-[11px] text-danger">
                      <AlertCircle size={13} className="shrink-0" />
                      <span>Blocked on risk evaluation & escrow</span>
                    </div>
                  )}

                  {/* Progress bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-inset">
                      <div className="h-full bg-rose-500 transition-all duration-300" style={{ width: `${negotiateTask.progress}%` }} />
                    </div>
                    <span className="text-[11px] tabular-nums text-ink-secondary">{negotiateTask.progress}%</span>
                  </div>

                  {negotiationAgent && (
                    <div className="mt-3 flex items-center justify-between border-t border-hairline/30 pt-2.5">
                      <div className="flex items-center gap-2">
                        <TeamMapAgentAvatar
                          agentId={negotiationAgent.id}
                          name={negotiationAgent.name}
                          presence={negotiationAgent.presence}
                          size={22}
                        />
                        <span className="text-[12px] font-medium text-ink">{negotiationAgent.name}</span>
                      </div>
                      <span className={cn("rounded px-1.5 py-0.5 text-[10px]", presenceBadge(negotiationAgent.presence).tone)}>
                        {presenceBadge(negotiationAgent.presence).label}
                      </span>
                    </div>
                  )}
                </article>
              )}
            </div>
          </div>

          {/* COLUMN 3: Convergence & Review */}
          <div className="space-y-4 pt-20">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
              <span>Stage 3</span>
              <span>·</span>
              <span>Review Convergence</span>
            </div>

            {reviewTask && (
              <article
                onClick={() => {
                  onSelectTask(reviewTask.id);
                  if (reviewerAgent) onSelectAgent(reviewerAgent.id);
                }}
                className={cn(
                  "cursor-pointer rounded-2xl border bg-card/90 p-4 transition-all hover:border-accent/60",
                  selectedTaskId === "review" ? "border-accent ring-2 ring-accent/25" : "border-hairline/60",
                  reviewTask.state === "reviewing" && "border-accent ring-2 ring-accent/30 shadow-[0_0_20px_rgba(99,102,241,0.2)]",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-accent">Jury Review</span>
                  <span className={cn("rounded-md border px-2 py-0.5 text-[10px]", taskStateBadge(reviewTask.state).tone)}>
                    {taskStateBadge(reviewTask.state).label}
                  </span>
                </div>

                <h4 className="mt-2 text-[13px] font-semibold text-ink">{reviewTask.title}</h4>
                <p className="mt-1 text-[11px] text-ink-secondary">
                  Merges counterparty audit + settlement terms
                </p>

                {/* Progress bar */}
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-inset">
                    <div className="h-full bg-accent transition-all duration-300" style={{ width: `${reviewTask.progress}%` }} />
                  </div>
                  <span className="text-[11px] tabular-nums text-ink-secondary">{reviewTask.progress}%</span>
                </div>

                {reviewerAgent && (
                  <div className="mt-4 flex items-center justify-between border-t border-hairline/30 pt-3">
                    <div className="flex items-center gap-2">
                      <TeamMapAgentAvatar
                        agentId={reviewerAgent.id}
                        name={reviewerAgent.name}
                        presence={reviewerAgent.presence}
                        size={24}
                      />
                      <span className="text-[12px] font-medium text-ink">{reviewerAgent.name}</span>
                    </div>
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px]", presenceBadge(reviewerAgent.presence).tone)}>
                      {presenceBadge(reviewerAgent.presence).label}
                    </span>
                  </div>
                )}
              </article>
            )}
          </div>

          {/* COLUMN 4: Completed Stage */}
          <div className="space-y-4 pt-28">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
              <span>Stage 4</span>
              <span>·</span>
              <span>Close</span>
            </div>

            <div
              className={cn(
                "rounded-2xl border p-4 text-center transition-all",
                snapshot.tasks.every((t) => t.state === "completed")
                  ? "border-success/50 bg-success/10 text-success"
                  : "border-hairline/40 bg-card/60 text-ink-secondary opacity-60",
              )}
            >
              <CheckCircle2 size={24} className="mx-auto" />
              <p className="mt-2 text-[12px] font-semibold">Deal Package Ready</p>
              <p className="mt-1 text-[10.5px]">Audited event trail</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
