import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { api } from "@/state/store";
import { OKX_DEMO_IDENTITY, OKX_DEMO_TOOLS, type OkxDemoCheckResult, type OkxDemoStatus } from "../../../shared/okx-demo-identity";
import { OKX_DEMO_RECORDED } from "../../../shared/okx-demo-recorded";
import { t } from "@/lib/i18n";
import { DemoHeader } from "./DemoHeader";
import { DemoCheckTab } from "./DemoCheckTab";
import { DemoServiceTab } from "./DemoServiceTab";
import { DemoHistoryTab, type DemoHistoryEntry } from "./DemoHistoryTab";
import { DemoFooter } from "./DemoFooter";
import { X } from "lucide-react";

const STORAGE_KEY_INTRO_DISMISSED = "kind-meitner:demo-intro-dismissed";
const STORAGE_KEY_HISTORY = "kind-meitner:demo-history";

type TabId = "demo" | "service" | "history";

export function DemoView({ onExit, onOpenChat }: { onExit: () => void; onOpenChat: () => Promise<void> | void }) {
  const [activeTab, setActiveTab] = useState<TabId>("demo");
  const [status, setStatus] = useState<OkxDemoStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [introDismissed, setIntroDismissed] = useState(true);
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null);
  const [liveHistory, setLiveHistory] = useState<DemoHistoryEntry[]>([]);

  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    demo: null,
    service: null,
    history: null,
  });

  // Check localStorage on mount
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY_INTRO_DISMISSED);
      if (!dismissed) {
        setIntroDismissed(false);
      }

      const storedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (storedHistory) {
        const parsed = JSON.parse(storedHistory) as DemoHistoryEntry[];
        if (Array.isArray(parsed)) {
          setLiveHistory(parsed.slice(0, 20));
          if (parsed.length > 0 && parsed[0]?.time) {
            setLastCheckTime(new Date(parsed[0].time).toLocaleTimeString());
          }
        }
      }
    } catch {
      // Best-effort storage
    }
  }, []);

  // Fetch status on mount
  useEffect(() => {
    let mounted = true;
    api("/api/okx/demo/status")
      .then((data: OkxDemoStatus) => {
        if (mounted) {
          setStatus(data);
          setStatusLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setStatus({
            ok: false,
            source: "live",
            endpointUrl: OKX_DEMO_IDENTITY.endpointUrl,
            checkedAt: new Date().toISOString(),
            latencyMs: 0,
            tools: OKX_DEMO_RECORDED.status.tools,
            demoToolsAvailable: false,
            safeMessage: err instanceof Error ? err.message : "Unavailable",
          });
          setStatusLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const dismissIntro = () => {
    setIntroDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY_INTRO_DISMISSED, "1");
    } catch {}
  };

  const handleCheckSuccess = (
    result: OkxDemoCheckResult & { ok: true },
    verdict: string,
  ) => {
    const formatted = new Date(result.startedAt).toLocaleTimeString();
    setLastCheckTime(formatted);

    const inputDesc =
      result.tool === OKX_DEMO_TOOLS.endpoint
        ? (result.arguments.endpointUrl ?? result.endpointUrl)
        : (result.arguments.agentId ?? OKX_DEMO_IDENTITY.agentId);

    const newEntry: DemoHistoryEntry = {
      id: result.requestId || `hist-${Date.now()}`,
      time: result.startedAt,
      tool: result.tool,
      input: inputDesc,
      verdict,
      result,
    };

    setLiveHistory((prev) => {
      const next = [newEntry, ...prev.filter((i) => i.id !== newEntry.id)].slice(0, 20);
      try {
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "demo", label: t("demo.tabs.demo") },
    { id: "service", label: t("demo.tabs.service") },
    { id: "history", label: t("demo.tabs.evidence") },
  ];

  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, currentId: TabId) => {
    const tabIds: TabId[] = ["demo", "service", "history"];
    const currentIndex = tabIds.indexOf(currentId);

    let nextIndex = -1;
    if (e.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % tabIds.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + tabIds.length) % tabIds.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = tabIds.length - 1;
    }

    if (nextIndex >= 0) {
      e.preventDefault();
      const nextId = tabIds[nextIndex];
      setActiveTab(nextId);
      tabRefs.current[nextId]?.focus();
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-app text-ink">
      <DemoHeader
        status={status}
        statusLoading={statusLoading}
        lastCheckTime={lastCheckTime}
        onExit={onExit}
      />

      <main className="flex-1 px-4 py-5 sm:px-6 max-w-5xl w-full mx-auto min-w-0">
        {/* Dismissible one-sentence intro */}
        {!introDismissed && (
          <div className="mb-5 flex items-start justify-between gap-3 rounded border border-hairline bg-surface p-3 sm:p-4 font-mono text-[12px] leading-relaxed text-ink shadow-sm">
            <p className="min-w-0 flex-1">{t("demo.intro.text")}</p>
            <button
              type="button"
              onClick={dismissIntro}
              aria-label={t("demo.intro.dismiss")}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded text-ink-secondary hover:bg-raised-hover hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Tab navigation */}
        <div className="mb-6 border-b border-hairline">
          <div
            role="tablist"
            aria-label={t("demo.tabs.label")}
            className="flex items-center gap-1 -mb-px overflow-x-auto"
          >
            {tabs.map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={(el) => {
                    tabRefs.current[tab.id] = el;
                  }}
                  id={`demo-tab-${tab.id}`}
                  role="tab"
                  type="button"
                  aria-selected={isSelected}
                  aria-controls={`demo-panel-${tab.id}`}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
                  className={`border-b-2 px-3.5 py-2 font-mono text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus whitespace-nowrap ${
                    isSelected
                      ? "border-accent font-semibold text-ink"
                      : "border-transparent text-ink-secondary hover:border-hairline hover:text-ink"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab panels stay mounted so typed input and a running check survive
            switching tabs; inactive panels are hidden, not destroyed. */}
        {tabs.map((tab) => (
          <div
            key={tab.id}
            role="tabpanel"
            id={`demo-panel-${tab.id}`}
            aria-labelledby={`demo-tab-${tab.id}`}
            hidden={activeTab !== tab.id}
            className="min-w-0"
          >
            {tab.id === "demo" && <DemoCheckTab onCheckSuccess={handleCheckSuccess} />}
            {tab.id === "service" && <DemoServiceTab status={status} />}
            {tab.id === "history" && <DemoHistoryTab liveHistory={liveHistory} />}
          </div>
        ))}
      </main>

      <DemoFooter onOpenChat={onOpenChat} />
    </div>
  );
}
