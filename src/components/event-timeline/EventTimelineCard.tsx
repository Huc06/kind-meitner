import { useEffect, useId, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import {
  formatDuration,
  formatEventDate,
  minutesOf,
  timeZoneLabel,
  type EventTimelineCardProps,
} from "./schedule";
import { TimelineSvg } from "./TimelineSvg";

export type TimelineState = { activeId: string | null; uid: string };

const TRANSITION = "transition-[opacity,background-color,border-color,color] duration-[220ms] ease-out motion-reduce:transition-none";

export function EventTimelineCard({
  events,
  date,
  timeZone,
  defaultSelectedId,
  title = "OKX Dev Day",
  subtitle = "X Layer with OKX AI",
  onStateChange,
}: EventTimelineCardProps & {
  title?: string;
  subtitle?: string;
  /** Reports the displayed state (preview over pin) for exports. */
  onStateChange?: (state: TimelineState) => void;
}) {
  const uid = useId();
  const initial = events.some((event) => event.id === defaultSelectedId) ? defaultSelectedId! : events[0]?.id ?? null;
  const [pinnedId, setPinnedId] = useState<string | null>(initial);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const activeId = previewId ?? pinnedId;
  const active = events.find((event) => event.id === activeId) ?? null;

  useEffect(() => {
    onStateChange?.({ activeId, uid });
  }, [activeId, uid, onStateChange]);

  const dateLabel = useMemo(() => formatEventDate(date, timeZone), [date, timeZone]);
  const zoneLabel = useMemo(() => timeZoneLabel(timeZone, date), [timeZone, date]);
  const svgTitle = `${title} timeline, ${dateLabel}`;
  const svgDescription = `${events.length} sessions from ${events[0]?.start ?? ""} to ${events.at(-1)?.end ?? ""} (${zoneLabel}).${active ? ` Highlighted: ${active.title}, ${active.start}–${active.end}.` : ""}`;

  const svgPreview = (
    <TimelineSvg events={events} activeId={activeId} uid={uid} title={svgTitle} description={svgDescription} mode="live" />
  );

  return (
    <div className="w-full max-w-[760px] rounded-[22px] border border-white/[0.06] p-[3px]">
      <article
        aria-label={`${title}, ${dateLabel}`}
        className="overflow-hidden rounded-[18px] border border-white/10 bg-[#0b0b0c] text-white"
      >
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 px-5 pt-5 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-[19px] font-semibold leading-tight tracking-tight">{title}</h2>
            <p className="mt-0.5 text-[13px] text-[#9a9ca3]">{subtitle}</p>
          </div>
          <p className="text-[12.5px] text-[#9a9ca3]">
            <time dateTime={date}>{dateLabel}</time>
            <span aria-hidden="true"> · </span>
            <span>{zoneLabel}</span>
          </p>
        </header>

        <div className="relative mt-4 px-2 sm:px-3">
          {svgPreview}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-b from-transparent to-[#0b0b0c]" />
        </div>

        {/* Fixed height: changing sessions never shifts the layout. */}
        <section aria-label="Selected session" className="mx-5 mt-1 min-h-[68px] border-t border-white/[0.07] pt-3 sm:mx-6">
          {active && (
            <div key={active.id} className="animate-[timeline-fade_220ms_ease-out] motion-reduce:animate-none">
              <p className="text-[15px] font-semibold leading-snug text-white">{active.title}</p>
              <p className="mt-0.5 text-[13px] text-[#9a9ca3]">
                <time>{active.start}</time>–<time>{active.end}</time>
                <span aria-hidden="true"> · </span>
                {formatDuration(minutesOf(active.end) - minutesOf(active.start))}
                {activeId !== pinnedId && <span className="ml-2 text-[#5f6168]">Preview</span>}
              </p>
            </div>
          )}
        </section>

        <ul
          aria-label="Schedule"
          className="mx-5 mt-2 grid grid-cols-1 gap-1.5 sm:mx-6 sm:grid-cols-2"
          onPointerLeave={() => setPreviewId(null)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPreviewId(null);
          }}
        >
          {events.map((event) => {
            const pinned = event.id === pinnedId;
            const shown = event.id === activeId;
            return (
              <li key={event.id}>
                <button
                  type="button"
                  aria-pressed={pinned}
                  aria-label={`${event.title}, ${event.start} to ${event.end}`}
                  onPointerEnter={(e) => { if (e.pointerType === "mouse") setPreviewId(event.id); }}
                  onFocus={() => setPreviewId(event.id)}
                  onClick={() => { setPinnedId(event.id); setPreviewId(null); }}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-3 rounded-[10px] border px-3 py-2 text-left outline-none",
                    "focus-visible:ring-2 focus-visible:ring-[#4ade80] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0c]",
                    TRANSITION,
                    shown ? "border-[#4ade80]/60 bg-[#4ade80]/[0.08]" : "border-white/[0.07] bg-white/[0.02] hover:border-white/15",
                  )}
                >
                  <span className={cn("min-w-0 break-words text-[13px] leading-snug", shown ? "text-white" : "text-[#c7c9cf]")}>{event.title}</span>
                  <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-[#8a8c93]">{event.start}–{event.end}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <footer className="mt-5 bg-gradient-to-b from-transparent to-white/[0.02] px-5 pb-5 pt-4 sm:px-6">
          <p className="text-[14px] font-semibold">Your day, at a glance.</p>
          <p className="mt-1 text-[13px] text-[#9a9ca3]">Explore each session to see when it starts and how it fits into the day.</p>
        </footer>
      </article>
    </div>
  );
}
