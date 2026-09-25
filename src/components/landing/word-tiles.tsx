import * as React from "react";
import { cn } from "@/lib/cn";

export type Swatch = { bg: string; fg: string };

const SWATCHES: Swatch[] = [
  { bg: "var(--tile-neutral-bg, #0a0a0a)", fg: "var(--tile-neutral-fg, #ffffff)" },
  { bg: "#ff2e20", fg: "#0a0a0a" },
  { bg: "#f0c2f7", fg: "#0a0a0a" },
  { bg: "#22e58b", fg: "#0a0a0a" },
  { bg: "#7c4dff", fg: "#ffffff" },
  { bg: "#ffe14d", fg: "#0a0a0a" },
  { bg: "#18b6ff", fg: "#0a0a0a" },
  { bg: "#ff7a1a", fg: "#0a0a0a" },
  { bg: "#ff4fa3", fg: "#0a0a0a" },
];

const INITIAL = [0, 1, 2, 3, 4, 5, 6, 7, 8];

const FLY_STAGGER = 120;
const FLY_MS = 720;
const COLOR_MS = 520;
const SHUFFLE_MIN = 1400;
const SHUFFLE_MAX = 3400;

const nextDelay = () =>
  SHUFFLE_MIN + Math.random() * (SHUFFLE_MAX - SHUFFLE_MIN);

function pickSwatch(exclude: (Swatch | undefined)[]): Swatch {
  const free = SWATCHES.filter((s) => !exclude.includes(s));
  const pool = free.length ? free : SWATCHES;
  return pool[(Math.random() * pool.length) | 0];
}

export function WordTiles({
  sentence,
  className,
  ...props
}: React.ComponentProps<"div"> & { sentence: string }) {
  const words = React.useMemo(
    () => sentence.trim().split(/\s+/).filter(Boolean),
    [sentence],
  );

  const tileRefs = React.useRef<(HTMLSpanElement | null)[]>([]);
  const swatches = React.useRef<(Swatch | undefined)[]>([]);

  const reroll = React.useCallback((index: number) => {
    const el = tileRefs.current[index];
    if (!el) return;
    const swatch = pickSwatch([
      swatches.current[index],
      swatches.current[index - 1],
      swatches.current[index + 1],
    ]);
    swatches.current[index] = swatch;
    el.style.backgroundColor = swatch.bg;
    el.style.color = swatch.fg;
  }, []);

  React.useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const count = words.length;
    const assembledAt = performance.now() + count * FLY_STAGGER + FLY_MS;
    const nextAt = Array.from({ length: count }, () => assembledAt + nextDelay());

    let raf = 0;
    const loop = () => {
      const now = performance.now();
      for (let i = 0; i < count; i++) {
        if (now < nextAt[i]) continue;
        if (now - nextAt[i] > SHUFFLE_MAX) {
          nextAt[i] = now + nextDelay();
        } else {
          reroll(i);
          nextAt[i] = now + nextDelay();
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [words.length, reroll]);

  return (
    <div
      data-slot="word-tiles"
      aria-label={sentence}
      role="heading"
      aria-level={1}
      className={cn(
        "inline-flex max-w-full overflow-hidden rounded-2xl align-middle shadow-sm",
        "font-sans font-bold tracking-tight",
        "text-[clamp(1.75rem,5.6vw,3.6rem)] leading-none",
        className,
      )}
      {...props}
    >
      {words.map((word, i) => {
        const initial = SWATCHES[INITIAL[i % INITIAL.length]];
        return (
          <span
            key={`${word}-${i}`}
            ref={(el) => {
              tileRefs.current[i] = el;
              if (!swatches.current[i]) swatches.current[i] = initial;
            }}
            onPointerEnter={() => reroll(i)}
            aria-hidden
            className="shrink-0 px-[0.38em] py-[0.34em] transition-transform duration-200 hover:scale-105 select-none cursor-pointer"
            style={
              {
                "--tile-index": i,
                backgroundColor: initial.bg,
                color: initial.fg,
                transition: `background-color ${COLOR_MS}ms ease, color ${COLOR_MS}ms ease`,
              } as React.CSSProperties
            }
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

export default WordTiles;
