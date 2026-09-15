import { useCallback, useEffect, useRef, useState } from "react";

const PRELOADER_WORDS = ["make", "ai", "work", "yours."];
const MOTION_DURATION_MS = 2_300;
const REDUCED_MOTION_DURATION_MS = 700;
const FADE_DURATION_MS = 320;
const HARD_STOP_MS = 3_100;

let hasArrived = false;

export function LandingPreloader() {
  const [visible, setVisible] = useState(() => !hasArrived);
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    hasArrived = true;
    setLeaving(true);
    window.setTimeout(() => setVisible(false), FADE_DURATION_MS);
  }, []);

  useEffect(() => {
    if (!visible) return;

    hasArrived = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cycleTimer = window.setTimeout(
      finish,
      reducedMotion ? REDUCED_MOTION_DURATION_MS : MOTION_DURATION_MS,
    );
    const hardStopTimer = window.setTimeout(finish, HARD_STOP_MS);
    const skip = () => finish();

    window.addEventListener("pointerdown", skip, { once: true });
    window.addEventListener("keydown", skip, { once: true });
    window.addEventListener("wheel", skip, { once: true, passive: true });

    return () => {
      window.clearTimeout(cycleTimer);
      window.clearTimeout(hardStopTimer);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("wheel", skip);
      document.body.style.overflow = previousOverflow;
    };
  }, [finish, visible]);

  if (!visible) return null;

  return (
    <div
      className="landing-preloader"
      data-leaving={leaving || undefined}
      role="status"
      aria-label="Opening Kind Meitner"
    >
      <p className="preloader-brand">kind meitner</p>
      <div className="preloader-stage" aria-hidden="true">
        <p className="preloader-line">
          {PRELOADER_WORDS.map((word, index) => (
            <span
              key={word}
              className={index === 1 ? "preloader-impact-word" : undefined}
              style={{ "--preloader-index": index } as React.CSSProperties}
            >
              {word}
            </span>
          ))}
        </p>
        <div className="preloader-burst">
          {Array.from({ length: 12 }, (_, index) => (
            <i key={index} style={{ "--ray-index": index } as React.CSSProperties} />
          ))}
        </div>
      </div>
      <p className="preloader-skip">tap, click, or scroll to skip</p>
    </div>
  );
}
