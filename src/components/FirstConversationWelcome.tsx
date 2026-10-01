import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { api, useStore, type Bot } from "@/state/store";
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
import { Frame } from "@/components/ui/frame";
import { WordTiles } from "@/components/ui/word-tiles";
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
      <div className="grid min-h-full flex-1 place-items-center px-4 py-10 text-center">
        <div className="flex flex-col items-center gap-3">
          <WordTiles sentence={bot.name} className="scale-75 origin-center mb-1" />
          <BotAvatar bot={bot} state="idle" size={56} motion="none" motionKey={0} />
          <RenameTitle
            value={bot.name}
            onCommit={rename}
            className="text-[17px] font-semibold tracking-tight text-ink"
            inputClassName="border border-hairline bg-inset px-2 py-0.5 text-center text-[17px] font-semibold"
          />
          <div className="max-w-[360px] font-sans text-[13px] text-ink-secondary">
            {bot.description || t("chat.emptyPrompt")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-full flex-1 place-items-center px-4 py-8 text-center">
      <Frame
        surface="app"
        title="WELCOME"
        data-tour="first-conversation-welcome"
        className="w-full max-w-[520px] bg-card p-5 text-left"
      >
        <div className="mb-4 flex items-center gap-3.5">
          <BotAvatar bot={bot} state="idle" size={48} motion="none" motionKey={0} />
          <div className="min-w-0 flex-1 text-left">
            <RenameTitle
              value={bot.name}
              onCommit={rename}
              className="text-[15.5px] font-semibold tracking-tight text-ink"
              inputClassName="border border-hairline bg-inset px-1.5 py-0.5 text-[15.5px] font-semibold"
            />
            <p className="mt-0.5 text-[12.5px] leading-snug text-ink-secondary line-clamp-2">
              {bot.description || t("chat.welcome.intro")}
            </p>
          </div>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="label-mono text-ink">{t("chat.welcome.heading")}</div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t("chat.welcome.dismissAria")}
            title={t("chat.welcome.dismiss")}
            className="cursor-pointer p-1 text-ink-secondary hover:bg-raised-hover hover:text-ink"
          >
            <X size={15} />
          </button>
        </div>

        <div className="mt-3 overflow-hidden border border-hairline bg-inset/40 divide-y divide-hairline">
          {WELCOME_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => applyWelcomeSuggestion(draftId, suggestion)}
              className="cursor-pointer flex w-full items-center gap-3 px-3.5 py-2.5 text-left font-sans text-[13.5px] leading-snug text-ink hover:bg-raised-hover"
            >
              <span className="flex size-5 shrink-0 items-center justify-center border border-hairline bg-card font-mono text-[10.5px] font-medium text-ink-secondary">
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
          className="mt-3.5 w-full border border-hairline bg-inset px-3 py-2 text-[13px] text-ink placeholder:text-ink-secondary/70 focus:outline-none focus:border-ink font-sans"
        />
      </Frame>
    </div>
  );
}
