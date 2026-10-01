import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/state/store";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import {
  loadHubCatalog,
  mergeHubAgents,
  loadFreeMcpService,
  type CatalogAgent,
  type HubAgent,
  type HubService,
} from "@/lib/agent-hub";
import { DialogBackdrop, DialogBody, DialogHeader, DialogPanel } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { McpServersPanel } from "./McpServersPanel";
import { AgentCard } from "./agent-hub/AgentCard";
import { AspServiceCard } from "./agent-hub/AspServiceCard";
import { AgentDetail } from "./agent-hub/AgentDetail";
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

export type AgentHubTab = "discover" | "workspace" | "customMcp";

let sessionLastCheck: string | null = null;

export interface AgentHubPanelProps {
  initialCatalog?: CatalogAgent[];
  initialServices?: HubService[];
}

export function AgentHubPanel({
  initialCatalog,
  initialServices,
}: AgentHubPanelProps = {}) {
  const { state, dispatch } = useStore();
  const dialogRef = useRef<HTMLDivElement>(null);

  const surface = state.pluginsSurface;
  const [activeTab, setActiveTab] = useState<AgentHubTab>(
    surface === "mcp" ? "customMcp" : "discover",
  );

  // Sync activeTab if pluginsSurface changes from outside
  useEffect(() => {
    if (surface === "mcp") {
      setActiveTab("customMcp");
    } else if (activeTab === "customMcp") {
      setActiveTab("discover");
    }
  }, [surface]);

  const [catalog, setCatalog] = useState<CatalogAgent[] | null>(initialCatalog ?? null);
  const [stale, setStale] = useState(false);
  const [freeMcpService, setFreeMcpService] = useState<HubService | null>(
    initialServices?.[0] ?? null,
  );
  const [lastCheck, setLastCheck] = useState<string | null>(sessionLastCheck);
  const [loading, setLoading] = useState(initialCatalog === undefined);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<HubAgent | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catalogRes, mcpRes] = await Promise.all([
        loadHubCatalog(),
        loadFreeMcpService().catch(() => null),
      ]);
      setCatalog(catalogRes.agents);
      setStale(catalogRes.stale);
      if (mcpRes) {
        setFreeMcpService(mcpRes);
        const now = new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        sessionLastCheck = now;
        setLastCheck(now);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("okxHub.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Focus trap and Escape key listener
  useEffect(() => {
    const returnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    (dialog?.querySelector<HTMLElement>("input") ?? focusable()[0] ?? dialog)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dispatch({ type: "togglePlugins", open: false });
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items.at(-1)!;
      if (
        event.shiftKey &&
        (document.activeElement === first || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      returnFocus?.focus();
    };
  }, [dispatch]);
  const close = () => dispatch({ type: "togglePlugins", open: false });

  const handleTabChange = (tab: AgentHubTab) => {
    setActiveTab(tab);
    setSelectedAgent(null);
    if (tab === "customMcp") {
      dispatch({ type: "togglePlugins", open: true, surface: "mcp" });
    } else if (surface === "mcp") {
      dispatch({ type: "togglePlugins", open: true, surface: "hub" });
    }
  };

  const handleOpenApps = () => {
    dispatch({ type: "togglePlugins", open: true, surface: "apps" });
  };

  // Merge hub agents
  const mergedAgents: HubAgent[] = mergeHubAgents(
    catalog ?? [],
    state.bots ?? [],
    state.groups ?? [],
  );

  const query = search.trim().toLowerCase();

  const matchingAgents = mergedAgents.filter((agent) => {
    if (!query) return true;
    return (
      agent.name.toLowerCase().includes(query) ||
      agent.summary.toLowerCase().includes(query) ||
      agent.provider.toLowerCase().includes(query) ||
      agent.capabilities.some((c) => c.toLowerCase().includes(query))
    );
  });

  const matchingServices: HubService[] =
    freeMcpService &&
    (!query ||
      freeMcpService.name.toLowerCase().includes(query) ||
      freeMcpService.endpoint.toLowerCase().includes(query) ||
      freeMcpService.tools.some((tool) =>
        tool.name.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query),
      ))
      ? [freeMcpService]
      : [];

  const workspaceAgents = matchingAgents.filter((agent) => agent.rooms.length > 0);

  const isTotalEmpty =
    !loading &&
    !error &&
    mergedAgents.length === 0 &&
    !freeMcpService;

  const isSearchEmpty =
    !loading &&
    !error &&
    query !== "" &&
    matchingAgents.length === 0 &&
    matchingServices.length === 0;

  return (
    <DialogBackdrop onDismiss={close}>
      <DialogPanel
        ref={dialogRef}
        data-tour="apps-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-hub-title"
        tabIndex={-1}
        className="flex h-[min(820px,calc(100dvh-2rem))] w-full max-w-[1040px] flex-col overflow-hidden"
      >
        <DialogHeader
          title={t("okxHub.title")}
          titleId="agent-hub-title"
          subtitle={t("okxHub.subtitle")}
          actions={
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                icon
                data-tour="apps-close"
                onClick={close}
                aria-label={t("okxHub.action.close")}
              >
                <X size={15} />
              </Button>
            </div>
          }
        />

        {/* Tab navigation */}
        <div className="frame-rule-below shrink-0 px-5 sm:px-6">
          <div className="flex gap-6" role="tablist" aria-label={t("okxHub.title")}>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "discover"}
              onClick={() => handleTabChange("discover")}
              className={cn(
                "border-b-2 px-1 pb-2.5 pt-2 text-[13px] font-medium transition-colors",
                activeTab === "discover"
                  ? "border-accent text-ink"
                  : "border-transparent text-ink-secondary hover:text-ink",
              )}
            >
              {t("okxHub.tab.discover")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "workspace"}
              onClick={() => handleTabChange("workspace")}
              className={cn(
                "border-b-2 px-1 pb-2.5 pt-2 text-[13px] font-medium transition-colors",
                activeTab === "workspace"
                  ? "border-accent text-ink"
                  : "border-transparent text-ink-secondary hover:text-ink",
              )}
            >
              {t("okxHub.tab.workspace")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "customMcp"}
              onClick={() => handleTabChange("customMcp")}
              className={cn(
                "border-b-2 px-1 pb-2.5 pt-2 text-[13px] font-medium transition-colors",
                activeTab === "customMcp"
                  ? "border-accent text-ink"
                  : "border-transparent text-ink-secondary hover:text-ink",
              )}
            >
              {t("okxHub.tab.customMcp")}
            </button>
          </div>
        </div>

        {/* Custom MCP Tab content */}
        {activeTab === "customMcp" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <McpServersPanel />
          </div>
        ) : selectedAgent ? (
          /* Agent Detail View */
          <div className="min-h-0 flex-1 overflow-y-auto">
            <AgentDetail
              agent={selectedAgent}
              onBack={() => setSelectedAgent(null)}
            />
          </div>
        ) : (
          /* Hub Body (Discover / Workspace) */
          <DialogBody className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 sm:p-6">
            {/* Stale cache banner */}
            {stale && (
              <div
                role="status"
                className="flex items-start gap-2 border border-warning bg-card px-3 py-2 text-[12px] text-warning"
              >
                <AlertTriangle size={14} className="mt-px shrink-0" />
                <span>{t("okxHub.staleBanner")}</span>
              </div>
            )}

            {/* Search bar */}
            <div className="relative w-full sm:w-[320px]">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-secondary"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("okxHub.searchPlaceholder")}
                aria-label={t("okxHub.searchPlaceholder")}
                className="pl-8"
              />
            </div>

            {/* Error state */}
            {error && (
              <div
                role="alert"
                className="flex flex-col items-center justify-center gap-3 border border-danger/40 bg-card p-6 text-center"
              >
                <span className="text-[13px] text-danger">{error}</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void loadData()}
                  className="gap-1.5"
                >
                  <RefreshCw size={12} />
                  {t("okxHub.action.retry")}
                </Button>
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div className="flex items-center justify-center gap-2 py-24 font-mono text-[12px] text-ink-secondary">
                <Loader2 size={16} className="animate-spin" />
                <span>{t("okxHub.loading")}</span>
              </div>
            )}

            {/* Empty state: No OKX agents or ASPs found */}
            {isTotalEmpty && (
              <div className="flex min-h-56 flex-col items-center justify-center border border-dashed border-hairline p-6 text-center">
                <p className="font-mono text-[12px] text-ink-secondary">
                  {t("okxHub.empty")}
                </p>
              </div>
            )}

            {/* No search results */}
            {isSearchEmpty && (
              <div className="flex min-h-56 flex-col items-center justify-center border border-dashed border-hairline p-6 text-center">
                <p className="font-mono text-[12px] text-ink-secondary">
                  {t("okxHub.noResults", { query: search })}
                </p>
              </div>
            )}

            {/* Discover tab content */}
            {!loading && !error && activeTab === "discover" && !isTotalEmpty && !isSearchEmpty && (
              <div className="flex flex-col gap-6">
                {/* Agents section */}
                {matchingAgents.length > 0 && (
                  <div>
                    <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                      <div className="label-mono text-ink">
                        [ {t("okxHub.agentsSection")} ]
                      </div>
                      <div className="font-mono text-[11px] text-ink-secondary">
                        {t("okxHub.catalogSource")}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {matchingAgents.map((agent) => (
                        <AgentCard
                          key={agent.id}
                          agent={agent}
                          viewMode="discover"
                          onSelect={setSelectedAgent}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* ASP services section */}
                {matchingServices.length > 0 && (
                  <div>
                    <div className="mb-2 label-mono text-ink">
                      [ {t("okxHub.aspServicesSection")} ]
                    </div>
                    <div className="flex flex-col gap-3">
                      {matchingServices.map((service) => (
                        <AspServiceCard
                          key={service.id}
                          service={service}
                          lastCheck={lastCheck ?? undefined}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Workspace tab content */}
            {!loading && !error && activeTab === "workspace" && (
              <div>
                {workspaceAgents.length === 0 ? (
                  <div className="flex min-h-56 flex-col items-center justify-center border border-dashed border-hairline p-6 text-center">
                    <p className="font-mono text-[12px] text-ink-secondary">
                      {t("okxHub.workspaceEmpty")}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {workspaceAgents.map((agent) => (
                      <AgentCard
                        key={agent.id}
                        agent={agent}
                        viewMode="workspace"
                        onSelect={setSelectedAgent}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}


          </DialogBody>
        )}

        {/* Bottom link to App integrations */}
        <div className="frame-rule-above flex shrink-0 items-center justify-between bg-card px-6 py-2.5">
          <button
            type="button"
            onClick={handleOpenApps}
            className="flex items-center gap-1.5 font-mono text-[12px] text-ink-secondary underline underline-offset-2 hover:text-ink"
          >
            <span>{t("okxHub.appIntegrationsLink")}</span>
            <ExternalLink size={11} />
          </button>
        </div>
      </DialogPanel>
    </DialogBackdrop>
  );
}
