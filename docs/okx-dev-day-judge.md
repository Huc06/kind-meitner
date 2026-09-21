# OKX Dev Day judge guide — Kind Meitner Markets

## Problem

ASP builders can lose review time to a broken Free A2MCP endpoint or a known deployment-host pitfall. Buyer agents can be asked to pay before basic listing and endpoint signals are visible. **Kind Meitner Markets** is a free, read-only gate: builders call a readiness scan before listing; buyer agents call a trust card before considering spend. It returns structured checks and remediation instead of claiming an opaque score, custody, payment, settlement, or OKX endorsement.

The product boundary is deliberate: the Free MCP surface has no wallet, payment, API-key, mainnet, trade, escrow, or withdrawal flow. Locally indexed marketplace data remains labelled as local; the trust card always states what it did not check.

## Tools and how to call them

The public contract is JSON-RPC 2.0 over `POST /api/okx/free-mcp`; see the full [Free A2MCP contract](free-a2mcp-asp.md). Use a **verified public HTTPS deployment** for the following examples:

```sh
BASE_URL=https://<verified-public-host>
MCP="$BASE_URL/api/okx/free-mcp"

# Discover every free, read-only tool.
curl -sS -X POST "$MCP" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"tools-1","method":"tools/list"}'

# Builder: inspect HTTPS, tools/list shape, accidental 402, and known host pitfalls.
curl -sS -X POST "$MCP" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"readiness-1","method":"tools/call","params":{"name":"scan_free_mcp_readiness","arguments":{"endpointUrl":"https://candidate.example/api/okx/free-mcp","agentId":"13837"}}}'

# Buyer: inspect public listing reachability plus optional endpoint readiness before spend.
curl -sS -X POST "$MCP" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"trust-1","method":"tools/call","params":{"name":"get_asp_trust_card","arguments":{"agentId":"13837","endpointUrl":"https://candidate.example/api/okx/free-mcp"}}}'
```

`scan_free_mcp_readiness` requires `endpointUrl` and returns `PASS`, `WARN`, or `FAIL`, individual checks, bounded raw facts, and remediation. It requires HTTPS; blocks loopback, private, and link-local targets; fails `*.vercel.app` without probing it; and fails discovery that returns HTTP 402. `get_asp_trust_card` requires `agentId`, optionally takes `endpointUrl`, returns `GO`, `CAUTION`, or `NO_GO`, and always exposes `notChecked` and a safe next step. A `GO` is **not** payment approval.

For an operator-owned deployment smoke after human deploy approval, run:

```sh
BASE_URL=https://<verified-public-host> pnpm dev-day:smoke
```

That command is intentionally not run by this evidence pack because its default targets Railway. It should be saved as a dated deploy-gate artifact only after a human verifies the host and deployment.

## Reproducible evidence in this repository

| Evidence | What it proves | Status |
| --- | --- | --- |
| [fixture-free-mcp.json](evidence/dev-day/fixture-free-mcp.json) | Disposable fixture discovered both gate tools, rejected the Vercel host with remediation without an outbound probe, rejected missing tool inputs, and seeded `#dev-day-gate`. | Completed locally |
| [fixture-test-output.txt](evidence/dev-day/fixture-test-output.txt) | Targeted fixture tests passed for Free MCP and Dev Day gate behavior. | Completed locally |
| [evidence README](evidence/dev-day/README.md) | Exact reproduction commands, evidence boundaries, and pending deploy checklist. | Completed documentation |
| [`server/okx/free-mcp.test.ts`](../server/okx/free-mcp.test.ts) | Fixture-backed protocol discovery, free/no-payment behavior, scanner edge cases, and stubbed trust-card decision contract. | Completed locally |
| [`server/okx/dev-day-gate.test.ts`](../server/okx/dev-day-gate.test.ts) | Fixture-backed creation, idempotence, and repair of the Dev Day gate room. | Completed locally |

## Honest limits and pending human/deploy gates

This repository contains **no fabricated live proof**. The checked-in fixture uses temporary local HTTP and is destroyed after each run; the scanner correctly rejects it as a public target. The following are explicitly pending and must not be inferred from local test results:

- Railway/public-HTTPS `tools/list`, readiness `PASS`, and trust-card curl transcripts;
- ASP listing `13837` reachability/approval and any listing screenshot;
- real renderer screenshots, 2–4 minute demo video, and an external Codex/OpenClaw/other-agent transcript;
- any x402 testnet receipt, wallet/payment event, mainnet action, revenue, or OKX endorsement.

A deployment operator should collect those artifacts only from the deployed public URL, redact secrets, record the exact command and UTC time, and add them under `docs/evidence/dev-day/` with their status and limits. The public route itself is free/read-only; legacy paid MCP is disabled by default, and x402 remains a separately reviewed testnet follow-up.

## Build-window delta (17–25 Sep 2026)

This is an existing project. The submission-relevant delta is the Dev Day gate work, not the pre-existing desktop application:

| Date | Commit / contribution | Delta |
| --- | --- | --- |
| 21 Sep | `ea0f3e3` | Added the Free-MCP readiness scanner. |
| 21 Sep | `90f1d53` | Added the ASP trust-card contract and explicit limits. |
| 21 Sep | `6b1a6f2` | Added catalog roles used by the Dev Day workflow. |
| 21 Sep | `6d90091` | Added readiness and trust result cards in the operations UI. |
| 21 Sep | `4b90e41` | Added idempotent `#dev-day-gate` room seeding and starter prompts. |
| 22 Sep | this evidence pack | Added reproducible fixture evidence, a judge guide, explicit pending gates, and a documentation check. |

Reproduce the commit list locally with:

```sh
git log --since='2026-09-17' --until='2026-09-26' --format='%h %ad %s' --date=short
```

The product plan and explicit non-goals are in [the Dev Day readiness and trust plan](plans/2026-09-21-okx-dev-day-readiness-trust.md). The short pitch is: **builders and buyer-agents call a free readiness/trust gate before listing or paying, receiving evidence and fixes rather than opaque review loops.**
