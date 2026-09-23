# OKX Dev Day positioning: Kind Meitner Markets

## One-line position

**Kind Meitner Markets is a free, read-only readiness and pre-spend gate for OKX.AI agents.** Builders scan a Free A2MCP endpoint before listing. Buyers get a bounded trust decision before they call a consequential target.

This is not a payment product, market-data feed, custody product, escrow operator, reputation oracle, or an OKX endorsement. The public contract is `POST /api/okx/free-mcp`: direct `200` JSON-RPC, no wallet, payment header, signer, mainnet, or settlement.

## Where it sits

| Product | Job | When | Relationship |
| --- | --- | --- | --- |
| **Latch402** | Red-team a **paid x402** endpoint | After a paid endpoint exists | Complementary. We do not claim their security scan. |
| **PreFlight** | Test-purchase a paid agent service | After a paid endpoint exists | Complementary. We do not claim a purchase or settlement check. |
| **Signal bots** | Surface a signal, alert, or chart | Discovery / monitoring | Different job. We return a bounded next action, not a feed. |
| **Kind Meitner Markets** | `PASS`/`WARN`/`FAIL` before list; `GO`/`CAUTION`/`NO_GO` before spend | **Before** listing and **before** a consequential call | The Dev Day wedge. |

Official ASP registration allows a free endpoint that returns directly, or an x402 endpoint that returns `402` first. Kind Meitner implements only the free form. [Register an ASP](https://web3.okx.com/onchainos/dev-docs/okxai/registerasp).

## What is proven now

Checked 2026-09-23:

- Railway Free-MCP `https://kind-meitner-production.up.railway.app/api/okx/free-mcp` — `tools/list` HTTP 200; `scan_free_mcp_readiness` on that host is **PASS**; `https://demo.vercel.app/api/okx/free-mcp` is **FAIL**.
- `get_asp_trust_card` for ASP `#13837` is **NO_GO**: listing page HTTP **404**, endpoint readiness **PASS**. Continue stays off.
- Substitute listings `8136` and `11167` are HTTP 200 and can produce **GO** with the same Railway endpoint. They prove the CTA only. They are not Kind Meitner Markets.
- Desktop `#dev-day-gate` screenshots exist for FAIL, Apply-host fill-only, Block-on-NO_GO, Continue-on-substitute-GO, and honest `#13837` NO_GO.

Do not claim: `#13837` is approved, a `GO` is payment approval, live prices, x402, mainnet, custody, or an OKX endorsement.

## Form-ready description

Kind Meitner Markets is a free A2MCP readiness and pre-spend trust gate for OKX.AI agents. Builder agents call `scan_free_mcp_readiness` before listing and get PASS/WARN/FAIL plus a fix. Buyer agents call `get_asp_trust_card` before a consequential call and get GO/CAUTION/NO_GO, what was checked, what was not, and a safe next step. The service is read-only: no wallet, custody, settlement, or mainnet. The demo shows agents changing the next action — fix and re-scan, or do not pay — not an opaque score.

## 30-second pitch

> Builders lose review cycles when a Free A2MCP URL looks valid but is not callable. Buyers get asked to spend before basic listing and endpoint signals are visible. Kind Meitner Markets is the free, read-only gate between those mistakes and the next action. Builders scan before they list. Buyers ask for a trust card before they proceed. We do not move money. We make agents stop, fix, or continue on evidence.
