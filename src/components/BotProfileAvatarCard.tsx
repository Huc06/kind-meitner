import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

import { api, useStore, type Bot } from "@/state/store";
import { imageAttachmentFromFile } from "@/lib/composer-attachments";
import { cn } from "@/lib/cn";
import {
  PICKABLE_STATES,
  MAUS_COLORS,
  MAUS_COLOR_NAMES,
  type MausMotion,
  type MausState,
} from "@/lib/mascot";
import {
  BOT_AVATAR_CROPS,
  botAvatarUrlFromStoredPath,
  type BotAvatarCrop,
} from "../../shared/bot-avatar";
import { MASCOT_BODIES, MASCOT_BODY_IDS } from "../../shared/mascot-bodies";
import { Button } from "@/components/ui/button";
import { BotAvatar, MausAvatar } from "./Avatar";
import { AvatarImageGenerator } from "./AvatarImageGenerator";
type AvatarPatch = Partial<
  Pick<Bot, "avatarCrop" | "avatarUrl" | "color" | "mascotExpression" | "mascotBody">
>;

const CROP_LABEL = {
  mascot: "Mascot",
  circle: "Circle",
  rounded: "Rounded",
  square: "Square",
} satisfies Record<BotAvatarCrop, string>;

export function BotProfileAvatarCard({
  bot,
  activeState,
  mascotMotion,
  onPatch,
}: {
  bot: Bot;
  activeState: MausState;
  mascotMotion: { kind: Exclude<MausMotion, "none">; nonce: number } | null;
  onPatch: (patch: AvatarPatch) => void;
}) {
  const { flushBotPatches } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [savingConnection, setSavingConnection] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const crop = bot.avatarCrop ?? "mascot";
  const cropRef = useRef(crop);
  cropRef.current = crop;
  const busy = uploading || generating || savingConnection;

  const upload = async (file: File | undefined) => {
    if (!file || busy) return;
    setUploading(true);
    setError(null);
    try {
      const saved = await imageAttachmentFromFile(file);
      if (!saved) throw new Error("Choose a PNG, JPEG, GIF, or WebP image");
      const avatarUrl = botAvatarUrlFromStoredPath(saved.path);
      if (!avatarUrl) throw new Error("The uploaded image could not be used as an avatar");
      const latestCrop = cropRef.current;
      onPatch({ avatarUrl, avatarCrop: latestCrop === "mascot" ? "circle" : latestCrop });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : String(uploadError));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeImage = () => {
    setError(null);
    onPatch({ avatarUrl: null, avatarCrop: "mascot" });
  };

  const generate = async (direction: string) => {
    if (busy) return;
    setGenerating(true);
    setError(null);
    try {
      // Generation reads the bot's identity and crop server-side. Commit any
      // debounced profile edits first, then feed the generated avatar back
      // through the same serialized mutation lane as upload/remove.
      const cropAtStart = cropRef.current;
      await flushBotPatches(bot.id);
      const result: { avatarUrl: string; bot: Bot } = await api(`/api/bots/${bot.id}/avatar/generate`, {
        method: "POST",
        body: JSON.stringify({ prompt: direction.trim() }),
      });
      const latestCrop = cropRef.current;
      onPatch({
        avatarUrl: result.avatarUrl,
        // The server owns this crop for generate (server/index.ts picks
        // "circle" for a mascot bot). The fallback below is never actually
        // reached, since the server always assigns a crop; "circle" is kept
        // only as the truthful default if it ever were.
        avatarCrop:
          latestCrop === cropAtStart
            ? (result.bot.avatarCrop ?? "circle")
            : latestCrop,
      });
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : String(generateError));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="border border-hairline bg-card">
      <div className="flex items-center justify-between frame-rule-below px-3 py-2.5">
        <span className="label-mono bg-raised px-2.5 py-1 text-ink">Avatar</span>
        <Button
          variant="ghost"
          size="xs"
          disabled={busy}
          onClick={() => onPatch({ avatarCrop: "mascot", color: "green", mascotExpression: null, mascotBody: "cursor" })}
        >
          Reset mascot
        </Button>
      </div>

      <div className="p-3">
        <div className="flex justify-center py-3">
          <BotAvatar
            bot={bot}
            state={activeState}
            size={112}
            motion={mascotMotion?.kind ?? "none"}
            motionKey={mascotMotion?.nonce ?? 0}
          />
        </div>

        <div className="mt-2 flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="sr-only"
            onChange={(event) => void upload(event.target.files?.[0])}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex-1"
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
            Upload image
          </Button>
          {bot.avatarUrl && (
            <Button
              variant="ghost"
              icon
              size="sm"
              onClick={removeImage}
              disabled={busy}
              aria-label="Remove custom avatar image"
              title="Remove custom image"
            >
              <Trash2 size={14} className="text-danger" />
            </Button>
          )}
        </div>
        <div className="mt-1.5 font-mono text-[11px] text-ink-secondary">PNG, JPEG, GIF, or WebP · up to 10 MB</div>

        <div className="label-mono mb-2 mt-4 text-ink-secondary">
          Shape
        </div>
        <div className="grid grid-cols-4 border border-hairline bg-inset">
          {BOT_AVATAR_CROPS.map((candidate, index) => (
            <button
              key={candidate}
              type="button"
              disabled={busy}
              aria-pressed={crop === candidate}
              onClick={() => onPatch({ avatarCrop: candidate })}
              className={cn(
                "py-1.5 font-mono text-[11.5px] uppercase tracking-[0.06em] disabled:opacity-50 transition-colors",
                index > 0 && "border-l border-hairline",
                crop === candidate ? "bg-raised text-ink shadow-[inset_0_-2px_0_var(--color-ink)]" : "text-ink-secondary hover:bg-raised-hover hover:text-ink",
              )}
            >
              {CROP_LABEL[candidate]}
            </button>
          ))}
        </div>

        {crop === "mascot" && (
          <>
            <div className="label-mono mb-2 mt-4 text-ink-secondary">
              Expression
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {PICKABLE_STATES.map((expression) => (
                <button
                  key={expression}
                  type="button"
                  disabled={busy}
                  aria-pressed={activeState === expression}
                  onClick={() => onPatch({ mascotExpression: expression })}
                  className={cn(
                    "flex h-[56px] items-center justify-center border border-hairline bg-inset transition-colors hover:bg-raised-hover disabled:opacity-50",
                    activeState === expression && "border-ink bg-raised",
                  )}
                  title={expression}
                  aria-label={`Use ${expression} expression`}
                >
                  <MausAvatar color={bot.color} bodyId={bot.mascotBody ?? undefined} state={expression} size={40} animated={false} />
                </button>
              ))}
            </div>

            <div className="label-mono mb-2 mt-4 text-ink-secondary">
              Color
            </div>
            <div className="flex flex-wrap gap-2">
              {MAUS_COLOR_NAMES.map((color) => (
                <button
                  key={color}
                  type="button"
                  disabled={busy}
                  aria-pressed={bot.color === color}
                  onClick={() => onPatch({ color })}
                  className={cn(
                    "size-7 border transition-transform hover:scale-105 disabled:opacity-50",
                    bot.color === color ? "border-ink shadow-[0_0_0_2px_var(--color-app),0_0_0_3px_var(--color-ink)]" : "border-hairline",
                  )}
                  style={{ backgroundColor: MAUS_COLORS[color] }}
                  title={color}
                  aria-label={`Use ${color} mascot color`}
                />
              ))}
            </div>

            <div className="label-mono mb-2 mt-4 text-ink-secondary">
              Body
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {MASCOT_BODY_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  disabled={busy}
                  aria-pressed={(bot.mascotBody ?? "cursor") === id}
                  aria-label={`Use the ${MASCOT_BODIES[id].name} body`}
                  onClick={() => onPatch({ mascotBody: id })}
                  className={cn(
                    "flex items-center justify-center border border-hairline bg-inset py-1.5 disabled:opacity-50 transition-colors",
                    (bot.mascotBody ?? "cursor") === id
                      ? "border-ink bg-raised text-ink"
                      : "text-ink-secondary hover:bg-raised-hover",
                  )}
                >
                  <MausAvatar color={bot.color} bodyId={id} size={32} animated={false} />
                </button>
              ))}
            </div>
          </>
        )}

        <AvatarImageGenerator
          botLabel={bot.title || bot.name}
          disabled={uploading}
          generating={generating}
          onGenerate={generate}
          onSavingChange={setSavingConnection}
        />

        {error && <div role="alert" className="mt-3 border border-danger/40 bg-danger/10 p-2 font-mono text-[12px] text-danger">{error}</div>}
      </div>
    </div>
  );
}
