import { Ban, Check, Copy, Loader2, Play, RefreshCw, UserPlus } from "lucide-react";
import { useId, useRef, useState } from "react";

import {
  checkLabel,
  formatGateLastRunSummary,
  type TrustCardData,
} from "@/lib/okx-action-cards";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { relativeTime } from "@/lib/memory";
import { Frame } from "@/components/ui/frame";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";

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
  hideSpendControls = false,
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
  /** Read-only contexts (the Dev Day demo): no spend state or Continue action. */
  hideSpendControls?: boolean;
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedEvidence, setCopiedEvidence] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloned, setCloned] = useState(false);
  const evidenceId = useId();
  const actionLocked = useRef(false);
  const continueEnabled = data.decision === "GO" && !busy && Boolean(onContinue);
  const showBlockSpend = !hideSpendControls && (data.decision === "NO_GO" || data.decision === "CAUTION");
  const lastRunSummary = formatGateLastRunSummary(
    data.lastRun,
    ranAt,
    typeof ranAt === "number" ? relativeTime(ranAt) : undefined,
  );
  const decisionTone =
    data.decision === "GO"
      ? "success"
      : data.decision === "NO_GO"
        ? "danger"
        : "warning";
  const decisionDisplay = data.decision === "NO_GO" ? "NO-GO" : data.decision;
  const isSpendBlocked = data.decision === "NO_GO" || data.decision === "CAUTION";
  const passedSignals = data.signals.filter((s) => s.status === "pass").length;
  const warnedSignals = data.signals.filter((s) => s.status === "warn").length;
  const failedSignals = data.signals.filter((s) => s.status === "fail").length;
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

  const copyEvidence = async () => {
    try {
      let textToCopy = data.rawJson;
      try {
        textToCopy = JSON.stringify(JSON.parse(data.rawJson), null, 2);
      } catch {
        /* fallback to raw string */
      }
      await navigator.clipboard?.writeText(textToCopy);
      setCopiedEvidence(true);
      window.setTimeout(() => setCopiedEvidence(false), 2000);
    } catch {
      // Clipboard access is best-effort.
    }
  };

  const formatBoundaryBool = (value: boolean | undefined): string => {
    if (value === true) return t("okxGate.boundary.yes");
    if (value === false) return t("okxGate.boundary.no");
    return t("okxGate.boundary.unknown");
  };

  const accessVal = data.resource?.access
    ? data.resource.access.charAt(0).toUpperCase() + data.resource.access.slice(1)
    : t("okxGate.boundary.unknown");
  const paymentVal = formatBoundaryBool(data.resource?.paymentRequired);
  const walletVal = formatBoundaryBool(data.resource?.walletRequired);
  const mainnetVal = formatBoundaryBool(data.resource?.mainnet);
  const sourceVal =
    data.resource?.provenance ||
    t("okxGate.trust.provenanceDefault");
  return (
    <Frame
      as="section"
      aria-label={t("okxGate.trust.aria", { decision: data.decision })}
      title={t("okxGate.trust.frameTitle")}
      index="02"
      surface="app"
      className="w-full min-w-0 max-w-[min(42rem,100%)] bg-card p-4 break-words"
    >
      <div className="flex items-start gap-3">
        <Tag
          tone={decisionTone}
          variant="solid"
          size="lg"
          aria-label={t("okxGate.trust.decision", { decision: data.decision })}
        >
          {decisionDisplay}
        </Tag>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-medium text-ink">
              {t("okxGate.trust.title")}
            </h3>
            <span className="label-mono text-ink-secondary">
              {t("okxGate.trust.agentTag", { agentId: data.agentId })}
            </span>
          </div>
          <p className="font-mono text-[11px] text-ink-secondary truncate break-all mt-0.5">
            {data.agentName
              ? `${data.agentName} · ${t("okxGate.trust.agentProvenance")}${data.score ? ` · ⭐ ${data.score}/5.0` : ""}`
              : t("okxGate.trust.agent", { agentId: data.agentId })}
          </p>
          <p className="font-mono text-[11px] text-ink-secondary mt-0.5">
            {t("okxGate.trust.counts", {
              passed: passedSignals,
              warned: warnedSignals,
              failed: failedSignals,
            })}
          </p>
          {lastRunSummary && (
            <p className="font-mono text-[11px] text-ink-secondary mt-0.5">
              <time dateTime={typeof ranAt === "number" ? new Date(ranAt).toISOString() : undefined}>
                {t("okxGate.lastRun.label", { summary: lastRunSummary })}
              </time>
            </p>
          )}
          {data.lastChecked !== undefined && (
            <p className="font-mono text-[11px] text-ink-secondary mt-0.5">
              {t("okxGate.lastChecked", { time: String(data.lastChecked) })}
            </p>
          )}
          {!hideSpendControls && (
          <div className="mt-2 flex items-center gap-2 font-mono text-[11px]">
            <span
              className={cn(
                "size-1.5 rounded-full shrink-0",
                isSpendBlocked ? "bg-danger" : "bg-success",
              )}
            />
            <span className={cn("font-medium", isSpendBlocked ? "text-danger" : "text-success")}>
              {isSpendBlocked ? t("okxGate.trust.spendBlocked") : t("okxGate.trust.spendNotBlocked")}
            </span>
          </div>
          )}
        </div>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-ink-secondary break-words">
        {data.summary}
      </p>
      <div className="frame-rule my-3" />

      <ul aria-label={t("okxGate.trust.signals")} className="space-y-1.5 font-mono text-[11px]">
        {data.signals.map((signal) => {
          const glyph = signal.status === "pass" ? "✓" : signal.status === "fail" ? "✕" : "!";
          const tone = signal.status === "pass" ? "text-success" : signal.status === "fail" ? "text-danger" : "text-warning";
          return (
            <li key={`${signal.id}:${signal.detail}`} className="flex items-start gap-2 text-[12px] leading-relaxed">
              <span aria-hidden="true" className={cn("w-3.5 shrink-0 font-bold", tone)}>
                {glyph}
              </span>
              <span className="min-w-0 text-ink-secondary">
                <span className={signal.status === "fail" ? "font-medium text-ink" : undefined}>
                  {checkLabel(signal)}
                </span>{" "}
                · {signal.detail}
              </span>
              <span className={cn("uppercase text-[10px] font-semibold ml-auto shrink-0", tone)}>{signal.status}</span>
            </li>
          );
        })}
      </ul>

      <div className="frame-rule my-3" />

      <div>
        <h4 className="label-mono text-ink-secondary mb-1.5">{t("okxGate.trust.notChecked")}</h4>
        <ul aria-label={t("okxGate.trust.notChecked")} className="flex flex-wrap gap-1.5">
          {data.notChecked.map((item) => (
            <li key={item}>
              <Tag tone="neutral" variant="outline" size="sm">
                {item}
              </Tag>
            </li>
          ))}
        </ul>
      </div>

      {data.limitations && data.limitations.length > 0 && (
        <div className="mt-2.5">
          <h4 className="label-mono text-ink-secondary mb-1">{t("okxGate.limitations")}</h4>
          <ul className="list-disc pl-4 space-y-0.5 font-mono text-[11px] text-ink-secondary">
            {data.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="frame-rule my-3" />

      <div>
        <p className="text-[12px] leading-relaxed text-ink">
          <span className="label-mono text-ink-secondary mr-2">{t("okxGate.trust.next")}</span>
          <span className="font-mono text-[11.5px]">{data.safeNextStep}</span>
        </p>
      </div>

      {data.remediation.length > 0 && (
        <div className="mt-2">
          <ol className="space-y-1 font-mono text-[11.5px] leading-relaxed text-ink-secondary">
            {data.remediation.map((fix, idx) => (
              <li key={fix} className="flex gap-2">
                <span aria-hidden="true" className="select-none text-ink-secondary">
                  {String(idx + 1).padStart(2, "0")}.
                </span>
                <span>{fix}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="frame-rule my-3" />
      <div className="flex flex-wrap items-center gap-1.5">
        {showBlockSpend && (
          <Button
            variant="danger"
            size="sm"
            disabled={busy || !onBlockSpend}
            onClick={() => runOnce(() => onBlockSpend?.(data.agentId))}
            aria-label={t("okxGate.trust.blockSpend")}
          >
            <Ban size={12} aria-hidden="true" />
            {t("okxGate.trust.blockSpend")}
          </Button>
        )}
        {!hideSpendControls && (
          <Button
            variant={data.decision === "GO" ? "primary" : "secondary"}
            size="sm"
            disabled={!continueEnabled}
            onClick={() => runOnce(() => onContinue?.(data.agentId))}
            aria-label={t("okxGate.trust.continueFree")}
          >
            <Play size={12} aria-hidden="true" />
            {t("okxGate.trust.continueFree")}
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          disabled={busy || !onRecheck}
          onClick={() => runOnce(() => onRecheck?.(data.agentId))}
          aria-label={t("okxGate.trust.recheck")}
        >
          <RefreshCw size={12} aria-hidden="true" />
          {t("okxGate.trust.recheck")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => void copyNextStep()}
          aria-label={t("okxGate.trust.copyNext")}
        >
          <Copy size={12} aria-hidden="true" />
          {copied ? t("okxGate.copied") : t("okxGate.trust.copyNext")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => void copyEvidence()}
          aria-label={t("okxGate.copyEvidence")}
        >
          <Copy size={12} aria-hidden="true" />
          {copiedEvidence ? t("okxGate.evidenceCopied") : t("okxGate.copyEvidence")}
        </Button>
        <Button
          size="sm"
          onClick={() => setEvidenceOpen((open) => !open)}
          aria-expanded={evidenceOpen}
          aria-controls={evidenceId}
        >
          {t("okxGate.evidence")}
        </Button>
        {onCloneAgent && (
          <Button
            variant={cloned ? "success" : "primary"}
            size="sm"
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
            aria-label={t("okxGate.cloneToTeam")}
          >
            {cloning ? <Loader2 size={12} className="animate-spin" /> : cloned ? <Check size={12} /> : <UserPlus size={12} />}
            {cloned ? t("okxGate.inTeam") : t("okxGate.cloneToTeam")}
          </Button>
        )}
      </div>

      {evidenceOpen && (
        <pre
          id={evidenceId}
          className="mt-2.5 max-h-60 overflow-auto border border-hairline bg-inset p-2.5 font-mono text-[11px] whitespace-pre-wrap break-words text-ink"
        >
          {data.rawJson}
        </pre>
      )}

      <details className="mt-3 border border-hairline bg-inset px-2.5 py-2 font-mono text-[11px]">
        <summary className="cursor-pointer label-mono text-ink-secondary hover:text-ink select-none">
          {t("okxGate.details")}
        </summary>
        <div className="pt-2 space-y-3">
          {data.services && data.services.length > 0 && (
            <div>
              <div className="label-mono text-ink-secondary">
                {t("okxGate.trust.servicesTitle", { count: data.services.length })}
              </div>
              <div className="mt-1.5 space-y-1">
                {data.services.slice(0, 3).map((s) => (
                  <div key={s.serviceId} className="flex items-center justify-between font-mono text-[11.5px] text-ink">
                    <span className="truncate">{s.name}</span>
                    <span className="ml-2 shrink-0 text-ink-secondary">{s.price} USDT</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1 border-t border-hairline pt-2">
            <div className="label-mono text-ink-secondary mb-1">
              {t("okxGate.boundary.title")}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-ink-secondary">
              <div>{t("okxGate.boundary.access", { access: accessVal })}</div>
              <div>{t("okxGate.boundary.payment", { required: paymentVal })}</div>
              <div>{t("okxGate.boundary.wallet", { required: walletVal })}</div>
              <div>{t("okxGate.boundary.mainnet", { mainnet: mainnetVal })}</div>
            </div>
            <div className="text-ink-secondary pt-0.5 break-all">
              {t("okxGate.boundary.source", { source: sourceVal })}
            </div>
          </div>
        </div>
      </details>
      <p className="mt-3 font-mono text-[10.5px] text-ink-secondary leading-relaxed">
        {t("okxGate.trust.disclaimer")}
      </p>
    </Frame>
  );
}
