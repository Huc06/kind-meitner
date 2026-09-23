> **Superseded as primary Dev Day plan (2026-09-21).** See [`2026-09-21-okx-dev-day-readiness-trust.md`](2026-09-21-okx-dev-day-readiness-trust.md). Invite/trending showcase slices are optional ops-console work only.

# OKX agent “wow” showcase plan (Free A2MCP only)

**Status:** Draft proposal — 2026-09-21 (needs Grok Bot / product owner sign-off before implementation issues)
**Owner:** product/planning (Grok Bot); implementation TBD (human Huc or explicit bot ask)
**Anchors:** [A2MCP roadmap](2026-09-15-okx-a2mcp-roadmap.md), [Free A2MCP ASP](../free-a2mcp-asp.md), issues #17–#20, ASP **#13837**
**Hard boundary:** free, read-only, locally indexed data; no wallet, payment, x402, or mainnet claims in the demo story.

## 1. Why this plan exists

Judges and OKX.AI visitors do not care about internal architecture docs. They care about a **60–90 second moment** that feels like:

> “I discovered an OKX agent → invited it into a room → it answered with real MCP tools → the UI looks like an OKX agent product, not a Cursor mascot clone.”

The product already has the honest backend for that moment (`POST /api/okx/free-mcp`, Railway URL, ASP #13837 under review). Gaps are mostly **identity, catalog depth, invite UX, and a rehearsed demo script**.

## 2. Wow pillars (ranked)

| Pillar | What the audience feels | Ships as |
| --- | --- | --- |
| **A. OKX identity** | “These are OKX agents.” | Issue #17 avatars + #20 catalog marks |
| **B. Instant utility** | “It did something useful in one click.” | Live Free A2MCP tool call in-room |
| **C. Discovery → room** | “Marketplace listing becomes a teammate.” | #18 listing live + deep-link / one-click invite (#20) |
| **D. Multi-agent presence** | “There is a roster, not one bot.” | ≥2–3 catalog agents with distinct marks (#20) |
| **E. Honest provenance** | “Credible Web3 product, not vapor.” | Visible free/read-only / local-registry copy |

Deferred for wow (do **not** use in showcase until roadmap phases unlock): Evaluator jury, OKB stake, escrow A2A, mainnet x402, Bloomberg paid terminal as “live market prices.”

## 3. Flagship demo script (target ≤ 90s)

1. **Open** kind-meitner room (pre-warmed Railway deploy + model already configured — see Railway quickstart #13).
2. **Invite** “Market Scout” (and one sibling agent) from Invite OKX agent — chart marks visible.
3. **Ask** in chat: “What’s trending on the OKX agent marketplace?” (or a fixed starter prompt).
4. **Show** tool activity → `get_trending_asps` / `query_market_benchmarks` via Free A2MCP — envelope shows `access: free`, `paymentRequired: false`, provenance label.
5. **Point** at ASP listing https://www.okx.ai/agents/13837 (“this is the public ASP; same endpoint”).
6. **Close** with one sentence: free read-only intelligence today; official x402 testnet later — no mainnet claim.

Success metric: a stranger can repeat the script without reading docs.

## 4. Delivery slices (small PRs / issues)

### Slice S0 — Listing + evidence (issue #18)
- Poll ASP #13837 until approved; capture screenshots + `onchainos` outputs under `docs/verification/evidence/`.
- Keep listing copy: free, read-only, locally indexed; endpoint Railway Free A2MCP only.

### Slice S1 — OKX agent marks (issue #17)
- Circular plate + original chart glyph (no OKX wordmark rip; no Grok Bot branding).
- Catalog invite + imported bot sidebar/header/welcome use OKX mark.

### Slice S2 — Catalog + invite UX for demos (issue #20)
- Expand `OKX_CATALOG_AGENTS` to ≥2–3 agents (e.g. Market Scout, Launch Checklist Coach, Reputation Reader) — still free/read-only tools only.
- Invite panel: mark + capabilities + provider + clear free/read-only line.
- Optional: deep link / query param to open invite flyout with a preselected agent (for ASP listing story).

### Slice S3 — Showcase mode (new — proposed issue)
- “Demo room” seed: one room, imported catalog agents, pinned starter prompts that map 1:1 to Free A2MCP tools.
- Optional `?showcase=1` or Settings toggle that surfaces the demo script strip (dismissible) — no fake settlement UI.
- Evidence: 3 screenshots (invite, tool result with provenance, ASP page) + short Loom/GIF under evidence folder.

### Slice S4 — Operator one-shot (ties #13)
- One-page Railway + model + Free A2MCP smoke checklist so judges’ machines are not the bottleneck.

## 5. What makes it “wow” vs “meh”

**Wow**
- Faces look OKX-native; invite feels like adding marketplace agents.
- One question → structured intelligence card with provenance, not a vague LLM rant.
- Public ASP page and in-app agent are the same story.
- Multi-agent room (scout + checklist coach) answering in parallel or handoff.

**Meh / avoid**
- Arrow/Cursor mascot as the hero mark.
- Promising live prices, escrow, or paid settlement in the demo.
- Long setup before the first useful answer.
- Bloomberg/Evaluator UI revived as “production” while Free A2MCP is still the public contract.

## 6. Non-goals

- Mainnet, wallet connect for the showcase path, synthetic tx hashes as “proof.”
- Expanding paid `/api/okx/mcp` or advertising EIP-3009.
- Shipping Evaluator/A2A as the primary demo until Free A2MCP + listing + identity are solid.

## 7. Exit criteria for “showcase ready”

- [ ] ASP #13837 approved or rejection fixed and resubmitted (#18)
- [ ] OKX marks on invite + imported bots (#17)
- [ ] ≥2 catalog agents + polished invite UX (#20)
- [ ] Rehearsed ≤90s script documented here (or README demo section) with evidence screenshots
- [ ] Zero copy that implies payment, wallet, or mainnet

## 8. Open questions for Grok Bot / owner

1. Preferred second/third catalog agents (names + which Free A2MCP tools they front)?
2. Deep link from okx.ai listing — in scope for hackathon or post-approval?
3. Should Showcase mode be a dedicated issue, or folded into #20?
