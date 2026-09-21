import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { api, useStore, type Bot } from "@/state/store";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import {
  draftRevision,
  recoverFailedComposerSend,
  restoreComposerDraft,
  restoredSendId,
  type ComposerSendSnapshot,
} from "@/lib/drafts";
import {
  applyWelcomeSuggestion,
  WELCOME_SUGGESTIONS,
  welcomeSuggestionLabel,
} from "@/lib/first-conversation-welcome";
import {
  dismissWelcome,
  isWelcomeDismissed,
  shouldShowFirstConversationWelcome,
  welcomeConversationKey,
} from "@/lib/welcome-dismissals";
import { BotAvatar } from "./Avatar";
import { RenameTitle } from "./RenameTitle";

/**
 * Empty-thread welcome: intro + suggestion card. Never writes into the
 * transcript — suggestions only fill the composer draft; dismissals live in
 * localStorage keyed like drafts.
 */
export function FirstConversationWelcome({
  bot,
  messageCount,
}: {
  bot: Bot;
  /** Active-branch message count; welcome hides once any real message exists. */
  messageCount: number;
}) {
  const { dispatch } = useStore();
  const draftId = welcomeConversationKey(bot.id, bot.threadId);
  const [dismissed, setDismissed] = useState(() => isWelcomeDismissed(draftId));
  const [custom, setCustom] = useState("");
  const sendingRef = useRef(false);

  useEffect(() => {
    setDismissed(isWelcomeDismissed(draftId));
    setCustom("");
    sendingRef.current = false;
  }, [draftId]);

  const showWelcome = shouldShowFirstConversationWelcome({
    messageCount,
    busy: Boolean(bot.busy),
    dismissed,
  });

  const rename = useCallback(
    (name: string) => {
      if (window.ogb?.remoteClient?.active) {
        void api(`/api/bots/${bot.id}/profile`, { method: "PATCH", body: JSON.stringify({ name }) })
          .then(({ bot: updated }) => dispatch({ type: "botPatched", bot: updated }))
          .catch((cause) =>
            dispatch({ type: "error", message: cause instanceof Error ? cause.message : String(cause) }),
          );
      } else {
        dispatch({ type: "updateBot", botId: bot.id, patch: { name } });
      }
    },
    [bot.id, dispatch],
  );

  const onDismiss = () => {
    dismissWelcome(draftId);
    setDismissed(true);
  };

  const sendCustom = () => {
    const body = custom.trim();
    if (!body || sendingRef.current || bot.busy) return;
    sendingRef.current = true;
    const sendId = restoredSendId(draftId) ?? crypto.randomUUID();
    const sent: ComposerSendSnapshot = {
      draftId,
      revision: draftRevision(draftId),
      sendId,
      text: body,
      requestText: body,
      attachments: [],
      threadId: bot.threadId,
    };
    // Same dispatch path Composer uses. Clear the card field without bumping
    // the draft revision (Composer clears via setText, not markDraftEdited) so
    // a recoverable failure can restore this exact snapshot.
    setCustom("");
    restoreComposerDraft(draftId, { text: "", attachments: [], channelMode: "chat" });
    dispatch({
      type: "send",
      botId: bot.id,
      text: body,
      sendId,
      threadId: bot.threadId,
      onError: () => {
        recoverFailedComposerSend(sent);
        sendingRef.current = false;
      },
    });
    // Message arrival hides the card. Release the guard on the next turn so a
    // later edit+Enter can send again after a failure restored the draft.
    queueMicrotask(() => {
      sendingRef.current = false;
    });
  };

  if (!showWelcome) {
    // Dismissed (or otherwise ineligible): keep the quiet empty shell so the
    // thread does not look broken before the first send.
    if (messageCount > 0 || bot.busy) return null;
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
        <BotAvatar bot={bot} state="idle" size={64} motion="none" motionKey={0} />
        <RenameTitle
          value={bot.name}
          onCommit={rename}
          className="text-[17px] font-semibold text-ink"
          inputClassName="rounded bg-inset px-1.5 py-0.5 text-center text-[17px] font-semibold"
        />
        <div className="max-w-[360px] text-[14px] text-ink-secondary">
          {bot.description || t("chat.emptyPrompt")}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-20 text-center">
      <div className="flex flex-col items-center gap-3">
        <BotAvatar bot={bot} state="idle" size={64} motion="none" motionKey={0} />
        <RenameTitle
          value={bot.name}
          onCommit={rename}
          className="text-[17px] font-semibold text-ink"
          inputClassName="rounded bg-inset px-1.5 py-0.5 text-center text-[17px] font-semibold"
        />
        <p className="max-w-[420px] text-[14px] leading-relaxed text-ink-secondary">
          {bot.description || t("chat.welcome.intro")}
        </p>
      </div>

      <div
        data-tour="first-conversation-welcome"
        className="w-full max-w-[520px] rounded-2xl border border-hairline/35 bg-card p-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03),0_12px_32px_rgba(0,0,0,0.05)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="text-[15px] font-semibold tracking-tight text-ink">{t("chat.welcome.heading")}</div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t("chat.welcome.dismissAria")}
            title={t("chat.welcome.dismiss")}
            className="rounded-md p-1 text-ink-secondary hover:bg-control/80 hover:text-ink"
          >
            <X size={15} />
          </button>
        </div>

        <div className="mt-3.5 overflow-hidden rounded-xl border border-hairline/30">
          {WELCOME_SUGGESTIONS.map((suggestion, i) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => applyWelcomeSuggestion(draftId, suggestion)}
              className={cn(
                "flex w-full items-center gap-3 px-3.5 py-3 text-left text-[14.5px] leading-snug text-ink",
                i > 0 && "border-t border-hairline/25",
                "hover:bg-raised-hover/50",
              )}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-hairline/35 bg-control/80 text-[11.5px] font-medium text-ink-secondary">
                {suggestion.letter}
              </span>
              {welcomeSuggestionLabel(suggestion)}
            </button>
          ))}
        </div>

        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            sendCustom();
          }}
          placeholder={t("chat.welcome.custom")}
          className="mt-3.5 w-full rounded-xl border border-hairline/30 bg-inset/80 px-3.5 py-2.5 text-[14.5px] text-ink placeholder:text-ink-secondary focus:outline-none focus:border-hairline/60"
        />
      </div>
    </div>
  );
}
