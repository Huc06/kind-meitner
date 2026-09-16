# Local x402 testnet runbook (verify before Railway)

Run the official x402 paid flow **locally on X Layer testnet first**, confirm a real `402 → payment → settlement`, then apply the same configuration to Railway. This route is disabled by default and is testnet-only.

> You provide and hold all secrets. The assistant does not enter your OKX credentials, private keys, or faucet assets. Keep every value in your own shell; never commit them.

## 1. Get testnet funds

Fund your recipient wallet on X Layer testnet from the official faucet:

- Gas: test **OKB**
- Stablecoin: test **USD₮0**
- Faucet: https://www.okx.com/xlayer/faucet/xlayerfaucet

## 2. Configure the local server (your shell only)

Export the server-only variables in the terminal where you start the server. Do not put them in a repo file.

```bash
export OKX_X402_TESTNET_ENABLED=true

# OKX Developer Portal credentials (server-only)
export OKX_API_KEY=...
export OKX_SECRET_KEY=...
export OKX_PASSPHRASE=...

# Your X Layer testnet recipient wallet — where settled test USD₮0 is received.
# Must be a 0x EVM address you control and that appears on X Layer testnet.
export OKX_X402_TESTNET_PAY_TO=0xYourTestnetWallet

# The public URL of THIS endpoint. Locally it is your loopback address; the SDK
# echoes it as the x402 resource URL, so it must match the route you call.
export OKX_X402_TESTNET_RESOURCE_URL=http://127.0.0.1:8799/api/okx/x402-testnet/market-intelligence

# Optional price (USD string); defaults to $0.01
export OKX_X402_TESTNET_PRICE='$0.01'

pnpm dev:server
```

Notes on the two variables you asked about:

- `OKX_X402_TESTNET_PAY_TO` is the **seller's receiving wallet**. Put the testnet EVM address you funded/control here. This is where the buyer's test USD₮0 settles. It is not a secret, but it must be your real testnet address, not a placeholder.
- `OKX_X402_TESTNET_RESOURCE_URL` is the **canonical URL of this paid endpoint**. Locally, the server listens on `http://127.0.0.1:8799` (override with `KIND_MEITNER_PORT`), and the path is fixed to `/api/okx/x402-testnet/market-intelligence`. Set it to exactly that loopback URL for local testing. When you later deploy, change only the host to your Railway HTTPS domain, keeping the same path.

## 3. Self-check the challenge (no wallet needed)

In a second terminal:

```bash
node scripts/x402-testnet-selfcheck.mjs
```

Expected: `x402 self-check OK`, HTTP `402`, and a `PAYMENT-REQUIRED` header. Failures tell you exactly what to fix:

- `404` → `OKX_X402_TESTNET_ENABLED` is not `true` (or server not restarted).
- `503` → enabled but a server-only variable is missing.

You can also verify by hand:

```bash
curl -i -X POST http://127.0.0.1:8799/api/okx/x402-testnet/market-intelligence \
  -H 'content-type: application/json' -d '{}'
# expect: HTTP/1.1 402 Payment Required  +  PAYMENT-REQUIRED: <base64>
```

## 4. Complete a real testnet payment (buyer side)

Use a throwaway **testnet** wallet key. Install the buyer deps once, then run the sample:

```bash
pnpm add -w @okxweb3/x402-fetch viem
X402_BUYER_PRIVATE_KEY=0xYOURTESTNETKEY node scripts/x402-testnet-buyer-sample.mjs
```

Expected: HTTP `200` plus a decoded `PAYMENT-RESPONSE` settlement receipt with an on-chain transaction hash on `eip155:1952`. Keep this output as your testnet evidence.

Do not use a mainnet key. The sample refuses anything that is not a 0x 32-byte key and never logs it.

### Verified testnet run (evidence)

A local X Layer testnet run has completed the full flow with a real on-chain settlement:

- Self-check: `HTTP 402` with `PAYMENT-REQUIRED` present.
- Buyer sample: `HTTP 200` with a decoded `PAYMENT-RESPONSE` receipt:
  - `status: success`, `success: true`
  - `network: eip155:1952`
  - `transaction: 0xe059043a5c61673610b4a0b82ba2b458a8217b9f2e4ddae042a78956337bb527`

The response body carried the resource plus `settlement.status: "success"`. No credentials or private keys are recorded here; only the public transaction hash and network are kept as evidence.

## 5. Promote to Railway (after local passes)

Only after the local `402 → payment → settlement` succeeds:

1. Set the same variables as **Railway service-scoped sealed variables** (not in the repo):
   - `OKX_X402_TESTNET_ENABLED=true`
   - `OKX_API_KEY`, `OKX_SECRET_KEY`, `OKX_PASSPHRASE`
   - `OKX_X402_TESTNET_PAY_TO=0xYourTestnetWallet`
   - `OKX_X402_TESTNET_RESOURCE_URL=https://<your-railway-host>/api/okx/x402-testnet/market-intelligence`
   - optional `OKX_X402_TESTNET_PRICE`
2. Redeploy, then re-run the self-check against the Railway URL:
   ```bash
   X402_SELFCHECK_URL=https://<your-railway-host>/api/okx/x402-testnet/market-intelligence \
     node scripts/x402-testnet-selfcheck.mjs
   ```
3. Repeat the buyer sample against the Railway URL to capture a production-testnet receipt.

Keep this testnet-only until a separate mainnet readiness review approves real-asset configuration.
