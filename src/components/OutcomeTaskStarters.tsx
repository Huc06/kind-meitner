import { Compass, Image, Sun, ArrowRight } from "lucide-react";
import { setComposerDraft } from "@/lib/drafts";

export interface OutcomeTaskStarter {
  id: string;
  label: string;
  agentBadge: string;
  prompt: string;
  icon: typeof Sun;
}

export const OUTCOME_TASK_STARTERS: readonly OutcomeTaskStarter[] = [
  {
    id: "outdoor-demo",
    label: "Best 45-minute run window in Singapore",
    agentBadge: "OutdoorWindow · okx.ai #6706",
    prompt: "When's the best time for a 45-minute run in Singapore over the next two days?",
    icon: Sun,
  },
  {
    id: "outdoor-now",
    label: "Check outdoor safety conditions right now",
    agentBadge: "OutdoorWindow · okx.ai #6706",
    prompt: "Is it safe to go outside right now in London?",
    icon: Compass,
  },
  {
    id: "plate-card",
    label: "Render a social card from text",
    agentBadge: "Plate · okx.ai #6708",
    prompt: "Render a social card for our product launch announcement",
    icon: Image,
  },
];

export function OutcomeTaskStarters({
  composerDraftId,
}: {
  composerDraftId: string;
}) {
  const handleSelectStarter = (prompt: string) => {
    setComposerDraft(composerDraftId, prompt);
    // Focus composer textarea if available
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea.chat-composer");
    if (textarea) {
      textarea.focus();
      textarea.value = prompt;
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center px-4 py-8 text-center animate-fade-in">
      <div className="font-mono text-[11px] uppercase tracking-wider text-ink-secondary mb-1.5">
        Kind Meitner Coordinator
      </div>
      <h1 className="text-[22px] font-semibold tracking-tight text-ink">
        What would you like to get done?
      </h1>
      <p className="mt-1.5 max-w-[440px] text-[13px] leading-relaxed text-ink-secondary">
        Describe useful work. Kind Meitner connects directly to autonomous okx.ai agents, coordinates execution, and delivers the result.
      </p>

      <div className="mt-6 flex w-full flex-col gap-2">
        {OUTCOME_TASK_STARTERS.map((starter) => {
          const Icon = starter.icon;
          return (
            <button
              key={starter.id}
              type="button"
              onClick={() => handleSelectStarter(starter.prompt)}
              className="group flex w-full items-center justify-between border border-hairline bg-card p-3 text-left transition-colors hover:border-ink hover:bg-raised"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-inset text-ink-secondary group-hover:text-ink">
                  <Icon size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium text-ink">{starter.label}</span>
                  <span className="font-mono text-[11px] text-ink-secondary">{starter.agentBadge}</span>
                </div>
              </div>
              <div className="text-ink-secondary opacity-0 transition-opacity group-hover:opacity-100">
                <ArrowRight size={14} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 font-mono text-[11.5px] text-ink-secondary/80">
        Connected services run directly via MCP — no local model engine required.
      </div>
    </div>
  );
}
