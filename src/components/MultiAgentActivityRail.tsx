import { ChevronRight, Activity } from "lucide-react";
import { useMemo, useState } from "react";
import { type Bot, type Message } from "@/state/store";
import { BotAvatar } from "./Avatar";
import { cn } from "@/lib/cn";
import { normalizeState } from "@/lib/mascot";

export interface ActivityRailItem {
  id: string;
  agentName: string;
  bot?: Bot;
  detail: string;
  status: "running" | "done" | "failed";
  timestamp: number;
}

/** React Bits Pro (ai-chat-6) inspired Live Multi-Agent Activity Rail. */
export function MultiAgentActivityRail({
  messages,
  bots,
  activeBot,
}: {
  messages: readonly Message[];
  bots: readonly Bot[];
  activeBot?: Bot;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const activities = useMemo<ActivityRailItem[]>(() => {
    const items: ActivityRailItem[] = [];
    for (const msg of messages) {
      if (msg.tool) {
        const bot = msg.from ? bots.find((b) => b.id === msg.from?.botId) : activeBot;
        items.push({
          id: msg.id,
          agentName: msg.from?.name ?? bot?.name ?? "Agent",
          bot,
          detail: msg.tool.summary ?? msg.tool.name,
          status: msg.tool.ok === undefined ? "running" : msg.tool.ok ? "done" : "failed",
          timestamp: msg.at,
        });
      } else if (msg.role === "bot" && msg.text && msg.from) {
        const bot = bots.find((b) => b.id === msg.from?.botId);
        items.push({
          id: msg.id,
          agentName: msg.from.name,
          bot,
          detail: msg.text.slice(0, 80) + (msg.text.length > 80 ? "..." : ""),
          status: "done",
          timestamp: msg.at,
        });
      }
    }
    return items.slice(-15);
  }, [messages, bots, activeBot]);

  if (activities.length === 0) return null;

  return (
    <aside
      aria-label="Agent Activity Timeline"
      className={cn(
        "hidden shrink-0 flex-col border-l border-hairline/50 bg-panel/70 p-3 transition-all duration-200 xl:flex backdrop-blur",
        collapsed ? "w-12" : "w-72"
      )}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        {!collapsed && (
          <div className="flex items-center gap-1.5">
            <Activity size={14} className="text-accent" />
            <span className="text-xs font-semibold tracking-tight text-ink">Agent Activity</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="cursor-pointer ml-auto rounded p-1 text-ink-secondary hover:bg-raised hover:text-ink transition-colors"
          title={collapsed ? "Expand Activity Rail" : "Collapse Activity Rail"}
        >
          <ChevronRight
            size={14}
            className={cn("transition-transform duration-150", !collapsed && "rotate-180")}
          />
        </button>
      </div>

      {!collapsed && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-hairline/40 bg-raised/30 p-2">
          <div className="h-full overflow-y-auto overscroll-contain pr-1">
            <ol className="relative pl-3 space-y-3">
              <div
                aria-hidden="true"
                className="absolute bottom-2 left-[5px] top-2 w-px bg-hairline/60"
              />
              {activities.map((item) => {
                const isLatestRunning = item.status === "running";
                return (
                  <li key={item.id} className="relative flex items-start gap-2.5">
                    <span
                      className={cn(
                        "relative z-10 mt-1 size-2 shrink-0 rounded-full ring-2 ring-panel",
                        isLatestRunning
                          ? "bg-accent animate-pulse"
                          : item.status === "failed"
                            ? "bg-danger"
                            : "bg-success"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {item.bot && (
                          <BotAvatar
                            bot={item.bot}
                            state={normalizeState(item.bot.mascotExpression) ?? "happy"}
                            size={14}
                          />
                        )}
                        <span className="truncate text-[11.5px] font-medium text-ink">
                          {item.agentName}
                        </span>
                        <span
                          className={cn(
                            "ml-auto text-[10px] font-medium shrink-0",
                            isLatestRunning ? "text-accent" : "text-ink-secondary/70"
                          )}
                        >
                          {isLatestRunning ? "Running" : item.status === "failed" ? "Failed" : "Done"}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] leading-relaxed text-ink-secondary font-mono">
                        {item.detail}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </aside>
  );
}
