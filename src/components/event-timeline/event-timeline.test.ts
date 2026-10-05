import { describe, expect, it } from "vitest";
import { layoutTimeline, minutesOf, OKX_DEV_DAY_EVENTS, TIMELINE, timeZoneLabel } from "./schedule";
import { serializeTimelineSvg } from "./TimelineSvg";

describe("timeline geometry", () => {
  const layout = layoutTimeline(OKX_DEV_DAY_EVENTS);

  it("places every session proportionally to its real start and duration", () => {
    const pxPerMin = (TIMELINE.width - TIMELINE.padX * 2) / (16 * 60 - (10 * 60 + 30));
    expect(layout.blocks).toHaveLength(8);
    for (const block of layout.blocks) {
      expect(block.x).toBeCloseTo(TIMELINE.padX + (block.startMin - 630) * pxPerMin, 6);
      expect(block.width).toBeCloseTo(block.duration * pxPerMin, 6);
    }
    expect(layout.blocks.find((b) => b.event.id === "awards")?.duration).toBe(5);
  });

  it("never overlaps blocks in a lane and never shows a label wider than its block", () => {
    for (const lane of [0, 1]) {
      const blocks = layout.blocks.filter((b) => b.lane === lane);
      for (let i = 1; i < blocks.length; i++) expect(blocks[i]!.x).toBeGreaterThanOrEqual(blocks[i - 1]!.x + blocks[i - 1]!.width - 1e-9);
    }
    const tiny = layout.blocks.filter((b) => b.duration <= 15);
    expect(tiny.every((b) => !b.showTitle)).toBe(true);
  });

  it("rejects malformed or out-of-window data instead of drawing it", () => {
    expect(() => minutesOf("9:30")).toThrow();
    expect(() => layoutTimeline([{ id: "x", title: "Late", start: "15:30", end: "16:30" }])).toThrow(/outside/);
    expect(() => layoutTimeline([{ id: "x", title: "Backwards", start: "12:00", end: "11:00" }])).toThrow(/after it starts/);
  });

  it("labels the published zone, independent of the viewer's zone", () => {
    expect(timeZoneLabel("Asia/Singapore", "2026-10-07")).toBe("Singapore · UTC+8");
  });
});

describe("SVG export", () => {
  const svg = (activeId: string | null, uid = ":r1:", title = "OKX Dev Day timeline") =>
    serializeTimelineSvg({ events: OKX_DEV_DAY_EVENTS, activeId, uid, title, description: "desc" });

  it("is a standalone SVG: namespace, viewBox, title, desc, no scripts, CSS classes or foreignObject", () => {
    const out = svg("finalist-demos");
    expect(out).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 720 /);
    expect(out).toContain("<title");
    expect(out).toContain("<desc");
    expect(out).not.toMatch(/<script|foreignObject|class=|href=|@import|url\(http/);
  });

  it("reflects the displayed session and escapes content", () => {
    const highlighted = svg("finalist-demos");
    const gradientUses = (s: string) => s.match(/fill="url\(#kmtl-r1-active\)"/g)?.length ?? 0;
    expect(gradientUses(highlighted)).toBe(1);
    expect(svg("panel-1")).not.toBe(highlighted);
    expect(svg(null, ":r1:", "A <b>&\"quoted\"")).toContain("A &lt;b&gt;&amp;");
  });

  it("gives each card its own gradient and clip-path IDs", () => {
    const ids = (s: string) => [...s.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    const a = ids(svg("finalist-demos", ":r1:"));
    const b = ids(svg("finalist-demos", ":r2:"));
    expect(new Set(a).size).toBe(a.length);
    expect(a.filter((id) => b.includes(id))).toEqual([]);
  });
});
