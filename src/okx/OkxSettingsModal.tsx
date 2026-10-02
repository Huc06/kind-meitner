import { useEffect, useState } from "react";
import {
  Check,
  AlertCircle,
  Server,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { okxApiBase, okxApiUrl, okxPairingToken, setOkxApiBase, setOkxPairingToken } from "./okx-api-base";
import { fetchOkxSettings } from "./okx-settings-api";
import {
  DialogBackdrop,
  DialogPanel,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

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
    <DialogBackdrop onDismiss={onClose}>
      <DialogPanel className={cn("max-w-lg", className)}>
        <DialogHeader
          title="OKX Onchain OS Gateway Settings"
          onClose={onClose}
        />

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4 text-xs">
            {error && (
              <div className="border border-danger/40 bg-danger/10 p-3 text-xs text-danger flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Local OKX server */}
            <div className="space-y-2">
              <div className="label-mono text-ink-secondary flex items-center gap-1.5">
                <Server size={12} />
                Local OKX Server
              </div>
              <p className="text-[11px] leading-relaxed text-ink-secondary">
                Run <code className="border border-hairline bg-raised px-1 py-0.5 text-ink">pnpm okx-serve</code> on your own machine,
                then point this browser at it. Your OKX credentials stay in that process's environment and are never
                sent to this hosted UI.
              </p>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="url"
                  placeholder="http://127.0.0.1:8899 (leave blank to use this server)"
                  value={localServerUrl}
                  onChange={(e) => applyLocalServerUrl(e.target.value)}
                  className="h-8 font-mono text-xs flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void testLocalServerConnection()}
                  disabled={localServerCheck === "checking"}
                >
                  {localServerCheck === "checking" ? "Checking…" : "Test connection"}
                </Button>
              </div>
              {localServerCheck === "ok" && (
                <div className="flex items-center gap-1.5 text-[11px] text-success">
                  <Check size={12} /> Connected to the local OKX server.
                </div>
              )}
              {localServerCheck === "unreachable" && (
                <div className="flex items-center gap-1.5 text-[11px] text-danger">
                  <AlertCircle size={12} /> Could not reach that address. Confirm the server is running and, if it is on
                  another origin, that its <code className="border border-hairline bg-raised px-1 py-0.5 text-ink">KIND_MEITNER_OKX_ALLOWED_ORIGINS</code> includes this page's origin.
                </div>
              )}
              <div className="space-y-1">
                <FieldLabel>Pairing token</FieldLabel>
                <Input
                  type="password"
                  autoComplete="off"
                  placeholder="Paste the token printed in the okx-serve terminal"
                  value={pairingToken}
                  onChange={(e) => applyPairingToken(e.target.value)}
                  className="h-8 font-mono text-xs"
                />
                <p className="text-[10.5px] text-ink-secondary">
                  Required to save settings, receive webhooks, or use the paid MCP/x402 routes. Not needed just to view
                  read-only data. Stored only in this browser.
                </p>
              </div>
            </div>

            {/* Server-only credential boundary */}
            <div className="border border-hairline bg-raised/40 p-3 text-[11px] leading-relaxed text-ink-secondary">
              <div className="label-mono mb-1 text-ink-secondary">
                Developer Portal Credentials
              </div>
              API keys, passphrases, webhook secrets, recipient addresses, and payment configuration are server-only.
              Configure them in the local OKX server's own environment above; this browser never reads, stores, or submits them.
            </div>

            {/* Autonomous Treasury & Spend Caps */}
            <div className="space-y-3 pt-2 frame-rule-above">
              <div className="label-mono text-ink-secondary flex items-center gap-1.5">
                <Wallet size={12} />
                Autonomous Treasury & Budget Limits
                {loadingCurrent && <span className="text-ink-secondary/70">(loading current values…)</span>}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <FieldLabel>Wallet Balance ({token})</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={treasuryBalance}
                    disabled={loadingCurrent}
                    onChange={(e) => setTreasuryBalance(parseFloat(e.target.value) || 0)}
                    className="h-8 font-mono text-xs tabular-nums"
                  />
                </div>

                <div>
                  <FieldLabel>Max Per-Run ({token})</FieldLabel>
                  <Input
                    type="number"
                    min="1"
                    step="any"
                    value={maxPerRunSpend}
                    disabled={loadingCurrent}
                    onChange={(e) => setMaxPerRunSpend(parseFloat(e.target.value) || 0)}
                    className="h-8 font-mono text-xs tabular-nums"
                  />
                </div>

                <div>
                  <FieldLabel>Monthly Cap ({token})</FieldLabel>
                  <Input
                    type="number"
                    min="1"
                    step="any"
                    value={monthlyBudgetCap}
                    disabled={loadingCurrent}
                    onChange={(e) => setMonthlyBudgetCap(parseFloat(e.target.value) || 0)}
                    className="h-8 font-mono text-xs tabular-nums"
                  />
                </div>
              </div>

              <div className="border border-hairline bg-raised/40 p-2.5 text-[11px] text-ink-secondary leading-relaxed">
                <strong className="text-ink">Autonomous Escrow Rule:</strong> Scheduled routines running with target{" "}
                <code className="border border-hairline bg-raised px-1 py-0.5 text-ink">okx-task</code> will draw directly from the
                treasury. If a single run exceeds <strong className="text-ink">{maxPerRunSpend} {token}</strong> or pushes 30-day volume over{" "}
                <strong className="text-ink">{monthlyBudgetCap} {token}</strong>, execution is automatically halted.
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={savedSuccess ? "success" : "primary"}
              size="md"
              disabled={saving}
              className="gap-1.5"
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
            </Button>
          </DialogFooter>
        </form>
      </DialogPanel>
    </DialogBackdrop>
  );
}
