// Terminal-only setup for OKX credentials — `pnpm okx-setup`. Prompts
// for OKX_API_KEY / OKX_SECRET_KEY / OKX_PASSPHRASE once and writes them
// to the 0600 store in okx-credentials-store.ts so future
// `pnpm okx-serve` runs pick them up without exporting environment
// variables every time.
//
// Deliberately terminal-only: this must never become an HTTP endpoint.
// The settings API in okx-local-server.ts already refuses any request
// body containing a credential field — this command is the one
// supported way to set them, matching the "server-only, browser never
// submits them" boundary documented throughout this feature.

import { createInterface } from "node:readline/promises";

import { DATA_DIR } from "./config.ts";
import { okxCredentialsStorePath, storedOkxCredentialsAreSecure, writeStoredOkxCredentials } from "./okx-credentials-store.ts";

export interface SetupIo {
  log(line: string): void;
  error(line: string): void;
  ask(question: string): Promise<string>;
  close(): void;
}

export function defaultSetupIo(): SetupIo {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return {
    log: (line) => console.log(line),
    error: (line) => console.error(line),
    ask: (question) => rl.question(question),
    close: () => rl.close(),
  };
}

export async function runOkxSetup(io: SetupIo = defaultSetupIo(), dataDir: string = DATA_DIR): Promise<number> {
  try {
    io.log("OKX credential setup");
    io.log(`Values are written to ${okxCredentialsStorePath(dataDir)} at file mode 0600 (readable only by you).`);
    io.log("Nothing typed here is sent anywhere except that local file. Input is not masked in this terminal —");
    io.log("make sure nobody is reading over your shoulder or recording your screen.");
    io.log("");

    const apiKey = (await io.ask("OKX API key: ")).trim();
    if (!apiKey) {
      io.error("An API key is required.");
      return 1;
    }
    const secretKey = (await io.ask("OKX secret key: ")).trim();
    if (!secretKey) {
      io.error("A secret key is required.");
      return 1;
    }
    const passphrase = (await io.ask("OKX passphrase: ")).trim();
    if (!passphrase) {
      io.error("A passphrase is required.");
      return 1;
    }
    const baseUrl = (await io.ask("OKX API base URL (optional, press Enter to skip): ")).trim();

    writeStoredOkxCredentials({ apiKey, secretKey, passphrase, ...(baseUrl ? { baseUrl } : {}) }, dataDir);

    if (!storedOkxCredentialsAreSecure(dataDir)) {
      io.error("Credentials were written but the file did not verify as owner-only (0600). Check the data directory's permissions.");
      return 1;
    }

    io.log("");
    io.log("Saved. `pnpm okx-serve` will use these automatically from now on.");
    io.log("An explicit OKX_API_KEY / OKX_SECRET_KEY / OKX_PASSPHRASE environment variable still takes precedence over this file.");
    return 0;
  } finally {
    io.close();
  }
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runOkxSetup().then((code) => {
    process.exitCode = code;
  });
}
