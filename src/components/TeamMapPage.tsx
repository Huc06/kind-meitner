import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  Loader2,
  Network,
  Plus,
  Save,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import { api, useStore, type Bot } from "@/state/store";
import {
  EMPTY_TEAM_MAP_SNAPSHOT,
  buildTeamMapEdges,
  buildTeamMapSections,
  type TeamMapSnapshot,
} from "@/lib/team-map";

import { TeamCanvas, type BotWorkflowInfo } from "./TeamCanvas";
import { TeamDialog } from "./TeamDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { TeamMapWorkflowDrawer } from "./TeamMapWorkflowDrawer";
import { TeamMapWowFacts } from "./TeamMapWowFacts";
import { TeamMapActivityFeed } from "./TeamMapActivityFeed";
import { TeamMapHandoffList, deduplicateHandoffs, type UnifiedHandoffItem } from "./TeamMapHandoffList";
import { TeamMapAttentionRail, type AttentionItem } from "./TeamMapAttentionRail";
import {
  buildSampleWorkflowSnapshot,
  SAMPLE_WORKFLOW_LABEL,
  type BotRoleMapping,
} from "@/lib/team-map-sample-workflow";
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
      .then((body) => {
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

  // Workflow Drawer & Inspection States
  const [selectedWorkflowBotId, setSelectedWorkflowBotId] = useState<string | null>(null);
  const [selectedWorkflowTaskId, setSelectedWorkflowTaskId] = useState<string | null>(null);
  const [highlightBotIds, setHighlightBotIds] = useState<string[]>([]);
  const [factsFilter, setFactsFilter] = useState<ActivityKind | "all">("all");
  const [activeMetricId, setActiveMetricId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{ bot: Bot; destination: string; resolve: (moved: boolean) => void } | null>(null);
  const pendingMoveRef = useRef(pendingMove);
  pendingMoveRef.current = pendingMove;
  useEffect(() => () => pendingMoveRef.current?.resolve(false), []);

  const bots = useMemo(() => state.bots.filter((bot) => !bot.hidden), [state.bots]);

  // Map workspace bots into sample workflow roles
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

  // Always compute deterministic sample workflow backed by real bot IDs
  const { snapshot: workflowSnapshot, facts: wowFacts } = useMemo(
    () => buildSampleWorkflowSnapshot(botRoleMapping),
    [botRoleMapping],
  );

  // Derive compact workflow info for each bot card
  const workflowMap = useMemo<Record<string, BotWorkflowInfo>>(() => {
    const result: Record<string, BotWorkflowInfo> = {};
    for (const bot of bots) {
      // Check if this bot is assigned to any role in the workflow
      let roleId: string | undefined;
      if (bot.id === botRoleMapping.coordinatorId) roleId = botRoleMapping.coordinatorId;
      else if (bot.id === botRoleMapping.discoveryId) roleId = botRoleMapping.discoveryId;
      else if (bot.id === botRoleMapping.listingCoachId) roleId = botRoleMapping.listingCoachId;
      else if (bot.id === botRoleMapping.escrowId) roleId = botRoleMapping.escrowId;
      else if (bot.id === botRoleMapping.reviewerId) roleId = botRoleMapping.reviewerId;

      if (!roleId) continue;

      const agent = workflowSnapshot.agents.find((a) => a.id === roleId);
      const task = workflowSnapshot.tasks.find((t) => t.ownerAgentId === roleId);

      const hasHelp = workflowSnapshot.messages.some(
        (m) => (m.kind === "help" || m.kind === "help_requested") && m.toAgentId === roleId,
      );
      const isReviewer = roleId === botRoleMapping.reviewerId;
      const reviewPending = isReviewer && workflowSnapshot.tasks.some((t) => t.state === "reviewing");

      const isBlocked = task?.state === "blocked";
      const waitingReason = isBlocked ? "Waiting for counterparty risk data" : undefined;

      result[bot.id] = {
        taskTitle: task?.title,
        taskState: task?.state,
        progress: task?.progress,
        presence: agent?.presence ?? (isBlocked ? "blocked" : task ? "working" : "idle"),
        waitingReason,
        hasIncomingHelp: hasHelp,
        reviewRequested: reviewPending,
      };
    }
    return result;
  }, [bots, botRoleMapping, workflowSnapshot]);

  const sections = useMemo(() => {
    const names = [...new Set([...(state.sections ?? []), ...state.groups.flatMap((group) => group.section ? [group.section] : [])])];
    const order = (key: string) => key === "" ? -1 : names.includes(key) ? names.indexOf(key) : names.length;
    return buildTeamMapSections(bots, names).sort((a, b) => order(a.key) - order(b.key));
  }, [bots, state.sections, state.groups]);
  // Derive prioritized attention items for Team Lead operational intervention
  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];

    // 1. Check for blocked tasks (P0)
    for (const task of workflowSnapshot.tasks) {
      if (task.state === "blocked") {
        const owner = bots.find((b) => b.id === task.ownerAgentId) ?? { name: "Listing Coach" };
        items.push({
          id: `att-blocked-${task.id}`,
          priority: "p0_blocked",
          agentId: task.ownerAgentId,
          agentName: owner.name,
          taskId: task.id,
          taskTitle: task.title,
          summary: "Blocked on counterparty risk & reputation data from Vendor Orion",
          recommendedAction: "Unblock",
          ageStr: "2m ago",
        });
      }
    }

    // 2. Check for review requests (P2)
    for (const task of workflowSnapshot.tasks) {
      if (task.state === "reviewing") {
        const rev = bots.find((b) => b.id === botRoleMapping.reviewerId) ?? { name: "Spend Scout" };
        items.push({
          id: `att-review-${task.id}`,
          priority: "p2_review",
          agentId: botRoleMapping.reviewerId,
          agentName: rev.name,
          taskId: task.id,
          taskTitle: task.title,
          summary: "Deal package submitted: inspection window & escrow terms ready",
          recommendedAction: "Review",
          ageStr: "just now",
        });
      }
    }

    // 3. Check for bots waiting on user input (P1)
    for (const b of bots) {
      if (b.activity === "waiting-on-you") {
        items.push({
          id: `att-input-${b.id}`,
          priority: "p1_input",
          agentId: b.id,
          agentName: b.name,
          taskTitle: "Awaiting operator prompt",
          summary: "Agent finished previous turn and needs steering or approval",
          recommendedAction: "Provide input",
          ageStr: "live",
        });
      }
    }

    return items;
  }, [workflowSnapshot.tasks, bots, botRoleMapping]);

  const edges = useMemo(() => buildTeamMapEdges(bots, snapshot), [bots, snapshot]);

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

  // Deduplicate and unify handoffs and persistent connections
  const unifiedHandoffs = useMemo(() => {
    return deduplicateHandoffs(workflowSnapshot.transfers, edges, bots);
  }, [workflowSnapshot.transfers, edges, bots]);

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
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-app text-ink">
      {/* Top Header */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-hairline/40 px-6 py-4 max-md:pl-12">
        <div>
          <div className="flex items-center gap-2.5">
            <Network size={18} className="text-ink-secondary" />
            <h1 className="text-[17px] font-semibold">Team map</h1>
            <span className="ml-1 text-[11px] text-ink-secondary">{t("canvas.botCount", { count: bots.length })}</span>
            <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[10.5px] font-medium text-accent">
              {SAMPLE_WORKFLOW_LABEL}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-ink-secondary">{t("canvas.description")}</p>
        </div>

        <div className="flex items-center gap-2">
          {!remoteClient && (
            <details
              className="relative"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.removeAttribute("open");
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.currentTarget.removeAttribute("open");
                  event.currentTarget.querySelector("summary")?.focus();
                }
              }}
            >
              <summary
                aria-label="Add to team map"
                className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-hairline/60 bg-panel px-3 py-2 text-[12px] font-medium hover:bg-control [&::-webkit-details-marker]:hidden"
              >
                <Plus size={14} /> Add
              </summary>
              <div
                className="absolute right-0 top-full z-40 mt-2 w-52 rounded-xl border border-hairline/60 bg-panel p-1.5 shadow-xl"
                onClick={(event) => {
                  const details = event.currentTarget.closest("details");
                  details?.querySelector("summary")?.focus();
                  details?.removeAttribute("open");
                }}
              >
                <button
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[12px] hover:bg-control"
                  onClick={() => setTeamEditor({})}
                >
                  <Users size={14} />
                  {t("team.create")}
                </button>
              </div>
            </details>
          )}
        </div>
      </header>

      {/* Main Canvas + Right-Side Detail Drawer */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
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
          />
        </div>

        {/* Right-side Detail Drawer */}
        {(selectedWorkflowBotId || selectedWorkflowTaskId) && (
          <TeamMapWorkflowDrawer
            snapshot={workflowSnapshot}
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
              if (action.type === "open_chat" && action.agentId) {
                dispatch({ type: "select", id: action.agentId });
              } else if (action.type === "unblock") {
                setHighlightBotIds([]);
                setSelectedWorkflowTaskId(null);
              } else if (action.type === "approve") {
                setHighlightBotIds([]);
                setSelectedWorkflowTaskId(null);
              }
            }}
          />
        )}
      </div>

      {/* Operational Attention Rail (Between canvas and footer) */}
      <div className="shrink-0 border-t border-white/[0.08] bg-[#0B0C0E] px-6 py-3">
        <TeamMapAttentionRail
          items={attentionItems}
          selectedItemId={selectedWorkflowTaskId ? `att-blocked-${selectedWorkflowTaskId}` : null}
          onSelectItem={(item) => {
            if (item.taskId) {
              setSelectedWorkflowTaskId(item.taskId);
              setSelectedWorkflowBotId(null);
            } else {
              setSelectedWorkflowBotId(item.agentId);
              setSelectedWorkflowTaskId(null);
            }
            setHighlightBotIds([item.agentId]);
          }}
        />
      </div>

      {/* Bottom Area: Redesigned Handoffs, Responsive Facts Grid, and Activity Feed */}
      <footer className="shrink-0 border-t border-white/[0.08] bg-[#0B0C0E]">
        <div className="max-h-[380px] overflow-y-auto px-6 py-4 space-y-4">
          {/* 1. Unified, Deduplicated Agent Handoffs */}
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

          {/* 2. Collapsible Workflow Insights (Secondary Analytics & Event Trail) */}
          <details
            open={activeMetricId !== null}
            className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#15171A]"
          >
            <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-5 font-semibold text-[15px] text-white/90 hover:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-accent" aria-hidden="true" />
                <span>Workflow insights</span>
                <span className="text-[11px] text-white/45 font-normal">Secondary analytics &amp; event trail</span>
              </div>
              <span className="text-[11.5px] font-normal text-white/45">
                {activeMetricId ? "Filtering by metric" : "Click to view metrics"}
              </span>
            </summary>

            <div className="space-y-4 border-t border-white/[0.08] p-4">
              {/* Responsive Interactive Workflow Facts Grid */}
              <TeamMapWowFacts
                facts={wowFacts}
                activeMetricId={activeMetricId}
                onSelectMetric={handleSelectMetric}
                onResetMetric={handleResetMetric}
              />

              {/* Compact Activity Feed */}
              <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#0B0C0E]/50">
                <div className="flex h-10 items-center justify-between border-b border-white/[0.06] px-4">
                  <span className="text-[12px] font-semibold text-white/80">Activity Event Trail</span>
                  <span className="text-[11px] text-white/40">Chronological</span>
                </div>
                <div className="h-[200px]">
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
