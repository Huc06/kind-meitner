import { mkdtempSync, rmSync, writeFileSync, chmodSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  okxCredentialsStorePath,
  readStoredOkxCredentials,
  storedOkxCredentialsAreSecure,
  writeStoredOkxCredentials,
} from "./okx-credentials-store.ts";

let dir: string;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

function freshDir(): string {
  dir = mkdtempSync(join(tmpdir(), "okx-credentials-store-test-"));
  return dir;
}

describe("okxCredentialsStorePath", () => {
  it("points at okx-credentials.json under the given data directory", () => {
    const d = freshDir();
    expect(okxCredentialsStorePath(d)).toBe(join(d, "okx-credentials.json"));
  });
});

describe("readStoredOkxCredentials", () => {
  it("returns undefined when no file exists", () => {
    const d = freshDir();
    expect(readStoredOkxCredentials(d)).toBeUndefined();
  });

  it("returns undefined for malformed JSON instead of throwing", () => {
    const d = freshDir();
    writeFileSync(okxCredentialsStorePath(d), "{not json", { mode: 0o600 });
    expect(readStoredOkxCredentials(d)).toBeUndefined();
  });

  it("returns undefined when required fields are missing", () => {
    const d = freshDir();
    writeFileSync(okxCredentialsStorePath(d), JSON.stringify({ apiKey: "only-key" }), { mode: 0o600 });
    expect(readStoredOkxCredentials(d)).toBeUndefined();
  });

  it("reads back a complete, valid credential set", () => {
    const d = freshDir();
    writeStoredOkxCredentials({ apiKey: "k", secretKey: "s", passphrase: "p" }, d);
    expect(readStoredOkxCredentials(d)).toEqual({ apiKey: "k", secretKey: "s", passphrase: "p" });
  });

  it("includes an optional baseUrl when present", () => {
    const d = freshDir();
    writeStoredOkxCredentials({ apiKey: "k", secretKey: "s", passphrase: "p", baseUrl: "https://example.test" }, d);
    expect(readStoredOkxCredentials(d)).toEqual({ apiKey: "k", secretKey: "s", passphrase: "p", baseUrl: "https://example.test" });
  });
});

describe("writeStoredOkxCredentials", () => {
  it("writes the file at mode 0600", () => {
    const d = freshDir();
    writeStoredOkxCredentials({ apiKey: "k", secretKey: "s", passphrase: "p" }, d);
    const mode = statSync(okxCredentialsStorePath(d)).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("overwrites a previous value atomically (no partial/corrupt intermediate file left behind)", () => {
    const d = freshDir();
    writeStoredOkxCredentials({ apiKey: "first", secretKey: "s", passphrase: "p" }, d);
    writeStoredOkxCredentials({ apiKey: "second", secretKey: "s", passphrase: "p" }, d);
    expect(readStoredOkxCredentials(d)?.apiKey).toBe("second");
  });
});

describe("storedOkxCredentialsAreSecure", () => {
  it("is false when no file exists", () => {
    const d = freshDir();
    expect(storedOkxCredentialsAreSecure(d)).toBe(false);
  });

  it("is true for a correctly written, complete file", () => {
    const d = freshDir();
    writeStoredOkxCredentials({ apiKey: "k", secretKey: "s", passphrase: "p" }, d);
    expect(storedOkxCredentialsAreSecure(d)).toBe(true);
  });

  it("is false when the file is group- or world-readable", () => {
    const d = freshDir();
    writeStoredOkxCredentials({ apiKey: "k", secretKey: "s", passphrase: "p" }, d);
    chmodSync(okxCredentialsStorePath(d), 0o644);
    expect(storedOkxCredentialsAreSecure(d)).toBe(false);
  });

  it("is false when the file is 0600 but incomplete", () => {
    const d = freshDir();
    writeFileSync(okxCredentialsStorePath(d), JSON.stringify({ apiKey: "only-key" }), { mode: 0o600 });
    expect(storedOkxCredentialsAreSecure(d)).toBe(false);
  });
});
