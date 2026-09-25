import { Sparkles } from "lucide-react";
import { DEV_DAY_GATE_STARTERS, fillDevDayGateStarter } from "@/lib/dev-day-gate";

export function DevDayGateStarters({ composerDraftId, compact = false }: { composerDraftId: string; compact?: boolean }) {
  return (
    <section
      aria-label="Dev Day Gate starters"
      className={
        compact
          ? "rounded-xl border border-hairline/60 bg-panel/80 p-2.5 backdrop-blur"
          : "max-w-[480px] rounded-2xl border border-hairline/60 bg-panel/90 p-4 shadow-sm backdrop-blur"
      }
    >
      {!compact && (
        <div className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded-md bg-raised text-ink-secondary">
            <Sparkles size={12} />
          </span>
          <p className="text-[13px] font-semibold tracking-tight text-ink">Three agents, one gate</p>
        </div>
      )}
      <p className={compact ? "text-[11px] text-ink-secondary" : "mt-1.5 text-[12px] leading-relaxed text-ink-secondary"}>
        Choose a real readiness or trust check. Enter to send.
      </p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {DEV_DAY_GATE_STARTERS.map((starter) => (
          <button
            key={starter.id}
            type="button"
            onClick={() => fillDevDayGateStarter(composerDraftId, starter.prompt)}
            className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-hairline/50 bg-raised px-2.5 py-1 text-[12px] font-medium text-ink transition-all hover:bg-raised-hover hover:border-hairline active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            {starter.label}
          </button>
        ))}
      </div>
    </section>
  );
}
