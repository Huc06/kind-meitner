import { useState } from "react";
import { MessageSquare, Loader2 } from "lucide-react";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function DemoFooter({ onOpenChat }: { onOpenChat: () => Promise<void> | void }) {
  const [opening, setOpening] = useState(false);

  const handleOpenGateChat = async () => {
    setOpening(true);
    try {
      await onOpenChat();
    } finally {
      setOpening(false);
    }
  };

  return (
    <footer className="mt-8 border-t border-hairline bg-surface px-4 py-6 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-[12.5px] font-medium text-ink">
            {t("demo.footer.askPrompt")}
          </p>
          <p className="font-mono text-[11.5px] text-ink-secondary">
            {t("demo.footer.note")}
          </p>
        </div>

        <div>
          <Button
            variant="secondary"
            size="sm"
            disabled={opening}
            onClick={handleOpenGateChat}
            className="font-mono text-[12px]"
          >
            {opening ? (
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            ) : (
              <MessageSquare size={13} aria-hidden="true" />
            )}
            <span>{t("demo.footer.askAction")}</span>
          </Button>
        </div>
      </div>
    </footer>
  );
}
