import { useEffect, useState } from "react";
import { Frame } from "@/components/ui/frame";
import { Tag } from "@/components/ui/tag";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { reducedMotion } from "@/lib/onboarding";
import type { SceneProps } from "./types";

const READINESS_MS = 5200;

interface CheckItem {
  id: string;
  name: string;
  detail: string;
  status: "pass" | "warn" | "fail";
}

const CHECKS: CheckItem[] = [
  { id: "endpoint", name: "ASP endpoint schema", detail: "200 OK, valid MCP SSE stream", status: "pass" },
  { id: "tools", name: "MCP tool contracts", detail: "4 tools declared with parameter schemas", status: "pass" },
  { id: "boundary", name: "Permission boundary", detail: "Read-only access, no private keys requested", status: "pass" },
  { id: "latency", name: "Response latency", detail: "310ms (recommended <250ms threshold)", status: "warn" },
];

export function ReadinessScene({ playing, onCue, onEnded, label }: SceneProps) {
  const still = reducedMotion() || !playing;
  const [phase, setPhase] = useState<"scan" | "settled">(still ? "settled" : "scan");

  useEffect(() => {
    if (still) return;
    setPhase("scan");
    onCue?.("searching");

    const tSettled = setTimeout(() => {
      setPhase("settled");
      onCue?.("proud");
    }, 1200);

    const tEnd = setTimeout(() => onEnded?.(), READINESS_MS);

    return () => {
      clearTimeout(tSettled);
      clearTimeout(tEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, still]);

  const settled = phase === "settled";

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-inset p-3 sm:p-4"
      role="img"
      aria-label={label}
    >
      <Frame
        as="section"
        title={t("onboarding.reel.readiness.title")}
        index="01"
        surface="inset"
        className="w-full max-w-[500px] bg-card p-3 sm:p-3.5 shadow-sm"
      >
        <div className="flex items-start gap-2.5">
          <Tag tone={settled ? "success" : "neutral"} variant="solid" size="md">
            {settled ? "PASS" : "SCAN"}
          </Tag>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <h3 className="text-[12px] font-semibold text-ink truncate">
                  Free MCP Readiness
                </h3>
                <span className="label-mono text-ink-secondary text-[10px]">[88/100]</span>
              </div>
              <span className="border border-hairline bg-inset px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-ink-secondary shrink-0">
                {t("onboarding.reel.example")}
              </span>
            </div>
            <p className="font-mono text-[10px] text-ink-secondary truncate mt-0.5">
              https://free-mcp.railway.app/sse
            </p>
            <p className="font-mono text-[10px] text-ink-secondary mt-0.5">
              {settled ? "Passed: 3 · Warned: 1 · Failed: 0" : "Inspecting MCP contracts…"}
            </p>
          </div>
        </div>

        <div className="frame-rule my-2.5" />

        <ul className="space-y-1.5 font-mono text-[10.5px]">
          {CHECKS.map((check, i) => {
            const visible = settled || i === 0;
            const isWarn = check.status === "warn";
            return (
              <li
                key={check.id}
                className={cn(
                  "grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2 text-[11px] leading-tight transition-opacity duration-300",
                  visible ? "opacity-100" : "opacity-35",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("w-3 shrink-0 font-bold", isWarn ? "text-warning" : "text-success")}
                >
                  {isWarn ? "!" : "✓"}
                </span>
                <span className="min-w-0 text-ink truncate">
                  {check.name}{" "}
                  <span className="text-ink-secondary truncate">· {check.detail}</span>
                </span>
                <span
                  className={cn(
                    "uppercase text-[9px] font-semibold shrink-0 ml-1",
                    isWarn ? "text-warning" : "text-success",
                  )}
                >
                  {check.status}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="frame-rule my-2.5" />

        <div className="flex items-center justify-between text-[10px] font-mono text-ink-secondary">
          <span>{t("onboarding.reel.readiness.boundary")}</span>
          <span className="text-success font-semibold">{t("onboarding.reel.readiness.ready")}</span>
        </div>

        <p className="mt-2 font-mono text-[9.5px] leading-normal text-ink-secondary">
          {t("okxGate.readiness.disclaimer")}
        </p>
      </Frame>
    </div>
  );
}
