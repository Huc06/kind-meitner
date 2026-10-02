import { useEffect, useState } from "react";
import { Frame } from "@/components/ui/frame";
import { Tag } from "@/components/ui/tag";
import { t } from "@/lib/i18n";
import { reducedMotion } from "@/lib/onboarding";
import type { SceneProps } from "./types";

const TRUST_MS = 5200;

const NOT_CHECKED_KEYS = [
  "onboarding.reel.trust.notChecked.credit",
  "onboarding.reel.trust.notChecked.settlement",
  "onboarding.reel.trust.notChecked.endorsement",
] as const;

export function TrustScene({ playing, onCue, onEnded, label }: SceneProps) {
  const still = reducedMotion() || !playing;
  const [phase, setPhase] = useState<"eval" | "settled">(still ? "settled" : "eval");

  useEffect(() => {
    if (still) return;
    setPhase("eval");
    onCue?.("listening");

    const tSettled = setTimeout(() => {
      setPhase("settled");
      onCue?.("proud");
    }, 1200);

    const tEnd = setTimeout(() => onEnded?.(), TRUST_MS);

    return () => {
      clearTimeout(tSettled);
      clearTimeout(tEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, still]);

  const settled = phase === "settled";

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-inset p-3 sm:p-4"
      role="img"
      aria-label={label}
    >
      <Frame
        as="section"
        title={t("onboarding.reel.trust.title")}
        index="02"
        surface="inset"
        className="w-full max-w-[500px] bg-card p-3 sm:p-3.5 shadow-sm"
      >
        <div className="flex items-start gap-2.5">
          <Tag tone={settled ? "danger" : "warning"} variant="solid" size="md">
            {settled ? "NO-GO" : "CHECK"}
          </Tag>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <h3 className="text-[12px] font-semibold text-ink truncate">
                  Pre-spend trust check
                </h3>
                <span className="font-mono text-[10px] text-ink-secondary">Agent #99999</span>
              </div>
              <span className="border border-hairline bg-inset px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-ink-secondary shrink-0">
                {t("onboarding.reel.example")}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px]">
              <span className="size-1.5 rounded-full bg-danger shrink-0" />
              <span className="font-medium text-danger">{t("okxGate.trust.spendBlocked")}</span>
            </div>
            <p className="mt-0.5 text-[10.5px] leading-tight text-ink-secondary truncate">
              {t("onboarding.reel.trust.summary")}
            </p>
          </div>
        </div>

        <div className="frame-rule my-2" />

        {/* Evidence / Signals */}
        <ul className="space-y-1 font-mono text-[10.5px]">
          <li className="flex items-start gap-2 text-[11px] leading-tight">
            <span aria-hidden="true" className="w-3 shrink-0 font-bold text-danger">
              ✕
            </span>
            <span className="min-w-0 text-ink-secondary">
              <span className="font-medium text-ink">{t("onboarding.reel.trust.listing")}</span> · HTTP 404
            </span>
            <span className="uppercase text-[9px] font-semibold text-danger ml-auto shrink-0">fail</span>
          </li>
          <li className="flex items-start gap-2 text-[11px] leading-tight">
            <span aria-hidden="true" className="w-3 shrink-0 font-bold text-warning">
              !
            </span>
            <span className="min-w-0 text-ink-secondary">
              {t("onboarding.reel.trust.endpoint")}
            </span>
            <span className="uppercase text-[9px] font-semibold text-warning ml-auto shrink-0">warn</span>
          </li>
        </ul>

        <div className="frame-rule my-2" />

        {/* Missing info / Not checked */}
        <div>
          <h4 className="label-mono text-[9.5px] text-ink-secondary mb-1">
            {t("okxGate.trust.notChecked")}
          </h4>
          <div className="flex flex-wrap gap-1">
            {NOT_CHECKED_KEYS.map((key) => (
              <Tag key={key} tone="neutral" variant="outline" size="sm" className="text-[9px] py-0 px-1.5">
                {t(key)}
              </Tag>
            ))}
          </div>
        </div>

        <div className="frame-rule my-2" />

        {/* Safe next step */}
        <div>
          <p className="text-[10.5px] leading-tight text-ink">
            <span className="label-mono text-[9.5px] text-ink-secondary mr-1.5">{t("okxGate.trust.next")}</span>
            <span className="font-mono text-[10px]">{t("onboarding.reel.trust.next")}</span>
          </p>
        </div>

        <div className="frame-rule my-2" />

        {/* Disclaimer */}
        <p className="font-mono text-[9.5px] leading-normal text-ink-secondary">
          {t("okxGate.trust.disclaimer")}
        </p>
      </Frame>
    </div>
  );
}
