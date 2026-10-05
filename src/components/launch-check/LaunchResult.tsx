import { X } from "lucide-react";

import { t } from "@/lib/i18n";
import { explainReadiness } from "@/lib/launch-check";
import { checkLabel } from "@/lib/okx-action-cards";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { ReadinessRunCard } from "@/components/ReadinessRunCard";
import { OKX_DEMO_IDENTITY } from "../../../shared/okx-demo-identity";
import { healthOf, type ServiceCheck, type ServiceHealth } from "./launch-runs";

const HEALTH_KEY = {
  working: "launch.health.working",
  attention: "launch.health.attention",
  unverified: "launch.health.unverified",
} as const satisfies Record<ServiceHealth, string>;

const HEALTH_TONE: Record<ServiceHealth, string> = {
  working: "border-success/50 text-success",
  attention: "border-warning/50 text-warning",
  unverified: "border-danger/50 text-danger",
};

export function healthLabel(health: ServiceHealth): string {
  return t(HEALTH_KEY[health]);
}

/** Every result in this view comes from the remote service, called live. */
export function LaunchHealthBadge({ check }: { check: ServiceCheck }) {
  const health = healthOf(check);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={cn("rounded border px-2 py-0.5 text-[14px] font-semibold", HEALTH_TONE[health])}>{healthLabel(health)}</span>
      <span className="label-mono rounded border border-hairline px-1.5 py-0.5 text-ink-secondary">{t("launch.source.live")}</span>
      <span className="label-mono text-ink-secondary">{t("launch.boundaries")}</span>
    </div>
  );
}

/** The Result Explainer: restates only what the service reported. */
export function LaunchExplanation({ check, onDetails }: { check: ServiceCheck; onDetails: () => void }) {
  if (!check.data) {
    return (
      <div className="space-y-1.5 text-[13px] leading-relaxed">
        <p className="label-mono text-ink-secondary">{t("launch.role.explainer")}</p>
        <p>{t("launch.explain.callFailed", { error: check.error || t("launch.explain.noDetail") })}</p>
        <Button size="sm" variant="secondary" onClick={onDetails}>{t("launch.details.open")}</Button>
      </div>
    );
  }
  const explanation = explainReadiness(check.data);
  return (
    <div className="space-y-1.5 text-[13px] leading-relaxed">
      <p className="label-mono text-ink-secondary">{t("launch.role.explainer")}</p>
      {explanation.verdict === "PASS" && (
        <p>{t("launch.explain.pass", { passed: explanation.passed, total: explanation.total })}</p>
      )}
      {explanation.verdict === "WARN" && <p>{t("launch.explain.warn")}</p>}
      {explanation.verdict === "FAIL" && <p>{t("launch.explain.fail")}</p>}
      {explanation.findings.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5">
          {explanation.findings.map((finding) => (
            <li key={finding.id}>
              <span className="font-medium">{checkLabel(finding)}</span>
              {finding.detail ? ` — ${finding.detail}` : ""}
            </li>
          ))}
        </ul>
      )}
      {explanation.fixes.length > 0 && (
        <>
          <p className="font-medium">{t("launch.explain.nextSteps")}</p>
          <ol className="list-decimal space-y-0.5 pl-5">
            {explanation.fixes.map((fix) => <li key={fix}>{fix}</li>)}
          </ol>
        </>
      )}
      <p className="text-[12px] text-ink-secondary">{t("launch.explain.limits")}</p>
      <Button size="sm" variant="secondary" onClick={onDetails}>{t("launch.details.open")}</Button>
    </div>
  );
}

/** Run details: the service's own result plus technical identity. */
export function LaunchRunDetails({ check, onClose }: { check: ServiceCheck; onClose: () => void }) {
  return (
    <section aria-label={t("launch.details.title")} className="mt-3 space-y-3 border-t border-hairline pt-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold">{t("launch.details.title")}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("launch.details.close")}
          className="inline-flex size-7 items-center justify-center rounded text-ink-secondary hover:bg-raised-hover hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      {check.data ? (
        <ReadinessRunCard data={check.data} ranAt={check.at} hideApplyHost={true} />
      ) : (
        <p className="text-[12.5px] text-danger">{t("launch.explain.callFailed", { error: check.error || t("launch.explain.noDetail") })}</p>
      )}
      <details className="rounded border border-hairline bg-inset px-2.5 py-2 text-[12px]">
        <summary className="cursor-pointer text-ink-secondary">{t("launch.details.technical")}</summary>
        <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-[11.5px]">
          <dt className="text-ink-secondary">{t("launch.details.service")}</dt>
          <dd className="break-all">{OKX_DEMO_IDENTITY.name} · {t("launch.details.agentId", { id: OKX_DEMO_IDENTITY.agentId })}</dd>
          <dt className="text-ink-secondary">{t("launch.details.protocol")}</dt>
          <dd>{OKX_DEMO_IDENTITY.protocol}</dd>
          <dt className="text-ink-secondary">{t("launch.details.url")}</dt>
          <dd className="break-all">{OKX_DEMO_IDENTITY.endpointUrl}</dd>
          <dt className="text-ink-secondary">{t("launch.details.action")}</dt>
          <dd>tools/call · scan_free_mcp_readiness</dd>
          <dt className="text-ink-secondary">{t("launch.details.source")}</dt>
          <dd>{t(check.monitorRun ? "launch.details.sourceMonitor" : "launch.details.sourceManual")}</dd>
          <dt className="text-ink-secondary">{t("launch.details.time")}</dt>
          <dd>{new Date(check.at).toISOString()}</dd>
        </dl>
        <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-all border border-hairline bg-surface p-2 font-mono text-[11px]">{check.raw}</pre>
      </details>
    </section>
  );
}
