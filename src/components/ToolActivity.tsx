import { Check, ChevronRight, Copy } from "lucide-react";
import { useState } from "react";
import type { Message } from "@/state/store";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { nameIsCommand } from "@/lib/verify-steps";
import { WorkingDots } from "./WorkingIndicator";
import { Tag } from "@/components/ui/tag";

export function ToolActivity({ tool }: { tool: NonNullable<Message["tool"]> }) {
  const [expanded, setExpanded] = useState(false);
  const [copiedInput, setCopiedInput] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const failed = tool.ok === false;
  const status = tool.ok === undefined ? t("toolDetail.running") : failed ? t("toolDetail.failed") : t("toolDetail.completed");

  const copyText = async (val: string | undefined, setFn: (v: boolean) => void) => {
    if (!val) return;
    try {
      await navigator.clipboard?.writeText(val);
      setFn(true);
      setTimeout(() => setFn(false), 2000);
    } catch {}
  };

  const tagTone = tool.ok === undefined ? "neutral" : failed ? "danger" : "success";

  return (
    <details
      onToggle={(event) => setExpanded(event.currentTarget.open)}
      className="group/tool w-fit max-w-full border border-hairline bg-inset text-[12px] open:w-[min(40rem,100%)] my-1"
      data-testid="tool-activity"
    >
      <summary
        role="button"
        aria-expanded={expanded}
        aria-label={t("toolDetail.label", { name: tool.name, status })}
        className={cn(
          "flex min-h-7 cursor-pointer list-none items-center gap-2 px-2.5 py-1 font-mono transition-colors hover:bg-raised-hover [&::-webkit-details-marker]:hidden",
          failed ? "text-danger" : "text-ink"
        )}
      >
        <span className="text-ink-secondary select-none font-mono text-[11px]">&gt;_</span>
        <span className="min-w-0 max-w-[28rem] truncate font-mono text-[11.5px] font-medium text-ink">
          {tool.name}
        </span>
        {tool.summary && tool.summary !== tool.name && !nameIsCommand(tool.name) && (
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-secondary" title={tool.summary}>
            {tool.summary}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5 shrink-0">
          <Tag tone={tagTone} variant="outline" size="sm">
            {tool.ok === undefined ? (
              <span className="flex items-center gap-1">
                <WorkingDots size={3} />
                <span>{status}</span>
              </span>
            ) : (
              <span>{status}</span>
            )}
          </Tag>
          <ChevronRight
            size={12}
            className="text-ink-secondary transition-transform duration-150 ease-out group-open/tool:rotate-90"
            aria-hidden="true"
          />
        </span>
      </summary>
      <div className="space-y-3 border-t border-hairline bg-inset p-3 text-ink-secondary">
        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-ink">
            <span>{t("toolDetail.input")}</span>
            <span
              role="button"
              tabIndex={0}
              onClick={() => copyText(tool.input ?? tool.summary ?? tool.name, setCopiedInput)}
              onKeyDown={(e) => e.key === "Enter" && copyText(tool.input ?? tool.summary ?? tool.name, setCopiedInput)}
              className="cursor-pointer inline-flex items-center gap-1 border border-hairline bg-card px-1.5 py-0.5 font-mono text-[10px] text-ink-secondary hover:bg-raised-hover hover:text-ink"
            >
              {copiedInput ? <Check size={10} className="text-success" /> : <Copy size={10} />}
              <span>{copiedInput ? "Copied" : "Copy"}</span>
            </span>
          </div>
          <pre
            dir="ltr"
            className="max-h-52 overflow-auto border border-hairline bg-card p-2.5 font-mono text-xs whitespace-pre-wrap break-words text-ink"
          >
            {tool.input ?? tool.summary ?? tool.name}
          </pre>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-ink">
            <span>{t("toolDetail.output")}</span>
            {tool.output && (
              <span
                role="button"
                tabIndex={0}
                onClick={() => copyText(tool.output, setCopiedOutput)}
                onKeyDown={(e) => e.key === "Enter" && copyText(tool.output, setCopiedOutput)}
                className="cursor-pointer inline-flex items-center gap-1 border border-hairline bg-card px-1.5 py-0.5 font-mono text-[10px] text-ink-secondary hover:bg-raised-hover hover:text-ink"
              >
                {copiedOutput ? <Check size={10} className="text-success" /> : <Copy size={10} />}
                <span>{copiedOutput ? "Copied" : "Copy"}</span>
              </span>
            )}
          </div>
          {tool.output ? (
            <pre
              dir="ltr"
              className="max-h-64 overflow-auto border border-hairline bg-card p-2.5 font-mono text-xs whitespace-pre-wrap break-words text-ink"
            >
              {tool.output}
            </pre>
          ) : (
            <p className="font-mono text-xs text-ink-secondary">
              {tool.ok === undefined ? t("toolDetail.waiting") : t("toolDetail.noOutput")}
            </p>
          )}
        </div>
      </div>
    </details>
  );
}
