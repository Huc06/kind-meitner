import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, CheckCheck, Folder, MoreHorizontal, Pencil, Plus, X } from "lucide-react";
import { useStore, type Bot, type BotProject } from "@/state/store";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { Button, buttonClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";

const FOLDER_EMOJI = ["📁", "💼", "🏠", "📬", "💡", "🚀", "🎨", "🧪", "📚", "🌱", "⭐", "🛠️"];

export function FolderIcon({ emoji, size = 13 }: { emoji?: string; size?: number }) {
  return emoji ? <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center leading-none" style={{ width: size, fontSize: size }}>{emoji}</span>
    : <Folder aria-hidden="true" size={size} className="shrink-0" />;
}

export function navigateThreadMenu(event: React.KeyboardEvent<HTMLDivElement>) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
    : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
  buttons[next]?.focus();
}

export function FolderActions({ project, canMoveUp, canMoveDown, canMarkRead, saving, menu, onMenuChange, onEdit, onMove, onMarkRead }: {
  project: BotProject;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canMarkRead: boolean;
  saving: boolean;
  menu: { left: number; top: number } | null;
  onMenuChange: (menu: { left: number; top: number } | null) => void;
  onEdit: () => void;
  onMove: (direction: -1 | 1, onSaved: () => void) => void;
  onMarkRead: (onSaved: () => void) => void;
}) {
  const actionRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = () => { onMenuChange(null); actionRef.current?.focus(); };
  useEffect(() => {
    if (saving && menu) menuRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
  }, [saving, menu]);
  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
    const outside = (event: MouseEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target) && !actionRef.current?.contains(event.target)) onMenuChange(null);
    };
    window.addEventListener("mousedown", outside);
    return () => window.removeEventListener("mousedown", outside);
  }, [menu]);
  const move = (direction: -1 | 1) => onMove(direction, close);
  const position = menu && {
    left: Math.max(8, Math.min(menu.left, window.innerWidth - 228)),
    top: Math.max(8, Math.min(menu.top, window.innerHeight - 180)),
  };
  return <>
    <button ref={actionRef} type="button" aria-label={t("folder.actions", { name: project.name })} title={t("folder.actions", { name: project.name })} aria-haspopup="menu" aria-expanded={Boolean(menu)}
      onClick={(event) => { if (menu) { close(); return; } const rect = event.currentTarget.getBoundingClientRect(); onMenuChange({ left: rect.left, top: rect.bottom + 4 }); }}
      className="flex size-6 shrink-0 items-center justify-center opacity-0 hover:bg-raised-hover hover:text-ink focus-visible:opacity-100 group-hover/folder:opacity-100 max-md:opacity-70"><MoreHorizontal size={13} /></button>
    {position && createPortal(<div ref={menuRef} role="menu" aria-label={t("folder.actions", { name: project.name })} aria-busy={saving || undefined} data-thread-overlay style={position}
      className="fixed z-50 w-[220px] border border-hairline bg-menu p-1 shadow-xl"
      onMouseDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } else navigateThreadMenu(event); }}>
      <button type="button" role="menuitem" onClick={() => { close(); onEdit(); }} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left font-mono text-[11.5px] text-ink hover:bg-raised-hover"><Pencil size={12} />{t("folder.settings")}</button>
      <button type="button" role="menuitem" disabled={!canMarkRead || saving} onClick={() => onMarkRead(close)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left font-mono text-[11.5px] text-ink hover:bg-raised-hover disabled:opacity-40"><CheckCheck size={12} />{t("folder.markRead")}</button>
      <button type="button" role="menuitem" disabled={!canMoveUp || saving} onClick={() => move(-1)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left font-mono text-[11.5px] text-ink hover:bg-raised-hover disabled:opacity-40"><ArrowUp size={12} />{t("folder.moveUp")}</button>
      <button type="button" role="menuitem" disabled={!canMoveDown || saving} onClick={() => move(1)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left font-mono text-[11.5px] text-ink hover:bg-raised-hover disabled:opacity-40"><ArrowDown size={12} />{t("folder.moveDown")}</button>
    </div>, document.body)}
  </>;
}

/** Folders only organize threads. The project-shaped API is retained for
 * compatibility; neither model settings nor working directories live here. */
