# OKX Dev Day — judge README

## What to verify (≤5 minutes)

1. **Live Free-MCP**  
   `POST https://kind-meitner-production.up.railway.app/api/okx/free-mcp`  
   Expect `tools/list` to include `scan_free_mcp_readiness` and `get_asp_trust_card`.

2. **Readiness FAIL → PASS**  
   - Vercel host → FAIL (see `docs/evidence/dev-day/live-scan-fail-vercel.json`)  
   - Railway Free-MCP → PASS (see `docs/evidence/dev-day/live-scan-pass-railway.json`)

3. **Trust honesty**  
   - Fake id `99999` → NO_GO (`live-trust-nogo-99999.json`)  
   - Canonical ASP `#13851` (Kind Meitner Markets) → **HTTP 200 / GO** (`live-trust-go-13851.json`)  
   - Historical unlisted test case `#13837` (HTTP 404) → honest NO_GO even with endpoint PASS (`live-trust-nogo-13837.json`)  
   - Continue-on-GO mechanics also proven on public substitute ASP (`live-trust-go-substitute-8136.json`)

4. **Desktop console**  
   Seed `#dev-day-gate` (Markets + Listing Coach + Spend Scout). Cards + locked CTAs: Apply host / Block spend / Continue (GO only) / Re-check. See issue #66 for desktop screenshot dump status.

## Product claim (honest)

Kind Meitner is a multichat workbench that gates listing and spend with free, read-only Free-MCP tools — not a JSON dump UI, not a paid x402 scanner for the Dev Day demo.

## Evidence index

See [`docs/evidence/dev-day/README.md`](./evidence/dev-day/README.md).
