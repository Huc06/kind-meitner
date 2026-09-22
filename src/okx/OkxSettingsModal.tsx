import { useEffect, useState } from "react";
import {
  Shield,
  Wallet,
  Check,
  AlertCircle,
  X,
  Server,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { okxApiBase, okxApiUrl, okxPairingToken, setOkxApiBase, setOkxPairingToken } from "./okx-api-base";
import { fetchOkxSettings } from "./okx-settings-api";

export interface OkxSettingsData {
  treasuryBalance: number;
  maxPerRunSpend: number;
  monthlyBudgetCap: number;
  token?: string;
}

/** Payload accepted by the runtime settings endpoint. Credentials are
 * deliberately absent: Railway service variables are the only secret source. */
export function buildOkxSettingsPayload(settings: OkxSettingsData): OkxSettingsData {
  return {
    treasuryBalance: Number(settings.treasuryBalance),
    maxPerRunSpend: Number(settings.maxPerRunSpend),
    monthlyBudgetCap: Number(settings.monthlyBudgetCap),
    ...(settings.token ? { token: settings.token } : {}),
  };
}

export interface OkxSettingsModalProps {
  open: boolean;
  onClose: () => void;
  initialSettings?: Partial<OkxSettingsData>;
  onSave: (settings: OkxSettingsData) => Promise<void>;
  className?: string;
}

/** Whether the modal should fetch the server's real current values on
 * open. Only when the caller did not already supply them — a caller
 * that passes initialSettings is assumed to have a source of truth of
 * its own and does not want this modal overriding it with a fetch. */
export function shouldFetchCurrentSettings(open: boolean, initialSettings: Partial<OkxSettingsData> | undefined): boolean {
  return open && !initialSettings;
}

export function OkxSettingsModal({
  open,
  onClose,
  initialSettings,
  onSave,
  className,
}: OkxSettingsModalProps) {
  const [treasuryBalance, setTreasuryBalance] = useState(initialSettings?.treasuryBalance ?? 200);
  const [maxPerRunSpend, setMaxPerRunSpend] = useState(initialSettings?.maxPerRunSpend ?? 50);
  const [monthlyBudgetCap, setMonthlyBudgetCap] = useState(initialSettings?.monthlyBudgetCap ?? 500);
  const [token] = useState(initialSettings?.token ?? "USDT");
  const [loadingCurrent, setLoadingCurrent] = useState(!initialSettings);

  const [localServerUrl, setLocalServerUrl] = useState(okxApiBase());
  const [localServerCheck, setLocalServerCheck] = useState<"idle" | "checking" | "ok" | "unreachable">("idle");
  const [pairingToken, setPairingToken] = useState(okxPairingToken());

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The caller (App.tsx) does not have a live copy of the server's actual
  // treasury values, so this modal fetches them itself when opened without
  // an explicit initialSettings. Without this, the fields below always
  // showed a hardcoded default (e.g. 200) regardless of what was really
  // configured — and because the server side used to treat a save as an
  // additive top-up, saving that stale default silently changed the real
  // balance by an amount the user never intended. The server side now
  // sets the balance to exactly what is submitted, so this fetch is what
  // makes "submitting the value shown" match "the value that was there".
  useEffect(() => {
    if (!shouldFetchCurrentSettings(open, initialSettings)) return;
    let cancelled = false;
    setLoadingCurrent(true);
    void fetchOkxSettings().then((current) => {
      if (cancelled || !current) return;
      setTreasuryBalance(current.treasuryBalance);
      setMaxPerRunSpend(current.maxPerRunSpend);
      setMonthlyBudgetCap(current.monthlyBudgetCap);
    }).finally(() => {
      if (!cancelled) setLoadingCurrent(false);
    });
    return () => {
      cancelled = true;
    };
    // Re-fetch each time the modal opens, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const applyLocalServerUrl = (value: string) => {
    setLocalServerUrl(value);
    setOkxApiBase(value || null);
    setLocalServerCheck("idle");
  };

  const applyPairingToken = (value: string) => {
    setPairingToken(value);
    setOkxPairingToken(value || null);
  };

  const testLocalServerConnection = async () => {
    setLocalServerCheck("checking");
    try {
      const res = await fetch(okxApiUrl("/api/health"));
      setLocalServerCheck(res.ok ? "ok" : "unreachable");
    } catch {
      setLocalServerCheck("unreachable");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedSuccess(false);

    if (maxPerRunSpend <= 0) {
      setError("Per-run spend cap must be greater than 0");
      return;
    }
    if (monthlyBudgetCap < maxPerRunSpend) {
      setError("Monthly budget cap cannot be less than per-run spend cap");
      return;
    }

    setSaving(true);
    try {
      await onSave(buildOkxSettingsPayload({
        treasuryBalance,
        maxPerRunSpend,
        monthlyBudgetCap,
        token,
      }));
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className={cn(
          "w-full max-w-lg rounded-2xl border border-hairline/50 bg-card p-6 shadow-2xl text-ink space-y-5 animate-in fade-in zoom-in-95 duration-150",
          className,
        )}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-hairline/40 pb-3">
          <div className="flex items-center gap-2">
            <Shield className="text-accent" size={20} />
            <h2 className="text-base font-bold">OKX Onchain OS Gateway Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-ink-secondary hover:bg-raised hover:text-ink transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-danger/10 border border-danger/20 p-3 text-xs text-danger flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Local OKX server — where credential-bearing OKX calls actually
              go. Never Railway/hosted: this browser only stores the URL it
              is told to call, never a credential. */}
          <div className="space-y-2">
            <div className="font-semibold uppercase text-[10px] tracking-wider text-ink-secondary flex items-center gap-1.5">
              <Server size={12} />
              Local OKX Server
            </div>
            <p className="text-[11px] leading-relaxed text-ink-secondary">
              Run <code className="bg-raised px-1 py-0.5 rounded text-ink">pnpm okx-serve</code> on your own machine,
              then point this browser at it. Your OKX credentials stay in that process's environment and are never
              sent to this hosted UI.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="url"
                placeholder="http://127.0.0.1:8899 (leave blank to use this server)"
                value={localServerUrl}
                onChange={(e) => applyLocalServerUrl(e.target.value)}
                className="flex-1 rounded-md border border-hairline/50 bg-inset px-3 py-1.5 font-mono text-xs focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void testLocalServerConnection()}
                disabled={localServerCheck === "checking"}
                className="shrink-0 rounded-md border border-hairline/50 px-3 py-1.5 font-medium text-ink-secondary hover:bg-raised transition-colors disabled:opacity-50"
              >
                {localServerCheck === "checking" ? "Checking…" : "Test connection"}
              </button>
            </div>
            {localServerCheck === "ok" && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-500">
                <Check size={12} /> Connected to the local OKX server.
              </div>
            )}
            {localServerCheck === "unreachable" && (
              <div className="flex items-center gap-1.5 text-[11px] text-danger">
                <AlertCircle size={12} /> Could not reach that address. Confirm the server is running and, if it is on
                another origin, that its <code className="bg-raised px-1 py-0.5 rounded text-ink">KIND_MEITNER_OKX_ALLOWED_ORIGINS</code> includes this page's origin.
              </div>
            )}
            <div className="space-y-1">
              <label className="text-ink-secondary font-medium">Pairing token</label>
              <input
                type="password"
                autoComplete="off"
                placeholder="Paste the token printed in the okx-serve terminal"
                value={pairingToken}
                onChange={(e) => applyPairingToken(e.target.value)}
                className="w-full rounded-md border border-hairline/50 bg-inset px-3 py-1.5 font-mono text-xs focus:border-accent focus:outline-none"
              />
              <p className="text-[10.5px] text-ink-secondary">
                Required to save settings, receive webhooks, or use the paid MCP/x402 routes. Not needed just to view
                read-only data. Stored only in this browser.
              </p>
            </div>
          </div>

          {/* Server-only credential boundary */}
          <div className="rounded-lg border border-hairline/40 bg-raised/40 p-3 text-[11px] leading-relaxed text-ink-secondary">
            <div className="mb-1 font-semibold uppercase tracking-wider text-[10px] text-ink-secondary">
              Developer Portal Credentials
            </div>
            API keys, passphrases, webhook secrets, recipient addresses, and payment configuration are server-only.
            Configure them in the local OKX server's own environment above; this browser never reads, stores, or submits them.
          </div>

          {/* Autonomous Treasury & Spend Caps */}
          <div className="space-y-3 pt-2 border-t border-hairline/30">
            <div className="font-semibold uppercase text-[10px] tracking-wider text-ink-secondary flex items-center gap-1.5">
              <Wallet size={12} />
              Autonomous Treasury & Budget Limits
              {loadingCurrent && <span className="text-ink-secondary/70">(loading current values…)</span>}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-ink-secondary font-medium">Wallet Balance ({token})</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={treasuryBalance}
                  disabled={loadingCurrent}
                  onChange={(e) => setTreasuryBalance(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-md border border-hairline/50 bg-inset px-3 py-1.5 font-mono text-xs focus:border-accent focus:outline-none disabled:opacity-50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-ink-secondary font-medium">Max Per-Run ({token})</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={maxPerRunSpend}
                  disabled={loadingCurrent}
                  onChange={(e) => setMaxPerRunSpend(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-md border border-hairline/50 bg-inset px-3 py-1.5 font-mono text-xs focus:border-accent focus:outline-none disabled:opacity-50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-ink-secondary font-medium">Monthly Cap ({token})</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={monthlyBudgetCap}
                  disabled={loadingCurrent}
                  onChange={(e) => setMonthlyBudgetCap(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-md border border-hairline/50 bg-inset px-3 py-1.5 font-mono text-xs focus:border-accent focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>

            <div className="rounded-lg bg-raised/40 p-2.5 text-[11px] text-ink-secondary leading-relaxed">
              <strong>Autonomous Escrow Rule:</strong> Scheduled routines running with target{" "}
              <code className="bg-raised px-1 py-0.5 rounded text-ink">okx-task</code> will draw directly from the
              treasury. If a single run exceeds <strong>{maxPerRunSpend} {token}</strong> or pushes 30-day volume over{" "}
              <strong>{monthlyBudgetCap} {token}</strong>, execution is automatically halted.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-hairline/30">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 font-medium text-ink-secondary hover:bg-raised transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={cn(
                "rounded-lg px-5 py-2 font-semibold text-ink transition-colors flex items-center gap-1.5",
                savedSuccess ? "bg-emerald-600" : "bg-accent hover:opacity-90",
              )}
            >
              {savedSuccess ? (
                <>
                  <Check size={14} /> Saved
                </>
              ) : saving ? (
                "Saving..."
              ) : (
                "Save Configuration"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
