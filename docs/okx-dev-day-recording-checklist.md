# OKX Dev Day — screen-recording checklist (agent operations console)

## Before recording
- [ ] Free disk space (>10 GB) so the recorder and browser can write frames.
- [ ] A real AI engine is signed in. Otherwise every agent shows **Offline · No AI engine or OKX Gateway connection configured.** — that is the honest state, not a bug.
- [ ] `#dev-day-gate` exists (`POST /api/okx/dev-day-gate`), skin = Nymspace, 1080p, notifications off.
- [ ] `https://kind-meitner-production.up.railway.app/api/okx/free-mcp` `tools/list` → 200; `https://www.okx.ai/agents/13851` → 200.

## Shots (≈3 min)
1. Sidebar: Rooms · OKX Agent Hub · ASP Directory · Activity · Routines · Evaluator (labels visible).
2. Open `#dev-day-gate`: header shows purpose and `participants · agents`; roster strip shows each agent's source and status.
3. Agent Hub → Agents: invite Markets to a room → "Added"; invite again → "Already in" (no duplicate).
4. Starter **Scan an ASP endpoint** → fills composer → send → **Free MCP listing readiness** card: verdict, counts, boundary block.
5. Starter **Check trust before spend** (or agent 99999) → **Pre-spend trust** card: NO-GO, "Spend blocked", not-checked list, disclaimer.
6. Activity → timeline shows invite, task, scan, trust in order; "View evidence" jumps to the card.
7. Agent Hub → ASPs: readiness verdict + last checked time read from the room's result; Copy evidence.

## Known limitations (say these if asked)
- Agent catalog = kind-meitner **local registry** (3 agents). No live OKX discovery.
- `query_market_benchmarks`, `get_asp_reputation`, `get_trending_asps` return **local reference data**.
- Live: `scan_free_mcp_readiness` (real HTTPS probes) and `get_asp_trust_card` (okx.ai listing status + optional probe).
- No wallet, payment, x402, escrow or mainnet. Trust/readiness are local signals, not OKX endorsements.
- Agent replies come only from a configured engine. The string "hello from fake claude" exists only in the test fixture engine (`server/testing/fake-claude-cli.ts`) used for isolated verification.
