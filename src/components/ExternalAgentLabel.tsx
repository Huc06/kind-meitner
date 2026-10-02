import { Tag } from "@/components/ui/tag";
import { externalSourceLabel } from "@/lib/external-agents";
import { t } from "@/lib/i18n";
import type { Message } from "@/state/store";

/** Transport and provenance for a message from an external agent: which
 * connection answered, how (direct or through zroute → upstream), and that
 * the connection is read-only. Never claims official OKX status. */
export function ExternalAgentLabel({ external }: { external: NonNullable<Message["external"]> }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 font-mono text-[10.5px] text-ink-secondary" data-external-source={external.transport}>
      <span>{externalSourceLabel(external)}</span>
      {external.latencyMs !== undefined && <span>· {t("external.latency", { ms: external.latencyMs })}</span>}
      <Tag tone="neutral" variant="outline" size="sm">{t("external.readOnly")}</Tag>
    </span>
  );
}
