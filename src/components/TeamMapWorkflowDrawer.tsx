import { X, ListTodo, ArrowLeftRight, MessageSquare } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  getOwnershipTransfers,
  type WorkflowAgent,
  type WorkflowSnapshot,
  type WorkflowTask,
} from "@/lib/team-map-workflow";
import { buildActivityItems } from "@/lib/team-map-demo-ui";
import { TeamMapAgentAvatar } from "./TeamMapAgentAvatar";

function presenceTone(presence: WorkflowAgent["presence"]): string {
  switch (presence) {
    case "working":
      return "bg-success/15 text-success";
    case "blocked":
      return "bg-danger/15 text-danger";
    case "waiting":
      return "bg-warning/15 text-warning";
    case "reviewing":
      return "bg-accent/15 text-accent";
    case "completed":
      return "bg-success/10 text-success";
    case "offline":
      return "bg-control text-ink-secondary";
    default:
      return "bg-inset text-ink-secondary";
  }
}

function stateTone(state: WorkflowTask["state"]): string {
  switch (state) {
    case "active":
      return "bg-success/15 text-success";
    case "blocked":
      return "bg-danger/15 text-danger";
    case "waiting":
    case "queued":
      return "bg-warning/15 text-warning";
    case "reviewing":
      return "bg-accent/15 text-accent";
    case "completed":
      return "bg-success/10 text-success";
    case "failed":
      return "bg-danger/15 text-danger";
    default:
      return "bg-inset text-ink-secondary";
  }
}

export function TeamMapWorkflowDrawer({
  snapshot,
  agentId,
  taskId,
  onClose,
  onSelectAgent,
  onSelectTask,
}: {
  snapshot: WorkflowSnapshot;
  agentId?: string | null;
  taskId?: string | null;
  onClose: () => void;
  onSelectAgent?: (id: string) => void;
  onSelectTask?: (id: string) => void;
}) {
  const agent = agentId ? snapshot.agents.find((a) => a.id === agentId) : undefined;
  const task = taskId ? snapshot.tasks.find((t) => t.id === taskId) : undefined;
  if (!agent && !task) return null;

  const transfers = getOwnershipTransfers(snapshot).filter((x) => {
    if (agent) return x.fromAgentId === agent.id || x.toAgentId === agent.id;
    if (task) return x.taskId === task.id;
    return false;
  });

  const recent = buildActivityItems(snapshot)
    .filter((item) => {
      if (agent) return item.agentId === agent.id || (agent.currentTaskId && item.taskId === agent.currentTaskId);
      if (task) return item.taskId === task.id || item.agentId === task.ownerAgentId;
      return false;
    })
    .slice(-12)
    .reverse();

  const currentTask = agent?.currentTaskId
    ? snapshot.tasks.find((t) => t.id === agent.currentTaskId)
    : undefined;
  const owner = task ? snapshot.agents.find((a) => a.id === task.ownerAgentId) : undefined;

  return (
    <aside
      aria-label="Workflow detail"
      className="flex h-full w-full max-w-[360px] flex-col border-l border-hairline/40 bg-panel shadow-xl"
    >
      <header className="flex items-start justify-between gap-3 border-b border-hairline/40 px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          {agent ? (
            <TeamMapAgentAvatar
              agentId={agent.id}
              name={agent.name}
              presence={agent.presence}
              size={56}
              interactive
            />
          ) : owner ? (
            <TeamMapAgentAvatar
              agentId={owner.id}
              name={owner.name}
              presence={owner.presence}
              size={56}
              interactive
            />
          ) : (
            <ListTodo size={15} className="mt-1 text-accent" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {!agent && !owner && <ListTodo size={15} className="text-accent" />}
              <h2 className="truncate text-[14px] font-semibold text-ink">
                {agent?.name ?? task?.title}
              </h2>
            </div>
            <p className="mt-1 text-[11.5px] text-ink-secondary">
              {agent ? agent.role : task ? `Owner: ${owner?.name ?? task.ownerAgentId}` : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close detail"
          onClick={onClose}
          className="rounded-md p-1 text-ink-secondary hover:bg-raised hover:text-ink"
        >
          <X size={16} />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {agent && (
          <div className="space-y-2">
            <p className="text-[10.5px] uppercase tracking-wide text-ink-secondary">Presence</p>
            <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", presenceTone(agent.presence))}>
              {agent.presence}
            </span>
            {currentTask && (
              <button
                type="button"
                onClick={() => onSelectTask?.(currentTask.id)}
                className="mt-2 block w-full rounded-lg border border-hairline/40 bg-card px-3 py-2 text-left hover:bg-raised/50"
              >
                <p className="text-[10.5px] text-ink-secondary">Current task</p>
                <p className="text-[12.5px] font-medium text-ink">{currentTask.title}</p>
                <p className="mt-0.5 text-[11px] capitalize text-ink-secondary">{currentTask.state} · {currentTask.progress}%</p>
              </button>
            )}
          </div>
        )}

        {task && (
          <div className="space-y-2">
            <p className="text-[10.5px] uppercase tracking-wide text-ink-secondary">Task state</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", stateTone(task.state))}>
                {task.state}
              </span>
              <span className="text-[11px] tabular-nums text-ink-secondary">{task.progress}%</span>
              {task.branchId && (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10.5px] text-accent">{task.branchId}</span>
              )}
            </div>
            {owner && (
              <button
                type="button"
                onClick={() => onSelectAgent?.(owner.id)}
                className="block text-[12px] text-accent hover:underline"
              >
                Owner: {owner.name}
              </button>
            )}
            {task.dependsOnTaskIds.length > 0 && (
              <div>
                <p className="text-[10.5px] text-ink-secondary">Depends on</p>
                <ul className="mt-1 space-y-1">
                  {task.dependsOnTaskIds.map((id) => {
                    const dep = snapshot.tasks.find((t) => t.id === id);
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => onSelectTask?.(id)}
                          className="text-[12px] text-accent hover:underline"
                        >
                          {dep?.title ?? id}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-ink-secondary">
            <ArrowLeftRight size={12} /> Ownership transfers
          </div>
          {transfers.length === 0 ? (
            <p className="text-[12px] text-ink-secondary">None involving this selection.</p>
          ) : (
            <ul className="space-y-1.5">
              {transfers.map((x) => (
                <li key={x.id} className="rounded-lg border border-hairline/40 bg-card px-2.5 py-2 text-[12px] text-ink">
                  <p className="font-medium">
                    {snapshot.agents.find((a) => a.id === x.fromAgentId)?.name ?? x.fromAgentId}
                    {" → "}
                    {snapshot.agents.find((a) => a.id === x.toAgentId)?.name ?? x.toAgentId}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-secondary">{x.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-ink-secondary">
            <MessageSquare size={12} /> Recent activity
          </div>
          {recent.length === 0 ? (
            <p className="text-[12px] text-ink-secondary">No recent messages or events.</p>
          ) : (
            <ul className="space-y-1">
              {recent.map((item) => (
                <li key={item.id} className="rounded-lg border border-hairline/30 bg-inset/60 px-2.5 py-1.5 text-[11.5px] text-ink">
                  <span className="capitalize text-ink-secondary">{item.label} · </span>
                  {item.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
