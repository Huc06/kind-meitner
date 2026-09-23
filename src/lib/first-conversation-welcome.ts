// First-conversation empty-state suggestions. Labels are short; drafts are
// capability-honest editable requests (no claimed computer access, background
// routines, or already-connected tools). Filling a draft never sends.

import type { LocaleKey } from "@/locales";
import { setComposerDraft } from "./drafts";
import { t } from "./i18n";

export type WelcomeSuggestionId = "inbox" | "meetings" | "slack" | "research";

export interface WelcomeSuggestion {
  id: WelcomeSuggestionId;
  letter: string;
  /** Short label shown on the card. */
  labelKey: LocaleKey;
  /** Editable request placed into the composer on click. */
  draftKey: LocaleKey;
}

export const WELCOME_SUGGESTIONS: readonly WelcomeSuggestion[] = [
  {
    id: "inbox",
    letter: "A",
    labelKey: "chat.welcome.suggestion.inbox",
    draftKey: "chat.welcome.suggestion.inbox.draft",
  },
  {
    id: "meetings",
    letter: "B",
    labelKey: "chat.welcome.suggestion.meetings",
    draftKey: "chat.welcome.suggestion.meetings.draft",
  },
  {
    id: "slack",
    letter: "C",
    labelKey: "chat.welcome.suggestion.slack",
    draftKey: "chat.welcome.suggestion.slack.draft",
  },
  {
    id: "research",
    letter: "D",
    labelKey: "chat.welcome.suggestion.research",
    draftKey: "chat.welcome.suggestion.research.draft",
  },
];

export function welcomeSuggestionLabel(suggestion: WelcomeSuggestion): string {
  return t(suggestion.labelKey);
}

export function welcomeSuggestionDraft(suggestion: WelcomeSuggestion): string {
  return t(suggestion.draftKey);
}

/** Focus the bottom composer textarea after a draft fill. */
export function focusComposerInput(): void {
  if (typeof document === "undefined") return;
  requestAnimationFrame(() => {
    const input = document.querySelector(
      '[data-tour="composer"] textarea',
    ) as HTMLTextAreaElement | null;
    if (!input || input.disabled) return;
    input.focus();
    const len = input.value.length;
    try {
      input.setSelectionRange(len, len);
    } catch {
      /* some environments reject setSelectionRange on non-text inputs */
    }
  });
}

/** Fill the composer for a suggestion without sending. */
export function applyWelcomeSuggestion(draftId: string, suggestion: WelcomeSuggestion): string {
  const text = welcomeSuggestionDraft(suggestion);
  setComposerDraft(draftId, text);
  focusComposerInput();
  return text;
}

/** Put free-text into the composer and focus it, without sending. */
export function applyWelcomeCustomDraft(draftId: string, text: string): void {
  setComposerDraft(draftId, text);
  focusComposerInput();
}
