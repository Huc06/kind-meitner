import { useState } from "react";
import {
  Scale,
  ShieldCheck,
  AlertOctagon,
  CheckCircle2,
  Coins,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Frame } from "@/components/ui/frame";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { Eyebrow } from "@/components/ui/eyebrow";

export interface DisputeCardData {
  disputeId: string;
  taskId: string;
  verdict: "PASS" | "PARTIAL_REFUND" | "FULL_REFUND";
  rubric: {
    completeness: number;
    correctnessQuality: number;
    specAlignment: number;
    goodFaithEffort: number;
    totalScore: number;
  };
  confidence: number;
  safeToVote: boolean;
  escrowAmount: number;
  feeEarned: number;
  token: string;
  feeClaimed: boolean;
  buyerGrievance: string;
  rationale: string;
  transcript: string;
  timestamp: number;
}

export interface EvaluatorViewProps {
  okbStaked?: number;
  totalFeesEarned?: number;
  disputes?: DisputeCardData[];
  onClaimFee?: (disputeId: string) => Promise<void>;
  onVoteDispute?: (disputeId: string) => Promise<void>;
  className?: string;
}

const DEFAULT_DISPUTES: DisputeCardData[] = [
  {
    disputeId: "disp-101",
    taskId: "task-vault-erc20",
    verdict: "PASS",
    rubric: {
      completeness: 28,
      correctnessQuality: 27,
      specAlignment: 18,
      goodFaithEffort: 18,
      totalScore: 91,
    },
    confidence: 0.88,
    safeToVote: true,
    escrowAmount: 250,
    feeEarned: 12.5,
    token: "USDT",
    feeClaimed: false,
    buyerGrievance: "I decided I wanted a React frontend added as well.",
    rationale: "Deliverable substantially fulfills objective specification. Scope creep from buyer rejected.",
    transcript: "Jury Consensus reached: Full payout awarded to Seller.",
    timestamp: Date.now() - 3600000,
  },
  {
    disputeId: "disp-102",
    taskId: "task-py-scraper",
    verdict: "PARTIAL_REFUND",
    rubric: {
      completeness: 18,
      correctnessQuality: 16,
      specAlignment: 12,
      goodFaithEffort: 14,
      totalScore: 60,
    },
    confidence: 0.72,
    safeToVote: true,
    escrowAmount: 100,
    feeEarned: 5.0,
    token: "USDT",
    feeClaimed: true,
    buyerGrievance: "Script misses 2 out of 5 required tables and has no unit tests.",
    rationale: "Partial utility demonstrated but missing acceptance criteria. 50/50 split ordered.",
    transcript: "Advocates concurred on partial fulfillment.",
    timestamp: Date.now() - 14400000,
  },
  {
    disputeId: "disp-103",
    taskId: "task-rust-indexer",
    verdict: "FULL_REFUND",
    rubric: {
      completeness: 5,
      correctnessQuality: 5,
      specAlignment: 4,
      goodFaithEffort: 5,
      totalScore: 19,
    },
    confidence: 0.94,
    safeToVote: true,
    escrowAmount: 500,
    feeEarned: 25.0,
    token: "USDT",
    feeClaimed: false,
    buyerGrievance: "Code does not compile. Missing all logic.",
    rationale: "Deliverable is non-functional and severely deficient. 100% refund to Buyer.",
    transcript: "Both advocates agreed deliverable failed minimum acceptance criteria.",
    timestamp: Date.now() - 86400000,
  },
];

const VERDICT_TONE: Record<DisputeCardData["verdict"], "success" | "warning" | "danger"> = {
  PASS: "success",
  PARTIAL_REFUND: "warning",
  FULL_REFUND: "danger",
};

