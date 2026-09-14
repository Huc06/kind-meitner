import { useState } from "react";
import {
  Scale,
  ShieldCheck,
  AlertOctagon,
  CheckCircle2,
  Coins,
} from "lucide-react";
import { cn } from "@/lib/cn";

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

  const verdictBadge = (verdict: DisputeCardData["verdict"]) => {
    switch (verdict) {
      case "PASS":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "PARTIAL_REFUND":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "FULL_REFUND":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
    }
  };

  return (
    <div className={cn("flex flex-col h-full overflow-y-auto p-4 space-y-4 bg-panel text-ink", className)}>
      {/* Error Alert Banner */}
      {claimError && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-500"
        >
          <span className="flex items-center gap-2">
            <AlertOctagon size={14} className="shrink-0" />
            <span>{claimError}</span>
          </span>
          <button
            type="button"
            onClick={() => setClaimError(null)}
            className="text-rose-400 hover:text-rose-300 font-bold ml-2 text-xs"
          >
            ✕
          </button>
        </div>
      )}
      {/* Top Header & Staking Safeguard Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline/40 pb-3">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Scale className="text-accent" size={18} />
            OKX Dispute Resolution Evaluator ASP
          </h2>
          <p className="text-xs text-ink-secondary">
            Autonomous 3-agent jury consensus (Buyer Advocate, Seller Advocate, Chief Arbiter)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-hairline/40 bg-card px-3 py-1.5 text-center">
            <div className="text-[10px] uppercase font-semibold text-ink-secondary">OKB Stake Protection</div>
            <div className="text-sm font-bold text-emerald-500 flex items-center justify-center gap-1">
              <ShieldCheck size={14} />
              {okbStaked} OKB Staked
            </div>
          </div>

          <div className="rounded-lg border border-hairline/40 bg-card px-3 py-1.5 text-center">
            <div className="text-[10px] uppercase font-semibold text-ink-secondary">Dispute Fees Earned</div>
            <div className="text-sm font-bold text-accent flex items-center justify-center gap-1">
              <Coins size={14} />
              ${totalFeesEarned.toFixed(2)} USDT
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left feed, Right inspection transcript */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        {/* Left: Disputes Feed */}
        <div className="space-y-2 lg:col-span-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
            Disputes Deliberated ({disputes.length})
          </h3>
          <div className="space-y-2">
            {disputes.length === 0 && (
              <div className="rounded-xl border border-hairline/40 bg-card p-6 text-center text-xs text-ink-secondary">
                No disputes on record.
              </div>
            )}
            {disputes.map((d) => (
              <div
                key={d.disputeId}
                onClick={() => setSelectedDisputeId(d.disputeId)}
                className={cn(
                  "rounded-xl border p-3 cursor-pointer transition-all space-y-2",
                  selectedDisputeId === d.disputeId
                    ? "border-accent bg-accent/5 shadow-sm"
                    : "border-hairline/40 bg-card hover:bg-raised/40",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-ink">{d.disputeId}</span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      verdictBadge(d.verdict),
                    )}
                  >
                    {d.verdict}
                  </span>
                </div>

                <div className="text-xs text-ink-secondary truncate">
                  Task: <span className="font-mono text-ink">{d.taskId}</span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-ink-secondary">
                    Score: <strong className="text-ink">{d.rubric.totalScore}/100</strong>
                  </span>
                  <span className="font-mono text-accent font-medium">
                    +{d.feeEarned} {d.token} Fee
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-hairline/30 text-[10px] text-ink-secondary">
                  <span className="flex items-center gap-1">
                    {d.safeToVote ? (
                      <span className="text-emerald-500 flex items-center gap-0.5">
                        <CheckCircle2 size={11} /> Safe
                      </span>
                    ) : (
                      <span className="text-rose-500 flex items-center gap-0.5">
                        <AlertOctagon size={11} /> Withheld
                      </span>
                    )}
                    · {(d.confidence * 100).toFixed(0)}% Conf
                  </span>
                  <span>{new Date(d.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Deliberation Transcript & Rubric Detail */}
        {activeDispute ? (
          <div className="lg:col-span-2 rounded-xl border border-hairline/40 bg-card p-4 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline/30 pb-3">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    Dispute Details: <span className="font-mono text-accent">{activeDispute.disputeId}</span>
                  </h3>
                  <div className="text-xs text-ink-secondary">
                    Associated Task: <span className="font-mono">{activeDispute.taskId}</span> · Escrow:{" "}
                    <strong>
                      {activeDispute.escrowAmount} {activeDispute.token}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={activeDispute.feeClaimed || claiming[activeDispute.disputeId]}
                    onClick={() => handleClaim(activeDispute.disputeId)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5",
                      activeDispute.feeClaimed
                        ? "bg-raised text-ink-secondary cursor-not-allowed"
                        : "bg-accent text-ink hover:opacity-90",
                    )}
                  >
                    <Coins size={13} />
                    {activeDispute.feeClaimed ? "Fee Claimed" : `Claim Fee (${activeDispute.feeEarned} ${activeDispute.token})`}
                  </button>
                </div>
              </div>

              {/* Rubric Breakdown Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-lg bg-raised/50 p-2.5 text-center">
                  <div className="text-[10px] text-ink-secondary uppercase">Completeness</div>
                  <div className="text-sm font-bold text-ink">{activeDispute.rubric.completeness}/30</div>
                </div>
                <div className="rounded-lg bg-raised/50 p-2.5 text-center">
                  <div className="text-[10px] text-ink-secondary uppercase">Quality & Tests</div>
                  <div className="text-sm font-bold text-ink">{activeDispute.rubric.correctnessQuality}/30</div>
                </div>
                <div className="rounded-lg bg-raised/50 p-2.5 text-center">
                  <div className="text-[10px] text-ink-secondary uppercase">Spec Alignment</div>
                  <div className="text-sm font-bold text-ink">{activeDispute.rubric.specAlignment}/20</div>
                </div>
                <div className="rounded-lg bg-raised/50 p-2.5 text-center">
                  <div className="text-[10px] text-ink-secondary uppercase">Good Faith</div>
                  <div className="text-sm font-bold text-ink">{activeDispute.rubric.goodFaithEffort}/20</div>
                </div>
              </div>

              {/* Grievance & Ruling */}
              <div className="space-y-2">
                <div className="rounded-lg bg-raised/30 p-3 text-xs space-y-1">
                  <div className="font-semibold text-ink-secondary uppercase text-[10px]">Buyer Rejection Grievance:</div>
                  <div className="text-ink italic">"{activeDispute.buyerGrievance}"</div>
                </div>

                <div className="rounded-lg bg-accent/5 border border-accent/20 p-3 text-xs space-y-1">
                  <div className="font-semibold text-accent uppercase text-[10px]">Chief Arbiter Assessment & Rationale:</div>
                  <div className="text-ink leading-relaxed">{activeDispute.rationale}</div>
                </div>
              </div>

              {/* Full Deliberation Audit Log */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                  Auditable Deliberation Transcript
                </div>
                <pre className="rounded-lg bg-raised/50 p-3 text-[11px] font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto text-ink">
                  {activeDispute.transcript}
                </pre>
              </div>
            </div>

            {/* Slashing Protection Status Footer */}
            <div className="pt-3 border-t border-hairline/30 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-ink-secondary">
                <ShieldCheck size={14} className="text-emerald-500" />
                Slashing Protection:{" "}
                <strong className={activeDispute.safeToVote ? "text-emerald-500" : "text-rose-500"}>
                  {activeDispute.safeToVote ? "Safe to Broadcast (Consensus Reached)" : "Vote Withheld"}
                </strong>
              </span>
              <span className="text-ink-secondary text-[11px]">
                Confidence: {(activeDispute.confidence * 100).toFixed(1)}% (Threshold: 65%)
              </span>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 rounded-xl border border-hairline/40 bg-card p-8 flex flex-col items-center justify-center text-center space-y-3 min-h-[350px]">
            <div className="h-12 w-12 rounded-full bg-raised/50 flex items-center justify-center text-ink-secondary">
              <Scale size={24} />
            </div>
            <h3 className="text-sm font-bold text-ink">No Disputes on Record</h3>
            <p className="text-xs text-ink-secondary max-w-sm">
              There are currently no dispute deliberations to evaluate. New dispute claims from the OKX marketplace will appear here automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
