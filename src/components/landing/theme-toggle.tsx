"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { readSkin, applySkin, type SkinId } from "@/lib/skins";

export interface ThemeToggleProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  className?: string;
}

/**
 * Tactile 12-pin console theme toggle.
 * Flips the app skin between midnight (Nymspace) and daylight (Nymspace Paper)
 * using readSkin / applySkin from @/lib/skins.
 */
export function ThemeToggle({
  checked: controlledChecked,
  onChange,
  className = "",
}: ThemeToggleProps) {
  const [skin, setSkin] = useState<SkinId>(() =>
    typeof window !== "undefined" ? readSkin() : "midnight"
  );

  useEffect(() => {
    const sync = () => {
      setSkin(readSkin());
    };
    sync();

    const observer = new MutationObserver(() => {
      sync();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-skin"],
    });
    return () => observer.disconnect();
  }, []);

  const isDaylight =
    controlledChecked !== undefined ? controlledChecked : skin === "daylight";

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextChecked = event.target.checked;
    const nextSkin: SkinId = nextChecked ? "daylight" : "midnight";
    applySkin(nextSkin);
    setSkin(nextSkin);
    onChange?.(nextChecked);
  };

  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      <span className="label-mono text-ink-secondary hidden sm:inline-block">
        {isDaylight ? "PAPER" : "NYMSPACE"}
      </span>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          aria-label={
            isDaylight
              ? "Switch to Midnight console dark skin"
              : "Switch to Daylight console paper skin"
          }
          checked={isDaylight}
          onChange={handleChange}
          className="peer sr-only"
        />
        {/* Chassis: square, token border and inset ground */}
        <div className="relative h-6 w-12 border border-hairline bg-inset transition-colors duration-150">
          {/* Tactile button knob with 12 pins */}
          <div
            className={`absolute top-[2px] left-[2px] flex h-[18px] w-[20px] items-center justify-center border border-hairline bg-raised text-ink transition-transform duration-200 ease-out [will-change:transform] motion-reduce:duration-100 ${
              isDaylight ? "translate-x-6" : "translate-x-0"
            }`}
            data-toggle-button
          >
            {/* 12-pin tactile contact grid (4 cols x 3 rows) */}
            <div className="grid grid-cols-4 gap-[2px]">
              {Array.from({ length: 12 }).map((_, index) => (
                <div
                  key={index}
                  className="size-[2px] rounded-full bg-ink-secondary/70"
                />
              ))}
            </div>
          </div>
        </div>
      </label>
    </div>
  );
}

export default ThemeToggle;
