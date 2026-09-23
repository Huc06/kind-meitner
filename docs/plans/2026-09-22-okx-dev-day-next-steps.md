# Dev Day next steps (22 Sep 2026 ICT)

Read this after the easy plan: `docs/plans/2026-09-21-okx-feature-uiux-easy.md` (Locked decisions).

Master tracker: issue **#31**. Submit deadline: **25 Sep 2026 23:59 UTC**. Singapore finale target: **7 Oct**.

## Focus lock (owner)

**Features only right now.**

Do: readiness, trust, action card CTAs, room loops, small gate UX.

Do **not** prioritize: evidence packs, demo video, submit docs, positioning writeups, visual E2E evidence.

Defer until production smoke PASS and both loops work: issue **#68** and draft PRs **#52 #53 #54 #55 #57**.

## What just landed

- **#59** merged: skip absent mobile CI jobs.
- **#61** merged: cross platform CI baseline (vendor SHA, MausBodies guards, phone secret fixture, evaluator size, POSIX broker paths).
- **#62** merged: this next steps checklist (first version).
- Planning docs + smoke script already on `main` (through **#41**).
- CI tickets **#58** and **#60** closed.

## What is still blocked

Production Free MCP still does **not** list `scan_free_mcp_readiness`.

```bash
pnpm dev-day:smoke
# FAIL until #47 is merged and Railway redeploys
```

Live URL: `https://kind-meitner-production.up.railway.app/api/okx/free-mcp`

## Implement issues (use these)

| Order | Issue | What | PR |
|------:|-------|------|-----|
| 1 | **#63** | Ship readiness: rebase, merge, Railway, smoke PASS | **#47** |
| 2 | **#64** | Ship trust after smoke green | **#48** |
| 3 | **#65** | Finish locked CTAs (Apply host, Block, Continue GO only, Re check) | **#50** |
| 4 | **#66** | Verify both loops in `#dev-day-gate` | **#51** |
| 5 | **#67** | Optional gate UX: busy disable, last run, mention routing | with #50 or follow up |
| later | **#68** | Evidence / video / submit package | **DEFER** |

Parents still valid: #23 readiness, #24 trust, #29 cards, #30 room.

## Spine order (features only)

### 1. Ship readiness — issue **#63** / PR **#47** (parent #23)

Owner: **@Huc06**

1. Rebase `feat/issue-23-free-mcp-readiness` onto latest `main` (includes #61 and #62).
2. Confirm `typecheck + test` green on ubuntu, macos, and windows.
3. Local check: `pnpm exec vitest run server/okx/free-mcp.test.ts` (expect 8/8).
4. Merge PR **#47**.
5. Deploy Railway production for kind meitner.
6. Run `pnpm dev-day:smoke` until PASS (`scan_free_mcp_readiness` in tools/list and call works).

Do not merge cards or room before this smoke is green.

### 2. Ship trust — issue **#64** / PR **#48** (parent #24)

Owner: **@Huc06**

1. Wait for #63 smoke PASS.
2. Rebase #48 onto `main` (currently CONFLICTING).
3. Confirm `get_asp_trust_card` returns GO / CAUTION / NO_GO plus `notChecked` and `safeNextStep`.
4. Undraft and merge **#48**.
5. Confirm tool on production tools/list.

### 3. Finish action card CTAs — issue **#65** / PR **#50** (parent #29)

Owner: **@Huc06**

Current gap: Copy / Evidence / Rescan only.

| Card | CTA | Rule |
|------|-----|------|
| Readiness | **Apply host** | Pastes real Railway Free MCP URL |
| Readiness | **Run scan again** | Keep; disable while Markets busy |
| Trust | **Block spend** | On NO_GO or CAUTION |
| Trust | **Continue free tools** | Enabled **only on GO** |
| Trust | **Re check** | Re run trust for same agent id |

Merge only after #47 and #48 are live on Railway.

### 4. Room loops — issue **#66** / PR **#51** (parent #30)

Owner: **@Huc06**

Hold until steps 1 to 3 done. Then prove:

- Loop A: bad host FAIL → Apply host → Run again → PASS
- Loop B: bad agent NO_GO → Block → ASP `#13837` GO → Continue → real free tool activity

### 5. Optional gate UX — issue **#67**

Busy disable on CTAs, last run line, Coach/Scout never invent verdicts.

## Hold (not features focus)

| Item | Why |
|------|-----|
| **#68**, #26, #27, #25, #28, #56 | Evidence / video / submit / positioning / visual E2E |
| PR #52 #53 #54 #55 #57 | Same; keep draft |
| #49 catalog, #42 avatars | After loops |
| #43 | Rebase docs; low priority |
| #44 | Local OKX server; not spine |
| #16 | Welcome polish; after gate |
| #14 #46 | Chore when free |
| **#15** | **Do not merge** (drops OKX views) |

## Who does what

| Role | Now |
|------|-----|
| **@Huc06 (Hulk)** | **#63 → #64 → #65 → #66** (then #67 if small) |
| Planning (harrymove ctrl / Grok Bot) | Specs, review, this checklist; no feature coding |
| Huc bot | Stood down unless Hari asks for coding help |
| Owner (Hari) | Nudge merge when #47 CI is green |

## Done when (features bar)

1. `pnpm dev-day:smoke` PASS on production.
2. Both loops runnable in `#dev-day-gate` with real CTAs (not JSON only).
3. Only then pick up #68 / evidence / video / submit.

## Links

- Easy plan + locked rules: `docs/plans/2026-09-21-okx-feature-uiux-easy.md`
- Recommendations: `docs/plans/2026-09-21-okx-recommendations-and-linked-plan.md`
- Smoke: `scripts/dev-day-gate-smoke.sh` / `pnpm dev-day:smoke`
- Tracker: https://github.com/Huc06/kind-meitner/issues/31
- Ship tickets: #63 #64 #65 #66 #67 (defer #68)
