import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
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
import { cn } from "@/lib/cn";
import { TeamCanvas, type BotWorkflowInfo } from "./TeamCanvas";
import { TeamDialog } from "./TeamDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { TeamMapWorkflowDrawer } from "./TeamMapWorkflowDrawer";
import { TeamMapWowFacts } from "./TeamMapWowFacts";
import { TeamMapActivityFeed } from "./TeamMapActivityFeed";
import {
  buildSampleWorkflowSnapshot,
  SAMPLE_WORKFLOW_LABEL,
  type BotRoleMapping,
} from "@/lib/team-map-sample-workflow";
import type { ActivityKind } from "@/lib/team-map-demo-ui";
import { t } from "@/lib/i18n";

function StructuredHandoffRow({
  fromName,
  toName,
  taskTitle,
  reason,
  messagesTransferred = 4,
  artifactsTransferred = 2,
  decisionsTransferred = 1,
  progress = 68,
  timeStr = "12:43 PM",
  active,
  onClick,
}: {
  fromName: string;
  toName: string;
  taskTitle: string;
  reason: string;
  messagesTransferred?: number;
  artifactsTransferred?: number;
  decisionsTransferred?: number;
  progress?: number;
  timeStr?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full flex-col gap-1.5 rounded-xl border p-3 text-left transition-all",
        active
          ? "border-accent bg-accent/10 shadow-md ring-1 ring-accent/30"
          : "border-hairline/50 bg-card hover:border-ink-secondary/40 hover:bg-raised/30",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline/30 pb-2">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
          <span>Task: {taskTitle}</span>
          <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent">Ownership Handoff</span>
        </div>
        <span className="text-[11px] tabular-nums text-ink-secondary">{timeStr}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className="font-semibold text-ink">{fromName}</span>
        <ArrowRight size={13} className="text-accent" />
        <span className="font-semibold text-ink">{toName}</span>
        <span className="text-ink-secondary">·</span>
        <span className="text-ink-secondary">Status: Resumed at {progress}%</span>
      </div>

      <p className="line-clamp-2 text-[11px] text-ink-secondary">
        <strong className="text-ink">Reason:</strong> {reason}
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-2 rounded-lg bg-inset/60 px-2.5 py-1 text-[10.5px] text-ink-secondary">
        <span>Context transferred:</span>
        <span className="font-medium text-ink">
          {messagesTransferred} messages, {artifactsTransferred} artifacts, {decisionsTransferred} decision
        </span>
      </div>
    </button>
  );
}

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
  const [metricExplanation, setMetricExplanation] = useState<string | null>(null);

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

  // Handle metric click drill-down
  const handleSelectMetric = useCallback((metricKey: string) => {
    switch (metricKey) {
      case "branch":
        setFactsFilter("branch");
        setHighlightBotIds([botRoleMapping.discoveryId, botRoleMapping.listingCoachId, botRoleMapping.escrowId]);
        setMetricExplanation("Parallel branches: 3 independent streams executed simultaneously across Discovery, Terms, and Escrow.");
        break;
      case "transfer":
        setFactsFilter("transfer");
        setHighlightBotIds([botRoleMapping.coordinatorId, botRoleMapping.escrowId]);
        setMetricExplanation("Ownership transfer: Tuli transferred escrow-prep to Atlas with 4 messages, 2 artifacts, and 1 decision preserved.");
        if (workflowSnapshot.transfers[0]) {
          setSelectedWorkflowTaskId(workflowSnapshot.transfers[0].taskId);
        }
        break;
      case "help":
        setFactsFilter("help");
        setHighlightBotIds([botRoleMapping.listingCoachId, botRoleMapping.discoveryId]);
        setMetricExplanation("Blocked recovery: Listing Coach was blocked on counterparty data, asked Markets for help, and resumed immediately.");
        break;
      case "review":
        setFactsFilter("review");
        setHighlightBotIds([botRoleMapping.listingCoachId, botRoleMapping.reviewerId]);
        setMetricExplanation("Review convergence: Spend Scout requested 1 adjustment (72h lockup), Listing Coach updated the spec, and Spend Scout approved.");
        break;
      case "message":
        setFactsFilter("message");
        setHighlightBotIds(bots.map((b) => b.id));
        setMetricExplanation("Messages: Agent-to-agent communication history recorded across all parallel branches.");
        break;
      case "task":
        setFactsFilter("task");
        setHighlightBotIds([botRoleMapping.discoveryId, botRoleMapping.listingCoachId, botRoleMapping.escrowId]);
        setMetricExplanation("Tasks completed: All 3 branches reached 100% completion and delivered verified artifacts.");
        break;
      default:
        setFactsFilter("all");
        setHighlightBotIds([]);
        setMetricExplanation(null);
    }
  }, [botRoleMapping, bots, workflowSnapshot]);

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
          />
        )}
      </div>

      {/* Bottom Area: Upgraded Agent Handoffs, Activity Feed, and Interactive Workflow Facts */}
      <footer className="shrink-0 border-t border-hairline/40 bg-panel">
        <div className="max-h-[380px] overflow-y-auto px-6 py-4 space-y-4">
          {/* 1. Metric Calculation Explanation (appears when a fact is clicked) */}
          {metricExplanation && (
            <div className="flex items-center justify-between rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-[12px] text-accent">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="shrink-0" />
                <span>{metricExplanation}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMetricExplanation(null);
                  setFactsFilter("all");
                  setHighlightBotIds([]);
                }}
                className="text-[11px] underline hover:opacity-80"
              >
                Reset drill-down
              </button>
            </div>
          )}

          {/* 2. Upgraded Structured Agent Handoffs */}
          <details
            ref={(node) => {
              if (node && node.dataset.opened === undefined) {
                node.dataset.opened = "1";
                node.open = true;
              }
            }}
            className="rounded-xl border border-hairline/40 bg-card p-3"
          >
            <summary className="cursor-pointer text-[12.5px] font-semibold text-ink">
              Agent handoffs &amp; Ownership Transfers ({workflowSnapshot.transfers.length + edges.length})
            </summary>

            <div className="mt-3 space-y-2">
              {/* Structured Context-Preserved Transfer Card */}
              {workflowSnapshot.transfers.map((xfer) => {
                const fromBot = bots.find((b) => b.id === xfer.fromAgentId) ?? { name: "Tuli" };
                const toBot = bots.find((b) => b.id === xfer.toAgentId) ?? { name: "Atlas" };
                const isSelected = selectedWorkflowTaskId === xfer.taskId;

                return (
                  <StructuredHandoffRow
                    key={xfer.id}
                    fromName={fromBot.name}
                    toName={toBot.name}
                    taskTitle="Prepare payment protection"
                    reason={xfer.reason}
                    messagesTransferred={xfer.messagesTransferred ?? 4}
                    artifactsTransferred={xfer.artifactsTransferred ?? 2}
                    decisionsTransferred={xfer.decisionsTransferred ?? 1}
                    progress={xfer.progressAtTransfer ?? 68}
                    active={isSelected}
                    onClick={() => {
                      setSelectedWorkflowTaskId(xfer.taskId);
                      setSelectedWorkflowBotId(null);
                      setHighlightBotIds([xfer.fromAgentId, xfer.toAgentId]);
                    }}
                  />
                );
              })}

              {/* Edge rows from server */}
              {edges.map((edge) => {
                const src = bots.find((b) => b.id === edge.sourceBotId);
                const tgt = bots.find((b) => b.id === edge.targetBotId);
                if (!src || !tgt) return null;
                return (
                  <div
                    key={`${edge.sourceBotId}:${edge.targetBotId}`}
                    className="flex items-center justify-between rounded-lg border border-hairline/40 bg-inset/50 px-3 py-2 text-[11.5px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">{src.name}</span>
                      <ArrowRight size={12} className="text-ink-secondary" />
                      <span className="font-semibold text-ink">{tgt.name}</span>
                    </div>
                    <span className="rounded bg-control px-2 py-0.5 text-[10.5px] text-ink-secondary capitalize">
                      {edge.state}
                    </span>
                  </div>
                );
              })}
            </div>
          </details>

          {/* 3. Interactive Workflow Facts (Click Metric to Drill Down) */}
          <div className="rounded-xl border border-hairline/40 bg-card p-3">
            <TeamMapWowFacts
              facts={wowFacts}
              activeFilter={factsFilter}
              onSelectFilter={handleSelectMetric}
            />
          </div>

          {/* 4. Compact Collaboration Activity Feed */}
          <div className="rounded-xl border border-hairline/40 bg-card p-3">
            <h4 className="mb-2 text-[12px] font-semibold text-ink">Collaboration Activity Feed</h4>
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
