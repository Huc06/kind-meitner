// The sidebar's "More" menu row, housing secondary views like Routines and Evaluator.
import { ChevronUp, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import { SidebarPopoverMenu, type SidebarMenuItem } from "./SidebarPopoverMenu";
import type { SidebarDensity } from "@/lib/sidebar-preferences";

export type MoreMenuItem = SidebarMenuItem;

export function SidebarMoreMenu({
  items,
  density = "comfortable",
  label = "More",
  active = false,
  badge,
  badgeTestId = "disputes-badge",
  badgeAriaLabel = "Evaluator Disputes",
  attention = false,
  attentionTone = "danger",
}: {
  items: MoreMenuItem[];
  density?: SidebarDensity;
  label?: string;
  active?: boolean;
  badge?: React.ReactNode;
  badgeTestId?: string;
  badgeAriaLabel?: string;
  attention?: boolean;
  attentionTone?: "danger" | "accent";
}) {
  const iconOnly = density === "icons";

  return (
    <SidebarPopoverMenu
      tourId="nav-more"
      items={items}
      ariaLabel={label}
      openOnHover
      placement={iconOnly ? "right" : "below"}
      renderTrigger={({ open, attention: popoverAttention, attentionTone: popoverTone }) => {
        const hasAttention = attention || popoverAttention;
        const tone = attention ? attentionTone : popoverTone;
        const isHighlight = open || active;

        if (iconOnly) {
          return (
            <span
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex size-9 w-full items-center justify-center px-2 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-focus",
                isHighlight
                  ? "bg-raised text-ink shadow-[inset_2px_0_0_var(--color-ink)]"
                  : "text-ink hover:bg-raised-hover",
              )}
            >
              <MoreHorizontal
                size={16}
                className={cn("shrink-0", isHighlight ? "text-ink" : "text-ink-secondary")}
              />
              {badge ? (
                <span
                  data-testid={badgeTestId}
                  aria-label={badgeAriaLabel}
                  title={badgeAriaLabel}
                  className="absolute -top-0.5 -right-0.5 size-4 border border-hairline bg-panel font-mono text-[10px] text-ink flex items-center justify-center"
                >
                  {badge}
                </span>
              ) : (
                hasAttention && (
                  <span
                    className={cn(
                      "absolute top-1.5 right-1.5 size-1.5 rounded-full shrink-0",
                      tone === "accent" ? "bg-accent" : "bg-danger",
                    )}
                  />
                )
              )}
            </span>
          );
        }

        return (
          <span
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-8.5 w-full items-center gap-2.5 px-3 text-left font-mono text-[13px] transition-colors outline-none focus-visible:ring-1 focus-visible:ring-focus",
              isHighlight
                ? "bg-raised text-ink shadow-[inset_2px_0_0_var(--color-ink)]"
                : "text-ink hover:bg-raised-hover",
            )}
          >
            <MoreHorizontal
              size={16}
              className={cn("shrink-0", isHighlight ? "text-ink" : "text-ink-secondary")}
            />
            <span className="flex-1 truncate">{label}</span>
            {badge ? (
              <span
                data-testid={badgeTestId}
                aria-label={badgeAriaLabel}
                title={badgeAriaLabel}
                className="border border-hairline bg-panel font-mono text-[10px] text-ink flex items-center justify-center px-1.5 py-0.5"
              >
                {badge}
              </span>
            ) : null}
            {hasAttention && !badge && (
              <span
                className={cn(
                  "size-1.5 rounded-full shrink-0",
                  tone === "accent" ? "bg-accent" : "bg-danger",
                )}
              />
            )}
            <ChevronUp
              size={13}
              className={cn(
                "shrink-0 text-ink-secondary transition-transform",
                open && "rotate-180",
              )}
            />
          </span>
        );
      }}
    />
  );
}
