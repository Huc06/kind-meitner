import { useState, type FormEvent } from "react";
import { Check, ExternalLink, KeyRound, Loader2, LockKeyhole, RefreshCw, X } from "lucide-react";

import { credentialConfigPatch, credentialResumeOutcome } from "../../shared/credential-request";
import { cn } from "@/lib/cn";
import { api, useStore, type ConfigStatus, type Message } from "@/state/store";
import { Frame } from "@/components/ui/frame";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
export function SecretRequestCard({
  botId,
  threadId,
  message,
}: {
  botId: string;
  threadId: string;
  message: Message;
}) {
  const { dispatch } = useStore();
  const secret = message.secret!;
  const remoteClient = window.ogb?.remoteClient?.active === true;
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedLocally, setSavedLocally] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const endpoint = `/api/bots/${encodeURIComponent(botId)}/secret-cards/${encodeURIComponent(message.id)}`;
  const error = localError ?? secret.error;
  const outcome = credentialResumeOutcome(secret);
  const provided = outcome === "provided";
  const declined = outcome === "dismissed";
  const description = provided
    ? secret.resumed
      ? "Saved securely. Your bot is continuing the task."
      : "Saved securely. Your bot will continue when its current turn settles."
    : declined
      ? "You chose not to provide this credential. kind-meitner could not resume the bot yet."
      : secret.description;
  const footerLabel = declined
    ? "Continuing without this credential failed"
    : secret.resumed
      ? "Bot resumed without seeing the key"
      : error
        ? "The key is safe; resuming failed"
        : "Waiting to resume safely";

  // A successful decline has no durable card to show. If its continuation
  // failed, bring the card back with the same retry affordance as a saved key.
  if (declined && (secret.resumed || !error)) return null;

  const notifyProvided = async () => {
    await api(`${endpoint}/provided`, {
      method: "POST",
      body: JSON.stringify({ threadId }),
    });
  };

  const retryResume = async () => {
    if (saving) return;
    setSaving(true);
    setLocalError(null);
    try {
      await api(`${endpoint}/resume`, {
        method: "POST",
        body: JSON.stringify({ threadId }),
      });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const save = async (event?: FormEvent) => {
    event?.preventDefault();
    if (saving || (!value.trim() && !savedLocally)) return;
    setSaving(true);
    setLocalError(null);
    try {
      if (!savedLocally) {
        const next = value.trim();
        const status: ConfigStatus = window.ogb?.setCredential
          ? await window.ogb.setCredential(secret.target, next)
          : await api("/api/config", {
              method: "PUT",
              body: JSON.stringify(credentialConfigPatch(secret.target, next)),
            });
        dispatch({ type: "configStatus", config: status });
        setValue("");
        setSavedLocally(true);
      }
      await notifyProvided();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const dismiss = () => {
    void api(`${endpoint}/dismiss`, {
      method: "POST",
      body: JSON.stringify({ threadId }),
    }).catch(() => {});
  };

  return (
    <div className="flex w-full justify-start">
      <Frame as="section" title="Secret" surface="app" className="w-full max-w-[520px] bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center border border-hairline bg-control text-ink">
            <KeyRound size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13.5px] font-medium text-ink">{secret.label}</span>
              {provided && (
                <Tag tone="success" variant="solid" size="sm">Saved</Tag>
              )}
            </div>
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary">
              {description}
            </p>
            {!provided && !declined && (
              <p className="mt-1 flex items-center gap-1 font-mono text-[11px] text-ink-secondary/80">
                <LockKeyhole size={11} /> Stored securely by kind-meitner and never added to chat.
              </p>
            )}
            {error && <p role="alert" className="mt-2 font-mono text-[11.5px] text-danger">{error}</p>}
          </div>
          {!provided && !declined && (
            <button
              onClick={dismiss}
              aria-label="Not now"
              title="Not now"
              className="p-1 text-ink-secondary hover:text-ink transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {remoteClient && !provided && !declined && (
          <div className="mt-3 border-t border-hairline pt-3 font-mono text-[11.5px] leading-relaxed text-ink-secondary">
            This key must be saved on the host computer. Open this conversation on the host to continue securely.
          </div>
        )}
        {!remoteClient && !provided && !declined && (
          <form onSubmit={(event) => void save(event)} className="mt-3 border-t border-hairline pt-3">
            <div className="flex gap-2">
              <input
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={secret.placeholder}
                disabled={saving || savedLocally}
                aria-label={secret.label}
                className="min-w-0 flex-1 border border-hairline bg-inset px-3 py-1.5 font-mono text-[12px] text-ink outline-none placeholder:text-ink-secondary/60 focus:border-ink disabled:opacity-60"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={saving || (!value.trim() && !savedLocally)}
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <LockKeyhole size={12} />}
                {savedLocally ? "Continue task" : "Save securely"}
              </Button>
            </div>
            <a
              href={secret.helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] text-ink hover:underline"
            >
              Where to get this key <ExternalLink size={10} />
            </a>
          </form>
        )}
        {(provided || declined) && (
          <div className={cn(
            "mt-3 flex items-center justify-between border-t border-hairline pt-2.5 font-mono text-[11px]",
            declined ? "text-danger" : "text-success",
          )}>
            <span className="flex items-center gap-1.5">
              {secret.resumed ? <Check size={12} /> : error ? <KeyRound size={12} /> : <Loader2 size={12} className="animate-spin" />}
              {footerLabel}
            </span>
            {!secret.resumed && error && (
              <Button
                variant="primary"
                size="xs"
                onClick={() => void retryResume()}
                disabled={saving}
              >
                {saving ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Try again
              </Button>
            )}
          </div>
        )}
      </Frame>
    </div>
  );
}
