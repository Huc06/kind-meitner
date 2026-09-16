#!/usr/bin/env node
// Buyer-side sample for the local x402 testnet flow. It performs a REAL testnet
// payment against your locally running seller endpoint using the official OKX
// x402 fetch wrapper. It reads the buyer wallet key from the environment at
// runtime and NEVER hardcodes or logs it.
//
// Prerequisites (all in your own shell, not committed):
//   - Seller running locally with the testnet env from docs/x402-testnet-local.md
//   - A funded X Layer testnet wallet (test OKB for gas + test USD₮0), from the
//     X Layer Faucet: https://www.okx.com/xlayer/faucet/xlayerfaucet
//   - Install buyer deps once:  pnpm add -w @okxweb3/x402-fetch viem
//
// Run:
//   X402_BUYER_PRIVATE_KEY=0xYOURTESTNETKEY node scripts/x402-testnet-buyer-sample.mjs
//
// Optional overrides:
//   X402_SELFCHECK_URL / KIND_MEITNER_PORT  — target seller endpoint
//   X402_BUYER_RPC_URL                      — X Layer testnet RPC URL
//
// SECURITY: use a throwaway TESTNET key only. Do not paste a mainnet key.

const privateKey = process.env.X402_BUYER_PRIVATE_KEY;
if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
  console.error("Set X402_BUYER_PRIVATE_KEY to a 0x-prefixed 32-byte TESTNET key.");
  console.error("Never use a mainnet key here.");
  process.exit(1);
}

const port = process.env.KIND_MEITNER_PORT || "8799";
const url =
  process.env.X402_SELFCHECK_URL ||
  `http://127.0.0.1:${port}/api/okx/x402-testnet/market-intelligence`;
const rpcUrl = process.env.X402_BUYER_RPC_URL || "https://testrpc.xlayer.tech";

let wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader, ExactEvmScheme, toClientEvmSigner;
let createPublicClient, http, privateKeyToAccount;
try {
  ({ wrapFetchWithPaymentFromConfig } = await import("@okxweb3/x402-fetch"));
  ({ decodePaymentResponseHeader } = await import("@okxweb3/x402-core/http"));
  ({ ExactEvmScheme, toClientEvmSigner } = await import("@okxweb3/x402-evm"));
  ({ createPublicClient, http } = await import("viem"));
  ({ privateKeyToAccount } = await import("viem/accounts"));
} catch {
  console.error("Missing buyer dependencies. Install them once:");
  console.error("  pnpm add -w @okxweb3/x402-fetch viem");
  process.exit(1);
}

const X402_TESTNET_NETWORK = "eip155:1952";

// The account signs EIP-712 payment authorizations; the public client provides
// optional on-chain reads. This matches the official toClientEvmSigner shape.
const account = privateKeyToAccount(privateKey);
const publicClient = createPublicClient({ transport: http(rpcUrl) });
const signer = toClientEvmSigner(account, publicClient);

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: X402_TESTNET_NETWORK, client: new ExactEvmScheme(signer) }],
});

console.log(`Paying ${url} on ${X402_TESTNET_NETWORK} (testnet)…`);
const response = await fetchWithPayment(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
});

console.log(`HTTP ${response.status}`);
const receiptHeader = response.headers.get("PAYMENT-RESPONSE");
if (receiptHeader) {
  const receipt = decodePaymentResponseHeader(receiptHeader);
  console.log("Settlement proof:", JSON.stringify(receipt, null, 2));
} else {
  console.log("No PAYMENT-RESPONSE header — payment did not settle.");
}
const bodyText = await response.text();
console.log("Response body:", bodyText.slice(0, 600));
