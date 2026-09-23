# OKX Dev Day submission worksheet — issue #25

**Not submitted.** Human fills the form. Deadline **2026-09-25 23:59 UTC** (2026-09-26 06:59 ICT). Internal buffer: **2026-09-25 15:00 ICT**.

- Form: https://forms.gle/81S2gnFCzqSoeDEA7
- Builder kit: https://www.okx.com/en-gb/learn/okx-dev-day-builder-kit
- Repo: https://github.com/Huc06/kind-meitner

## Copy

**Project:** Kind Meitner Markets

**Track:** Build a Company

**Route:** Singapore finale aim. Pick Singapore on the form only if the roster can attend. Otherwise Remote Build. Do not book travel until a written finalist email.

**One line:** Kind Meitner Markets is a free, read-only A2MCP readiness and pre-spend trust gate: builders scan before listing, buyers get GO/CAUTION/NO_GO before a consequential call.

**Description:** Two JSON-RPC tools on `POST /api/okx/free-mcp`. `scan_free_mcp_readiness` returns PASS/WARN/FAIL plus a fix. `get_asp_trust_card` returns GO/CAUTION/NO_GO, what was checked, what was not, and a safe next step. FAIL means fix and re-scan. NO_GO means do not pay. No wallet, custody, settlement, mainnet, or OKX endorsement. ASP `#13837` is not public yet (listing HTTP 404); the live product URL is the Railway Free-MCP endpoint.

## Links to paste

| Field | Value |
| --- | --- |
| Repository | `https://github.com/Huc06/kind-meitner` |
| Product URL | `https://kind-meitner-production.up.railway.app/api/okx/free-mcp` |
| Listing | `ASP #13837 status: not public (https://www.okx.ai/agents/13837 HTTP 404 as of 2026-09-23).` Replace this only after the page is HTTP 200. |
| Video | `[2–4 MIN VIDEO URL]` — still pending record/publish |
| Judge path | `docs/okx-dev-day-judge.md` and `docs/evidence/dev-day/` once evidence PR #82 is on `main` |

## Build-window delta (17–25 Sep)

Regenerate before submit:

```sh
git log --since='2026-09-17T00:00:00Z' --until='2026-09-26T00:00:00Z' --format='%h %ad %s' --date=short
```

Say this, then attach the fresh log:

> During the build window we added a Free A2MCP readiness scanner, an ASP trust card with explicit limits, result cards, and the `#dev-day-gate` room. Production Free-MCP on Railway answers `tools/list`, a Vercel-shaped host FAILs, and the Railway host PASSes. Trust for our own ASP stays NO_GO while its marketplace page is 404. The pre-existing desktop app is not the new work.

## Before submit

- [ ] Confirm team name, members (max 4), emails, and exactly one route.
- [ ] Watch the video once. Labels match the cards. No fake PASS/GO.
- [ ] Open every URL logged out.
- [ ] Read the form declaration, submit, save the receipt.
- [ ] Watch email for 24h replies through 30 Sep.

## Still human-only

Recording, uploading the video, changing the ASP listing, and pressing submit. This document does none of those.
