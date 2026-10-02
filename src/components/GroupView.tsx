// A room: several bots + you in one shared thread. The sidebar and call view
// carry the personality; avatars inside the room stay still so a busy group
// does not become a wall of competing motion. Plain messages go to the room's
// default responder; @mentions override that routing.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { activeLocale, t } from "@/lib/i18n";
import { ArrowDown, Check, ChevronDown, ChevronRight, Clock, Folder, FolderOpen, Loader2, MessageSquareReply, Pin, PinOff, Search, Users, X } from "lucide-react";
import {
  api,
  useStore,
  useStreaming,
  formatTime,
  openNotificationTarget,
  type Bot,
  type Group,
  type GroupDefaultResponder,
  type InstanceInfo,
  type Message,
} from "@/state/store";
import { BotAvatar } from "./Avatar";
import { ThreadChip } from "./ThreadChip";
import { ToolActivity } from "./ToolActivity";
import { ThreadRefText } from "./ThreadRefs";
import { TurnPresence } from "./TurnPresence";
import { devDayGateCardsEnabled, showToolCallsEnabled } from "@/lib/feature-flags";
import { isOkxGateTool } from "@/lib/okx-action-cards";
import { roomActivityVisible } from "@/lib/room-activity";
import { normalizeState } from "@/lib/mascot";
import { effectiveDefaultResponder, groupResponseHint } from "@/lib/group-routing";
import { ChatMarkdown } from "./ChatMarkdown";
import { Composer, DefaultResponderSelect } from "./Composer";
import { AgentIdentity } from "@/components/agent-identity/AgentIdentity";
import { EngineModeBadge } from "./EngineModeBadge";
import { ExternalAgentLabel } from "./ExternalAgentLabel";
import { useExternalAgents } from "@/lib/external-agents";
import { Tag } from "@/components/ui/tag";
import { RoomActivityTimeline } from "./RoomActivityTimeline";
import { ModelPicker } from "./ModelPicker";
import { usageDetail } from "@/lib/usage";
import { ChatFindBar } from "./ChatFindBar";
import { GroupTaskPicker } from "./TaskPicker";
import { ExportTranscriptMenu } from "./ExportTranscriptMenu";
import { ReplyQuote } from "./ReplyQuote";
import { ConnectorCard } from "./ConnectorCard";
import { SecretRequestCard } from "./SecretRequestCard";
import { hasRoutineExecutionTask, RoutineRunCard } from "./RoutineRunCard";
import { GoalRunCard } from "./GoalRunCard";
import { AttachmentGallery, MessageAttachmentGallery } from "./AttachmentGallery";
import { OptionCard } from "./OptionCard";
import { GroupCallButton, GroupCallOverlay } from "./GroupCallView";
import { OkxAgentInvite, canInviteOkxAgent } from "./OkxAgentInvite";
import { Button } from "@/components/ui/button";
import { ApprovalCard } from "./ApprovalCard";
import { QuestionCard } from "./QuestionCard";
import { ManageMembersPanel } from "./ManageMembersPanel";
import { groupActivityRuns } from "@/lib/activity-runs";
import { ActivityRun } from "./ActivityRun";
import { useDesktopCapabilities, useCaptionChrome } from "./DesktopCapabilities";
import { cn } from "@/lib/cn";
import { useFocusMessage } from "@/lib/focus-message";
import { shortPath } from "@/lib/short-path";
import { BOTTOM_FOLLOW_THRESHOLD, shouldResumeBottomFollow, useBottomFollowResize } from "@/lib/bottom-follow";
import { useComposerDockPad } from "@/lib/composer-dock";
import { awaitedMemberId, showWorkingDots } from "@/lib/turn-tail";
import { liveActivityLabel } from "@/lib/live-activity";
import { splitTranscriptAttachments } from "@/lib/composer-attachments";
import {
  TRANSCRIPT_WINDOW_SIZE,
  expandWindowStart,
  focusWindowRange,
  resolveTranscriptWindow,
  tailWindowStart,
} from "@/lib/transcript-window";
import { OkxGateToolResult } from "./OkxGateToolResult";
import { useReplyDraft } from "@/lib/drafts";
import { isDevDayGate } from "@/lib/dev-day-gate";
import { DevDayGateStarters } from "./DevDayGateStarters";

function dayLabel(at: number): string {
  const d = new Date(at);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return t("chat.day.today");
  if (diffDays === 1) return t("chat.day.yesterday");
  return d.toLocaleDateString(activeLocale(), { weekday: "short", month: "short", day: "numeric" });
}

/** One finished tool step in a room. Same pill the 1:1 chat uses, minus the
 * status glyph — a room reads as a conversation, not a build log. A chip
 * that links somewhere ("Posted in #Standup", a bot⇄bot exchange) opens it,
 * as it would in a 1:1 — a receipt the person cannot follow is only half a
 * receipt. When the linked channel IS this room (an ask made from here is
 * mirrored back into it) there is nowhere to go, so it stays a plain,
 * visible pill. */
export function RoomToolChip({ message, roomId }: { message: Message; roomId?: string }) {
  const { state, dispatch } = useStore();
  const tool = message.tool;
  if (!tool) return null;
  if (message.threadRef) return <ThreadChip message={message} />;
  const comm = message.comm;
  if (comm && comm.groupId !== roomId) {
    const withBot = state.bots.find((b) => b.id === comm.withBotId);
    return (
      <div className="flex justify-start">
        <button
          type="button"
          onClick={() => {
            dispatch({ type: "select", id: comm.groupId });
            const destination = state.groups.find(g => g.id === comm.groupId);
            if (comm.threadId && destination?.tasks?.some(task => task.threadId === comm.threadId)) {
              dispatch({ type: "switchGroupTask", groupId: comm.groupId, threadId: comm.threadId });
            }
          }}
          title={t("room.openBot", { name: comm.withName })}
          className="flex items-center gap-2 border border-hairline bg-panel px-2.5 py-1 font-mono text-[12px] text-ink-secondary hover:bg-raised hover:text-ink"
        >
          <BotAvatar bot={withBot ?? { name: comm.withName, color: comm.withColor }} state="happy" size={16} />
          <span className="max-w-[480px] truncate">{tool.name}</span>
          <ChevronRight size={13} />
        </button>
      </div>
    );
  }
  if (!comm) return <ToolActivity tool={tool} />;
  return (
    <div className="flex justify-start">
      <div
        className={cn(
          "flex items-center gap-2 border border-hairline bg-panel px-2.5 py-1 font-mono text-[12px]",
          tool.ok === false ? "text-danger" : "text-ink-secondary",
        )}
      >
        {comm && <BotAvatar bot={state.bots.find(b => b.id === comm.withBotId) ?? { name: comm.withName, color: comm.withColor }} state="happy" size={16} />}
        <span className={cn("max-w-[480px] truncate", !comm && "font-mono")}>{tool.name}</span>
      </div>
    </div>
  );
}

/** 16px profile avatar + name, shown once per sender cluster — the same mono
 * header row the 1:1 transcript uses. */
function ClusterLabel({ bot, name, color, instances, external }: { bot?: Bot; name: string; color: string; instances?: readonly InstanceInfo[]; external?: boolean }) {
  return (
    <div className="mt-2 flex items-center gap-1.5 pl-0.5">
      <BotAvatar
        bot={bot ?? { name, color: color as Bot["color"] }}
        state={normalizeState(bot?.mascotExpression) ?? "happy"}
        size={16}
        motion="none"
        motionKey={0}
        animated={false}
      />
      <span className="label-mono text-ink">{name}</span>
      {external ? null : <EngineModeBadge bot={bot} instances={instances} variant="status" />}
    </div>
  );
}

