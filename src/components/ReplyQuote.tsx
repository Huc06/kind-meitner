import { MessageSquareReply, X } from "lucide-react";

import { peerLine } from "@/lib/peer-message";
import { replyAuthor, replySnippet } from "@/lib/replies";
import { t } from "@/lib/i18n";
import type { Message } from "@/state/store";

export function ReplyQuote({
  message,
  fallbackName,
  onJump,
  onClear,
  compact = false,
}: {
  message: Message;
  fallbackName?: string;
  onJump?: () => void;
  onClear?: () => void;
  compact?: boolean;
}) {
  const body = (
    <>
      <MessageSquareReply size={compact ? 12 : 14} className="shrink-0 text-ink" />
      <span className="min-w-0 flex-1">
        <span className="label-mono block text-ink">{t("chat.reply.replyingTo", { name: replyAuthor(message, fallbackName) })}</span>
        <span dir="auto" className="block truncate font-sans text-[11.5px] text-ink-secondary">{replySnippet(peerLine(message)?.body ?? message.text ?? "")}</span>
      </span>
    </>
  );
  return (
    <div className="flex min-w-0 items-center gap-2 border-s-2 border-ink bg-inset px-2.5 py-1.5">
      {onJump ? (
        <button type="button" onClick={onJump} className="cursor-pointer flex min-w-0 flex-1 items-center gap-2 text-start" title={t("chat.reply.jump")}>
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">{body}</div>
      )}
      {onClear && (
        <button type="button" onClick={onClear} aria-label={t("chat.reply.cancel")} className="cursor-pointer shrink-0 p-0.5 text-ink-secondary hover:bg-raised-hover hover:text-ink">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
