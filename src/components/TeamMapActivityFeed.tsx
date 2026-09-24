import { useMemo } from "react";
import { Activity, Filter } from "lucide-react";
import { cn } from "@/lib/cn";
import type { WorkflowSnapshot } from "@/lib/team-map-workflow";
import { buildActivityItems, type ActivityItem, type ActivityKind } from "@/lib/team-map-demo-ui";
import { TeamMapAgentAvatar } from "./TeamMapAgentAvatar";

const KIND_OPTIONS: Array<ActivityKind | "all"> = [
  "all",
  "message",
  "transfer",
  "task",
  "review",
  "help",
  "branch",
  "system",
];

function kindTone(kind: ActivityKind): string {
  switch (kind) {
    case "transfer":
      return "bg-warning/15 text-warning";
    case "help":
      return "bg-accent/15 text-accent";
    case "review":
      return "bg-success/15 text-success";
    case "task":
      return "bg-control text-ink-secondary";
    case "branch":
      return "bg-accent/10 text-accent";
    case "system":
      return "bg-inset text-ink-secondary";
    default:
      return "bg-inset text-ink-secondary";
  }
}

function formatAt(at: number, baseAt: number): string {
  if (!at) return "—";
  const delta = Math.max(0, at - baseAt);
  const sec = Math.round(delta / 1000);
  return `t+${sec}s`;
}

export function TeamMapActivityFeed({
  snapshot,
  agentFilter,
  taskFilter,
  kindFilter,
  onAgentFilter,
  onTaskFilter,
  onKindFilter,
  onSelectAgent,
  onSelectTask,
  highlightAgentId,
  highlightTaskId,
  className,
}: {
  snapshot: WorkflowSnapshot;
  agentFilter?: string | null;
  taskFilter?: string | null;
  kindFilter?: ActivityKind | "all" | null;
  onAgentFilter?: (agentId: string | null) => void;
  onTaskFilter?: (taskId: string | null) => void;
  onKindFilter?: (kind: ActivityKind | "all") => void;
  onSelectAgent?: (agentId: string) => void;
  onSelectTask?: (taskId: string) => void;
  highlightAgentId?: string | null;
  highlightTaskId?: string | null;
  className?: string;
}) {
  const items = useMemo(() => buildActivityItems(snapshot), [snapshot]);
  const baseAt = snapshot.startedAt > 0 ? snapshot.startedAt : items[0]?.at ?? 0;
  const kind = kindFilter ?? "all";

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (agentFilter && item.agentId !== agentFilter) return false;
      if (taskFilter && item.taskId !== taskFilter) return false;
      if (kind !== "all" && item.kind !== kind) return false;
      return true;
    });
  }, [items, agentFilter, taskFilter, kind]);

  const agents = snapshot.agents;
  const tasks = snapshot.tasks;

  return (
    <section aria-label="Activity feed" className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline/40 px-1 pb-2">
        <Activity size={14} className="text-ink-secondary" />
        <h3 className="text-[12px] font-semibold text-ink">Activity</h3>
        <span className="text-[10.5px] text-ink-secondary">{filtered.length}/{items.length}</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Filter size={12} className="text-ink-secondary" />
          <select
            aria-label="Filter by kind"
            value={kind}
            onChange={(e) => onKindFilter?.(e.target.value as ActivityKind | "all")}
            className="rounded-md border border-hairline/50 bg-inset px-2 py-1 text-[11px] text-ink"
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>{k === "all" ? "All kinds" : k}</option>
            ))}
          </select>
          <select
            aria-label="Filter by agent"
            value={agentFilter ?? ""}
            onChange={(e) => onAgentFilter?.(e.target.value || null)}
            className="max-w-[140px] rounded-md border border-hairline/50 bg-inset px-2 py-1 text-[11px] text-ink"
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select
            aria-label="Filter by task"
            value={taskFilter ?? ""}
            onChange={(e) => onTaskFilter?.(e.target.value || null)}
            className="max-w-[160px] rounded-md border border-hairline/50 bg-inset px-2 py-1 text-[11px] text-ink"
          >
            <option value="">All tasks</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto py-2">
        {filtered.length === 0 && (
          <li className="px-1 py-4 text-center text-[12px] text-ink-secondary">No activity for this filter yet.</li>
        )}
        {filtered.map((item: ActivityItem) => {
          const hot =
            (highlightAgentId && item.agentId === highlightAgentId) ||
            (highlightTaskId && item.taskId === highlightTaskId);
          const feedAgent = item.agentId
            ? agents.find((a) => a.id === item.agentId)
            : undefined;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  if (item.agentId) onSelectAgent?.(item.agentId);
                  if (item.taskId) onSelectTask?.(item.taskId);
                }}
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition",
                  hot
                    ? "border-accent/50 bg-accent/10"
                    : "border-transparent hover:border-hairline/40 hover:bg-raised/40",
                )}
              >
                {feedAgent && (
                  <TeamMapAgentAvatar
                    agentId={feedAgent.id}
                    name={feedAgent.name}
                    presence={feedAgent.presence}
                    size={24}
                    interactive={false}
                  />
                )}
                <span className="mt-0.5 w-10 shrink-0 text-[10.5px] tabular-nums text-ink-secondary">
                  {formatAt(item.at, baseAt)}
                </span>
                <span className={cn("mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize", kindTone(item.kind))}>
                  {item.label}
                </span>
                <span className="min-w-0 flex-1 text-[12px] leading-snug text-ink">{item.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
