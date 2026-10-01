import { Check, Copy, Link2, Loader2, RefreshCw, UserPlus } from "lucide-react";
import { useId, useRef, useState } from "react";

import {
  checkLabel,
  formatGateLastRunSummary,
  OKX_PRODUCTION_FREE_MCP_URL,
  type ReadinessRunCardData,
} from "@/lib/okx-action-cards";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { relativeTime } from "@/lib/memory";
import { Frame } from "@/components/ui/frame";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";

/** A verdict-first transcript card for one settled `scan_free_mcp_readiness`
 * result. CTAs fill the composer or re-queue a scan; they never invent a
 * verdict. Disable while a Markets tool call is in flight. */
export function ReadinessRunCard({
  data,
  onRescan,
  onApplyHost,
  onCloneAgent,
  busy = false,
  ranAt,
}: {
  data: ReadinessRunCardData;
  onRescan?: (endpointUrl: string) => void;
  /** Pastes the known-good Railway Free-MCP URL into the host/endpoint field. */
  onApplyHost?: (hostUrl: string) => void;
  /** Clone/import this agent into the workspace team. */
  onCloneAgent?: (agentId: string) => Promise<void> | void;
  /** True while a Markets / Free-MCP tool call is in flight. */
  busy?: boolean;
  /** Transcript message time for the last-run age line. */
  ranAt?: number;
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedEvidence, setCopiedEvidence] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloned, setCloned] = useState(false);
  const evidenceId = useId();
  const actionLocked = useRef(false);
  const lastRunSummary = formatGateLastRunSummary(
    data.lastRun,
    ranAt,
    typeof ranAt === "number" ? relativeTime(ranAt) : undefined,
  );
  const verdictTone =
    data.verdict === "PASS"
      ? "success"
      : data.verdict === "FAIL"
        ? "danger"
        : "warning";

  const passedChecks = data.checks.filter((c) => c.status === "pass").length;
  const warnedChecks = data.checks.filter((c) => c.status === "warn").length;
  const failedChecks = data.checks.filter((c) => c.status === "fail").length;
  const runOnce = (action: () => void) => {
    if (busy || actionLocked.current) return;
    actionLocked.current = true;
    action();
    window.setTimeout(() => {
      actionLocked.current = false;
    }, 500);
  };

  const copyFixes = async () => {
    if (data.remediation.length === 0) return;
    try {
      await navigator.clipboard?.writeText(data.remediation.join("\n"));
      setCopied(true);
    } catch {
      // Clipboard access is best-effort; the visible fixes remain selectable.
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

  const accessVal = data.resource?.access
    ? data.resource.access.charAt(0).toUpperCase() + data.resource.access.slice(1)
    : "Free";
  const paymentVal = data.resource?.paymentRequired ? "Yes" : "No";
  const walletVal = data.resource?.walletRequired ? "Yes" : "No";
  const mainnetVal = data.resource?.mainnet ? "Yes" : "No";
  const sourceVal =
    data.resource?.provenance ||
    "kind-meitner live HTTPS probes + public listing pitfalls";
  return (
    <Frame
      as="section"
      aria-label={t("okxGate.readiness.aria", { verdict: data.verdict })}
      title={t("okxGate.readiness.title")}
      index="01"
      surface="app"
      className="w-full max-w-[min(42rem,88%)] bg-card p-4 overflow-hidden"
    >
      <div className="flex items-start gap-3">
        <Tag
          tone={verdictTone}
          variant="solid"
          size="lg"
          aria-label={t("okxGate.readiness.verdict", { verdict: data.verdict })}
        >
          {data.verdict}
        </Tag>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-medium text-ink">{t("okxGate.readiness.title")}</h3>
            {data.score !== undefined && (
              <span className="label-mono text-ink-secondary">
                [{t("okxGate.readiness.score", { score: data.score })}]
              </span>
            )}
          </div>
          <p title={data.endpointUrl} className="font-mono text-[11px] text-ink-secondary truncate break-all mt-0.5">
            {data.endpointUrl}
          </p>
          <p className="font-mono text-[11px] text-ink-secondary mt-0.5">
            {t("okxGate.readiness.counts", {
              passed: passedChecks,
              warned: warnedChecks,
              failed: failedChecks,
            })}
          </p>
          {lastRunSummary && (
            <p className="font-mono text-[11px] text-ink-secondary mt-0.5">
              <time dateTime={typeof ranAt === "number" ? new Date(ranAt).toISOString() : undefined}>
                {t("okxGate.lastRun.label", { summary: lastRunSummary })}
              </time>
            </p>
          )}
        </div>
      </div>

      <div className="frame-rule my-3" />

      <ul aria-label={t("okxGate.readiness.checks")} className="space-y-1.5 font-mono text-[11px]">
        {data.checks.map((check) => {
          const glyph = check.status === "pass" ? "✓" : check.status === "fail" ? "✕" : "!";
          const tone = check.status === "pass" ? "text-success" : check.status === "fail" ? "text-danger" : "text-warning";
          return (
            <li
              key={`${check.id}:${check.detail}`}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2 text-[12px] leading-relaxed"
            >
              <span aria-hidden="true" className={cn("w-3.5 shrink-0 font-bold", tone)}>
                {glyph}
              </span>
              <span className={cn("min-w-0", check.status === "fail" ? "font-medium text-ink" : "text-ink-secondary")}>
                {checkLabel(check)} <span className="text-ink-secondary">· {check.detail}</span>
              </span>
              <span className={cn("uppercase text-[10px] font-semibold", tone)}>{check.status}</span>
            </li>
          );
        })}
      </ul>

      {data.remediation.length > 0 && (
        <>
          <div className="frame-rule my-3" />
          <div>
            <h4 className="label-mono text-ink mb-1.5">{t("okxGate.readiness.fix")}</h4>
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
        </>
      )}

      <div className="frame-rule my-3" />

      <div className="border border-hairline bg-inset p-2.5 font-mono text-[11px] space-y-1">
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

      <div className="frame-rule my-3" />

      <p className="font-mono text-[10.5px] text-ink-secondary leading-relaxed">
        {t("okxGate.readiness.disclaimer")}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant={data.verdict === "FAIL" ? "primary" : "secondary"}
          size="sm"
          disabled={busy || !onApplyHost}
          onClick={() => runOnce(() => onApplyHost?.(OKX_PRODUCTION_FREE_MCP_URL))}
          aria-label={t("okxGate.readiness.applyHost")}
        >
          <Link2 size={12} aria-hidden="true" />
          {t("okxGate.readiness.applyHost")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={data.remediation.length === 0 || busy}
          onClick={() => void copyFixes()}
          aria-label={t("okxGate.readiness.copyFixes")}
        >
          <Copy size={12} aria-hidden="true" />
          {copied ? t("okxGate.copied") : t("okxGate.readiness.copyFixes")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy || !onRescan}
          onClick={() => runOnce(() => onRescan?.(data.endpointUrl))}
          aria-label={t("okxGate.readiness.rescan")}
        >
          <RefreshCw size={12} aria-hidden="true" />
          {t("okxGate.readiness.rescan")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => void copyEvidence()}
          aria-label={t("okxGate.copyEvidence")}
        >
          <Copy size={12} aria-hidden="true" />
          {copiedEvidence ? t("okxGate.copied") : t("okxGate.copyEvidence")}
        </Button>
        <Button
          size="sm"
          onClick={() => setEvidenceOpen((open) => !open)}
          aria-expanded={evidenceOpen}
          aria-controls={evidenceId}
        >
          {t("okxGate.evidence")}
        </Button>
        {onCloneAgent && data.verdict === "PASS" && (
          <Button
            variant={cloned ? "success" : "primary"}
            size="sm"
            disabled={busy || cloned || cloning}
            onClick={async () => {
              if (cloning || cloned) return;
              setCloning(true);
              try {
                await onCloneAgent("13837");
                setCloned(true);
              } catch (err) {
                console.error("Failed to clone agent:", err);
              } finally {
                setCloning(false);
              }
            }}
            aria-label="Clone to Team"
          >
            {cloning ? <Loader2 size={12} className="animate-spin" /> : cloned ? <Check size={12} /> : <UserPlus size={12} />}
            {cloned ? "In Team" : "Clone to Team"}
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
    </Frame>
  );
}
