import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { runOkxSetup, type SetupIo } from "./okx-setup.ts";
import { okxCredentialsStorePath, readStoredOkxCredentials } from "./okx-credentials-store.ts";

let dir: string;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

function freshDir(): string {
  dir = mkdtempSync(join(tmpdir(), "okx-setup-test-"));
  return dir;
}

function scriptedIo(answers: string[]): SetupIo {
  let i = 0;
  return {
    log: vi.fn(),
    error: vi.fn(),
    ask: vi.fn(async () => answers[i++] ?? ""),
    close: vi.fn(),
  };
}

describe("runOkxSetup", () => {
  it("writes a complete credential set at mode 0600 and reports success", async () => {
    const d = freshDir();
    const io = scriptedIo(["k", "s", "p", ""]);
    const code = await runOkxSetup(io, d);
    expect(code).toBe(0);
    expect(readStoredOkxCredentials(d)).toEqual({ apiKey: "k", secretKey: "s", passphrase: "p" });
    expect(statSync(okxCredentialsStorePath(d)).mode & 0o777).toBe(0o600);
  });

  it("includes an optional base URL when provided", async () => {
    const d = freshDir();
    const io = scriptedIo(["k", "s", "p", "https://example.test"]);
    await runOkxSetup(io, d);
    expect(readStoredOkxCredentials(d)?.baseUrl).toBe("https://example.test");
  });

  it("rejects an empty API key without writing anything", async () => {
    const d = freshDir();
    const io = scriptedIo(["", "s", "p", ""]);
    const code = await runOkxSetup(io, d);
    expect(code).toBe(1);
    expect(readStoredOkxCredentials(d)).toBeUndefined();
  });

  it("rejects an empty secret key without writing anything", async () => {
    const d = freshDir();
    const io = scriptedIo(["k", "", "p", ""]);
    const code = await runOkxSetup(io, d);
    expect(code).toBe(1);
    expect(readStoredOkxCredentials(d)).toBeUndefined();
  });

  it("rejects an empty passphrase without writing anything", async () => {
    const d = freshDir();
    const io = scriptedIo(["k", "s", "", ""]);
    const code = await runOkxSetup(io, d);
    expect(code).toBe(1);
    expect(readStoredOkxCredentials(d)).toBeUndefined();
  });

  it("always closes the io, even on a rejected input", async () => {
    const d = freshDir();
    const io = scriptedIo(["", "s", "p", ""]);
    await runOkxSetup(io, d);
    expect(io.close).toHaveBeenCalledOnce();
  });

  it("never logs or errors a raw credential value", async () => {
    const d = freshDir();
    const io = scriptedIo(["super-secret-key", "super-secret-secret", "super-secret-pass", ""]);
    await runOkxSetup(io, d);
    const logged = [
      ...(io.log as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0])),
      ...(io.error as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0])),
    ].join("\n");
    expect(logged).not.toContain("super-secret-key");
    expect(logged).not.toContain("super-secret-secret");
    expect(logged).not.toContain("super-secret-pass");
  });
});
