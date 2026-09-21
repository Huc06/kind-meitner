import type { ReactNode } from "react";

import { isOkxGateTool, parseOkxActionCard } from "@/lib/okx-action-cards";
import { appendComposerDraft } from "@/lib/drafts";
import { t } from "@/lib/i18n";
import type { Message } from "@/state/store";
import { ReadinessRunCard } from "./ReadinessRunCard";
import { TrustCard } from "./TrustCard";

/** Keeps each transcript renderer on its normal tool-result UI when a gate
 * payload cannot be verified. A malformed response never becomes a fake PASS
 * or GO card. */
export function OkxGateToolResult({
  message,
  enabled,
  fallback,
  composerDraftId,
}: {
  message: Message;
  enabled: boolean;
  fallback: ReactNode;
  /** The active ChatView or GroupView composer; this is never sent here. */
  composerDraftId: string;
}) {
  const tool = message.tool;
  if (!enabled || !tool || !isOkxGateTool(tool.name)) return <>{fallback}</>;
  const data = parseOkxActionCard(tool);
  if (data) {
    return data.kind === "readiness"
      ? <ReadinessRunCard data={data} onRescan={(endpointUrl) => appendComposerDraft(composerDraftId, `@Markets scan again: ${endpointUrl}`)} />
      : <TrustCard data={data} />;
  }
  if (tool.ok === true && tool.output) {
    return <div className="space-y-1.5"><p role="status" className="max-w-[min(42rem,88%)] text-[12px] text-ink-secondary">{t("okxGate.error.parseCard")}</p>{fallback}</div>;
  }
  return <>{fallback}</>;
}
