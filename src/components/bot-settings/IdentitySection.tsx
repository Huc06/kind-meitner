// Identity: avatar, name, title, and the short blurb every roster and the
// phone show. Long standing instructions belong in Soul (SoulSection) —
// this section only keeps the "View full" dialog for the blurb itself.
// Moved out of SettingsPanel.tsx (its header, avatar card, Name, Title,
// and Instructions block) with only the label and helper text changed.
import { useState } from "react";
import { BookOpen } from "lucide-react";

import type { Bot } from "@/state/store";
import type { MausMotion, MausState } from "@/lib/mascot";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { fieldClass, FieldLabel } from "@/components/ui/field";
import { BOT_PROFILE_LIMITS } from "../../../shared/bot-profile";
import { BotProfileAvatarCard } from "../BotProfileAvatarCard";
import { BotInstructionsDialog } from "../BotInstructionsDialog";
import type { BotPatch } from "./useBotSettingsDerived";
export function IdentitySection({
  bot,
  patch,
  activeState,
  mascotMotion,
}: {
  bot: Bot;
  patch: (patch: BotPatch) => void;
  activeState: MausState;
  mascotMotion: { kind: Exclude<MausMotion, "none">; nonce: number } | null;
}) {
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <BotProfileAvatarCard bot={bot} activeState={activeState} mascotMotion={mascotMotion} onPatch={patch} />

      <label className="block">
        <FieldLabel>Name</FieldLabel>
        <input
          className={cn(fieldClass, "h-9")}
          maxLength={BOT_PROFILE_LIMITS.name}
          value={bot.name}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </label>

      <label className="block">
        <FieldLabel>Title</FieldLabel>
        <input
          className={cn(fieldClass, "h-9")}
          maxLength={BOT_PROFILE_LIMITS.title}
          placeholder="Describe what your agent does"
          value={bot.title}
          onChange={(e) => patch({ title: e.target.value })}
        />
      </label>

      <div className="block">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <FieldLabel htmlFor={`bot-instructions-${bot.id}`} className="mb-0">
            Blurb
          </FieldLabel>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setInstructionsOpen(true)}
          >
            <BookOpen size={12} /> View full
          </Button>
        </div>
        <textarea
          id={`bot-instructions-${bot.id}`}
          className={cn(fieldClass, "min-h-[72px] resize-y leading-relaxed")}
          maxLength={BOT_PROFILE_LIMITS.description}
          placeholder="One line on what this bot is for"
          aria-label="Blurb"
          value={bot.description}
          onChange={(e) => patch({ description: e.target.value })}
        />
        <div className="mt-1.5 flex items-start justify-between gap-3 text-[11px] text-ink-secondary">
          <span>Shown in rosters, on the phone, and to other bots. Standing instructions belong in Soul, which has room for a full document.</span>
          {/* The cap only matters when someone is near it; a counter under a
              one-line field otherwise reads as an invitation to fill it. */}
          {bot.description.length > 3_000 && (
            <span className="shrink-0 font-mono tabular-nums text-[10.5px]">
              {bot.description.length.toLocaleString()} / {BOT_PROFILE_LIMITS.description.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {instructionsOpen && <BotInstructionsDialog bot={bot} onClose={() => setInstructionsOpen(false)} />}
    </div>
  );
}
