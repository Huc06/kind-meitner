import { AlertTriangle, Check, Copy, RefreshCw, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import { checkLabel, type GateSignal, type ReadinessRunCardData } from "@/lib/okx-action-cards";
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

/** A verdict-first transcript card for one settled `scan_free_mcp_readiness`
 * result. It owns no server state: Re-scan only prepares the next composer turn. */
export function ReadinessRunCard({
  data,
  onRescan,
}: {
  data: ReadinessRunCardData;
  onRescan?: (endpointUrl: string) => void;
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const evidenceId = useId();
  const actionLocked = useRef(false);
  const verdictTone = data.verdict === "PASS" ? "bg-success/15 text-success" : data.verdict === "FAIL" ? "bg-danger/15 text-danger" : "bg-warning/15 text-warning";
  const copyFixes = async () => {
    if (data.remediation.length === 0) return;
    try {
      await navigator.clipboard?.writeText(data.remediation.join("\n"));
      setCopied(true);
    } catch {
      // Clipboard access is best-effort; the visible fixes remain selectable.
    }
  };
  const rescan = () => {
    if (actionLocked.current || !onRescan) return;
    actionLocked.current = true;
    onRescan(data.endpointUrl);
    window.setTimeout(() => { actionLocked.current = false; }, 500);
  };

  return (
    <section aria-label={t("okxGate.readiness.aria", { verdict: data.verdict })} className="w-full max-w-[min(42rem,88%)] rounded-2xl bg-raised px-4 py-3.5 ring-1 ring-hairline">
      <div className="flex items-start gap-2.5">
        <span aria-label={t("okxGate.readiness.verdict", { verdict: data.verdict })} className={cn("rounded-full px-2 py-0.5 text-[12px] font-bold", verdictTone)}>{data.verdict}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-medium text-ink">{t("okxGate.readiness.title")}</h3>
          <p title={data.endpointUrl} className="mt-0.5 truncate font-mono text-[12px] text-ink-secondary">{data.endpointUrl}</p>
        </div>
      </div>
      <ul aria-label={t("okxGate.readiness.checks")} className="mt-3 space-y-1.5 border-t border-hairline/70 pt-3">
        {data.checks.map((check) => (
          <li key={`${check.id}:${check.detail}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2 text-[12px] leading-relaxed">
            <StatusIcon status={check.status} />
            <span className={cn("min-w-0", check.status === "fail" ? "font-medium text-ink" : "text-ink-secondary")}>
              {checkLabel(check)} <span className="text-ink-secondary">· {check.detail}</span>
            </span>
            <span className={cn("uppercase text-[10px] font-semibold", statusTone(check.status))}>{check.status}</span>
          </li>
        ))}
      </ul>
      {data.remediation.length > 0 && (
        <div className="mt-3 border-t border-hairline/70 pt-3">
          <h4 className="text-[12px] font-medium text-ink">{t("okxGate.readiness.fix")}</h4>
          <ul className="mt-1.5 space-y-1 text-[12px] leading-relaxed text-ink-secondary">
            {data.remediation.map((fix) => <li key={fix} className="flex gap-2"><span aria-hidden="true">☐</span><span>{fix}</span></li>)}
          </ul>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-hairline/70 pt-3">
        <button type="button" disabled={data.remediation.length === 0} onClick={() => void copyFixes()} aria-label={t("okxGate.readiness.copyFixes")} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-ink-secondary hover:bg-inset hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"><Copy size={13} aria-hidden="true" />{copied ? t("okxGate.copied") : t("okxGate.readiness.copyFixes")}</button>
        <button type="button" disabled={!onRescan} onClick={rescan} aria-label={t("okxGate.readiness.rescan")} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-ink-secondary hover:bg-inset hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"><RefreshCw size={13} aria-hidden="true" />{t("okxGate.readiness.rescan")}</button>
        <button type="button" onClick={() => setEvidenceOpen((open) => !open)} aria-expanded={evidenceOpen} aria-controls={evidenceId} className="rounded-md px-2 py-1 text-[12px] font-medium text-ink-secondary hover:bg-inset hover:text-ink">{t("okxGate.evidence")}</button>
      </div>
      {evidenceOpen && <pre id={evidenceId} className="mt-2 max-h-60 overflow-auto rounded-lg bg-inset p-2.5 text-xs whitespace-pre-wrap break-words text-ink">{data.rawJson}</pre>}
    </section>
  );
}
