import { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tag, type TagTone } from "@/components/ui/tag";
import { AgentMark } from "@/components/agent-identity/AgentMark";
import { isOkxGateTool, parseOkxActionCard } from "@/lib/okx-action-cards";
import { formatTime, useStore, type Bot, type Group, type Message } from "@/state/store";
import { cn } from "@/lib/cn";

export type RoomActivityEventKind = "join" | "task" | "tool" | "reply";

export interface RoomActivityEvent {
  id: string;
  messageId: string;
  kind: RoomActivityEventKind;
  at: number;
  actor: string;
  actorBot?: Bot;
  action: string;
  statusText: string;
  statusTone: TagTone;
  technicalDetails?: string;
  hasEvidence?: boolean;
}

interface EventWithSortMeta extends RoomActivityEvent {
  orderIndex: number;
  parentId?: string | null;
  turnId?: string;
  turnTerminal?: boolean;
}

const KIND_PRECEDENCE: Record<RoomActivityEventKind, number> = {
  join: 0,
  task: 1,
  tool: 2,
  reply: 3,
};

/**
 * Derives structured room events from transcript messages:
 * - join activity
 * - user tasks
 * - tool calls (especially scan/trust gate tools with status from okx-action-cards)
 * - agent replies completed/failed
 */
export function deriveRoomTimelineEvents(
  messages: readonly Message[],
  bots: readonly Bot[] = [],
): RoomActivityEvent[] {
  const rawEvents: EventWithSortMeta[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;

    // 1. Join activity
    if (
      msg.kind === "activity" &&
      (msg.tool?.system === true ||
        /joined\b/i.test(msg.tool?.name ?? "") ||
        /joined\b/i.test(msg.text ?? ""))
    ) {
      const toolName = msg.tool?.name ?? msg.text ?? "Joined room";
      const matchName = toolName.match(/^([A-Za-z0-9 _-]+) joined/);
      const actorName = msg.from?.name ?? (matchName ? matchName[1].trim() : "Agent");
      const bot = msg.from?.botId ? bots.find((b) => b.id === msg.from?.botId) : undefined;
      rawEvents.push({
        id: `join-${msg.id}`,
        messageId: msg.id,
        kind: "join",
        at: msg.at,
        actor: actorName,
        actorBot: bot,
        action: toolName,
        statusText: "Joined",
        statusTone: "neutral",
        technicalDetails: msg.tool ? JSON.stringify(msg.tool, null, 2) : undefined,
        hasEvidence: false,
        orderIndex: i,
        parentId: msg.parentId,
        turnId: msg.turnId,
        turnTerminal: msg.turnTerminal,
      });
      continue;
    }

    // 2. User task
    if (msg.role === "user" && msg.kind === "text") {
      const text = (msg.text ?? "").trim();
      const firstLine = text.split("\n")[0] || "Task";
      rawEvents.push({
        id: `task-${msg.id}`,
        messageId: msg.id,
        kind: "task",
        at: msg.at,
        actor: "You",
        action: firstLine,
        statusText: "Task",
        statusTone: "accent",
        technicalDetails: text.length > firstLine.length ? text : undefined,
        hasEvidence: false,
        orderIndex: i,
        parentId: msg.parentId,
        turnId: msg.turnId,
        turnTerminal: msg.turnTerminal,
      });
      continue;
    }

    // 3. Outcome Cards (Kind Meitner Coordinator)
    if (msg.outcome) {
      const outcome = msg.outcome;
      rawEvents.push({
        id: `outcome-${msg.id}`,
        messageId: msg.id,
        kind: "tool",
        at: msg.at,
        actor: outcome.serviceName || outcome.serviceId || "Kind Meitner",
        action: outcome.kind === "proposal"
          ? `Proposed ${outcome.toolName}`
          : outcome.kind === "clarification"
          ? `Requested location for ${outcome.serviceName}`
          : outcome.kind === "no_match"
          ? "Unmatched capability"
          : `${outcome.toolName} execution`,
        statusText: outcome.status === "completed" ? "Completed" : outcome.status === "failed" ? "Failed" : outcome.status === "cancelled" ? "Cancelled" : "Proposed",
        statusTone: outcome.status === "completed" ? "success" : outcome.status === "failed" ? "danger" : outcome.status === "cancelled" ? "neutral" : "accent",
        technicalDetails: JSON.stringify({
          service: outcome.serviceName,
          agentId: outcome.agentId,
          tool: outcome.toolName,
          endpointUrl: outcome.endpointUrl,
          price: outcome.price,
          inputs: outcome.inputs,
        }, null, 2),
        hasEvidence: true,
        orderIndex: i,
        parentId: msg.parentId,
        turnId: msg.turnId,
        turnTerminal: msg.turnTerminal,
      });
      continue;
    }

    // 4. Tool calls (with OKX action cards status or standard execution status)
    if (msg.tool) {
      const toolName = msg.tool.name;
      const bot = msg.from?.botId ? bots.find((b) => b.id === msg.from?.botId) : undefined;
      const parsedActor = msg.tool.summary?.includes(" · ") ? msg.tool.summary.split(" · ")[0] : undefined;
      const actorName = parsedActor ?? msg.from?.name ?? bot?.name ?? "Agent";
      if (isOkxGateTool(toolName)) {
        const card = parseOkxActionCard(msg.tool);
        let statusText = "Running";
        let statusTone: TagTone = "accent";
        let action = msg.tool.summary ?? toolName;

        if (card) {
          if (card.kind === "readiness") {
            statusText = card.verdict;
            statusTone = card.verdict === "PASS" ? "success" : card.verdict === "WARN" ? "warning" : "danger";
            action = `Scan Free MCP readiness: ${card.endpointUrl}`;
          } else {
            statusText = card.listingStatus === "found" ? "Found" : card.listingStatus === "not_found" ? "Not found" : card.decision ?? "Checked";
            statusTone = card.listingStatus === "found" || card.decision === "GO" ? "success" : card.listingStatus === "not_found" || card.decision === "NO_GO" ? "danger" : "warning";
            action = `Listing & connection check: Agent ${card.agentId}`;
          }
        } else if (msg.tool.ok === true) {
          statusText = "Completed";
          statusTone = "success";
        } else if (msg.tool.ok === false) {
          statusText = "Failed";
          statusTone = "danger";
        }

        rawEvents.push({
          id: `tool-${msg.id}`,
          messageId: msg.id,
          kind: "tool",
          at: msg.at,
          actor: actorName,
          actorBot: bot,
          action,
          statusText,
          statusTone,
          technicalDetails: msg.tool.output ?? JSON.stringify(msg.tool, null, 2),
          hasEvidence: true,
          orderIndex: i,
          parentId: msg.parentId,
          turnId: msg.turnId,
          turnTerminal: msg.turnTerminal,
        });
      } else {
        const isRunning = msg.tool.ok === undefined;
        const isFailed = msg.tool.ok === false;
        const hasEvidence = Boolean(msg.tool.output || msg.tool.input);
        rawEvents.push({
          id: `tool-${msg.id}`,
          messageId: msg.id,
          kind: "tool",
          at: msg.at,
          actor: actorName,
          actorBot: bot,
          action: msg.tool.summary ?? toolName,
          statusText: isRunning ? "Running" : isFailed ? "Failed" : "Done",
          statusTone: isRunning ? "accent" : isFailed ? "danger" : "neutral",
          technicalDetails: msg.tool.output ?? JSON.stringify(msg.tool, null, 2),
          hasEvidence,
          orderIndex: i,
          parentId: msg.parentId,
          turnId: msg.turnId,
          turnTerminal: msg.turnTerminal,
        });
      }
      continue;
    }

    // 4. Agent replies completed / failed
    if (msg.role === "bot" && msg.kind === "text") {
      const bot = msg.from?.botId ? bots.find((b) => b.id === msg.from?.botId) : undefined;
      const actorName = msg.from?.name ?? bot?.name ?? "Agent";
      const errorDetail = "error" in msg && typeof msg.error === "string" ? msg.error : undefined;
      const isFailed = Boolean(errorDetail);
      const text = (msg.text ?? "").trim();
      const firstLine = text.split("\n")[0] || "Reply";
      rawEvents.push({
        id: `reply-${msg.id}`,
        messageId: msg.id,
        kind: "reply",
        at: msg.at,
        actor: actorName,
        actorBot: bot,
        action: firstLine.slice(0, 120),
        statusText: isFailed ? "Failed" : "Completed",
        statusTone: isFailed ? "danger" : "success",
        technicalDetails: errorDetail ?? (text.length > 120 ? text : undefined),
        hasEvidence: Boolean((msg.attachments && msg.attachments.length > 0) || msg.routineRun || msg.goalRun),
        orderIndex: i,
        parentId: msg.parentId,
        turnId: msg.turnId,
        turnTerminal: msg.turnTerminal,
      });
      continue;
    }
  }

  rawEvents.sort((a, b) => {
    // 1. Explicit message parent/child ancestry
    if (b.parentId === a.messageId) return -1;
    if (a.parentId === b.messageId) return 1;

    // 2. Authoritative timestamp ordering
    if (a.at !== b.at) {
      return a.at - b.at;
    }

    // 3. Same turn: non-terminal before terminal
    if (a.turnId && b.turnId && a.turnId === b.turnId) {
      if (a.turnTerminal !== b.turnTerminal) {
        return a.turnTerminal ? 1 : -1;
      }
    }

    // 4. Kind precedence (join -> task -> tool -> reply)
    const kindDiff = KIND_PRECEDENCE[a.kind] - KIND_PRECEDENCE[b.kind];
    if (kindDiff !== 0) return kindDiff;

    // 5. Stable tie-break by original transcript array index
    const indexDiff = a.orderIndex - b.orderIndex;
    if (indexDiff !== 0) return indexDiff;

    // 6. Deterministic tie-break by event id
    return a.id.localeCompare(b.id);
  });

  return rawEvents.map(({ orderIndex: _o, parentId: _p, turnId: _t, turnTerminal: _tt, ...event }) => event);
}

