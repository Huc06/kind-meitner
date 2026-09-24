import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  Loader2,
  Network,
  Plus,
  Minus,
  Save,
  Users,
  X,
  Sparkles,
  LayoutGrid,
  Map as MapIcon,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { api, useStore, type Bot } from "@/state/store";
import {
  EMPTY_TEAM_MAP_SNAPSHOT,
  buildTeamMapEdges,
  buildTeamMapSections,
  type TeamMapSnapshot,
  type TeamMapEdge,
} from "@/lib/team-map";
import { cn } from "@/lib/cn";
import { TeamCanvas, type BotWorkflowInfo } from "./TeamCanvas";
import { TeamMapBoardView } from "./TeamMapBoardView";
import { TeamDialog } from "./TeamDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { TeamMapWorkflowDrawer } from "./TeamMapWorkflowDrawer";
import { TeamMapWowFacts } from "./TeamMapWowFacts";
import { TeamMapActivityFeed } from "./TeamMapActivityFeed";
import { TeamMapHandoffList, deduplicateHandoffs, type UnifiedHandoffItem } from "./TeamMapHandoffList";
import { TeamMapCommandMenu, type CommandMenuItem } from "./TeamMapCommandMenu";
import {
  deriveAttentionItems,
  getTeamMapDataMode,
  type TeamMapDataMode,
} from "@/lib/team-map-attention";
import {
  buildSampleWorkflowSnapshot,
  type BotRoleMapping,
} from "@/lib/team-map-sample-workflow";
import { createEmptyWorkflow, computeWowFacts, type WorkflowArtifact } from "@/lib/team-map-workflow";
import type { ActivityKind } from "@/lib/team-map-demo-ui";
import { t } from "@/lib/i18n";

