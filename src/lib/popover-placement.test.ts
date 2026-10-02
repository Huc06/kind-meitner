import { describe, expect, it } from "vitest";
import { computePopoverPlacement, rectsIntersect, type Rect } from "./popover-placement";

describe("computePopoverPlacement", () => {
  const standardViewport = { w: 1200, h: 800 };
  const standardCardSize = { w: 320, h: 180 };
  const margin = 16;
  const gap = 12;

  it("places popover below anchor when preferred and fits safely", () => {
    const anchorRect: Rect = { x: 200, y: 100, w: 100, h: 40 };
    const result = computePopoverPlacement({
      anchorRect,
      popoverSize: standardCardSize,
      viewport: standardViewport,
      preferredPlacement: "below",
      margin,
      gap,
    });

    expect(result.placement).toBe("below");
    expect(result.y).toBe(anchorRect.y + anchorRect.h + gap);
    expect(result.x).toBe(anchorRect.x);
    expect(result.x).toBeGreaterThanOrEqual(margin);
    expect(result.y).toBeGreaterThanOrEqual(margin);
    expect(result.x + result.width).toBeLessThanOrEqual(standardViewport.w - margin);
    expect(result.y + result.height).toBeLessThanOrEqual(standardViewport.h - margin);
  });

  it("places popover above anchor when preferred and fits safely", () => {
    const anchorRect: Rect = { x: 200, y: 400, w: 100, h: 40 };
    const result = computePopoverPlacement({
      anchorRect,
      popoverSize: standardCardSize,
      viewport: standardViewport,
      preferredPlacement: "above",
      margin,
      gap,
    });

    expect(result.placement).toBe("above");
    expect(result.y).toBe(anchorRect.y - gap - result.height);
    expect(result.x).toBe(anchorRect.x);
  });

  it("places popover right of anchor when preferred and fits safely", () => {
    const anchorRect: Rect = { x: 50, y: 200, w: 60, h: 40 };
    const result = computePopoverPlacement({
      anchorRect,
      popoverSize: standardCardSize,
      viewport: standardViewport,
      preferredPlacement: "right",
      margin,
      gap,
    });

    expect(result.placement).toBe("right");
    expect(result.x).toBe(anchorRect.x + anchorRect.w + gap);
    expect(result.x + result.width).toBeLessThanOrEqual(standardViewport.w - margin);
  });

  it("places popover left of anchor when preferred and fits safely", () => {
    const anchorRect: Rect = { x: 800, y: 200, w: 60, h: 40 };
    const result = computePopoverPlacement({
      anchorRect,
      popoverSize: standardCardSize,
      viewport: standardViewport,
      preferredPlacement: "left",
      margin,
      gap,
    });

    expect(result.placement).toBe("left");
    expect(result.x).toBe(anchorRect.x - gap - result.width);
    expect(result.x).toBeGreaterThanOrEqual(margin);
  });

  it("flips from above to below when anchor is too close to top edge", () => {
    const anchorRect: Rect = { x: 100, y: 20, w: 120, h: 30 }; // only 20px from top
    const result = computePopoverPlacement({
      anchorRect,
      popoverSize: standardCardSize,
      viewport: standardViewport,
      preferredPlacement: "above",
      margin,
      gap,
    });

    expect(result.placement).toBe("below");
    expect(result.y).toBe(anchorRect.y + anchorRect.h + gap);
    expect(result.y).toBeGreaterThanOrEqual(margin);
  });

  it("flips from below to above when anchor is too close to bottom edge", () => {
    const anchorRect: Rect = { x: 100, y: 720, w: 120, h: 30 }; // 50px from bottom (800 - 750)
    const result = computePopoverPlacement({
      anchorRect,
      popoverSize: standardCardSize,
      viewport: standardViewport,
      preferredPlacement: "below",
      margin,
      gap,
    });

    expect(result.placement).toBe("above");
    expect(result.y).toBeLessThan(anchorRect.y);
    expect(result.y).toBeGreaterThanOrEqual(margin);
  });

  it("flips from right to left when anchor is too close to right edge", () => {
    const anchorRect: Rect = { x: 1100, y: 300, w: 80, h: 40 }; // 20px from right edge
    const result = computePopoverPlacement({
      anchorRect,
      popoverSize: standardCardSize,
      viewport: standardViewport,
      preferredPlacement: "right",
      margin,
      gap,
    });

    expect(result.placement).toBe("left");
    expect(result.x + result.width).toBeLessThanOrEqual(anchorRect.x - gap);
    expect(result.x).toBeGreaterThanOrEqual(margin);
  });

  it("maintains at least 16px margin from every viewport edge", () => {
    const testCases: Rect[] = [
      { x: 5, y: 5, w: 20, h: 20 },
      { x: standardViewport.w - 10, y: 5, w: 20, h: 20 },
      { x: 5, y: standardViewport.h - 10, w: 20, h: 20 },
      { x: standardViewport.w - 10, y: standardViewport.h - 10, w: 20, h: 20 },
    ];

    for (const anchorRect of testCases) {
      const result = computePopoverPlacement({
        anchorRect,
        popoverSize: standardCardSize,
        viewport: standardViewport,
        margin: 16,
      });

      expect(result.x).toBeGreaterThanOrEqual(16);
      expect(result.y).toBeGreaterThanOrEqual(16);
      expect(result.x + result.width).toBeLessThanOrEqual(standardViewport.w - 16);
      expect(result.y + result.height).toBeLessThanOrEqual(standardViewport.h - 16);
    }
  });

  it("clamps width and height when viewport is smaller than popover plus margins", () => {
    const tinyViewport = { w: 280, h: 200 };
    const result = computePopoverPlacement({
      anchorRect: null,
      popoverSize: { w: 320, h: 250 },
      viewport: tinyViewport,
      margin: 16,
    });

    expect(result.width).toBe(tinyViewport.w - 32);
    expect(result.height).toBe(tinyViewport.h - 32);
    expect(result.x).toBe(16);
    expect(result.y).toBe(16);
    expect(result.x + result.width).toBe(tinyViewport.w - 16);
    expect(result.y + result.height).toBe(tinyViewport.h - 16);
  });

  describe("composer collision avoidance", () => {
    const composerRect: Rect = { x: 200, y: 680, w: 800, h: 90 };

    it("rejects below placement and flips to above when below would cover composer", () => {
      // Anchor right above composer
      const anchorRect: Rect = { x: 300, y: 620, w: 100, h: 30 };
      const result = computePopoverPlacement({
        anchorRect,
        popoverSize: standardCardSize,
        viewport: standardViewport,
        preferredPlacement: "below",
        composerRect,
        isComposerTarget: false,
        margin: 16,
      });

      expect(result.placement).toBe("above");
      const popoverRect: Rect = { x: result.x, y: result.y, w: result.width, h: result.height };
      expect(rectsIntersect(popoverRect, composerRect)).toBe(false);
      expect(result.y + result.height).toBeLessThanOrEqual(composerRect.y);
    });

    it("allows placing on or above composer when step targets composer", () => {
      const result = computePopoverPlacement({
        anchorRect: composerRect,
        popoverSize: standardCardSize,
        viewport: standardViewport,
        preferredPlacement: "above",
        composerRect,
        isComposerTarget: true,
        margin: 16,
      });

      expect(result.placement).toBe("above");
      expect(result.y).toBe(composerRect.y - gap - result.height);
    });

    it("falls back to centered in safe zone without covering composer", () => {
      const anchorFillingMiddle: Rect = { x: 100, y: 100, w: 1000, h: 550 };
      const result = computePopoverPlacement({
        anchorRect: anchorFillingMiddle,
        popoverSize: standardCardSize,
        viewport: standardViewport,
        composerRect,
        isComposerTarget: false,
        margin: 16,
      });

      const popoverRect: Rect = { x: result.x, y: result.y, w: result.width, h: result.height };
      expect(rectsIntersect(popoverRect, composerRect)).toBe(false);
      expect(result.x).toBeGreaterThanOrEqual(16);
      expect(result.y).toBeGreaterThanOrEqual(16);
    });
  });

  it("handles null anchor by centering in viewport", () => {
    const result = computePopoverPlacement({
      anchorRect: null,
      popoverSize: standardCardSize,
      viewport: standardViewport,
      margin: 16,
    });

    expect(result.placement).toBe("centered");
    expect(result.x).toBe(16 + (standardViewport.w - 32 - standardCardSize.w) / 2);
    expect(result.y).toBe(16 + (standardViewport.h - 32 - standardCardSize.h) / 2);
    expect(result.transform).toBe(`translate3d(${result.x}px, ${result.y}px, 0)`);
  });

  it("computes safe max placement height fitting within viewport bounds", () => {
    const smallHeightViewport = { w: 1000, h: 300 };
    const tallPopover = { w: 320, h: 400 };
    const result = computePopoverPlacement({
      anchorRect: null,
      popoverSize: tallPopover,
      viewport: smallHeightViewport,
      margin: 16,
    });

    expect(result.height).toBe(smallHeightViewport.h - 32);
    expect(result.y).toBe(16);
    expect(result.y + result.height).toBeLessThanOrEqual(smallHeightViewport.h - 16);
  });
});
