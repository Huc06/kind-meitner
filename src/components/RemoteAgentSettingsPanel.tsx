import { useRef, useState } from "react";
import { Bell, ChevronLeft, ImagePlus, Loader2, Trash2, X } from "lucide-react";

import { api, useStore, type Bot } from "@/state/store";
import { cn } from "@/lib/cn";
import { useCaptionChrome } from "@/components/DesktopCapabilities";
import { VoiceSettings } from "./VoiceSettings";
import { Switch } from "./SettingsPrimitives";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";
import { BotAvatar } from "./Avatar";
import { imageAttachmentFromFile } from "@/lib/composer-attachments";
import { botAvatarUrlFromStoredPath } from "../../shared/bot-avatar";
import { BOT_PROFILE_LIMITS } from "../../shared/bot-profile";

type RemoteProfilePatch = Partial<
  Pick<Bot, "name" | "title" | "description" | "avatarUrl" | "avatarCrop" | "voice" | "speakReplies" | "notifications">
>;

export function RemoteAgentSettingsPanel({ bot }: { bot: Bot }) {
  const { dispatch } = useStore();
  // Docked flush under the Windows caption corner: drop the header 16px.
  const { padClass } = useCaptionChrome();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const pendingPatch = useRef<RemoteProfilePatch | null>(null);
  const patchQueue = useRef<Promise<void> | null>(null);

  const close = () => dispatch({ type: "toggleSettings", open: false });
  const patch = (next: RemoteProfilePatch): Promise<void> => {
    pendingPatch.current = { ...pendingPatch.current, ...next };
    if (patchQueue.current) return patchQueue.current;
    setSaving(true);
    setError("");
    const drain = async () => {
      while (pendingPatch.current) {
        const current = pendingPatch.current;
        pendingPatch.current = null;
        setError("");
        try {
          const result: { bot: Bot } = await api(`/api/bots/${bot.id}/profile`, {
            method: "PATCH",
            body: JSON.stringify(current),
          });
          dispatch({ type: "botPatched", bot: result.bot });
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Could not update this agent.");
        }
      }
    };
    patchQueue.current = drain().finally(() => {
      patchQueue.current = null;
      setSaving(false);
    });
    return patchQueue.current;
  };

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const saved = await imageAttachmentFromFile(file);
      const avatarUrl = saved ? botAvatarUrlFromStoredPath(saved.path) : null;
      if (!avatarUrl) throw new Error("Choose a PNG, JPEG, GIF, or WebP image.");
      await patch({ avatarUrl, avatarCrop: bot.avatarCrop === "square" ? "square" : "circle" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setUploading(false);
      if (avatarInput.current) avatarInput.current.value = "";
    }
  };

  return (
    <aside className="animate-panel-in relative z-20 flex h-full w-[400px] shrink-0 flex-col border-l border-hairline bg-panel">
      <div className={cn("flex items-center justify-between gap-3 frame-rule-below bg-panel px-4 py-3", padClass)}>
        <Button
          variant="ghost"
          icon
          size="sm"
          onClick={close}
          aria-label="Collapse remote agent settings"
        >
          <ChevronLeft size={16} />
        </Button>
        <span className="label-mono text-ink">Remote agent settings</span>
        <Button
          variant="ghost"
          icon
          size="sm"
          onClick={close}
          aria-label="Close remote agent settings"
        >
          <X size={16} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          <div className="border border-hairline bg-card p-4">
            <div className="mb-4 flex items-center gap-3">
              <BotAvatar bot={bot} state="idle" size={56} motion="none" motionKey={0} animated={false} />
              <div className="flex gap-2">
                <input ref={avatarInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only" onChange={(event) => void uploadAvatar(event.target.files?.[0])} />
                <Button variant="secondary" size="sm" disabled={uploading || saving} onClick={() => avatarInput.current?.click()}>
                  {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />} Avatar
                </Button>
                {bot.avatarUrl && (
                  <Button variant="ghost" icon size="sm" disabled={saving} onClick={() => void patch({ avatarUrl: null, avatarCrop: "mascot" })} aria-label="Remove custom avatar">
                    <Trash2 size={13} className="text-danger" />
                  </Button>
                )}
              </div>
            </div>
            <label className="label-mono block text-ink-secondary">Name
              <input key={bot.id} defaultValue={bot.name} maxLength={BOT_PROFILE_LIMITS.name} onBlur={(event) => { const name = event.currentTarget.value.trim(); if (name && name !== bot.name) void patch({ name }); }} className={cn(fieldClass, "mt-1 h-8 font-mono text-[12px]")} />
            </label>
            <label className="label-mono mt-3 block text-ink-secondary">Title
              <input key={bot.id} defaultValue={bot.title ?? ""} maxLength={BOT_PROFILE_LIMITS.title} onBlur={(event) => { if (event.currentTarget.value !== (bot.title ?? "")) void patch({ title: event.currentTarget.value }); }} className={cn(fieldClass, "mt-1 h-8 font-mono text-[12px]")} />
            </label>
            <label className="label-mono mt-3 block text-ink-secondary">Description
              <textarea key={bot.id} defaultValue={bot.description ?? ""} maxLength={BOT_PROFILE_LIMITS.description} rows={4} onBlur={(event) => { if (event.currentTarget.value !== (bot.description ?? "")) void patch({ description: event.currentTarget.value }); }} className={cn(fieldClass, "mt-1 font-mono text-[12px]")} />
            </label>
          </div>

          <VoiceSettings
            bot={bot}
            workspaceConfigurationLocked
            onPatch={(next) => void patch(next)}
          />

          <div className="flex items-center justify-between gap-4 border border-hairline bg-card p-4">
            <div className="flex min-w-0 items-start gap-3">
              <Bell size={15} className="mt-0.5 shrink-0 text-ink-secondary" />
              <div>
                <div className="text-[14px] font-medium text-ink">Notifications</div>
                <div className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary">
                  Enable completion and attention notifications for this agent on the host and paired clients.
                </div>
              </div>
            </div>
            <Switch
              checked={bot.notifications}
              disabled={saving}
              aria-label="Agent notifications"
              onClick={() => void patch({ notifications: !bot.notifications })}
            />
          </div>

          {error ? <div role="alert" className="border border-danger/40 bg-danger/10 p-2 font-mono text-[12px] text-danger">{error}</div> : null}
        </div>
      </div>
    </aside>
  );
}
