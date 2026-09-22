# Dev Day next steps (22 Sep 2026 ICT)

Read this after the easy plan: `docs/plans/2026-09-21-okx-feature-uiux-easy.md` (Locked decisions).

Master tracker: issue **#31**. Submit deadline: **25 Sep 2026 23:59 UTC**. Singapore finale target: **7 Oct**.

## What just landed

- **#59** merged: skip absent mobile CI jobs.
- **#61** merged: cross-platform CI baseline (vendor SHA, MausBodies guards, phone-secret fixture, evaluator size, POSIX broker paths).
- Planning docs + smoke script already on `main` (through **#41**).

## What is still blocked

Production Free-MCP still does **not** list `scan_free_mcp_readiness`.

```bash
pnpm dev-day:smoke
# FAIL until #47 is merged and Railway redeploys
```

Live URL: `https://kind-meitner-production.up.railway.app/api/okx/free-mcp`

## Spine order (do in this order only)

### 1. Merge readiness tool — PR **#47** (issue #23)

Owner: **@Huc06**

1. Rebase `feat/issue-23-free-mcp-readiness` onto latest `main` (now includes #61).
2. Confirm `typecheck + test` green on ubuntu / macos / windows.
3. Confirm local: `pnpm exec vitest run server/okx/free-mcp.test.ts` (expect 8/8).
4. Undraft already done — **merge** when CI is green.
5. Deploy Railway production for kind-meitner.
6. Run `pnpm dev-day:smoke` until PASS (must list `scan_free_mcp_readiness` and call it successfully).

Do not start cards/room merges before this smoke is green.

### 2. Merge trust tool — PR **#48** (issue #24)

Owner: **@Huc06**

1. Rebase onto `main` after #47 (PR is currently CONFLICTING).
2. Confirm `get_asp_trust_card` returns GO / CAUTION / NO_GO plus `notChecked` and `safeNextStep`.
3. Undraft and merge.
4. Redeploy if needed; smoke should still pass and trust tool must appear in tools/list.

### 3. Finish action cards — PR **#50** (issue #29)

Owner: **@Huc06**

Current gap: cards only have Copy / Evidence / Rescan.

Add locked CTAs from the easy plan:

| Card | CTA | Rule |
|------|-----|------|
| Readiness | **Apply host** | Pastes real Railway Free-MCP URL |
| Readiness | **Run scan again** | Keep; disable while Markets busy |
| Trust | **Block spend** | On NO_GO / CAUTION |
| Trust | **Continue free tools** | Enabled **only on GO** |
| Trust | **Re-check** | Re-run trust for same agent id |

Also: disable CTAs while a tool call is in flight; never invent verdicts in the UI; shared parser only.

Merge only after #47 and #48 are live on Railway.

### 4. Room seed — PR **#51** (issue #30)

Owner: **@Huc06**

Hold until steps 1–3 are done. Then verify `#dev-day-gate`:

- Loop A: vercel FAIL → Apply host → Run again → PASS
- Loop B: agent 99999 NO_GO → Block → agent 13837 GO → Continue → real free-tool activity

## Hold (do not merge yet)

| PR | Why |
|----|-----|
| #49 catalog | After room |
| #42 avatars | Last; OKX-agent marks only |
| #52 #53 #54 #55 #57 | Evidence / video / submit / visual — after smoke green |
| #43 | Rebase conflict; docs only |
| #44 | Not spine (local OKX server) |
| #16 | Welcome polish — after gate |
| #14 #46 | Chore OK when free; do not delay #47 |
| **#15** | **Do not merge** (drops OKX views) |

## Who does what

| Role | Now |
|------|-----|
| **@Huc06 (Hulk)** | Rebase+CI+#47 merge+deploy → #48 → #50 CTAs → #51 |
| **Planning (harrymove-ctrl / Grok Bot)** | Specs, PR review comments, this checklist — no feature coding |
| **Huc bot** | Stood down unless user asks for coding help |
| **Owner** | Nudge merge when #47 CI is green; keep submit form path ready for 25 Sep |

## Done when

1. `pnpm dev-day:smoke` PASS on production.
2. Both loops runnable in `#dev-day-gate` with real CTAs (not JSON-only).
3. Then evidence / video / submit package PRs can land.

## Links

- Easy plan + locked rules: `docs/plans/2026-09-21-okx-feature-uiux-easy.md`
- Recommendations: `docs/plans/2026-09-21-okx-recommendations-and-linked-plan.md`
- Smoke: `scripts/dev-day-gate-smoke.sh` / `pnpm dev-day:smoke`
- Tracker: https://github.com/Huc06/kind-meitner/issues/31
- #47: https://github.com/Huc06/kind-meitner/pull/47
- #48: https://github.com/Huc06/kind-meitner/pull/48
- #50: https://github.com/Huc06/kind-meitner/pull/50
- #51: https://github.com/Huc06/kind-meitner/pull/51
