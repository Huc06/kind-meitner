export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Placement = "below" | "above" | "left" | "right" | "centered";

export interface PopoverPlacementOptions {
  anchorRect: Rect | null;
  popoverSize: { w: number; h: number };
  viewport: { w: number; h: number };
  preferredPlacement?: "below" | "above" | "left" | "right";
  composerRect?: Rect | null;
  isComposerTarget?: boolean;
  margin?: number;
  gap?: number;
}

export interface PopoverPlacementResult {
  x: number;
  y: number;
  width: number;
  height: number;
  placement: Placement;
  transform: string;
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Pure function to compute anchored popover placement with collision detection.
 * Guarantees the popover remains >= margin (default 16px) from all viewport edges,
 * and never covers the composer unless the target is the composer itself.
 */
export function computePopoverPlacement(options: PopoverPlacementOptions): PopoverPlacementResult {
  const {
    anchorRect,
    popoverSize,
    viewport,
    preferredPlacement = "below",
    composerRect = null,
    isComposerTarget = false,
    margin = 16,
    gap = 12,
  } = options;

  // Viewport bounds accounting for safe margins
  const minX = margin;
  const maxX = Math.max(minX, viewport.w - margin);
  const minY = margin;
  const maxY = Math.max(minY, viewport.h - margin);

  // Popover dimensions clamped to available safe viewport space
  const width = Math.min(popoverSize.w, Math.max(0, maxX - minX));
  const height = Math.min(popoverSize.h, Math.max(0, maxY - minY));

  const shouldAvoidComposer = Boolean(!isComposerTarget && composerRect);

  const checkCandidate = (x: number, y: number, placement: Placement): PopoverPlacementResult | null => {
    // Check viewport boundaries
    if (x < minX || x + width > maxX || y < minY || y + height > maxY) {
      return null;
    }
    const popoverRect: Rect = { x, y, w: width, h: height };
    if (shouldAvoidComposer && composerRect && rectsIntersect(popoverRect, composerRect)) {
      return null;
    }
    return {
      x,
      y,
      width,
      height,
      placement,
      transform: `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`,
    };
  };

  if (anchorRect) {
    const isFullScreenAnchor =
      anchorRect.w >= viewport.w * 0.75 && anchorRect.h >= viewport.h * 0.75;

    if (!isFullScreenAnchor) {
      // Determine candidate placement order
      const candidateOrder: Array<"below" | "above" | "left" | "right"> = [];
      if (preferredPlacement === "below") {
        candidateOrder.push("below", "above", "right", "left");
      } else if (preferredPlacement === "above") {
        candidateOrder.push("above", "below", "right", "left");
      } else if (preferredPlacement === "right") {
        candidateOrder.push("right", "left", "below", "above");
      } else {
        candidateOrder.push("left", "right", "below", "above");
      }

      for (const candidate of candidateOrder) {
        let candX = minX;
        let candY = minY;

        if (candidate === "below") {
          candY = anchorRect.y + anchorRect.h + gap;
          candX = Math.max(minX, Math.min(anchorRect.x, maxX - width));
        } else if (candidate === "above") {
          candY = anchorRect.y - gap - height;
          candX = Math.max(minX, Math.min(anchorRect.x, maxX - width));
        } else if (candidate === "right") {
          candX = anchorRect.x + anchorRect.w + gap;
          candY = Math.max(minY, Math.min(anchorRect.y + (anchorRect.h - height) / 2, maxY - height));
        } else if (candidate === "left") {
          candX = anchorRect.x - gap - width;
          candY = Math.max(minY, Math.min(anchorRect.y + (anchorRect.h - height) / 2, maxY - height));
        }

        const valid = checkCandidate(candX, candY, candidate);
        if (valid) return valid;
      }
    } else {
      // Fullscreen anchor (e.g. modal panel): sit inside anchor, top-right
      const candX = Math.max(minX, Math.min(anchorRect.x + anchorRect.w - width - gap * 2, maxX - width));
      const candY = Math.max(minY, Math.min(anchorRect.y + gap * 2, maxY - height));
      const valid = checkCandidate(candX, candY, "below");
      if (valid) return valid;
    }
  }

  // Fallback: centered
  let centerX = minX + Math.max(0, (maxX - minX - width) / 2);
  let centerY = minY + Math.max(0, (maxY - minY - height) / 2);

  // If avoiding composer and centered overlaps it, push above composer if room permits
  if (shouldAvoidComposer && composerRect) {
    const candidateCentered: Rect = { x: centerX, y: centerY, w: width, h: height };
    if (rectsIntersect(candidateCentered, composerRect)) {
      const roomAboveComposer = composerRect.y - gap - minY;
      if (roomAboveComposer >= height) {
        centerY = minY + (roomAboveComposer - height) / 2;
      } else if (composerRect.y - gap - height >= minY) {
        centerY = composerRect.y - gap - height;
      }
    }
  }

  // Final clamp to guarantee safe margins
  const finalX = Math.max(minX, Math.min(centerX, Math.max(minX, maxX - width)));
  const finalY = Math.max(minY, Math.min(centerY, Math.max(minY, maxY - height)));

  return {
    x: finalX,
    y: finalY,
    width,
    height,
    placement: "centered",
    transform: `translate3d(${Math.round(finalX)}px, ${Math.round(finalY)}px, 0)`,
  };
}
