// Persistent local storage for OKX credentials, so `pnpm okx-serve` does
// not require exporting OKX_API_KEY/OKX_SECRET_KEY/OKX_PASSPHRASE on every
// run. Mirrors the pattern config.ts already uses for sensitive on-disk
// state: one JSON file under DATA_DIR, written atomically at mode 0600
// (readable/writable only by the user running this process).
//
// This store is read only at process startup, by this file's own code —
// it is never wired into any HTTP route. The values it holds must never
// be echoed back through a response; the settings API already enforces
// that independently by rejecting any credential field in its request
// body (see server/okx-local-server.ts's /api/okx/settings handler).

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { writeFileAtomic } from "./atomic.ts";
import { DATA_DIR } from "./config.ts";

export interface StoredOkxCredentials {
  apiKey: string;
  secretKey: string;
  passphrase: string;
  baseUrl?: string;
}

const STORE_FILE = "okx-credentials.json";

export function okxCredentialsStorePath(dataDir: string = DATA_DIR): string {
  return join(dataDir, STORE_FILE);
}

/** Reads the stored credential file, if present. Returns undefined for a
 * missing file, invalid JSON, or a shape that does not carry all three
 * required fields — never throws, so a corrupted file degrades to "not
 * configured" rather than crashing startup. */
export function readStoredOkxCredentials(dataDir: string = DATA_DIR): StoredOkxCredentials | undefined {
  const path = okxCredentialsStorePath(dataDir);
  if (!existsSync(path)) return undefined;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    if (
      raw && typeof raw === "object" &&
      typeof raw.apiKey === "string" && raw.apiKey.trim() &&
      typeof raw.secretKey === "string" && raw.secretKey.trim() &&
      typeof raw.passphrase === "string" && raw.passphrase.trim()
    ) {
      return {
        apiKey: raw.apiKey.trim(),
        secretKey: raw.secretKey.trim(),
        passphrase: raw.passphrase.trim(),
        ...(typeof raw.baseUrl === "string" && raw.baseUrl.trim() ? { baseUrl: raw.baseUrl.trim() } : {}),
      };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Writes the credential file atomically at mode 0600. `writeFileAtomic`
 * opens the temp file at that mode before writing anything to it, and
 * POSIX `rename()` preserves the temp file's mode completely on replace
 * — there is no window where the final path is briefly wider than 0600,
 * so no separate chmod is needed here. */
export function writeStoredOkxCredentials(credentials: StoredOkxCredentials, dataDir: string = DATA_DIR): void {
  const path = okxCredentialsStorePath(dataDir);
  writeFileAtomic(path, JSON.stringify(credentials, null, 2), { mode: 0o600 });
}

/** True only when the file exists, is owner-only (0600 or stricter on
 * the relevant bits), and parses to a complete credential set. Used by
 * the setup command to confirm a save actually took effect. */
export function storedOkxCredentialsAreSecure(dataDir: string = DATA_DIR): boolean {
  const path = okxCredentialsStorePath(dataDir);
  if (!existsSync(path)) return false;
  const mode = statSync(path).mode & 0o777;
  if (mode & 0o077) return false; // group/other has any permission bit
  return readStoredOkxCredentials(dataDir) !== undefined;
}
