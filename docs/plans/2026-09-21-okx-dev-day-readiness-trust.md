# OKX Dev Day plan: Readiness + Trust (not invite theater)

**Status:** Canonical product plan — 2026-09-21  
**Owner (planning):** Grok Bot  
**Implementer:** human Hulk (@Huc06)  
**Supersedes:** `2026-09-21-okx-wow-showcase-demo.md` invite/trending showcase slices as the *primary* demo  
**Anchors:** Build X 1.0 winners, Free A2MCP ASP #13837, roadmap `2026-09-15-okx-a2mcp-roadmap.md`, Dev Day OKX AI track  

## 1. Why replan

Build X 1.0 winners (@bondoncredit, @ai2humanwork, @soulink_love, @0xVeriAgent, @Civilis_AI, …) won on **rails other agents must call**: credit, proof→settlement, lending, payment verify, risk OS — with Onchain OS + x402 + mainnet/testnet evidence.

Invite-to-room + local “trending” registry is **not worth calling**. Kind Meitner Markets must unblock a real bottleneck or it will not win OKX Dev Day.

## 2. Dev Day constraints (OKX AI track)

Judges care about: innovation, product completeness, **user value**, X Layer and/or **OKX AI** integration, growth, ecosystem contribution.  
Deliverable: **working product** + GitHub + 3–5 min live demo (finale).  
Not: pitch deck, desktop-only chatbot, fake settlement.

## 3. USP (one sentence)

> **Kind Meitner is the Free-MCP / listing readiness + pre-spend trust gate for OKX.AI agents** — builders and buyer-agents call it before submit or before pay; the desktop is an ops console, not the product.

## 4. Who feels impact

| Caller | Pain today | Our impact |
| --- | --- | --- |
| ASP builders | Rejected listings, vercel.app pitfalls, broken free/x402 shape | Pass/warn/fail scan + remediation before review |
| Buyer agents | Pay unknown ASP / bad 402 | GO/NO-GO trust card before spend |
| Judges | Need ecosystem glue | Public A2MCP + Onchain OS proof + #13837 live |

## 5. Product spine (ship order)

### P0 — Free-MCP / listing readiness scanner (Latch402-class for free)

Public A2MCP tools (extend Free endpoint or sibling path still HTTPS 200 free):

- Input: candidate ASP endpoint URL (and optional agent id)
- Checks: HTTPS reachability, `tools/list` / `initialize`, free path returns 200 (no accidental 402), provenance flags if present, rate-limit headers, known pitfalls (e.g. unsupported host patterns called out in ecosystem posts)
- Output: pass/warn/fail score, raw evidence, remediation steps

**Done when:** Codex/OpenClaw can `use Agent #13837` (or new service) and get a useful readiness report on a real URL.

### P1 — Pre-spend ASP trust card (AgentShield-lite)

- Input: OKX.ai agent id
- Output: listing status if knowable, endpoint smoke, free vs paid hint, risk notes, GO/CAUTION/NO-GO
- Honest about local vs live marketplace limits — never invent on-chain facts

### P2 — Identity polish (#17)

OKX-agent chart marks (not Cursor/SupaMaus). Secondary to P0/P1.

### P3 — x402 testnet evidence slide (#8/#9)

One reviewed testnet receipt for judges — **not** the primary demo claim. Keep Free path default-on.

### Explicit non-goals for Dev Day

- Fake live market prices from local registry as “intel”
- Desktop invite showcase as the win demo
- A2A escrow / Evaluator stake theater
- Mainnet payment collection without readiness review

## 6. Demo script (≤90s / 3–5 min finale)

1. Problem: “Teams lose days to failed ASP review / bad pays.”  
2. Live: scan our Railway Free-MCP URL → PASS with evidence.  
3. Live: scan a broken URL → FAIL + fixes.  
4. Live: external agent calls Kind Meitner Markets tools.  
5. Optional: x402 testnet receipt explorer link.  
6. Close: infrastructure other agents install.

## 7. Issue map for Hulk

| Priority | Issue | Action |
| --- | --- | --- |
| P0 | **New** Free-MCP readiness scanner | Implement tools + tests + public endpoint |
| P1 | **New** ASP trust / pre-spend gate | Implement tools + honest limits |
| P2 | #17 OKX-agent avatars | Keep; not the spine |
| P2 | #18 ASP #13837 listing follow-up | Still required for live agent id |
| P3 | #19 PR #16 chat polish | Merge when stable; not Dev Day spine |
| P3 | #20 catalog/invite UX | Downgrade; optional ops console |
| Rewrite | #21 wow showcase | Retarget to readiness+trust demo + evidence |

## 8. Exit criteria (“Dev Day ready”)

