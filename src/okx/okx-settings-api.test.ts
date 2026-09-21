import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { saveOkxSettings } from "./okx-settings-api";
import { setOkxApiBase } from "./okx-api-base";

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  };
}

const settings = {
  treasuryBalance: 300,
  maxPerRunSpend: 75,
  monthlyBudgetCap: 750,
  token: "USDT",
};

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
});

afterEach(() => {
  setOkxApiBase(null);
});

describe("saveOkxSettings", () => {
  it("submits only the runtime settings payload", async () => {
    let requestInit: RequestInit | undefined;
    const fetcher: typeof fetch = async (_input, init) => {
      requestInit = init;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    await saveOkxSettings(settings, fetcher);

    expect(requestInit).toMatchObject({
      method: "POST",
      body: JSON.stringify(settings),
    });
    const body = String(requestInit?.body);
    for (const key of ["apiKey", "secretKey", "passphrase", "webhookSecret", "baseUrl"]) {
      expect(body).not.toContain(key);
    }
  });

  it("calls the same-origin relative path by default", async () => {
    let requestUrl: string | undefined;
    const fetcher: typeof fetch = async (input) => {
      requestUrl = String(input);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    await saveOkxSettings(settings, fetcher);
    expect(requestUrl).toBe("/api/okx/settings");
  });

  it("targets a configured local OKX server base URL instead", async () => {
    setOkxApiBase("http://127.0.0.1:8899");
    let requestUrl: string | undefined;
    const fetcher: typeof fetch = async (input) => {
      requestUrl = String(input);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    await saveOkxSettings(settings, fetcher);
    expect(requestUrl).toBe("http://127.0.0.1:8899/api/okx/settings");
  });

  it("throws the server failure instead of treating a rejected save as success", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: "OKX credentials are server-only" }), { status: 400 }));
    await expect(saveOkxSettings(settings, fetcher as typeof fetch)).rejects.toThrow("OKX credentials are server-only");
  });
});
