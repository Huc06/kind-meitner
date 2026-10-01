// Message hits under the sidebar's search box. The box already filters bots
// by name; from two characters on it also asks the server for messages
// across every bot task and room, and a click lands on the message — right
// bot, right task, right branch — rather than just opening the chat.
import { useEffect, useState } from "react";
import { GitBranch, Wrench } from "lucide-react";
import { api, useStore, formatTime } from "@/state/store";
import { BotAvatar } from "./Avatar";
import { cn } from "@/lib/cn";
import type { SearchHit } from "@/lib/search-hit";
import { landOnSearchHit } from "@/lib/focus-message";

export const MIN_QUERY = 2;
const DEBOUNCE_MS = 250;

export function SearchResults({ query, onLanded }: { query: string; onLanded: () => void }) {
  const { state, dispatch } = useStore();
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const q = query.trim();

  useEffect(() => {
    if (q.length < MIN_QUERY) {
      setHits(null);
      setError(null);
      return;
    }
    // Do not leave the previous query's hits clickable while the debounced
    // request for this query is still in flight.
    setHits(null);
    setError(null);
    let alive = true;
    const t = setTimeout(() => {
      api(`/api/search?q=${encodeURIComponent(q)}&limit=40`)
        .then((r: { hits: SearchHit[] }) => alive && (setHits(r.hits), setError(null)))
        .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    }, DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  if (q.length < MIN_QUERY) return null;

  const land = async (hit: SearchHit) => {
    try {
      await landOnSearchHit(hit, state, dispatch);
      onLanded();
    } catch (e) {
      dispatch({ type: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="frame-rule-above mt-2 pt-2">
      <div className="label-mono px-2.5 pb-1 pt-1 text-ink-secondary">
        Messages{hits ? ` · ${hits.length}${hits.length === 40 ? "+" : ""}` : ""}
      </div>
      {error && <div className="px-2.5 py-2 font-mono text-[11px] text-danger">couldn't search: {error}</div>}
      {hits && hits.length === 0 && !error && <div className="px-2.5 py-3 font-mono text-[12px] text-ink-secondary">No messages match “{q}”</div>}
      {hits?.map((hit) => {
        const bot = hit.botId ? state.bots.find((b) => b.id === hit.botId) : undefined;
        const before = hit.snippet.slice(0, hit.matchStart);
        const match = hit.snippet.slice(hit.matchStart, hit.matchStart + hit.matchLength);
        const after = hit.snippet.slice(hit.matchStart + hit.matchLength);
        return (
          <button
            key={`${hit.threadId}:${hit.messageId}`}
            onClick={() => void land(hit)}
            className="flex w-full items-start gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-raised-hover"
          >
            {bot ? (
              <BotAvatar bot={bot} state="idle" size={26} animated={false} />
            ) : (
              <span className="flex size-[26px] shrink-0 items-center justify-center border border-hairline bg-raised font-mono text-[11px] text-ink-secondary">#</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-1.5 text-[12px] text-ink-secondary">
                <span className="truncate font-medium text-ink">{hit.from ?? hit.name}</span>
                {hit.task ? <span className="truncate font-mono text-[11px]">· {hit.task}</span> : null}
                <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums">{formatTime(hit.at)}</span>
              </span>
              <span className={cn("mt-0.5 line-clamp-2 text-[12px] leading-snug", hit.role === "user" ? "text-ink" : "text-ink-secondary")}>
                {hit.kind === "activity" && <Wrench size={11} className="mr-1 inline text-ink-secondary" />}
                {before}
                <mark className="bg-raised-hover font-semibold text-ink underline">{match}</mark>
                {after}
              </span>
              {!hit.onActivePath && (
                <span className="mt-0.5 flex items-center gap-1 font-mono text-[10.5px] text-ink-secondary">
                  <GitBranch size={10} /> other version
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