export function EvaluatorView({
  okbStaked = 100,
  totalFeesEarned = 42.5,
  disputes = DEFAULT_DISPUTES,
  onClaimFee,
  onVoteDispute: _onVoteDispute,
  className,
}: EvaluatorViewProps) {
  const [selectedDisputeId, setSelectedDisputeId] = useState<string>(
    disputes[0]?.disputeId ?? "",
  );
  const [claiming, setClaiming] = useState<Record<string, boolean>>({});
  const [claimError, setClaimError] = useState<string | null>(null);

  const activeDispute = disputes.find((d) => d.disputeId === selectedDisputeId) ?? disputes[0];

  const handleClaim = async (disputeId: string) => {
    if (!onClaimFee) return;
    setClaimError(null);
    setClaiming((prev) => ({ ...prev, [disputeId]: true }));
    try {
      await onClaimFee(disputeId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to claim fee. Please try again.";
      setClaimError(message);
    } finally {
      setClaiming((prev) => ({ ...prev, [disputeId]: false }));
    }
  };

  return (
    <div className={cn("flex flex-col h-full overflow-y-auto bg-app text-ink", className)}>
      {/* View Header */}
      <header className="h-11 shrink-0 frame-rule-below bg-app px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Scale className="size-4 text-ink-secondary shrink-0" />
          <h1 className="text-sm font-medium text-ink truncate">OKX Dispute Resolution Evaluator ASP</h1>
          <span aria-hidden className="h-3 w-px bg-hairline" />
          <span className="label-mono text-ink-secondary truncate hidden md:inline">
            Autonomous 3-agent jury consensus (Buyer Advocate, Seller Advocate, Chief Arbiter)
          </span>
        </div>
      </header>

      <div className="p-4 space-y-4 flex-1 flex flex-col">
        {/* Error Alert Banner */}
        {claimError && (
          <div
            role="alert"
            className="flex items-center justify-between border border-danger/40 bg-danger/10 p-3 text-xs text-danger"
          >
            <span className="flex items-center gap-2">
              <AlertOctagon size={14} className="shrink-0" />
              <span>{claimError}</span>
            </span>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setClaimError(null)}
              className="text-danger hover:text-danger"
            >
              ✕
            </Button>
          </div>
        )}

        {/* Staking & Safeguard Notice Banner */}
        <Frame title="STAKING & SAFEGUARDS" index="01" surface="app" className="bg-card p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="label-mono text-ink-secondary">OKB Stake Protection</div>
              <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-success flex items-center gap-1.5">
                <ShieldCheck size={16} />
                {okbStaked} OKB Staked
              </div>
            </div>

            <div>
              <div className="label-mono text-ink-secondary">Dispute Fees Earned</div>
              <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-accent flex items-center gap-1.5">
                <Coins size={16} />
                ${totalFeesEarned.toFixed(2)} USDT
              </div>
            </div>
          </div>
        </Frame>

        {/* Two-Column Layout: Disputes Feed & Deliberation Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
          {/* Left: Disputes Feed */}
          <div className="space-y-2 lg:col-span-1">
            <Eyebrow index="02">Disputes Deliberated ({disputes.length})</Eyebrow>
            <div className="space-y-2">
              {disputes.length === 0 && (
                <Frame title="DISPUTES" index="01" surface="app" className="bg-card p-6 text-center text-xs text-ink-secondary">
                  No disputes on record.
                </Frame>
              )}
              {disputes.map((d) => {
                const isSelected = selectedDisputeId === d.disputeId;
                return (
                  <div
                    key={d.disputeId}
                    onClick={() => setSelectedDisputeId(d.disputeId)}
                    className={cn(
                      "border p-3 cursor-pointer transition-colors duration-150 space-y-2 text-xs",
                      isSelected
                        ? "border-ink bg-raised shadow-[inset_2px_0_0_var(--color-ink)]"
                        : "border-hairline bg-card hover:bg-raised-hover",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-ink">{d.disputeId}</span>
                      <Tag tone={VERDICT_TONE[d.verdict] ?? "neutral"} variant="solid" size="sm">
                        {d.verdict}
                      </Tag>
                    </div>

                    <div className="text-xs text-ink-secondary truncate">
                      Task: <span className="font-mono text-ink">{d.taskId}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-ink-secondary">
                        Score: <strong className="font-mono tabular-nums text-ink">{d.rubric.totalScore}/100</strong>
                      </span>
                      <span className="font-mono tabular-nums text-accent font-medium">
                        +{d.feeEarned} {d.token} Fee
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 frame-rule-above text-[10px] text-ink-secondary font-mono">
                      <span className="flex items-center gap-1">
                        {d.safeToVote ? (
                          <span className="text-success flex items-center gap-0.5">
                            <CheckCircle2 size={11} /> Safe
                          </span>
                        ) : (
                          <span className="text-danger flex items-center gap-0.5">
                            <AlertOctagon size={11} /> Withheld
                          </span>
                        )}
                        · {(d.confidence * 100).toFixed(0)}% Conf
                      </span>
                      <span>{new Date(d.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Deliberation Panel with 3 Jurors & 4-Dimension Rubric */}
          {activeDispute ? (
            <div className="lg:col-span-2 border border-hairline bg-card p-4 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 frame-rule-below pb-3">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      Dispute Details: <span className="font-mono text-accent">{activeDispute.disputeId}</span>
                    </h3>
                    <div className="text-xs text-ink-secondary mt-0.5">
                      Associated Task: <span className="font-mono text-ink">{activeDispute.taskId}</span> · Escrow:{" "}
                      <strong className="font-mono tabular-nums text-ink">
                        {activeDispute.escrowAmount} {activeDispute.token}
                      </strong>
                    </div>
                  </div>

                  <Button
                    variant={activeDispute.feeClaimed ? "secondary" : "primary"}
                    size="sm"
                    disabled={activeDispute.feeClaimed || claiming[activeDispute.disputeId]}
                    onClick={() => handleClaim(activeDispute.disputeId)}
                    className="gap-1.5"
                  >
                    <Coins size={13} />
                    {activeDispute.feeClaimed ? "Fee Claimed" : `Claim Fee (${activeDispute.feeEarned} ${activeDispute.token})`}
                  </Button>
                </div>

                {/* 4-Dimension Rubric Breakdown with square score bars */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { label: "Completeness", score: activeDispute.rubric.completeness, max: 30 },
                    { label: "Quality & Tests", score: activeDispute.rubric.correctnessQuality, max: 30 },
                    { label: "Spec Alignment", score: activeDispute.rubric.specAlignment, max: 20 },
                    { label: "Good Faith", score: activeDispute.rubric.goodFaithEffort, max: 20 },
                  ].map((r) => (
                    <div key={r.label} className="border border-hairline bg-inset/40 p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <span className="label-mono text-ink-secondary truncate">{r.label}</span>
                        <span className="font-mono tabular-nums font-semibold text-ink shrink-0">
                          {r.score}/{r.max}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-inset border border-hairline overflow-hidden">
                        <div
                          className="h-full bg-accent transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, (r.score / r.max) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* 3 Jurors as Indexed Frames */}
                <div className="space-y-3">
                  <Frame title="BUYER ADVOCATE" index="01" surface="card" className="bg-raised/20 p-3 space-y-1 text-xs">
                    <div className="label-mono text-ink-secondary">Buyer Rejection Grievance:</div>
                    <div className="text-ink italic leading-relaxed">"{activeDispute.buyerGrievance}"</div>
                  </Frame>

                  <Frame title="SELLER ADVOCATE" index="02" surface="card" className="bg-raised/20 p-3 space-y-1 text-xs">
                    <div className="label-mono text-ink-secondary">Seller Defense & Submission:</div>
                    <div className="text-ink leading-relaxed">
                      Deliverable provided under task <span className="font-mono text-ink">{activeDispute.taskId}</span> with verified escrow of{" "}
                      <span className="font-mono text-ink">{activeDispute.escrowAmount} {activeDispute.token}</span>.
                    </div>
                  </Frame>

                  <Frame title="CHIEF ARBITER" index="03" surface="card" className="bg-raised/20 p-3 space-y-1 text-xs">
                    <div className="label-mono text-ink-secondary">Chief Arbiter Assessment & Rationale:</div>
                    <div className="text-ink leading-relaxed">{activeDispute.rationale}</div>
                  </Frame>
                </div>

                {/* Full Deliberation Audit Log */}
                <div className="space-y-1.5">
                  <div className="label-mono text-ink-secondary">
                    Auditable Deliberation Transcript
                  </div>
                  <pre className="border border-hairline bg-inset p-3 text-[11px] font-mono whitespace-pre-wrap leading-relaxed max-h-44 overflow-y-auto text-ink">
                    {activeDispute.transcript}
                  </pre>
                </div>
              </div>

              {/* Slashing Protection Status Footer & Consensus Meter */}
              <div className="pt-3 frame-rule-above flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-ink-secondary">
                  <ShieldCheck size={14} className={activeDispute.safeToVote ? "text-success" : "text-danger"} />
                  Slashing Protection:{" "}
                  <strong className={activeDispute.safeToVote ? "text-success font-medium" : "text-danger font-medium"}>
                    {activeDispute.safeToVote ? "Safe to Broadcast (Consensus Reached)" : "Vote Withheld"}
                  </strong>
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="label-mono text-ink-secondary">Consensus:</span>
                    <div className="h-2 w-20 bg-inset border border-hairline overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all duration-300",
                          activeDispute.confidence >= 0.65 ? "bg-accent" : "bg-danger",
                        )}
                        style={{ width: `${Math.min(100, Math.max(0, activeDispute.confidence * 100))}%` }}
                      />
                    </div>
                  </div>
                  <span className="font-mono tabular-nums text-[11px] text-ink-secondary">
                    {(activeDispute.confidence * 100).toFixed(1)}% (Threshold: 65%)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <Frame
              title="EMPTY"
              surface="app"
              className="lg:col-span-2 bg-card p-8 flex flex-col items-center justify-center text-center space-y-3 min-h-[350px]"
            >
              <div className="size-10 border border-hairline bg-raised flex items-center justify-center text-ink-secondary">
                <Scale size={20} />
              </div>
              <h3 className="text-sm font-semibold text-ink">No Disputes on Record</h3>
              <p className="text-xs text-ink-secondary max-w-sm leading-relaxed">
                There are currently no dispute deliberations to evaluate. New dispute claims from the OKX marketplace will appear here automatically.
              </p>
            </Frame>
          )}
        </div>
      </div>
    </div>
  );
}
