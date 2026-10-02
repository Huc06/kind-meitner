// A spotlight on a live element: the window dims except for a cutout around
// the anchor, and a small card with the guide sits beside it. The anchor is
// found by its `data-tour` id, never by a class name, so refactors cannot
// silently break the tour. The dim layer takes no pointer events, so the
// user can keep working (typing, clicking the control) while it is up; the
// control inside the cutout is what the step usually asks them to press.
//
// Motion: on first mount the cutout eases from the full window down to the
// anchor and the card scales in from the anchor's side. When the anchor
// changes (the next tour step) the component stays mounted, so the cutout
// and the card slide to the new control instead of dimming everything
// again. Under reduced motion everything simply appears. With no anchor
// the card sits centred over the dimmed window.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { AgentMark } from "@/components/agent-identity/AgentMark";
import type { BotIdentityLike } from "@/lib/agent-identity";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import type { MausState } from "@/lib/mascot";
import { reducedMotion } from "@/lib/onboarding";
import { computePopoverPlacement, type Rect } from "@/lib/popover-placement";

const PAD = 8;
const CARD_W = 320;
const CARD_ESTIMATED_H = 170;

function measure(anchor: string): Rect | null {
  const all = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-tour="${anchor}"]`),
  ).filter((el) => el.getClientRects().length > 0);
  // the newest visible match: a second approval card is the one to explain
  const el = all[all.length - 1];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0 || r.right <= 0 || r.left >= window.innerWidth || r.bottom <= 0 || r.top >= window.innerHeight) return null;
  return {
    x: r.left - PAD,
    y: r.top - PAD,
    w: r.width + PAD * 2,
    h: r.height + PAD * 2,
  };
}

function measureRaw(anchor: string): Rect | null {
  const all = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-tour="${anchor}"]`),
  ).filter((el) => el.getClientRects().length > 0);
  const el = all[all.length - 1];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/** An even-odd polygon: the whole viewport minus the anchor's rectangle. */
function cutout(r: Rect | null): string {
  if (!r) return "polygon(0 0, 100% 0, 100% 100%, 0 100%)";
  const x1 = r.x,
    y1 = r.y,
    x2 = r.x + r.w,
    y2 = r.y + r.h;
  return `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${x1}px ${y1}px, ${x1}px ${y2}px, ${x2}px ${y2}px, ${x2}px ${y1}px, ${x1}px ${y1}px)`;
}

interface Action {
  label: string;
  onClick: () => void;
}

