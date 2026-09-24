# Dev Day evidence pack

Live Free-MCP evidence captured against production Railway on **2026-09-22**.
No invented PASS/GO. Desktop room screenshots and ASP `#13837` listing HTTP 200 remain pending.

## Completed (live production)

| File | Proves |
| --- | --- |
| `live-smoke-2026-09-22.txt` | `pnpm dev-day:smoke` / `scripts/dev-day-gate-smoke.sh` **PASS** |
| `live-tools-list.json` | Both gate tools listed: `scan_free_mcp_readiness`, `get_asp_trust_card` |
| `live-scan-fail-vercel.json` | Vercel host → readiness **FAIL** + remediation |
| `live-scan-pass-railway.json` | Railway Free-MCP → readiness **PASS** |
| `live-trust-nogo-99999.json` | Trust agent `99999` → **NO_GO** (Block path) |
| `live-trust-go-13851.json` | Trust canonical `#13851` (Kind Meitner Markets) → **HTTP 200 + endpoint PASS → GO** |
| `live-trust-nogo-13837.json` | Trust `#13837` + Railway → listing **404** + endpoint PASS → honest **NO_GO** |
| `live-trust-go-substitute-8136.json` | Continue-on-GO mechanics via public substitute ASP `8136` |
| `live-trust-go-substitute-11167.json` | Continue-on-GO mechanics via public substitute ASP `11167` |

Production Free-MCP URL:

```text
https://kind-meitner-production.up.railway.app/api/okx/free-mcp
```

Browser GET on that URL returns 403 by design; use POST JSON-RPC.

## Desktop screenshots (isolated fixture + live envelopes)

Captured 2026-09-22 via `scripts/testing/dev-day-gate-visual.e2e.test.ts` using pinned production envelopes (fake engine emits live Free-MCP JSON; no user app touched).

| File | Proves |
| --- | --- |
| `desktop/empty.png` | Seeded `#dev-day-gate` + 4 starters + chart marks |
| `desktop/readiness.png` | Live vercel FAIL card in room |
| `desktop/loop-a-fail-apply.png` | Apply host fills Railway URL without auto-send |
| `desktop/trust.png` | Live trust NO_GO card region |
| `desktop/loop-b-99999-block.png` | Block spend CTA fill-only from NO_GO |
| `desktop/loop-b-go-8136-continue.png` | Continue enabled on substitute GO (`8136`) |
| `desktop/loop-b-13837-nogo.png` | Honest NO_GO for `#13837` listing 404 + endpoint PASS |

## Pending

| Item | Blocker | Owner |
| --- | --- | --- |
| Demo video 2–4 min room-scroll | Needs human capture from desktop | #27 / #68 |
| Submission form package | Needs video + product link | #25 / #68 |

## Honest limits

- Canonical ASP `#13851` is live (HTTP 200) and verified GO.
- Unlisted test case `#13837` remains historical proof that listing 404 yields NO_GO even when endpoint passes.
- Substitute GO agents (`8136` / `11167`) prove CTA mechanics only; VO must say they are not Kind Meitner Markets.
- Official product listing for submit: https://www.okx.ai/agents/13851.