/** Day break in the room transcript, matching ChatView's dashed separator. */
function DaySeparator({ at }: { at: number }) {
  return (
    <div className="relative my-4 flex items-center justify-center">
      <div className="frame-rule absolute inset-x-0" />
      <span className="label-mono relative bg-app px-2.5 text-ink-secondary">
        {dayLabel(at)} · {formatTime(at)}
      </span>
    </div>
  );
}

/** Pin toggle for one room message — one pin per room, patchGroup path. */
function PinToggle({ group, message }: { group: Group; message: Message }) {
  const { dispatch } = useStore();
  if (window.ogb?.remoteClient?.active) return null;
  const pinned = group.pinnedMessageId === message.id;
  return (
    <button
      onClick={() =>
        dispatch({
          type: "patchGroup",
          groupId: group.id,
          patch: { pinnedMessageId: pinned ? "" : message.id },
        })
      }
      aria-label={pinned ? t("chat.unpinMessage") : t("chat.pinMessage")}
      className="p-1.5 text-ink-secondary opacity-0 transition-opacity hover:bg-raised hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
      title={pinned ? t("chat.unpinHint") : t("room.pinHint")}
    >
      {pinned ? <PinOff size={14} /> : <Pin size={14} />}
    </button>
  );
}

const Transcript = memo(function Transcript({
  group,
  members,
  messages,
  transcript,
  emergingId,
  onReply,
}: {
  group: Group;
  members: Bot[];
  /** Invalidate the memoized transcript when only the language changes. */
  locale: string;
  /** The windowed suffix of group.messages — the boundary lives in GroupView. */
  messages: Message[];
  /** Full room transcript, used to resolve quoted messages outside the mounted window. */
  transcript: Message[];
  emergingId?: string | null;
  onReply: (message: Message) => void;
}) {
  const { state, dispatch } = useStore();
  const showToolCalls = showToolCallsEnabled(state.config);
  const showGateCards = devDayGateCardsEnabled(state.config);
  const gateBusy = Boolean(group.busyBotId) || Boolean(group.working);
  const memberOf = (id?: string) => members.find((b) => b.id === id);
  // Several bots working at once turn a room into a wall of chips; fold the
  // finished ones the same way a 1:1 chat does.
  const items = useMemo(() => groupActivityRuns(messages.filter(message =>
    message.kind !== "activity" || roomActivityVisible(message, showToolCalls) || isOkxGateTool(message.tool?.name))), [messages, showToolCalls]);
  const newestMessageId = messages.at(-1)?.id;
  const newestUserMessageId = [...messages].reverse().find((message) => message.role === "user")?.id;
  const focus = state.focusMessage;
  const focusedId = focus && !focus.consumed && focus.threadId === group.threadId ? focus.messageId : null;

  const handleCloneOkxAgent = useCallback(async (agentId: string) => {
    await api("/api/okx/agents/import", {
      method: "POST",
      body: JSON.stringify({
        agentId,
        roomId: group.id,
        requestId: `import-${Date.now()}`,
      }),
    });
  }, [group.id]);
  return (
    <>
      {items.map((item, i) => {
        const previous = items[i - 1];
        const prev = previous && (previous.kind === "run" ? previous.messages.at(-1) : previous.message);
        const first = item.kind === "run" ? item.messages[0] : item.message;
        const newDay = !prev || new Date(prev.at).toDateString() !== new Date(first.at).toDateString();
        if (item.kind === "run") {
          // Gate cards remain meaningful even when ordinary tool chips are
          // hidden; an invalid gate payload still exposes its normal result.
          if (!showToolCalls && !item.messages.some((step) => isOkxGateTool(step.tool?.name))) return null;
          const cluster = !prev || prev.role !== first.role || prev.from?.botId !== first.from?.botId || newDay;
          return (
            <div key={item.id} className="contents">
              {newDay && <DaySeparator at={first.at} />}
              {first.from && cluster && (
                <ClusterLabel bot={memberOf(first.from.botId)} name={first.from.name} color={first.from.color} instances={state.instances} />
              )}
              <ActivityRun messages={item.messages} forceOpen={item.messages.some((step) => step.id === focusedId || isOkxGateTool(step.tool?.name))}>
                {item.messages.map((step) => (
                  <div key={step.id} className="contents" data-mid={step.id}>
                    <OkxGateToolResult
                      message={step}
                      enabled={showGateCards}
                      busy={gateBusy}
                      composerDraftId={`group:${group.id}:${group.threadId}`}
                      onCloneAgent={handleCloneOkxAgent}
                      fallback={<RoomToolChip message={step} roomId={group.id} />}
                    />
                  </div>
                ))}
              </ActivityRun>
            </div>
          );
        }
        const m = item.message;
        const user = m.role === "user";
        const attachments = user && m.text ? splitTranscriptAttachments(m.text) : null;
        const newCluster = !prev || prev.role !== m.role || prev.from?.botId !== m.from?.botId || Boolean(prev.comm) || newDay;
        const routineOwner = m.kind === "routine.run" ? memberOf(m.from?.botId) : undefined;
        const routineExecutionThreadId = m.routineRun?.executionThreadId;
        const routineTarget = routineOwner && hasRoutineExecutionTask(routineOwner.tasks, routineExecutionThreadId)
          ? { botId: routineOwner.id, threadId: routineExecutionThreadId }
          : undefined;
        const row =
          // a member can hit a permission ask mid-turn; without this the
          // card never rendered here and the bot waited out its timeout.
          // `tool` distinguishes a permission from a QUESTION — a question
          // only accepts an "answer", so routing it to the approval box
          // would offer an Allow the broker rejects. A structured ask is
          // one of those questions, and answers in its own card.
          m.kind === "secret" && m.secret && m.from?.botId ? (
            <SecretRequestCard botId={m.from.botId} threadId={group.threadId} message={m} />
          ) : m.kind === "connector" && m.connector && m.from?.botId ? (
            <ConnectorCard botId={m.from.botId} threadId={group.threadId} message={m} />
          ) : m.kind === "options" && m.card?.requestId && m.card.questionRequest ? (
            <div className="flex justify-start">
              <QuestionCard threadId={group.threadId} bot={memberOf(m.from?.botId)} message={m} />
            </div>
          ) : m.kind === "options" && m.card?.requestId && m.card.tool ? (
            <div className="flex justify-start">
              <ApprovalCard bot={memberOf(m.from?.botId)} message={m} />
            </div>
          ) : m.kind === "options" && m.card && m.from?.botId ? (
            // a QUESTION from a member. Without this branch the card fell
            // through to null: invisible on screen, and the asking bot sat
            // there until its 15-minute timeout answered for you
            <div className="flex justify-start">
              <OptionCard botId={m.from.botId} threadId={group.threadId} groupId={group.id} message={m} />
            </div>
          ) : m.kind === "goal.run" ? (
            <div className="flex justify-start">
              <GoalRunCard message={m} />
            </div>
          ) : m.kind === "routine.run" ? (
            <div className="flex justify-start">
              <RoutineRunCard
                message={m}
                onOpen={routineTarget
                  ? () => openNotificationTarget(dispatch, routineTarget, state)
                  : undefined}
              />
            </div>
          ) : m.kind === "activity" && m.tool ? (
            roomActivityVisible(m, showToolCalls) || isOkxGateTool(m.tool.name) ? (
                <OkxGateToolResult
                  message={m}
                  enabled={showGateCards}
                  busy={gateBusy}
                  composerDraftId={`group:${group.id}:${group.threadId}`}
                  onCloneAgent={handleCloneOkxAgent}
                  fallback={<RoomToolChip message={m} roomId={group.id} />}
                />
            ) : null
          ) : m.kind === "text" && (m.text || m.attachments?.length) ? (
            <div className={cn("group flex w-full flex-col", user ? "items-end" : "items-start")}>
              <div className={cn("flex w-full items-end gap-1.5", user ? "justify-end" : "justify-start")}>
                {user && (
                  <>
                    <button
                      type="button"
                      onClick={() => onReply(m)}
                      aria-label={t("chat.replyToMessage")}
                      title={t("chat.reply")}
                      className="p-1.5 text-ink-secondary opacity-0 transition-opacity hover:bg-raised hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
                    >
                      <MessageSquareReply size={14} />
                    </button>
                    <PinToggle group={group} message={m} />
                  </>
                )}
                <div
                  className={cn(
                    "w-fit max-w-[min(42rem,78%)] border border-hairline px-4 py-2.5 text-[14px] leading-relaxed",
                    !user && m.id === emergingId && "turn-answer",
                    user ? "chat-text whitespace-pre-wrap bg-raised text-ink" : "bg-card text-ink",
                  )}
                  title={new Date(m.at).toLocaleString()}
                >
                  {m.replyToId && (() => {
                    const target = transcript.find((candidate) => candidate.id === m.replyToId);
                    return target ? (
                      <div className="mb-2">
                        <ReplyQuote
                          message={target}
                          fallbackName={t("room.fallbackBot")}
                          compact
                          onJump={() =>
                            dispatch({ type: "focusMessage", threadId: group.threadId, messageId: target.id })
                          }
                        />
                      </div>
                    ) : null;
                  })()}
                  {user ? (
                    <>
                      {attachments && <AttachmentGallery images={attachments.images} files={attachments.files} message={{ threadId: group.threadId, messageId: m.id }} eager={m.id === newestMessageId || m.id === newestUserMessageId} className={!attachments.display ? "mb-0" : undefined} />}
                      <ThreadRefText text={attachments?.display ?? m.text ?? ""} peers={members} everyone={!group.dm} />
                      {m.via === "api" && (
                        <div className="mt-1 text-[11px] text-ink-secondary">Sent through the API, not typed here</div>
                      )}
                    </>
                  ) : (
                    <>
                      <MessageAttachmentGallery text={m.text ?? ""} attachments={m.attachments} message={{ threadId: group.threadId, messageId: m.id }} className={m.text ? undefined : "mb-0"} eager={m.id === newestMessageId || m.id === newestUserMessageId} />
                      {m.text ? <ChatMarkdown text={m.text} mentionPeers={members} everyone={!group.dm} message={{ threadId: group.threadId, messageId: m.id }} /> : null}
                      <div className="mt-1 flex items-center gap-1.5">
                        {m.external ? (
                          <ExternalAgentLabel external={m.external} />
                        ) : (
                          <EngineModeBadge message={m} bot={memberOf(m.from?.botId)} instances={state.instances} />
                        )}
                      </div>
                    </>
                  )}
                </div>
                {!user && (
                  <>
                    <button
                      type="button"
                      onClick={() => onReply(m)}
                      aria-label={t("chat.replyToMessage")}
                      title={t("chat.reply")}
                      className="p-1.5 text-ink-secondary opacity-0 transition-opacity hover:bg-raised hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
                    >
                      <MessageSquareReply size={14} />
                    </button>
                    <PinToggle group={group} message={m} />
                  </>
                )}
                <span className="self-end pb-1 text-[11px] tabular-nums text-ink-secondary/70 opacity-0 transition-opacity group-hover:opacity-100">
                  {formatTime(m.at)}
                </span>
              </div>
            </div>
          ) : null;
        if (!row) return null;
        return (
          <div key={m.id} className="contents" data-mid={m.id}>
            {newDay && <DaySeparator at={m.at} />}
            {!user && m.from && newCluster && !(m.kind === "activity" && m.comm) && (
              <ClusterLabel bot={memberOf(m.from.botId)} name={m.from.name} color={m.from.color} instances={state.instances} external={Boolean(m.external)} />
            )}
            {row}
          </div>
        );
      })}
    </>
  );
});


