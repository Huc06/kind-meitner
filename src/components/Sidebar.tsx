import { track } from "@/lib/analytics";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Archive,
  BellDot,
  Bot as BotIcon,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCopy,
  Copy,
  Crown,
  FolderMinus,
  FolderPlus,
  Library,
  Loader2,
  Network,
  MoreHorizontal,
  Pencil,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  PinOff,
  Plus,
  Search,
  Scale,
  Settings as SettingsIcon,
  HelpCircle,
  MessageSquare,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { api, useStore, formatTime, visibleMessages, currentTaskBot, type AppState, type Bot, type Group } from "@/state/store";
import { peerLine } from "@/lib/peer-message";

import { HELP_CENTER_URL, openExternalLink } from "@/lib/app-links";
import { AgentMark } from "./agent-identity/AgentMark";
import { BotAvatar, InitialsAvatar } from "./Avatar";
import { stateForBot } from "@/lib/mascot";
import { cn } from "@/lib/cn";
import { t, tFromServer } from "@/lib/i18n";
import type { LocaleKey } from "@/locales";
import { ConfirmDialog } from "./ConfirmDialog";
import { DialogBackdrop, DialogPanel } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WorkingDots } from "./WorkingIndicator";
import { nextRename } from "@/lib/rename";
import { useDesktopCapabilities } from "./DesktopCapabilities";
import { MIN_QUERY, SearchResults } from "./SearchResults";
import { TeamLibraryPanel } from "./TeamLibraryPanel";
import { TeamDialog } from "./TeamDialog";
import { RenameTitle } from "./RenameTitle";
import { BotPickerList } from "./BotPickerList";
import { BotProjectDialog, FolderActions, FolderIcon, navigateThreadMenu, NewThreadButton } from "./BotProjects";
import { draggedFolder, FOLDER_DRAG_TYPE, moveFolder, placeFolder } from "@/lib/folder-order";
import { folderUnreadThreadIds, markFolderRead } from "@/lib/folder-read";
import { SidebarThreadRow, visibleSidebarThreads } from "./SidebarThreadRow";
import {
  loadCollapsedSections,
  loadSectionOrder,
  loadSidebarDensity,
  saveCollapsedSections,
  saveSectionOrder,
  saveSidebarDensity,
  toggleCollapsedSection,
  type SidebarDensity,
} from "@/lib/sidebar-preferences";
import {
  BOT_CHATS_SECTION_ID,
  BOTS_SECTION_ID,
  CHANNELS_SECTION_ID,
  PINNED_SECTION_ID,
  mergeSectionOrder,
  moveSection,
  orderedSidebarSections,
  partitionSidebarBots,
  partitionSidebarGroups,
  placeSection,
  sameSectionOrder,
  sidebarGoalRunPreview,
  sidebarLayoutInteractive,
  sidebarSectionCollapsed,
  sidebarSectionLabel,
  userSectionId,
  userSectionName,
  type SectionDropPlace,
} from "@/lib/sidebar-layout";
import { sidebarSectionAttention } from "@/lib/sidebar-attention";
import { botListItemPointerIntent } from "@/lib/sidebar-selection";
import { phoneSettingsAction, SidebarPhoneButton } from "./SidebarPhoneButton";
import { DesktopWorkspaceSwitcher } from "./DesktopWorkspaceSwitcher";
import { profileInitials, SidebarProfileMenu } from "./SidebarProfileMenu";
import { SidebarSectionHeader } from "./SidebarSectionHeader";
import { useShowThreads } from "@/lib/thread-preferences";
import { SidebarBotActivity, sidebarBotActivityTasks } from "./SidebarBotActivity";
import { ShortcutHint } from "./ShortcutHint";

const SECTION_LABEL_KEYS: Record<string, LocaleKey> = {
  [PINNED_SECTION_ID]: "sidebar.section.pinned",
  [CHANNELS_SECTION_ID]: "sidebar.section.channels",
  [BOT_CHATS_SECTION_ID]: "sidebar.section.botChats",
  [BOTS_SECTION_ID]: "sidebar.section.bots",
};

/** The four built-in section names come from the catalog; a section someone
 * named themselves is their text and stays exactly as typed. */
function sectionLabel(id: string): string {
  const key = SECTION_LABEL_KEYS[id];
  return key ? t(key) : sidebarSectionLabel(id);
}

function preview(bot: Bot): string {
  if (bot.activity === "waiting-on-you") return t("sidebar.preview.waiting");
  if (bot.busy) return t("sidebar.preview.working");
  // the visible branch's tail — bot.messages holds every fork, so its last
  // entry can belong to a version the user switched away from
  const last = visibleMessages(bot).at(-1);
  if (!last) return "";
  if (last.kind === "options" && last.card) return last.card.title;
  if (last.kind === "activity" && last.tool) return last.tool.name;
  if (last.kind === "screen") return t("sidebar.preview.screenFrame");
  const peer = peerLine(last);
  if (peer) return `${peer.name}: ${peer.body}`;
  return last.text ?? "";
}

interface MenuState {
  botId: string;
  x: number;
  y: number;
}

function groupPreview(group: Group, bots: Bot[]): string {
  if (group.busyBotId) {
    return t("sidebar.preview.botWorking", {
      name: bots.find((b) => b.id === group.busyBotId)?.name ?? t("sidebar.preview.aBot"),
    });
  }
  if (group.working) return t("sidebar.preview.teamWorking");
  const last = group.messages.at(-1);
  if (!last) return t("sidebar.preview.noMessages");
  const text = last.kind === "activity" && last.tool
    ? last.tool.name
    : last.kind === "goal.run" && last.goalRun
      ? sidebarGoalRunPreview(last.goalRun)
      : (last.text ?? "");
  if (last.role === "user") return t("sidebar.preview.you", { text });
  return last.from ? `${last.from.name}: ${text}` : text;
}

/** A small member stack identifies a group without turning it into a card. */
function StackedMauses({ members, density }: { members: Bot[]; density: SidebarDensity }) {
  const iconOnly = density === "icons";
  const slotSize = iconOnly ? "size-12" : density === "compact" ? "size-7" : "size-8";
  const singleSize = iconOnly ? 44 : density === "compact" ? 26 : 32;
  if (members.length <= 1) {
    const b = members[0];
    return (
      <div className={cn("flex shrink-0 items-center justify-center", slotSize)}>
        {b ? <AgentMark bot={b} size={singleSize} /> : <Users size={20} className="text-ink-secondary" />}
      </div>
    );
  }
  const shown = members.slice(0, 3);
  const extra = members.length - shown.length;
  return (
    <div className={cn("flex shrink-0 items-center justify-center", slotSize)}>
      <div className="flex items-center -space-x-2">
        {shown.map((b) => (
          <span key={b.id} className="relative inline-flex ring-1 ring-panel">
            <AgentMark bot={b} size={iconOnly ? 30 : 20} />
          </span>
        ))}
        {extra > 0 && (
          <span className="z-10 flex size-4 items-center justify-center border border-panel bg-raised text-[9px] font-mono text-ink-secondary">
            +{extra}
          </span>
        )}
      </div>
    </div>
  );
}

export function GroupListItem({
  group,
  density,
  query = "",
  onMenu,
}: {
  group: Group;
  density: SidebarDensity;
  query?: string;
  onMenu: (menu: { groupId: string; x: number; y: number }) => void;
}) {
  const { state, dispatch } = useStore();
  const selected = state.activeView === "chat" && state.selectedId === group.id;
  const [threadsOpen, setThreadsOpen] = useState(selected || Boolean(query));
  useEffect(() => { if (selected || query) setThreadsOpen(true); }, [selected, query]);
  const expanded = !group.dm && threadsOpen && density !== "icons";
  const members = group.memberIds
    .map((id) => state.bots.find((b) => b.id === id))
    .filter((b): b is Bot => Boolean(b));
  const last = group.messages.at(-1);
  return (
    <>
    <div className="group relative">
    <button
      onClick={() => dispatch({ type: "select", id: group.id })}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu({ groupId: group.id, x: e.clientX, y: e.clientY });
      }}
      // the menu must be reachable without a pointer: Shift+F10, and the
      // dedicated ContextMenu key (whose native event carries no useful
      // coordinates) both open it centered on the row
      onKeyDown={(e) => {
        if (e.key !== "ContextMenu" && !(e.shiftKey && e.key === "F10")) return;
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        onMenu({ groupId: group.id, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      }}
      aria-current={selected && !expanded ? "page" : undefined}
      className={cn(
        "relative flex w-full items-center text-left transition-colors outline-none focus-visible:ring-1 focus-visible:ring-focus",
        density === "icons" ? "justify-center px-1 py-1.5" : density === "compact" ? "gap-1.5 py-1 pl-6 pr-2" : "gap-2 py-1.5 pl-6 pr-2",
        selected && !expanded ? "bg-raised text-ink shadow-[inset_2px_0_0_var(--color-ink)]" : "text-ink hover:bg-raised-hover",
      )}
      title={group.name}
      aria-label={group.name}
    >
      <StackedMauses members={members} density={density} />
      <div className={cn("min-w-0 flex-1", density === "icons" && "hidden")}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[13px] font-medium text-ink">{group.name}</span>
          {selected && last && !expanded && <span className="shrink-0 font-mono text-[10px] text-ink-secondary">{formatTime(last.at)}</span>}
          {expanded && group.unread && <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-label={t("task.unreadMany")} />}
        </div>
        {!expanded && <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[11px] text-ink-secondary">{groupPreview(group, state.bots)}</span>
          {group.unread && <span className="size-1.5 shrink-0 rounded-full bg-accent" />}
        </div>}
      </div>
      {density === "icons" && group.unread && (
        <span className="absolute bottom-1.5 right-1.5 size-2 rounded-full border border-panel bg-accent" />
      )}
    </button>
    {!group.dm && density !== "icons" && <button type="button" aria-label={t(expanded ? "task.collapseNamed" : "task.expandNamed", { name: group.name })} aria-expanded={expanded}
      onClick={() => setThreadsOpen((open) => !open)} className="absolute left-0.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center text-ink-secondary outline-none hover:text-ink focus-visible:ring-1 focus-visible:ring-accent/60">
      <ChevronRight aria-hidden="true" size={12} className={cn("transition-transform", expanded && "rotate-90")} />
    </button>}
    </div>
    {expanded && <GroupThreadList group={group} selected={selected} density={density} query={group.name.toLowerCase().includes(query.toLowerCase()) ? "" : query} />}
    </>
  );
}

/** Scroll the row of a thread the person asked to open into view, once the
 * switch has landed and that thread is the one on screen. `block: nearest`
 * keeps an already-visible row still. */
