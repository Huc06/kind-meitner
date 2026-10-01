// ⌘K switcher: bots and rooms from local state, transcript hits from
// /api/search. Self-contained — owns its open state and its global chord,
// so App.tsx only mounts it.
import { useEffect, useRef, useState } from "react";
import { Bot as BotIcon, MessageSquare, Search, Users } from "lucide-react";
import { api, useStore, type Bot, type Group } from "@/state/store";
import { rankByName } from "@/lib/palette-rank";
import { cn } from "@/lib/cn";
import type { SearchHit } from "@/lib/search-hit";
import { landOnSearchHit } from "@/lib/focus-message";
import { DialogBackdrop, DialogPanel } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/eyebrow";
type PaletteEntry =
  | { kind: "bot"; bot: Bot }
  | { kind: "room"; group: Group }
  | { kind: "message"; hit: SearchHit };

export function CommandPalette({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [messageHits, setMessageHits] = useState<SearchHit[]>([]);
  const [cursor, setCursor] = useState(0);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // The chord fires from anywhere — Shell's app-wide shortcuts (⌘N, ⌘1–9)
  // set the precedent of not guarding against focused inputs, and a
  // modifier chord never collides with typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // fresh palette every open; stale queries from last time would flash
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setMessageHits([]);
    setCursor(0);
  }, [open]);

  useEffect(() => {
    onOpenChange?.(open);
  }, [onOpenChange, open]);

  const q = query.trim().toLowerCase();

  // Same debounce pattern as the sidebar search: names answer instantly
  // from local state, transcript hits arrive a beat later, and a stale
  // response for an outdated query is dropped.
  useEffect(() => {
    if (!open || !q) {
      setMessageHits([]);
      return;
    }
    // Results for the previous query must not remain clickable while the
    // debounce and request for this query are pending.
    setMessageHits([]);
    let alive = true;
    const timer = setTimeout(() => {
      api(`/api/search?q=${encodeURIComponent(q)}&limit=12`)
        .then((result: { hits?: SearchHit[] }) => alive && setMessageHits(result.hits ?? []))
        .catch(() => alive && setMessageHits([]));
    }, 150);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [open, q]);

  useEffect(() => setCursor(0), [q]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [cursor, messageHits]);

  if (!open) return null;

  const bots = rankByName(state.bots.filter((b) => !b.hidden), q);
  const rooms = rankByName(state.groups, q);
  const entries: PaletteEntry[] = [
    ...bots.map((bot): PaletteEntry => ({ kind: "bot", bot })),
    ...rooms.map((group): PaletteEntry => ({ kind: "room", group })),
    // message hits only make sense for a typed query; empty = switcher mode
    ...(q ? messageHits.map((hit): PaletteEntry => ({ kind: "message", hit })) : []),
  ];
  // hits arriving or rows filtering away can strand the cursor past the end
  const selected = entries.length ? Math.min(cursor, entries.length - 1) : 0;

  const activate = async (entry: PaletteEntry) => {
    if (entry.kind === "message") {
      const hit = entry.hit;
      try {
        await landOnSearchHit(hit, state, dispatch);
      } catch (error) {
        dispatch({ type: "error", message: error instanceof Error ? error.message : String(error) });
      }
    } else {
      dispatch({ type: "select", id: entry.kind === "bot" ? entry.bot.id : entry.group.id });
    }
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      // shield the window listeners other modals hang their own Esc on
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor(entries.length ? (selected + 1) % entries.length : 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(entries.length ? (selected - 1 + entries.length) % entries.length : 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const entry = entries[selected];
      if (entry) void activate(entry);
    }
  };

  // flat cursor across sections; each row needs its absolute index
  const roomOffset = bots.length;
  const messageOffset = bots.length + rooms.length;

  const row = (key: string, index: number, onPick: () => void, children: React.ReactNode, twoLine = false) => (
    <button
      key={key}
      ref={index === selected ? selectedRef : undefined}
      onClick={onPick}
      // mousemove, not mouseenter: rows shifting under a resting pointer
      // (hits arriving) must not steal the keyboard selection
      onMouseMove={() => setCursor(index)}
      className={cn(
        "flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors",
        twoLine ? "flex-col items-stretch gap-1 py-2" : "min-h-[34px]",
        index === selected
          ? "bg-raised shadow-[inset_2px_0_0_var(--color-ink)] text-ink"
          : "text-ink hover:bg-raised-hover",
      )}
    >
      {children}
    </button>
  );

  return (
    <DialogBackdrop
      className="items-start pt-[14vh]"
      onDismiss={() => setOpen(false)}
      onKeyDown={onKeyDown}
    >
      <DialogPanel
        aria-label="Command palette"
        className="max-h-[min(520px,70vh)] w-full max-w-[580px] overflow-hidden p-0"
      >
        <div className="frame-rule-below flex items-center gap-3 bg-panel px-4 py-3">
          <Search size={16} className="shrink-0 text-ink-secondary" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search bots, channels, messages…"
            className="w-full bg-transparent font-mono text-[13px] text-ink placeholder:text-ink-secondary focus:outline-none"
          />
          <Kbd className="shrink-0">esc</Kbd>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {entries.length === 0 && (
            <div className="px-3 py-8 text-center font-mono text-[12px] text-ink-secondary">
              {q ? `Nothing matches “${query}”` : "Nothing to switch to yet"}
            </div>
          )}
          {bots.length > 0 && (
            <div className="label-mono px-2.5 pb-1 pt-2 text-ink-secondary">
              Bots
            </div>
          )}
          {bots.map((bot, i) =>
            row(
              `bot:${bot.id}`,
              i,
              () => void activate({ kind: "bot", bot }),
              <>
                <BotIcon size={15} className="shrink-0 text-ink-secondary" />
                <span className="truncate text-[13px] font-medium text-ink">{bot.name}</span>
                {bot.title && (
                  <span className="ml-auto min-w-0 truncate font-mono text-[11px] text-ink-secondary">{bot.title}</span>
                )}
              </>,
            ),
          )}
          {rooms.length > 0 && (
            <div className="label-mono px-2.5 pb-1 pt-3 text-ink-secondary">
              Groups
            </div>
          )}
          {rooms.map((group, i) =>
            row(
              `room:${group.id}`,
              roomOffset + i,
              () => void activate({ kind: "room", group }),
              <>
                <Users size={15} className="shrink-0 text-ink-secondary" />
                <span className="truncate text-[13px] font-medium text-ink">{group.name}</span>
              </>,
            ),
          )}
          {q && messageHits.length > 0 && (
            <div className="label-mono px-2.5 pb-1 pt-3 text-ink-secondary">
              Messages
            </div>
          )}
          {q &&
            messageHits.map((hit, i) => {
              const before = hit.snippet.slice(0, hit.matchStart);
              const match = hit.snippet.slice(hit.matchStart, hit.matchStart + hit.matchLength);
              const after = hit.snippet.slice(hit.matchStart + hit.matchLength);
              return row(
                `msg:${hit.threadId}:${hit.messageId}`,
                messageOffset + i,
                () => void activate({ kind: "message", hit }),
                <>
                  <span className="flex items-center gap-2 truncate text-[13px] font-medium text-ink">
                    <MessageSquare size={13} className="shrink-0 text-ink-secondary" />
                    {hit.name}
                    {hit.task ? <span className="font-mono text-[11px] text-ink-secondary"> · {hit.task}</span> : null}
                  </span>
                  <span className="line-clamp-2 font-mono text-[12px] text-ink-secondary">
                    {before}<mark className="bg-raised-hover font-semibold text-ink underline">{match}</mark>{after}
                  </span>
                </>,
                true,
              );
            })}
        </div>
      </DialogPanel>
    </DialogBackdrop>
  );
}