function SectionContextDialog({ section, label, onClose }: { section: string; label: string; onClose: () => void }) {
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const maxBytes = 12_000;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api(`/api/sidebar-sections?section=${encodeURIComponent(section)}`)
      .then((body: { text?: string }) => {
        if (cancelled) return;
        setText(body?.text ?? "");
        setDirty(false);
        setLoading(false);
        requestAnimationFrame(() => textareaRef.current?.focus());
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [section]);

  const bytes = useMemo(() => new TextEncoder().encode(text).length, [text]);

  const requestClose = useCallback(() => {
    if (!dirty || confirm(t("team.instructionsDiscard"))) {
      onClose();
    }
  }, [dirty, onClose]);

  const save = useCallback(async () => {
    if (saving || !dirty || bytes > maxBytes) return;
    setSaving(true);
    setError(null);
    try {
      await api("/api/sidebar-sections", {
        method: "PUT",
        body: JSON.stringify({ name: section, text }),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }, [saving, dirty, bytes, maxBytes, section, text, onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="section-instructions-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          requestClose();
        }
      }}
    >
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-hairline/60 bg-panel shadow-2xl">
        <header className="flex items-center justify-between border-b border-hairline/40 px-6 py-4 sm:px-8">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-accent" />
            <h3 id="section-instructions-title" className="text-[15px] font-semibold text-ink">
              {t("team.instructionsTitle", { name: label })}
            </h3>
          </div>
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={requestClose}
            className="rounded-lg p-1.5 text-ink-secondary hover:bg-control hover:text-ink"
          >
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-8">
          <p className="text-[12.5px] leading-relaxed text-ink-secondary">
            {t("team.instructionsHint")}
          </p>

          <textarea
            ref={textareaRef}
            disabled={loading || saving}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setDirty(true);
            }}
            placeholder={t("room.setup.instructionsPlaceholder")}
            rows={8}
            className="mt-3 w-full rounded-xl border border-hairline/50 bg-inset p-3.5 font-mono text-[12.5px] leading-relaxed text-ink placeholder:text-ink-secondary/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />

          <div className="mt-2 flex items-center justify-between text-[11px] text-ink-secondary">
            <span>
              {bytes} / {maxBytes} bytes
            </span>
            {bytes > maxBytes && <span className="text-danger font-medium">Text too large</span>}
          </div>

          {error && <div className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">{error}</div>}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-hairline/40 px-6 py-4 sm:px-8">
          <button onClick={requestClose} disabled={saving} className="rounded-lg px-3.5 py-2 text-[13px] text-ink-secondary hover:bg-raised hover:text-ink disabled:opacity-40">
            Cancel
          </button>
          <button
            onClick={() => void save()}
            disabled={loading || saving || !dirty || bytes > maxBytes}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-white hover:brightness-110 disabled:opacity-40"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {t("team.instructionsSave")}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

export function TeamMapPage() {
  const { state, dispatch } = useStore();
  const remoteClient = window.ogb?.remoteClient?.active === true;
  const [snapshot, setSnapshot] = useState<TeamMapSnapshot>(EMPTY_TEAM_MAP_SNAPSHOT);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [contextEditor, setContextEditor] = useState<{ section: string; label: string } | null>(null);
  const [teamEditor, setTeamEditor] = useState<{ section?: string; rename?: boolean } | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<string | null>(null);
  const [logBot, setLogBot] = useState<Bot | null>(null);
  void error;
  void setError;
  void refreshError;
  void deletingTeam;

  // View Mode & Operational Toolbar State (Default is Board View)
  const [viewMode, setViewMode] = useState<"board" | "map">("map");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  void setSearchQuery;
  void setStatusFilter;
  const [onlyNeedsAttention, setOnlyNeedsAttention] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);

  // Workflow Drawer & Inspection States
  const [selectedWorkflowBotId, setSelectedWorkflowBotId] = useState<string | null>(null);
  const [selectedWorkflowTaskId, setSelectedWorkflowTaskId] = useState<string | null>(null);
  const [highlightBotIds, setHighlightBotIds] = useState<string[]>([]);
  const [factsFilter, setFactsFilter] = useState<ActivityKind | "all">("all");
  const [activeMetricId, setActiveMetricId] = useState<string | null>(null);
  const [unblockedTaskIds, setUnblockedTaskIds] = useState<string[]>([]);
  const [approvedArtifactIds, setApprovedArtifactIds] = useState<string[]>([]);
  const [pendingMove, setPendingMove] = useState<{ bot: Bot; destination: string; resolve: (moved: boolean) => void } | null>(null);
  const pendingMoveRef = useRef(pendingMove);
  pendingMoveRef.current = pendingMove;
  useEffect(() => () => pendingMoveRef.current?.resolve(false), []);

  const bots = useMemo(() => state.bots.filter((bot) => !bot.hidden), [state.bots]);

  // Determine Authoritative Data Mode (Default is Live/Empty, Sample requires explicit fixture flag)
  const dataMode = useMemo<TeamMapDataMode>(() => {
    return getTeamMapDataMode({
      search: typeof window !== "undefined" ? window.location.search : "",
      hasLiveWorkflow: false,
      isError: Boolean(refreshError),
    });
  }, [refreshError]);

  // Map workspace bots into sample roles ONLY when explicit sample mode is active
  const botRoleMapping = useMemo<BotRoleMapping>(() => {
    const findBot = (pattern: RegExp) => bots.find((b) => pattern.test(b.name) || pattern.test(b.id))?.id;
    return {
      coordinatorId: findBot(/tuli/i) ?? bots[0]?.id ?? "tuli",
      discoveryId: findBot(/markets/i) ?? bots[1]?.id ?? "markets",
      listingCoachId: findBot(/listing/i) ?? bots[2]?.id ?? "listing-coach",
      escrowId: findBot(/atlas/i) ?? bots[3]?.id ?? "atlas",
      reviewerId: findBot(/spend|scout/i) ?? bots[4]?.id ?? "spend-scout",
    };
  }, [bots]);

  // Only generate sample workflow when explicitly requested via fixture flag; otherwise keep empty
  const { workflowSnapshot, wowFacts } = useMemo(() => {
    if (dataMode === "sample") {
      const sample = buildSampleWorkflowSnapshot(botRoleMapping);
      const tasks = sample.snapshot.tasks.map((t) => {
        if (unblockedTaskIds.includes(t.id)) {
          return { ...t, state: "active" as const, progress: 100 };
        }
        return t;
      });
      const agents = sample.snapshot.agents.map((a) => {
        const ownedTask = tasks.find((t) => t.ownerAgentId === a.id);
        if (ownedTask && unblockedTaskIds.includes(ownedTask.id)) {
          return { ...a, presence: "working" as const };
        }
        return a;
      });
      const artifacts: WorkflowArtifact[] = (sample.snapshot.artifacts ?? []).map((art) => {
        if (approvedArtifactIds.includes(art.id)) {
          return { ...art, reviewState: "approved" as const, status: "verified" as const };
        }
        return art;
      });
      return { workflowSnapshot: { ...sample.snapshot, tasks, agents, artifacts }, wowFacts: sample.facts };
    }
    const empty = createEmptyWorkflow();
    return { workflowSnapshot: empty, wowFacts: computeWowFacts(empty) };
  }, [dataMode, botRoleMapping, unblockedTaskIds, approvedArtifactIds]);
  // Derive prioritized attention items for Team Lead operational intervention
  const attentionItems = useMemo(() => {
    return deriveAttentionItems(workflowSnapshot, bots);
  }, [workflowSnapshot, bots]);

  // Derive compact workflow info for each bot card
  const workflowMap = useMemo<Record<string, BotWorkflowInfo>>(() => {
    const result: Record<string, BotWorkflowInfo> = {};
    for (const bot of bots) {
      if (dataMode === "sample") {
        let roleId: string | undefined;
        if (bot.id === botRoleMapping.coordinatorId) roleId = botRoleMapping.coordinatorId;
        else if (bot.id === botRoleMapping.discoveryId) roleId = botRoleMapping.discoveryId;
        else if (bot.id === botRoleMapping.listingCoachId) roleId = botRoleMapping.listingCoachId;
        else if (bot.id === botRoleMapping.escrowId) roleId = botRoleMapping.escrowId;
        else if (bot.id === botRoleMapping.reviewerId) roleId = botRoleMapping.reviewerId;

        if (roleId) {
          const agent = workflowSnapshot.agents.find((a) => a.id === roleId);
          const task = workflowSnapshot.tasks.find((t) => t.ownerAgentId === roleId);
          const hasHelp = workflowSnapshot.messages.some(
            (m) => (m.kind === "help" || m.kind === "help_requested") && m.toAgentId === roleId,
          );
          const isReviewer = roleId === botRoleMapping.reviewerId;
          const reviewPending = isReviewer && workflowSnapshot.tasks.some((t) => t.state === "reviewing");
          const isBlocked = task?.state === "blocked";

          result[bot.id] = {
            taskTitle: task?.title,
            taskState: task?.state,
            progress: task?.progress,
            presence: agent?.presence ?? (isBlocked ? "blocked" : task ? "working" : "idle"),
            waitingReason: isBlocked ? "Waiting for counterparty risk data" : undefined,
            hasIncomingHelp: hasHelp,
            reviewRequested: reviewPending,
          };
          continue;
        }
      }

      // Default Live State derivation: derive strictly from authentic bot presence
      result[bot.id] = {
        presence: bot.activity === "working" || bot.busy ? "working" : bot.activity === "waiting-on-you" ? "waiting" : "idle",
      };
    }
    return result;
  }, [bots, botRoleMapping, workflowSnapshot, dataMode]);

  const sections = useMemo(() => {
    const names = [...new Set([...(state.sections ?? []), ...state.groups.flatMap((group) => group.section ? [group.section] : [])])];
    const order = (key: string) => key === "" ? -1 : names.includes(key) ? names.indexOf(key) : names.length;
    return buildTeamMapSections(bots, names).sort((a, b) => order(a.key) - order(b.key));
  }, [bots, state.sections, state.groups]);

  const edges = useMemo(() => {
    const base = buildTeamMapEdges(bots, snapshot);
    const existing = new Set(base.map((e) => [e.sourceBotId, e.targetBotId].sort().join(":")));
    const additional: TeamMapEdge[] = [];

    // Connect tasks that have dependencies (e.g. Markets -> Listing Coach)
    for (const task of workflowSnapshot.tasks) {
      if (task.dependsOnTaskIds && task.dependsOnTaskIds.length > 0) {
        for (const depId of task.dependsOnTaskIds) {
          const depTask = workflowSnapshot.tasks.find((t) => t.id === depId);
          if (depTask && depTask.ownerAgentId !== task.ownerAgentId) {
            const key = [depTask.ownerAgentId, task.ownerAgentId].sort().join(":");
            if (!existing.has(key)) {
              existing.add(key);
              additional.push({
                sourceBotId: depTask.ownerAgentId,
                targetBotId: task.ownerAgentId,
                state: task.state === "blocked" ? "queued" : "running",
                reason: `Dependency: ${depTask.title}`,
              });
            }
          }
        }
      }
    }

    // Connect transfer handoffs (e.g. Tuli -> Atlas)
    for (const xfer of workflowSnapshot.transfers) {
      const key = [xfer.fromAgentId, xfer.toAgentId].sort().join(":");
      if (!existing.has(key)) {
        existing.add(key);
        additional.push({
          sourceBotId: xfer.fromAgentId,
          targetBotId: xfer.toAgentId,
          state: "running",
          reason: xfer.reason,
        });
      }
    }

    // Connect review requests (e.g. Listing Coach -> Spend Scout)
    for (const art of workflowSnapshot.artifacts ?? []) {
      if (art.assignedReviewerId && art.authorAgentId && art.assignedReviewerId !== art.authorAgentId) {
        const key = [art.authorAgentId, art.assignedReviewerId].sort().join(":");
        if (!existing.has(key)) {
          existing.add(key);
          additional.push({
            sourceBotId: art.authorAgentId,
            targetBotId: art.assignedReviewerId,
            state: art.reviewState === "under_review" ? "running" : "connected",
            reason: `Review deliverable: ${art.name}`,
          });
        }
      }
    }

    return [...base, ...additional];
  }, [bots, snapshot, workflowSnapshot]);

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await api("/api/team-map"));
      setRefreshError(null);
    } catch (requestError) {
      setRefreshError(requestError instanceof Error ? requestError.message : String(requestError));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const requestMove = useCallback((bot: Bot, destination: string) => {
    return new Promise<boolean>((resolve) => {
      setPendingMove({ bot, destination, resolve });
    });
  }, []);

  const cancelMove = useCallback(() => {
    if (pendingMove) {
      pendingMove.resolve(false);
      setPendingMove(null);
    }
  }, [pendingMove]);

  // Deduplicate and unify handoffs and persistent connections cleanly
  const unifiedHandoffs = useMemo(() => {
    return deduplicateHandoffs(workflowSnapshot.transfers, edges, bots, workflowSnapshot.tasks);
  }, [workflowSnapshot.transfers, workflowSnapshot.tasks, edges, bots]);

  // Command Palette Items (Agents, Actions, Use Cases, Views)
  const commandItems = useMemo<CommandMenuItem[]>(() => {
    const list: CommandMenuItem[] = [];

    // 1. Actions / Interventions
    attentionItems.forEach((item) => {
      list.push({
        id: `att-${item.id}`,
        label: `Inspect ${item.agentName}: ${item.summary}`,
        description: `Action: ${item.actionLabel}`,
        group: "Immediate Interventions",
        keywords: ["blocked", "urgent", "attention", item.agentName],
        onSelect: () => {
          if (item.taskId) setSelectedWorkflowTaskId(item.taskId);
          else setSelectedWorkflowBotId(item.agentId);
          setHighlightBotIds([item.agentId]);
        },
      });
    });

    // 2. Agents
    bots.forEach((bot) => {
      const wf = workflowMap[bot.id];
      list.push({
        id: `bot-${bot.id}`,
        label: bot.name,
        description: wf?.taskTitle ? `${wf.taskTitle} (${wf.presence ?? "ready"})` : bot.title || "Agent",
        group: "Team Agents",
        keywords: [bot.name, bot.id, wf?.taskTitle ?? ""],
        onSelect: () => {
          setSelectedWorkflowBotId(bot.id);
          setSelectedWorkflowTaskId(null);
          setHighlightBotIds([bot.id]);
        },
      });
    });

    // 3. Use Cases / Commercial Pipelines
    list.push(
      {
        id: "scenario-b2b",
        label: "Autonomous B2B Sourcing & Vault Settlement",
        description: "Vendor discovery -> Terms SLA -> Treasury check -> 72h Escrow",
        group: "Commercial Pipelines",
        keywords: ["b2b", "sourcing", "escrow", "orion"],
        onSelect: () => {
          const first = bots.find((b) => /market/i.test(b.name))?.id ?? bots[0]?.id;
          if (first) {
            setSelectedWorkflowBotId(first);
            setHighlightBotIds([first]);
          }
        },
      },
      {
        id: "scenario-gate",
        label: "Free A2MCP Pre-Listing Readiness Gate",
        description: "Pre-listing automated scanner catching Vercel shape or DNS issues",
        group: "Commercial Pipelines",
        keywords: ["gate", "readiness", "a2mcp", "listing"],
        onSelect: () => {
          const coach = bots.find((b) => /coach/i.test(b.name))?.id ?? bots[0]?.id;
          if (coach) {
            setSelectedWorkflowBotId(coach);
            setHighlightBotIds([coach]);
          }
        },
      },
      {
        id: "scenario-dispute",
        label: "3-Agent Dispute Arbitration & Jury Quorum",
        description: "Decentralized consensus resolving buyer-seller delivery claims",
        group: "Commercial Pipelines",
        keywords: ["dispute", "jury", "arbitration"],
        onSelect: () => {
          const rev = bots.find((b) => /spend|scout/i.test(b.name))?.id ?? bots[0]?.id;
          if (rev) {
            setSelectedWorkflowBotId(rev);
            setHighlightBotIds([rev]);
          }
        },
      }
    );

    // 4. Navigation & Views
    list.push(
      {
        id: "nav-spatial",
        label: "Switch to Spatial Map View",
        description: "Interactive visual nodes and handoff lines",
        group: "Views & Controls",
        shortcut: "M",
        onSelect: () => setViewMode("map"),
      },
      {
        id: "nav-board",
        label: "Switch to Board View",
        description: "Structured card columns by team",
        group: "Views & Controls",
        shortcut: "B",
        onSelect: () => setViewMode("board"),
      },
      {
        id: "nav-attention-toggle",
        label: "Toggle Only Needs Attention",
        description: onlyNeedsAttention ? "Show all agents" : "Filter to blocked & waiting agents only",
        group: "Views & Controls",
        onSelect: () => setOnlyNeedsAttention((p) => !p),
      }
    );

    return list;
  }, [attentionItems, bots, workflowMap, onlyNeedsAttention]);
  // Handle metric click drill-down
  const handleSelectMetric = useCallback(
    (metric: { id: string; filterKind?: ActivityKind; explanation: string }) => {
      setActiveMetricId(metric.id);
      setFactsFilter(metric.filterKind ?? "all");

      switch (metric.id) {
        case "branches":
          setHighlightBotIds([botRoleMapping.discoveryId, botRoleMapping.listingCoachId, botRoleMapping.escrowId]);
          break;
        case "transfers":
          setHighlightBotIds([botRoleMapping.coordinatorId, botRoleMapping.escrowId]);
          if (workflowSnapshot.transfers[0]) {
            setSelectedWorkflowTaskId(workflowSnapshot.transfers[0].taskId);
          }
          break;
        case "blocked":
          setHighlightBotIds([botRoleMapping.listingCoachId, botRoleMapping.discoveryId]);
          break;
        case "reviews":
          setHighlightBotIds([botRoleMapping.listingCoachId, botRoleMapping.reviewerId]);
          break;
        case "tasks":
          setHighlightBotIds([botRoleMapping.discoveryId, botRoleMapping.listingCoachId, botRoleMapping.escrowId]);
          break;
        case "messages":
        case "agents":
        case "concurrent":
          setHighlightBotIds(bots.map((b) => b.id));
          break;
        default:
          setHighlightBotIds([]);
      }
    },
    [botRoleMapping, bots, workflowSnapshot],
  );

  const handleResetMetric = useCallback(() => {
    setActiveMetricId(null);
    setFactsFilter("all");
    setHighlightBotIds([]);
  }, []);
  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#0B0C0E] text-ink">
      <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] bg-[#121519] px-6 py-1.5">
        {/* Left: Title, bot count, and clean segmented view switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Network size={15} className="text-accent" />
            <h1 className="text-[13.5px] font-bold text-white tracking-tight">Team map</h1>
            <span className="rounded-full bg-white/[0.08] px-2 py-0.5 font-mono text-[10px] text-white/60">
              {bots.length}
            </span>
          </div>

          {/* Data Mode Indicator */}
          {dataMode === "sample" ? (
            <span className="hidden items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-medium text-amber-400 sm:inline-flex">
              <span className="size-1.5 rounded-full bg-amber-400" />
              <span>Sample data — not live</span>
            </span>
          ) : dataMode === "live" ? (
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-medium text-emerald-400 sm:inline-flex">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live workflow</span>
            </span>
          ) : (
            <a
              href="?fixture=sample"
              className="hidden items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10.5px] font-medium text-white/70 hover:bg-white/[0.08] hover:text-white sm:inline-flex transition"
            >
              <span>Load sample scenario</span>
            </a>
          )}

          {/* Segmented View Switcher (Canvas vs Board) */}
          <div className="flex items-center rounded-md border border-white/[0.1] bg-black/40 p-0.5" role="group" aria-label="View mode">
            <button
              type="button"
              role="radio"
              aria-checked={viewMode === "map"}
              onClick={() => setViewMode("map")}
              className={cn(
                "flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-[11px] font-medium transition-all outline-none",
                viewMode === "map" ? "bg-white/[0.12] text-white shadow-sm font-semibold" : "text-white/60 hover:text-white"
              )}
            >
              <MapIcon size={11} />
              <span>Canvas</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={viewMode === "board"}
              onClick={() => setViewMode("board")}
              className={cn(
                "flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-[11px] font-medium transition-all outline-none",
                viewMode === "board" ? "bg-white/[0.12] text-white shadow-sm font-semibold" : "text-white/60 hover:text-white"
              )}
            >
              <LayoutGrid size={11} />
              <span>Board</span>
            </button>
          </div>
        </div>

        {/* Center: Command Palette Trigger */}
        <div className="flex-1 max-w-sm mx-auto hidden md:block">
          <TeamMapCommandMenu
            items={commandItems}
            className="w-full"
            triggerPlaceholder="Search agents, pipelines or type ⌘K…"
          />
        </div>

        {/* Right: Needs attention toggle, Zoom controls, and Add button */}
        <div className="flex items-center gap-2">
          {/* Needs attention pill */}
          <button
            type="button"
            onClick={() => setOnlyNeedsAttention((p) => !p)}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition",
              onlyNeedsAttention
                ? "border-danger/60 bg-danger/15 text-danger font-semibold"
                : "border-white/[0.08] bg-white/[0.03] text-white/60 hover:bg-white/[0.06] hover:text-white"
            )}
          >
            {attentionItems.length > 0 && <span className="size-1.5 rounded-full bg-danger animate-pulse" />}
            <span>{attentionItems.length > 0 ? `${attentionItems.length} issue` : "All healthy"}</span>
          </button>

          {/* Zoom controls in Canvas mode */}
          {viewMode === "map" && (
            <div className="flex items-center gap-0.5 rounded-md border border-white/[0.08] bg-black/30 p-0.5">
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => setZoomPercent((z) => Math.max(30, z / 1.2))}
                className="flex size-6 items-center justify-center rounded text-white/60 hover:bg-white/10 hover:text-white"
              >
                <Minus size={11} />
              </button>
              <button
                type="button"
                aria-label="Reset zoom"
                onClick={() => setZoomPercent(100)}
                className="px-1.5 font-mono text-[10.5px] text-white/60 hover:text-white"
              >
                {Math.round(zoomPercent)}%
              </button>
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => setZoomPercent((z) => Math.min(150, z * 1.2))}
                className="flex size-6 items-center justify-center rounded text-white/60 hover:bg-white/10 hover:text-white"
              >
                <Plus size={11} />
              </button>
            </div>
          )}

          {!remoteClient && (
            <details className="relative">
              <summary
                aria-label="Add to team map"
                className="flex cursor-pointer list-none items-center gap-1 rounded-md border border-white/[0.1] bg-[#1C2025] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/[0.08] [&::-webkit-details-marker]:hidden"
              >
                <Plus size={12} />
                <span>Add</span>
              </summary>
              <div
                className="absolute right-0 top-full z-40 mt-1.5 w-44 rounded-xl border border-white/[0.1] bg-[#15171A] p-1.5 shadow-xl"
                onClick={(e) => {
                  const d = e.currentTarget.closest("details");
                  d?.removeAttribute("open");
                }}
              >
                <button
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11.5px] text-white/80 hover:bg-white/[0.08] hover:text-white"
                  onClick={() => setTeamEditor({})}
                >
                  <Users size={13} />
                  <span>{t("team.create")}</span>
                </button>
              </div>
            </details>
          )}
        </div>
      </header>

      {/* Ultra-Slim Alert Strip (Only visible when an item needs urgent attention) */}
      {attentionItems.length > 0 && (
        <div className="flex h-7 shrink-0 items-center justify-between border-b border-danger/30 bg-danger/10 px-6 text-[11px] text-danger">
          <div className="flex items-center gap-2 truncate">
            <AlertTriangle size={12} className="shrink-0" />
            <span className="font-semibold">{attentionItems[0].agentName}:</span>
            <span className="truncate text-white/80">{attentionItems[0].summary}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (attentionItems[0].taskId) setSelectedWorkflowTaskId(attentionItems[0].taskId);
              else setSelectedWorkflowBotId(attentionItems[0].agentId);
              setHighlightBotIds([attentionItems[0].agentId]);
            }}
            className="inline-flex items-center gap-1 font-semibold text-danger hover:underline shrink-0 ml-3"
          >
            <span>{attentionItems[0].actionLabel}</span>
            <ArrowRight size={10} />
          </button>
        </div>
      )}
      {/* 4. Canvas Area: Board View (Default) or Spatial Map + Right-side Detail Drawer */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {viewMode === "board" ? (
            <TeamMapBoardView
              sections={sections}
              workflowMap={workflowMap}
              highlightBotIds={highlightBotIds}
              selectedBotId={selectedWorkflowBotId}
              onSelectBot={(botId) => {
                setSelectedWorkflowBotId(botId);
                setSelectedWorkflowTaskId(null);
              }}
              searchQuery={searchQuery}
              statusFilter={statusFilter}
              onlyNeedsAttention={onlyNeedsAttention}
            />
          ) : (
            <TeamCanvas
              sections={sections}
              canManage={!remoteClient}
              onMove={requestMove}
              onLogs={setLogBot}
              edges={edges}
              workflowMap={workflowMap}
              highlightBotIds={highlightBotIds}
              onSelectBot={(botId) => {
                setSelectedWorkflowBotId(botId);
                setSelectedWorkflowTaskId(null);
              }}
              connectedBotIds={
                state.settingsOpen
                  ? edges.flatMap((edge) =>
                      edge.sourceBotId === state.selectedId
                        ? [edge.targetBotId]
                        : edge.targetBotId === state.selectedId
                          ? [edge.sourceBotId]
                          : [],
                    )
                  : []
              }
              onComputer={(bot) => dispatch({ type: "toggleSettings", botId: bot.id, section: "access", open: true })}
              onInstructions={(section, label) => setContextEditor({ section, label })}
              onEditTeam={(section, rename) => setTeamEditor({ section, rename })}
              onDeleteTeam={setDeletingTeam}
              isEmpty={(key) => ![...state.bots, ...state.groups].some((record) => record.section?.trim() === key)}
              searchQuery={searchQuery}
              statusFilter={statusFilter}
              onlyNeedsAttention={onlyNeedsAttention}
            />
          )}
        </div>

        {/* Right-side Detail Drawer with 1-click Operator Interventions */}
        {(selectedWorkflowBotId || selectedWorkflowTaskId) && (
          <TeamMapWorkflowDrawer
            dataMode={dataMode}
            snapshot={workflowSnapshot}
            bots={bots}
            agentId={selectedWorkflowBotId}
            taskId={selectedWorkflowTaskId}
            onClose={() => {
              setSelectedWorkflowBotId(null);
              setSelectedWorkflowTaskId(null);
              setHighlightBotIds([]);
            }}
            onSelectAgent={(agentId) => {
              setSelectedWorkflowBotId(agentId);
              setHighlightBotIds([agentId]);
            }}
            onSelectTask={(taskId) => {
              setSelectedWorkflowTaskId(taskId);
              const t = workflowSnapshot.tasks.find((task) => task.id === taskId);
              if (t) setHighlightBotIds([t.ownerAgentId]);
            }}
            onIntervene={(action) => {
              if (action.type === "open_conversation") {
                dispatch({ type: "select", id: action.agentId });
              } else if (action.type === "unblock_task") {
                setUnblockedTaskIds((prev) => [...prev, action.taskId]);
                setSelectedWorkflowTaskId(null);
                setSelectedWorkflowBotId(null);
                setHighlightBotIds([]);
              } else if (action.type === "approve_task") {
                setUnblockedTaskIds((prev) => [...prev, action.taskId]);
                setSelectedWorkflowTaskId(null);
                setSelectedWorkflowBotId(null);
                setHighlightBotIds([]);
              } else if (action.type === "approve_artifact") {
                setApprovedArtifactIds((prev) => [...new Set([...prev, action.artifactId])]);
              } else if (action.type === "inspect_blocker") {
                setSelectedWorkflowTaskId(action.taskId);
              }
            }}
          />
        )}
      </div>

      {/* 5. Lower Content: Collapsed Supporting Details Bar in Map mode, Full footer in Board mode */}
      <footer className="shrink-0 border-t border-white/[0.08] bg-[#0B0C0E]">
        {viewMode === "map" ? (
          <details className="group/details">
            <summary className="flex h-9 cursor-pointer list-none items-center justify-between px-6 text-[12px] font-medium text-white/70 hover:bg-white/[0.03] hover:text-white transition-colors">
              <div className="flex items-center gap-2.5">
                <span className="text-white/40 group-open/details:rotate-180 transition-transform duration-150">▲</span>
                <span>Supporting details</span>
                <span className="rounded-[5px] bg-white/[0.08] px-1.5 py-0.5 font-mono text-[10.5px] text-white/60">
                  Handoffs {unifiedHandoffs.length}
                </span>
                <span className="text-white/30">·</span>
                <span className="text-white/40">Workflow insights &amp; event trail</span>
              </div>
              <span className="text-[11px] text-white/40">
                Click to expand / collapse
              </span>
            </summary>
            <div className="max-h-[340px] overflow-y-auto px-6 py-4 space-y-3.5 border-t border-white/[0.06] bg-[#121417]">
              {/* Flat Structured Handoffs */}
              <TeamMapHandoffList
                items={unifiedHandoffs}
                selectedTaskId={selectedWorkflowTaskId}
                onSelectHandoff={(item: UnifiedHandoffItem) => {
                  if (item.taskId) {
                    setSelectedWorkflowTaskId(item.taskId);
                    setSelectedWorkflowBotId(null);
                  } else {
                    setSelectedWorkflowBotId(item.fromBotId);
                    setSelectedWorkflowTaskId(null);
                  }
                  setHighlightBotIds([item.fromBotId, item.toBotId]);
                }}
              />

              {/* Secondary Workflow Insights */}
              <TeamMapWowFacts
                facts={wowFacts}
                activeMetricId={activeMetricId}
                onSelectMetric={handleSelectMetric}
                onResetMetric={handleResetMetric}
              />
            </div>
          </details>
        ) : (
          <div className="max-h-[300px] overflow-y-auto px-6 py-4 space-y-3.5">
            {/* Board View Bottom Area: Flat Handoffs & Collapsible Insights */}
            <TeamMapHandoffList
              items={unifiedHandoffs}
              selectedTaskId={selectedWorkflowTaskId}
              onSelectHandoff={(item: UnifiedHandoffItem) => {
                if (item.taskId) {
                  setSelectedWorkflowTaskId(item.taskId);
                  setSelectedWorkflowBotId(null);
                } else {
                  setSelectedWorkflowBotId(item.fromBotId);
                  setSelectedWorkflowTaskId(null);
                }
                setHighlightBotIds([item.fromBotId, item.toBotId]);
              }}
            />

            <details
              open={activeMetricId !== null}
              className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#15171A]"
            >
              <summary className="flex h-11 cursor-pointer list-none items-center justify-between px-5 text-[13.5px] font-semibold text-white/85 hover:bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-accent" aria-hidden="true" />
                  <span>Workflow insights</span>
                  <span className="text-[11px] font-normal text-white/40">Historical metrics &amp; event audit</span>
                </div>
                <span className="text-[11.5px] font-normal text-white/45">
                  {activeMetricId ? "Filtering by metric" : "Expand metrics"}
                </span>
              </summary>
              <div className="space-y-4 border-t border-white/[0.08] p-4">
                <TeamMapWowFacts
                  facts={wowFacts}
                  activeMetricId={activeMetricId}
                  onSelectMetric={handleSelectMetric}
                  onResetMetric={handleResetMetric}
                />

                <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#0B0C0E]/50">
                  <div className="flex h-9 items-center justify-between border-b border-white/[0.06] px-4 text-[12px]">
                    <span className="font-semibold text-white/80">Activity Event Trail</span>
                    <span className="text-[11px] text-white/40">Chronological</span>
                  </div>
                  <div className="h-[180px]">
                    <TeamMapActivityFeed
                      snapshot={workflowSnapshot}
                      kindFilter={factsFilter}
                      onKindFilter={setFactsFilter}
                      onSelectAgent={(agentId) => {
                        setSelectedWorkflowBotId(agentId);
                        setHighlightBotIds([agentId]);
                      }}
                      onSelectTask={(taskId) => {
                        setSelectedWorkflowTaskId(taskId);
                        const t = workflowSnapshot.tasks.find((task) => task.id === taskId);
                        if (t) setHighlightBotIds([t.ownerAgentId]);
                      }}
                      highlightAgentId={selectedWorkflowBotId}
                      className="h-full"
                    />
                  </div>
                </div>
              </div>
            </details>
          </div>
        )}
      </footer>

      {/* Legacy Session log modal */}
      {logBot && <SessionLog bot={logBot} onClose={() => setLogBot(null)} />}

      {/* Team Dialogs */}
      {contextEditor && (
        <SectionContextDialog
          section={contextEditor.section}
          label={contextEditor.label}
          onClose={() => setContextEditor(null)}
        />
      )}
      {teamEditor && <TeamDialog {...teamEditor} onClose={() => setTeamEditor(null)} />}
      <ConfirmDialog
        open={pendingMove !== null}
        tone="neutral"
        title={`Move ${pendingMove?.bot.name ?? "bot"} to ${pendingMove?.destination || "General"}?`}
        body="This changes the bot's home team and shared instructions, not just its position. Its conversations and model stay with it. To arrange visually, drag within the same team."
        confirmLabel="Move bot"
        onCancel={cancelMove}
        onConfirm={() => {
          const move = pendingMoveRef.current;
          if (!move) return;
          pendingMoveRef.current = null;
          setPendingMove(null);
          move.resolve(true);
        }}
      />
    </main>
  );
}

