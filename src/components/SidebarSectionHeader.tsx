import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import type { DragEvent, KeyboardEvent } from "react";

import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import {
  sidebarAttentionLabel,
  type SidebarSectionAttention,
} from "@/lib/sidebar-attention";

export function SidebarSectionHeader({
  name,
  collapsed,
  attention,
  onToggle,
  reorderable,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  name: string;
  collapsed: boolean;
  attention?: SidebarSectionAttention;
  onToggle?: () => void;
  reorderable: boolean;
  dragging: boolean;
  onDragStart?: (event: DragEvent<HTMLSpanElement>) => void;
  onDragEnd?: () => void;
  onMove?: (direction: -1 | 1) => void;
}) {
  const Chevron = collapsed ? ChevronRight : ChevronDown;
  const attentionLabel = attention ? sidebarAttentionLabel(attention) : "";
  const onHeaderKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!reorderable || !event.altKey) return;
    if (event.key === "ArrowUp") {
      event.preventDefault();
      onMove?.(-1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      onMove?.(1);
    }
  };

  return (
    <div className="flex items-center gap-1 px-2 pb-1" data-section={name}>
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          onKeyDown={onHeaderKeyDown}
          aria-expanded={!collapsed}
          aria-keyshortcuts={reorderable ? "Alt+ArrowUp Alt+ArrowDown" : undefined}
          title={
            reorderable
              ? collapsed
                ? t("sidebar.section.expandReorder", { name })
                : t("sidebar.section.collapseReorder", { name })
              : collapsed
                ? t("sidebar.section.expand", { name })
                : t("sidebar.section.collapse", { name })
          }
          className="flex min-w-0 flex-1 items-center gap-1.5 px-1 py-1 text-left transition-colors hover:bg-raised-hover"
        >
          <span className="label-mono truncate text-ink-secondary">
            {name}
          </span>
          <Chevron size={12} className="shrink-0 text-ink-secondary" aria-hidden="true" />
          {attention && attention.waiting > 0 && (
            <span
              aria-hidden="true"
              className="min-w-4 border border-warning px-1 text-center font-mono text-[9px] font-medium leading-3.5 text-warning"
            >
              {attention.waiting}
            </span>
          )}
          {attention && attention.unread > 0 && (
            <span
              aria-hidden="true"
              className="min-w-4 border border-hairline bg-raised px-1 text-center font-mono text-[9px] font-medium leading-3.5 text-ink"
            >
              {attention.unread}
            </span>
          )}
          {attention && attention.working > 0 && (
            <span
              aria-hidden="true"
              className="flex size-4 items-center justify-center"
            >
              <span className="size-1.5 animate-pulse rounded-full bg-success" />
            </span>
          )}
          {attentionLabel && <span className="sr-only">{attentionLabel}</span>}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-1.5 px-1 py-1">
          <span className="label-mono truncate text-ink-secondary">
            {name}
          </span>
          {attentionLabel && <span className="sr-only">{attentionLabel}</span>}
        </div>
      )}
      {reorderable && (
        <span
          aria-hidden="true"
          draggable
          title={t("sidebar.section.dragToReorder")}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className={cn(
            "flex size-6 shrink-0 cursor-grab items-center justify-center text-ink-secondary hover:bg-raised-hover hover:text-ink",
            dragging && "opacity-40",
          )}
        >
          <GripVertical size={13} />
        </span>
      )}
    </div>
  );
}
