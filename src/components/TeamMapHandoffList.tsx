import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ArrowRight,
  FileText,
  MessageSquare,
  Scale,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { OwnershipTransfer, WorkflowTask } from "@/lib/team-map-workflow";
import type { TeamMapEdge } from "@/lib/team-map";
import type { Bot } from "@/state/store";

export interface UnifiedHandoffItem {
  id: string;
  kind: "transfer" | "connection";
  taskId?: string;
  taskTitle: string;
  fromBotId: string;
  fromName: string;
  toBotId: string;
  toName: string;
  statusText: string;
  progress?: number;
  timeStr: string;
  reason?: string;
  messagesTransferred?: number;
  artifactsTransferred?: number;
  decisionsTransferred?: number;
}

export function deduplicateHandoffs(
  transfers: OwnershipTransfer[],
  edges: TeamMapEdge[],
  bots: Bot[],
  tasks: WorkflowTask[] = [],
): UnifiedHandoffItem[] {
  const result: UnifiedHandoffItem[] = [];
  const taskMap = new Map<string, WorkflowTask>(tasks.map((t) => [t.id, t]));
  const activeTransferPairs = new Set<string>();

  // 1. Prioritize rich ownership transfers
  for (const xfer of transfers) {
    // Stable directed key: source -> destination
    const directedKey = `${xfer.fromAgentId}->${xfer.toAgentId}`;
    activeTransferPairs.add(directedKey);

    const fromBot = bots.find((b) => b.id === xfer.fromAgentId);
    const toBot = bots.find((b) => b.id === xfer.toAgentId);
    const task = taskMap.get(xfer.taskId);

    const timeDate = new Date(xfer.at);
    const timeStr = !isNaN(timeDate.getTime())
      ? timeDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : "Recent";

    const progressPart = xfer.progressAtTransfer !== undefined ? ` · ${xfer.progressAtTransfer}%` : "";
    const statusText = `Resumed${progressPart}`;

    result.push({
      id: xfer.id,
      kind: "transfer",
      taskId: xfer.taskId,
      taskTitle: task?.title || "Task transferred",
      fromBotId: xfer.fromAgentId,
      fromName: fromBot?.name ?? xfer.fromAgentId,
      toBotId: xfer.toAgentId,
      toName: toBot?.name ?? xfer.toAgentId,
      statusText,
      progress: xfer.progressAtTransfer,
      timeStr,
      reason: xfer.reason || undefined,
      messagesTransferred: xfer.messagesTransferred,
      artifactsTransferred: xfer.artifactsTransferred,
      decisionsTransferred: xfer.decisionsTransferred,
    });
  }

  // 2. Append genuine persistent edges only if not already represented by a directed transfer
  for (const edge of edges) {
    const directedKey = `${edge.sourceBotId}->${edge.targetBotId}`;
    if (activeTransferPairs.has(directedKey)) {
      // Deduplicate: exact directed pair already has an active detailed ownership transfer row
      continue;
    }

    const fromBot = bots.find((b) => b.id === edge.sourceBotId);
    const toBot = bots.find((b) => b.id === edge.targetBotId);
    if (!fromBot || !toBot) continue;

    result.push({
      id: `edge:${directedKey}`,
      kind: "connection",
      taskTitle: "Direct agent channel",
      fromBotId: edge.sourceBotId,
      fromName: fromBot.name,
      toBotId: edge.targetBotId,
      toName: toBot.name,
      statusText: edge.state === "running" ? "Running" : edge.state === "queued" ? "Queued" : "Connected",
      timeStr: edge.lastAt ? new Date(edge.lastAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Active",
      reason: edge.reason ?? "Direct peer-to-peer collaboration channel.",
    });
  }
  return result;
}

export function TeamMapHandoffList({
  items,
  selectedTaskId,
  onSelectHandoff,
  defaultOpen = false,
  className,
}: {
  items: UnifiedHandoffItem[];
  selectedTaskId?: string | null;
  onSelectHandoff: (item: UnifiedHandoffItem) => void;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(items[0]?.id ?? null);
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (items.length === 0) {
    return (
      <div className={cn("p-4 text-[13px] text-ink-secondary", className)}>
        No active agent handoffs or transfers recorded.
      </div>
    );
  }

  return (
    <section aria-label="Agent handoffs" className={cn("border border-hairline bg-card", className)} data-slot="team-map-handoff-list">
      {/* Section Header */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-controls="handoff-list-content"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
        className="flex h-11 w-full cursor-pointer items-center justify-between px-4 text-left outline-none transition-colors hover:bg-raised-hover"
      >
        <div className="flex items-center gap-2">
          <span className="text-ink-secondary transition-transform duration-150">
            {isOpen ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
          </span>
          <h3 className="label-mono text-[12px] font-semibold text-ink">Agent handoffs</h3>
          <span
            className="flex h-4 min-w-4 items-center justify-center border border-hairline bg-inset px-1 font-mono text-[10.5px] font-medium text-ink-secondary"
            aria-label={`${items.length} handoffs`}
          >
            {items.length}
          </span>
        </div>

        <span className="label-mono text-[10.5px] text-ink-secondary">
          {items.some((i) => i.kind === "transfer") ? "Context-preserved transfers" : "Active channels"}
        </span>
      </div>

      {/* Structured List Rows */}
      {isOpen && (
        <div id="handoff-list-content" className="max-h-[50vh] overflow-y-auto divide-y divide-hairline frame-rule-above">
          {items.map((item) => {
            const isSelected = selectedTaskId === item.taskId;
            const isExpanded = expandedId === item.id;

            return (
              <div
                key={item.id}
                className={cn(
                  "transition-colors",
                  isSelected
                    ? "bg-raised border-l-2 border-accent"
                    : "hover:bg-raised-hover border-l-2 border-transparent",
                )}
              >
                {/* Main Row: accessible select button and expand button */}
                <div className="flex min-h-[56px] items-center justify-between px-4 py-2.5 gap-3">
                  <button
                    type="button"
                    onClick={() => onSelectHandoff(item)}
                    className="flex min-w-0 flex-1 flex-col text-left outline-none sm:flex-row sm:items-center sm:justify-between"
                  >
                    {/* Left Column: Task & Transfer path */}
                    <div className="min-w-0 flex-1 pr-4">
                      <h4 className="truncate text-[13px] font-semibold text-ink">
                        {item.taskTitle}
                      </h4>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-secondary">
                        <span className="font-medium text-ink">{item.fromName}</span>
                        <ArrowRight size={11} className="shrink-0 text-ink-secondary/60" aria-hidden="true" />
                        <span className="font-medium text-ink">{item.toName}</span>
                        <span className="text-ink-secondary/40">·</span>
                        <span className="text-[11.5px] text-ink-secondary">{item.statusText}</span>
                      </div>
                    </div>

                    {/* Right Column: Metadata */}
                    <div className="mt-1 flex shrink-0 items-center gap-2.5 sm:mt-0">
                      <span className="border border-hairline bg-raised px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink">
                        {item.kind === "transfer" ? "Ownership transfer" : "Peer channel"}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-ink-secondary">
                        {item.timeStr}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    aria-label={isExpanded ? "Collapse handoff details" : "Expand handoff details"}
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="shrink-0 p-1 text-ink-secondary hover:text-ink outline-none"
                  >
                    {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </button>
                </div>

                {/* Expanded Details without nested bordered card */}
                {isExpanded && (
                  <div className="space-y-2.5 bg-inset/50 px-4 pb-3.5 pt-1 text-[12.5px] leading-relaxed">
                    {/* Reason */}
                    {item.reason && (
                      <div className="max-w-2xl">
                        <span className="label-mono text-[10.5px] text-ink-secondary block">
                          Reason
                        </span>
                        <p className="mt-0.5 text-[12.5px] text-ink">
                          {item.reason}
                        </p>
                      </div>
                    )}

                    {/* Context Transferred Inline Metadata */}
                    {item.kind === "transfer" && (item.messagesTransferred !== undefined || item.artifactsTransferred !== undefined || item.decisionsTransferred !== undefined) && (
                      <div className="flex flex-wrap items-center gap-2.5 frame-rule-above pt-2 text-[11.5px] text-ink-secondary">
                        <span>Context transferred:</span>
                        {item.messagesTransferred !== undefined && (
                          <span className="inline-flex items-center gap-1 font-medium text-ink">
                            <MessageSquare size={12} className="text-ink" aria-hidden="true" />
                            <span>{item.messagesTransferred} messages</span>
                          </span>
                        )}
                        {item.artifactsTransferred !== undefined && (
                          <>
                            <span className="text-ink-secondary/40">·</span>
                            <span className="inline-flex items-center gap-1 font-medium text-ink">
                              <FileText size={12} className="text-ink" aria-hidden="true" />
                              <span>{item.artifactsTransferred} artifacts</span>
                            </span>
                          </>
                        )}
                        {item.decisionsTransferred !== undefined && (
                          <>
                            <span className="text-ink-secondary/40">·</span>
                            <span className="inline-flex items-center gap-1 font-medium text-ink">
                              <Scale size={12} className="text-ink" aria-hidden="true" />
                              <span>{item.decisionsTransferred} decision</span>
                            </span>
                          </>
                        )}
                      </div>
                    )}
                    {/* Progress Line */}
                    {item.progress !== undefined && item.progress > 0 && (
                      <div className="flex items-center gap-2.5 pt-1">
                        <div className="h-1.5 flex-1 overflow-hidden border border-hairline bg-inset">
                          <div
                            className="h-full bg-accent transition-all duration-300"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10.5px] tabular-nums text-ink-secondary">
                          {item.progress}% preserved
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
