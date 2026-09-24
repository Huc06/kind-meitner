import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { okxApiBase, okxApiUrl, setOkxApiBase } from "./okx-api-base";

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
});

afterEach(() => {
  setOkxApiBase(null);
});

describe("okxApiBase", () => {
  it("defaults to same-origin (empty base) with nothing configured", () => {
    expect(okxApiBase()).toBe("");
  });

  it("returns a stored override once set", () => {
    setOkxApiBase("http://127.0.0.1:8899");
    expect(okxApiBase()).toBe("http://127.0.0.1:8899");
  });

  it("strips a trailing slash so callers never get a double slash", () => {
    setOkxApiBase("http://127.0.0.1:8899/");
    expect(okxApiBase()).toBe("http://127.0.0.1:8899");
  });

  it("clears back to same-origin when set to null", () => {
    setOkxApiBase("http://127.0.0.1:8899");
    setOkxApiBase(null);
    expect(okxApiBase()).toBe("");
  });

  it("treats a blank string the same as clearing", () => {
    setOkxApiBase("http://127.0.0.1:8899");
    setOkxApiBase("   ");
    expect(okxApiBase()).toBe("");
  });
});

describe("okxApiUrl", () => {
  it("returns the bare path when no base is configured", () => {
    expect(okxApiUrl("/api/okx/settings")).toBe("/api/okx/settings");
  });

  it("prefixes the configured base ahead of the path", () => {
    setOkxApiBase("http://127.0.0.1:8899");
    expect(okxApiUrl("/api/okx/settings")).toBe("http://127.0.0.1:8899/api/okx/settings");
  });
});