export function Spotlight({
  anchor,
  placement,
  mascot: _mascot = "curious",
  bot,
  title,
  children,
  progress,
  primary,
  secondary,
  onDone,
  modal = true,
}: {
  anchor: string | null;
  placement: "above" | "below" | "right";
  mascot?: MausState;
  bot?: BotIdentityLike | null;
  title?: ReactNode;
  children: ReactNode;
  /** "Step 2 of 6", shown small under the text. */
  progress?: string;
  /** The filled button; omit when the step ends by the user's own action. */
  primary?: Action;
  /** The quiet button, usually Skip. */
  secondary?: Action;
  /** Escape or close button. */
  onDone: () => void;
  /** Whether this spotlight is a modal dialog. Nonmodal hints do not steal focus. */
  modal?: boolean;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [composerRect, setComposerRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1024,
    h: typeof window !== "undefined" ? window.innerHeight : 768,
  }));
  const [settled, setSettled] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardHeight, setCardHeight] = useState(CARD_ESTIMATED_H);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousActiveElement.current = (document.activeElement as HTMLElement) ?? null;
    return () => {
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === "function") {
        try {
          previousActiveElement.current.focus();
        } catch {}
      }
    };
  }, []);


  // Follow the anchor: layout, scroll, resize, and the anchor's own size.
  useLayoutEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (anchor) setRect((prev) => measure(anchor) ?? prev);
        else setRect(null);
        setComposerRect(measureRaw("composer"));
        setViewport({ w: window.innerWidth, h: window.innerHeight });
        if (cardRef.current) {
          const h = cardRef.current.getBoundingClientRect().height;
          if (h > 0) setCardHeight(h);
        }
      });
    };
    update();
    const el = anchor ? document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`) : null;
    const ro = el ? new ResizeObserver(update) : null;
    if (el) ro?.observe(el);
    const mo = new MutationObserver(update);
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(frame);
      ro?.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchor]);

  // first paint at the full window, next frame at the anchor
  useEffect(() => {
    if (reducedMotion()) {
      setSettled(true);
      return;
    }
    const frame = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Keyboard navigation: Escape closes, Tab is trapped inside the card
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onDone();
        return;
      }
      if (e.key === "Tab") {
        if (!modal) return;
        const card = cardRef.current;
        if (!card) return;
        const focusable = card.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable.length) {
          e.preventDefault();
          card.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first || !card.contains(document.activeElement)) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last || !card.contains(document.activeElement)) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, onDone]);

  // Auto-focus primary action or close button on mount / anchor change
  // Auto-focus primary action or close button on mount / anchor change (modal only)
  useEffect(() => {
    if (!modal) return;
    const timer = setTimeout(() => {
      const card = cardRef.current;
      if (!card) return;
      const target = card.querySelector<HTMLElement>("[data-primary-action]") ?? card.querySelector<HTMLElement>("button");
      target?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [anchor, modal]);

  // an anchored step whose control is not on screen yet shows nothing
  if (anchor && !rect) return null;

  const cardWidth = Math.min(CARD_W, viewport.w - 32);
  const isComposerTarget = anchor === "composer";

  const placementResult = computePopoverPlacement({
    anchorRect: rect,
    popoverSize: { w: cardWidth, h: cardHeight },
    viewport,
    preferredPlacement: placement,
    composerRect,
    isComposerTarget,
    margin: 16,
    gap: 12,
  });

  const originClass =
    placementResult.placement === "below"
      ? "origin-top-left"
      : placementResult.placement === "above"
        ? "origin-bottom-left"
        : placementResult.placement === "right"
          ? "origin-left"
          : placementResult.placement === "left"
            ? "origin-right"
            : "origin-center";

  const content = (
    <div
      className="pointer-events-none fixed inset-0 z-[60]"
      aria-live="polite"
    >
      <div
        className="absolute inset-0 bg-black/55 transition-[clip-path] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ clipPath: cutout(settled ? rect : null) }}
        aria-hidden="true"
      />
      {rect && (
        <div
          className="absolute border border-accent transition-opacity duration-300"
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.w,
            height: rect.h,
            opacity: settled ? 1 : 0,
          }}
          aria-hidden="true"
        />
      )}
      <div
        ref={cardRef}
        data-tour-card
        className="pointer-events-auto absolute left-0 top-0 transition-transform duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{
          transform: placementResult.transform,
          width: placementResult.width,
          maxHeight: placementResult.height,
        }}
      >
        <div
          role={modal ? "dialog" : "status"}
          aria-modal={modal ? "true" : undefined}
          className={cn(
            "relative flex items-start gap-3 border border-hairline bg-panel p-3.5 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.6)] overflow-y-auto",
            originClass,
            settled ? "animate-spot-in motion-reduce:animate-none" : "opacity-0",
          )}
          style={{ maxHeight: placementResult.height }}
        >
          <span aria-hidden className="frame-corner" data-corner="tl" />
          <span aria-hidden className="frame-corner" data-corner="tr" />
          <span aria-hidden className="frame-corner" data-corner="bl" />
          <span aria-hidden className="frame-corner" data-corner="br" />
          <div className="shrink-0">
            <AgentMark
              bot={bot ?? { id: "okx-guide", name: "OKX", okxImport: { kind: "okx-catalog", catalogAvatar: "chart" } }}
              size={38}
            />
          </div>
          <div
            key={anchor ?? "centre"}
            className="min-w-0 flex-1 animate-rise motion-reduce:animate-none"
          >
            <div className="flex items-start justify-between gap-2">
              {title ? (
                <h2 className="font-semibold text-[13.5px] leading-tight text-ink mb-1">
                  {title}
                </h2>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={onDone}
                aria-label={t("onboarding.tour.close") || "Close"}
                title={t("onboarding.tour.close") || "Close"}
                className="cursor-pointer -mr-1 -mt-1 p-1 text-ink-secondary hover:bg-raised-hover hover:text-ink focus-visible:outline-none"
              >
                <X size={15} />
              </button>
            </div>
            <div className="text-[13px] leading-relaxed text-ink-secondary">
              {children}
            </div>
            <div className="mt-3 flex items-center gap-3">
              {primary && (
                <Button
                  data-primary-action
                  variant="primary"
                  size="sm"
                  autoFocus
                  onClick={primary.onClick}
                >
                  {primary.label}
                </Button>
              )}
              {progress && (
                <span className="font-mono text-[11px] tabular-nums text-ink-secondary">
                  {progress}
                </span>
              )}
              {secondary && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={secondary.onClick}
                  className="ml-auto"
                >
                  {secondary.label}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return content;
  }

  return createPortal(content, document.body);
}
