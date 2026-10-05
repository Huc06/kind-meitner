import { useId } from "react";
import { parseOkxActionCardEnvelope, type OkxActionCardData } from "@/lib/okx-action-cards";
import { ReadinessRunCard } from "@/components/ReadinessRunCard";
import { TrustCard } from "@/components/TrustCard";
import { Tag } from "@/components/ui/tag";
import { t } from "@/lib/i18n";
import { OKX_DEMO_TOOLS, type OkxDemoCheckResult } from "../../../shared/okx-demo-identity";

export function DemoResultCard({
  result,
  isRecorded = false,
  capturedAt,
  onRerun,
}: {
  result: OkxDemoCheckResult & { ok: true };
  isRecorded?: boolean;
  capturedAt?: string;
  /** Re-runs the same live check; absent for recorded and history entries. */
  onRerun?: () => void;
}) {
  const detailsId = useId();
  const cardData: OkxActionCardData | null = parseOkxActionCardEnvelope(
    result.tool,
    result.envelope,
  );

  const formattedTime = new Date(result.startedAt).toLocaleTimeString();
  const captureLabel = capturedAt
    ? t("demo.recordedLabel", { capturedAt })
    : t("demo.recordedLabel", { capturedAt: result.startedAt });
  const liveLabel = t("demo.liveLabel", { time: formattedTime });

  const rawJsonString = JSON.stringify(result.envelope, null, 2);
  const provenance = result.envelope?.resource?.provenance as string | undefined;

  // Derive verdict / decision verbatim if cardData is missing
  const dataRecord = (result.envelope?.data ?? {}) as Record<string, unknown>;
  const fallbackVerdict = String(dataRecord.verdict ?? dataRecord.decision ?? "UNKNOWN");

  return (
    <div className="min-w-0 rounded border border-hairline bg-surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-2.5">
        <div>
          {isRecorded ? (
            <Tag tone="warning" size="sm" variant="outline" className="font-mono text-[11px]">
              {captureLabel}
            </Tag>
          ) : (
            <Tag tone="success" size="sm" variant="outline" className="font-mono text-[11px]">
              {liveLabel}
            </Tag>
          )}
        </div>
        <div className="font-mono text-[11px] text-ink-secondary">
          {result.latencyMs}ms · {t(result.tool === OKX_DEMO_TOOLS.endpoint ? "okxGate.readiness.title" : "okxGate.trust.title")}
        </div>
      </div>

      {cardData?.kind === "readiness" ? (
        <ReadinessRunCard data={cardData} hideApplyHost={true} onRescan={onRerun} />
      ) : cardData?.kind === "trust" ? (
        <TrustCard data={cardData} hideSpendControls={true} onRecheck={onRerun} />
      ) : (
        <div className="space-y-3 font-mono text-[12px]">
          <div className="flex items-center gap-2">
            <span className="font-medium text-ink">Verdict:</span>
            <span className="font-bold uppercase text-ink">{fallbackVerdict}</span>
          </div>
          {Boolean(dataRecord.summary) && (
            <p className="text-ink-secondary">{String(dataRecord.summary)}</p>
          )}
        </div>
      )}

      <details
        id={detailsId}
        className="mt-3.5 rounded border border-hairline bg-inset p-3 font-mono text-[11px] text-ink"
      >
        <summary className="cursor-pointer font-medium text-ink-secondary transition-colors hover:text-ink select-none">
          {t("demo.technicalDetails.title")}
        </summary>
        <div className="mt-2.5 space-y-2 border-t border-hairline pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-1">
            <span className="text-ink-secondary">{t("demo.technicalDetails.tool")}:</span>
            <span className="break-all text-ink">{result.tool}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-1">
            <span className="text-ink-secondary">{t("demo.technicalDetails.arguments")}:</span>
            <span className="break-all text-ink">{JSON.stringify(result.arguments)}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-1">
            <span className="text-ink-secondary">{t("demo.technicalDetails.requestId")}:</span>
            <span className="break-all text-ink">{result.requestId}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-1">
            <span className="text-ink-secondary">{t("demo.technicalDetails.latency")}:</span>
            <span className="text-ink">{result.latencyMs}ms</span>
          </div>
          {provenance && (
            <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-1">
              <span className="text-ink-secondary">{t("demo.technicalDetails.provenance")}:</span>
              <span className="break-all text-ink">{provenance}</span>
            </div>
          )}
          <div className="pt-1">
            <div className="mb-1 text-ink-secondary">{t("demo.technicalDetails.rawJson")}:</div>
            <pre className="max-h-60 overflow-auto rounded border border-hairline bg-surface p-2 font-mono text-[10.5px] leading-tight text-ink break-all whitespace-pre-wrap">
              {rawJsonString}
            </pre>
          </div>
        </div>
      </details>
    </div>
  );
}
