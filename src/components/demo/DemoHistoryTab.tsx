import { useState } from "react";
import { OKX_DEMO_RECORDED } from "../../../shared/okx-demo-recorded";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { DemoResultCard } from "./DemoResultCard";
import type { OkxDemoCheckResult } from "../../../shared/okx-demo-identity";
import { ChevronDown, ChevronUp } from "lucide-react";

export type DemoHistoryEntry = {
  id: string;
  time: string;
  tool: string;
  input: string;
  verdict: string;
  result: OkxDemoCheckResult & { ok: true };
};

export function DemoHistoryTab({
  liveHistory,
}: {
  liveHistory: DemoHistoryEntry[];
}) {
  const [expandedLiveId, setExpandedLiveId] = useState<string | null>(null);
  const [expandedRecordedKey, setExpandedRecordedKey] = useState<
    "endpoint" | "failure" | "agent" | null
  >(null);

  const recordedCases = [
    {
      key: "endpoint" as const,
      title: t("demo.history.endpointCase"),
      verdict: "PASS",
      tool: OKX_DEMO_RECORDED.cases.endpoint.tool,
      result: OKX_DEMO_RECORDED.cases.endpoint as OkxDemoCheckResult & { ok: true },
    },
    {
      key: "failure" as const,
      title: t("demo.history.failureCase"),
      verdict: "FAIL",
      tool: OKX_DEMO_RECORDED.cases.failure.tool,
      result: OKX_DEMO_RECORDED.cases.failure as OkxDemoCheckResult & { ok: true },
    },
    {
      key: "agent" as const,
      title: t("demo.history.agentCase"),
      verdict: "GO",
      tool: OKX_DEMO_RECORDED.cases.agent.tool,
      result: OKX_DEMO_RECORDED.cases.agent as OkxDemoCheckResult & { ok: true },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Live History Section */}
      <div className="rounded border border-hairline bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-mono text-sm font-semibold tracking-tight text-ink">
            {t("demo.history.liveTitle")}
          </h2>
          <span className="font-mono text-[11px] text-ink-secondary">
            {t("demo.history.count", { count: liveHistory.length })}
          </span>
        </div>

        {liveHistory.length === 0 ? (
          <p className="font-mono text-[12px] text-ink-secondary">
            {t("demo.history.emptyLive")}
          </p>
        ) : (
          <div className="space-y-2">
            {liveHistory.map((item) => {
              const isExpanded = expandedLiveId === item.id;
              const formattedTime = new Date(item.time).toLocaleTimeString();
              const isPass = item.verdict === "PASS" || item.verdict === "GO";
              const isFail = item.verdict === "FAIL" || item.verdict === "NO_GO";

              return (
                <div
                  key={item.id}
                  className="rounded border border-hairline bg-inset p-3 font-mono text-[11.5px]"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Tag
                        tone={isPass ? "success" : isFail ? "danger" : "warning"}
                        size="sm"
                        className="font-bold uppercase"
                      >
                        {item.verdict}
                      </Tag>
                      <span className="text-ink-secondary">{formattedTime}</span>
                      <span className="text-hairline">·</span>
                      <span className="text-ink font-medium">{item.tool}</span>
                      <span className="text-hairline">·</span>
                      <span className="text-ink-secondary break-all max-w-[200px] truncate">
                        {item.input}
                      </span>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setExpandedLiveId(isExpanded ? null : item.id)}
                      className="font-mono text-[11px] self-start sm:self-auto"
                    >
                      <span>
                        {isExpanded
                          ? t("demo.history.hideResult")
                          : t("demo.history.viewResult")}
                      </span>
                      {isExpanded ? (
                        <ChevronUp size={12} aria-hidden="true" />
                      ) : (
                        <ChevronDown size={12} aria-hidden="true" />
                      )}
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 border-t border-hairline pt-3">
                      <DemoResultCard result={item.result} isRecorded={false} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recorded Demonstrations Section */}
      <div className="rounded border border-hairline bg-surface p-4 sm:p-5">
        <div className="mb-3">
          <h2 className="font-mono text-sm font-semibold tracking-tight text-ink">
            {t("demo.history.recordedTitle")}
          </h2>
          <p className="font-mono text-[11.5px] text-ink-secondary mt-0.5">
            {t("demo.history.recordedDesc", {
              revision: OKX_DEMO_RECORDED.revision,
              time: OKX_DEMO_RECORDED.capturedAt,
            })}
          </p>
        </div>

        <div className="space-y-2">
          {recordedCases.map((demoCase) => {
            const isExpanded = expandedRecordedKey === demoCase.key;
            const isPass = demoCase.verdict === "PASS" || demoCase.verdict === "GO";
            const isFail = demoCase.verdict === "FAIL" || demoCase.verdict === "NO_GO";

            return (
              <div
                key={demoCase.key}
                className="rounded border border-hairline bg-inset p-3 font-mono text-[11.5px]"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag
                      tone={isPass ? "success" : isFail ? "danger" : "warning"}
                      size="sm"
                      className="font-bold uppercase"
                    >
                      {demoCase.verdict}
                    </Tag>
                    <span className="font-medium text-ink">{demoCase.title}</span>
                    <span className="text-hairline">·</span>
                    <span className="text-ink-secondary">{demoCase.tool}</span>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setExpandedRecordedKey(isExpanded ? null : demoCase.key)
                    }
                    className="font-mono text-[11px] self-start sm:self-auto"
                  >
                    <span>
                      {isExpanded
                        ? t("demo.history.hideResult")
                        : t("demo.history.viewResult")}
                    </span>
                    {isExpanded ? (
                      <ChevronUp size={12} aria-hidden="true" />
                    ) : (
                      <ChevronDown size={12} aria-hidden="true" />
                    )}
                  </Button>
                </div>

                {isExpanded && (
                  <div className="mt-3 border-t border-hairline pt-3">
                    <DemoResultCard
                      result={demoCase.result}
                      isRecorded={true}
                      capturedAt={OKX_DEMO_RECORDED.capturedAt}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
