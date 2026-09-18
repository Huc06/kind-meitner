import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { launchVerificationServer, type VerificationServer } from "../../scripts/control-kind-meitner.ts";
import {
  X402_TESTNET_NETWORK,
  X402_TESTNET_RESOURCE_PATH,
  X402TestnetResource,
  x402PublicFailure,
} from "./x402-testnet.ts";

describe("official x402 testnet boundary", () => {
  it("is disabled without configuration and never creates a testnet payment path", () => {
    const resource = new X402TestnetResource({ enabled: false });
    expect(resource.status()).toEqual({
      enabled: false,
      ready: false,
      network: X402_TESTNET_NETWORK,
      resourcePath: X402_TESTNET_RESOURCE_PATH,
      reason: "OKX_X402_TESTNET_ENABLED is not true",
    });
  });

  it("requires all server-only testnet configuration before it can initialize", () => {
    const resource = new X402TestnetResource({ enabled: true, apiKey: "only-a-key" });
    expect(resource.status()).toMatchObject({
      enabled: true,
      ready: false,
      network: "eip155:1952",
      reason: expect.stringContaining("OKX_SECRET_KEY"),
    });
  });

  it("does not cache a failed initialization and retries on the next request", async () => {
    const readyConfig = {
      enabled: true,
      apiKey: "k",
      secretKey: "s",
      passphrase: "p",
      payTo: "0x1111222233334444555566667777888899990000",
      resourceUrl: "https://example.test/api/okx/x402-testnet/market-intelligence",
    };
    let attempts = 0;
    const initializer = async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("transient facilitator failure");
      return {} as never;
    };
    const resource = new X402TestnetResource(readyConfig, initializer);

    await expect(resource.ensureInitializedForTest()).rejects.toThrow("transient facilitator failure");
    await expect(resource.ensureInitializedForTest()).resolves.toBeUndefined();
    expect(attempts).toBe(2);
  });

  it("returns a stable public failure with trace correlation instead of provider details", () => {
    expect(x402PublicFailure("trace-review-1")).toEqual({
      error: "x402 testnet processing failed",
      traceId: "trace-review-1",
    });
  });

  describe("disabled public route", () => {
    let fixture: VerificationServer;
    let baseUrl: string;

    beforeAll(async () => {
      fixture = await launchVerificationServer();
      baseUrl = fixture.info.url;
    }, 30_000);

    afterAll(async () => {
      await fixture?.close();
    });

    it("returns 404 rather than a 402 payment challenge when the flag is absent", async () => {
      const res = await fetch(`${baseUrl}${X402_TESTNET_RESOURCE_PATH}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      expect(res.status).toBe(404);
      expect(res.headers.get("payment-required")).toBeNull();
      expect(res.headers.get("x-connect-id")).toBeTruthy();
      expect(res.headers.get("x-time-to-session")).toBeTruthy();
      const body = await res.json() as { error?: unknown; traceId?: unknown };
      expect(body).toMatchObject({ error: "x402 testnet is disabled" });
      expect(typeof body.traceId).toBe("string");
    });
  });
});
