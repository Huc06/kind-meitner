import { DEV_DAY_GATE_STARTERS, fillDevDayGateStarter, type DevDayGateStarter } from "@/lib/dev-day-gate";
import { Frame } from "@/components/ui/frame";
import { Kbd } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { useStore, type Bot } from "@/state/store";

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
  members,
  agentCount,
}: {
  composerDraftId: string;
  compact?: boolean;
  onInviteAgent?: () => void;
  members?: Bot[];
  agentCount?: number;
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
      let prompt = starter.prompt;
      if (members && members.length > 0 && !members.some((m) => m.name.toLowerCase() === "markets")) {
        prompt = prompt.replace("@Markets", `@${members[0].name}`);
      }
      fillDevDayGateStarter(composerDraftId, prompt);
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
          <p className="text-[13px] font-medium tracking-tight text-ink">
            {(() => {
              const count = agentCount ?? (members ? members.length : 3);
              const countText = count === 1 ? "1 agent" : count === 0 ? "No agents" : `${count} agents`;
              return t("room.starters.agentGate", { countText, count });
            })()}
          </p>
        </div>
      )}
      <p className={cn("text-ink-secondary", compact ? "label-mono" : "mt-1 text-[12px] leading-relaxed")}>
        {t("room.starters.chooseCheck")}
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
              {starter.capability && (
                <span className="label-mono text-ink-secondary text-[10px] uppercase tracking-wider shrink-0">
                  [{starter.capability}]
                </span>
              )}
            </span>
            <Kbd className="shrink-0">{starter.action === "hub" ? "Open" : "Fill"}</Kbd>
          </button>
        ))}
      </div>
    </Frame>
  );
}
