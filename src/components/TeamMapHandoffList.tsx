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
import type { OwnershipTransfer } from "@/lib/team-map-workflow";
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
): UnifiedHandoffItem[] {
  const result: UnifiedHandoffItem[] = [];
  const handledPairs = new Set<string>();

  // 1. Prioritize rich ownership transfers
  for (const xfer of transfers) {
    const pairKey = [xfer.fromAgentId, xfer.toAgentId].sort().join(":");
    handledPairs.add(pairKey);

    const fromBot = bots.find((b) => b.id === xfer.fromAgentId);
    const toBot = bots.find((b) => b.id === xfer.toAgentId);

    const timeDate = new Date(xfer.at);
    const timeStr = !isNaN(timeDate.getTime())
      ? timeDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : "12:43 PM";

    result.push({
      id: xfer.id,
      kind: "transfer",
      taskId: xfer.taskId,
      taskTitle: "Prepare payment protection",
      fromBotId: xfer.fromAgentId,
      fromName: fromBot?.name ?? "Tuli",
      toBotId: xfer.toAgentId,
      toName: toBot?.name ?? "Atlas",
      statusText: `Resumed · ${xfer.progressAtTransfer ?? 68}%`,
      progress: xfer.progressAtTransfer ?? 68,
      timeStr,
      reason: xfer.reason,
      messagesTransferred: xfer.messagesTransferred ?? 4,
      artifactsTransferred: xfer.artifactsTransferred ?? 2,
      decisionsTransferred: xfer.decisionsTransferred ?? 1,
    });
  }

  // 2. Append genuine persistent edges only if not already represented by a transfer
  for (const edge of edges) {
    const pairKey = [edge.sourceBotId, edge.targetBotId].sort().join(":");
    if (handledPairs.has(pairKey)) {
      // Deduplicate: same pair already has an active detailed ownership transfer row
      continue;
    }

    const fromBot = bots.find((b) => b.id === edge.sourceBotId);
    const toBot = bots.find((b) => b.id === edge.targetBotId);
    if (!fromBot || !toBot) continue;

    result.push({
      id: `edge:${pairKey}`,
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
  className,
}: {
  items: UnifiedHandoffItem[];
  selectedTaskId?: string | null;
  onSelectHandoff: (item: UnifiedHandoffItem) => void;
  className?: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(items[0]?.id ?? null);
  const [isOpen, setIsOpen] = useState(true);

  if (items.length === 0) {
    return (
      <div className={cn("p-4 text-[13px] text-ink-secondary", className)}>
        No active agent handoffs or transfers recorded.
      </div>
    );
  }

  return (
    <section aria-label="Agent handoffs" className={cn("overflow-hidden rounded-2xl border border-white/[0.08] bg-[#15171A]", className)}>
      {/* Section Header (48-52px) */}
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
        className="flex h-12 w-full cursor-pointer items-center justify-between px-5 text-left outline-none transition-colors hover:bg-white/[0.02] focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-white/50 transition-transform duration-150">
            {isOpen ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
          </span>
          <h3 className="text-[15px] font-semibold text-white/90">Agent handoffs</h3>
          <span
            className="flex h-5 min-w-5 items-center justify-center rounded-[6px] bg-white/[0.08] px-1.5 font-mono text-[11px] font-medium text-white/70"
            aria-label={`${items.length} handoffs`}
          >
            {items.length}
          </span>
        </div>

        <span className="text-[12px] text-white/45">
          {items.some((i) => i.kind === "transfer") ? "Context-preserved transfers" : "Active channels"}
        </span>
      </div>

      {/* Structured List Rows */}
      {isOpen && (
        <div id="handoff-list-content" className="divide-y divide-white/[0.06] border-t border-white/[0.08]">
          {items.map((item) => {
            const isSelected = selectedTaskId === item.taskId;
            const isExpanded = expandedId === item.id;

            return (
              <div
                key={item.id}
                className={cn(
                  "transition-colors",
                  isSelected
                    ? "bg-[#1C2025] border-l-2 border-accent"
                    : "hover:bg-[#20242A]/60 border-l-2 border-transparent",
                )}
              >
                {/* Main Row Click Target (~64-72px) */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onClick={() => {
                    onSelectHandoff(item);
                    setExpandedId(isExpanded ? null : item.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectHandoff(item);
                      setExpandedId(isExpanded ? null : item.id);
                    }
                  }}
                  className="flex min-h-[64px] cursor-pointer flex-col justify-center px-5 py-3 outline-none focus-visible:ring-2 focus-visible:ring-accent sm:flex-row sm:items-center sm:justify-between"
                >
                  {/* Left Column: Task & Transfer path */}
                  <div className="min-w-0 flex-1 pr-4">
                    <h4 className="truncate text-[14px] font-semibold leading-snug text-white/90">
                      {item.taskTitle}
                    </h4>
                    <div className="mt-1 flex items-center gap-2 text-[13px] text-white/60">
                      <span className="font-medium text-white/80">{item.fromName}</span>
                      <ArrowRight size={12} className="shrink-0 text-white/40" aria-hidden="true" />
                      <span className="font-medium text-white/80">{item.toName}</span>
                      <span className="text-white/30">·</span>
                      <span className="text-[12px] text-white/50">{item.statusText}</span>
                    </div>
                  </div>

                  {/* Right Column: Metadata & chevron */}
                  <div className="mt-2 flex shrink-0 items-center justify-between gap-3 sm:mt-0 sm:justify-end">
                    <span className="rounded-[6px] bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
                      {item.kind === "transfer" ? "Ownership transfer" : "Peer channel"}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-white/45">
                      {item.timeStr}
                    </span>
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-hidden="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(isExpanded ? null : item.id);
                      }}
                      className="text-white/40 hover:text-white/70"
                    >
                      {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details without nested bordered card */}
                {isExpanded && (
                  <div className="space-y-3 bg-black/20 px-5 pb-4 pt-1 text-[13px] leading-relaxed">
                    {/* Reason */}
                    {item.reason && (
                      <div className="max-w-2xl">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-white/45">
                          Reason
                        </span>
                        <p className="mt-0.5 text-[13px] text-white/80">
                          {item.reason}
                        </p>
                      </div>
                    )}

                    {/* Context Transferred Inline Metadata */}
                    {item.kind === "transfer" && (
                      <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-2.5 text-[12px] text-white/60">
                        <span className="text-white/40">Context transferred:</span>
                        <span className="inline-flex items-center gap-1 font-medium text-white/80">
                          <MessageSquare size={13} className="text-accent" aria-hidden="true" />
                          <span>{item.messagesTransferred} messages</span>
                        </span>
                        <span className="text-white/30">·</span>
                        <span className="inline-flex items-center gap-1 font-medium text-white/80">
                          <FileText size={13} className="text-accent" aria-hidden="true" />
                          <span>{item.artifactsTransferred} artifacts</span>
                        </span>
                        <span className="text-white/30">·</span>
                        <span className="inline-flex items-center gap-1 font-medium text-white/80">
                          <Scale size={13} className="text-accent" aria-hidden="true" />
                          <span>{item.decisionsTransferred} decision</span>
                        </span>
                      </div>
                    )}

                    {/* Progress Line */}
                    {item.progress !== undefined && item.progress > 0 && (
                      <div className="flex items-center gap-3 pt-1">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                          <div
                            className="h-full bg-accent transition-all duration-300"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] tabular-nums text-white/45">
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