export function RoomActivityTimeline({
  group,
  messages,
  bots = [],
  onClose,
  className,
}: {
  group: Group;
  messages: readonly Message[];
  bots?: readonly Bot[];
  onClose?: () => void;
  className?: string;
}) {
  const { dispatch } = useStore();
  const events = useMemo(() => deriveRoomTimelineEvents(messages, bots), [messages, bots]);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleJump = (messageId: string) => {
    dispatch({ type: "focusMessage", threadId: group.threadId, messageId });
  };

  return (
    <>
      {onClose && (
        <div
          aria-hidden
          onClick={onClose}
          className="room-activity-backdrop fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px]"
        />
      )}
      <aside
        aria-label="Room Activity Timeline"
        className={cn(
          "room-activity-timeline-drawer flex w-80 shrink-0 flex-col border-l border-hairline bg-panel transition-all",
          className,
        )}
      >
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-hairline px-3.5">
          <div className="label-mono flex items-center gap-1.5 text-ink">
            <span>[ ACTIVITY ]</span>
            <span className="text-ink-secondary tabular-nums">({events.length})</span>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="xs"
              icon
              onClick={onClose}
              aria-label="Close activity timeline"
              title="Close timeline"
            >
              <X size={14} />
            </Button>
          )}
        </div>

        <div
          className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3"
          role="region"
          aria-live="polite"
          aria-label="Timeline events"
        >
          {events.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-4 text-center font-mono text-[12px] text-ink-secondary">
              No activity recorded yet.
            </div>
          ) : (
            <ol className="space-y-3">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="border border-hairline bg-card p-2.5 font-mono transition-colors hover:border-ink-secondary/60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      {event.actorBot ? (
                        <AgentMark bot={event.actorBot} size={18} />
                      ) : (
                        <span className="flex size-4 items-center justify-center border border-hairline bg-inset text-[10px] font-bold text-ink">
                          {event.actor[0] ?? "U"}
                        </span>
                      )}
                      <span className="truncate text-[11.5px] font-semibold text-ink">
                        {event.actor}
                      </span>
                    </div>
                    <Tag tone={event.statusTone} variant="soft" size="sm">
                      {event.statusText}
                    </Tag>
                  </div>

                  <div className="mt-1.5 text-[11px] leading-relaxed text-ink-secondary">
                    <p className="line-clamp-2 break-words">{event.action}</p>
                  </div>

                  <div className="mt-2 flex items-center justify-between border-t border-hairline/60 pt-1.5 text-[10px] text-ink-secondary">
                    <time dateTime={new Date(event.at).toISOString()} className="tabular-nums">
                      {formatTime(event.at)}
                    </time>
                    {event.hasEvidence && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleJump(event.messageId)}
                        className="h-5 px-1 text-[10.5px]"
                      >
                        View evidence
                      </Button>
                    )}
                  </div>

                  {event.technicalDetails && (
                    <details className="mt-1 border-t border-hairline/40 pt-1">
                      <summary className="cursor-pointer text-[10px] text-ink-secondary hover:text-ink">
                        Show technical details
                      </summary>
                      <pre className="mt-1 max-h-36 overflow-x-auto overflow-y-auto border border-hairline bg-inset p-1.5 text-[10px] leading-normal text-ink-secondary whitespace-pre-wrap break-all">
                        {event.technicalDetails}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>
    </>
  );
}