- [ ] Public HTTPS Free A2MCP tools for readiness (± trust) that an external agent can call
- [ ] ASP #13837 approved or fixed + resubmitted
- [ ] Evidence folder: curl transcripts, screenshots, optional x402 testnet receipt
- [ ] X walkthrough draft (#OKXAI) ≤90s
- [ ] Zero copy implying live prices, wallet custody, or mainnet revenue

## 9. Relation to Free A2MCP roadmap

Still: Free A2MCP first → x402 testnet second → mainnet only after explicit approval.  
This plan **narrows** Free A2MCP *content* from “market medians” to **readiness/trust utilities** that match winner economics.

## 10. Field validation (X / #OKXAI sample, 2026-09-21)

Logged-out search is login-walled; sample via public profiles + status pages (~15 threads). Dense Jul–Aug; quieter last 30d.

**Worth paying for:** readiness/release gates (Latch402, Preflight), counterparty risk priced per call (ai_dentity), real-data compute (minara), compliance artifacts (LedgerMind 8949), buyer orchestration with receipts (trybindX).

**Fluff:** per-call signal wrappers, listing-announcement spam, registration-count hype.

**Pain to encode in tools:**
1. Opaque listing review + useless errors (10 rejects / 9 days stories)
2. `vercel.app` unsupported by OKX test env — warn/fail in scanner
3. x402 readiness failures: challenge metadata, binding, replay/cache/signature, settlement, X Layer metadata
4. Buyer UX hostile (OnchainOS + CLI just to call an agent)
5. Official: no Revenue Rocket entry met qualified revenue — prove *calls + evidence*, not registration vanity

**Implication:** keep Free-MCP readiness + pre-spend trust as spine; optional later x402 unit pricing for trust tools; never lead with desktop invites or fake signals.

## 11. Clock — Dev Day 2026 (critical)

| Milestone | When (UTC) | Local Asia/Saigon |
| --- | --- | --- |
| Applications closed | 15 Sep 23:59 | already past |
| Online build | till 25 Sep | **~4 days left from 21 Sep** |
| **Project submission** | **25 Sep 23:59 UTC** | **26 Sep 06:59 ICT** |
| Validation / finalists | by 30 Sep | |
| Singapore finale | 7 Oct | Remote → Best Remote Demo pool |

**Track:** Build a Company (OKX AI) — agent discovery / coordination / transaction tools.  
**Form:** https://forms.gle/81S2gnFCzqSoeDEA7  
**Builder kit:** https://www.okx.com/en-gb/learn/okx-dev-day-builder-kit  
**Telegram:** https://t.me/+xHT-WekKkuFjYzk9  

### Submission package (must-haves)

1. Team + track + participation route (Singapore vs Remote)
2. Project summary (user + core OKX AI integration)
3. Public GitHub + README for judges
4. **Demo video 2–4 min** (working product + integration)
5. Product / listing / deployment URL
6. If using existing project: **list of features added during build window** + commit evidence (listing alone ≠ enough)

Judging: innovation, completeness, user value, technical execution, meaningful OKX AI / X Layer integration, growth, ecosystem contribution. Prize: Company $35k + Remote $15k pools.

## 12. Extra win workstreams (beyond #23/#24)

| ID | Work | Why |
| --- | --- | --- |
| Sub | Submission package + form dry-run | Hard deadline 25 Sep |
| Demo | 2–4 min video script + record | Required; ≥90s spine from #21 |
| Evidence | `docs/evidence/dev-day/` curl, screenshots, PASS/FAIL scans | Judges + validation before 30 Sep |
| Diff | Positioning vs Latch402 / Preflight | We own **Free-MCP + listing pitfalls**; they own paid x402 deep scan |
| README | Judge-facing README section | One screen: problem → tools → call Kind Meitner → evidence |
| Delta | Build-window changelog | Existing project rule: only new work scores |
| External | Proof external agent calls #13837 | Codex/OpenClaw transcript |
| Listing | Chase ASP #13837 approval (#18) | Product link for form |
| X | One #OKXAI walkthrough thread | Growth / ecosystem signal (optional after core) |
| Scope | Freeze invite/trending as non-submit | Avoid fluff in video |

## 13. Day-by-day (21→25 Sep ICT)

- **D0 (21):** Confirm team accepted + route (SG vs Remote). Freeze USP. Hulk starts #23.
- **D1 (22):** #23 MVP tools live on Railway; evidence folder started; #18 listing status.
- **D2 (23):** #24 trust card MVP; external-agent call proof; README judges section.
- **D3 (24):** Demo video record; form fields draft; build-window delta list.
- **D4 (25):** Submit form before 23:59 UTC; keep Telegram reply SLA 24h for validation.

