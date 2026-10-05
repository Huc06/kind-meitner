// Schedule data and pure timeline geometry for EventTimelineCard. Times are
// wall-clock "HH:MM" in the event's own time zone; they are never converted
// through a Date, so the viewer's browser time zone cannot shift them.

export type ScheduleEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
};

export type EventTimelineCardProps = {
  events: ScheduleEvent[];
  /** ISO calendar date of the event, e.g. "2026-10-07". */
  date: string;
  /** IANA zone the schedule is published in, e.g. "Asia/Singapore". */
  timeZone: string;
  defaultSelectedId?: string;
};

export const OKX_DEV_DAY_EVENTS: ScheduleEvent[] = [
  { id: "registration", title: "Registration & Arrival", start: "10:30", end: "11:00" },
  { id: "welcome", title: "Welcome & Briefing", start: "11:00", end: "11:15" },
  { id: "panel-1", title: "Panel 1", start: "11:15", end: "11:30" },
  { id: "build-interviews", title: "Build & Interview Sessions", start: "11:30", end: "13:05" },
  { id: "finalist-demos", title: "Finalist Demos", start: "13:05", end: "15:00" },
  { id: "panel-2", title: "Panel 2 & Judge Deliberation", start: "15:00", end: "15:30" },
  { id: "group-photo", title: "Group Photo", start: "15:30", end: "15:45" },
  { id: "awards", title: "Awards & Closing", start: "15:45", end: "15:50" },
];

/** "13:05" → 785. Throws on malformed input so bad data fails loudly. */
export function minutesOf(time: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) throw new Error(`Invalid time "${time}"; expected HH:MM`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error(`Invalid time "${time}"`);
  return hours * 60 + minutes;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** "Asia/Singapore" on 2026-10-07 → "Singapore · UTC+8". */
export function timeZoneLabel(timeZone: string, date: string): string {
  const city = (timeZone.split("/").at(-1) ?? timeZone).replace(/_/g, " ");
  const offset = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
    .formatToParts(new Date(`${date}T12:00:00Z`))
    .find((part) => part.type === "timeZoneName")?.value ?? "";
  return `${city} · ${offset.replace(/^GMT/, "UTC") || "UTC"}`;
}

/** "2026-10-07" → "7 October 2026", read as a calendar date in the event zone. */
export function formatEventDate(date: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "long", year: "numeric" })
    .format(new Date(`${date}T12:00:00Z`));
}

export const TIMELINE = {
  width: 720,
  padX: 20,
  axisY: 22,
  laneTop: 38,
  laneHeight: 46,
  laneGap: 10,
  lanes: 2,
  padBottom: 18,
} as const;
export const TIMELINE_HEIGHT = TIMELINE.laneTop + TIMELINE.lanes * TIMELINE.laneHeight + (TIMELINE.lanes - 1) * TIMELINE.laneGap + TIMELINE.padBottom;

export type TimelineBlock = {
  event: ScheduleEvent;
  startMin: number;
  endMin: number;
  duration: number;
  x: number;
  width: number;
  y: number;
  lane: number;
  /** Title fits inside the block at the export font size. */
  showTitle: boolean;
  /** Time range also fits under the title. */
  showTime: boolean;
};

/** Average advance of an 11.5px system-ui glyph at weight 600. Text is also
 * clipped to its block, so an underestimate can trim but never spill. */
const CHAR_WIDTH = 6.3;

export type TimelineLayout = {
  windowStart: number;
  windowEnd: number;
  hours: { minutes: number; x: number; label: string }[];
  blocks: TimelineBlock[];
};

/** Places each event proportionally to its start and duration. Consecutive
 * events alternate lanes so short adjacent blocks stay distinct. */
export function layoutTimeline(events: ScheduleEvent[], windowStart = "10:30", windowEnd = "16:00"): TimelineLayout {
  const from = minutesOf(windowStart);
  const to = minutesOf(windowEnd);
  if (to <= from) throw new Error("Timeline window must end after it starts");
  const usable = TIMELINE.width - TIMELINE.padX * 2;
  const xOf = (minutes: number) => TIMELINE.padX + ((minutes - from) / (to - from)) * usable;
  const sorted = [...events].sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
  const blocks = sorted.map((event, index): TimelineBlock => {
    const startMin = minutesOf(event.start);
    const endMin = minutesOf(event.end);
    if (endMin <= startMin) throw new Error(`"${event.title}" must end after it starts`);
    if (startMin < from || endMin > to) throw new Error(`"${event.title}" falls outside ${windowStart}–${windowEnd}`);
    const lane = index % TIMELINE.lanes;
    const x = xOf(startMin);
    const width = xOf(endMin) - x;
    const showTitle = width >= event.title.length * CHAR_WIDTH + 20;
    const showTime = showTitle && width >= 11 * 6.2 + 20;
    return {
      event, startMin, endMin, duration: endMin - startMin,
      x, width, lane, y: TIMELINE.laneTop + lane * (TIMELINE.laneHeight + TIMELINE.laneGap),
      showTitle, showTime,
    };
  });
  const hours = [];
  for (let m = Math.ceil(from / 60) * 60; m <= to; m += 60) {
    hours.push({ minutes: m, x: xOf(m), label: `${String(m / 60).padStart(2, "0")}:00` });
  }
  return { windowStart: from, windowEnd: to, hours, blocks };
}
