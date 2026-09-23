import type { ReactNode } from "react";

import {
  isOkxGateTool,
  OKX_PRODUCTION_FREE_MCP_URL,
  parseOkxActionCard,
} from "@/lib/okx-action-cards";
import { appendComposerDraft } from "@/lib/drafts";
import { t } from "@/lib/i18n";
import type { Message } from "@/state/store";
import { ReadinessRunCard } from "./ReadinessRunCard";
import { TrustCard } from "./TrustCard";

/** Keeps each transcript renderer on its normal tool-result UI when a gate
 * payload cannot be verified. A malformed response never becomes a fake PASS
 * or GO card. CTAs only fill the composer — they never invent verdicts. */
export function OkxGateToolResult({
  message,
  enabled,
  fallback,
  composerDraftId,
  busy = false,
}: {
  message: Message;
  enabled: boolean;
  fallback: ReactNode;
  /** The active ChatView or GroupView composer; this is never sent here. */
  composerDraftId: string;
  /** True while a Markets / Free-MCP tool call is in flight. */
  busy?: boolean;
}) {
  const tool = message.tool;
  if (!enabled || !tool || !isOkxGateTool(tool.name)) return <>{fallback}</>;
  const data = parseOkxActionCard(tool);
  if (data) {
    return data.kind === "readiness" ? (
      <ReadinessRunCard
        data={data}
        busy={busy}
        ranAt={message.at}
        onApplyHost={(hostUrl) =>
          appendComposerDraft(
            composerDraftId,
            `@Listing Coach use this Free-MCP host next: ${hostUrl}`,
          )
        }
        onRescan={(endpointUrl) =>
          appendComposerDraft(composerDraftId, `@Markets scan again: ${endpointUrl}`)
        }
      />
    ) : (
      <TrustCard
        data={data}
        busy={busy}
        ranAt={message.at}
        onBlockSpend={(agentId) =>
          appendComposerDraft(
            composerDraftId,
            `@Spend Scout refuse pay for agent ${agentId}. Do not call pay/x402 tools.`,
          )
        }
        onContinue={(agentId) =>
          appendComposerDraft(
            composerDraftId,
            `@Markets call get_free_a2mcp_launch_checklist for agent ${agentId} (free tools only; trust GO).`,
          )
        }
        onRecheck={(agentId) =>
          appendComposerDraft(
            composerDraftId,
            `@Markets get_asp_trust_card for agent ${agentId} with endpoint ${OKX_PRODUCTION_FREE_MCP_URL}`,
          )
        }
      />
    );
  }
  if (tool.ok === true && tool.output) {
    return (
      <div className="space-y-1.5">
        <p role="status" className="max-w-[min(42rem,88%)] text-[12px] text-ink-secondary">
          {t("okxGate.error.parseCard")}
        </p>
        {fallback}
      </div>
    );
  }
  return <>{fallback}</>;
}
