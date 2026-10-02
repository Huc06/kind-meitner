import { useState } from "react";
import { X } from "lucide-react";
import { useStore, visibleMessages, type Message } from "@/state/store";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { Frame } from "@/components/ui/frame";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** First-run quiz, not a live provider ask (those carry requestId). */
export function isOnboardingCard(message: Message): boolean {
  return message.kind === "options" && !!message.card && !message.card.requestId;
}

/** Hide the quiz once they have talked past it — picked an option, typed in
 * the composer, or dismissed it. Live asks are never this card. */
export function shouldHideOnboardingCard(message: Message, transcript: Message[]): boolean {
  if (!isOnboardingCard(message) || !message.card) return false;
  if (message.card.dismissed || message.card.answered) return true;
  const index = transcript.findIndex((entry) => entry.id === message.id);
  if (index < 0) return false;
  return transcript.slice(index + 1).some((later) => later.role === "user" && later.kind === "text");
}

export function OptionCard({
  botId,
  threadId,
  message,
  /** set when the card is in a room: the answer belongs to the room's thread */
  groupId,
}: {
  botId: string;
  threadId?: string;
  message: Message;
  groupId?: string;
}) {
  const { state, dispatch } = useStore();
  const [custom, setCustom] = useState("");
  const card = message.card;
  const bot = state.bots.find((candidate) => candidate.id === botId);
  const transcript = bot ? visibleMessages(bot) : [];
  // Full thread, not the mounted window: a search-focus slice can omit the
  // later user message that means they already talked past this quiz.
  if (!card || shouldHideOnboardingCard(message, transcript)) return null;

  const title = card.title;
  const subtitle = card.subtitle;
  const options = card.options;

  const answer = (text: string) => {
    if (!text.trim()) return;
    dispatch({ type: "answerCard", botId, threadId, messageId: message.id, answer: text.trim(), groupId });
  };

  return (
    <Frame as="section" title="Options" surface="app" className="w-full max-w-[840px] bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[14px] font-medium text-ink">{title}</div>
          <div className="mt-0.5 text-[12px] text-ink-secondary">
            {subtitle}
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            dispatch({ type: "dismissCard", botId, threadId, messageId: message.id, groupId })
          }
          className="p-1 text-ink-secondary hover:text-ink transition-colors"
          aria-label="Dismiss options"
        >
          <X size={14} />
        </button>
      </div>

      <div className="mt-3 border border-hairline bg-inset">
        {options.map((opt, i) => (
          <button
            key={opt}
            type="button"
            disabled={!!card.answered}
            onClick={() => answer(opt)}
            className={cn(
              "flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13.5px] text-ink transition-colors",
              i > 0 && "border-t border-hairline",
              (card.answeredText ?? card.answered) === opt
                ? "bg-raised-hover"
                : "hover:bg-raised-hover/60 disabled:hover:bg-transparent",
            )}
          >
            <span className="flex size-5 shrink-0 items-center justify-center border border-hairline bg-control font-mono text-[10.5px] font-medium text-ink-secondary">
              {LETTERS[i]}
            </span>
            <span>{opt}</span>
          </button>
        ))}
      </div>

      {/* a permission ask has no free-text answer — the broker only accepts
          allow/deny, so typing here used to fail silently */}
      {!card.answered && !card.tool && (
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && answer(custom)}
          placeholder={t("onboarding.card.custom")}
          className="mt-3 w-full border border-hairline bg-inset px-3 py-2 font-mono text-[12.5px] text-ink placeholder:text-ink-secondary/70 focus:outline-none focus:border-ink"
        />
      )}
    </Frame>
  );
}
