import { Check, Copy, ExternalLink, Loader2, RefreshCw, UserPlus, ChevronDown, ChevronRight } from "lucide-react";
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

/**
 * A transcript and demo card for one settled listing & connection check result.
 * Displays verified public listing information and compatible service connection facts
 * with always-visible scope and limitations.
 */
export function TrustCard({
  data,
  onRecheck,
  onCloneAgent,
  busy = false,
  ranAt,
}: {
  data: TrustCardData;
  onBlockSpend?: (agentId: string) => void;
  onContinue?: (agentId: string) => void;
  onRecheck?: (agentId: string) => void;
  onCloneAgent?: (agentId: string) => Promise<void> | void;
  busy?: boolean;
  ranAt?: number;
  hideSpendControls?: boolean;
}) {
  const [copiedResult, setCopiedResult] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloned, setCloned] = useState(false);
  const [showServices, setShowServices] = useState(false);
  const [runDetailsOpen, setRunDetailsOpen] = useState(false);
  const actionLocked = useRef(false);
  const detailsId = useId();

  const runOnce = (action: () => void) => {
    if (busy || actionLocked.current) return;
    actionLocked.current = true;
    action();
    window.setTimeout(() => {
      actionLocked.current = false;
    }, 500);
  };

  const copyResult = async () => {
    try {
      const lines = [
        `Listing & connection check: Agent #${data.agentId}${data.agentName ? ` (${data.agentName})` : ""}`,
        `Listing: ${data.listingStatus ?? "checked"}`,
        `Connection: ${data.connectionStatus ?? "not checked"}`,
        data.endpointAssociation && data.endpointAssociation !== "none" ? `Endpoint association: ${data.endpointAssociation}` : null,
        `Summary: ${data.summary}`,
        `Scope: Service delivery, output quality and payment outcomes were not assessed.`,
        data.safeNextStep ? `Next: ${data.safeNextStep}` : null,
        data.resource?.provenance ? `Source: ${data.resource.provenance}` : null,
      ].filter(Boolean).join("\n");
      await navigator.clipboard?.writeText(lines);
      setCopiedResult(true);
      window.setTimeout(() => setCopiedResult(false), 2000);
    } catch {}
  };

  const lastRunSummary = formatGateLastRunSummary(
    data.lastRun,
    ranAt,
    typeof ranAt === "number" ? relativeTime(ranAt) : undefined,
  );

  // Listing status derivation
  const listingStatus = data.listingStatus ?? (data.signals.find((s) => s.id === "listing_page")?.status === "pass" ? "found" : data.signals.find((s) => s.id === "listing_page")?.status === "fail" ? "not_found" : "could_not_verify");
  const listingTone = listingStatus === "found" ? "success" : listingStatus === "not_found" ? "danger" : "warning";
  const listingLabel = listingStatus === "found"
    ? t("okxGate.listing.found", { defaultValue: "Listing found" })
    : listingStatus === "not_found"
      ? t("okxGate.listing.notFound", { defaultValue: "Listing not found" })
      : listingStatus === "request_failed"
        ? t("okxGate.listing.requestFailed", { defaultValue: "Listing request failed" })
        : t("okxGate.listing.couldNotVerify", { defaultValue: "Listing unverified" });

  // Connection status derivation
  const connectionStatus = data.connectionStatus ?? (data.signals.find((s) => s.id === "endpoint_readiness" || s.id === "service_connection")?.status === "skipped" ? "not_checked" : data.signals.find((s) => s.id === "endpoint_readiness" || s.id === "service_connection")?.status === "pass" ? "passed" : data.signals.find((s) => s.id === "endpoint_readiness" || s.id === "service_connection")?.status === "fail" ? "failed" : "could_not_verify");
  const connectionTone = connectionStatus === "passed"
    ? "success"
    : connectionStatus === "failed"
      ? "danger"
      : connectionStatus === "could_not_verify"
        ? "warning"
        : "neutral"; // Neutral styling for Not checked and Unsupported
  const connectionLabel = connectionStatus === "not_checked"
    ? t("okxGate.connection.notChecked", { defaultValue: "Connection: Not checked" })
    : connectionStatus === "passed"
      ? t("okxGate.connection.passed", { defaultValue: "Connection: Passed" })
      : connectionStatus === "failed"
        ? t("okxGate.connection.failed", { defaultValue: "Connection: Failed" })
        : connectionStatus === "unsupported"
          ? t("okxGate.connection.unsupported", { defaultValue: "Connection: Unsupported" })
          : t("okxGate.connection.couldNotVerify", { defaultValue: "Connection: Unverified" });

  // Signal counts (including skipped/not checked!)
  const checksList = data.checksPerformed && data.checksPerformed.length > 0 ? data.checksPerformed : data.signals;
  const passedCount = checksList.filter((s) => s.status === "pass").length;
  const skippedCount = checksList.filter((s) => s.status === "skipped").length;
  const failedCount = checksList.filter((s) => s.status === "fail").length;
  const warnedCount = checksList.filter((s) => s.status === "warn").length;

  const listingUrl = data.listingUrl || `https://www.okx.ai/agents/${encodeURIComponent(data.agentId)}`;
  const ratingVal = data.marketplaceRating || data.score;

  return (
    <Frame
      as="section"
      aria-label={`Listing and connection check: Agent #${data.agentId}`}
      title={t("okxGate.featureTitle", { defaultValue: "Listing & connection check" })}
      index="02"
      surface="app"
      className="w-full min-w-0 max-w-[min(42rem,100%)] bg-card p-4 break-words"
    >
      {/* Identity & Status Badges */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {data.avatarUrl ? (
            <img
              src={data.avatarUrl}
              alt=""
              aria-hidden="true"
              className="size-10 rounded-full border border-hairline object-cover shrink-0 mt-0.5"
            />
          ) : (
            <div className="size-10 rounded-full border border-hairline bg-inset flex items-center justify-center font-mono text-xs font-semibold text-ink-secondary shrink-0 mt-0.5">
              #{data.agentId.slice(-3)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-[13px] font-semibold text-ink truncate">
                {data.agentName || `Agent #${data.agentId}`}
              </h3>
              <span className="font-mono text-[11px] text-ink-secondary">
                [#{data.agentId}]
              </span>
            </div>

            {ratingVal && (
              <div className="flex flex-wrap items-center gap-1 mt-0.5 font-mono text-[11px] text-ink-secondary">
                <span className="text-ink font-medium">★ {ratingVal}</span>
                <span>·</span>
                <span>{t("okxGate.marketplaceRating", { defaultValue: "Marketplace rating" })}</span>
                {typeof data.reviewCount === "number" && (
                  <>
                    <span>·</span>
                    <span>{data.reviewCount} {data.reviewCount === 1 ? "review" : "reviews"}</span>
                  </>
                )}
              </div>
            )}

            {lastRunSummary && (
              <p className="font-mono text-[11px] text-ink-secondary mt-0.5">
                <time dateTime={typeof ranAt === "number" ? new Date(ranAt).toISOString() : undefined}>
                  {t("okxGate.lastRun.label", { summary: lastRunSummary })}
                </time>
              </p>
            )}
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <Tag tone={listingTone} variant="solid" size="sm">
            {listingLabel}
          </Tag>
          <Tag tone={connectionTone} variant={connectionTone === "neutral" ? "outline" : "solid"} size="sm">
            {connectionLabel}
          </Tag>
        </div>
      </div>

      {/* Endpoint Association Callout */}
      {data.endpointAssociation === "unverified" && (
        <div className="mt-3 rounded border border-hairline bg-inset/50 p-2.5 font-mono text-[11.5px] text-ink-secondary">
          {data.endpointAssociationDetail || `Connection checked separately. This URL has not been verified as belonging to agent #${data.agentId}.`}
        </div>
      )}
      {data.endpointAssociation === "known_mismatch" && (
        <div className="mt-3 rounded border border-warning/40 bg-warning/5 p-2.5 font-mono text-[11.5px] text-warning">
          {data.endpointAssociationDetail || "The listing declares a different endpoint."}
        </div>
      )}
      {data.endpointAssociation === "verified" && (
        <div className="mt-3 flex items-center gap-1.5 font-mono text-[11.5px] text-success">
          <Check size={13} aria-hidden="true" />
          <span>{data.endpointAssociationDetail || "Declared in listing"}</span>
        </div>
      )}

      {/* Plain explanation */}
      <p className="mt-3 text-[12px] leading-relaxed text-ink break-words">
        {data.summary}
      </p>

      {/* Scope Disclaimer */}
      <p className="mt-2 text-[11px] leading-relaxed text-ink-secondary font-mono">
        Service delivery, output quality and payment outcomes were not assessed.
        <br />
        This check is free and read-only. The target service may have separate fees or access requirements.
      </p>

      {/* Listed Services Toggle */}
      {data.services && data.services.length > 0 && (
        <div className="mt-2.5">
          <button
            type="button"
            onClick={() => setShowServices((prev) => !prev)}
            className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-secondary hover:text-ink transition-colors"
          >
            {showServices ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span>{showServices ? "Hide listed services" : `View listed services (${data.services.length})`}</span>
          </button>
          {showServices && (
            <div className="mt-1.5 space-y-1.5 rounded border border-hairline bg-inset p-2.5 font-mono text-[11px]">
              {data.services.map((s) => (
                <div key={String(s.serviceId)} className="space-y-0.5 pb-1 border-b border-hairline last:border-0 last:pb-0">
                  <div className="flex items-center justify-between font-medium text-ink">
                    <span className="truncate">{s.name}</span>
                    <span className="ml-2 shrink-0 text-ink-secondary">{s.price} USDT</span>
                  </div>
                  {s.description && (
                    <p className="text-[10.5px] text-ink-secondary line-clamp-2">{s.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="frame-rule my-3" />

      {/* Actions Row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <a
          href={listingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded border border-hairline bg-surface px-2.5 py-1 font-mono text-[11.5px] text-ink hover:bg-raised transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
        >
          <ExternalLink size={12} aria-hidden="true" />
          <span>{t("okxGate.viewListing", { defaultValue: "View listing" })}</span>
        </a>

        {onRecheck && (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => runOnce(() => onRecheck(data.agentId))}
            aria-label={t("okxGate.trust.recheck", { defaultValue: "Re-check" })}
            className="font-mono text-[11.5px]"
          >
            <RefreshCw size={12} aria-hidden="true" />
            <span>{t("okxGate.trust.recheck", { defaultValue: "Re-check" })}</span>
          </Button>
        )}

        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => void copyResult()}
          aria-label={t("okxGate.copyResult", { defaultValue: "Copy result" })}
          className="font-mono text-[11.5px]"
        >
          {copiedResult ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
          <span>{copiedResult ? t("okxGate.copied", { defaultValue: "Copied" }) : t("okxGate.copyResult", { defaultValue: "Copy result" })}</span>
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
            aria-label={t("okxGate.cloneToTeam", { defaultValue: "Clone to Team" })}
            className="font-mono text-[11.5px]"
          >
            {cloning ? <Loader2 size={12} className="animate-spin" /> : cloned ? <Check size={12} /> : <UserPlus size={12} />}
            <span>{cloned ? t("okxGate.inTeam", { defaultValue: "In Team" }) : t("okxGate.cloneToTeam", { defaultValue: "Clone to Team" })}</span>
          </Button>
        )}
      </div>

      {/* Expandable Run Details */}
      <details
        id={detailsId}
        open={runDetailsOpen}
        onToggle={(e) => setRunDetailsOpen((e.currentTarget as HTMLDetailsElement).open)}
        className="mt-3.5 rounded border border-hairline bg-inset p-3 font-mono text-[11px] text-ink"
      >
        <summary className="cursor-pointer font-medium text-ink-secondary hover:text-ink select-none flex items-center justify-between">
          <span>{t("okxGate.runDetails", { defaultValue: "Run details" })}</span>
          <span className="text-[10.5px] text-ink-secondary font-normal">
            {passedCount} passed · {skippedCount} not checked{failedCount ? ` · ${failedCount} failed` : ""}{warnedCount ? ` · ${warnedCount} warned` : ""}
          </span>
        </summary>

        <div className="mt-2.5 space-y-3 border-t border-hairline pt-2.5">
          {/* Activity / Checks Performed */}
          <div>
            <h4 className="label-mono text-ink-secondary mb-1.5">
              {t("okxGate.activity", { defaultValue: "Activity" })}
            </h4>
            <ul aria-label="Activity" className="space-y-1.5 font-mono text-[11px]">
              {checksList.map((check) => {
                const glyph = check.status === "pass" ? "✓" : check.status === "fail" ? "✕" : check.status === "skipped" ? "—" : "!";
                const tone = check.status === "pass" ? "text-success" : check.status === "fail" ? "text-danger" : check.status === "skipped" ? "text-ink-secondary" : "text-warning";
                return (
                  <li key={`${check.id}:${check.detail}`} className="flex items-start gap-2 leading-relaxed">
                    <span aria-hidden="true" className={cn("w-3.5 shrink-0 font-bold", tone)}>
                      {glyph}
                    </span>
                    <span className="min-w-0 text-ink-secondary flex-1">
                      <span className={check.status === "fail" ? "font-medium text-ink" : undefined}>
                        {checkLabel(check)}
                      </span>{" "}
                      · {check.detail}
                    </span>
                    <span className={cn("uppercase text-[10px] font-semibold shrink-0 ml-2", tone)}>
                      {check.status === "skipped" ? "not checked" : check.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Limitations */}
          <div>
            <h4 className="label-mono text-ink-secondary mb-1">
              {t("okxGate.limitations", { defaultValue: "Limitations" })}
            </h4>
            <ul className="list-disc pl-4 space-y-0.5 font-mono text-[11px] text-ink-secondary">
              {(data.limitations && data.limitations.length > 0 ? data.limitations : [
                "Service delivery, output quality and payment outcomes were not assessed.",
                "This check is free and read-only. The target service may have separate fees or access requirements.",
              ]).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          {/* Source & Metadata */}
          <div className="border-t border-hairline pt-2 space-y-1">
            <h4 className="label-mono text-ink-secondary mb-1">
              {t("okxGate.source", { defaultValue: "Source" })}
            </h4>
            <div className="text-ink-secondary break-all">
              {data.resource?.provenance || "okx.ai listing page; not an OKX endorsement"}
            </div>
            {data.lastChecked !== undefined && (
              <div className="text-ink-secondary">
                Last checked: {String(data.lastChecked)}
              </div>
            )}
          </div>

          {/* Raw JSON payload */}
          {data.rawJson && (
            <div className="border-t border-hairline pt-2">
              <span className="block label-mono text-ink-secondary mb-1">Raw result JSON</span>
              <pre className="max-h-48 overflow-auto rounded border border-hairline bg-surface p-2 font-mono text-[10px] leading-tight text-ink whitespace-pre-wrap break-all">
                {data.rawJson}
              </pre>
            </div>
          )}
        </div>
      </details>
    </Frame>
  );
}
