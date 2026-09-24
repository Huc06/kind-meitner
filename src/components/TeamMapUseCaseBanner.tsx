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
    <div className={cn("border-b border-white/[0.08] bg-[#0E1013]/90 backdrop-blur-md px-6 py-3", className)}>
      {/* Top row: Use case title, category, selector dropdown */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Sparkles size={14} aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                {scenario.category} Pipeline
              </span>
              <span className="text-white/30">·</span>
              <span className="text-[11px] text-white/50">{scenario.summary}</span>
            </div>
            <h4 className="text-[13.5px] font-bold text-white tracking-tight">
              {scenario.title}
            </h4>
          </div>
        </div>

        {/* Switch Scenario Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#16191E] px-3 py-1.5 text-[12px] font-medium text-white/80 transition hover:border-white/[0.18] hover:bg-[#1E222A]"
          >
            <span>Switch Use Case</span>
            <ChevronDown size={13} className={cn("text-white/40 transition-transform", dropdownOpen && "rotate-180")} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-2xl border border-white/[0.1] bg-[#15181E] p-1.5 shadow-2xl backdrop-blur-xl">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Select Active Use Case
              </div>
              {DEMO_USE_CASES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={cn(
                    "flex w-full flex-col rounded-xl px-3 py-2 text-left text-[12px] transition",
                    item.id === selectedId
                      ? "bg-white/[0.08] text-white font-medium"
                      : "text-white/70 hover:bg-white/[0.04] hover:text-white"
                  )}
                >
                  <span className="font-semibold">{item.title}</span>
                  <span className="text-[11px] text-white/40 line-clamp-1">{item.summary}</span>
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
                "group relative flex flex-col rounded-xl border p-2.5 text-left transition backdrop-blur-sm cursor-pointer",
                isBlocked
                  ? "border-danger/60 bg-danger/10 hover:border-danger hover:bg-danger/15"
                  : isCompleted
                    ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50 hover:bg-emerald-500/10"
                    : isInProgress
                      ? "border-accent/60 bg-accent/10 hover:border-accent hover:bg-accent/15"
                      : "border-white/[0.06] bg-[#16191E]/60 hover:border-white/[0.14] hover:bg-[#1A1E24]"
              )}
            >
              {/* Step number badge & status */}
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-mono font-bold text-white/40">
                  0{step.stepNumber}
                </span>
                <span className="flex items-center gap-1 font-medium">
                  {isCompleted && (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 size={12} /> Completed
                    </span>
                  )}
                  {isBlocked && (
                    <span className="flex items-center gap-1 text-danger font-bold animate-pulse">
                      <AlertTriangle size={12} /> Blocked
                    </span>
                  )}
                  {isInProgress && (
                    <span className="flex items-center gap-1 text-accent font-semibold">
                      <Clock size={12} /> In Progress
                    </span>
                  )}
                  {isWaiting && (
                    <span className="flex items-center gap-1 text-white/40">
                      <Clock size={12} /> Queued
                    </span>
                  )}
                </span>
              </div>

              {/* Title & Agent Owner */}
              <div className="mt-1">
                <h5 className="text-[12.5px] font-bold text-white/95 group-hover:text-accent transition-colors">
                  {step.title}
                </h5>
                <p className="text-[11px] font-medium text-white/60">
                  Assigned to <span className="text-white font-semibold">{step.agentName}</span> ({step.role})
                </p>
              </div>

              {/* Short explanation */}
              <p className="mt-1 text-[11px] leading-snug text-white/45 line-clamp-2">
                {step.description}
              </p>

              {/* Output indicator */}
              <div className="mt-2 flex items-center justify-between border-t border-white/[0.04] pt-1.5 text-[10px] text-white/40">
                <span className="truncate font-mono">📦 {step.output}</span>
                <span className="shrink-0 text-accent group-hover:translate-x-0.5 transition-transform">Inspect &rarr;</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
