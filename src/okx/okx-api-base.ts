// Resolves where OKX API calls go. Defaults to same-origin (empty prefix,
// today's behavior) so nothing changes for a deployment that still runs
// the OKX routes on its own server. Set a local OKX server's origin here
// to point OKX calls at http://127.0.0.1:<port> instead — see
// docs/plans/okx-local-server-hosted-ui-split.md and
// server/okx-local-server.ts.
//
// Precedence: an explicit runtime override (localStorage, set from
// Settings) wins over a build-time default (VITE_OKX_API_BASE_URL), which
// wins over same-origin.

const STORAGE_KEY = "kind-meitner:okx-api-base-url";
const TOKEN_STORAGE_KEY = "kind-meitner:okx-pairing-token";

function readViteDefault(): string {
  try {
    const value = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_OKX_API_BASE_URL;
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
}

function readStoredOverride(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    // localStorage can throw in privacy modes or non-browser test
    // environments; same-origin is always a safe fallback.
    return "";
  }
}

/** Strips a trailing slash so callers can always write
 * `${okxApiBase()}/api/okx/...` without a double slash. */
function normalizeBase(base: string): string {
  const trimmed = base.trim();
  if (!trimmed) return "";
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

export function okxApiBase(): string {
  const override = normalizeBase(readStoredOverride());
  if (override) return override;
  return normalizeBase(readViteDefault());
}

export function setOkxApiBase(base: string | null): void {
  try {
    if (!base || !base.trim()) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, base.trim());
  } catch {
    // Best-effort only; callers should not depend on persistence succeeding.
  }
}

export function okxApiUrl(path: string): string {
  const base = okxApiBase();
  return base ? `${base}${path}` : path;
}

/** The pairing token the local OKX server prints once at startup. Required
 * for sensitive routes (saving settings, webhooks, paid MCP/x402 calls);
 * read-only routes never need it. Never sent anywhere except the local
 * server this browser is configured to call. */
export function okxPairingToken(): string {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setOkxPairingToken(token: string | null): void {
  try {
    if (!token || !token.trim()) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      return;
    }
    localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
  } catch {
    // Best-effort only; callers should not depend on persistence succeeding.
  }
}

/** Merges the pairing token header into an existing HeadersInit without
 * requiring every call site to know the header name. */
export function withOkxPairingHeader(headers: HeadersInit = {}): HeadersInit {
  const token = okxPairingToken();
  if (!token) return headers;
  return { ...headers, "x-okx-pairing-token": token };
}
