import { DEV_DAY_GATE_STARTERS, fillDevDayGateStarter } from "@/lib/dev-day-gate";

export function DevDayGateStarters({ composerDraftId, compact = false }: { composerDraftId: string; compact?: boolean }) {
  return (
    <section aria-label="Dev Day Gate starters" className={compact ? "rounded-xl border border-hairline/40 bg-panel px-3 py-2" : "max-w-[440px] rounded-2xl border border-hairline/40 bg-panel px-4 py-3 shadow-sm"}>
      {!compact && <p className="text-[14px] font-semibold text-ink">Three agents, one gate</p>}
      <p className={compact ? "text-[11.5px] text-ink-secondary" : "mt-1 text-[12.5px] leading-relaxed text-ink-secondary"}>
        Choose a real readiness or trust check. Enter to send.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-1.5">
        {DEV_DAY_GATE_STARTERS.map((starter) => (
          <button
            key={starter.id}
            type="button"
            onClick={() => fillDevDayGateStarter(composerDraftId, starter.prompt)}
            className="rounded-full border border-hairline/50 bg-raised px-2.5 py-1 text-[11.5px] font-medium text-ink-secondary hover:bg-raised-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            {starter.label}
          </button>
        ))}
      </div>
    </section>
  );
}
