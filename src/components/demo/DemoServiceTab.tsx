import { useState } from "react";
import { OKX_DEMO_IDENTITY, type OkxDemoStatus } from "../../../shared/okx-demo-identity";
import { OKX_DEMO_RECORDED } from "../../../shared/okx-demo-recorded";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { Check, Copy, ExternalLink } from "lucide-react";

const EXAMPLE_TOOL_CALL_SNIPPET = JSON.stringify(
  {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "scan_free_mcp_readiness",
      arguments: {
        endpointUrl: OKX_DEMO_IDENTITY.endpointUrl,
      },
    },
  },
  null,
  2,
);

export function DemoServiceTab({ status }: { status: OkxDemoStatus | null }) {
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const toolsList =
    status?.tools && status.tools.length > 0
      ? status.tools
      : OKX_DEMO_RECORDED.status.tools;

  const copySnippet = async () => {
    try {
      await navigator.clipboard?.writeText(EXAMPLE_TOOL_CALL_SNIPPET);
      setCopiedSnippet(true);
      window.setTimeout(() => setCopiedSnippet(false), 2000);
    } catch {
      // Best-effort
    }
  };

  return (
    <div className="space-y-6">
      {/* Identity Card */}
      <div className="rounded border border-hairline bg-surface p-4 sm:p-5">
        <h2 className="font-mono text-sm font-semibold tracking-tight text-ink mb-3">
          {t("demo.service.identity")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[12px]">
          <div className="rounded border border-hairline bg-inset p-2.5">
            <span className="block text-ink-secondary text-[11px] mb-0.5">
              {t("demo.service.name")}
            </span>
            <span className="font-medium text-ink">{OKX_DEMO_IDENTITY.name}</span>
          </div>

          <div className="rounded border border-hairline bg-inset p-2.5">
            <span className="block text-ink-secondary text-[11px] mb-0.5">
              {t("demo.service.agentId")}
            </span>
            <span className="font-medium text-ink">#{OKX_DEMO_IDENTITY.agentId}</span>
          </div>

          <div className="rounded border border-hairline bg-inset p-2.5">
            <span className="block text-ink-secondary text-[11px] mb-0.5">
              {t("demo.service.serviceName")}
            </span>
            <span className="font-medium text-ink">{OKX_DEMO_IDENTITY.serviceName}</span>
          </div>

          <div className="rounded border border-hairline bg-inset p-2.5">
            <span className="block text-ink-secondary text-[11px] mb-0.5">
              {t("demo.service.access")}
            </span>
            <span className="font-medium text-ink">{OKX_DEMO_IDENTITY.access}</span>
          </div>

          <div className="rounded border border-hairline bg-inset p-2.5 sm:col-span-2">
            <span className="block text-ink-secondary text-[11px] mb-0.5">
              {t("demo.service.protocol")}
            </span>
            <span className="font-medium text-ink">{OKX_DEMO_IDENTITY.protocol}</span>
          </div>

          <div className="rounded border border-hairline bg-inset p-2.5 sm:col-span-2">
            <span className="block text-ink-secondary text-[11px] mb-0.5">
              {t("demo.service.endpointUrl")}
            </span>
            <span className="font-mono text-[11.5px] text-ink break-all">
              {OKX_DEMO_IDENTITY.endpointUrl}
            </span>
          </div>

          <div className="rounded border border-hairline bg-inset p-2.5 sm:col-span-2">
            <span className="block text-ink-secondary text-[11px] mb-0.5">
              {t("demo.service.listingUrl")}
            </span>
            <a
              href={OKX_DEMO_IDENTITY.listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-accent underline break-all"
            >
              <span>{OKX_DEMO_IDENTITY.listingUrl}</span>
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>

      {/* Exposed Tools */}
      <div className="rounded border border-hairline bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-mono text-sm font-semibold tracking-tight text-ink">
            {t("demo.service.toolsTitle")}
          </h2>
          <span className="font-mono text-[11px] text-ink-secondary">
            {toolsList.length} tools registered
          </span>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[12px]">
          {toolsList.map((toolName) => {
            const isDemoTool =
              toolName === "scan_free_mcp_readiness" || toolName === "get_asp_trust_card";
            return (
              <li
                key={toolName}
                className="flex items-center justify-between gap-2 rounded border border-hairline bg-inset px-3 py-2"
              >
                <span className="text-ink break-all">{toolName}</span>
                {isDemoTool && (
                  <Tag tone="accent" size="sm" variant="outline">
                    demo
                  </Tag>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Boundaries & Guarantees */}
      <div className="rounded border border-hairline bg-surface p-4 sm:p-5">
        <h2 className="font-mono text-sm font-semibold tracking-tight text-ink mb-3">
          {t("demo.service.boundariesTitle")}
        </h2>
        <div className="rounded border border-hairline bg-inset p-3.5 font-mono text-[12px] leading-relaxed text-ink whitespace-pre-line">
          {t("demo.service.boundariesText")}
        </div>
      </div>

      {/* Tools/Call JSON Snippet */}
      <div className="rounded border border-hairline bg-surface p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <h2 className="font-mono text-sm font-semibold tracking-tight text-ink">
            {t("demo.service.snippetTitle")}
          </h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={copySnippet}
            className="font-mono text-[11px]"
          >
            {copiedSnippet ? (
              <>
                <Check size={12} aria-hidden="true" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy size={12} aria-hidden="true" />
                <span>Copy</span>
              </>
            )}
          </Button>
        </div>
        <pre className="max-h-72 overflow-auto rounded border border-hairline bg-inset p-3 font-mono text-[11.5px] leading-relaxed text-ink break-all whitespace-pre-wrap">
          {EXAMPLE_TOOL_CALL_SNIPPET}
        </pre>
      </div>
    </div>
  );
}
