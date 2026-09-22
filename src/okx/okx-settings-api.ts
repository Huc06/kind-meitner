import type { OkxSettingsData } from "./OkxSettingsModal";
import { okxApiUrl, withOkxPairingHeader } from "./okx-api-base";

export interface OkxCurrentSettings {
  credentialsConfigured: boolean;
  webhookSecretConfigured: boolean;
  treasuryBalance: number;
  maxPerRunSpend: number;
  monthlyBudgetCap: number;
}

/** Reads the server's actual current values. Read-only; never needs the
 * pairing token. Used to pre-fill the settings modal so its numeric
 * fields show what is really configured instead of a hardcoded default
 * that would otherwise silently overwrite the real value on save. */
export async function fetchOkxSettings(fetcher: typeof fetch = fetch): Promise<OkxCurrentSettings | undefined> {
  try {
    const response = await fetcher(okxApiUrl("/api/okx/settings"));
    if (!response.ok) return undefined;
    return await response.json() as OkxCurrentSettings;
  } catch {
    return undefined;
  }
}

export async function saveOkxSettings(
  settings: OkxSettingsData,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const response = await fetcher(okxApiUrl("/api/okx/settings"), {
    method: "POST",
    headers: withOkxPairingHeader({ "Content-Type": "application/json" }),
    body: JSON.stringify(settings),
  });
  if (response.ok) return;

  const body = await response.json().catch(() => null) as { error?: unknown } | null;
  throw new Error(typeof body?.error === "string" ? body.error : `Unable to save OKX settings (${response.status})`);
}
