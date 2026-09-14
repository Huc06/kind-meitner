import { useState } from "react";
import {
  Key,
  Shield,
  Wallet,
  Check,
  AlertCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";

export interface OkxSettingsData {
  apiKey: string;
  secretKey: string;
  passphrase: string;
  webhookSecret: string;
  baseUrl: string;
  treasuryBalance: number;
  maxPerRunSpend: number;
  monthlyBudgetCap: number;
  walletAddress?: string;
  token?: string;
}

export interface OkxSettingsModalProps {
  open: boolean;
  onClose: () => void;
  initialSettings?: Partial<OkxSettingsData>;
  onSave: (settings: OkxSettingsData) => Promise<void>;
  className?: string;
}

export function OkxSettingsModal({
  open,
  onClose,
  initialSettings,
  onSave,
  className,
}: OkxSettingsModalProps) {
  const [apiKey, setApiKey] = useState(initialSettings?.apiKey ?? "");
  const [secretKey, setSecretKey] = useState(initialSettings?.secretKey ?? "");
  const [passphrase, setPassphrase] = useState(initialSettings?.passphrase ?? "");
  const [webhookSecret, setWebhookSecret] = useState(initialSettings?.webhookSecret ?? "");
  const [baseUrl, setBaseUrl] = useState(initialSettings?.baseUrl ?? "https://web3.okx.com");
  const [treasuryBalance, setTreasuryBalance] = useState(initialSettings?.treasuryBalance ?? 200);
  const [maxPerRunSpend, setMaxPerRunSpend] = useState(initialSettings?.maxPerRunSpend ?? 50);
  const [monthlyBudgetCap, setMonthlyBudgetCap] = useState(initialSettings?.monthlyBudgetCap ?? 500);
  const [token] = useState(initialSettings?.token ?? "USDT");

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

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
      await onSave({
        apiKey: apiKey.trim(),
        secretKey: secretKey.trim(),
        passphrase: passphrase.trim(),
        webhookSecret: webhookSecret.trim(),
        baseUrl: baseUrl.trim(),
        treasuryBalance: Number(treasuryBalance),
        maxPerRunSpend: Number(maxPerRunSpend),
        monthlyBudgetCap: Number(monthlyBudgetCap),
        token,
      });
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
          {/* Section 1: Developer Portal API Authentication */}
          <div className="space-y-3">
            <div className="font-semibold uppercase text-[10px] tracking-wider text-ink-secondary flex items-center gap-1.5">
              <Key size={12} />
              Developer Portal Credentials
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-ink-secondary font-medium">API Key (OK-ACCESS-KEY)</label>
                <input
                  type="text"
                  placeholder="e.g. 9b7a...-d12f"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full rounded-md border border-hairline/50 bg-inset px-3 py-1.5 font-mono text-xs focus:border-accent focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-ink-secondary font-medium">Passphrase</label>
                <input
                  type="password"
                  placeholder="Portal passphrase"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="w-full rounded-md border border-hairline/50 bg-inset px-3 py-1.5 font-mono text-xs focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-ink-secondary font-medium">Secret Key (HMAC-SHA256 Signing)</label>
              <input
                type="password"
                placeholder="Developer portal secret key"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                className="w-full rounded-md border border-hairline/50 bg-inset px-3 py-1.5 font-mono text-xs focus:border-accent focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-ink-secondary font-medium">Webhook Ingress Secret</label>
                <input
                  type="password"
                  placeholder="Webhook secret token"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="w-full rounded-md border border-hairline/50 bg-inset px-3 py-1.5 font-mono text-xs focus:border-accent focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-ink-secondary font-medium">Base URL</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="w-full rounded-md border border-hairline/50 bg-inset px-3 py-1.5 font-mono text-xs focus:border-accent focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Autonomous Treasury & Spend Caps */}
          <div className="space-y-3 pt-2 border-t border-hairline/30">
            <div className="font-semibold uppercase text-[10px] tracking-wider text-ink-secondary flex items-center gap-1.5">
              <Wallet size={12} />
              Autonomous Treasury & Budget Limits
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-ink-secondary font-medium">Wallet Balance ({token})</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={treasuryBalance}
                  onChange={(e) => setTreasuryBalance(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-md border border-hairline/50 bg-inset px-3 py-1.5 font-mono text-xs focus:border-accent focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-ink-secondary font-medium">Max Per-Run ({token})</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={maxPerRunSpend}
                  onChange={(e) => setMaxPerRunSpend(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-md border border-hairline/50 bg-inset px-3 py-1.5 font-mono text-xs focus:border-accent focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-ink-secondary font-medium">Monthly Cap ({token})</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={monthlyBudgetCap}
                  onChange={(e) => setMonthlyBudgetCap(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-md border border-hairline/50 bg-inset px-3 py-1.5 font-mono text-xs focus:border-accent focus:outline-none"
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
