import { Check, ChevronRight, Copy, Globe, Terminal, ShieldCheck, Cpu, X } from "lucide-react";
import { useState } from "react";
import type { Message } from "@/state/store";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { nameIsCommand } from "@/lib/verify-steps";
import { WorkingDots } from "./WorkingIndicator";

function toolCategoryIcon(name: string) {
  if (name.includes("scan") || name.includes("trust") || name.includes("gate")) {
    return <ShieldCheck size={13} className="text-accent" />;
  }
  if (name.includes("http") || name.includes("fetch") || name.includes("web") || name.includes("mcp")) {
    return <Globe size={13} className="text-blue-500" />;
  }
  if (nameIsCommand(name) || name.includes("bash") || name.includes("shell") || name.includes("cmd")) {
    return <Terminal size={13} className="text-emerald-500" />;
  }
  return <Cpu size={13} className="text-purple-500" />;
}

/** React Bits Pro inspired Tool Call & Activity Inspector card. */
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

  return (
    <details
      onToggle={(event) => setExpanded(event.currentTarget.open)}
      className="group/tool w-fit max-w-full rounded-xl border border-hairline/60 bg-panel/90 text-[12.5px] shadow-xs transition-all backdrop-blur open:w-[min(40rem,100%)]"
      data-testid="tool-activity"
    >
      <summary
        role="button"
        aria-expanded={expanded}
        aria-label={t("toolDetail.label", { name: tool.name, status })}
        className={cn(
          "flex min-h-8 cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-1.5 transition-colors hover:bg-raised/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden",
          failed ? "text-danger" : "text-ink"
        )}
      >
        <span className="flex size-4 items-center justify-center shrink-0">
          {toolCategoryIcon(tool.name)}
        </span>
        <span className="min-w-0 max-w-[28rem] truncate font-mono text-xs font-medium">
          {tool.name}
        </span>
        {tool.summary && tool.summary !== tool.name && !nameIsCommand(tool.name) && (
          <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-ink-secondary" title={tool.summary}>
            {tool.summary}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium tracking-tight",
              tool.ok === undefined
                ? "bg-accent/15 text-accent"
                : failed
                  ? "bg-danger/15 text-danger"
                  : "bg-success/15 text-success"
            )}
          >
            {tool.ok === undefined ? (
              <WorkingDots size={3} />
            ) : failed ? (
              <X size={11} />
            ) : (
              <Check size={11} />
            )}
            <span>{status}</span>
          </span>
          <ChevronRight
            size={13}
            className="text-ink-secondary/70 transition-transform duration-150 ease-out group-open/tool:rotate-90"
            aria-hidden="true"
          />
        </span>
      </summary>
      <div className="space-y-3 border-t border-hairline/50 p-3 text-ink-secondary bg-raised/20">
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-ink">
            <span>{t("toolDetail.input")}</span>
            <span
              role="button"
              tabIndex={0}
              onClick={() => copyText(tool.input ?? tool.summary ?? tool.name, setCopiedInput)}
              onKeyDown={(e) => e.key === "Enter" && copyText(tool.input ?? tool.summary ?? tool.name, setCopiedInput)}
              className="cursor-pointer inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-ink-secondary hover:bg-inset hover:text-ink"
            >
              {copiedInput ? <Check size={10} className="text-success" /> : <Copy size={10} />}
              <span>{copiedInput ? "Copied" : "Copy"}</span>
            </span>
          </div>
          <pre
            dir="ltr"
            className="max-h-52 overflow-auto rounded-lg border border-hairline/40 bg-inset/90 p-2.5 font-mono text-xs whitespace-pre-wrap break-words text-ink"
          >
            {tool.input ?? tool.summary ?? tool.name}
          </pre>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-ink">
            <span>{t("toolDetail.output")}</span>
            {tool.output && (
              <span
                role="button"
                tabIndex={0}
                onClick={() => copyText(tool.output, setCopiedOutput)}
                onKeyDown={(e) => e.key === "Enter" && copyText(tool.output, setCopiedOutput)}
                className="cursor-pointer inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-ink-secondary hover:bg-inset hover:text-ink"
              >
                {copiedOutput ? <Check size={10} className="text-success" /> : <Copy size={10} />}
                <span>{copiedOutput ? "Copied" : "Copy"}</span>
              </span>
            )}
          </div>
          {tool.output ? (
            <pre
              dir="ltr"
              className="max-h-64 overflow-auto rounded-lg border border-hairline/40 bg-inset/90 p-2.5 font-mono text-xs whitespace-pre-wrap break-words text-ink"
            >
              {tool.output}
            </pre>
          ) : (
            <p className="text-xs text-ink-secondary">
              {tool.ok === undefined ? t("toolDetail.waiting") : t("toolDetail.noOutput")}
            </p>
          )}
        </div>
      </div>
    </details>
  );
}
