import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { EventTimelineCard, type TimelineState } from "./EventTimelineCard";
import { formatEventDate, timeZoneLabel, type EventTimelineCardProps } from "./schedule";
import { serializeTimelineSvg } from "./TimelineSvg";

const TABS = [
  { id: "preview", label: "Preview" },
  { id: "code", label: "SVG Code" },
] as const;
type TabId = (typeof TABS)[number]["id"];

type CopyState = "idle" | "copied" | "error";

export function EventTimelineShowcase(props: EventTimelineCardProps & { title?: string }) {
  const { events, date, timeZone, title = "OKX Dev Day" } = props;
  const [tab, setTab] = useState<TabId>("preview");
  const [state, setState] = useState<TimelineState | null>(null);
  const [copy, setCopy] = useState<CopyState>("idle");
  const copyTimer = useRef<number | null>(null);
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({ preview: null, code: null });

  const svgCode = useMemo(() => {
    if (!state) return "";
    const active = events.find((event) => event.id === state.activeId);
    const dateLabel = formatEventDate(date, timeZone);
    const zone = timeZoneLabel(timeZone, date);
    return serializeTimelineSvg({
      events,
      activeId: state.activeId,
      uid: state.uid,
      title: `${title} timeline, ${dateLabel}`,
      description: `${events.length} sessions from ${events[0]?.start ?? ""} to ${events.at(-1)?.end ?? ""} (${zone}).${active ? ` Highlighted: ${active.title}, ${active.start}–${active.end}.` : ""}`,
    });
  }, [state, events, date, timeZone, title]);

  useEffect(() => () => { if (copyTimer.current) window.clearTimeout(copyTimer.current); }, []);

  const onStateChange = useCallback((next: TimelineState) => setState(next), []);

  const copySvg = async () => {
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(svgCode);
      setCopy("copied");
      copyTimer.current = window.setTimeout(() => setCopy("idle"), 2000);
    } catch {
      setCopy("error");
    }
  };

  const downloadSvg = () => {
    const url = URL.createObjectURL(new Blob([svgCode], { type: "image/svg+xml" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-timeline.svg`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = TABS.findIndex((t) => t.id === tab);
    const next = event.key === "ArrowRight" ? (index + 1) % TABS.length : event.key === "ArrowLeft" ? (index - 1 + TABS.length) % TABS.length : event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[TABS[next].id]?.focus();
  };

  return (
    <div className="w-full max-w-[760px]">
      <div role="tablist" aria-label="Showcase view" className="mb-3 flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => { tabRefs.current[t.id] = el; }}
            id={`timeline-tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            aria-controls={`timeline-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={onTabKey}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[13px] outline-none transition-colors duration-200 motion-reduce:transition-none",
              "focus-visible:ring-2 focus-visible:ring-[#4ade80] focus-visible:ring-offset-2 focus-visible:ring-offset-black",
              tab === t.id ? "border-white/20 bg-white/10 text-white" : "border-white/[0.08] text-[#9a9ca3] hover:text-white",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Both panels stay mounted so the card's selection survives tab switches. */}
      <div id="timeline-panel-preview" role="tabpanel" aria-labelledby="timeline-tab-preview" hidden={tab !== "preview"}>
        <EventTimelineCard {...props} onStateChange={onStateChange} />
      </div>

      <div id="timeline-panel-code" role="tabpanel" aria-labelledby="timeline-tab-code" hidden={tab !== "code"} className="min-w-0">
        <div className="rounded-[18px] border border-white/10 bg-[#0b0b0c] p-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-md text-[12.5px] text-[#9a9ca3]">
              SVG exports the current visual state. Interactive behavior is provided by the React component.
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void copySvg()} disabled={!svgCode} className="rounded-[10px] border border-white/15 px-3 py-1.5 text-[13px] outline-none hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-[#4ade80] disabled:opacity-40">
                Copy SVG
              </button>
              <button type="button" onClick={downloadSvg} disabled={!svgCode} className="rounded-[10px] border border-white/15 px-3 py-1.5 text-[13px] outline-none hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-[#4ade80] disabled:opacity-40">
                Download SVG
              </button>
            </div>
          </div>
          <p role="status" className={cn("mt-2 min-h-[18px] text-[12px]", copy === "error" ? "text-[#f87171]" : "text-[#4ade80]")}>
            {copy === "copied" ? "Copied to clipboard." : copy === "error" ? "Couldn't access the clipboard. Select the code below and copy it manually." : ""}
          </p>
          <pre
            tabIndex={0}
            aria-label="SVG source"
            className="mt-2 max-h-[420px] overflow-auto rounded-[10px] border border-white/[0.07] bg-black p-3 font-mono text-[11.5px] leading-relaxed text-[#c7c9cf] outline-none focus-visible:ring-2 focus-visible:ring-[#4ade80]"
          >
            <code>{svgCode}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