function SessionLog({ bot, onClose }: { bot: Bot; onClose: () => void }) {
  const { dispatch } = useStore();
  const [lines, setLines] = useState<Array<{ id: string; role: string; text: string }>>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setLines([]);
    api(`/api/threads/${bot.threadId}/messages?limit=8`)
      .then((body: { messages?: Array<{ id: string; role: string; text?: string; kind: string }> }) => {
        if (cancelled) return;
        setLines(
          (body.messages ?? []).slice(-6).map((message) => ({
            id: message.id,
            role: message.role,
            text: message.text?.trim() || message.kind,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [bot.id, bot.threadId]);

  return (
    <section className="shrink-0 border-t border-hairline/40 bg-panel px-6 py-3" aria-label={`Session log for ${bot.name}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-medium">{bot.name} session log</p>
        <div className="flex items-center gap-2">
          <button className="text-[12px] text-accent hover:underline" onClick={() => dispatch({ type: "select", id: bot.id })}>
            Open session
          </button>
          <button aria-label="Close session log" className="rounded p-1 text-ink-secondary hover:bg-control" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
      </div>
      <p className="mt-1 text-[11px] text-ink-secondary">Our transcript only. Not a remote ASP process log.</p>
      {failed && <p className="mt-2 text-[12px] text-danger">Could not load the transcript.</p>}
      <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto">
        {lines.length === 0 && !failed && <li className="text-[12px] text-ink-secondary">No transcript lines yet.</li>}
        {lines.map((line) => (
          <li key={line.id} className="truncate text-[12px]">
            <span className="text-ink-secondary">{line.role}:</span> {line.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
