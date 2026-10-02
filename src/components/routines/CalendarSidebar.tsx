import { useMemo, useState, type DragEvent } from "react";
import { GripVertical, Search, UsersRound } from "lucide-react";
import { BotAvatar } from "@/components/Avatar";
import type { Bot } from "@/state/store";
import { MiniMonth } from "./MiniMonth";

export const BOT_CALENDAR_DRAG_TYPE = "application/x-kind-meitner-bot";

export interface CalendarSidebarProps {
  bots: Bot[];
  anchor: number;
  onSelectDate: (at: number) => void;
}

export function CalendarSidebar({ bots, anchor, onSelectDate }: CalendarSidebarProps) {
  const [query, setQuery] = useState("");
  const filteredBots = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return bots;
    return bots.filter((bot) =>
      `${bot.name} ${bot.title} ${bot.description}`.toLocaleLowerCase().includes(normalized),
    );
  }, [bots, query]);

  const beginBotDrag = (event: DragEvent<HTMLDivElement>, bot: Bot) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(BOT_CALENDAR_DRAG_TYPE, bot.id);
    event.dataTransfer.setData("text/plain", bot.id);
  };

  return (
    <aside
      aria-label="Schedule sidebar"
      className="flex h-full w-[300px] shrink-0 flex-col overflow-hidden border-r border-hairline bg-panel"
    >
      <MiniMonth anchor={anchor} onSelect={onSelectDate} />

      <div className="frame-rule mx-3 my-1" />

      <section aria-labelledby="calendar-bots-heading" className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2">
        <div className="mb-2 flex items-center justify-between px-1">
          <div id="calendar-bots-heading" className="label-mono flex items-center gap-2 text-ink-secondary">
            <UsersRound size={13} aria-hidden="true" />
            My bots
          </div>
          <span className="font-mono text-[10px] tabular-nums text-ink-secondary">
            [{bots.length}]
          </span>
        </div>
        <label className="relative mb-2 block">
          <span className="sr-only">Search bots</span>
          <Search
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-secondary/70"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            placeholder="Search bots"
            className="h-8 w-full border border-hairline bg-inset pl-8 pr-2.5 text-[11.5px] text-ink outline-none placeholder:text-ink-secondary/60 hover:border-ink-secondary/60 focus:border-ink"
          />
        </label>

        <div role="list" aria-label="Bots available to schedule" className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-0.5">
          {filteredBots.map((bot) => (
            <div
              key={bot.id}
              draggable
              onDragStart={(event) => beginBotDrag(event, bot)}
              role="listitem"
              className="group flex h-9 cursor-grab items-center gap-2.5 px-2.5 transition-colors hover:bg-raised-hover active:cursor-grabbing"
              aria-label={`Drag ${bot.name} onto the schedule`}
              title={`Drag ${bot.name} onto the schedule`}
            >
              <GripVertical
                size={13}
                className="shrink-0 text-ink-secondary/40 transition-colors group-hover:text-ink-secondary"
                aria-hidden="true"
              />
              <BotAvatar bot={bot} size={24} animated={false} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-ink">{bot.name}</div>
                <div className="truncate font-mono text-[10px] text-ink-secondary">
                  {bot.title || "BotAgent"}
                </div>
              </div>
              <span className="shrink-0 border border-hairline font-mono text-[9px] uppercase tracking-wider text-ink-secondary px-1.5 py-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                Drag
              </span>
            </div>
          ))}

          {filteredBots.length === 0 && (
            <div className="px-3 py-8 text-center text-[11px] leading-relaxed text-ink-secondary">
              {bots.length === 0 ? "Create a bot to schedule work." : "No bots match your search."}
            </div>
          )}
        </div>

        <p className="mt-2 px-1 font-mono text-[9.5px] uppercase tracking-wider text-ink-secondary/70">
          Drag a bot onto any time to schedule it.
        </p>
      </section>
    </aside>
  );
}
