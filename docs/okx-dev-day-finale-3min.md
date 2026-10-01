# OKX Dev Day finale — 3-minute live demo

**Slot:** Singapore finale, 7 Oct 2026. The builder kit says judges look at innovation, product completeness, user value, technical execution, real OKX AI integration and growth potential, and that finalists get exact timing by email ([Builder Kit](https://www.okx.com/en-us/learn/okx-dev-day-builder-kit)). Plan for 3:00 and keep a 2:30 fallback.

**One sentence:** Kind Meitner Markets is the free gate in front of OKX.AI agent commerce. Builders check an agent before they list it, buyers check it before they spend, and the agents that pass become a working team.

**Claim boundary:** say free, read-only and paymentless. Do not claim payments, custody, mainnet settlement or an OKX endorsement. A `GO` result is not payment approval.

## Before going on stage
- Live checks: `https://kind-meitner-production.up.railway.app/api/okx/free-mcp` `tools/list` returns 200, and `https://www.okx.ai/agents/13851` returns 200. Both were checked on 2026-10-01.
- Desktop app on the **Nymspace** skin at 1080p. `#dev-day-gate` should be seeded and empty, with the Starters list visible.
- Second tab open on Team Map with `?fixture=sample` (it shows a "Sample data — not live" label).
- Backup: a recorded take of the same script, in case venue Wi-Fi drops.

## Script (3:00)

| Time | On screen | Say |
|---|---|---|
| 0:00–0:20 | Landing: WordTiles hero, then the `[ 01 · THE LOOP ]` strip | "Agents now hire agents on OKX.AI. Two things go wrong. Builders list endpoints that fail review, and buyers pay agents they never checked. We built the gate." |
| 0:20–1:00 | `#dev-day-gate` → Starters → **Scan a vercel URL** → FAIL card → **Apply host** → send → PASS 6/6 | "Gate before list. Markets runs `scan_free_mcp_readiness` live. FAIL, with the exact fix. Apply host, re-scan: every check passes." |
| 1:00–1:40 | **Trust agent 99999** → NO_GO → **Block spend**. Then **Trust agent 13851** → GO | "Gate before spend. An unknown agent gets NO_GO, so spend is blocked before any money moves. Our own listed ASP, #13851, gets GO. The card also lists what it did not check." |
| 1:40–2:10 | **Clone to Team** on the GO card → Automations → **New** → date/time picker → save | "Audit to hire. One click recruits the vetted agent, and it now runs on a schedule with no babysitting." |
| 2:10–2:40 | Team Map sample → blocked Listing Coach → **Inspect blocker** → Artifacts | "Now it's a company. You see who is blocked, who needs help, and what each agent delivered, all in one place." |
| 2:40–3:00 | `curl` of `tools/list` in a terminal, or the README endpoints | "This isn't a mockup. Any agent can call the same free MCP endpoint today. Kind Meitner Markets: gate, hire, operate." |

## If something breaks
- The live scan hangs for more than 5 s: say "same result, cached", switch to the backup take and continue from 1:00.
- Short on time: drop the Team Map beat (2:10–2:40) first. The two gates plus Clone to Team are the core story.
