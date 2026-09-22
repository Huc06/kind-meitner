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
| `live-trust-nogo-13837.json` | Trust `#13837` + Railway → listing **404** + endpoint PASS → honest **NO_GO** |
| `live-trust-go-substitute-8136.json` | Continue-on-GO mechanics via public substitute ASP `8136` |
| `live-trust-go-substitute-11167.json` | Continue-on-GO mechanics via public substitute ASP `11167` |

Production Free-MCP URL:

```text
https://kind-meitner-production.up.railway.app/api/okx/free-mcp
```

Browser GET on that URL returns 403 by design; use POST JSON-RPC.

## Pending

| Item | Blocker | Owner |
| --- | --- | --- |
| Desktop `#dev-day-gate` screenshots (Loop A Apply→PASS, Loop B Block, Continue-on-GO) | #66 desktop proof dump | Hulk |
| ASP `#13837` public listing HTTP 200 | #18 ops/listing publish | Ops / owner |
| Demo video 2–4 min room-scroll | Needs desktop loops | #27 / #68 |
| Submission form package | Needs video + product link | #25 / #68 |

## Honest limits

- Do **not** claim `#13837` is GO while listing is 404.
- Substitute GO agents (`8136` / `11167`) prove CTA mechanics only; VO must say they are not Kind Meitner Markets.
- Product-link fallback for submit: Railway Free-MCP URL + note `ASP #13837 under review / unpublished`.
