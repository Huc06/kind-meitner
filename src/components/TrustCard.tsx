import { AlertTriangle, Ban, Check, Copy, Play, RefreshCw, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import { checkLabel, type GateSignal, type TrustCardData } from "@/lib/okx-action-cards";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

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
  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-ink-secondary hover:bg-inset hover:text-ink disabled:cursor-not-allowed disabled:opacity-45";

/** A transcript card for one settled `get_asp_trust_card` result. CTAs fill
 * the next buyer turn from server evidence; the card never invents GO. */
export function TrustCard({
  data,
  onBlockSpend,
  onContinue,
  onRecheck,
  busy = false,
}: {
  data: TrustCardData;
  onBlockSpend?: (agentId: string) => void;
  /** Enabled only when decision === GO. */
  onContinue?: (agentId: string) => void;
  onRecheck?: (agentId: string) => void;
  /** True while a Markets / Free-MCP tool call is in flight. */
  busy?: boolean;
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const evidenceId = useId();
  const actionLocked = useRef(false);
  const continueEnabled = data.decision === "GO" && !busy && Boolean(onContinue);
  const showBlockSpend = data.decision === "NO_GO" || data.decision === "CAUTION";
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
          <h3 className="text-[13px] font-medium text-ink">{t("okxGate.trust.title")}</h3>
          <p className="mt-0.5 text-[12px] text-ink-secondary">
            {t("okxGate.trust.agent", { agentId: data.agentId })}
          </p>
        </div>
      </div>
      <p className="mt-3 border-t border-hairline/70 pt-3 text-[12px] leading-relaxed text-ink-secondary">
        {data.summary}
      </p>
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
