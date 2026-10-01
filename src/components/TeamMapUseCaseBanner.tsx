import { useState } from "react";
import { cn } from "@/lib/cn";
import { CheckCircle2, Clock, AlertTriangle, Sparkles, ChevronDown } from "lucide-react";

export interface UseCaseStep {
  id: string;
  stepNumber: number;
  title: string;
  agentName: string;
  agentId: string;
  role: string;
  status: "completed" | "in_progress" | "blocked" | "waiting";
  description: string;
  output: string;
}

export interface UseCaseScenario {
  id: string;
  title: string;
  category: string;
  summary: string;
  steps: UseCaseStep[];
}

export const DEMO_USE_CASES: UseCaseScenario[] = [
  {
    id: "b2b-sourcing",
    title: "Autonomous B2B Sourcing & Vault Settlement",
    category: "Corporate Commerce",
    summary: "From vendor radar discovery to 72h smart escrow vault lockup without manual procurement overhead.",
    steps: [
      {
        id: "step-1",
        stepNumber: 1,
        title: "Vendor Discovery",
        agentName: "Markets",
        agentId: "markets",
        role: "Market Radar",
        status: "completed",
        description: "Scans marketplace catalog for tier-1 verified industrial sensor ASPs.",
        output: "vendor-orion-diligence.json",
      },
      {
        id: "step-2",
        stepNumber: 2,
        title: "Terms & Quality SLA",
        agentName: "Listing Coach",
        agentId: "listing-coach",
        role: "Offer Quality",
        status: "blocked",
        description: "Drafts commercial agreement; waiting on historical delivery audit.",
        output: "commercial-agreement-v2-72h.md",
      },
      {
        id: "step-3",
        stepNumber: 3,
        title: "Treasury Gate Audit",
        agentName: "Spend Scout",
        agentId: "spend-scout",
        role: "Risk & Trust Reviewer",
        status: "waiting",
        description: "Enforces 105k USDT cap and validates multisig buyer protection.",
        output: "spend-scout-treasury-cert.json",
      },
      {
        id: "step-4",
        stepNumber: 4,
        title: "Smart Escrow Vault",
        agentName: "Atlas",
        agentId: "atlas",
        role: "Settlement Runner",
        status: "in_progress",
        description: "Binds 72h auto-release smart contract on X Layer.",
        output: "escrow-vault-contract.sol",
      },
    ],
  },
  {
    id: "pre-listing-gate",
    title: "Free A2MCP Pre-Listing Readiness Gate",
    category: "Ecosystem Security",
    summary: "Automated scan and remediation pipeline before agents are listed on OKX.ai.",
    steps: [
      {
        id: "gate-1",
        stepNumber: 1,
        title: "Submission Intake",
        agentName: "Listing Coach",
        agentId: "listing-coach",
        role: "Builder Advocate",
        status: "completed",
        description: "Inspects incoming builder endpoint URL and payload schema.",
        output: "submission-spec.json",
      },
      {
        id: "gate-2",
        stepNumber: 2,
        title: "Free-MCP Probe",
        agentName: "Markets",
        agentId: "markets",
        role: "Readiness Scanner",
        status: "in_progress",
        description: "Calls scan_free_mcp_readiness to detect Vercel shape or DNS issues.",
        output: "live-readiness-receipt.json",
      },
      {
        id: "gate-3",
        stepNumber: 3,
        title: "Trust Certification",
        agentName: "Spend Scout",
        agentId: "spend-scout",
        role: "Buyer Gatekeeper",
        status: "waiting",
        description: "Issues GO / NO_GO decision card with explicit notChecked boundaries.",
        output: "asp-trust-card.json",
      },
    ],
  },
  {
    id: "dispute-arbitration",
    title: "3-Agent Dispute Arbitration & Jury",
    category: "Decentralized Governance",
    summary: "Multi-agent consensus resolving buyer-seller delivery disagreements.",
    steps: [
      {
        id: "disp-1",
        stepNumber: 1,
        title: "Dispute Intake",
        agentName: "Tuli",
        agentId: "tuli",
        role: "Chief Coordinator",
        status: "completed",
        description: "Logs on-chain transaction hash and delivery complaint receipt.",
        output: "dispute-claim.json",
      },
      {
        id: "disp-2",
        stepNumber: 2,
        title: "Evidence Audit",
        agentName: "Markets",
        agentId: "markets",
        role: "Forensic Analyst",
        status: "in_progress",
        description: "Audits on-chain SLA telemetry against contract delivery timestamp.",
        output: "telemetry-audit.log",
      },
      {
        id: "disp-3",
        stepNumber: 3,
        title: "Arbitration Verdict",
        agentName: "Spend Scout",
        agentId: "spend-scout",
        role: "Jury Lead",
        status: "waiting",
        description: "Votes with 3-agent quorum to release funds or refund treasury.",
        output: "arbitration-verdict.json",
      },
    ],
  },
];

