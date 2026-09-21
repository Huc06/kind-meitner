import type { OkxSettingsData } from "./OkxSettingsModal";
import { okxApiUrl, withOkxPairingHeader } from "./okx-api-base";

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
