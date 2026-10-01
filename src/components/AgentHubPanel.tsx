import { useCallback, useEffect, useRef, useState } from "react";
import { useStore, type Bot } from "@/state/store";
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

export type AgentHubTab = "agents" | "asps" | "mcp";

export interface AgentHubPanelProps {
  initialCatalog?: CatalogAgent[];
  initialServices?: HubService[];
  initialError?: string | null;
}

export function AgentHubPanel({
  initialCatalog,
  initialServices,
  initialError,
}: AgentHubPanelProps = {}) {
  const { state, dispatch } = useStore();
  const dialogRef = useRef<HTMLDivElement>(null);

  const surface = state.pluginsSurface;
  const storeHubTab = (state as { hubTab?: "agents" | "asps" | "mcp" }).hubTab;

  const [activeTab, setActiveTab] = useState<AgentHubTab>(() => {
    if (storeHubTab) return storeHubTab;
    return surface === "mcp" ? "mcp" : "agents";
  });

  // Sync activeTab when store hubTab or pluginsSurface changes
  useEffect(() => {
    if (storeHubTab) {
      setActiveTab(storeHubTab);
    } else if (surface === "mcp") {
      setActiveTab("mcp");
    }
  }, [storeHubTab, surface]);

  const [catalog, setCatalog] = useState<CatalogAgent[] | null>(initialCatalog ?? null);
  const [stale, setStale] = useState(false);
  const [freeMcpService, setFreeMcpService] = useState<HubService | null>(
    initialServices?.[0] ?? null,
  );
  const [loading, setLoading] = useState(initialCatalog === undefined && !initialError);
  const [error, setError] = useState<string | null>(initialError ?? null);
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
    if (tab === "mcp") {
      dispatch({ type: "togglePlugins", open: true, surface: "mcp", hubTab: "mcp" });
    } else {
      dispatch({ type: "togglePlugins", open: true, surface: "hub", hubTab: tab });
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

  // Current room
  const currentRoom =
    (state.groups ?? []).find((g) => g.id === state.selectedId) ??
    (state.groups ?? []).find((g) => !g.dm) ??
    null;

  // Section 1: Imported into this room (current room members with okxImport)
  const importedInRoomBots = currentRoom
    ? (state.bots ?? []).filter(
        (b) => currentRoom.memberIds?.includes(b.id) && Boolean(b.okxImport),
      )
    : [];

  const matchingImportedInRoom = importedInRoomBots.filter((b) => {
    if (!query) return true;
    return (
      b.name.toLowerCase().includes(query) ||
      (b.description && b.description.toLowerCase().includes(query)) ||
      (b.okxImport?.externalAgentId &&
        b.okxImport.externalAgentId.toLowerCase().includes(query))
    );
  });

  // Section 2: Available from OKX.AI catalog
  const catalogAgents = (catalog ?? []).map((cat) => {
    const merged = mergedAgents.find((m) => m.id === cat.id);
    return (
      merged ?? {
        id: cat.id,
        name: cat.name,
        summary: cat.description,
        provider: cat.provider,
        capabilities: [...cat.capabilities],
        rooms: [],
      }
    );
  });

  const matchingCatalogAgents = catalogAgents.filter((agent) => {
    if (!query) return true;
    return (
      agent.name.toLowerCase().includes(query) ||
      agent.summary.toLowerCase().includes(query) ||
      agent.provider.toLowerCase().includes(query) ||
      agent.capabilities.some((c) => c.toLowerCase().includes(query))
    );
  });

  // Section 3: Local workspace agents (non-OKX bots)
  const localWorkspaceBots = (state.bots ?? []).filter(
    (b) => !b.okxImport || b.okxImport.kind !== "okx-catalog",
  );

  const matchingLocalBots = localWorkspaceBots.filter((b) => {
    if (!query) return true;
    return (
      b.name.toLowerCase().includes(query) ||
      (b.description && b.description.toLowerCase().includes(query)) ||
      (b.title && b.title.toLowerCase().includes(query))
    );
  });

  // ASPs tab matching services
  const matchingServices: HubService[] =
    freeMcpService &&
    (!query ||
      freeMcpService.name.toLowerCase().includes(query) ||
      freeMcpService.endpoint.toLowerCase().includes(query) ||
      (freeMcpService.okxAgentId && freeMcpService.okxAgentId.includes(query)) ||
      freeMcpService.tools.some(
        (tool) =>
          tool.name.toLowerCase().includes(query) ||
          tool.description.toLowerCase().includes(query),
      ))
      ? [freeMcpService]
      : [];

  const hubAgentForBot = (bot: Bot): HubAgent => {
    const matchingHub = mergedAgents.find(
      (a) => a.id === bot.okxImport?.externalAgentId || a.importedBotId === bot.id,
    );
    if (matchingHub) return matchingHub;
    return {
      id: bot.okxImport?.externalAgentId ?? bot.id,
      name: bot.name,
      summary: bot.description,
      provider: bot.okxImport?.provider ?? "OKX.ai",
      capabilities: bot.okxImport?.capabilities ? [...bot.okxImport.capabilities] : [],
      importedBotId: bot.id,
      rooms: (state.groups ?? [])
        .filter((g) => !g.dm && g.memberIds?.includes(bot.id))
        .map((g) => ({ id: g.id, name: g.name })),
    };
  };

  const hubAgentForLocalBot = (bot: Bot): HubAgent => ({
    id: bot.id,
    name: bot.name,
    summary: bot.description || bot.title || "",
    provider: "Local workspace",
    capabilities: [],
    importedBotId: bot.id,
    rooms: (state.groups ?? [])
      .filter((g) => !g.dm && g.memberIds?.includes(bot.id))
      .map((g) => ({ id: g.id, name: g.name })),
  });

  const isAgentsSearchEmpty =
    !loading &&
    query !== "" &&
    matchingImportedInRoom.length === 0 &&
    matchingCatalogAgents.length === 0 &&
    matchingLocalBots.length === 0;

  const isAspsSearchEmpty =
    !loading &&
    query !== "" &&
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
        className="mx-4 my-auto flex h-[min(820px,calc(100dvh-2rem))] w-[calc(100vw-2rem)] max-w-[1040px] flex-col overflow-hidden"
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

        {/* Tab navigation: Agents / ASPs / MCP servers */}
        <div className="frame-rule-below shrink-0 px-5 sm:px-6">
          <div className="flex gap-6" role="tablist" aria-label={t("okxHub.title")}>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "agents"}
              onClick={() => handleTabChange("agents")}
              className={cn(
                "border-b-2 px-1 pb-2.5 pt-2 text-[13px] font-medium transition-colors",
                activeTab === "agents"
                  ? "border-accent text-ink"
                  : "border-transparent text-ink-secondary hover:text-ink",
              )}
            >
              Agents
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "asps"}
              onClick={() => handleTabChange("asps")}
              className={cn(
                "border-b-2 px-1 pb-2.5 pt-2 text-[13px] font-medium transition-colors",
                activeTab === "asps"
                  ? "border-accent text-ink"
                  : "border-transparent text-ink-secondary hover:text-ink",
              )}
            >
              ASPs
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "mcp"}
              onClick={() => handleTabChange("mcp")}
              className={cn(
                "border-b-2 px-1 pb-2.5 pt-2 text-[13px] font-medium transition-colors",
                activeTab === "mcp"
                  ? "border-accent text-ink"
                  : "border-transparent text-ink-secondary hover:text-ink",
              )}
            >
              MCP servers
            </button>
          </div>
        </div>

        {/* MCP servers tab content */}
        {activeTab === "mcp" ? (
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
          /* Hub Body (Agents / ASPs) */
          <DialogBody className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 sm:p-6">
            {/* Stale cache banner */}
            {stale && (
              <div
                role="status"
                aria-live="polite"
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

            {/* Catalog unavailable error state */}
            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="flex flex-col items-center justify-center gap-2 border border-danger/40 bg-card p-6 text-center"
              >
                <span className="text-[13px] font-medium text-danger">
                  The OKX catalog is temporarily unavailable.
                </span>
                <span className="text-[12px] text-ink-secondary">
                  Your imported agents and local ASP data are still available.
                </span>
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void loadData()}
                    className="gap-1.5"
                  >
                    <RefreshCw size={12} />
                    Retry
                  </Button>
                </div>
              </div>
            )}

            {/* Loading state */}
            {loading && catalog === null && (
              <div className="flex items-center justify-center gap-2 py-24 font-mono text-[12px] text-ink-secondary">
                <Loader2 size={16} className="animate-spin" />
                <span>{t("okxHub.loading")}</span>
              </div>
            )}

            {/* AGENTS TAB CONTENT */}
            {!loading && activeTab === "agents" && (
              <div className="flex flex-col gap-6">
                {/* Search empty state */}
                {isAgentsSearchEmpty && (
                  <div className="flex min-h-56 flex-col items-center justify-center border border-dashed border-hairline p-6 text-center">
                    <p className="font-mono text-[12px] text-ink-secondary">
                      {t("okxHub.noResults", { query: search })}
                    </p>
                  </div>
                )}

                {/* Section 1: Imported into this room */}
                {matchingImportedInRoom.length > 0 && (
                  <div>
                    <div className="mb-2 label-mono text-ink">
                      [ Imported into this room ]
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {matchingImportedInRoom.map((bot) => (
                        <AgentCard
                          key={bot.id}
                          bot={bot}
                          agent={hubAgentForBot(bot)}
                          currentRoomId={currentRoom?.id}
                          onSelect={setSelectedAgent}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Section 2: Available from OKX.AI catalog */}
                {!error && catalog && catalog.length === 0 ? (
                  /* No agents available state */
                  <div className="flex min-h-56 flex-col items-center justify-center border border-dashed border-hairline p-6 text-center">
                    <p className="font-mono text-[13px] font-medium text-ink">
                      No OKX agents are available yet.
                    </p>
                    <p className="mt-1 font-mono text-[12px] text-ink-secondary">
                      Try refreshing the catalog or open MCP servers to configure a compatible service.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => void loadData()}>
                        <RefreshCw size={12} className="mr-1 inline" /> Refresh
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleTabChange("mcp")}>
                        Open MCP servers
                      </Button>
                    </div>
                  </div>
                ) : (
                  matchingCatalogAgents.length > 0 && (
                    <div>
                      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                        <div className="label-mono text-ink">
                          [ Available from OKX.AI catalog ]
                        </div>
                        <div className="font-mono text-[11px] text-ink-secondary">
                          OKX.AI catalog · local registry
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {matchingCatalogAgents.map((agent) => (
                          <AgentCard
                            key={agent.id}
                            agent={agent}
                            currentRoomId={currentRoom?.id}
                            onSelect={setSelectedAgent}
                          />
                        ))}
                      </div>
                    </div>
                  )
                )}

                {/* Section 3: Local workspace agents */}
                {matchingLocalBots.length > 0 && (
                  <div>
                    <div className="mb-2 label-mono text-ink">
                      [ Local workspace agents ]
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {matchingLocalBots.map((bot) => (
                        <AgentCard
                          key={bot.id}
                          bot={bot}
                          agent={hubAgentForLocalBot(bot)}
                          currentRoomId={currentRoom?.id}
                          onSelect={setSelectedAgent}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ASPS TAB CONTENT */}
            {!loading && activeTab === "asps" && (
              <div className="flex flex-col gap-6">
                {isAspsSearchEmpty ? (
                  <div className="flex min-h-56 flex-col items-center justify-center border border-dashed border-hairline p-6 text-center">
                    <p className="font-mono text-[13px] font-medium text-ink">
                      No ASPs match this search.
                    </p>
                    <p className="mt-1 font-mono text-[12px] text-ink-secondary">
                      Try an agent ID, endpoint URL, or category.
                    </p>
                  </div>
                ) : (
                  matchingServices.length > 0 && (
                    <div className="flex flex-col gap-3">
                      {matchingServices.map((service) => (
                        <AspServiceCard
                          key={service.id}
                          service={service}
                        />
                      ))}
                    </div>
                  )
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