/** The room's shared desk: where every member's shell and file tools run,
 * overriding each bot's own folder for room turns. The room pins its own
 * copy on its first turn (the server does the pinning — engines key their
 * sessions to the folder a thread starts in, so a folder must not move
 * under a room that already worked somewhere). The PATCH is made directly
 * rather than through patchGroup: the server validates the path and a
 * rejected folder must not stick in local state. */
function RoomWorkingFolder({ group }: { group: Group }) {
  const { capabilities } = useDesktopCapabilities();
  const home = capabilities.host.homeDir;
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canPick = Boolean(window.ogb?.pickFolder);
  const pinned = group.pinnedCwd; // undefined = not yet, null = each bot's own, string = folder
  const locked = pinned !== undefined;
  const shownCwd = locked ? (pinned ?? undefined) : group.cwd;

  const save = async (cwd: string | null) => {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/groups/${group.id}`, { method: "PATCH", body: JSON.stringify({ cwd }) });
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };
  const pick = async () => {
    const chosen = await window.ogb?.pickFolder?.(group.cwd);
    if (chosen) void save(chosen);
  };

  return (
    <div className="border border-hairline bg-card p-4">
      <div className="text-[14px] font-medium text-ink">{t("room.folder.title")}</div>
      <div className="mt-0.5 text-[12px] text-ink-secondary">{t("room.folder.detail")}</div>
      {locked ? (
        <div className="mt-3">
          <div className="truncate border border-hairline bg-inset px-3 py-1.5 font-mono text-[12px] text-ink" title={shownCwd}>
            {shownCwd ? shortPath(shownCwd, home) : <span className="text-ink-secondary">{t("room.folder.own")}</span>}
          </div>
          <div className="mt-1.5 font-mono text-[11px] text-ink-secondary">
            {t("room.folder.locked")}
          </div>
        </div>
      ) : canPick ? (
        <div className="mt-3 flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate border border-hairline bg-inset px-3 py-1.5 font-mono text-[12px] text-ink" title={group.cwd}>
            {group.cwd ? shortPath(group.cwd, home) : <span className="text-ink-secondary">{t("room.folder.own")}</span>}
          </div>
          <Button variant="secondary" size="sm" onClick={() => void pick()} disabled={saving}>
            <FolderOpen size={13} /> {t("room.folder.choose")}
          </Button>
          {group.cwd && (
            <Button variant="ghost" size="sm" onClick={() => void save(null)} disabled={saving}>
              {t("keys.clear")}
            </Button>
          )}
        </div>
      ) : (
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            // an emptied field clears the folder — the server wants null
            void save((draft ?? group.cwd ?? "").trim() || null);
          }}
        >
          <input
            className="w-full border border-hairline bg-inset px-3 py-1.5 font-mono text-[12px] text-ink placeholder:text-ink-secondary/70 focus:outline-none focus:border-ink"
            placeholder={t("room.folder.placeholder")}
            value={draft ?? group.cwd ?? ""}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button type="submit" variant="primary" size="sm" disabled={saving || draft === null}>
            {t("common.save")}
          </Button>
        </form>
      )}
      {error && <div className="mt-2 font-mono text-[11px] text-danger">{error}</div>}
    </div>
  );
}

/** The folder this room's turns run in — the pinned folder once a turn ran,
 * else the room folder a first turn would pin. Always present so the desk
 * is settable before any folder exists; quiet (icon only) until then. */
function RoomWorkingFolderChip({ group, onToggle }: { group: Group; onToggle: () => void }) {
  const folder = group.pinnedCwd === undefined ? group.cwd : (group.pinnedCwd ?? undefined);
  if (!folder) {
    return (
      <Button
        variant="ghost"
        size="sm"
        icon
        onClick={onToggle}
        title={t("room.folder.chipTitle")}
      >
        <Folder size={13} />
      </Button>
    );
  }
  const name = folder.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || folder;
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onToggle}
      className="max-w-[180px]"
      title={t("chat.workingFolder", { folder })}
    >
      <Folder size={12} />
      <span className="truncate font-mono">{name}</span>
    </Button>
  );
}


type RoomSetupFields = {
  setupPending?: boolean;
  setupRequired?: boolean;
  setupState?: "required" | "completed" | "skipped";
  setupCompletedAt?: number | string | null;
  setupSkippedAt?: number | string | null;
};

type RoomResponderMode = "lead" | "everyone" | "mentions";

function setupResponderMode(responder: GroupDefaultResponder): RoomResponderMode {
  return responder.kind === "member" ? "lead" : responder.kind;
}

function roomNeedsSetup(group: Group): boolean {
  if (group.dm || group.messages.length > 0) return false;
  // SAFETY: setup fields are additive server metadata; the existing Group shape remains valid when absent.
  const marker = group as Group & RoomSetupFields;
  const hasSetupMarker =
    Object.prototype.hasOwnProperty.call(marker, "setupCompletedAt") ||
    Object.prototype.hasOwnProperty.call(marker, "setupSkippedAt");
  // Legacy empty rooms omit both keys and remain immediately usable.
  if (!hasSetupMarker) return false;
  if (
    marker.setupPending === false ||
    marker.setupRequired === false ||
    marker.setupState === "completed" ||
    marker.setupState === "skipped" ||
    marker.setupCompletedAt != null ||
    marker.setupSkippedAt != null
  ) {
    return false;
  }
  return true;
}

function RoomSetup({ group, members }: { group: Group; members: Bot[] }) {
  const { dispatch } = useStore();
  const [folder, setFolder] = useState(group.cwd ?? "");
  const [behavior, setBehavior] = useState<RoomResponderMode>(setupResponderMode(group.defaultResponder));
  const [leadId, setLeadId] = useState(
    group.defaultResponder.kind === "member" ? group.defaultResponder.botId : members[0]?.id ?? "",
  );
  const [instructions, setInstructions] = useState(group.bulletin);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leadPickerOpen, setLeadPickerOpen] = useState(false);
  const leadPickerRef = useRef<HTMLDivElement>(null);
  const selectedLead = members.find((member) => member.id === leadId) ?? members[0];

  useEffect(() => {
    if (!leadPickerOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!leadPickerRef.current?.contains(event.target as Node)) setLeadPickerOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLeadPickerOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [leadPickerOpen]);

  const responder = (): GroupDefaultResponder => {
    if (behavior === "everyone") return { kind: "everyone" };
    if (behavior === "mentions") return { kind: "mentions" };
    return members.some((member) => member.id === leadId)
      ? { kind: "member", botId: leadId }
      : group.defaultResponder;
  };

  const finish = async (action: "complete" | "skip") => {
    setLeadPickerOpen(false);
    setSaving(true);
    setError(null);
    try {
      const payload =
        action === "skip"
          ? { action }
          : {
              action,
              cwd: folder.trim() || null,
              defaultResponder: responder(),
              bulletin: instructions,
            };
      const result = await api(`/api/groups/${group.id}/setup`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      const now = Date.now();
      const nextGroup = {
        ...(result.group ?? group),
        id: group.id,
        setupPending: false,
        ...(action === "skip" ? { setupSkippedAt: now } : { setupCompletedAt: now }),
      };
      dispatch({ type: "groupPatched", group: nextGroup });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  const pickFolder = async () => {
    const chosen = await window.ogb?.pickFolder?.(folder || group.cwd);
    if (chosen) setFolder(chosen);
  };

  return (
    <section
      data-testid="room-setup"
      aria-labelledby="room-setup-title"
      className="relative z-20 w-full overflow-visible border border-hairline bg-card shadow-[0_16px_40px_-16px_rgb(0_0_0/0.6)]"
    >
      <div className="border-b border-hairline bg-panel/70 px-5 py-4 sm:px-7">
        <div className="flex items-start gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center border border-hairline bg-control font-mono text-[11px] font-bold text-ink">1</span>
          <div>
            <h1 id="room-setup-title" className="text-lg font-medium tracking-tight text-ink">{t("room.setup.title", { name: group.name })}</h1>
            <p className="mt-0.5 max-w-[560px] text-[13px] leading-relaxed text-ink-secondary">
              {t("room.setup.detail")}
            </p>
          </div>
        </div>
      </div>
      <form
        className="space-y-5 px-5 py-5 sm:px-7 sm:py-6"
        onSubmit={(event) => {
          event.preventDefault();
          void finish("complete");
        }}
      >
        <label className="block">
          <span className="text-[13px] font-semibold text-ink">{t("room.folder.title")}</span>
          <span className="mt-1 block text-[12px] text-ink-secondary">{t("room.setup.folderDetail")}</span>
          <div className="mt-2 flex gap-2">
            <input
              value={folder}
              onChange={(event) => setFolder(event.target.value)}
              placeholder={t("room.folder.own")}
              className="min-w-0 flex-1 border border-hairline bg-inset px-3 py-2 font-mono text-[12.5px] text-ink placeholder:text-ink-secondary/70 focus:border-ink focus:outline-none"
            />
            {window.ogb?.pickFolder && (
              <button
                type="button"
                onClick={() => void pickFolder()}
                disabled={saving}
                className="flex shrink-0 items-center gap-1.5 border border-hairline bg-raised px-3 py-2 text-[13px] font-medium text-ink hover:bg-raised-hover disabled:opacity-50"
              >
                <FolderOpen size={14} /> Choose
              </button>
            )}
          </div>
        </label>

        <fieldset className="block">
          <legend className="text-[13px] font-semibold text-ink">{t("room.responder.aria")}</legend>
          <p className="mt-1 text-[12px] text-ink-secondary">{t("room.setup.responderDetail")}</p>
          <div role="radiogroup" aria-label={t("room.responder.aria")} className="mt-2 grid gap-2 sm:grid-cols-3">
            <div ref={leadPickerRef} className="relative min-w-0">
              <button
                type="button"
                role="radio"
                aria-checked={behavior === "lead"}
                aria-haspopup="listbox"
                aria-expanded={behavior === "lead" && leadPickerOpen}
                onClick={() => {
                  setBehavior("lead");
                  setLeadPickerOpen((open) => !open);
                }}
                disabled={saving}
                className={cn(
                  "flex min-h-[64px] w-full flex-col items-start justify-between border px-3 py-2.5 text-left transition focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                  behavior === "lead"
                    ? "border-ink bg-raised text-ink"
                    : "border-hairline bg-inset text-ink-secondary hover:border-ink-secondary/60 hover:bg-raised",
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[13px] font-semibold">
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full border",
                        behavior === "lead" ? "border-accent bg-accent" : "border-ink-secondary/60",
                      )}
                    >
                      {behavior === "lead" && <span className="size-1.5 rounded-full bg-white" />}
                    </span>
                    {t("room.behavior.lead")}
                  </span>
                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className={cn("shrink-0 text-ink-secondary transition-transform", leadPickerOpen && "rotate-180")}
                  />
                </span>
                <span className="ml-6 mt-2 truncate text-[11.5px] text-ink-secondary">
                  {selectedLead?.name ?? t("room.behavior.chooseTeammate")}
                </span>
              </button>
              {behavior === "lead" && leadPickerOpen && (
                <div
                  role="listbox"
                  aria-label={t("room.behavior.chooseLead")}
                  className="absolute left-0 top-full z-30 mt-1.5 w-72 max-w-[calc(100vw-3rem)] overflow-hidden border border-hairline bg-menu shadow-[0_16px_40px_-16px_rgb(0_0_0/0.6)]"
                >
                  <div className="border-b border-hairline/40 px-3 py-2.5">
                    <div className="text-[12.5px] font-semibold text-ink">{t("room.behavior.chooseLead")}</div>
                    <div className="mt-0.5 text-[11.5px] text-ink-secondary">{t("room.behavior.chooseLeadDetail")}</div>
                  </div>
                  <div className="max-h-48 overflow-y-auto p-1.5">
                    {members.map((member) => {
                      const selected = member.id === leadId;
                      return (
                        <button
                          key={member.id}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => {
                            setLeadId(member.id);
                            setLeadPickerOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition",
                            selected ? "bg-raised" : "hover:bg-raised-hover",
                          )}
                        >
                          <BotAvatar
                            bot={member}
                            state={normalizeState(member.mascotExpression) ?? "happy"}
                            size={24}
                            animated={false}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-ink">{member.name}</span>
                            <span className="block truncate text-[11px] text-ink-secondary">{member.title}</span>
                          </span>
                          {selected && <Check size={15} className="shrink-0 text-accent" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              role="radio"
              aria-checked={behavior === "everyone"}
              onClick={() => {
                setBehavior("everyone");
                setLeadPickerOpen(false);
              }}
              disabled={saving}
              className={cn(
                "flex min-h-[64px] w-full flex-col items-start justify-between border px-3 py-2.5 text-left transition focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                behavior === "everyone"
                  ? "border-ink bg-raised text-ink"
                  : "border-hairline bg-inset text-ink-secondary hover:border-ink-secondary/60 hover:bg-raised",
              )}
            >
              <span className="flex items-center gap-2 text-[13px] font-semibold">
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border",
                    behavior === "everyone" ? "border-accent bg-accent" : "border-ink-secondary/60",
                  )}
                >
                  {behavior === "everyone" && <span className="size-1.5 rounded-full bg-white" />}
                </span>
                {t("room.responder.everyoneOption")}
              </span>
              <span className="ml-6 mt-2 text-[11.5px] text-ink-secondary">{t("room.setup.allMembers")}</span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={behavior === "mentions"}
              onClick={() => {
                setBehavior("mentions");
                setLeadPickerOpen(false);
              }}
              disabled={saving}
              className={cn(
                "flex min-h-[64px] w-full flex-col items-start justify-between border px-3 py-2.5 text-left transition focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                behavior === "mentions"
                  ? "border-ink bg-raised text-ink"
                  : "border-hairline bg-inset text-ink-secondary hover:border-ink-secondary/60 hover:bg-raised",
              )}
            >
              <span className="flex items-center gap-2 text-[13px] font-semibold">
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border",
                    behavior === "mentions" ? "border-accent bg-accent" : "border-ink-secondary/60",
                  )}
                >
                  {behavior === "mentions" && <span className="size-1.5 rounded-full bg-white" />}
                </span>
                {t("room.responder.mentionsOption")}
              </span>
              <span className="ml-6 mt-2 text-[11.5px] text-ink-secondary">{t("room.setup.onlyMentioned")}</span>
            </button>
          </div>
        </fieldset>

        <label className="block">
          <span className="text-[13px] font-semibold text-ink">{t("room.setup.instructions")}</span>
          <span className="mt-1 block text-[12px] text-ink-secondary">{t("room.setup.instructionsDetail")}</span>
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            rows={5}
            placeholder={t("room.setup.instructionsPlaceholder")}
            className="mt-2 w-full resize-y border border-hairline bg-inset px-3 py-2 font-mono text-[12.5px] leading-relaxed text-ink placeholder:text-ink-secondary/70 focus:border-ink focus:outline-none"
          />
        </label>

        {error && <div role="alert" className="border border-danger/40 bg-danger/10 px-3 py-2 font-mono text-[12px] text-danger">{error}</div>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => void finish("skip")}
            disabled={saving}
            className="px-3 py-2 text-left text-[13px] text-ink-secondary hover:bg-raised hover:text-ink disabled:opacity-50"
          >
            {t("room.setup.skip")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 border border-accent bg-accent px-4 py-2 font-mono text-[11.5px] uppercase tracking-[0.06em] text-accent-ink hover:opacity-85 disabled:opacity-50"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {t("room.setup.save")}
          </button>
        </div>
      </form>
    </section>
  );
}
export function GroupView({ group }: { group: Group }) {
  const { state, dispatch } = useStore();
  const remoteClient = window.ogb?.remoteClient?.active === true;
  // Same Windows caption handling as ChatView: drag on the header, shift the
  // right-hand controls below the renderer-drawn caption buttons.
  const { dragStyle: headerDragStyle, noDragStyle: headerNoDragStyle, controlsShiftStyle } = useCaptionChrome();
  const stream = useStreaming();
  const streaming = stream.streaming[group.threadId];
  const scrollRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const composerDockRef = useRef<HTMLDivElement>(null);
  const composerDock = useComposerDockPad(composerDockRef);
  const [follow, setFollow] = useState(true);
  const followRef = useRef(true);
  const previousScrollTop = useRef(0);
  const touchY = useRef(0);
  const [bulletinOpen, setBulletinOpen] = useState(false);
  const [bulletinDraft, setBulletinDraft] = useState(group.bulletin);
  const [folderOpen, setFolderOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);
  const { replyTo, selectReply, clearReply, consumeReply, restoreReply } = useReplyDraft(
    group.threadId,
    `group:${group.id}:${group.threadId}`,
    group.messages,
  );
  const membersTriggerRef = useRef<HTMLButtonElement>(null);
  const closeMembers = useCallback(() => setMembersOpen(false), []);
  useEffect(() => setFindOpen(false), [group.threadId]);
  useEffect(() => {
    const onFind = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setFindOpen(true);
      }
    };
    window.addEventListener("keydown", onFind);
    return () => window.removeEventListener("keydown", onFind);
  }, []);

  const members = useMemo(
    () => group.memberIds.map((id) => state.bots.find((b) => b.id === id)).filter((b): b is Bot => Boolean(b)),
    [group.memberIds, state.bots],
  );
  const defaultResp = effectiveDefaultResponder(group, members);
  const leadBot = defaultResp.kind === "member"
    ? members.find((m) => m.id === defaultResp.botId) ?? members[0]
    : members[0];
  const purpose = group.bulletin?.trim().split("\n")[0]?.trim() || "No room purpose yet — add group instructions";
  const externalAgents = useExternalAgents();
  const roomExternal = externalAgents.filter((agent) => group.externalAgentIds?.includes(agent.id) && agent.status !== "revoked");
  const participantCount = members.length + roomExternal.length + 1;
  const agentCount = members.length + roomExternal.length;
  const connectionLabel = state.connected ? "Connected" : "Offline";
  const speaker = members.find((b) => b.id === group.busyBotId);
  const importedOkxAgentIds = useMemo(
    () => new Set(members.flatMap((member) => member.okxImport ? [member.okxImport.externalAgentId] : [])),
    [members],
  );
  const setupPending = !remoteClient && roomNeedsSetup(group);
  const devDayGate = isDevDayGate(group);
  // Catalog join receipts establish provenance but are not a conversation.
  // The starter hero vanishes after the first person or real tool/agent turn.
  const hasDevDayConversation = group.messages.some((message) => message.kind !== "activity" || message.tool?.system !== true);

  // Mascot stays while a member works; the finished reply pops in above it.
  const lastGroupMessage = group.messages.at(-1);
  const toolInFlight = lastGroupMessage?.kind === "activity" && lastGroupMessage.tool?.ok === undefined;
  const activityLabel = liveActivityLabel(lastGroupMessage);
  // A member busy elsewhere takes its turn when free; until then the room
  // works with no speaker, and the presence row names who it is waiting on.
  const awaited = members.find(
    (b) => b.id === awaitedMemberId(group.working, group.busyBotId, lastGroupMessage),
  );
  const waiting =
    Boolean(speaker && showWorkingDots(true, group.messages.at(-1), speaker.id)) || awaited !== undefined;
  const wasWaiting = useRef(false);
  const [popping, setPopping] = useState<{ id: string; botId?: string } | null>(null);
  const poppingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (poppingTimer.current) clearTimeout(poppingTimer.current);
  }, []);
  useLayoutEffect(() => {
    if (poppingTimer.current) clearTimeout(poppingTimer.current);
    poppingTimer.current = null;
    wasWaiting.current = false;
    setPopping(null);
  }, [group.id, group.threadId]);
  useEffect(() => {
    if (waiting) wasWaiting.current = true;
  }, [waiting]);
  useLayoutEffect(() => {
    if (lastGroupMessage?.role !== "bot" || lastGroupMessage.kind !== "text" || !wasWaiting.current) return;
    wasWaiting.current = false;
    setPopping({
      id: lastGroupMessage.id,
      botId: lastGroupMessage.from?.botId,
    });
    const messageId = lastGroupMessage.id;
    if (poppingTimer.current) clearTimeout(poppingTimer.current);
    poppingTimer.current = setTimeout(() => {
      poppingTimer.current = null;
      setPopping((current) => current?.id === messageId ? null : current);
    }, 520);
  }, [
    lastGroupMessage?.id,
    lastGroupMessage?.role,
    lastGroupMessage?.kind,
    lastGroupMessage?.from?.botId,
  ]);
  const presenceVisible = waiting || popping !== null;
  const presenceSpeaker =
    speaker ?? awaited ?? members.find((member) => member.id === popping?.botId) ?? members[0];

  // Windowed transcript, mirroring ChatView: only a tail of the room mounts;
  // the anchored boundary re-tails on a render-phase reset when the room (or
  // its thread) changes. Working dots below stay on the FULL list's tail.
  const transcriptKey = `${group.id}:${group.threadId}`;
  const [transcriptWindow, setTranscriptWindow] = useState<{
    key: string;
    start: number;
    end: number | null;
  }>(() => ({
    key: transcriptKey,
    start: tailWindowStart(group.messages.length),
    end: null,
  }));
  if (transcriptWindow.key !== transcriptKey) {
    setTranscriptWindow({ key: transcriptKey, start: tailWindowStart(group.messages.length), end: null });
  }
  const {
    visible: windowedMessages,
    hiddenCount,
    laterCount,
    startIndex,
    endIndex,
  } = useMemo(
    () => resolveTranscriptWindow(group.messages, transcriptWindow.start, TRANSCRIPT_WINDOW_SIZE, transcriptWindow.end),
    [group.messages, transcriptWindow.start, transcriptWindow.end],
  );

  const setBottomFollow = useCallback((next: boolean) => {
    followRef.current = next;
    setFollow(next);
  }, []);
  useBottomFollowResize(scrollRef, transcriptRef, followRef, setupPending ? null : transcriptKey);

  useEffect(() => setBottomFollow(true), [group.id, setBottomFollow]);

  const appliedFocus = useRef<number | null>(null);
  useEffect(() => {
    const focus = state.focusMessage;
    if (!focus || focus.consumed || focus.threadId !== group.threadId || appliedFocus.current === focus.nonce) return;
    const targetIndex = group.messages.findIndex((message) => message.id === focus.messageId);
    if (targetIndex < 0) return;
    appliedFocus.current = focus.nonce;
    const range = focusWindowRange(group.messages.length, targetIndex);
    setBottomFollow(false);
    setTranscriptWindow({ key: transcriptKey, start: range.start, end: range.end });
  }, [group.messages, group.threadId, setBottomFollow, state.focusMessage, transcriptKey]);
  useFocusMessage(group.threadId, group.messages.length > 0);

  useEffect(() => setBulletinDraft(group.bulletin), [group.id, group.bulletin]);
  // an open folder editor belongs to the room it was opened in
  useEffect(() => setFolderOpen(false), [group.id]);
  useEffect(() => setMembersOpen(false), [group.id]);
  // deps track the FULL messages.length, so expanding the window (which only
  // changes windowedMessages) can never re-trigger this bottom scrollTo.
  // `follow` is intentionally omitted — see ChatView.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !followRef.current) return;
    el.scrollTo({ top: el.scrollHeight });
    previousScrollTop.current = el.scrollTop;
  }, [group.id, group.messages.length, streaming, group.busyBotId, group.working, composerDock.pad]);

  // Expanding prepends rows: capture the height first, then after the commit
  // shift scrollTop by the growth so the message under the cursor stays put
  // (browser scroll anchoring is disabled on this container).
  const preExpandHeight = useRef<number | null>(null);
  const showEarlier = () => {
    preExpandHeight.current = scrollRef.current?.scrollHeight ?? null;
    // expanding means reading scrollback — never let a mid-expand stream
    // event pin the viewport back to the bottom
    setBottomFollow(false);
    const start = expandWindowStart(startIndex);
    setTranscriptWindow((w) => ({ ...w, start }));
  };
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (preExpandHeight.current === null || !el) return;
    el.scrollTop += el.scrollHeight - preExpandHeight.current;
    preExpandHeight.current = null;
    // keep the resume-follow heuristic from reading the restore as a
    // downward user scroll
    previousScrollTop.current = el.scrollTop;
  }, [transcriptWindow.start]);

  const showLater = () => {
    setBottomFollow(false);
    const nextEnd = Math.min(group.messages.length, endIndex + TRANSCRIPT_WINDOW_SIZE);
    setTranscriptWindow((w) => ({ ...w, end: nextEnd >= group.messages.length ? null : nextEnd }));
  };

  const atEnd = () => {
    const el = scrollRef.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_FOLLOW_THRESHOLD;
  };

  const saveBulletin = () => {
    setBulletinOpen(false);
    if (bulletinDraft !== group.bulletin) {
      dispatch({ type: "patchGroup", groupId: group.id, patch: { bulletin: bulletinDraft } });
    }
  };


  return (
    <main className="relative flex h-full min-w-0 flex-1 flex-col bg-app">
      <GroupCallOverlay group={group} members={members} />
      {membersOpen && !remoteClient && !group.dm && (
        <ManageMembersPanel group={group} onClose={closeMembers} triggerRef={membersTriggerRef} />
      )}
      {/* Header: static member avatars; a ring + dot marks the working bot. */}
      {/* Header: line 1 name, line 2 purpose, line 3 counts + connection state */}
      <div
        style={headerDragStyle}
        className={cn(
          "shrink-0 frame-rule-below bg-app px-4 py-2 flex items-center justify-between gap-3",
          // Room for the drawer button, which overlays this corner below md.
          // Room for the drawer button, which overlays this corner on <= 768px.
          "pl-12 min-[769px]:pl-4",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-0.5" style={headerNoDragStyle}>
          {/* Line 1: room name */}
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-mono text-[14px] font-semibold text-ink">{group.name}</span>
          </div>
          {/* Line 2: purpose */}
          <div className="truncate font-mono text-[11.5px] text-ink-secondary" title={purpose}>
            {purpose}
          </div>
          {/* Line 3: counts + connection state */}
          <div className="truncate font-mono text-[10.5px] text-ink-secondary">
            <span>{participantCount} participants · {agentCount} agents · </span>
            <span className="inline-flex items-center gap-1">
              <span className={cn("size-1.5 rounded-full", state.connected ? "bg-success" : "bg-warning")} />
              <span>{connectionLabel}</span>
            </span>
          </div>
        </div>

        <div
          className="flex items-center gap-2 shrink-0"
          style={controlsShiftStyle}
        >
          <Button
            variant="ghost"
            size="sm"
            icon
            onClick={() => setFindOpen((open) => !open)}
            aria-label={t("chat.find")}
            aria-pressed={findOpen}
            className={cn("hidden min-[769px]:inline-flex", findOpen ? "text-ink bg-raised" : "text-ink-secondary")}
            title={t("chat.findShortcut")}
          >
            <Search size={14} />
          </Button>

          {canInviteOkxAgent(group, remoteClient) && (
            <div className="hidden min-[1025px]:inline-flex">
              <OkxAgentInvite
                roomId={group.id}
                importedExternalAgentIds={importedOkxAgentIds}
                label={t("room.inviteAgent")}
              />
            </div>
          )}

          {!group.dm && (
            <Button
              ref={membersTriggerRef}
              variant="secondary"
              size="sm"
              onClick={() => setMembersOpen(true)}
              title={t("room.members.manage")}
              className="hidden min-[769px]:inline-flex"
            >
              {t("room.details")}
            </Button>
          )}

          <Button
            variant={state.activityOpen ? "primary" : "secondary"}
            size="sm"
            onClick={() => dispatch({ type: "toggleActivity" })}
            aria-pressed={state.activityOpen}
            title="Activity timeline"
            className="hidden min-[769px]:inline-flex"
          >
            {t("activity.title")}
          </Button>

          <div className="relative" ref={moreMenuRef}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMoreOpen((open) => !open)}
              aria-expanded={moreOpen}
              title={t("room.moreActions")}
            >
              More
              <ChevronDown size={11} className={cn("transition-transform", moreOpen && "rotate-180")} />
            </Button>
            {moreOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-30 mt-1 min-w-[220px] border border-hairline bg-menu p-2 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.6)] font-mono text-[12px]"
              >
                {/* Collapsed actions at narrow widths */}
                <div className="min-[769px]:hidden border-b border-hairline/60 pb-2 mb-2 flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFindOpen((open) => !open);
                      setMoreOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-ink hover:bg-raised-hover"
                  >
                    <Search size={14} className="shrink-0 text-ink-secondary" />
                    <span>{t("chat.find")}</span>
                  </button>
                  {!group.dm && (
                    <button
                      type="button"
                      onClick={() => {
                        setMembersOpen(true);
                        setMoreOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-ink hover:bg-raised-hover"
                    >
                      <Users size={14} className="shrink-0 text-ink-secondary" />
                      <span>{t("room.details")}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: "toggleActivity" });
                      setMoreOpen(false);
                    }}
                    className="flex w-full items-center justify-between px-2 py-1.5 text-left text-ink hover:bg-raised-hover"
                  >
                    <span className="flex items-center gap-2">
                      <Clock size={14} className="shrink-0 text-ink-secondary" />
                      <span>{t("activity.title")}</span>
                    </span>
                    {state.activityOpen && (
                      <span className="text-[10px] text-accent font-bold">Active</span>
                    )}
                  </button>
                </div>

                {canInviteOkxAgent(group, remoteClient) && (
                  <div className="min-[1025px]:hidden border-b border-hairline/60 pb-2 mb-2 py-1">
                    <OkxAgentInvite
                      roomId={group.id}
                      importedExternalAgentIds={importedOkxAgentIds}
                      label={t("room.inviteAgent")}
                    />
                  </div>
                )}

                {leadBot && !remoteClient && (
                  <div className="border-b border-hairline/60 pb-2 mb-2">
                    <div className="label-mono text-ink-secondary mb-1">{t("room.model")}</div>
                    <ModelPicker bot={leadBot} threadId={group.threadId} />
                  </div>
                )}
                <div className="border-b border-hairline/60 pb-2 mb-2">
                  <div className="label-mono text-ink-secondary mb-1">{t("room.tokensAndCost")}</div>
                  <div className="text-[11px] text-ink-secondary">
                    {(() => {
                      const usage = leadBot?.tasks?.find((t) => t.threadId === group.threadId)?.usage;
                      return usage ? usageDetail(usage) : "No token usage recorded yet";
                    })()}
                  </div>
                </div>
                <div className="py-1">
                  <GroupCallButton group={group} members={members} />
                </div>
                <div className="py-1">
                  <ExportTranscriptMenu
                    title={group.name}
                    messages={group.messages}
                    isGroup
                  />
                </div>
                {!remoteClient && !setupPending && !group.dm && (
                  <div className="py-1 border-t border-hairline/60 mt-1">
                    <RoomWorkingFolderChip group={group} onToggle={() => { setFolderOpen((open) => !open); setMoreOpen(false); }} />
                  </div>
                )}
                {!remoteClient && !setupPending && !group.dm && (
                  <div className="pt-2 border-t border-hairline/60 mt-1">
                    <div className="label-mono text-ink-secondary mb-1">{t("room.responderMode")}</div>
                    <DefaultResponderSelect group={group} members={members} />
                  </div>
                )}
                {!remoteClient && !setupPending && !group.dm && (
                  <div className="pt-2 border-t border-hairline/60 mt-1">
                    <div className="label-mono text-ink-secondary mb-1">{t("room.threads")}</div>
                    <GroupTaskPicker group={group} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {findOpen && <ChatFindBar threadId={group.threadId} onClose={() => setFindOpen(false)} />}

      {/* Working folder card — the chip in the header toggles it */}
      {!setupPending && folderOpen && !group.dm && (
        <div className="w-full px-5">
          <div className="mb-1">
            <RoomWorkingFolder group={group} />
          </div>
        </div>
      )}

      {/* Pinned message banner — resolves against the room's full transcript */}
      {(() => {
        const pinned = group.messages.find((m) => m.id === group.pinnedMessageId && m.kind === "text");
        const text = pinned ? (pinned.text ?? "").replace(/\s+/g, " ").trim() : "";
        if (!pinned || !text) return null;
        const sender = pinned.role === "user" ? t("chat.you") : (pinned.from?.name ?? t("room.aBot"));
        return (
          <div className="w-full px-4 pt-2">
            <div className="flex items-center gap-2 border border-hairline bg-raised px-3 py-1.5">
              <Pin size={12} className="shrink-0 text-ink" />
              <button
                onClick={() => dispatch({ type: "focusMessage", threadId: group.threadId, messageId: pinned.id })}
                className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
                title={t("chat.pinnedJump")}
              >
                <span className="shrink-0 font-mono text-[11px] font-medium text-ink">{sender}</span>
                <span className="truncate font-mono text-[11.5px] text-ink-secondary">{text}</span>
              </button>
              <button
                onClick={() => dispatch({ type: "patchGroup", groupId: group.id, patch: { pinnedMessageId: "" } })}
                aria-label={t("chat.unpinMessage")}
                title={t("chat.unpin")}
                className={cn("shrink-0 p-0.5 text-ink-secondary hover:text-ink", remoteClient && "hidden")}
              >
                <X size={12} />
              </button>
            </div>
          </div>
        );
      })()}

      <div className="flex h-full min-h-0 flex-1 overflow-hidden">
        <div className="relative min-h-0 min-w-0 flex-1 flex flex-col">
      <div
        ref={scrollRef}
        className="h-full overflow-x-hidden overflow-y-auto px-5 [overflow-anchor:none]"
        onWheel={(e) => {
          if (e.deltaY < 0) setBottomFollow(false);
          else if (atEnd()) setBottomFollow(true);
        }}
        onTouchStart={(e) => (touchY.current = e.touches[0]?.clientY ?? 0)}
        onTouchMove={(e) => {
          const y = e.touches[0]?.clientY ?? 0;
          if (y > touchY.current + 4) setBottomFollow(false);
          else if (atEnd()) setBottomFollow(true);
        }}
        onScroll={() => {
          const el = scrollRef.current;
          if (!el) return;
          const scrollTop = el.scrollTop;
          const resume = shouldResumeBottomFollow({
            following: followRef.current,
            previousScrollTop: previousScrollTop.current,
            scrollTop,
            distanceFromBottom: el.scrollHeight - scrollTop - el.clientHeight,
          });
          previousScrollTop.current = scrollTop;
          if (resume) setBottomFollow(true);
        }}
      >
        {setupPending ? (
          <div
            ref={transcriptRef}
            className="mx-auto flex w-full max-w-[52rem] flex-col py-6"
            style={{ paddingBottom: composerDock.pad }}
          >
            <RoomSetup group={group} members={members} />
          </div>
        ) : (
        <div
          ref={transcriptRef}
          className="mx-auto flex w-full max-w-[52rem] flex-col gap-3 pt-1"
          style={{ paddingBottom: composerDock.pad }}
          role="log"
          aria-live="polite"
          aria-label={t("room.aria", { name: group.name })}
        >
          {/* Compact purpose banner */}
          {!setupPending && (
            <div className="border border-hairline bg-panel p-2.5 flex flex-wrap items-center justify-between gap-2 min-w-0 w-full max-w-full">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="label-mono text-ink-secondary shrink-0 flex items-center gap-1">
                  <Pin size={10} />
                  <span>PURPOSE:</span>
                </span>
                {bulletinOpen ? (
                  <div className="flex-1 min-w-0">
                    <textarea
                      autoFocus
                      value={bulletinDraft}
                      onChange={(e) => setBulletinDraft(e.target.value)}
                      onBlur={saveBulletin}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveBulletin();
                        if (e.key === "Escape") {
                          setBulletinDraft(group.bulletin);
                          setBulletinOpen(false);
                        }
                      }}
                      placeholder={t("room.bulletin.placeholder")}
                      rows={2}
                      className="w-full resize-none border border-hairline bg-inset p-1.5 font-mono text-[12px] leading-relaxed text-ink placeholder:text-ink-secondary/70 focus:outline-none"
                    />
                  </div>
                ) : (
                  <span className="break-words font-mono text-[12px] text-ink min-w-0">
                    {purpose}
                  </span>
                )}
              </div>
              {!remoteClient && !bulletinOpen && (
                <button
                  type="button"
                  onClick={() => setBulletinOpen(true)}
                  className="label-mono shrink-0 text-ink-secondary hover:text-ink"
                >
                  Edit
                </button>
              )}
            </div>
          )}

          {/* Agent roster strip */}
          {members.length + roomExternal.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border border-hairline bg-panel px-3 py-2 min-w-0">
              <span className="label-mono text-ink-secondary mr-1 shrink-0">AGENTS:</span>
              {members.map((member) => (
                <div key={member.id} className="min-w-0 max-w-full">
                  <AgentIdentity
                    bot={member}
                    variant="compact"
                    state={{ instances: state.instances }}
                    className="max-w-full flex-wrap"
                  />
                </div>
              ))}
              {roomExternal.map((agent) => (
                <span key={agent.id} className="inline-flex min-w-0 max-w-full items-center gap-1.5 font-mono text-[11px]" data-external-member={agent.transport}>
                  <span className="truncate font-semibold text-ink">{agent.displayName}</span>
                  <span className="text-ink-secondary">({agent.transport === "zroute" ? t("external.transport.zroute") : t("external.transport.direct")})</span>
                  <Tag tone={agent.status === "ready" ? "success" : "danger"} variant="soft" size="sm">{t(`external.status.${agent.status}`)}</Tag>
                </span>
              ))}
            </div>
          )}
          {group.messages.length === 0 || (devDayGate && !hasDevDayConversation) ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
              <div className="flex -space-x-2">
                {members.slice(0, 3).map((b) => (
                  <BotAvatar
                    key={b.id}
                    bot={b}
                    state="happy"
                    size={44}
                    motion="none"
                    motionKey={0}
                    animated={false}
                  />
                ))}
              </div>
              <div className="font-mono text-[16px] font-medium tracking-tight text-ink">{group.name}</div>
              <div className="max-w-[420px] font-mono text-[12px] leading-relaxed text-ink-secondary">
                {devDayGate && members.length > 0
                  ? `${members.map((m) => m.name).join(", ")} gate every listing and spend.`
                  : devDayGate
                    ? "Markets, Listing Coach, and Spend Scout gate every listing and spend."
                    : groupResponseHint(group, members)}
              </div>
              <DevDayGateStarters
                composerDraftId={`group:${group.id}:${group.threadId}`}
                members={members}
                agentCount={members.length}
              />
            </div>
          ) : null}
          {hiddenCount > 0 && (
            <div className="flex justify-center pt-2">
              <Button
                variant="secondary"
                size="xs"
                onClick={showEarlier}
              >
                {t("chat.showEarlier", { count: hiddenCount })}
              </Button>
            </div>
          )}
          <Transcript
            group={group}
            members={members}
            locale={activeLocale()}
            messages={windowedMessages}
            transcript={group.messages}
            emergingId={popping?.id}
            onReply={selectReply}
          />
          {laterCount > 0 && (
            <div className="flex justify-center">
              <Button
                variant="secondary"
                size="xs"
                onClick={showLater}
              >
                {t("chat.showLater", { count: laterCount })}
              </Button>
            </div>
          )}
          {(speaker || presenceVisible) && (
            <TurnPresence
              avatar={
                // the speaker's real profile image when it has one, as in ChatView
                <BotAvatar
                  bot={presenceSpeaker ?? { color: "green" }}
                  state={toolInFlight && !awaited ? "working" : "thinking"}
                  size={36}
                />
              }
              visible={presenceVisible}
              label={activityLabel}
              answering={popping !== null}
            />
          )}
        </div>
        )}
      </div>

      {!follow && (
        <button
          onClick={() => {
            setBottomFollow(true);
            setTranscriptWindow({ key: transcriptKey, start: tailWindowStart(group.messages.length), end: null });
            requestAnimationFrame(() => {
              scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
            });
          }}
          aria-label={t("chat.jumpToLatestAria")}
          className="animate-pop-in absolute left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 border border-hairline bg-raised px-3 py-1 font-mono text-[11.5px] text-ink shadow-[0_4px_12px_rgba(0,0,0,0.3)] hover:border-ink hover:bg-raised-hover"
          style={{ bottom: composerDock.height }}
        >
          <ArrowDown size={12} /> {t("chat.jumpToLatest")}
        </button>
      )}

      <div ref={composerDockRef} className="absolute inset-x-0 bottom-0 z-[2]">
      <Composer
        key={group.threadId}
        group={group}
        members={members}
        locked={setupPending}
        replyTo={replyTo}
        onClearReply={clearReply}
        onConsumeReply={consumeReply}
        onRestoreReply={restoreReply}
      />
      </div>
        </div>
        {state.activityOpen && (
          <RoomActivityTimeline
            group={group}
            messages={group.messages}
            bots={members}
            onClose={() => dispatch({ type: "toggleActivity", open: false })}
          />
        )}
      </div>
    </main>
  );
}
