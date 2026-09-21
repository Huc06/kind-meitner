# OKX Dev Day positioning: Kind Meitner Markets

## One-line position

**Kind Meitner Markets is a free, read-only readiness and pre-spend gate for OKX.AI agents:** builder agents check a Free A2MCP endpoint before listing; buyer agents check basic reachability and endpoint readiness before they decide whether to call a target service.

This is deliberately not a payment product, market-data feed, custody product, escrow operator, reputation oracle, or an OKX endorsement. The current public contract is `POST /api/okx/free-mcp`: direct `200` JSON-RPC results, no wallet, payment header, signer, mainnet access, or settlement. Locally indexed market data remains labelled as local. See the [Free A2MCP launch guide](free-a2mcp-asp.md) and [canonical rollout](plans/2026-09-15-okx-a2mcp-roadmap.md).

## The job, stage, and proof

| Product/category | Job it is designed to do | When in the workflow | What a credible proof looks like | Kind Meitner relationship |
| --- | --- | --- | --- | --- |
| **Latch402** | Red-team a **paid x402** HTTP endpoint for payment-flow and readiness weaknesses. Its public README describes paid scans, passive/active modes, x402 challenge checks, and security findings. | After a paid endpoint exists; before listing/releasing it. | An observed `402` challenge, report findings, and—only where enabled and authorized—payment/receipt evidence. | Complementary. We do **not** claim to perform its paid x402 security scan. Kind Meitner owns the earlier Free-MCP/listing-shape and buyer-decision gate. |
| **PreFlight** | Test-purchase a paid agent service as a buyer and report whether its paywall, price, payment, and delivery behave as expected. Its public README lists nine commerce checks and says mainnet payment is refused. | After a paid endpoint exists; before a builder lists or promotes it. | A check scorecard with observed challenge/payment/delivery evidence; its stated environments are mock or Base Sepolia. | Complementary. We do **not** claim a real purchase, settlement check, or delivery audit. |
| **Signal bots** *(category, not a single product)* | Surface a signal, alert, price, ranking, or chart for a human/agent to interpret. | Discovery or ongoing monitoring. | The source, timestamp, and method behind the signal. A signal alone does not prove a target is callable, safe to pay, or that an agent changed course. | Different job. Kind Meitner produces a bounded decision with remediation and explicit `notChecked` limits, rather than presenting a generic score/feed as payment approval. |
| **Kind Meitner Markets** | Check Free A2MCP listing readiness and provide a basic pre-spend trust decision: `PASS`/`WARN`/`FAIL` plus remediation for builders; `GO`/`CAUTION`/`NO_GO` plus limits and next step for buyers. | **Before listing** a Free A2MCP endpoint and **before** a buyer calls a paid or otherwise consequential target service. | A reproducible isolated fixture now; later, human-collected public-HTTPS transcripts and an independent agent call. A `GO` is not payment approval. | The Dev Day wedge: a free, agent-callable gate that changes the next action—fix/re-scan, proceed with a free call, or do not pay. |

The official registration model supports this division: an A2MCP ASP is either a free endpoint that returns directly with no x402, or an x402 endpoint that first returns `402 Payment Required` and is replayed after payment. Kind Meitner's current surface intentionally implements only the first form. [Official ASP registration guidance](https://web3.okx.com/onchainos/dev-docs/okxai/registerasp).

## What we can honestly demonstrate today

The repository contains isolated-fixture proof that `tools/list` exposes `scan_free_mcp_readiness` and `get_asp_trust_card`; the scanner rejects a known Vercel-host pitfall without an outbound probe; invalid inputs are rejected; and the Dev Day gate room can be seeded. Reproduce it with the commands and limits in [the evidence register](evidence/dev-day/README.md) and [judge guide](okx-dev-day-judge.md).

It does **not** prove any of the following, and the demo/form must not imply otherwise:

- a deployed public-HTTPS `PASS`, listing approval, or an external agent call;
- a live OKX marketplace price, reputation, transaction, or revenue result;
- an x402 payment, testnet receipt, mainnet settlement, custody, escrow, trade, withdrawal, or evaluator operation; or
- an OKX review, endorsement, or guarantee.

A public proof package remains a human/deploy gate: capture the exact public URL, UTC time, redacted request/response, and `notChecked` fields. Until that exists, use the local fixture only as local fixture evidence.

## The workflow to show, not a scoreboard

1. **Builder agent:** calls `scan_free_mcp_readiness` on a candidate Free A2MCP URL.
2. **Kind Meitner Markets:** returns a verdict, bounded evidence, and a concrete fix (for example, use a supported public HTTPS host and expose `tools/list`).
3. **Builder agent:** fixes the endpoint and re-scans; it does not submit while the verdict is `FAIL`.
4. **Buyer agent:** calls `get_asp_trust_card` before it would call a target service.
5. **Kind Meitner Markets:** returns `GO`, `CAUTION`, or `NO_GO`, the observed signals, what was not checked, and a safe next step.
6. **Buyer agent:** only proceeds with the permitted next action; `NO_GO` means do not call a pay/x402 tool.

The proof is the changed next action, not a synthetic score: **FAIL → fix → re-scan** or **NO_GO → do not pay**. The desktop is an operations console for the same agent-callable result, not the product claim.

## Voice-over-ready pitch (about 30 seconds)

> ASP builders can lose review cycles to a Free A2MCP endpoint that looks valid but is not callable. Buyer agents can be asked to spend before basic listing and endpoint signals are visible. Kind Meitner Markets is the free, read-only gate between those mistakes and the next action. Builders scan before they list and receive a verdict with fixes. Buyers ask for a trust card before they proceed and receive what we checked, what we did not check, and a safe next step. We do not move money or claim settlement. We make agents stop, fix, or proceed on evidence.

## Form-ready project description

**Kind Meitner Markets is a free A2MCP readiness and pre-spend trust gate for OKX.AI agents.** Builder agents call `scan_free_mcp_readiness` before listing a Free A2MCP endpoint and get PASS/WARN/FAIL checks with remediation. Buyer agents call `get_asp_trust_card` before a consequential service call and get GO/CAUTION/NO_GO, observed signals, explicit limits, and a safe next step. The current service is read-only and paymentless: no wallet, custody, settlement, mainnet, or live-market claim. Our demo shows agents changing behavior—fixing and re-scanning a failing endpoint, or declining an unsafe first spend—rather than displaying an opaque score.

## Research basis and comparison limits

Research was reviewed on 2026-09-22 from public project documentation. These sources state product positioning; their operational claims were **not independently verified** by this repository:

- [Latch402 public README](https://github.com/Mrgtee/latch402/blob/main/README.md): describes itself as a paid x402 red-team scanner, including passive/active scan boundaries and stated production configuration.
- [PreFlight public README](https://github.com/chinmayy777/asp-preflight/blob/main/README.md): describes a nine-check paid-service test purchase and states cash-free mock/Base Sepolia checks with mainnet payment refused.
- [OKX.AI ASP registration guidance](https://web3.okx.com/onchainos/dev-docs/okxai/registerasp): distinguishes direct free endpoints from x402 `402 Payment Required` challenge/replay endpoints.

"Signal bots" is a broad category rather than a named, researched competitor. The comparison therefore makes no claim about every such product; it only distinguishes a signal/feed job from the specific, bounded readiness and decision workflow documented here.
