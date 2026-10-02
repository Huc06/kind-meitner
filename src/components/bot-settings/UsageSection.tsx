// Usage: what this bot has spent across its tasks. Moved verbatim from
// SettingsPanel.tsx's BotUsageCard (~40-77); its "All bots →" button keeps
// dispatching toggleAppSettings, which closes this dialog — intended, since
// the destination is the app-wide Usage settings, not a per-bot view.
//
// BotUsageCard used to render nothing at all for a bot with no turns yet,
// which was fine buried among a dozen other cards in the old aside; as this
// section's entire content it would otherwise leave the panel blank, so a
// short placeholder line is added for that case.
import { useStore, type Bot } from "@/state/store";
import { botUsage, costCaption, formatTokens, formatUsd, hasFiniteCost } from "@/lib/usage";

export function UsageSection({ bot }: { bot: Bot }) {
  const { state, dispatch } = useStore();
  const usage = botUsage(bot);
  const instance = state.instances.find((i) => i.instanceId === bot.modelSelection.instanceId);

  if (usage.turns === 0) {
    return (
      <div className="border border-hairline bg-card p-4 font-mono text-[12px] text-ink-secondary">
        No usage recorded yet for this bot.
      </div>
    );
  }

  return (
    <div className="border border-hairline bg-card p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-[14px] font-medium text-ink">Usage</div>
        <button
          type="button"
          aria-label="All bots"
          onClick={() => dispatch({ type: "toggleAppSettings", open: true, section: "usage" })}
          className="font-mono text-[11px] uppercase tracking-wide text-ink-secondary hover:text-ink"
        >
          All bots →
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div className="border border-hairline bg-inset p-2.5">
          <div className="label-mono text-ink-secondary">Turns</div>
          <div className="mt-1 font-mono text-[14px] tabular-nums font-medium text-ink">{usage.turns}</div>
        </div>
        <div className="border border-hairline bg-inset p-2.5">
          <div className="label-mono text-ink-secondary">Tokens</div>
          <div
            className="mt-1 font-mono text-[14px] tabular-nums font-medium text-ink"
            title={`${formatTokens(usage.input)} in · ${formatTokens(usage.output)} out`}
          >
            {formatTokens(usage.input + usage.output)}
          </div>
        </div>
        <div className="border border-hairline bg-inset p-2.5">
          <div className="label-mono text-ink-secondary">Cost</div>
          <div className="mt-1 font-mono text-[14px] tabular-nums font-medium text-ink">
            {hasFiniteCost(usage.costUsd) ? formatUsd(usage.costUsd) : "—"}
          </div>
        </div>
      </div>
      <div className="mt-3 text-[12px] text-ink-secondary">
        {hasFiniteCost(usage.costUsd)
          ? `Cost ${costCaption(instance?.snapshot.billing)}.`
          : "This engine doesn't report a price; tokens are counted."}
      </div>
    </div>
  );
}
