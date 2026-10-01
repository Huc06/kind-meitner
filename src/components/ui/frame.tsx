import type { ElementType, HTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";

/** The surface a frame sits on. The title and corner marks paint this colour
 * behind themselves to notch the dashed edge, so it must match the ground the
 * frame is placed on — not the frame's own fill. */
export type FrameSurface = "app" | "panel" | "card" | "inset" | "menu" | "raised";

const SURFACE_VAR: Record<FrameSurface, string> = {
  app: "var(--color-app)",
  panel: "var(--color-panel)",
  card: "var(--color-card)",
  inset: "var(--color-inset)",
  menu: "var(--color-menu)",
  raised: "var(--color-raised)",
};

/** Any HTML attribute passes through to the rendered element (handlers,
 * `tabIndex`, `data-*`, aria), so a frame can be the interactive element
 * itself rather than wrap one. `title` is the notched label, not a tooltip. */
export interface FrameProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  as?: ElementType;
  /** Bracketed label notched into the top edge: `[ 01 · READINESS ]`. */
  title?: ReactNode;
  /** Two-digit index printed before the title. */
  index?: string | number;
  /** Ground under the frame; drives the notch colour. Defaults to `app`. */
  surface?: FrameSurface;
  /** Corner marks. On by default; turn off for dense lists of frames. */
  corners?: boolean;
  /** Solid hairline instead of the dash — for inputs and anything the eye
   * must read as one closed box. */
  solid?: boolean;
  ref?: Ref<HTMLElement>;
}

/** Nymspace's framed surface: a 1px dashed edge (2px on / 5px off), corner
 * marks, and an optional bracketed title that notches the top edge. The
 * frame paints no fill of its own — pass a `bg-*` class when it needs one. */
export function Frame({
  as: Component = "div",
  title,
  index,
  surface = "app",
  corners = true,
  solid = false,
  className,
  style,
  children,
  ...rest
}: FrameProps) {
  const hasTitle = title !== undefined && title !== null && title !== false;
  return (
    <Component
      {...rest}
      className={cn(
        "relative",
        solid ? "border border-hairline" : "frame-edge",
        hasTitle && "mt-2",
        className,
      )}
      style={{ ...style, ["--frame-surface" as string]: SURFACE_VAR[surface] }}
    >
      {hasTitle && (
        <span className="frame-title">
          [ {index !== undefined && <span className="text-ink">{formatIndex(index)} · </span>}
          {title} ]
        </span>
      )}
      {corners && (
        <>
          <span aria-hidden className="frame-corner" data-corner="tl" />
          <span aria-hidden className="frame-corner" data-corner="tr" />
          <span aria-hidden className="frame-corner" data-corner="bl" />
          <span aria-hidden className="frame-corner" data-corner="br" />
        </>
      )}
      {children}
    </Component>
  );
}

export function formatIndex(index: string | number): string {
  return typeof index === "number" ? String(index).padStart(2, "0") : index;
}
