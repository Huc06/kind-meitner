import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { api, useStore, type Bot } from "@/state/store";
import { BotPickerList } from "./BotPickerList";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/** A team may start empty; choosing bots moves their membership, never copies them. */
export function TeamDialog({ section, rename = false, onClose }: {
  section?: string;
  rename?: boolean;
  onClose: () => void;
}) {
  const { state, dispatch } = useStore();
  const [name, setName] = useState(section ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (dialog.current?.querySelector<HTMLElement>("input") ?? dialog.current?.querySelector<HTMLElement>("button"))?.focus();
    return () => { if (opener?.isConnected) opener.focus(); };
  }, []);
  const moving = section !== undefined && !rename;
  const title = rename ? t("team.renameEmpty") : moving ? t("team.moveTo", { name: section || "General" }) : t("team.create");
  const candidates = state.bots.filter((bot) => !bot.hidden && (!moving || (bot.section?.trim() ?? "") !== section));
  const save = async () => {
    if (saving || (!moving && !name.trim()) || (moving && !picked.size)) return;
    if (section === undefined && [...(state.sections ?? []), ...state.bots.map((bot) => bot.section), ...state.groups.map((group) => group.section)].includes(name.trim())) {
      setError(t("team.duplicate"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result: { sections: string[]; bots?: Bot[] } = await api(
        rename ? `/api/sidebar-sections?section=${encodeURIComponent(section!)}` : "/api/sidebar-sections",
        { method: rename ? "PATCH" : "POST", body: JSON.stringify(rename ? { name: name.trim() } : { name: name.trim(), botIds: [...picked] }) },
      );
      dispatch({ type: "sections", sections: result.sections });
      for (const bot of result.bots ?? []) dispatch({ type: "botPatched", bot });
      onCloseRef.current();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setSaving(false);
    }
  };
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="team-dialog-title"
        className="max-h-[90vh] w-full max-w-[430px] overflow-y-auto border border-hairline bg-panel p-5 text-ink shadow-2xl"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !saving) { event.stopPropagation(); onClose(); }
          if (event.key === "Tab") {
            const controls = dialog.current?.querySelectorAll<HTMLElement>("input:enabled, button:enabled");
            if (!controls?.length) return;
            const first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
          }
        }}>
        <div className="mb-3 flex items-center justify-between gap-3 frame-rule-below pb-3">
          <h2 id="team-dialog-title" className="label-mono text-[13px] font-semibold text-ink">[ {title.toUpperCase()} ]</h2>
          <button aria-label={t("team.closeDialog")} disabled={saving} onClick={onClose} className="p-1 text-ink-secondary hover:text-ink"><X size={16} /></button>
        </div>
        {(!moving || rename) && <label className="label-mono mb-3 block text-[11px] text-ink-secondary">{t("team.name")}
          <input value={name} maxLength={60} disabled={saving} onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") void save(); }}
            className="mt-1.5 w-full border border-hairline bg-inset px-3 py-2 font-sans text-[13px] text-ink placeholder:text-ink-secondary/50 focus:border-ink focus:outline-none" />
        </label>}
        {!rename && <>
          <p className="mb-3 text-[12.5px] leading-relaxed text-ink-secondary">
            {moving ? t("team.moveIntro") : t("team.createIntro")} {t("team.moveWarning")}
          </p>
          <fieldset disabled={saving}>
            <legend className="label-mono mb-1.5 text-[10.5px] text-ink-secondary">{t("team.existingBots")}</legend>
            <BotPickerList bots={candidates} picked={picked} emptyHint={t("team.noBots")} onToggle={(id) => setPicked((previous) => {
              const next = new Set(previous);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            })} />
          </fieldset>
        </>}
        {error && <p role="alert" className="mt-3 font-mono text-[11.5px] text-danger">{error}</p>}
        <div className="mt-4 flex justify-end gap-2 frame-rule-above pt-3">
          <Button variant="secondary" size="sm" disabled={saving} onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" size="sm" disabled={saving || (!moving && !name.trim()) || (moving && !picked.size)} onClick={() => void save()}>
            {saving ? t("team.saving") : rename ? t("folder.saveName") : moving ? picked.size ? t(picked.size === 1 ? "team.moveOne" : "team.moveMany", { count: picked.size }) : t("team.moveSelected") : t("team.create")}
          </Button>
        </div>
      </div>
    </div>, document.body,
  );
}
