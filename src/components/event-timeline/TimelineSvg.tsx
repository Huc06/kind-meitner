// One SVG component in two modes. "live" adds CSS transitions for the card;
// "export" uses only explicit presentation attributes so the markup renders
// on its own. svgCode is this component serialized, so the preview and the
// exported source can never drift into two designs.
import { renderToStaticMarkup } from "react-dom/server";
import { layoutTimeline, TIMELINE, TIMELINE_HEIGHT, type ScheduleEvent } from "./schedule";

const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const COLORS = {
  grid: "#ffffff",
  axisText: "#7c7f86",
  idleFill: "#122d1f",
  idleStroke: "#2b7a51",
  idleText: "#b9d8c6",
  activeText: "#04140b",
  gradFrom: "#4ade80",
  gradTo: "#10b981",
} as const;

export type TimelineSvgProps = {
  events: ScheduleEvent[];
  activeId: string | null;
  /** Unique per card instance; prefixes gradient and clip-path IDs. */
  uid: string;
  title: string;
  description: string;
  mode: "live" | "export";
};

/** React ids (":r1:") are not safe in every SVG consumer; keep [A-Za-z0-9-]. */
export function svgIdPrefix(uid: string): string {
  return `kmtl-${uid.replace(/[^A-Za-z0-9-]/g, "")}`;
}

export function TimelineSvg({ events, activeId, uid, title, description, mode }: TimelineSvgProps) {
  const layout = layoutTimeline(events);
  const prefix = svgIdPrefix(uid);
  const gradientId = `${prefix}-active`;
  const live = mode === "live";
  // Live-only motion; the export carries final state and no CSS.
  const motion = live ? "transition-[opacity,fill,stroke] duration-[220ms] ease-out motion-reduce:transition-none" : undefined;
  const titleId = `${prefix}-title`;
  const descId = `${prefix}-desc`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${TIMELINE.width} ${TIMELINE_HEIGHT}`}
      width={live ? "100%" : TIMELINE.width}
      height={live ? undefined : TIMELINE_HEIGHT}
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      className={live ? "block h-auto w-full" : undefined}
    >
      <title id={titleId}>{title}</title>
      <desc id={descId}>{description}</desc>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={COLORS.gradFrom} />
          <stop offset="1" stopColor={COLORS.gradTo} />
        </linearGradient>
        {layout.blocks.map((block) => (
          <clipPath key={block.event.id} id={`${prefix}-clip-${block.event.id}`}>
            <rect x={block.x} y={block.y} width={block.width} height={TIMELINE.laneHeight} rx={6} />
          </clipPath>
        ))}
      </defs>
      <rect x={0} y={0} width={TIMELINE.width} height={TIMELINE_HEIGHT} fill="#0b0b0c" />
      {layout.hours.map((hour) => (
        <g key={hour.minutes}>
          <line x1={hour.x} x2={hour.x} y1={TIMELINE.axisY + 6} y2={TIMELINE_HEIGHT - TIMELINE.padBottom + 6} stroke={COLORS.grid} strokeOpacity={0.07} strokeWidth={1} />
          <text x={hour.x} y={TIMELINE.axisY} fill={COLORS.axisText} fontFamily={FONT} fontSize={11} textAnchor="middle">{hour.label}</text>
        </g>
      ))}
      {Array.from({ length: TIMELINE.lanes }, (_, lane) => {
        const y = TIMELINE.laneTop + lane * (TIMELINE.laneHeight + TIMELINE.laneGap) + TIMELINE.laneHeight / 2;
        return <line key={lane} x1={TIMELINE.padX} x2={TIMELINE.width - TIMELINE.padX} y1={y} y2={y} stroke={COLORS.grid} strokeOpacity={0.04} strokeDasharray="2 6" />;
      })}
      {layout.blocks.map((block) => {
        const active = block.event.id === activeId;
        const dimmed = activeId !== null && !active;
        return (
          <g key={block.event.id} opacity={dimmed ? 0.55 : 1} className={motion}>
            <rect
              x={block.x + 1}
              y={block.y}
              width={Math.max(block.width - 2, 2)}
              height={TIMELINE.laneHeight}
              rx={6}
              fill={active ? `url(#${gradientId})` : COLORS.idleFill}
              stroke={active ? COLORS.gradFrom : COLORS.idleStroke}
              strokeWidth={1}
              className={motion}
            />
            {block.showTitle && (
              <g clipPath={`url(#${prefix}-clip-${block.event.id})`}>
                <text x={block.x + 10} y={block.y + (block.showTime ? 19 : 28)} fill={active ? COLORS.activeText : COLORS.idleText} fontFamily={FONT} fontSize={11.5} fontWeight={600} className={motion}>
                  {block.event.title}
                </text>
                {block.showTime && (
                  <text x={block.x + 10} y={block.y + 35} fill={active ? COLORS.activeText : COLORS.axisText} fillOpacity={active ? 0.75 : 1} fontFamily={FONT} fontSize={10.5} className={motion}>
                    {`${block.event.start}–${block.event.end}`}
                  </text>
                )}
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** One element per line, indented by depth. Text is already escaped by React. */
function formatMarkup(markup: string): string {
  const parts = markup.replace(/></g, ">\n<").split("\n");
  let depth = 0;
  return parts
    .map((part) => {
      if (part.startsWith("</")) depth = Math.max(depth - 1, 0);
      const line = "  ".repeat(depth) + part;
      const opens = part.startsWith("<") && !part.startsWith("</") && !part.endsWith("/>");
      const closesInline = /<\/[^>]+>$/.test(part) && !part.startsWith("</");
      if (opens && !closesInline) depth += 1;
      return line;
    })
    .join("\n");
}

export function serializeTimelineSvg(props: Omit<TimelineSvgProps, "mode">): string {
  const markup = renderToStaticMarkup(<TimelineSvg {...props} mode="export" />);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${formatMarkup(markup)}\n`;
}
