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
    badgeTone: string;
    icon: typeof AlertCircle;
    label: string;
  }
> = {
  blocked: {
    border: "border-danger/50 hover:border-danger/80",
    bg: "bg-danger/10",
    badgeTone: "bg-danger/20 text-danger border-danger/30 font-bold",
    icon: AlertCircle,
    label: "Blocked",
  },
  failed: {
    border: "border-danger/50 hover:border-danger/80",
    bg: "bg-danger/10",
    badgeTone: "bg-danger/20 text-danger border-danger/30 font-bold",
    icon: AlertCircle,
    label: "Failed",
  },
  input_needed: {
    border: "border-warning/50 hover:border-warning/80",
    bg: "bg-warning/10",
    badgeTone: "bg-warning/20 text-warning border-warning/30 font-semibold",
    icon: AlertTriangle,
    label: "Input needed",
  },
  review: {
    border: "border-accent/50 hover:border-accent/80",
    bg: "bg-accent/10",
    badgeTone: "bg-accent/20 text-accent border-accent/30 font-semibold",
    icon: UserCheck,
    label: "Review required",
  },
  warning: {
    border: "border-hairline/60 hover:border-hairline",
    bg: "bg-inset/40",
    badgeTone: "bg-control text-ink-secondary border-hairline/40",
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
          "flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-[#15171A] px-4 text-[12px] text-white/70",
          compact ? "h-8 py-0.5 text-[11px]" : "h-9",
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 size={13} className="text-white/40" aria-hidden="true" />
          <span className="font-medium text-white/80">No attention items required</span>
          <span className="text-white/30">·</span>
          <span className="text-white/50">All systems quiet</span>
        </div>
        <span className="text-[11px] text-white/40 hidden sm:inline">Select an agent to inspect</span>
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
          "flex h-8 w-full items-center justify-between gap-3 rounded-md border border-danger/30 bg-danger/10 px-3 text-[11.5px]",
          className,
        )}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <Icon size={13} className="shrink-0 text-danger" aria-hidden="true" />
          <span className="font-semibold text-danger">{sortedItems.length} needs attention:</span>
          <span className="truncate text-white/90 font-medium">{topItem.agentName}</span>
          <span className="text-white/30">·</span>
          <span className="truncate text-white/60">{topItem.summary}</span>
        </div>

        <button
          type="button"
          onClick={() => onSelectItem(topItem)}
          className="shrink-0 inline-flex items-center gap-1 rounded-md bg-white/[0.08] px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-white/[0.15]"
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
      className={cn("space-y-1.5 rounded-lg border border-white/[0.08] bg-[#16191E] p-2.5", className)}
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <ShieldAlert size={14} className="text-danger" aria-hidden="true" />
          <h3 className="text-[12.5px] font-semibold text-white/95">Needs attention</h3>
          <span
            className="flex h-4 min-w-4 items-center justify-center rounded-[6px] bg-danger/20 px-1.5 font-mono text-[10.5px] font-bold text-danger"
            aria-label={`${sortedItems.length} urgent items`}
          >
            {sortedItems.length}
          </span>
        </div>
        <span className="text-[11px] text-white/45">Click item to intervene immediately</span>
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
                "group flex w-full flex-col justify-between gap-2 rounded-md border p-2 text-left outline-none transition-all cursor-pointer sm:flex-row sm:items-center",
                config.bg,
                config.border,
                isSelected ? "ring-2 ring-accent" : "",
                "focus-visible:ring-2 focus-visible:ring-accent",
              )}
            >
              {/* Left: Badge + Agent + Problem Summary */}
              <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center">
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-[6px] border px-2 py-0.5 text-[10.5px] uppercase tracking-wide",
                    config.badgeTone,
                  )}
                >
                  <Icon size={11} aria-hidden="true" />
                  <span>{config.label}</span>
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate text-[13px] font-semibold text-white/90">
                      {item.agentName}
                    </span>
                    {item.taskTitle && (
                      <>
                        <span className="text-white/30">·</span>
                        <span className="truncate text-[12px] text-white/70">
                          {item.taskTitle}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11.5px] text-white/60">
                    {item.summary}
                  </p>
                </div>
              </div>

              {/* Right: Quick Action Button & Age */}
              <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                {item.ageStr && (
                  <span className="font-mono text-[11px] text-white/45">
                    {item.ageStr}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-lg bg-white/[0.08] px-2.5 py-1 text-[11.5px] font-semibold text-white group-hover:bg-white/[0.15]">
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
