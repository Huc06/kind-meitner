import { useMemo } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { AttentionKind, TruthfulAction } from "@/lib/team-map-attention";
import { Tag, type TagTone } from "@/components/ui/tag";
import { buttonClass, type ButtonVariant } from "@/components/ui/button";

export type AttentionPriority = AttentionKind;

export interface AttentionItem {
  id: string;
  priority: AttentionPriority;
  agentId: string;
  agentName: string;
  taskId?: string;
  taskTitle?: string;
  summary: string;
  recommendedAction: TruthfulAction | string;
  actionLabel?: string;
  createdAt?: number;
  ageStr?: string;
}

const PRIORITY_STYLES: Record<
  AttentionPriority,
  {
    border: string;
    bg: string;
    tagTone: TagTone;
    buttonVariant: ButtonVariant;
    icon: typeof AlertCircle;
    label: string;
  }
> = {
  blocked: {
    border: "border-danger/60 hover:border-danger",
    bg: "bg-danger/10",
    tagTone: "danger",
    buttonVariant: "danger",
    icon: AlertCircle,
    label: "Blocked",
  },
  failed: {
    border: "border-danger/60 hover:border-danger",
    bg: "bg-danger/10",
    tagTone: "danger",
    buttonVariant: "danger",
    icon: AlertCircle,
    label: "Failed",
  },
  input_needed: {
    border: "border-warning/60 hover:border-warning",
    bg: "bg-warning/10",
    tagTone: "warning",
    buttonVariant: "primary",
    icon: AlertTriangle,
    label: "Input needed",
  },
  review: {
    border: "border-warning/60 hover:border-warning",
    bg: "bg-warning/10",
    tagTone: "warning",
    buttonVariant: "primary",
    icon: UserCheck,
    label: "Review required",
  },
  warning: {
    border: "border-hairline hover:border-ink-secondary",
    bg: "bg-inset",
    tagTone: "neutral",
    buttonVariant: "secondary",
    icon: Clock,
    label: "Degraded",
  },
};

export function TeamMapAttentionRail({
  items,
  selectedItemId,
  onSelectItem,
  compact = false,
  className,
}: {
  items: AttentionItem[];
  selectedItemId?: string | null;
  onSelectItem: (item: AttentionItem) => void;
  compact?: boolean;
  className?: string;
}) {
  const sortedItems = useMemo(() => {
    const rank: Record<AttentionPriority, number> = {
      blocked: 0,
      failed: 1,
      input_needed: 2,
      review: 3,
      warning: 4,
    };
    return [...items].sort((a, b) => rank[a.priority] - rank[b.priority]);
  }, [items]);

  // Healthy fallback state when no items need attention
  if (sortedItems.length === 0) {
    return (
      <div
        role="status"
        aria-label="Workspace health"
        className={cn(
          "flex w-full items-center justify-between border border-hairline bg-card px-4 text-[12px] text-ink-secondary",
          compact ? "h-8 py-0.5 text-[11px]" : "h-9",
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 size={13} className="text-success" aria-hidden="true" />
          <span className="font-medium text-ink">No attention items required</span>
          <span className="text-ink-secondary/40">·</span>
          <span className="text-ink-secondary">All systems quiet</span>
        </div>
        <span className="text-[11px] text-ink-secondary hidden sm:inline">Select an agent to inspect</span>
      </div>
    );
  }

  // Compact mode single-line summary for Spatial Map view
  if (compact) {
    const topItem = sortedItems[0];
    const config = PRIORITY_STYLES[topItem.priority];
    const Icon = config.icon;

    return (
      <div
        role="region"
        aria-label="Urgent attention summary"
        className={cn(
          "flex h-8 w-full items-center justify-between gap-3 border border-danger/40 bg-danger/10 px-3 text-[11.5px]",
          className,
        )}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <Icon size={13} className="shrink-0 text-danger" aria-hidden="true" />
          <span className="font-semibold text-danger">{sortedItems.length} needs attention:</span>
          <span className="truncate text-ink font-medium">{topItem.agentName}</span>
          <span className="text-ink-secondary/40">·</span>
          <span className="truncate text-ink-secondary">{topItem.summary}</span>
        </div>

        <button
          type="button"
          onClick={() => onSelectItem(topItem)}
          className={cn(buttonClass({ variant: config.buttonVariant, size: "xs" }), "shrink-0 gap-1 normal-case")}
        >
          <span>{topItem.actionLabel ?? topItem.recommendedAction}</span>
          <ArrowRight size={11} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label="Actionable attention items"
      className={cn("space-y-1.5 border border-hairline bg-panel p-2.5", className)}
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <ShieldAlert size={14} className="text-danger" aria-hidden="true" />
          <h3 className="label-mono text-[12px] font-semibold text-ink">Needs attention</h3>
          <Tag
            tone="danger"
            variant="solid"
            size="sm"
            aria-label={`${sortedItems.length} urgent items`}
          >
            {sortedItems.length}
          </Tag>
        </div>
        <span className="label-mono text-[10.5px] text-ink-secondary">Click item to intervene immediately</span>
      </div>

      <div className="space-y-1.5">
        {sortedItems.map((item) => {
          const config = PRIORITY_STYLES[item.priority];
          const Icon = config.icon;
          const isSelected = selectedItemId === item.id;

          return (
            <button
              key={item.id}
              type="button"
              aria-selected={isSelected}
              onClick={() => onSelectItem(item)}
              className={cn(
                "group flex w-full flex-col justify-between gap-2 border p-2 text-left outline-none transition-colors cursor-pointer sm:flex-row sm:items-center",
                config.bg,
                config.border,
                isSelected ? "ring-2 ring-accent" : "",
              )}
            >
              {/* Left: Badge + Agent + Problem Summary */}
              <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center">
                <Tag tone={config.tagTone} variant="solid" size="sm" className="shrink-0">
                  <Icon size={11} aria-hidden="true" />
                  <span>{config.label}</span>
                </Tag>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate text-[13px] font-semibold text-ink">
                      {item.agentName}
                    </span>
                    {item.taskTitle && (
                      <>
                        <span className="text-ink-secondary/40">·</span>
                        <span className="truncate text-[12px] text-ink-secondary">
                          {item.taskTitle}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11.5px] text-ink-secondary">
                    {item.summary}
                  </p>
                </div>
              </div>

              {/* Right: Quick Action Button & Age */}
              <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                {item.ageStr && (
                  <span className="font-mono text-[11px] tabular-nums text-ink-secondary">
                    {item.ageStr}
                  </span>
                )}
                <span className={cn(buttonClass({ variant: config.buttonVariant, size: "xs" }), "gap-1 normal-case")}>
                  <span>{item.actionLabel ?? item.recommendedAction}</span>
                  <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