export function BotProjectDialog({ bot, project, onClose, onCreated }: {
  bot: Bot;
  project?: BotProject;
  onClose: () => void;
  onCreated?: (project: BotProject) => void;
}) {
  const { dispatch } = useStore();
  const [name, setName] = useState(project?.name ?? "");
  const [emoji, setEmoji] = useState(project?.emoji ?? "");
  const [choosingIcon, setChoosingIcon] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const iconRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (saving) dialogRef.current?.focus();
    else if (error) nameRef.current?.focus();
  }, [saving, error]);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    nameRef.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
      else document.querySelector<HTMLElement>(`[data-sidebar-bot-row="${CSS.escape(bot.id)}"]`)?.focus();
    };
  }, []);
  return createPortal(
    <div data-thread-overlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onCloseRef.current(); }
        if (event.key !== "Tab") return;
        const controls = dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled])");
        if (!controls?.length) return;
        const first = controls[0]!;
        const last = controls[controls.length - 1]!;
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <div ref={dialogRef} role="dialog" tabIndex={-1} aria-modal="true" aria-busy={saving || undefined} aria-label={t(project ? "folder.settings" : "folder.create")}
        className="max-h-[85dvh] w-full max-w-[420px] overflow-y-auto border border-hairline bg-panel p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3 frame-rule-below pb-3">
          <h2 className="text-[14px] font-semibold text-ink">{t(project ? "folder.settings" : "folder.create")}</h2>
          <Button variant="ghost" icon size="sm" onClick={onClose} aria-label={t("folder.close")}><X size={15} /></Button>
        </div>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim() || saving) return;
          setSaving(true);
          setError(null);
          const onError = (message: string) => { setSaving(false); setError(message); };
          if (project) {
            dispatch({ type: "updateProject", botId: bot.id, projectId: project.id, patch: { name: name.trim(), emoji: emoji.trim() || null }, onSaved: onClose, onError });
          } else {
            dispatch({ type: "createProject", botId: bot.id, name: name.trim(), emoji: emoji.trim() || null, onError,
              onCreated: (created) => { onCreated?.(created); onClose(); } });
          }
        }}>
          <label className="label-mono block text-ink-secondary">{t("folder.name")}
            <input ref={nameRef} value={name} maxLength={80} disabled={saving} onChange={(event) => setName(event.target.value)}
              className={cn(fieldClass, "mt-1.5 h-8 font-mono text-[12.5px]")} />
          </label>
          <button ref={iconRef} type="button" disabled={saving} aria-label={t("folder.icon")} aria-expanded={choosingIcon} onClick={() => setChoosingIcon((open) => !open)}
            className={buttonClass({ variant: "secondary", size: "sm", className: "mt-3 w-full justify-start gap-2" })}><FolderIcon emoji={emoji} size={16} />{t("folder.icon")}</button>
          {choosingIcon && <div className="mt-2 border border-hairline bg-inset p-3"
            onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setChoosingIcon(false); iconRef.current?.focus(); } }}>
            <p className="mb-2 font-mono text-[11px] text-ink-secondary">{t("folder.emojiHint")}</p>
            <div className="flex flex-wrap gap-1">
              <button type="button" disabled={saving} aria-label={t("folder.defaultIcon")} aria-pressed={!emoji} onClick={() => setEmoji("")} className="flex size-7 items-center justify-center border border-hairline hover:bg-raised aria-pressed:border-ink aria-pressed:bg-raised"><FolderIcon size={16} /></button>
              {FOLDER_EMOJI.map((icon) => <button key={icon} type="button" disabled={saving} aria-label={icon} aria-pressed={emoji === icon} onClick={() => setEmoji(icon)} className="size-7 border border-hairline text-base hover:bg-raised aria-pressed:border-ink aria-pressed:bg-raised">{icon}</button>)}
            </div>
            <label className="label-mono mt-2.5 block text-ink-secondary">{t("folder.emoji")}
              <input value={emoji} disabled={saving} maxLength={64} onChange={(event) => setEmoji(event.target.value)} className={cn(fieldClass, "mt-1 h-8 font-mono text-[13px]")} />
            </label>
          </div>}
          <p className="mt-2 text-[12px] leading-relaxed text-ink-secondary">{t("folder.detail", { name: bot.name })}</p>
          {error && <p role="alert" className="mt-3 border border-danger/40 bg-danger/10 p-2 font-mono text-[12px] text-danger">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onClose} className={buttonClass({ variant: "secondary", size: "sm" })}>{t("common.cancel")}</button>
            <button type="submit" disabled={!name.trim() || saving} className={buttonClass({ variant: "primary", size: "sm" })}>{t(saving ? "folder.saving" : project ? "folder.save" : "folder.create")}</button>
          </div>
        </form>
        {project && <div className="mt-4 frame-rule-above pt-3">
          {deleting ? <>
            <p className="text-[12px] leading-relaxed text-ink-secondary">{t("folder.deleteBody")}</p>
            <div className="mt-2 flex items-center gap-3">
              <button type="button" disabled={saving} onClick={() => {
                setSaving(true); setError(null);
                dispatch({ type: "deleteProject", botId: bot.id, projectId: project.id, onDeleted: onClose, onError: (message) => { setSaving(false); setError(message); } });
              }} className="font-mono text-[11px] uppercase tracking-wide text-danger hover:underline disabled:opacity-40">{t("folder.deleteConfirm")}</button>
              <button type="button" onClick={() => setDeleting(false)} className="font-mono text-[11px] uppercase tracking-wide text-ink-secondary hover:underline">{t("common.cancel")}</button>
            </div>
          </> : <button type="button" disabled={saving} onClick={() => setDeleting(true)} className="font-mono text-[11px] uppercase tracking-wide text-danger hover:underline disabled:opacity-40">{t("folder.delete")}</button>}
        </div>}
      </div>
    </div>, document.body,
  );
}

/** One-click new thread in the current folder. Folder creation lives in the sidebar. */
export function NewThreadButton({ bot, className, compact = false, onCreated }: { bot: Bot; className?: string; compact?: boolean; onCreated?: () => void }) {
  const { dispatch } = useStore();
  const projects = bot.projects ?? [];
  const currentProject = projects.find((project) => project.id === bot.tasks?.find((task) => task.threadId === bot.threadId)?.projectId);
  return <button type="button" aria-label={t("task.newShort")} title={currentProject ? t("task.newIn", { name: currentProject.name }) : t("task.newShort")}
    onClick={() => {
      dispatch({ type: "newTask", botId: bot.id, ...(currentProject ? { projectId: currentProject.id } : {}) });
      onCreated?.();
    }}
    className={cn("flex min-w-0 items-center gap-2 border border-hairline bg-transparent px-2.5 text-left font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-secondary hover:bg-raised-hover hover:text-ink transition-colors", compact ? "py-1 @max-4xl/chathead:h-[30px] @max-4xl/chathead:px-2" : "py-1.5", className)}>
    <Plus aria-hidden="true" size={12} /><span className={cn("truncate", compact && "@max-4xl/chathead:hidden")}>{t("task.newShort")}</span>
  </button>;
}