function useRevealedThreadRow(reveal: AppState["revealThread"], currentThreadId: string | null) {
  useEffect(() => {
    if (!reveal || reveal.threadId !== currentThreadId) return;
    const row = document.querySelector<HTMLElement>(`[data-sidebar-thread-row="${CSS.escape(reveal.threadId)}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [reveal, currentThreadId]);
}

export function GroupThreadList({ group, selected, density = "comfortable", query = "" }: { group: Group; selected: boolean; density?: SidebarDensity; query?: string }) {
  const { state, dispatch } = useStore();
  const [showAll, setShowAll] = useState(false);
  const busy = Boolean(group.working || group.busyBotId);
  const waiting = state.bots.find((bot) => bot.id === group.busyBotId)?.activity === "waiting-on-you";
  const tasks = (group.tasks ?? [{ threadId: group.threadId, title: group.name, createdAt: group.createdAt }]).map((task) => ({
    ...task, busy: task.threadId === group.threadId && busy, unread: task.threadId === group.threadId && group.unread,
    activity: task.threadId === group.threadId && waiting ? "waiting-on-you" as const : undefined,
  }));
  const visible = visibleSidebarThreads(tasks, group.threadId, query, [], showAll);
  useRevealedThreadRow(state.revealThread, selected ? group.threadId : null);
  return <div className="mb-2 ml-5 space-y-0.5 border-l border-dashed border-hairline pl-2" role="group" aria-label={t("task.namedList", { name: group.name })}>
    {visible.map((task) => <SidebarThreadRow key={task.threadId} task={task} current={selected && task.threadId === group.threadId} compact={density === "compact"}
      onSelect={() => { if (task.threadId !== group.threadId) dispatch({ type: "switchGroupTask", groupId: group.id, threadId: task.threadId }); else dispatch({ type: "select", id: group.id }); }}
      onRename={(title) => dispatch({ type: "renameGroupTask", groupId: group.id, threadId: task.threadId, title })}
      onDelete={() => dispatch({ type: "deleteGroupTask", groupId: group.id, threadId: task.threadId })} />)}
    {!query && !showAll && tasks.length > visible.length && <button type="button" onClick={() => setShowAll(true)} className="px-3 py-1.5 font-mono text-[11px] text-ink-secondary hover:text-ink">{t("task.showAll", { count: tasks.length })}</button>}
    <button type="button" disabled={busy} onClick={() => dispatch({ type: "newGroupTask", groupId: group.id })} title={t(busy ? "task.newBusy" : "task.newShort")}
      className="mt-1 flex min-h-7 w-full items-center gap-2 px-2.5 py-1 text-left text-[12px] text-ink-secondary hover:bg-raised-hover hover:text-ink disabled:opacity-40"><Plus size={12} />{t("task.newShort")}</button>
  </div>;
}

function RoomContextMenu({
  menu,
  onClose,
  onMoveToSection,
}: {
  menu: { groupId: string; x: number; y: number };
  onClose: () => void;
  onMoveToSection: (groupId: string) => void;
}) {
  const { state, dispatch } = useStore();
  const remoteClient = window.ogb?.remoteClient?.active === true;
  const group = state.groups.find((g) => g.id === menu.groupId);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(group?.name ?? "");

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest("[data-room-menu]")) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  if (!group) return null;
  const isBotChat = Boolean(group.dm);
  const saveRename = () => {
    const name = nextRename(group.name, draft);
    if (name) dispatch({ type: "patchGroup", groupId: group.id, patch: { name } });
    onClose();
  };
  const top = Math.min(menu.y, window.innerHeight - 204);
  const left = Math.min(menu.x, window.innerWidth - 240);
  return createPortal(
    <div
      data-room-menu
      data-sidebar
      style={{ top, left }}
      className="fixed z-40 w-[228px] overflow-hidden border border-hairline bg-menu py-1 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.6)]"
    >
      {!remoteClient && (renaming ? (
        <div className="flex items-center gap-1 px-2 py-1">
          <input
            autoFocus
            value={draft}
            maxLength={100}
            aria-label={t("sidebar.room.renameAria", { name: group.name })}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                saveRename();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
            }}
            className="min-w-0 flex-1 border border-hairline bg-inset px-2 py-1 text-[13px] text-ink focus:outline-none"
          />
          <button
            type="button"
            onClick={saveRename}
            aria-label={isBotChat ? t("sidebar.room.saveChatName") : t("sidebar.room.saveChannelName")}
            title={t("common.save")}
            className="flex size-7 shrink-0 items-center justify-center text-ink-secondary hover:bg-raised-hover hover:text-ink"
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={isBotChat ? t("sidebar.room.cancelChatRename") : t("sidebar.room.cancelChannelRename")}
            title={t("common.cancel")}
            className="flex size-7 shrink-0 items-center justify-center text-ink-secondary hover:bg-raised-hover hover:text-ink"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            setDraft(group.name);
            setRenaming(true);
          }}
          className="flex h-8 w-full items-center gap-2.5 px-2.5 text-left text-[13px] text-ink transition-colors hover:bg-raised-hover"
        >
          <Pencil size={15} className="text-ink-secondary" />
          {isBotChat ? t("sidebar.room.renameChat") : t("sidebar.room.renameChannel")}
        </button>
      ))}
      {!remoteClient && !isBotChat && (
        <button
          onClick={() => {
            onClose();
            onMoveToSection(group.id);
          }}
          className="flex h-8 w-full items-center gap-2.5 px-2.5 text-left text-[13px] text-ink transition-colors hover:bg-raised-hover"
        >
          <FolderPlus size={15} className="text-ink-secondary" />
          {t("sidebar.section.moveToContext")}
        </button>
      )}
      <button
        onClick={() => {
          void navigator.clipboard?.writeText(group.threadId);
          onClose();
        }}
        className="flex h-8 w-full items-center gap-2.5 px-2.5 text-left text-[13px] text-ink transition-colors hover:bg-raised-hover"
      >
        <ClipboardCopy size={15} className="text-ink-secondary" />
        {t("sidebar.copyConversationId")}
      </button>
      {!remoteClient && <button
        onClick={() => {
          dispatch({ type: "deleteGroup", groupId: group.id });
          onClose();
        }}
        className="flex h-8 w-full items-center gap-2.5 px-2.5 text-left text-[13px] text-danger transition-colors hover:bg-raised-hover"
      >
        <Trash2 size={15} />
        {isBotChat ? t("sidebar.room.deleteChat") : t("sidebar.room.deleteChannel")}
      </button>}
    </div>,
    document.body,
  );
}

/** Pick members and an optional Work/Personal/project context, then create. */
function NewRoomPanel({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [name, setName] = useState("");
  const [section, setSection] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const bots = state.bots.filter((b) => !b.hidden);
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const create = () => {
    if (!picked.size) return;
    dispatch({
      type: "createGroup",
      memberIds: [...picked],
      name: name.trim() || undefined,
      section: section.trim() || undefined,
    });
    track("room_created", { members: picked.size, context: Boolean(section.trim()) });
    onClose();
  };
  return (
    <DialogBackdrop onDismiss={onClose}>
      <DialogPanel aria-labelledby="new-channel-title" className="w-[360px] p-5">
        <h2 id="new-channel-title" className="label-mono mb-3 text-[13px] text-ink">
          <span className="text-ink-secondary">[ </span>
          {t("sidebar.newChannel.title")}
          <span className="text-ink-secondary"> ]</span>
        </h2>
        <input
          autoFocus
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
            if (e.key === "Escape") onClose();
          }}
          placeholder={t("sidebar.newChannel.name")}
          className="mb-2.5 w-full border border-hairline bg-inset px-2.5 py-1.5 font-mono text-[13px] text-ink placeholder:text-ink-secondary focus:outline-none"
        />
        <input
          value={section}
          maxLength={60}
          onChange={(e) => setSection(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
            if (e.key === "Escape") onClose();
          }}
          placeholder={t("sidebar.newChannel.context")}
          aria-label={t("sidebar.newChannel.contextAria")}
          className="mb-2.5 w-full border border-hairline bg-inset px-2.5 py-1.5 font-mono text-[13px] text-ink placeholder:text-ink-secondary focus:outline-none"
        />
        <BotPickerList
          bots={bots}
          picked={picked}
          onToggle={toggle}
          emptyHint={t("sidebar.newChannel.emptyHint")}
        />
        <div className="mt-4">
          <Button
            onClick={create}
            disabled={!picked.size}
            variant="primary"
            size="md"
            className="w-full"
          >
            {picked.size === 0
              ? t("sidebar.newChannel.create")
              : picked.size === 1
                ? t("sidebar.newChannel.createOne")
                : t("sidebar.newChannel.createMany", { count: picked.size })}
          </Button>
        </div>
      </DialogPanel>
    </DialogBackdrop>
  );
}

/** Move-to-section popover: existing sections as chips (checkmark on the
 * target's current one), a create field, and a remove action. Serves bots
 * and channels alike — the caller supplies the assignment. Mirrors the
 * context menu's fixed positioning + dismiss-on-outside-click contract. */
function SectionPicker({
  current,
  anchor,
  onClose,
  onAssign,
}: {
  /** the target's current section; undefined = none */
  current: string | undefined;
  anchor: { x: number; y: number };
  onClose: () => void;
  /** "" clears — the server drops an empty section */
  onAssign: (section: string) => void;
}) {
  const { state } = useStore();
  const [name, setName] = useState("");
  const trimmed = name.trim();

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest("[data-section-picker]")) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  // Hidden bots can carry a stale assignment; don't offer it as a context.
  // Channels and bots share one namespace, so Work or Personal can hold both.
  const sections = [
    ...new Set([
      ...(state.sections ?? []),
      ...state.bots.filter((b) => !b.hidden && b.section).map((b) => b.section!),
      ...state.groups.filter((g) => g.section).map((g) => g.section!),
    ]),
  ];

  const assign = (section: string) => {
    onAssign(section);
    onClose();
  };

  const top = Math.max(8, Math.min(anchor.y, window.innerHeight - 300));
  const left = Math.min(anchor.x, window.innerWidth - 260);

  return (
    <div
      data-section-picker
      style={{ top, left }}
      className="fixed z-40 w-[236px] overflow-hidden border border-hairline bg-menu py-1.5 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.6)]"
    >
      <div className="label-mono px-3 pb-1 text-ink-secondary">
        {t("sidebar.section.moveToContext")}
      </div>
      {sections.length > 0 && (
        <div className="flex flex-col gap-0.5 px-1 py-1">
          {sections.map((section) => (
            <button
              key={section}
              onClick={() => assign(section)}
              className={cn(
                "flex h-8 w-full items-center justify-between gap-2 px-2.5 text-left text-[13px] transition-colors",
                section === current ? "bg-raised text-ink shadow-[inset_2px_0_0_var(--color-ink)]" : "text-ink hover:bg-raised-hover",
              )}
            >
              <span className="truncate">{section}</span>
              {section === current && <Check size={14} className="shrink-0 text-ink" />}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex items-center gap-1.5 px-2.5 py-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!trimmed || trimmed.length > 60) return;
          assign(trimmed);
        }}
      >
        <input
          autoFocus
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("sidebar.section.newContext")}
          aria-label={t("sidebar.section.newContextAria")}
          className="w-full border border-hairline bg-inset px-2.5 py-1 font-mono text-[12px] text-ink placeholder:text-ink-secondary focus:outline-none"
        />
        <Button
          type="submit"
          variant="secondary"
          size="xs"
          disabled={!trimmed || trimmed.length > 60}
        >
          {t("common.add")}
        </Button>
      </form>
      {current && (
        <>
          <div className="mx-2 my-1 border-t border-hairline" />
          <button
            onClick={() => assign("")}
            className="flex h-8 w-full items-center gap-2.5 px-2.5 text-left text-[13px] text-danger transition-colors hover:bg-raised-hover"
          >
            <FolderMinus size={15} />
            {t("sidebar.section.removeFromContext")}
          </button>
        </>
      )}
    </div>
  );
}

export function BotContextMenu({
  menu,
  onClose,
  onArchive,
  onDelete,
  onMoveToSection,
  onNewFolder,
}: {
  menu: MenuState;
  onClose: () => void;
  onArchive: (bot: Bot) => void;
  onDelete: (bot: Bot) => void;
  onMoveToSection: (botId: string) => void;
  onNewFolder: (botId: string) => void;
}) {
  const { state, dispatch } = useStore();
  const showThreads = useShowThreads();
  const remoteClient = window.ogb?.remoteClient?.active === true;
  const bot = state.bots.find((b) => b.id === menu.botId);
  const menuRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = menuRef.current;
    if (!element) return;
    const place = () => {
      const { width, height } = element.getBoundingClientRect();
      element.style.top = `${Math.max(8, Math.min(menu.y, window.innerHeight - height - 8))}px`;
      element.style.left = `${Math.max(8, Math.min(menu.x, window.innerWidth - width - 8))}px`;
    };
    // Menu length changes with thread settings, permissions, and locale.
    // Measure after every render; the viewport cap handles short windows.
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  });
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    menuRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
    return () => { if (opener?.isConnected) opener.focus(); };
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest("[data-bot-menu]")) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  if (!bot) return null;
  const deleting = state.deletingBots[bot.id] === true;
  const engine = state.instances.find((instance) => instance.instanceId === bot.modelSelection.instanceId);
  const canCoordinate = engine?.capabilities?.agentsMcp === true;
  const visibleBotCount = state.bots.filter((candidate) => !candidate.hidden).length;
  const archiveBlocked = Boolean(bot.chiefOfStaff) || visibleBotCount <= 1;
  const archiveHint = bot.chiefOfStaff
    ? t("sidebar.bot.archiveBlockedChief")
    : visibleBotCount <= 1
      ? t("sidebar.bot.archiveBlockedLast")
      : undefined;
  const item = (
    icon: React.ReactNode,
    label: string,
    onClick?: () => void,
    opts?: { danger?: boolean; disabled?: boolean; hint?: string },
  ) => (
    <button
      key={label}
      type="button"
      role="menuitem"
      disabled={opts?.disabled}
      onClick={() => {
        onClick?.();
        onClose();
      }}
      title={opts?.hint}
      className={cn(
        "flex h-8 w-full items-center gap-2.5 px-2.5 text-left text-[13px] transition-colors",
        opts?.danger ? "text-danger" : "text-ink",
        opts?.disabled ? "cursor-default opacity-40" : "hover:bg-raised-hover",
      )}
    >
      {icon}
      {label}
    </button>
  );
  const divider = (key: string) => <div key={key} className="my-1 h-px bg-hairline" />;

  return createPortal(
    <div
      ref={menuRef}
      data-bot-menu
      data-sidebar
      role="menu"
      aria-label={t("sidebar.bot.actions", { name: bot.name })}
      onKeyDown={navigateThreadMenu}
      style={{ top: menu.y, left: menu.x }}
      className="fixed z-40 max-h-[calc(100dvh-16px)] w-[228px] max-w-[calc(100vw-16px)] overflow-y-auto overscroll-contain border border-hairline bg-menu py-1 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.6)]"
    >
      {showThreads && <>
        {item(<Plus size={15} className="text-ink-secondary" />, t("task.newShort"), () => dispatch({ type: "newTask", botId: bot.id }))}
        {item(<FolderPlus size={15} className="text-ink-secondary" />, t("folder.new"), () => onNewFolder(bot.id))}
        {divider("threads")}
      </>}
      {remoteClient ? [
        item(<FolderPlus size={16} className="text-ink-secondary" />, t("sidebar.bot.moveToSection"), () => {
          onClose();
          onMoveToSection(bot.id);
        }),
        item(<Pencil size={16} className="text-ink-secondary" />, t("sidebar.bot.editProfile"), () => {
          dispatch({ type: "select", id: bot.id });
          dispatch({ type: "toggleSettings", open: true });
        }),
        item(<ClipboardCopy size={16} className="text-ink-secondary" />, t("sidebar.copyConversationId"), () => {
          void navigator.clipboard?.writeText(bot.threadId);
        }),
      ] : [
        item(
          bot.pinned ? <PinOff size={16} className="text-ink-secondary" /> : <Pin size={16} className="text-ink-secondary" />,
          bot.pinned ? t("sidebar.bot.unpin") : t("sidebar.bot.pin"),
          () => dispatch({ type: "updateBot", botId: bot.id, patch: { pinned: !bot.pinned } }),
        ),
        item(
          <Crown size={16} className={bot.chiefOfStaff ? "text-accent" : "text-ink-secondary"} />,
          bot.chiefOfStaff ? t("sidebar.bot.removeChief") : t("sidebar.bot.makeChief"),
          () => dispatch({ type: "updateBot", botId: bot.id, patch: { chiefOfStaff: !bot.chiefOfStaff } }),
          {
            disabled: !bot.chiefOfStaff && !canCoordinate,
            hint: !bot.chiefOfStaff && !canCoordinate ? t("sidebar.bot.chiefNeedsEngine") : undefined,
          },
        ),
        item(<FolderPlus size={16} className="text-ink-secondary" />, t("sidebar.bot.moveToSection"), () => {
          onClose();
          onMoveToSection(bot.id);
        }),
        item(<BellDot size={16} className="text-ink-secondary" />, t("sidebar.bot.markUnread"), () =>
          dispatch({ type: "markUnread", botId: bot.id }),
        ),
        divider("d1"),
        item(<Pencil size={16} className="text-ink-secondary" />, t("sidebar.bot.editProfile"), () => {
          dispatch({ type: "select", id: bot.id });
          dispatch({ type: "toggleSettings", open: true, section: "identity" });
        }),
        item(<Copy size={16} className="text-ink-secondary" />, t("sidebar.bot.duplicate"), () =>
          dispatch({ type: "duplicateBot", botId: bot.id }),
        ),
        divider("d2"),
        item(<ClipboardCopy size={16} className="text-ink-secondary" />, t("sidebar.copyConversationId"), () => {
          void navigator.clipboard?.writeText(bot.threadId);
        }),
        divider("d3"),
        item(
          <Archive size={16} className="text-ink-secondary" />,
          t("sidebar.bot.archive"),
          () => onArchive(bot),
          {
            disabled: archiveBlocked,
            hint: archiveHint,
          },
        ),
        <BotDeleteMenuItem
          key="delete"
          deleting={deleting}
          onClick={() => {
            onClose();
            onDelete(bot);
          }}
        />,
      ]}
    </div>,
    document.body,
  );
}

export type BotConfirmKind = "archive" | "delete";

/** A confirmation may span live fleet updates; never authorize from its snapshot. */
export function currentArchivableBot(bots: readonly Bot[], id: string): Bot | undefined {
  const active = bots.filter((candidate) => !candidate.hidden);
  if (active.length <= 1) return undefined;
  return active.find((candidate) => candidate.id === id && !candidate.chiefOfStaff);
}

/** Copy for the archive / delete confirmation dialogs. Archiving keeps
 * everything and is reversible from Archived bots; deleting is not — the
 * server drops every task transcript, the workspace (files + memory), and
 * staged skill state with the bot. */
export function botConfirmCopy(kind: BotConfirmKind, name: string) {
  return kind === "archive"
    ? {
        title: t("sidebar.confirm.archiveTitle", { name }),
        body: t("sidebar.confirm.archiveBody", { name }),
        confirmLabel: t("sidebar.bot.archive"),
        tone: "neutral" as const,
      }
    : {
        title: t("sidebar.confirm.deleteTitle", { name }),
        body: t("sidebar.confirm.deleteBody", { name }),
        confirmLabel: t("common.delete"),
        tone: "danger" as const,
      };
}

export function archivedDeleteAllCopy() {
  return {
    title: t("sidebar.archived.deleteAllTitle"),
    body: t("sidebar.archived.deleteAllBody"),
    confirmLabel: t("sidebar.archived.deleteAll"),
    tone: "danger" as const,
  };
}

export function BotDeleteMenuItem({ deleting, onClick }: { deleting: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={deleting}
      aria-busy={deleting || undefined}
      onClick={onClick}
      title={deleting ? t("sidebar.bot.deleteCheckingTitle") : undefined}
      className={cn(
        "flex h-8 w-full items-center gap-2.5 px-2.5 text-left text-[13px] text-danger transition-colors",
        deleting ? "cursor-default opacity-40" : "hover:bg-raised-hover",
      )}
    >
      {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
      {deleting ? t("sidebar.bot.deleteChecking") : t("common.delete")}
    </button>
  );
}

export function BotThreadList({ bot, selected, density = "comfortable", query = "", hidden = false }: { bot: Bot; selected: boolean; density?: SidebarDensity; query?: string; hidden?: boolean }) {
  const { state, dispatch } = useStore();
  const tasks = (bot.tasks ?? [{ threadId: bot.threadId, title: t("task.newShort"), createdAt: 0 }])
    .filter((task) => !task.routineRunId)
    .map((task) => ({ ...task, queued: Boolean(state.pendingQueued[task.threadId]?.length) }));
  const projects = bot.projects ?? [];
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [folderMenu, setFolderMenu] = useState<{ projectId: string; left: number; top: number } | null>(null);
  const [markingRead, setMarkingRead] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [readStatus, setReadStatus] = useState("");
  const [reordering, setReordering] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [reorderStatus, setReorderStatus] = useState("");
  const [folderDrop, setFolderDrop] = useState<{ id: string; place: "before" | "after" } | null>(null);
  const draggingFolder = useRef<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const currentProjectId = tasks.find((task) => task.threadId === bot.threadId)?.projectId;
  useEffect(() => {
    if (selected && currentProjectId) setCollapsed((previous) => {
      if (!previous.has(currentProjectId)) return previous;
      const next = new Set(previous);
      next.delete(currentProjectId);
      return next;
    });
  }, [selected, currentProjectId]);
  const visibleTasks = visibleSidebarThreads(tasks, bot.threadId, query, projects, showAll);
  useRevealedThreadRow(state.revealThread, selected ? bot.threadId : null);
  const renderThread = (task: (typeof tasks)[number]) => {
    const thread = currentTaskBot(bot, task.threadId);
    return <SidebarThreadRow key={task.threadId} task={{ ...task, busy: thread.busy, activity: thread.activity }} current={selected && task.threadId === bot.threadId} compact={density === "compact"} folders={projects}
      onSelect={() => { if (task.threadId !== bot.threadId) dispatch({ type: "switchTask", botId: bot.id, threadId: task.threadId }); else dispatch({ type: "select", id: bot.id }); }}
      onRename={(title) => dispatch({ type: "renameTask", botId: bot.id, threadId: task.threadId, title })}
      onDelete={() => dispatch({ type: "deleteTask", botId: bot.id, threadId: task.threadId })}
      onMove={(projectId) => dispatch({ type: "updateTask", botId: bot.id, threadId: task.threadId, patch: { projectId } })} />;
  };
  const ungrouped = visibleTasks.filter((task) => !projects.some((project) => project.id === task.projectId));
  const projectToEdit = projects.find((project) => project.id === editingProject);
  const projectIds = projects.map((project) => project.id);
  const saveOrder = (ids: string[], onSaved?: () => void) => {
    if (reordering || ids.every((id, index) => id === projectIds[index])) return;
    setReordering(true); setReorderError(null); setReorderStatus(t("folder.reordering"));
    dispatch({ type: "reorderProjects", botId: bot.id, projectIds: ids,
      onSaved: () => { setReordering(false); setReorderStatus(t("folder.reordered")); onSaved?.(); },
      onError: (message) => { setReordering(false); setReorderStatus(""); setReorderError(message); } });
  };
  const resetFolderDrag = () => { draggingFolder.current = null; setFolderDrop(null); };
  const readFolder = async (projectId: string, onSaved: () => void) => {
    if (markingRead) return;
    setMarkingRead(true); setReadError(null); setReadStatus(t("folder.markingRead"));
    try {
      await markFolderRead(bot, projectId, api, (updated) => dispatch({ type: "botPatched", bot: updated }));
      setReadStatus(t("folder.markedRead"));
      onSaved();
    } catch (error) {
      setReadError(error instanceof Error ? error.message : String(error));
      setReadStatus("");
    } finally { setMarkingRead(false); }
  };
  return (
    <div hidden={hidden} className="mb-2 ml-5 space-y-0.5 border-l border-dashed border-hairline pl-2" role="group" aria-label={t("task.namedList", { name: bot.name })}
      onDragOver={(event) => { if (event.dataTransfer.types.includes(FOLDER_DRAG_TYPE)) event.stopPropagation(); }}
      onDrop={(event) => { if (event.dataTransfer.types.includes(FOLDER_DRAG_TYPE)) { event.preventDefault(); event.stopPropagation(); resetFolderDrag(); } }}>
      {!hidden && <>
      {projects.map((project, index) => {
        const projectTasks = tasks.filter((task) => task.projectId === project.id);
        const visible = visibleTasks.filter((task) => task.projectId === project.id);
        if (query && visible.length === 0 && !project.name.toLowerCase().includes(query.toLowerCase())) return null;
        const open = Boolean(query) || !collapsed.has(project.id);
        const waiting = projectTasks.some((task) => task.activity === "waiting-on-you");
        const working = projectTasks.some((task) => task.busy);
        return <div key={project.id} data-sidebar-project={project.id}>
          <div data-sidebar-folder-row={project.id} draggable={!reordering}
            onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setFolderMenu({ projectId: project.id, left: event.clientX, top: event.clientY }); }}
            onDragStart={(event) => {
              event.stopPropagation();
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData(FOLDER_DRAG_TYPE, JSON.stringify({ botId: bot.id, projectId: project.id }));
              draggingFolder.current = project.id;
            }}
            onDragEnd={(event) => { event.stopPropagation(); resetFolderDrag(); }}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes(FOLDER_DRAG_TYPE)) return;
              event.stopPropagation();
              if (!draggingFolder.current || reordering) { event.dataTransfer.dropEffect = "none"; return; }
              event.preventDefault(); event.dataTransfer.dropEffect = "move";
              const rect = event.currentTarget.getBoundingClientRect();
              setFolderDrop({ id: project.id, place: event.clientY < rect.top + rect.height / 2 ? "before" : "after" });
            }}
            onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setFolderDrop(null); }}
            onDrop={(event) => {
              if (!event.dataTransfer.types.includes(FOLDER_DRAG_TYPE)) return;
              event.preventDefault(); event.stopPropagation();
              const from = draggedFolder(event.dataTransfer.getData(FOLDER_DRAG_TYPE), bot.id, projectIds);
              const rect = event.currentTarget.getBoundingClientRect();
              if (from) saveOrder(placeFolder(projectIds, from, project.id, event.clientY < rect.top + rect.height / 2 ? "before" : "after"));
              resetFolderDrag();
            }}
            className={cn("group/folder flex items-center gap-0.5 text-ink-secondary transition-colors hover:bg-raised-hover",
              folderDrop?.id === project.id && draggingFolder.current !== project.id && (folderDrop.place === "before" ? "shadow-[0_-2px_var(--color-ink)]" : "shadow-[0_2px_var(--color-ink)]"))}>
            <button type="button" aria-expanded={open} onClick={() => setCollapsed((previous) => {
              const next = new Set(previous);
              if (next.has(project.id)) next.delete(project.id); else next.add(project.id);
              return next;
            })} className="flex size-6 shrink-0 items-center justify-center outline-none hover:text-ink focus-visible:ring-1 focus-visible:ring-accent/60" aria-label={t(open ? "task.collapseNamed" : "task.expandNamed", { name: project.name })}>
              <ChevronRight aria-hidden="true" size={11} className={cn("shrink-0 transition-transform", open && "rotate-90")} />
            </button>
            <button type="button" aria-label={t("folder.iconNamed", { name: project.name })} title={t("folder.iconNamed", { name: project.name })} onClick={() => setEditingProject(project.id)} className="flex size-6 shrink-0 items-center justify-center hover:bg-raised-hover"><FolderIcon emoji={project.emoji} size={14} /></button>
            <button type="button" data-sidebar-folder-label={project.id} draggable={!reordering} aria-expanded={open} onClick={() => setCollapsed((previous) => {
              const next = new Set(previous);
              if (next.has(project.id)) next.delete(project.id); else next.add(project.id);
              return next;
            })} className="flex min-h-8 min-w-0 flex-1 cursor-grab select-none items-center gap-1.5 py-1 text-left text-[13px] font-semibold active:cursor-grabbing" title={project.name}>
              <span className="truncate">{project.name}</span>
              <span className="shrink-0 text-[10px] font-normal opacity-50">{projectTasks.length}</span>
              {!open && (waiting ? <span className="text-[10px] text-warning">{t("task.waiting")}</span> : working ? <Loader2 size={10} className="shrink-0 animate-spin text-success" /> : projectTasks.some((task) => task.unread) ? <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-label={t("task.unreadMany")} /> : null)}
            </button>
            <button type="button" title={t("task.newIn", { name: project.name })} aria-label={t("task.newIn", { name: project.name })} onClick={() => dispatch({ type: "newTask", botId: bot.id, projectId: project.id })}
              className="flex size-6 items-center justify-center opacity-0 hover:bg-raised-hover hover:text-ink focus-visible:opacity-100 group-hover/folder:opacity-100 max-md:opacity-70"><Plus size={12} /></button>
            <FolderActions project={project} canMoveUp={index > 0} canMoveDown={index < projects.length - 1} canMarkRead={folderUnreadThreadIds(bot, project.id).length > 0} saving={reordering || markingRead}
              menu={folderMenu?.projectId === project.id ? folderMenu : null} onMenuChange={(menu) => setFolderMenu(menu ? { ...menu, projectId: project.id } : null)}
              onEdit={() => setEditingProject(project.id)} onMove={(direction, onSaved) => saveOrder(moveFolder(projectIds, project.id, direction), onSaved)}
              onMarkRead={(onSaved) => { void readFolder(project.id, onSaved); }} />
          </div>
          {open && <div className="ml-3 border-l border-dashed border-hairline pl-2" role="group" aria-label={t("task.namedList", { name: project.name })}>
            {visible.map(renderThread)}
            {projectTasks.length === 0 && <p className="px-2.5 py-1 text-[11px] text-ink-secondary/70">{t("task.empty")}</p>}
          </div>}
        </div>;
      })}
      {reorderError && <p role="alert" className="px-2.5 py-1 text-[12px] text-danger">{reorderError}</p>}
      <span role="status" className="sr-only">{reorderStatus}</span>
      {readError && <p role="alert" className="px-2.5 py-1 text-[12px] text-danger">{readError}</p>}
      <span role="status" className="sr-only">{readStatus}</span>
      {projects.length > 0 && ungrouped.length > 0 && <div className="px-3 pb-1 pt-2 text-[10.5px] text-ink-secondary/70">{t("task.list")}</div>}
      {ungrouped.map(renderThread)}
      {!query && !showAll && tasks.length > visibleTasks.length && <button type="button" onClick={() => setShowAll(true)} className="px-3 py-1.5 text-[11px] text-ink-secondary hover:text-ink">{t("task.showAll", { count: tasks.length })}</button>}
      <NewThreadButton bot={bot} className="mt-1 w-full" />
      {projectToEdit && <BotProjectDialog bot={bot} project={projectToEdit} onClose={() => setEditingProject(null)} />}
      </>}
    </div>
  );
}

export function BotListItem({
  bot,
  density,
  query = "",
  onMenu,
}: {
  bot: Bot;
  density: SidebarDensity;
  query?: string;
  onMenu: (menu: MenuState) => void;
}) {
  const { state, dispatch } = useStore();
  const showThreads = useShowThreads();
  const remoteClient = typeof window !== "undefined" && window.ogb?.remoteClient?.active === true;
  const [renaming, setRenaming] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const selected = state.activeView === "chat" && state.selectedId === bot.id;
  const [threadsOpen, setThreadsOpen] = useState(Boolean(query));
  useEffect(() => { if (query && showThreads) setThreadsOpen(true); }, [query, showThreads]);
  // a thread opened from a chip or #Title link: unfold this bot so the row
  // it lands on is on screen (BotThreadList scrolls it into view)
  const reveal = state.revealThread;
  const revealHere = Boolean(reveal && (bot.threadId === reveal.threadId || bot.tasks?.some((task) => task.threadId === reveal.threadId)));
  useEffect(() => { if (revealHere && showThreads) setThreadsOpen(true); }, [reveal, revealHere, showThreads]);
  const deleting = state.deletingBots[bot.id] === true;
  const mascotMotion = selected && state.mascotMotion?.botId === bot.id ? state.mascotMotion : null;
  const iconOnly = density === "icons";
  const expanded = showThreads && !iconOnly && threadsOpen;
  useEffect(() => {
    if (iconOnly) setRenaming(false);
  }, [iconOnly]);
  const avatarSize = iconOnly ? 44 : density === "compact" ? (showThreads ? 26 : 40) : (showThreads ? 32 : 56);
  // the visible branch, so a version switch changes the row with the chat
  const visible = visibleMessages(bot);
  const last = visible.at(-1);
  // the role from Bot Settings → Title. A badge or tooltip beside the name
  // (#866, #871) always traded the name's width against the title's; its own
  // line above the name lets both truncate independently instead.
  const title = bot.title.trim();
  const rowClass = cn(
    "flex w-full items-center text-left outline-none transition-colors focus-visible:ring-1 focus-visible:ring-focus",
    iconOnly
      ? "justify-center px-1 py-1.5"
      : density === "compact"
        ? cn(showThreads ? "gap-1.5 py-1 pl-6" : "gap-2 py-1.5 pl-2", showThreads ? "pr-9 group-hover:pr-16 group-focus-within:pr-16 max-md:pr-16" : "pr-9")
        : cn(showThreads ? "gap-2 py-2 pl-6" : "gap-3 py-2.5 pl-2", showThreads ? "pr-9 group-hover:pr-16 group-focus-within:pr-16 max-md:pr-16" : "pr-9"),
    selected ? "bg-raised text-ink shadow-[inset_2px_0_0_var(--color-ink)]" : "text-ink hover:bg-raised-hover",
  );
  const activityTasks = sidebarBotActivityTasks(bot, state.pendingQueued);
  const waiting = bot.activity === "waiting-on-you" || activityTasks.some((task) => task.activity === "waiting-on-you");
  const working = !waiting && (Boolean(bot.busy) || activityTasks.some((task) => task.busy || task.activity === "working"));
  const queued = activityTasks.some((task) => task.queued);
  const unread = bot.unread || activityTasks.some((task) => task.unread);
  const body = (
    <>
      {/* flex, not inline: an inline wrapper adds a baseline gap under the
          avatar and makes the row taller than before the presence dot */}
      <span className="relative flex shrink-0">
        <BotAvatar
          bot={bot}
          state={stateForBot({ ...bot, messages: visible })}
          size={avatarSize}
          motion={mascotMotion?.kind ?? "none"}
          motionKey={mascotMotion?.nonce ?? 0}
          // Motion means something is happening. A resting bot holds a resting
          // pose — N idle rows bobbing at display rate was most of the app's
          // visible-idle CPU (states are keyword-derived, so "working" can be
          // decorative; busy/unread/motion are the real signals).
          animated={Boolean(bot.busy) || Boolean(bot.unread) || (mascotMotion?.kind ?? "none") !== "none"}
        />
        {working && (
          // presence dot: green while the bot is working, ringed in the row's
          // ground so it reads on both a photo and the mascot. Also the only
          // activity signal in icons-only density, where the text is hidden.
          <span
            data-testid="working-dot"
            className={cn(
              "absolute -right-0.5 -bottom-0.5 rounded-full border-2 border-panel bg-success",
              iconOnly ? "size-3" : "size-2.5",
            )}
          />
        )}
        {waiting && <span data-testid="waiting-dot" role="status" aria-label={t("sidebar.preview.waiting")} title={t("sidebar.preview.waiting")}
          className={cn("absolute -right-0.5 -bottom-0.5 rounded-full border-2 border-panel bg-warning", iconOnly ? "size-3" : "size-2.5")} />}
        {!waiting && !working && queued && <span data-testid="queued-dot" role="status" aria-label={t("task.queued")} title={t("task.queued")}
          className={cn("absolute -right-0.5 -bottom-0.5 rounded-full border-2 border-panel bg-ink-secondary", iconOnly ? "size-3" : "size-2.5")} />}
      </span>
      <div className={cn("min-w-0 flex-1", iconOnly && "hidden")}>
        {title && !renaming && (
          <div className="truncate text-[11px] font-mono text-ink-secondary">{title}</div>
        )}
        <div className="flex items-baseline justify-between gap-2">
          <span className="flex min-w-0 grow items-center gap-1.5 truncate text-[14px] font-semibold text-ink">
            {bot.pinned && <Pin size={12} className="shrink-0 text-ink-secondary" />}
            <RenameTitle
              key={iconOnly ? "icons" : "expanded"}
              value={bot.name}
              onCommit={(name) => {
                if (remoteClient) {
                  void api(`/api/bots/${bot.id}/profile`, { method: "PATCH", body: JSON.stringify({ name }) })
                    .then(({ bot: updated }) => dispatch({ type: "botPatched", bot: updated }))
                    .catch((cause) => dispatch({ type: "error", message: cause instanceof Error ? cause.message : String(cause) }));
                } else {
                  dispatch({ type: "updateBot", botId: bot.id, patch: { name } });
                }
              }}
              onEditingChange={setRenaming}
              className="truncate"
              inputClassName="w-full border border-hairline bg-inset px-1 py-0.5 font-mono text-[13px] font-medium text-ink outline-none"
            />
          </span>
          {selected && last && !renaming && !expanded && (
            <span className="shrink-0 font-mono text-[10px] text-ink-secondary transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">
              {formatTime(last.at)}
            </span>
          )}
          {expanded && unread && <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-label={t("task.unreadMany")} />}
        </div>
        {bot.chiefOfStaff && !renaming && (
          <span className="flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink">
            <Crown size={11} className="shrink-0" /> {t("sidebar.bot.chiefOfStaff")}
          </span>
        )}
        {(!expanded || deleting) && <div className="flex items-center justify-between gap-2">
          {deleting ? (
            <span role="status" className="flex min-w-0 items-center gap-1.5 truncate font-mono text-[11px] text-ink-secondary">
              <Loader2 size={12} className="shrink-0 animate-spin" />
              {t("sidebar.bot.deletingRow")}
            </span>
          ) : (
            <span className="flex min-w-0 items-center gap-1.5 truncate text-[11px] text-ink-secondary">
              {working ? (
                // the same typing dots as the chat header; sized to the text's
                // line box so the row does not jump when work starts or ends
                <span className="flex h-[1.5em] items-center" role="status">
                  <WorkingDots size={3.5} />
                  <span className="sr-only">{t("sidebar.preview.working")}</span>
                </span>
              ) : (
                <span className="truncate">{waiting ? t("sidebar.preview.waiting") : queued ? t("task.queued") : preview(bot)}</span>
              )}
            </span>
          )}
          {unread && (
            <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-label={t("task.unreadMany")} />
          )}
        </div>}
      </div>
    </>
  );
  const onContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    onMenu({ botId: bot.id, x: event.clientX, y: event.clientY });
  };
  const onSelect = (event: React.MouseEvent) => {
    if (renaming) return;
    const insideRenameInput = event.target instanceof HTMLInputElement;
    if (botListItemPointerIntent(event.type, insideRenameInput) === "select") {
      dispatch({ type: "select", id: bot.id });
    }
  };

  return (
    <>
    <div className="group relative" title={iconOnly ? bot.name : undefined}>
      {/* Keep this wrapper mounted while RenameTitle swaps its label for an
          input. Replacing the wrapper tree remounts RenameTitle, loses its
          editing state, and leaves the row stuck in rename mode. Omitting
          role=button also keeps the input visible to assistive technology. */}
      <div
        role={renaming ? undefined : "button"}
        tabIndex={renaming ? undefined : 0}
        aria-current={selected ? "page" : undefined}
        title={bot.name}
        aria-label={
          !renaming && iconOnly
            ? deleting
              ? t("sidebar.bot.deletingAria", { name: bot.name })
              : `${bot.name}${waiting ? ` · ${t("sidebar.preview.waiting")}` : working ? ` · ${t("chat.activity.working")}` : queued ? ` · ${t("task.queued")}` : ""}${unread ? ` · ${t("task.unread")}` : ""}`
            : undefined
        }
        aria-busy={deleting || undefined}
        data-sidebar-bot-row={bot.id}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (renaming) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            dispatch({ type: "select", id: bot.id });
          }
        }}
        onContextMenu={onContextMenu}
        className={rowClass}
      >
        {body}
      </div>
      {showThreads && !iconOnly && <button
        type="button"
        aria-label={t(threadsOpen ? "task.collapseNamed" : "task.expandNamed", { name: bot.name })}
        aria-expanded={threadsOpen}
        onClick={() => setThreadsOpen((open) => !open)}
        className="absolute left-0.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center text-ink-secondary outline-none hover:text-ink focus-visible:ring-1 focus-visible:ring-focus"
      ><ChevronRight aria-hidden="true" size={13} className={cn("transition-transform", threadsOpen && "rotate-90")} /></button>}
      {!renaming && iconOnly && unread && (
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 size-2 rounded-full border border-panel bg-accent" />
      )}
      {!renaming && !deleting && !iconOnly && <>
        {showThreads && <button type="button" aria-label={t("folder.newNamed", { name: bot.name })} title={t("folder.new")} onClick={() => { setThreadsOpen(true); setCreatingProject(true); }}
          className="pointer-events-none absolute right-8 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center text-ink-secondary opacity-0 hover:bg-raised-hover hover:text-ink group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 max-md:pointer-events-auto max-md:opacity-70 outline-none focus-visible:ring-1 focus-visible:ring-focus"><FolderPlus size={14} /></button>}
        <button type="button" aria-label={t("sidebar.bot.actions", { name: bot.name })} title={t("sidebar.bot.actions", { name: bot.name })} aria-haspopup="menu" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); onMenu({ botId: bot.id, x: rect.left, y: rect.bottom }); }}
          className="pointer-events-none absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center text-ink-secondary opacity-0 hover:bg-raised-hover hover:text-ink group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 max-md:pointer-events-auto max-md:opacity-70 outline-none focus-visible:ring-1 focus-visible:ring-focus"><MoreHorizontal size={15} /></button>
      </>}
      {deleting && iconOnly && (
        <span className="pointer-events-none absolute bottom-1 right-1 rounded-full bg-card p-1 text-ink-secondary">
          <Loader2 size={12} className="animate-spin" />
        </span>
      )}
    </div>
    {/* Keep folder expansion state mounted while the preference is off. The
        hidden list omits its children, including any thread-menu portals. */}
    {!iconOnly && threadsOpen && <BotThreadList bot={bot} selected={selected} density={density} hidden={!showThreads} query={bot.name.toLowerCase().includes(query.toLowerCase()) || bot.title.toLowerCase().includes(query.toLowerCase()) ? "" : query} />}
    {!expanded && <SidebarBotActivity bot={bot} density={density} />}
    {showThreads && creatingProject && <BotProjectDialog bot={bot} onClose={() => setCreatingProject(false)} />}
    </>
  );
}

export function ArchivedBotRow({
  bot,
  restoring,
  deleting,
  disabled,
  onRestore,
  onDelete,
}: {
  bot: Bot;
  restoring: boolean;
  deleting: boolean;
  disabled: boolean;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex min-h-[76px] items-center gap-3 border-b border-hairline px-1 py-2.5">
      <BotAvatar bot={bot} state="happy" size={40} animated={false} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium text-ink">{bot.name}</div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-ink-secondary">{bot.title || t("sidebar.archived.botFallback")}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={onRestore}
          disabled={disabled || deleting}
          className="flex min-w-[78px] items-center justify-center gap-1.5 border border-hairline bg-raised px-3 py-1.5 font-mono text-[11px] text-ink hover:bg-raised-hover disabled:opacity-40"
        >
          {restoring && <Loader2 size={12} className="animate-spin" />}
          {t("sidebar.archived.restore")}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled || deleting}
          aria-label={t("sidebar.archived.deleteAria", { name: bot.name })}
          className="flex items-center justify-center gap-1.5 border border-transparent px-3 py-1.5 font-mono text-[11px] text-danger hover:bg-raised-hover disabled:opacity-40"
        >
          {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          {t("common.delete")}
        </button>
      </div>
    </div>
  );
}

function ArchivedBotsPanel({
  bots,
  onClose,
  onRestored,
}: {
  bots: Bot[];
  onClose: () => void;
  onRestored: (message: string) => void;
}) {
  const { state, dispatch } = useStore();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [restoringAll, setRestoringAll] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Bot | "all" | null>(null);
  const [error, setError] = useState("");
  const deleting = bots.some((bot) => Boolean(state.deletingBots[bot.id]));
  const locked = restoringAll || Boolean(busyId) || deleting || Boolean(pendingDelete);

  useEffect(() => {
    if (bots.length === 0) onClose();
  }, [bots.length, onClose]);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !locked) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [locked, onClose]);

  const restore = async (bot: Bot) => {
    setBusyId(bot.id);
    setError("");
    try {
      const response = await api(`/api/bots/${bot.id}`, {
        method: "PATCH",
        body: JSON.stringify({ hidden: false }),
      });
      dispatch({ type: "botPatched", bot: response.bot });
      dispatch({ type: "select", id: bot.id });
      onRestored(t("sidebar.archived.restored", { name: bot.name }));
      if (bots.length === 1) onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(null);
    }
  };

  const restoreAll = async () => {
    setRestoringAll(true);
    setError("");
    try {
      const responses = await Promise.all(
        bots.map((bot) =>
          api(`/api/bots/${bot.id}`, {
            method: "PATCH",
            body: JSON.stringify({ hidden: false }),
          }),
        ),
      );
      for (const response of responses) dispatch({ type: "botPatched", bot: response.bot });
      const first = bots[0];
      if (first) dispatch({ type: "select", id: first.id });
      onRestored(
        bots.length === 1
          ? t("sidebar.archived.restoredOne")
          : t("sidebar.archived.restoredMany", { count: bots.length }),
      );
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setRestoringAll(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(event) => event.target === event.currentTarget && !locked && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="archived-bots-title"
        tabIndex={-1}
        className="animate-view-enter relative flex max-h-[min(680px,calc(100dvh-2rem))] w-full max-w-[760px] flex-col overflow-hidden border border-hairline bg-card shadow-[0_24px_64px_-24px_rgb(0_0_0/0.6)] outline-none"
        style={{ ["--frame-surface" as string]: "var(--color-card)" }}
      >
        <span aria-hidden className="frame-corner" data-corner="tl" />
        <span aria-hidden className="frame-corner" data-corner="tr" />
        <span aria-hidden className="frame-corner" data-corner="bl" />
        <span aria-hidden className="frame-corner" data-corner="br" />
        <header className="frame-rule-below flex items-start justify-between gap-4 px-6 pb-4 pt-5 sm:px-8">
          <div>
            <h2 id="archived-bots-title" className="label-mono text-[14px] text-ink">
              <span className="text-ink-secondary">[ </span>
              {t("sidebar.archived.title")}
              <span className="text-ink-secondary"> ]</span>
            </h2>
            <p className="mt-1 text-[12px] text-ink-secondary">{t("sidebar.archived.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            {bots.length > 1 && (
              <Button
                onClick={() => void restoreAll()}
                disabled={locked}
                variant="secondary"
                size="sm"
              >
                {restoringAll && <Loader2 size={12} className="animate-spin" />}
                {t("sidebar.archived.restoreAll")}
              </Button>
            )}
            {bots.length > 0 && (
              <Button
                type="button"
                onClick={() => setPendingDelete("all")}
                disabled={locked}
                variant="danger"
                size="sm"
              >
                <Trash2 size={12} />
                {t("sidebar.archived.deleteAll")}
              </Button>
            )}
            <button
              onClick={onClose}
              disabled={locked}
              className="flex size-7 items-center justify-center text-ink-secondary hover:bg-raised-hover hover:text-ink disabled:opacity-40"
              aria-label={t("sidebar.archived.close")}
            >
              <X size={16} />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-7 pt-3 sm:px-8">
          <div className="label-mono mb-3 text-ink-secondary">{t("sidebar.archived.count", { count: bots.length })}</div>
          <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
            {bots.map((bot) => (
              <ArchivedBotRow
                key={bot.id}
                bot={bot}
                restoring={busyId === bot.id}
                deleting={Boolean(state.deletingBots[bot.id])}
                disabled={locked}
                onRestore={() => void restore(bot)}
                onDelete={() => setPendingDelete(bot)}
              />
            ))}
          </div>
          {error && <div role="alert" className="mt-4 border border-danger/40 bg-card p-3 font-mono text-[12px] text-danger">{error}</div>}
        </div>
      </div>
      <ConfirmDialog
        open={pendingDelete !== null}
        {...(pendingDelete === "all"
          ? archivedDeleteAllCopy()
          : botConfirmCopy("delete", pendingDelete?.name ?? ""))}
        icon={<Trash2 size={18} />}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          const target = pendingDelete;
          setPendingDelete(null);
          if (target === "all") {
            for (const bot of bots) dispatch({ type: "deleteBot", botId: bot.id });
            return;
          }
          dispatch({ type: "deleteBot", botId: target.id });
        }}
      />
    </div>,
    document.body,
  );
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const showThreads = useShowThreads();
  const remoteClient = window.ogb?.remoteClient?.active === true;
  const { capabilities } = useDesktopCapabilities();
  const importReturnRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const [confirm, setConfirm] = useState<{ kind: BotConfirmKind; bot: Bot } | null>(null);
  const cancelConfirm = useCallback(() => setConfirm(null), []);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [sectionPicker, setSectionPicker] = useState<MenuState | null>(null);
  const [newTeam, setNewTeam] = useState(false);
  const [moveToTeam, setMoveToTeam] = useState<string | null>(null);
  const [roomMenu, setRoomMenu] = useState<{ groupId: string; x: number; y: number } | null>(null);
  const [roomSectionPicker, setRoomSectionPicker] = useState<{ groupId: string; x: number; y: number } | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const [newRoom, setNewRoom] = useState(false);
  const [newFolderBotId, setNewFolderBotId] = useState<string | null>(null);
  const [teamLibraryOpen, setTeamLibraryOpen] = useState(false);
  const [teamInstallUrl, setTeamInstallUrl] = useState<string | null>(null);
  const [archivedBotsOpen, setArchivedBotsOpen] = useState(false);
  const [teamFeedback, setTeamFeedback] = useState<{
    error: boolean;
    text: string;
    restoreBot?: { id: string; name: string };
  } | null>(null);
  const [query, setQuery] = useState("");
  const [density, setDensityState] = useState<SidebarDensity>(() => loadSidebarDensity());
  const [lastExpandedDensity, setLastExpandedDensity] = useState<Exclude<SidebarDensity, "icons">>(() => {
    const saved = loadSidebarDensity();
    return saved === "icons" ? "comfortable" : saved;
  });
  const [densityOpen, setDensityOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<string[]>(() => loadCollapsedSections());
  const [sectionOrder, setSectionOrder] = useState<string[]>(() => loadSectionOrder());
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; place: SectionDropPlace } | null>(null);
  const [reorderAnnouncement, setReorderAnnouncement] = useState("");
  const sectionDragRef = useRef<{
    from: string | null;
    over: { id: string; place: SectionDropPlace } | null;
  }>({ from: null, over: null });
  const roomListRef = useRef<HTMLDivElement>(null);

  const isRoomsActive = state.activeView === "chat" && !state.pluginsOpen && !state.activityOpen;
  const isHubActive = state.pluginsOpen && state.pluginsSurface === "hub" && state.hubTab !== "asps";
  const isAspActive = state.pluginsOpen && state.pluginsSurface === "hub" && state.hubTab === "asps";
  const isActivityActive = Boolean(state.activityOpen);
  const isRoutinesActive = state.activeView === "routines";
  const isEvaluatorActive = state.activeView === "okx-evaluator";

  const handleRoomsClick = () => {
    if (state.activeView !== "chat") dispatch({ type: "showChat" });
    if (state.pluginsOpen) dispatch({ type: "togglePlugins", open: false });
    if (state.activityOpen) dispatch({ type: "toggleActivity", open: false });
    roomListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    roomListRef.current?.focus();
  };

  const handleHubClick = () => {
    dispatch({ type: "togglePlugins", open: true, surface: "hub", hubTab: "agents" });
  };

  const handleAspDirectoryClick = () => {
    dispatch({ type: "togglePlugins", open: true, surface: "hub", hubTab: "asps" });
  };

  const handleActivityClick = () => {
    dispatch({ type: "toggleActivity" });
  };

  const handleRoutinesClick = () => {
    dispatch({ type: "showRoutines" });
  };

  const handleEvaluatorClick = () => {
    dispatch({ type: "showEvaluator" });
  };

  const setDensity = (next: SidebarDensity) => {
    setDensityState(next);
    if (next !== "icons") setLastExpandedDensity(next);
    // Search is hidden in avatar-only mode. Keeping its value would silently
    // filter bots, rooms, and message results with no visible way to clear it.
    else setQuery("");
    saveSidebarDensity(next);
    setDensityOpen(false);
  };

  const toggleCollapsed = () => {
    if (density === "icons") setDensity(lastExpandedDensity);
    else {
      setLastExpandedDensity(density);
      setDensity("icons");
    }
  };

  // Esc closes the drawer, mirroring ApiKeys.tsx:75-85. Bound only while the
  // drawer is open — on mobile, exactly when a bot/room context menu or the
  // New Room panel can be open on top of it, so the same Escape press closes
  // them together. Fine, since both directions are "get me out of here."
  useEffect(() => {
    if (!open || confirm) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose, confirm]);

  useEffect(() => {
    if (!densityOpen) return;
    const closeDensityMenu = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDensityOpen(false);
    };
    window.addEventListener("keydown", closeDensityMenu);
    return () => window.removeEventListener("keydown", closeDensityMenu);
  }, [densityOpen]);

  useEffect(() => {
    if (remoteClient) return;
    return window.ogb?.onPackageInstall?.((url) => {
      setTeamInstallUrl(url);
      setTeamLibraryOpen(true);
    });
  }, [remoteClient]);

  useEffect(() => {
    if (!teamFeedback) return;
    const timer = window.setTimeout(() => setTeamFeedback(null), 5000);
    return () => window.clearTimeout(timer);
  }, [teamFeedback]);


  // Archive and delete share one pending confirmation at a time.
  const requestArchive = (bot: Bot) => {
    const current = currentArchivableBot(state.bots, bot.id);
    if (current) setConfirm({ kind: "archive", bot: current });
  };

  const archiveBot = async ({ id }: Pick<Bot, "id">) => {
    const bot = currentArchivableBot(state.bots, id);
    if (!bot) return;
    const activeBots = state.bots.filter((candidate) => !candidate.hidden);
    setTeamFeedback(null);
    try {
      const response = await api(`/api/bots/${bot.id}`, {
        method: "PATCH",
        body: JSON.stringify({ hidden: true }),
      });
      dispatch({ type: "botPatched", bot: response.bot });
      if (state.selectedId === bot.id) {
        const next = activeBots.find((candidate) => candidate.id !== bot.id);
        if (next) dispatch({ type: "select", id: next.id });
      }
      setTeamFeedback({
        error: false,
        text: t("sidebar.bot.archived", { name: bot.name }),
        restoreBot: { id: bot.id, name: bot.name },
      });
    } catch (cause) {
      setTeamFeedback({ error: true, text: cause instanceof Error ? cause.message : String(cause) });
    }
  };

  const undoBotArchive = async (bot: { id: string; name: string }) => {
    setTeamFeedback(null);
    try {
      const response = await api(`/api/bots/${bot.id}`, {
        method: "PATCH",
        body: JSON.stringify({ hidden: false }),
      });
      dispatch({ type: "botPatched", bot: response.bot });
      dispatch({ type: "select", id: bot.id });
      setTeamFeedback({ error: false, text: t("sidebar.archived.restored", { name: bot.name }) });
    } catch (cause) {
      setTeamFeedback({ error: true, text: cause instanceof Error ? cause.message : String(cause) });
    }
  };

  const macInset = capabilities.windowChrome === "mac-inset";
  // macOS owns inset traffic lights; Windows hides the native bar and draws
  // caption buttons over the header's right end. Either way this top row is
  // the window's drag handle (ChatView/GroupView headers do the same).
  // Browser/Linux keep this corner empty — no decorative traffic lights.
  const draggableChrome = macInset || capabilities.windowChrome === "win-caption";
  // SAFETY: Electron's documented -webkit-app-region CSS property is not in
  // React's CSSProperties type, but the renderer accepts it as an inline style.
  const windowDragStyle = draggableChrome
    ? ({ WebkitAppRegion: "drag" } as React.CSSProperties)
    : undefined;
  // SAFETY: Same Electron-only CSS property as windowDragStyle; interactive
  // buttons must explicitly opt out of the draggable title-bar region.
  const windowNoDragStyle = draggableChrome
    ? ({ WebkitAppRegion: "no-drag" } as React.CSSProperties)
    : undefined;

  const q = query.trim().toLowerCase();

  // Message search rides the same box as the name filter: names match
  // instantly from local state; transcript hits are the SearchResults
  // section below the list (debounced, lands on the message).

  const matchingBots = state.bots
    .filter((b) => !b.hidden)
    .filter(
      (b) =>
        !q ||
        b.name.toLowerCase().includes(q) ||
        (b.title ?? "").toLowerCase().includes(q) ||
        preview(b).toLowerCase().includes(q) ||
        b.tasks?.some((task) => !task.routineRunId && task.title.toLowerCase().includes(q)) ||
        b.projects?.some((folder) => folder.name.toLowerCase().includes(q)),
    );
  const visibleGroups = state.groups.filter((g) => !q || g.name.toLowerCase().includes(q) || g.tasks?.some((task) => task.title.toLowerCase().includes(q)));
  const {
    unsectionedChief,
    pinnedBots,
    sectionChiefs,
    sectionedBots,
    unsectionedBots,
  } = partitionSidebarBots(matchingBots);
  const { botChats, sectionedRooms, unsectionedRooms } = partitionSidebarGroups(visibleGroups);

  // User sections keep first-appearance order. The saved layout keeps an
  // empty section's former slot so it returns there when content comes back.
  const sectionNames: string[] = (state.sections ?? []).filter((name) => !q || name.toLowerCase().includes(q.toLowerCase()));
  for (const bot of sectionedBots) {
    if (!sectionNames.includes(bot.section!)) sectionNames.push(bot.section!);
  }
  for (const bot of sectionChiefs) {
    if (!sectionNames.includes(bot.section!)) sectionNames.push(bot.section!);
  }
  for (const group of sectionedRooms) {
    if (!sectionNames.includes(group.section!)) sectionNames.push(group.section!);
  }
  const naturalSectionIds = [
    ...(pinnedBots.length > 0 ? [PINNED_SECTION_ID] : []),
    ...(unsectionedRooms.length > 0 ? [CHANNELS_SECTION_ID] : []),
    ...(botChats.length > 0 ? [BOT_CHATS_SECTION_ID] : []),
    ...(unsectionedBots.length > 0 ? [BOTS_SECTION_ID] : []),
    ...sectionNames.map(userSectionId),
  ];
  const sectionIds = orderedSidebarSections(naturalSectionIds, sectionOrder);
  const layoutInteractive = sidebarLayoutInteractive(density, q);
  const sectionCollapsed = (id: string) =>
    sidebarSectionCollapsed(id, collapsedSections, density, q);

  const toggleSection = (id: string) => {
    if (!layoutInteractive) return;
    const next = toggleCollapsedSection(collapsedSections, id);
    setCollapsedSections(next);
    saveCollapsedSections(next);
  };

  const commitSectionOrder = (visibleOrder: string[]) => {
    if (!layoutInteractive) return;
    const next = mergeSectionOrder(sectionOrder, visibleOrder);
    if (sameSectionOrder(next, sectionOrder)) return;
    setSectionOrder(next);
    saveSectionOrder(next);
  };

  const announceSectionPosition = (id: string, visibleOrder: string[]) => {
    const position = visibleOrder.indexOf(id);
    if (position < 0) return;
    setReorderAnnouncement(
      t("sidebar.section.moved", {
        name: sectionLabel(id),
        position: position + 1,
        count: visibleOrder.length,
      }),
    );
  };

  const moveSidebarSection = (id: string, direction: -1 | 1) => {
    const next = moveSection(sectionIds, id, direction);
    if (sameSectionOrder(next, sectionIds)) return;
    commitSectionOrder(next);
    announceSectionPosition(id, next);
  };

  const resetSectionDrag = () => {
    sectionDragRef.current = { from: null, over: null };
    setDraggingSectionId(null);
    setDropTarget(null);
  };

  const updateSectionDropTarget = (event: React.DragEvent<HTMLDivElement>, id: string) => {
    if (!layoutInteractive || !sectionDragRef.current.from) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rect = event.currentTarget.getBoundingClientRect();
    const place: SectionDropPlace = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
    const next = { id, place };
    sectionDragRef.current.over = next;
    setDropTarget(next);
  };

  const dropSection = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.types.includes(FOLDER_DRAG_TYPE)) return;
    event.preventDefault();
    const from =
      event.dataTransfer.getData("application/x-kind-meitner-sidebar-section") ||
      event.dataTransfer.getData("text/plain") ||
      sectionDragRef.current.from;
    const over = sectionDragRef.current.over;
    if (from && over) {
      const next = placeSection(sectionIds, from, over.id, over.place);
      if (!sameSectionOrder(next, sectionIds)) {
        commitSectionOrder(next);
        announceSectionPosition(from, next);
      }
    }
    resetSectionDrag();
  };
  const archivedBots = state.bots.filter((bot) => bot.hidden);
  const pendingBotUndo = teamFeedback?.restoreBot;
  const activeDisputesCount = state.activeDisputesCount ?? 0;

  return (
    <aside
      ref={sidebarRef}
      tabIndex={-1}
      aria-label={t("sidebar.aria")}
      data-native-view-overlay
      data-sidebar
      className={cn(
        "flex h-full shrink-0 flex-col frame-rule-right bg-panel transition-[width] duration-200",
        density === "icons" ? "w-[80px]" : density === "compact" ? "w-[272px]" : "w-[320px]",
        // Below md only: the sidebar leaves the flow and slides in over the chat.
        // Scoped with max-md: rather than cancelled with md: on purpose — Tailwind
        // v4 emits the native `translate` property, and any value other than
        // `none` turns this element into a containing block for its `fixed`
        // descendants. Cancelling it with an `md:` prefix still emits a value, which
        // silently reparents NewRoomPanel's overlay and the "+" menu backdrop on
        // desktop.
        "max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-40",
        "max-md:transition-transform max-md:duration-200",
        open ? "max-md:translate-x-0" : "max-md:-translate-x-full",
      )}
    >
      {/* macOS owns inset traffic lights; Linux/Windows/browser use native chrome
          with no decorative dead buttons in this corner. */}
      <div
        className={cn("flex items-center pt-3 pb-2 px-3", density === "icons" ? "flex-col gap-2 px-2" : "justify-between")}
        style={windowDragStyle}
      >
        <div className="flex items-center gap-2">
          {macInset && <div className={density === "icons" ? "h-5 w-full" : "w-14"} />}
          {density !== "icons" ? (
            <span className="label-mono font-semibold text-[11px] text-ink select-none tracking-[0.14em]">
              KIND MEITNER
            </span>
          ) : (
            <span className="label-mono font-semibold text-[10px] text-ink select-none">
              KM
            </span>
          )}
        </div>
        <div
          className={cn("relative flex items-center", density === "icons" ? "flex-col gap-1" : "gap-0.5")}
          style={windowNoDragStyle}
        >
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={density === "icons" ? t("sidebar.density.expand") : t("sidebar.density.collapseAria")}
            className="flex size-7 items-center justify-center text-ink-secondary hover:bg-raised-hover hover:text-ink outline-none focus-visible:ring-1 focus-visible:ring-focus"
            title={density === "icons" ? t("sidebar.density.expand") : t("sidebar.density.collapse")}
          >
            {density === "icons" ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setDensityOpen((value) => !value)}
              aria-label={t("sidebar.density.chooseAria")}
              aria-expanded={densityOpen}
              className="flex size-7 items-center justify-center text-ink-secondary hover:bg-raised-hover hover:text-ink outline-none focus-visible:ring-1 focus-visible:ring-focus"
              title={t("sidebar.density.title")}
            >
              <span aria-hidden="true" className="flex size-4 flex-col items-center justify-center gap-[2.5px]">
                <span className="h-px w-3 bg-current" />
                <span className="h-px w-2 bg-current" />
                <span className="h-px w-3 bg-current" />
              </span>
            </button>
            {densityOpen && (
              <>
                <div className="fixed inset-0 z-30" onMouseDown={() => setDensityOpen(false)} />
                <div className={cn(
                  "absolute top-full z-40 mt-1 w-40 overflow-hidden border border-hairline bg-menu py-1 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.6)]",
                  density === "icons" ? "left-0" : "right-0",
                )}>
                  {(["comfortable", "compact", "icons"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setDensity(option)}
                      className={cn(
                        "flex h-8 w-full items-center justify-between px-2.5 text-left font-mono text-[12px] transition-colors hover:bg-raised-hover",
                        density === option ? "font-semibold text-ink" : "text-ink-secondary",
                      )}
                    >
                      {option === "icons"
                        ? t("sidebar.density.iconsOnly")
                        : option === "compact"
                          ? t("sidebar.density.compact")
                          : t("sidebar.density.comfortable")}
                      {density === option && <Check size={13} className="text-ink" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            ref={importReturnRef}
            onClick={() => setPlusOpen((o) => !o)}
            aria-label={remoteClient ? t("sidebar.new") : t("sidebar.newOrShare")}
            className="flex size-7 items-center justify-center text-ink-secondary hover:bg-raised-hover hover:text-ink outline-none focus-visible:ring-1 focus-visible:ring-focus"
            title={remoteClient ? t("sidebar.new") : t("sidebar.newOrShare")}
          >
            <Plus size={16} strokeWidth={2} />
          </button>
          {plusOpen && (
            <>
              <div className="fixed inset-0 z-30" onMouseDown={() => setPlusOpen(false)} />
              <div className={cn(
                "absolute top-full z-40 mt-1 w-52 overflow-hidden border border-hairline bg-menu py-1 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.6)]",
                density === "icons" ? "left-0" : "right-0",
              )}>
                <button
                  onClick={() => {
                    setPlusOpen(false);
                    dispatch({ type: "toggleNewBot", open: true });
                  }}
                  className="flex h-8 w-full items-center gap-2.5 px-2.5 text-left text-[13px] text-ink transition-colors hover:bg-raised-hover"
                >
                  <BotIcon size={15} className="text-ink-secondary" />
                  <span className="flex-1">{t("sidebar.newBot")}</span>
                  <ShortcutHint id="new-bot" />
                </button>
                <button
                  onClick={() => {
                    setPlusOpen(false);
                    void api("/api/okx/dev-day-gate", { method: "POST", body: "{}" })
                      .then(({ room }) => {
                        dispatch({ type: "groupPatched", group: room });
                        dispatch({ type: "select", id: room.id });
                      })
                      .catch((cause) => dispatch({ type: "error", message: cause instanceof Error ? cause.message : String(cause) }));
                  }}
                  className="flex h-8 w-full items-center gap-2.5 px-2.5 text-left text-[13px] text-ink transition-colors hover:bg-raised-hover"
                >
                  <Network size={15} className="text-ink-secondary" />
                  Open Dev Day Gate
                </button>
                <button
                  onClick={() => {
                    setPlusOpen(false);
                    setNewRoom(true);
                  }}
                  className="flex h-8 w-full items-center gap-2.5 px-2.5 text-left text-[13px] text-ink transition-colors hover:bg-raised-hover"
                >
                  <Users size={15} className="text-ink-secondary" />
                  {t("sidebar.newChannel.title")}
                </button>
                {!remoteClient && <button
                  onClick={() => { setPlusOpen(false); setNewTeam(true); }}
                  className="flex h-8 w-full items-center gap-2.5 px-2.5 text-left text-[13px] text-ink transition-colors hover:bg-raised-hover"
                >
                  <FolderPlus size={15} className="text-ink-secondary" /> {t("team.create")}
                </button>}
                {!remoteClient && <>
                <button
                  onClick={() => {
                    setPlusOpen(false);
                    setTeamLibraryOpen(true);
                  }}
                  className="flex h-8 w-full items-center gap-2.5 px-2.5 text-left text-[13px] text-ink transition-colors hover:bg-raised-hover"
                >
                  <Library size={15} className="text-ink-secondary" />
                  {t("sidebar.teamLibrary")}
                </button>
                {archivedBots.length > 0 && (
                  <button
                    onClick={() => {
                      setPlusOpen(false);
                      setArchivedBotsOpen(true);
                    }}
                    className="flex h-8 w-full items-center gap-2.5 px-2.5 text-left text-[13px] text-ink transition-colors hover:bg-raised-hover"
                  >
                    <Archive size={15} className="text-ink-secondary" />
                    <span className="flex-1">{t("sidebar.archived.title")}</span>
                    <span className="font-mono text-[11px] text-ink-secondary">{archivedBots.length}</span>
                  </button>
                )}
                </>}
              </div>
            </>
          )}
        </div>
      </div>

      <DesktopWorkspaceSwitcher compact={density === "icons"} />
      {/* Search and New room */}
      {density === "icons" ? (
        <div className="flex flex-col items-center gap-1 py-1">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={t("sidebar.searchAria")}
            title={t("sidebar.search")}
            className="flex size-8 items-center justify-center text-ink-secondary hover:bg-raised-hover hover:text-ink outline-none focus-visible:ring-1 focus-visible:ring-focus"
          >
            <Search size={15} />
          </button>
          <button
            type="button"
            onClick={() => setNewRoom(true)}
            aria-label="New room"
            title="New room"
            className="flex size-8 items-center justify-center text-ink-secondary hover:bg-raised-hover hover:text-ink outline-none focus-visible:ring-1 focus-visible:ring-focus"
          >
            <Plus size={16} />
          </button>
        </div>
      ) : (
        <div className="px-3 pt-1 pb-2 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 border border-hairline bg-inset px-2.5 py-1.5 focus-within:border-ink">
            <Search size={13} className="shrink-0 text-ink-secondary" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setQuery("")}
              placeholder={t("sidebar.search")}
              aria-label={t("sidebar.searchAria")}
              className="w-full bg-transparent font-mono text-[12px] text-ink placeholder:text-ink-secondary focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setNewRoom(true)}
            aria-label="New room"
            title="New room"
            className="flex h-8 w-full items-center justify-center gap-2 border border-dashed border-hairline bg-panel text-[12px] font-mono text-ink transition-colors hover:bg-raised-hover outline-none focus-visible:ring-1 focus-visible:ring-focus"
          >
            <Plus size={14} className="text-ink-secondary" />
            <span>New room</span>
          </button>
        </div>
      )}

      {/* Main navigation list */}
      <nav aria-label="Main" className={cn("flex flex-col gap-0.5", density === "icons" ? "px-2" : "px-3")}>
        <button
          type="button"
          onClick={handleRoomsClick}
          aria-label="Rooms"
          title="Rooms"
          aria-current={isRoomsActive ? "page" : undefined}
          className={cn(
            "relative flex items-center transition-colors outline-none focus-visible:ring-1 focus-visible:ring-focus",
            density === "icons"
              ? "size-9 w-full justify-center px-2"
              : "h-8.5 w-full gap-2.5 px-3 text-left font-mono text-[13px]",
            isRoomsActive
              ? "bg-raised text-ink shadow-[inset_2px_0_0_var(--color-ink)]"
              : "text-ink hover:bg-raised-hover",
          )}
        >
          <MessageSquare size={16} className={cn("shrink-0", isRoomsActive ? "text-ink" : "text-ink-secondary")} />
          {density !== "icons" && <span className="flex-1 truncate">Rooms</span>}
        </button>

        <button
          type="button"
          data-tour="nav-apps"
          onClick={handleHubClick}
          aria-label={tFromServer("okxHub.nav.agentHub", "OKX Agent Hub")}
          title={tFromServer("okxHub.nav.agentHub", "OKX Agent Hub")}
          aria-current={isHubActive ? "page" : undefined}
          className={cn(
            "relative flex items-center transition-colors outline-none focus-visible:ring-1 focus-visible:ring-focus",
            density === "icons"
              ? "size-9 w-full justify-center px-2"
              : "h-8.5 w-full gap-2.5 px-3 text-left font-mono text-[13px]",
            isHubActive
              ? "bg-raised text-ink shadow-[inset_2px_0_0_var(--color-ink)]"
              : "text-ink hover:bg-raised-hover",
          )}
        >
          <BotIcon size={16} className={cn("shrink-0", isHubActive ? "text-ink" : "text-ink-secondary")} />
          {density !== "icons" && (
            <span className="flex-1 truncate">{tFromServer("okxHub.nav.agentHub", "OKX Agent Hub")}</span>
          )}
        </button>

        <button
          type="button"
          onClick={handleAspDirectoryClick}
          aria-label="ASP Directory"
          title="ASP Directory"
          aria-current={isAspActive ? "page" : undefined}
          className={cn(
            "relative flex items-center transition-colors outline-none focus-visible:ring-1 focus-visible:ring-focus",
            density === "icons"
              ? "size-9 w-full justify-center px-2"
              : "h-8.5 w-full gap-2.5 px-3 text-left font-mono text-[13px]",
            isAspActive
              ? "bg-raised text-ink shadow-[inset_2px_0_0_var(--color-ink)]"
              : "text-ink hover:bg-raised-hover",
          )}
        >
          <Network size={16} className={cn("shrink-0", isAspActive ? "text-ink" : "text-ink-secondary")} />
          {density !== "icons" && <span className="flex-1 truncate">ASP Directory</span>}
        </button>

        <button
          type="button"
          onClick={handleActivityClick}
          aria-label="Activity"
          title="Activity"
          aria-current={isActivityActive ? "page" : undefined}
          className={cn(
            "relative flex items-center transition-colors outline-none focus-visible:ring-1 focus-visible:ring-focus",
            density === "icons"
              ? "size-9 w-full justify-center px-2"
              : "h-8.5 w-full gap-2.5 px-3 text-left font-mono text-[13px]",
            isActivityActive
              ? "bg-raised text-ink shadow-[inset_2px_0_0_var(--color-ink)]"
              : "text-ink hover:bg-raised-hover",
          )}
        >
          <BellDot size={16} className={cn("shrink-0", isActivityActive ? "text-ink" : "text-ink-secondary")} />
          {density !== "icons" && <span className="flex-1 truncate">Activity</span>}
        </button>

        <button
          type="button"
          data-tour="nav-automations"
          onClick={handleRoutinesClick}
          aria-label={t("sidebar.nav.automations")}
          title={t("sidebar.nav.automations")}
          aria-current={isRoutinesActive ? "page" : undefined}
          className={cn(
            "relative flex items-center transition-colors outline-none focus-visible:ring-1 focus-visible:ring-focus",
            density === "icons"
              ? "size-9 w-full justify-center px-2"
              : "h-8.5 w-full gap-2.5 px-3 text-left font-mono text-[13px]",
            isRoutinesActive
              ? "bg-raised text-ink shadow-[inset_2px_0_0_var(--color-ink)]"
              : "text-ink hover:bg-raised-hover",
          )}
        >
          <CalendarDays size={16} className={cn("shrink-0", isRoutinesActive ? "text-ink" : "text-ink-secondary")} />
          {density !== "icons" && <span className="flex-1 truncate">{t("sidebar.nav.automations")}</span>}
          {state.routineRuns.some((run) => ["failed", "missed"].includes(run.status) && !run.seenAt) && (
            <span
              className={cn(
                "size-1.5 rounded-full bg-danger shrink-0",
                density === "icons" ? "absolute top-1.5 right-1.5" : "ml-auto",
              )}
            />
          )}
        </button>

        <button
          type="button"
          data-tour="nav-evaluator"
          onClick={handleEvaluatorClick}
          aria-label="Evaluator Disputes"
          title="Evaluator Disputes"
          aria-current={isEvaluatorActive ? "page" : undefined}
          className={cn(
            "relative flex items-center transition-colors outline-none focus-visible:ring-1 focus-visible:ring-focus",
            density === "icons"
              ? "size-9 w-full justify-center px-2"
              : "h-8.5 w-full gap-2.5 px-3 text-left font-mono text-[13px]",
            isEvaluatorActive
              ? "bg-raised text-ink shadow-[inset_2px_0_0_var(--color-ink)]"
              : "text-ink hover:bg-raised-hover",
          )}
        >
          <Scale size={16} className={cn("shrink-0", isEvaluatorActive ? "text-ink" : "text-ink-secondary")} />
          {density !== "icons" && <span className="flex-1 truncate">Evaluator</span>}
          {activeDisputesCount > 0 && (
            <span
              data-testid="disputes-badge"
              className={cn(
                "border border-hairline bg-panel font-mono text-[10px] text-ink flex items-center justify-center",
                density === "icons" ? "absolute -top-0.5 -right-0.5 size-4" : "ml-auto px-1.5 py-0.5",
              )}
            >
              {activeDisputesCount}
            </span>
          )}
        </button>
      </nav>

      <div className="my-2 frame-rule" />

      {/* Bot list */}
      <div ref={roomListRef} tabIndex={-1} className="flex-1 overflow-y-auto px-2 outline-none">
        <div className="flex flex-col gap-0.5">
          {matchingBots.length === 0 && visibleGroups.length === 0 && q && q.length < MIN_QUERY && (
            <div className="px-3 py-6 text-center text-[13px] text-ink-secondary">{t("sidebar.noMatch", { query })}</div>
          )}
          {unsectionedChief && (
            <div className="mb-1.5">
              <BotListItem
                bot={unsectionedChief}
                density={density}
                query={q}
                onMenu={setMenu}
              />
            </div>
          )}
          {sectionIds.map((id, index) => {
            const sectionName = userSectionName(id);
            const sectionChiefItems = sectionName
              ? sectionChiefs.filter((bot) => bot.section === sectionName)
              : [];
            const sectionGroupItems =
              id === CHANNELS_SECTION_ID
                ? unsectionedRooms
                : id === BOT_CHATS_SECTION_ID
                  ? botChats
                  : sectionName
                    ? sectionedRooms.filter((group) => group.section === sectionName)
                    : [];
            const sectionBotItems =
              id === PINNED_SECTION_ID
                ? pinnedBots
                : id === BOTS_SECTION_ID
                  ? unsectionedBots
                  : sectionName
                    ? sectionedBots.filter((bot) => bot.section === sectionName)
                    : [];
            const collapsed = sectionCollapsed(id);
            const queued = collapsed ? [...sectionChiefItems, ...sectionBotItems].flatMap((bot) =>
              sidebarBotActivityTasks(bot, state.pendingQueued).filter((task) => task.queued).map((task) => `${bot.name}: ${task.title}`)) : [];
            const attention = collapsed
              ? sidebarSectionAttention(
                  [...sectionChiefItems, ...sectionBotItems],
                  sectionGroupItems,
                )
              : undefined;
            return (
              <div
                key={id}
                data-sidebar-section-id={id}
                onDragOver={(event) => updateSectionDropTarget(event, id)}
                onDrop={dropSection}
                className={cn(
                  "flex flex-col gap-0.5",
                  density !== "icons" && index > 0 && "pt-3",
                )}
              >
                {dropTarget?.id === id && dropTarget.place === "before" && draggingSectionId !== id && (
                  <div className="mx-2 h-0.5 bg-ink" />
                )}
                {density !== "icons" && (
                  <SidebarSectionHeader
                    name={sectionLabel(id)}
                    collapsed={collapsed}
                    attention={attention}
                    onToggle={layoutInteractive ? () => toggleSection(id) : undefined}
                    reorderable={layoutInteractive && sectionIds.length > 1}
                    dragging={draggingSectionId === id}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("application/x-kind-meitner-sidebar-section", id);
                      event.dataTransfer.setData("text/plain", id);
                      sectionDragRef.current = { from: id, over: null };
                      setDraggingSectionId(id);
                    }}
                    onDragEnd={resetSectionDrag}
                    onMove={(direction) => moveSidebarSection(id, direction)}
                  />
                )}
                {collapsed && queued.length > 0 && <button type="button" onClick={() => toggleSection(id)}
                  title={`${t("task.queued")} · ${queued.join(", ")}`} aria-label={`${t("sidebar.section.expand", { name: sectionLabel(id) })} · ${t("task.queued")} · ${queued.join(", ")}`}
                  className="mx-3 mb-1 self-start border border-hairline bg-raised px-2 py-0.5 font-mono text-[10px] text-ink-secondary hover:text-ink">{t("task.queued")} · {queued.length}</button>}
                {!collapsed && (
                  <>
                    {sectionChiefItems.map((bot) => (
                      <BotListItem
                        key={bot.id}
                        bot={bot}
                        density={density}
                        query={q}
                        onMenu={setMenu}
                      />
                    ))}
                    {sectionGroupItems.map((group) => (
                      <GroupListItem
                        key={group.id}
                        group={group}
                        density={density}
                        query={q}
                        onMenu={setRoomMenu}
                      />
                    ))}
                    {sectionBotItems.map((bot) => (
                      <BotListItem
                        key={bot.id}
                        bot={bot}
                        density={density}
                        query={q}
                        onMenu={setMenu}
                      />
                    ))}
                    {!remoteClient && sectionName && layoutInteractive && sectionChiefItems.length + sectionGroupItems.length + sectionBotItems.length === 0 && (
                      <button onClick={() => setMoveToTeam(sectionName)} aria-label={t("team.addBotsTo", { name: sectionName })}
                        className="mx-3 my-1 flex items-center gap-1.5 px-2 py-1 text-[12px] text-ink-secondary hover:bg-raised-hover hover:text-ink">
                        <Plus size={13} /> {t("team.addBots")}
                      </button>
                    )}
                  </>
                )}
                {dropTarget?.id === id && dropTarget.place === "after" && draggingSectionId !== id && (
                  <div className="mx-2 h-0.5 bg-ink" />
                )}
              </div>
            );
          })}
          <SearchResults query={query} onLanded={() => setQuery("")} />
        </div>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {reorderAnnouncement}
      </p>

      {/* Lower section */}
      <div className={cn("pt-2 pb-2 frame-rule-above flex flex-col gap-0.5", density === "icons" ? "px-2 items-center" : "px-3")}>
        {/* Settings */}
        <button
          type="button"
          onClick={() => dispatch({ type: "toggleAppSettings" })}
          aria-label={t("sidebar.menu.settings")}
          title={t("sidebar.menu.settings")}
          aria-current={state.appSettingsOpen ? "page" : undefined}
          className={cn(
            "relative flex items-center transition-colors outline-none focus-visible:ring-1 focus-visible:ring-focus",
            density === "icons"
              ? "size-9 w-full justify-center px-2"
              : "h-8.5 w-full gap-2.5 px-3 text-left font-mono text-[13px]",
            state.appSettingsOpen
              ? "bg-raised text-ink shadow-[inset_2px_0_0_var(--color-ink)]"
              : "text-ink hover:bg-raised-hover",
          )}
        >
          <SettingsIcon size={16} className={cn("shrink-0", state.appSettingsOpen ? "text-ink" : "text-ink-secondary")} />
          {density !== "icons" && <span className="flex-1 truncate">{t("sidebar.menu.settings")}</span>}
        </button>

        {/* Help */}
        <button
          type="button"
          onClick={() => void openExternalLink(HELP_CENTER_URL)}
          aria-label={t("sidebar.menu.help")}
          title={t("sidebar.menu.help")}
          className={cn(
            "relative flex items-center transition-colors outline-none focus-visible:ring-1 focus-visible:ring-focus text-ink hover:bg-raised-hover",
            density === "icons"
              ? "size-9 w-full justify-center px-2"
              : "h-8.5 w-full gap-2.5 px-3 text-left font-mono text-[13px]",
          )}
        >
          <HelpCircle size={16} className="shrink-0 text-ink-secondary" />
          {density !== "icons" && <span className="flex-1 truncate">{t("sidebar.menu.help")}</span>}
        </button>

        {/* Connection status */}
        <div
          aria-label={state.connected ? "Connected" : "Offline"}
          title={state.connected ? "Connected" : "Offline"}
          className={cn(
            "flex items-center text-ink-secondary select-none",
            density === "icons"
              ? "size-8 w-full justify-center"
              : "h-7 w-full gap-2 px-3 text-[11px] font-mono",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full shrink-0",
              state.connected ? "bg-success" : "bg-ink-secondary",
            )}
          />
          {density !== "icons" && (
            <span className="truncate">{state.connected ? "Connected" : "Offline"}</span>
          )}
        </div>

        {/* Phone button in icons mode */}
        {density === "icons" && (
          <SidebarPhoneButton
            density={density}
            onOpen={() => dispatch(phoneSettingsAction())}
          />
        )}

        {/* Profile */}
        {density === "icons" ? (
          <button
            type="button"
            onClick={() => dispatch({ type: "toggleAppSettings" })}
            className="flex size-9 w-full items-center justify-center p-1 hover:bg-raised-hover outline-none focus-visible:ring-1 focus-visible:ring-focus"
            aria-label={t("sidebar.appSettings")}
            title={state.config?.profile?.name?.trim() || t("sidebar.appSettings")}
          >
            <InitialsAvatar initials={profileInitials(state.config?.profile)} size={24} />
          </button>
        ) : (
          <div className="mt-1">
            <SidebarProfileMenu />
          </div>
        )}
      </div>

      {menu && (
        <BotContextMenu
          menu={menu}
          onClose={() => setMenu(null)}
          onArchive={requestArchive}
          onDelete={(bot) => setConfirm({ kind: "delete", bot })}
          onMoveToSection={(botId) => setSectionPicker({ botId, x: menu.x, y: menu.y })}
          onNewFolder={setNewFolderBotId}
        />
      )}
      {showThreads && newFolderBotId && state.bots.find((bot) => bot.id === newFolderBotId) && <BotProjectDialog bot={state.bots.find((bot) => bot.id === newFolderBotId)!} onClose={() => setNewFolderBotId(null)} />}
      <ConfirmDialog
        open={confirm !== null}
        {...(confirm ? botConfirmCopy(confirm.kind, confirm.bot.name) : botConfirmCopy("archive", ""))}
        icon={confirm?.kind === "delete" ? <Trash2 size={18} /> : <Archive size={18} />}
        onCancel={cancelConfirm}
        returnFocusRef={sidebarRef}
        onConfirm={() => {
          if (!confirm) return;
          const { kind, bot } = confirm;
          setConfirm(null);
          if (kind === "archive") void archiveBot(bot);
          else dispatch({ type: "deleteBot", botId: bot.id });
        }}
      />
      {newTeam && <TeamDialog onClose={() => setNewTeam(false)} />}
      {moveToTeam && <TeamDialog section={moveToTeam} onClose={() => setMoveToTeam(null)} />}
      {sectionPicker && (
        <SectionPicker
          current={state.bots.find((b) => b.id === sectionPicker.botId)?.section}
          anchor={sectionPicker}
          onClose={() => setSectionPicker(null)}
          onAssign={(section) => {
            if (!remoteClient) {
              dispatch({ type: "updateBot", botId: sectionPicker.botId, patch: { section } });
              return;
            }
            void api("/api/sidebar-sections", {
              method: "POST",
              body: JSON.stringify({ name: section, botIds: [sectionPicker.botId] }),
            })
              .then(({ bots }) => bots.forEach((bot: Bot) => dispatch({ type: "botPatched", bot })))
              .catch((cause) => dispatch({ type: "error", message: cause instanceof Error ? cause.message : String(cause) }));
          }}
        />
      )}
      {roomMenu && (
        <RoomContextMenu
          key={roomMenu.groupId}
          menu={roomMenu}
          onClose={() => setRoomMenu(null)}
          onMoveToSection={(groupId) => setRoomSectionPicker({ groupId, x: roomMenu.x, y: roomMenu.y })}
        />
      )}
      {roomSectionPicker && (
        <SectionPicker
          current={state.groups.find((g) => g.id === roomSectionPicker.groupId)?.section}
          anchor={roomSectionPicker}
          onClose={() => setRoomSectionPicker(null)}
          onAssign={(section) =>
            dispatch({ type: "patchGroup", groupId: roomSectionPicker.groupId, patch: { section } })
          }
        />
      )}
      {newRoom && <NewRoomPanel onClose={() => setNewRoom(false)} />}
      {!remoteClient && archivedBotsOpen && (
        <ArchivedBotsPanel
          bots={archivedBots}
          onClose={() => setArchivedBotsOpen(false)}
          onRestored={(message) => setTeamFeedback({ error: false, text: message })}
        />
      )}
      {!remoteClient && teamLibraryOpen && (
        <TeamLibraryPanel
          returnFocusRef={importReturnRef}
          initialUrl={teamInstallUrl ?? undefined}
          onClose={() => {
            setTeamLibraryOpen(false);
            setTeamInstallUrl(null);
          }}
          onImported={(result) => {
            setTeamLibraryOpen(false);
            setTeamInstallUrl(null);
            setTeamFeedback({
              error: false,
              text:
                result.members === 1
                  ? t("sidebar.teamImportedOne")
                  : t("sidebar.teamImportedMany", { count: result.members }),
            });
          }}
        />
      )}
      {teamFeedback &&
        createPortal(
          <div
            role="status"
            className={cn(
              "animate-view-enter fixed bottom-4 left-4 z-[60] max-w-[320px] border p-3 text-[13px] shadow-[0_16px_40px_-16px_rgb(0_0_0/0.6)]",
              teamFeedback.error
                ? "border-danger bg-card text-danger"
                : "border-hairline bg-card text-ink",
            )}
          >
            <div className="flex items-center gap-3">
              <span className="flex-1 font-mono text-[12px]">{teamFeedback.text}</span>
              {pendingBotUndo && (
                <Button
                  onClick={() => void undoBotArchive(pendingBotUndo)}
                  variant="secondary"
                  size="xs"
                >
                  {t("common.undo")}
                </Button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </aside>
  );
}
