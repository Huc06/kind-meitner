#!/usr/bin/env node
// Local x402 testnet self-check. Verifies the disabled/enabled boundary and the
// unauthenticated 402 + PAYMENT-REQUIRED challenge WITHOUT signing a payment.
//
// It never reads or prints secrets: it only calls your local loopback endpoint.
// Configure the server (in its own shell) with the testnet env described in
// docs/x402-testnet-local.md, then run:
//
//   node scripts/x402-testnet-selfcheck.mjs
//
// Optional overrides:
//   X402_SELFCHECK_URL   full endpoint URL (default derived from KIND_MEITNER_PORT)
//   KIND_MEITNER_PORT    local port (default 8799)

const port = process.env.KIND_MEITNER_PORT || "8799";
const url =
  process.env.X402_SELFCHECK_URL ||
  `http://127.0.0.1:${port}/api/okx/x402-testnet/market-intelligence`;

function fail(message) {
  console.error(`x402 self-check FAILED: ${message}`);
  process.exit(1);
}

const res = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
}).catch((err) => fail(`could not reach ${url} (${err instanceof Error ? err.message : String(err)})`));

const traceId = res.headers.get("x-connect-id");
const body = await res.json().catch(() => null);

if (res.status === 404) {
  fail("route returned 404 — set OKX_X402_TESTNET_ENABLED=true on the server and restart");
}
if (res.status === 503) {
  fail(`route is enabled but not configured — ${body?.error ?? "missing server-only testnet variables"}`);
}
if (res.status !== 402) {
  fail(`expected HTTP 402, got ${res.status} (traceId=${traceId ?? "none"})`);
}

const paymentRequired = res.headers.get("payment-required");
if (!paymentRequired) {
  fail("HTTP 402 did not include the PAYMENT-REQUIRED header");
}

console.log("x402 self-check OK");
console.log(`  endpoint: ${url}`);
console.log(`  status:   402 Payment Required`);
console.log(`  header:   PAYMENT-REQUIRED present (${paymentRequired.slice(0, 24)}…)`);
console.log(`  traceId:  ${traceId ?? "none"}`);
console.log("");
console.log("Challenge verified. To complete a real testnet payment, run the");
console.log("buyer sample with your own testnet wallet key (see docs/x402-testnet-local.md).");