export function TeamMapUseCaseBanner({
  activeScenarioId = "b2b-sourcing",
  onSelectScenario,
  onSelectStepAgent,
  className,
}: {
  activeScenarioId?: string;
  onSelectScenario?: (id: string) => void;
  onSelectStepAgent?: (agentId: string) => void;
  className?: string;
}) {
  const [selectedId, setSelectedId] = useState(activeScenarioId);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const scenario = DEMO_USE_CASES.find((s) => s.id === selectedId) ?? DEMO_USE_CASES[0];

  const handleSelect = (id: string) => {
    setSelectedId(id);
    onSelectScenario?.(id);
    setDropdownOpen(false);
  };

  return (
    <div className={cn("frame-rule-below bg-app px-6 py-3", className)}>
      {/* Top row: Use case title, category, selector dropdown */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center border border-hairline bg-inset text-ink">
            <Sparkles size={14} aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="label-mono text-[10.5px] text-ink">
                {scenario.category} Pipeline
              </span>
              <span className="text-ink-secondary/40">·</span>
              <span className="text-[11px] text-ink-secondary">{scenario.summary}</span>
            </div>
            <h4 className="text-[13.5px] font-semibold text-ink tracking-tight">
              {scenario.title}
            </h4>
          </div>
        </div>

        {/* Switch Scenario Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 border border-hairline bg-inset px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-ink hover:border-ink cursor-pointer"
          >
            <span>Switch Use Case</span>
            <ChevronDown size={13} className={cn("text-ink-secondary transition-transform", dropdownOpen && "rotate-180")} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-72 border border-hairline bg-menu p-1 shadow-2xl">
              <div className="label-mono px-3 py-1.5 text-[10.5px] text-ink-secondary">
                Select Active Use Case
              </div>
              {DEMO_USE_CASES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={cn(
                    "flex w-full flex-col px-3 py-2 text-left text-[12px] transition cursor-pointer",
                    item.id === selectedId
                      ? "bg-raised text-ink font-medium"
                      : "text-ink-secondary hover:bg-raised-hover hover:text-ink"
                  )}
                >
                  <span className="font-semibold text-ink">{item.title}</span>
                  <span className="text-[11px] text-ink-secondary line-clamp-1">{item.summary}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stepper Pipeline: Clean, numbered steps connecting the agents */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {scenario.steps.map((step) => {
          const isCompleted = step.status === "completed";
          const isBlocked = step.status === "blocked";
          const isInProgress = step.status === "in_progress";
          const isWaiting = step.status === "waiting";

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onSelectStepAgent?.(step.agentId)}
              className={cn(
                "group relative flex flex-col border p-2.5 text-left transition-colors cursor-pointer",
                isBlocked
                  ? "border-danger bg-danger/10 hover:border-danger hover:bg-danger/15"
                  : isCompleted
                    ? "border-success/40 bg-success/5 hover:border-success"
                    : isInProgress
                      ? "border-accent bg-raised hover:border-ink"
                      : "border-hairline bg-card hover:border-ink-secondary hover:bg-raised-hover"
              )}
            >
              {/* Step number badge & status */}
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-mono text-[11px] font-semibold text-ink-secondary">
                  0{step.stepNumber}
                </span>
                <span className="flex items-center gap-1 font-medium">
                  {isCompleted && (
                    <span className="flex items-center gap-1 font-mono text-[10.5px] text-success">
                      <CheckCircle2 size={12} /> Completed
                    </span>
                  )}
                  {isBlocked && (
                    <span className="flex items-center gap-1 font-mono text-[10.5px] text-danger font-semibold animate-pulse">
                      <AlertTriangle size={12} /> Blocked
                    </span>
                  )}
                  {isInProgress && (
                    <span className="flex items-center gap-1 font-mono text-[10.5px] text-ink font-semibold">
                      <Clock size={12} /> In Progress
                    </span>
                  )}
                  {isWaiting && (
                    <span className="flex items-center gap-1 font-mono text-[10.5px] text-ink-secondary">
                      <Clock size={12} /> Queued
                    </span>
                  )}
                </span>
              </div>

              {/* Title & Agent Owner */}
              <div className="mt-1">
                <h5 className="text-[12.5px] font-semibold text-ink">
                  {step.title}
                </h5>
                <p className="text-[11px] text-ink-secondary">
                  Assigned to <span className="text-ink font-medium">{step.agentName}</span> ({step.role})
                </p>
              </div>

              {/* Short explanation */}
              <p className="mt-1 text-[11px] leading-snug text-ink-secondary line-clamp-2">
                {step.description}
              </p>

              {/* Output indicator */}
              <div className="mt-2 flex items-center justify-between frame-rule-above pt-1.5 font-mono text-[10.5px] text-ink-secondary">
                <span className="truncate">📦 {step.output}</span>
                <span className="shrink-0 text-ink group-hover:underline">Inspect &rarr;</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
