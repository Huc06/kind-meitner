import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { type Bot, type Message } from "@/state/store";
import { BotAvatar } from "./Avatar";
import { cn } from "@/lib/cn";
import { normalizeState } from "@/lib/mascot";
import { tileFor, TILE_FILL } from "@/components/ui/tile";

export interface ActivityRailItem {
  id: string;
  agentName: string;
  bot?: Bot;
  detail: string;
  status: "running" | "done" | "failed";
  timestamp: number;
}

/** Cybernetic console Live Multi-Agent Activity Rail. */
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
        "hidden shrink-0 flex-col border-l border-hairline bg-panel p-3 transition-all duration-200 xl:flex",
        collapsed ? "w-12" : "w-72",
      )}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        {!collapsed && (
          <div className="label-mono flex items-center gap-1.5 text-ink">
            <span>ACTIVITY</span>
            <span className="text-ink-secondary">[{activities.length}]</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="ml-auto flex size-6 items-center justify-center border border-hairline bg-raised text-ink-secondary hover:border-ink hover:text-ink transition-colors"
          title={collapsed ? "Expand Activity Rail" : "Collapse Activity Rail"}
          aria-label={collapsed ? "Expand Activity Rail" : "Collapse Activity Rail"}
        >
          <ChevronRight
            size={12}
            className={cn("transition-transform duration-150", !collapsed && "rotate-180")}
          />
        </button>
      </div>

      {!collapsed ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-hairline bg-inset p-2">
          <div className="h-full overflow-y-auto overscroll-contain pr-1">
            <ol className="space-y-2">
              {activities.map((item) => {
                const isRunning = item.status === "running";
                const tileTone = tileFor(item.bot?.id ?? item.agentName);
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-1 border-b border-hairline/40 pb-2 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className={cn("size-2 shrink-0", TILE_FILL[tileTone])}
                      />
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          isRunning
                            ? "bg-accent animate-pulse"
                            : item.status === "failed"
                              ? "bg-danger"
                              : "bg-success",
                        )}
                      />
                      {item.bot && (
                        <BotAvatar
                          bot={item.bot}
                          state={normalizeState(item.bot.mascotExpression) ?? "happy"}
                          size={14}
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-medium text-ink">
                        {item.agentName}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 font-mono text-[9.5px] uppercase tracking-wider",
                          isRunning
                            ? "text-accent"
                            : item.status === "failed"
                              ? "text-danger"
                              : "text-ink-secondary",
                        )}
                      >
                        {isRunning ? "Running" : item.status === "failed" ? "Failed" : "Done"}
                      </span>
                    </div>
                    <p className="truncate font-mono text-[10.5px] leading-relaxed text-ink-secondary">
                      {item.detail}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 pt-2">
          {activities.slice(-6).map((item) => {
            const tileTone = tileFor(item.bot?.id ?? item.agentName);
            return (
              <span
                key={item.id}
                title={`${item.agentName}: ${item.detail}`}
                className={cn("size-2.5", TILE_FILL[tileTone])}
              />
            );
          })}
        </div>
      )}
    </aside>
  );
}
