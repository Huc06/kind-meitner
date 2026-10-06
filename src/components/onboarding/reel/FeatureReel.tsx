import { useEffect, useState } from "react";
import { withViewTransition } from "../view-transition";
import { t } from "@/lib/i18n";
import type { LocaleKey } from "@/locales";
import { PrimaryButton, staggerIndex, type BeatProps } from "../beats/shared";
import { REEL, sceneFor } from "./scenes";
import { cn } from "@/lib/cn";

function copyKey(id: string, part: "title" | "body"): LocaleKey {
  return `onboarding.reel.${id}.${part}` as LocaleKey;
}

export function FeatureReel({
  onNext,
  setMascot,
  onSceneChange,
  actionLabel,
}: BeatProps & {
  onSceneChange?: (index: number) => void;
  actionLabel?: string;
}) {
  const ids = REEL;
  const [index, setIndex] = useState(0);
  const id = ids[index] ?? ids[0];
  const last = index >= ids.length - 1;
  const Scene = sceneFor(id);
  if (!Scene) return null;

  useEffect(() => {
    onSceneChange?.(index);
  }, [index, onSceneChange]);

  const advance = () => {
    if (last) return;
    withViewTransition(() => setIndex(index + 1));
  };
  const back = () => {
    if (index <= 0) return;
    withViewTransition(() => setIndex(index - 1));
  };
  const jumpTo = (target: number) => {
    withViewTransition(() => setIndex(target));
  };

  useEffect(() => {
    const card = document.querySelector<HTMLElement>(".welcome-card");
    if (card) card.scrollTop = 0;
  }, [index]);

  return (
    <div className="stagger flex min-h-0 flex-col">
      <div key={id} className="animate-rise mt-4 aspect-[8/5] w-full overflow-hidden border border-hairline bg-inset">
        <Scene playing label={t(copyKey(id, "title"))} onEnded={advance} onCue={setMascot} />
      </div>
      <div key={`${id}-copy`} className="animate-rise mt-4" style={staggerIndex(1)}>
        <h2 className="text-[17px] font-semibold text-ink">{t(copyKey(id, "title"))}</h2>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-secondary">{t(copyKey(id, "body"))}</p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        {index > 0 ? (
          <button
            type="button"
            onClick={back}
            className="border border-hairline bg-panel px-3 py-1.5 font-mono text-[12px] text-ink-secondary hover:text-ink transition-colors"
          >
            {t("onboarding.back")}
          </button>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-1.5">
          {ids.map((sceneId, i) => (
            <button
              key={sceneId}
              type="button"
              aria-label={`Scene ${i + 1}`}
              onClick={() => jumpTo(i)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === index ? "w-5 bg-accent" : "w-1.5 bg-hairline hover:bg-ink-secondary",
              )}
            />
          ))}
        </div>

        <PrimaryButton onClick={last ? onNext : advance} className="w-auto shrink-0 px-4">
          {last ? (actionLabel ?? t("onboarding.continue")) : t("onboarding.reel.next")}
        </PrimaryButton>
      </div>
    </div>
  );
}
