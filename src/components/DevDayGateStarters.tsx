import { DEV_DAY_GATE_STARTERS, fillDevDayGateStarter, type DevDayGateStarter } from "@/lib/dev-day-gate";
import { Frame } from "@/components/ui/frame";
import { Kbd } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";
import { useStore } from "@/state/store";

const TOUR_ATTRS: Record<string, string> = {
  "scan-asp": "starter-readiness",
  "trust-spend": "starter-trust",
  "trending-asps": "starter-trending",
  "invite-agent": "starter-invite",
  "a2mcp-checklist": "starter-checklist",
};

export function DevDayGateStarters({
  composerDraftId,
  compact = false,
  onInviteAgent,
}: {
  composerDraftId: string;
  compact?: boolean;
  onInviteAgent?: () => void;
}) {
  let storeDispatch: ((action: { type: "togglePlugins"; open: boolean; surface: "hub" }) => void) | null = null;
  try {
    const store = useStore();
    storeDispatch = store.dispatch;
  } catch {
    // Graceful fallback when rendered outside StoreProvider (e.g. static tests)
  }

  const handleStarterClick = (starter: DevDayGateStarter) => {
    if (starter.action === "hub") {
      if (onInviteAgent) {
        onInviteAgent();
      } else if (storeDispatch) {
        storeDispatch({ type: "togglePlugins", open: true, surface: "hub" });
      }
      return;
    }
    if (starter.prompt) {
      fillDevDayGateStarter(composerDraftId, starter.prompt);
    }
  };

  return (
    <Frame
      as="section"
      aria-label="Room starters"
      title="Starters"
      surface="app"
      data-tour="starters"
      className={cn("bg-panel", compact ? "p-2.5" : "max-w-[480px] p-3.5")}
    >
      {!compact && (
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-medium tracking-tight text-ink">Three agents, one gate</p>
        </div>
      )}
      <p className={cn("text-ink-secondary", compact ? "label-mono" : "mt-1 text-[12px] leading-relaxed")}>
        Choose a real readiness or trust check. Enter to send.
      </p>
      <div className="mt-2.5 flex flex-col gap-1">
        {DEV_DAY_GATE_STARTERS.map((starter) => (
          <button
            key={starter.id}
            type="button"
            data-tour={TOUR_ATTRS[starter.id]}
            onClick={() => handleStarterClick(starter)}
            className="group flex w-full items-center justify-between gap-2 border border-hairline bg-raised px-2.5 py-1.5 text-left text-[12px] text-ink transition-colors hover:border-ink-secondary/60 hover:bg-raised-hover active:bg-raised focus-visible:outline-none"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="font-mono text-ink-secondary transition-colors group-hover:text-ink">&gt;_</span>
              <span className="truncate">{starter.label}</span>
            </span>
            <Kbd className="shrink-0">{starter.action === "hub" ? "Open" : "Fill"}</Kbd>
          </button>
        ))}
      </div>
    </Frame>
  );
}
