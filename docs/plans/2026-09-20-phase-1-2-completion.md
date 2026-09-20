# Closing Phase 1 and Phase 2 — execution plan

**Status:** Active execution plan — 2026-09-20
**Governs:** the two phases marked incomplete in [`2026-09-15-okx-a2mcp-roadmap.md`](2026-09-15-okx-a2mcp-roadmap.md)
**Does not govern:** Phase 3 or any mainnet decision. Nothing here authorizes a mainnet variable, wallet, asset, or endpoint.

## 0. Where the two phases actually stand

Verified against the code and the chain on 2026-09-20, not against the older planning prose.

| Phase | Code | Local evidence | Deployed evidence | Blocker |
| --- | --- | --- | --- | --- |
| 1 — Free A2MCP ASP | shipped | tests pass | **missing** | No public HTTPS smoke test, no price-0 registration record |
| 2 — x402 testnet | shipped (#7) | **verified on-chain** | **missing** | Railway promotion not done; automated test uses a mock facilitator |

### 0.1 Phase 2 local evidence — verified, not asserted

The runbook's recorded receipt was checked directly against X Layer testnet RPC
(`eth_getTransactionByHash` + `eth_getTransactionReceipt`), and it is real:

| Field | Value |
| --- | --- |
| Transaction | `0xe059043a5c61673610b4a0b82ba2b458a8217b9f2e4ddae042a78956337bb527` |
| Chain ID | `0x7a0` (1952) = `eip155:1952`, X Layer testnet |
| Status | `0x1` success, block 41,087,246 |
| Token | `0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c` (test USD₮0) |
| Value | `10000` = $0.01 at 6 decimals — matches the default price |
| Logs | `AuthorizationUsed` (EIP-3009 nonce consumed) then `Transfer` to the recipient |

Two properties worth stating plainly, because they are what a reviewer will ask:

- The `AuthorizationUsed` event means replay protection actually fired on-chain. The nonce cannot be reused.
- The transfer value equals the advertised price exactly. Nothing was rounded, defaulted, or synthesised.

**This settles the "manual test" half of the Phase 2 exit criterion.** It does not settle the automated half — see §2.2.

## 1. Phase 1 — prove the Free ASP in public

**Exit criterion (roadmap):** production URL returns an `HTTP 200` tool-list and tool-call result; payment-looking headers do not change its free behaviour; a listing/demo uses the exact provenance statement.

### 1.1 Deploy and smoke-test

1. Confirm the Railway service builds from current `main` and is reachable over HTTPS.
2. Against the public host, capture redacted request/response evidence for:
   - `initialize`
   - `tools/list` — must list exactly the five read-only tools
   - `tools/call` for each of `list_okx_ai_use_cases`, `get_free_a2mcp_launch_checklist`, `query_market_benchmarks`, `get_asp_reputation`, `get_trending_asps`
3. Repeat one `tools/call` **with** a payment-looking header (`PAYMENT`, `X-PAYMENT`, an EIP-3009 blob) and confirm the response is byte-identical to the unpaid call. This is the roadmap's explicit anti-regression check.
4. Confirm the envelope still declares `access: free`, `paymentRequired: false`, `walletRequired: false`, `mainnet: false`.

### 1.2 The problem this will expose

`query_market_benchmarks`, `get_asp_reputation` and `get_trending_asps` read a registry that
**nothing in production ever populates**. `indexAsps()` (`server/okx/intelligence.ts:254`) has no
production caller — only tests call it. The registry loads from `DATA_DIR/okx-intelligence.json`,
which no code writes.

A fresh deploy therefore answers those three tools with "not found in the local intelligence
registry". The smoke test will surface this immediately.

**Do not paper over it with seed fixtures presented as marketplace data.** The roadmap lists
"presenting fixtures … as verified live-marketplace facts" as an explicit non-goal. Two honest
options:

- **(a) Ship the indexer** (§3) so the registry holds real, timestamped, clearly-labelled data.
- **(b) Ship Phase 1 with only the two static tools** (`list_okx_ai_use_cases`,
  `get_free_a2mcp_launch_checklist`), and register the ASP describing only those, until (a) lands.

Option (b) is smaller and stays truthful. Option (a) is the real product. Pick deliberately; do
not register three data tools that return nothing.

### 1.3 Registration

Only after the smoke evidence exists: register the endpoint as a Free A2MCP ASP at price `0`,
using the exact provenance wording from `docs/free-a2mcp-asp.md`. Retain the listing text as
evidence per roadmap §7.

## 2. Phase 2 — finish the testnet proof

### 2.1 Promote to Railway (the actual blocker)

Follow `docs/x402-testnet-local.md` §5. Nothing here is new work; it is the local run repeated
against the deployed host.

1. Set as **service-scoped sealed variables** (never repo files):
   `OKX_X402_TESTNET_ENABLED=true`, `OKX_API_KEY`, `OKX_SECRET_KEY`, `OKX_PASSPHRASE`,
   `OKX_X402_TESTNET_PAY_TO`, `OKX_X402_TESTNET_RESOURCE_URL=https://<host>/api/okx/x402-testnet/market-intelligence`.
2. Redeploy, then run the self-check against the public URL:
   ```bash
   X402_SELFCHECK_URL=https://<host>/api/okx/x402-testnet/market-intelligence \
     node scripts/x402-testnet-selfcheck.mjs
   ```
   Expect `402` plus a `PAYMENT-REQUIRED` header. A `404` means the flag is not `true`; a `503`
   means a server-only variable is missing.
3. Run the buyer sample against the deployed URL with a throwaway testnet key and capture the
   decoded `PAYMENT-RESPONSE`.
4. **Verify the resulting hash independently**, exactly as §0.1 was verified, rather than trusting
   the client's own output:
   ```bash
   curl -s -X POST https://testrpc.xlayer.tech -H 'content-type: application/json' \
     -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionReceipt","params":["0x<hash>"]}'
   ```
   Require `status: 0x1`, `chainId 0x7a0`, an `AuthorizationUsed` log, and a `Transfer` whose
   value equals the advertised price.

### 2.2 Close the automated-test gap

`server/okx/x402-testnet.e2e.test.ts` is honest about itself — it is titled
`"(mock facilitator, no network or funds)"`. It proves the protocol shape and belongs in CI.
It is not the "integration test … on testnet" the roadmap asks for.

Resolve this one of two ways, and write down which:

- **Opt-in testnet test:** add a path gated on an env var, skipped by default, so CI never spends
  funds but the sequence is reproducible on demand.
- **Reviewed waiver:** record that the manual receipt in §0.1 satisfies the criterion, signed by
  someone other than the implementer.

Silently leaving a mock test to stand in for a testnet test is the failure mode the roadmap's
"no fallback reported as settled" discipline exists to prevent. Applied to evidence rather than
to code, the same rule holds.

### 2.3 Install the dependency

`@okxweb3/x402-core` arrived with #7 but is absent from local `node_modules`, so
`server/okx/x402-testnet*.test.ts` fail to import locally. Run a lockfile-consistent
`pnpm install` before trusting any local x402 result.

## 3. The indexer — turning the Bloomberg pillar real

Not a Phase 1 or 2 exit requirement, but it is the difference between a demo and a product, and
§1.2 forces the decision.

**Current state:** `gateway.ts` holds a working authenticated HTTP client to `https://web3.okx.com`.
`intelligence.ts` holds `indexAsps()` waiting for data. **Nothing connects them.**

**Open question that decides the size of the work:** the gateway's read surface is
`listTasks()`, which reads *local* records only. There is no remote marketplace discovery call.
Whether the Onchain OS Developer Portal exposes a list-ASPs / list-tasks endpoint must be
checked against the live API documentation before estimating.

- **If discovery exists:** poll it, call `indexAsps()`, persist with `indexedAt`, and surface
  `source` and staleness on every response.
- **If it does not:** index only tasks this operator participates in, and say exactly that in the
  provenance string. A small honest dataset beats a large invented one.

## 4. Sequence

1. `pnpm install` (§2.3) — unblocks local verification.
2. Railway promotion + verified deployed receipt (§2.1) — closes the Phase 2 blocker.
3. Decide and record the automated-test resolution (§2.2).
4. Decide Phase 1 scope: indexer first, or register the two static tools only (§1.2).
5. Public smoke test and registration (§1.1, §1.3).

## 5. Out of scope

Unchanged from the roadmap: no mainnet variable, wallet, asset, or endpoint. No Evaluator
operation (100 OKB stake, 24/7 availability, slashing exposure). No A2A escrow ASP. Phase 3
remains a decision document requiring written human approval.
