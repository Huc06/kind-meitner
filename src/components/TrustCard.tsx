import { AlertTriangle, Ban, Check, Copy, Loader2, Play, RefreshCw, UserPlus, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import {
  checkLabel,
  formatGateLastRunSummary,
  type GateSignal,
  type TrustCardData,
} from "@/lib/okx-action-cards";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { relativeTime } from "@/lib/memory";

function statusTone(status: GateSignal["status"]): string {
  return status === "pass" ? "text-success" : status === "fail" ? "text-danger" : "text-warning";
}

function StatusIcon({ status }: { status: GateSignal["status"] }) {
  const className = cn("size-3.5 shrink-0", statusTone(status));
  if (status === "pass") return <Check aria-hidden="true" className={className} />;
  if (status === "fail") return <X aria-hidden="true" className={className} />;
  return <AlertTriangle aria-hidden="true" className={className} />;
}

const btnClass =
  "cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-hairline/50 bg-panel px-2.5 py-1 text-[12px] font-medium text-ink-secondary hover:bg-raised-hover hover:text-ink transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45";

/** A transcript card for one settled `get_asp_trust_card` result. CTAs fill
 * the next buyer turn from server evidence; the card never invents GO. */
export function TrustCard({
  data,
  onBlockSpend,
  onContinue,
  onRecheck,
  onCloneAgent,
  busy = false,
  ranAt,
}: {
  data: TrustCardData;
  onBlockSpend?: (agentId: string) => void;
  /** Enabled only when decision === GO. */
  onContinue?: (agentId: string) => void;
  onRecheck?: (agentId: string) => void;
  /** Clone/import this agent into the workspace team. */
  onCloneAgent?: (agentId: string) => Promise<void> | void;
  /** True while a Markets / Free-MCP tool call is in flight. */
  busy?: boolean;
  /** Transcript message time for the last-run age line. */
  ranAt?: number;
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloned, setCloned] = useState(false);
  const evidenceId = useId();
  const actionLocked = useRef(false);
  const continueEnabled = data.decision === "GO" && !busy && Boolean(onContinue);
  const showBlockSpend = data.decision === "NO_GO" || data.decision === "CAUTION";
  const lastRunSummary = formatGateLastRunSummary(
    data.lastRun,
    ranAt,
    typeof ranAt === "number" ? relativeTime(ranAt) : undefined,
  );
  const decisionTone =
    data.decision === "GO"
      ? "bg-success/15 text-success"
      : data.decision === "NO_GO"
        ? "bg-danger/15 text-danger"
        : "bg-warning/15 text-warning";

  const runOnce = (action: () => void) => {
    if (busy || actionLocked.current) return;
    actionLocked.current = true;
    action();
    window.setTimeout(() => {
      actionLocked.current = false;
    }, 500);
  };

  const copyNextStep = async () => {
    try {
      await navigator.clipboard?.writeText(data.safeNextStep);
      setCopied(true);
    } catch {
      // Clipboard access is best-effort; the next step stays visible.
    }
  };

  return (
    <section
      aria-label={t("okxGate.trust.aria", { decision: data.decision })}
      className="w-full max-w-[min(42rem,88%)] rounded-2xl bg-raised px-4 py-3.5 ring-1 ring-hairline"
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-label={t("okxGate.trust.decision", { decision: data.decision })}
          className={cn("rounded-full px-2 py-0.5 text-[12px] font-bold", decisionTone)}
        >
          {data.decision}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-medium text-ink">
            {data.agentName ? `${data.agentName} (#${data.agentId})` : t("okxGate.trust.title")}
          </h3>
          <p className="mt-0.5 text-[12px] text-ink-secondary">
            {data.agentName
              ? `OKX.ai Marketplace Agent${data.score ? ` · ⭐ ${data.score}/5.0` : ""}`
              : t("okxGate.trust.agent", { agentId: data.agentId })}
          </p>
          {lastRunSummary && (
            <p className="mt-1 text-[11.5px] text-ink-secondary">
              {t("okxGate.lastRun.label", { summary: lastRunSummary })}
            </p>
          )}
        </div>
      </div>
      <p className="mt-3 border-t border-hairline/70 pt-3 text-[12px] leading-relaxed text-ink-secondary">
        {data.summary}
      </p>
      {data.services && data.services.length > 0 && (
        <div className="mt-2.5 rounded-xl border border-hairline/60 bg-inset/50 p-2.5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-secondary">
            Verified Services on OKX ({data.services.length})
          </div>
          <div className="mt-1.5 space-y-1">
            {data.services.slice(0, 3).map((s) => (
              <div key={s.serviceId} className="flex items-center justify-between text-[11.5px] text-ink">
                <span className="truncate">{s.name}</span>
                <span className="ml-2 shrink-0 font-mono text-[10.5px] text-ink-secondary">{s.price} USDT</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <ul aria-label={t("okxGate.trust.signals")} className="mt-2 space-y-1.5">
        {data.signals.map((signal) => (
          <li key={`${signal.id}:${signal.detail}`} className="flex items-start gap-2 text-[12px] leading-relaxed">
            <StatusIcon status={signal.status} />
            <span className="min-w-0 text-ink-secondary">
              <span className={signal.status === "fail" ? "font-medium text-ink" : undefined}>
                {checkLabel(signal)}
              </span>{" "}
              · {signal.detail}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 border-t border-hairline/70 pt-3">
        <h4 className="text-[12px] font-medium text-ink">{t("okxGate.trust.notChecked")}</h4>
        <ul aria-label={t("okxGate.trust.notChecked")} className="mt-1.5 flex flex-wrap gap-1.5">
          {data.notChecked.map((item) => (
            <li key={item} className="rounded-full bg-inset px-2 py-0.5 text-[11px] text-ink-secondary">
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 border-t border-hairline/70 pt-3">
        <p className="text-[12px] leading-relaxed text-ink">
          <span className="font-medium">{t("okxGate.trust.next")}</span> {data.safeNextStep}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-hairline/70 pt-3">
        {showBlockSpend && (
          <button
            type="button"
            disabled={busy || !onBlockSpend}
            onClick={() => runOnce(() => onBlockSpend?.(data.agentId))}
            aria-label={t("okxGate.trust.blockSpend")}
            className={btnClass}
          >
            <Ban size={13} aria-hidden="true" />
            {t("okxGate.trust.blockSpend")}
          </button>
        )}
        <button
          type="button"
          disabled={!continueEnabled}
          onClick={() => runOnce(() => onContinue?.(data.agentId))}
          aria-label={t("okxGate.trust.continueFree")}
          className={btnClass}
        >
          <Play size={13} aria-hidden="true" />
          {t("okxGate.trust.continueFree")}
        </button>
        <button
          type="button"
          disabled={busy || !onRecheck}
          onClick={() => runOnce(() => onRecheck?.(data.agentId))}
          aria-label={t("okxGate.trust.recheck")}
          className={btnClass}
        >
          <RefreshCw size={13} aria-hidden="true" />
          {t("okxGate.trust.recheck")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void copyNextStep()}
          aria-label={t("okxGate.trust.copyNext")}
          className={btnClass}
        >
          <Copy size={13} aria-hidden="true" />
          {copied ? t("okxGate.copied") : t("okxGate.trust.copyNext")}
        </button>
        <button
          type="button"
          onClick={() => setEvidenceOpen((open) => !open)}
          aria-expanded={evidenceOpen}
          aria-controls={evidenceId}
          className="rounded-md px-2 py-1 text-[12px] font-medium text-ink-secondary hover:bg-inset hover:text-ink"
        >
          {t("okxGate.evidence")}
        </button>
        {onCloneAgent && (
          <button
            type="button"
            disabled={busy || cloned || cloning}
            onClick={async () => {
              if (cloning || cloned) return;
              setCloning(true);
              try {
                await onCloneAgent(data.agentId);
                setCloned(true);
              } catch (err) {
                console.error("Failed to clone agent:", err);
              } finally {
                setCloning(false);
              }
            }}
            aria-label="Clone to Team"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-all",
              cloned
                ? "bg-success/15 text-success border border-success/30"
                : "bg-accent text-white hover:brightness-110 shadow-sm",
            )}
          >
            {cloning ? <Loader2 size={13} className="animate-spin" /> : cloned ? <Check size={13} /> : <UserPlus size={13} />}
            {cloned ? "In Team" : "Clone to Team"}
          </button>
        )}
      </div>
      {evidenceOpen && (
        <pre
          id={evidenceId}
          className="mt-2 max-h-60 overflow-auto rounded-lg bg-inset p-2.5 text-xs whitespace-pre-wrap break-words text-ink"
        >
          {data.rawJson}
        </pre>
      )}
    </section>
  );
}
