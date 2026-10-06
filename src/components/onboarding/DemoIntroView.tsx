import { useCallback, useState } from "react";
import { AgentMark } from "@/components/agent-identity/AgentMark";
import { brand } from "@/lib/brand";
import { t } from "@/lib/i18n";
import { formatIndex } from "@/components/ui/frame";
import { FeatureReel } from "./reel/FeatureReel";
import { REEL } from "./reel/scenes";
import { RotateCcw } from "lucide-react";

export function DemoIntroView({
  onStart,
  onSkip,
  onExit,
}: {
  onStart: () => void;
  onSkip: () => void;
  onExit?: () => void;
  mode?: "demo" | "public";
}) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [reelKey, setReelKey] = useState(0);

  const handleReplay = useCallback(() => {
    setSceneIndex(0);
    setReelKey((k) => k + 1);
  }, []);

  const logo = brand().logo;
  const appName = brand().name;
  const isLast = sceneIndex >= REEL.length - 1;
  const handleExit = onExit ?? onSkip;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-app/95 p-3 sm:p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("onboarding.dialog")}
        className="welcome-card relative flex max-h-[calc(100dvh-24px)] w-full max-w-[720px] flex-col overflow-y-auto border border-hairline bg-panel p-4 sm:p-7 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.6)] outline-none"
      >
        <span aria-hidden className="frame-corner" data-corner="tl" />
        <span aria-hidden className="frame-corner" data-corner="tr" />
        <span aria-hidden className="frame-corner" data-corner="bl" />
        <span aria-hidden className="frame-corner" data-corner="br" />

        {/* Top bar */}
        <div className="mb-3 flex items-center justify-between">
          <span className="label-mono text-ink-secondary text-[11px]">
            [ {formatIndex(sceneIndex + 1)} / {formatIndex(REEL.length)} · {appName.toUpperCase()} ]
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReplay}
              title={t("onboarding.replayIntro")}
              className="flex items-center gap-1 font-mono text-[11px] text-ink-secondary hover:text-ink transition-colors px-2 py-0.5"
            >
              <RotateCcw size={12} />
              <span className="hidden sm:inline">{t("onboarding.replayIntro")}</span>
            </button>
            <button
              type="button"
              onClick={handleExit}
              className="font-mono text-[11px] text-ink-secondary hover:text-ink transition-colors px-2 py-0.5"
            >
              {t("onboarding.skipIntro")}
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="welcome-maus flex shrink-0">
            {logo ? (
              <img src={logo} alt="" width={40} height={40} className="h-10 w-10 object-contain" />
            ) : (
              <AgentMark
                bot={{ id: "kind-meitner", name: appName }}
                size={40}
                label={appName}
              />
            )}
          </div>
          <div>
            <h1 className="welcome-title text-[18px] sm:text-[20px] font-semibold text-ink">
              {appName}
            </h1>
            <p className="text-[12px] text-ink-secondary">
              Product demonstration &amp; workflow overview
            </p>
          </div>
        </div>

        {/* Reel */}
        <div key={reelKey} className="flex min-h-0 flex-col">
          <FeatureReel
            onNext={onStart}
            onSkip={onSkip}
            setMascot={() => {}}
            bump={() => {}}
            onSceneChange={setSceneIndex}
            actionLabel={t("onboarding.startWithTask")}
          />
        </div>

        {/* Footer controls */}
        {isLast && (
          <div className="mt-4 pt-3 border-t border-hairline/60 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-ink-secondary">
            <button
              type="button"
              onClick={handleReplay}
              className="hover:text-ink flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw size={12} /> {t("onboarding.replayIntro")}
            </button>
            <span>Next: Conversational workspace</span>
          </div>
        )}
      </div>
    </div>
  );
}
