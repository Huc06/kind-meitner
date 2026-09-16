import { describe, expect, it } from "vitest";

import { x402HTTPResourceServer } from "@okxweb3/x402-core/http";
import { x402ResourceServer, type FacilitatorClient } from "@okxweb3/x402-core/server";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";
import { encodePaymentSignatureHeader, decodePaymentRequiredHeader } from "@okxweb3/x402-core/http";

import {
  X402_TESTNET_NETWORK,
  X402_TESTNET_RESOURCE_PATH,
  X402TestnetResource,
} from "./x402-testnet.ts";

const PAYER = "0x9999888877776666555544443333222211110000";
const PAY_TO = "0x1111222233334444555566667777888899990000";
const TX_HASH = "0xabc0000000000000000000000000000000000000000000000000000000000abc";

/**
 * A mock facilitator implementing the official FacilitatorClient interface.
 * It performs no network, signature recovery, or on-chain settlement; it only
 * lets us prove that our adapter drives the real SDK's 402 -> verify -> settle
 * wiring correctly. It is never used against production or real funds.
 */
function mockFacilitator(): FacilitatorClient {
  return {
    async getSupported() {
      return {
        kinds: [{
          x402Version: 2,
          scheme: "exact",
          network: X402_TESTNET_NETWORK,
          extra: { name: "USD₮0", version: "1" },
        }],
        extensions: [],
        signers: {},
      };
    },
    async verify() {
      return { isValid: true, payer: PAYER };
    },
    async settle() {
      return {
        success: true,
        status: "success" as const,
        payer: PAYER,
        transaction: TX_HASH,
        network: X402_TESTNET_NETWORK,
      };
    },
  };
}

function buildAdapter(headers: Record<string, string>) {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  return {
    getHeader: (name: string) => lower[name.toLowerCase()],
    getMethod: () => "POST",
    getPath: () => X402_TESTNET_RESOURCE_PATH,
    getUrl: () => `https://fixture.test${X402_TESTNET_RESOURCE_PATH}`,
    getAcceptHeader: () => "application/json",
    getUserAgent: () => "x402-e2e-fixture",
    getBody: () => ({}),
  };
}

function resourceWithMockFacilitator() {
  return new X402TestnetResource(
    {
      enabled: true,
      apiKey: "fixture-key",
      secretKey: "fixture-secret",
      passphrase: "fixture-passphrase",
      payTo: PAY_TO,
      resourceUrl: `https://fixture.test${X402_TESTNET_RESOURCE_PATH}`,
      price: "$0.01",
    },
    async (config) => {
      const server = new x402ResourceServer(mockFacilitator())
        .register(X402_TESTNET_NETWORK, new ExactEvmScheme());
      const httpServer = new x402HTTPResourceServer(server, {
        [`POST ${X402_TESTNET_RESOURCE_PATH}`]: {
          accepts: [{
            scheme: "exact",
            network: X402_TESTNET_NETWORK,
            payTo: config.payTo!,
            price: config.price || "$0.01",
            maxTimeoutSeconds: 300,
          }],
          resource: config.resourceUrl!,
          description: "x402 testnet E2E fixture",
          mimeType: "application/json",
        },
      });
      await httpServer.initialize();
      return httpServer;
    },
  );
}

describe("x402 testnet end-to-end (mock facilitator, no network or funds)", () => {
  it("returns a 402 PAYMENT-REQUIRED challenge when no payment is presented", async () => {
    const resource = resourceWithMockFacilitator();
    const result = await resource.process(buildAdapter({}));

    expect(result.type).toBe("payment-error");
    if (result.type !== "payment-error") return;
    expect(result.response.status).toBe(402);
    expect(result.response.headers["PAYMENT-REQUIRED"]).toBeTruthy();
  });

  it("verifies a presented payment and settles with an on-chain proof", async () => {
    const resource = resourceWithMockFacilitator();

    // Derive the payment from the server's own 402 challenge so the presented
    // requirements match exactly what the resource server advertised.
    const challengeResult = await resource.process(buildAdapter({}));
    expect(challengeResult.type).toBe("payment-error");
    if (challengeResult.type !== "payment-error") return;
    const challenge = decodePaymentRequiredHeader(challengeResult.response.headers["PAYMENT-REQUIRED"]);
    const accepted = challenge.accepts[0];

    const paymentHeader = encodePaymentSignatureHeader({
      x402Version: challenge.x402Version,
      accepted,
      payload: {
        signature: "0x" + "ab".repeat(65),
        authorization: {
          from: PAYER,
          to: accepted.payTo,
          value: accepted.amount,
          validAfter: "0",
          validBefore: String(Math.floor(Date.now() / 1000) + 3600),
          nonce: "0x" + "11".repeat(32),
        },
      },
    } as never);

    const adapter = buildAdapter({ "PAYMENT-SIGNATURE": paymentHeader });
    const processed = await resource.process(adapter);
    expect(processed.type).toBe("payment-verified");
    if (processed.type !== "payment-verified") return;

    const settlement = await resource.settle(adapter, processed, Buffer.from(JSON.stringify({ ok: true })));
    expect(settlement.success).toBe(true);
    if (!settlement.success) return;
    expect(settlement.network).toBe(X402_TESTNET_NETWORK);
    expect(settlement.transaction).toBe(TX_HASH);
    expect(settlement.headers["PAYMENT-RESPONSE"]).toBeTruthy();
  });
});
