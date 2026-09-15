# OKX.AI A2MCP implementation roadmap: Free ASP to x402

**Status:** Canonical implementation plan — 2026-09-15
**Owner:** kind-meitner OKX.AI integration
**Decision source:** [GitHub issue #2](https://github.com/Huc06/kind-meitner/issues/2)
**Supersedes:** The A2MCP payment, mainnet, A2A, and Evaluator rollout assumptions in `docs/okx-ai-plan.md`, `docs/prd-okx-ai.md`, and `docs/design-okx-ai.md`.

## 1. Decision

Build the product in this order:

```text
Free A2MCP ASP → official x402 on X Layer testnet → explicit mainnet readiness review
```

The current public product is the Free A2MCP ASP at `POST /api/okx/free-mcp`. It provides read-only market-intelligence and launch resources with a direct `HTTP 200` result. It must never ask for or consume a wallet, API credential, payment header, payment nonce, test asset, or mainnet access.

The legacy custom EIP-3009 implementation at `/api/okx/mcp` is not an official paid-service implementation and must not be registered, advertised, or represented as payment settlement. x402 is the only planned paid-service path, and it begins on testnet only.

## 2. Goals and non-goals

### Goals

- Show immediate utility for OKX.AI agents through free, composable, read-only market-intelligence tools.
- Demonstrate accurate data provenance, responsible service boundaries, and MCP-compatible discovery.
- Keep public service costs and operational risk near zero for the MVP.
- Create a verified route to the official x402 integration without importing mainnet risk into the free service.

### Non-goals for this roadmap's initial release

- Mainnet payment collection, token custody, escrow, trading, withdrawal, or revenue claims.
- A2A escrow ASP operation or contest/bounty participation.
- Evaluator operation, OKB staking, automated voting, or slashing exposure.
- Presenting fixtures, locally indexed data, generated transaction hashes, or fallback records as verified live-marketplace/on-chain facts.
- Replacing the Radio/Plasma-inspired discovery and activity concepts; those are an independent onboarding/product milestone.

## 3. Product contract

| Concern | Free A2MCP ASP | x402 testnet follow-up | Mainnet (not approved) |
| --- | --- | --- | --- |
| Public path | `POST /api/okx/free-mcp` | Separate feature-flagged paid path | Same path only after approval |
| Result | Direct `200` JSON-RPC/MCP result | Valid `402` challenge then verified payment result | Verified production settlement only |
| Network/funds | No chain, wallet, or funds | X Layer testnet `eip155:1952`; official test assets only | Real assets only after gate |
| Data | Locally indexed data, explicitly labelled | Same provenance policy | Verified sources and receipts required |
| Credentials | None requested from caller | Server-only developer configuration | Service-scoped sealed configuration |
| Registration | Free A2MCP ASP at price `0` | Not a mainnet paid-service claim | Separate approval and registration review |

The full endpoint contract, runbook, rate-limit scope, and registration checklist are in [`docs/free-a2mcp-asp.md`](../free-a2mcp-asp.md).

## 4. Delivery phases

### Phase 0 — planning and scope control

**Outcome:** one authoritative plan and no ambiguity about payment readiness.

- Publish this document and mark legacy planning documents as re-baselined.
- Keep the Free A2MCP implementation in a focused branch/PR, separate from agent import or room-activity changes.
- Establish an evidence directory or PR checklist for test results, deployed endpoint URL, registration proof, and known limitations.

**Exit criteria:** reviewers can identify the current public endpoint, the planned x402 boundary, and the explicit prohibition on mainnet claims.

### Phase 1 — Free A2MCP ASP

**Outcome:** an honest, public, zero-price market-intelligence MCP surface.

Implementation scope:

- Keep `/api/okx/free-mcp` pre-auth and distinct from legacy `/api/okx/mcp`.
- Support MCP/JSON-RPC `initialize`, `tools/list`, and `tools/call` only.
- Expose only read-only tools:
  - `list_okx_ai_use_cases`
  - `get_free_a2mcp_launch_checklist`
  - `query_market_benchmarks`
  - `get_asp_reputation`
  - `get_trending_asps`
- Preserve tool annotations and a result envelope declaring `access: free`, `paymentRequired: false`, `walletRequired: false`, `mainnet: false`, and local-data provenance.
- Keep input bounds, direct `200` results, `x-connect-id`, timing headers, and public rate limits.
- Deploy to Railway using the existing main-branch deployment integration; smoke-test the public HTTPS endpoint.
- Register only this endpoint as a Free A2MCP ASP at price `0` after the smoke-test evidence exists.

**Exit criteria:** isolated tests pass; production URL returns an `HTTP 200` tool-list and tool-call result; payment-looking headers do not change its free behavior; a listing/demo uses the exact provenance statement.

**Operational note:** the in-process rate limiter resets on restart and is per instance. Add an edge/shared limiter before horizontal scaling; do not describe the current limiter as global abuse protection.

### Phase 1.5 — paid-path and secret hardening

**Outcome:** no unsupported paid or secret-bearing behavior remains exposed while testnet work starts.

- Remove, disable, or default-off the custom EIP-3009 paid `tools/call` flow behind an explicit feature flag.
- Make credentials server-only. Read `OKX_API_KEY`, `OKX_SECRET_KEY`, and `OKX_PASSPHRASE` from Railway service-scoped sealed variables only.
- Replace settings API credential/secret readback with boolean configured-state indicators.
- Prohibit API keys, webhook secrets, wallet values, and private data from logs, UI responses, exports, and test fixtures.
- Perform webhook idempotency atomically before ledger mutation or event emission.
- Fail closed: a remote/CLI failure cannot become a local ledger credit, synthetic transaction hash, or settled result.

**Exit criteria:** dedicated security tests show no credential readback, no paid-path access when disabled, and no fallback result represented as a transaction or settlement.

### Phase 2 — official x402 on X Layer testnet

**Outcome:** a paid flow proven without real funds or production claims.

- Review the current official OKX Payment SDK documentation and select exact, pinned official `@okxweb3/x402-*` package versions before adding dependencies.
- Integrate the server-side SDK behind `OKX_X402_TESTNET_ENABLED=false` by default.
- Configure only X Layer testnet `eip155:1952` and official faucet/test assets.
- Keep recipient address and developer credentials outside user-controlled application settings.
- Test the complete protocol: unauthenticated request → `402 Payment Required` plus `PAYMENT-REQUIRED` → payment → SDK-verified settlement proof → response.
- Preserve structured trace IDs, explicit error paths, bounded retries, and no fallback settlement representation.

**Exit criteria:** an integration test demonstrates the entire x402 challenge/settlement sequence on testnet; a manual test confirms all receipts are testnet-only; feature flag is off by default in production configuration.

### Phase 3 — mainnet readiness review

**Outcome:** a decision document, not an automatic release.

Required evidence before any mainnet variable, wallet, or paid endpoint is enabled:

- Independent security review of transaction construction, SDK verification, recipient/asset/amount validation, and secrets.
- Real balance provider, verified transaction/receipt model, serialized signer and nonce execution, and durable replay/idempotency controls.
- Explicit operator recovery, incident response, key rotation, monitoring, and alerting procedures.
- Rate-limit and abuse-control review appropriate for public paid access.
- A test plan demonstrating that no local fallback/generated value is reported as settled.
- Written human approval naming the network, assets, recipient, limits, and rollback owner.

**Exit criteria:** all items are evidenced and approved in a separate mainnet change request. Until then, there is no mainnet feature.

## 5. Deferred tracks

### Agent discovery and activity feed

Keep the Radio/Plasma-inspired agent discovery, onboarding, imported-agent flow, and activity feed as a product milestone. It may improve the Free ASP demo, but it does not define payment semantics or ASP registration compliance.

### A2A ASP

Defer until a continuously available agent, actual signing, receipt verification, recovery semantics, and real escrow operations have independent approval. Account for the 5% bounty deposit before enabling a contest flow.

### Evaluator

Do not operate an evaluator in this roadmap. It requires at least 100 OKB stake, 24/7 availability, reliable decision correctness, and an accepted slashing-risk operating model. Synthetic hashes and fixture-only receipts are not sufficient.

## 6. PR and merge sequence

| PR | Scope | Merge gate |
| --- | --- | --- |
| 1 | Canonical roadmap, legacy-document notices, Free A2MCP docs/tests | Documentation review; isolated Free MCP tests, typecheck, lint |
| 2 | Free ASP public deployment evidence and registration record | Railway HTTPS smoke test; price-0 listing verified; no paid claim |
| 3 | Paid-path disablement and server-only secret hardening | Security-focused tests and review |
| 4 | x402 testnet SDK integration behind a disabled-by-default flag | Testnet protocol/receipt evidence |
| 5 | Mainnet readiness review only | Explicit human approval; no automatic deployment |

Do not combine the Free A2MCP changes with unrelated agent-import/onboarding changes. If source files contain both changes, split the relevant hunks before commit so Railway's main-branch deployment has a reviewable, reversible scope.

## 7. Evidence checklist

For each merged phase, retain:

- Commit/PR URL and exact scope.
- Automated test, typecheck, and lint output.
- For public phases, the deployed HTTPS endpoint and redacted request/response evidence.
- Data-provenance text shown in the listing/demo.
- Explicit statement of excluded networks, payments, keys, and operational roles.
- For testnet or mainnet work, network, contract/SDK version, receipt evidence, and approval record.
