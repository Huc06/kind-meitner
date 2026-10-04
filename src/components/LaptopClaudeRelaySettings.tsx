import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

import { api, useStore } from "@/state/store";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { CommandLine } from "./SettingsPrimitives";
import { ConfirmDialog } from "./ConfirmDialog";

export interface RelayTokenItem {
  id: string;
  name: string;
  createdAt: string;
  lastSeenAt: string | null;
  connected: boolean;
}

export interface LaptopClaudeRelaySettingsProps {
  initialTokens?: RelayTokenItem[];
}

export function LaptopClaudeRelaySettings({ initialTokens = [] }: LaptopClaudeRelaySettingsProps = {}) {
  const { refreshInstances } = useStore();
  const [tokens, setTokens] = useState<RelayTokenItem[]>(initialTokens);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("Laptop");
  const [creating, setCreating] = useState(false);
  const [newlyCreated, setNewlyCreated] = useState<{ id: string; token: string } | null>(null);
  const [confirmRevokeToken, setConfirmRevokeToken] = useState<RelayTokenItem | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTokens = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await api("/api/engine-relay/tokens")) as RelayTokenItem[];
      if (Array.isArray(data)) {
        setTokens(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTokens();
  }, [fetchTokens]);

  // A runner connects or drops while this card is open; keep its token row
  // and the engine's ready badge current without a manual refresh.
  useEffect(() => {
    const timer = window.setInterval(() => {
      void api("/api/engine-relay/tokens")
        .then((data: unknown) => { if (Array.isArray(data)) setTokens(data as RelayTokenItem[]); })
        .catch(() => {});
      void Promise.resolve(refreshInstances()).catch(() => {});
    }, 5000);
    return () => window.clearInterval(timer);
  }, [refreshInstances]);

  const createToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating || !name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = (await api("/api/engine-relay/tokens", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      })) as { id: string; token: string; createdAt: string };
      setNewlyCreated({ id: res.id, token: res.token });
      setName("Laptop");
      await fetchTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const revokeToken = async () => {
    if (!confirmRevokeToken || revoking) return;
    setRevoking(true);
    setError(null);
    try {
      await api(`/api/engine-relay/tokens/${encodeURIComponent(confirmRevokeToken.id)}`, {
        method: "DELETE",
      });
      if (newlyCreated?.id === confirmRevokeToken.id) {
        setNewlyCreated(null);
      }
      setConfirmRevokeToken(null);
      await fetchTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRevoking(false);
    }
  };

  const origin = typeof window !== "undefined" && window.location ? window.location.origin : "http://localhost:8810";
  const tokenDisplay = newlyCreated?.token || "<token>";
  const startCommand = `curl -fsSL ${origin}/api/engine-relay/runner.mjs -o ~/.kind-meitner-runner.mjs && KIND_MEITNER_RELAY_TOKEN=${tokenDisplay} node ~/.kind-meitner-runner.mjs --server ${origin}`;
  const agentPrompt = t("engines.relay.agentPromptText", { origin, token: tokenDisplay });

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(agentPrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 1500);
    } catch {}
  };

  return (
    <div className="mt-4 border-t border-hairline pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-mono text-[11.5px] uppercase tracking-wide text-ink-secondary">
            {t("engines.relay.title")}
          </h4>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-secondary">
            {t("engines.relay.intro")}
          </p>
        </div>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => void fetchTokens()}
          disabled={loading}
          className="h-6 gap-1 px-1.5 text-ink-secondary hover:text-ink"
        >
          <RefreshCw size={11} className={cn(loading && "animate-spin")} />
          {t("engines.account.check")}
        </Button>
      </div>

      {newlyCreated && (
        <div role="status" className="mt-3 border border-warning/40 bg-warning/5 p-3 text-[12px]">
          <p className="font-medium text-warning">{t("engines.relay.tokenWarning")}</p>
          <div className="mt-2">
            <CommandLine command={newlyCreated.token} copyLabel={t("engineSetup.copy")} />
          </div>
        </div>
      )}

      <div className="mt-3 space-y-3">
        <div className="border-t border-hairline pt-3">
          <form onSubmit={(e) => void createToken(e)} className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("engines.relay.tokenNamePlaceholder")}
              maxLength={80}
              disabled={creating}
              className="h-7 text-[12px]"
            />
            <Button
              variant="secondary"
              size="xs"
              type="submit"
              disabled={creating || !name.trim()}
              className="h-7 shrink-0 gap-1 px-2 text-[12px]"
            >
              {creating ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
              {creating ? t("engines.relay.creating") : t("engines.relay.createToken")}
            </Button>
          </form>
        </div>
        <div>
          <label className="text-[11.5px] font-medium text-ink-secondary">
            {t("engines.relay.startCommand")}
          </label>
          <div className="mt-1">
            <CommandLine command={startCommand} copyLabel={t("engineSetup.copyCommand")} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-[11.5px] font-medium text-ink-secondary">
              {t("engines.relay.agentPrompt")}
            </label>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => void copyPrompt()}
              className="h-5 gap-1 px-1.5 text-[11px] text-ink-secondary hover:text-ink"
            >
              {copiedPrompt ? <Check size={11} className="text-success" /> : <Copy size={11} />}
              {copiedPrompt ? t("engines.relay.promptCopied") : t("engines.relay.copyPrompt")}
            </Button>
          </div>
          <pre className="mt-1 max-h-40 overflow-x-auto whitespace-pre-wrap rounded border border-hairline bg-inset p-2 font-mono text-[11px] leading-relaxed text-ink">
            {agentPrompt}
          </pre>
        </div>


        <div className="space-y-1.5">
          <label className="text-[11.5px] font-medium text-ink-secondary">
            {t("engines.relay.tokens")}
          </label>
          {tokens.length === 0 ? (
            <p className="text-[11.5px] text-ink-secondary">{t("engines.relay.noTokens")}</p>
          ) : (
            <div className="divide-y divide-hairline border border-hairline bg-inset/40">
              {tokens.map((tok) => (
                <div key={tok.id} className="flex items-center justify-between p-2 text-[12px]">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink truncate">{tok.name}</span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-[11px]",
                          tok.connected ? "text-success" : "text-ink-secondary",
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            tok.connected ? "bg-success" : "bg-ink-secondary/40",
                          )}
                        />
                        {tok.connected ? t("engines.relay.connected") : t("engines.relay.disconnected")}
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-secondary">
                      {tok.lastSeenAt
                        ? t("engines.relay.lastSeen", { time: new Date(tok.lastSeenAt).toLocaleTimeString() })
                        : t("engines.relay.neverSeen")}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setConfirmRevokeToken(tok)}
                    className="h-6 px-1.5 text-danger hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 size={11} className="mr-1" />
                    {t("engines.relay.revoke")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <p role="alert" className="mt-2 text-[12px] text-danger">{error}</p>}

      <ConfirmDialog
        open={Boolean(confirmRevokeToken)}
        title={t("engines.relay.revokeTitle", { name: confirmRevokeToken?.name ?? "" })}
        body={t("engines.relay.revokeHint")}
        confirmLabel={t("engines.relay.revoke")}
        tone="neutral"
        onCancel={() => setConfirmRevokeToken(null)}
        onConfirm={() => void revokeToken()}
      />
    </div>
  );
}
