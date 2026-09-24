# OKX Dev Day — Build brief for Hulk (crystal clear)

**Audience:** @Huc06 (implement) · Grok Bot (plan only)  
**Team status:** Accepted · Singapore finale aim · Track **Build a Company**  
**Hard deadline:** submit form **25 Sep 2026 23:59 UTC** → https://forms.gle/81S2gnFCzqSoeDEA7  
**Product USP:** Free-MCP **listing readiness** + **pre-spend trust** (not invite theater, not fake prices)

Companion: `2026-09-21-okx-dev-day-readiness-trust.md`

---

## 0. What “done” means for submission

Judges must see **one working OKX AI agent service** other agents can call:

| Artifact | Source |
| --- | --- |
| Live Free-MCP URL | `https://kind-meitner-production.up.railway.app/api/okx/free-mcp` |
| ASP listing | https://www.okx.ai/agents/13837 |
| New tools | `scan_free_mcp_readiness` + `get_asp_trust_card` on that same Free endpoint |
| Evidence | `docs/evidence/dev-day/` (curl PASS + FAIL + trust sample) |
| Video | 2–4 min screen capture of live tools |
| GitHub | public repo + judge README + build-window delta (17–25 Sep commits) |

Desktop chat polish (#16/#17/#19) is **optional**. Do not spend Singapore-prep time on it until the table above is green.

---

## 1. Code map (where to change)

| Concern | File |
| --- | --- |
| Tool declarations + handlers | `server/okx/intelligence.ts` → `getFreeToolDeclarations()` + `handleFreeMcpToolCall()` |
| HTTP route | already `POST /api/okx/free-mcp` via gateway |
| Tests | `server/okx/free-mcp.test.ts` (extend; keep existing free tools working) |
| Contract docs | `docs/free-a2mcp-asp.md` (mention new tools; stay free/no wallet) |
| Evidence | create `docs/evidence/dev-day/` |

**Do not** put readiness/trust behind x402 or mainnet. Keep `annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }` and description prefix `"Free resource: …"`.

Existing free tools to **keep** (do not break):  
`list_okx_ai_use_cases`, `get_free_a2mcp_launch_checklist`, `query_market_benchmarks`, `get_asp_reputation`, `get_trending_asps`.

---

## 2. Tool A — `scan_free_mcp_readiness` (Issue #23 · P0 · Day 1)

### Purpose
ASP builders call this **before / during listing review** to get pass/warn/fail + fixes (Latch402-class for **free** endpoints).

### Input schema
```json
{
  "type": "object",
  "properties": {
    "endpointUrl": { "type": "string", "minLength": 8, "maxLength": 500 },
    "agentId": { "type": "string", "maxLength": 64 }
  },
  "required": ["endpointUrl"],
  "additionalProperties": false
}
```

### Checks (implement in order; each becomes an evidence row)

1. **URL parse** — must be `https:`  
2. **Host pitfall** — if hostname ends with `vercel.app` → **FAIL** (or strong WARN) with remediation: “OKX test env does not support vercel.app; use custom domain / Railway / etc.”  
3. **HTTPS GET/POST reachability** — POST JSON-RPC `tools/list` with `Content-Type: application/json`, timeout ~8s  
4. **Status** — expect HTTP **200** (not 402/401/5xx)  
5. **Body** — JSON-RPC result with `tools` array; each tool has `name`  
6. **Free shape** — no payment-required headers that imply this URL is paid-only for discovery; if `tools/list` itself returns 402 → **FAIL**  
7. **Optional soft** — if `initialize` supported, record ok/skip  
8. **Self-scan allow** — scanning our own Railway URL must work in CI/demo

### Output shape (always this envelope)
```json
{
  "resource": {
    "access": "free",
    "paymentRequired": false,
    "walletRequired": false,
    "mainnet": false,
    "provenance": "kind-meitner live HTTPS probes + public listing pitfalls"
  },
  "data": {
    "endpointUrl": "https://…",
    "agentId": null,
    "verdict": "PASS" | "WARN" | "FAIL",
    "score": 0,
    "checks": [
      { "id": "https_scheme", "status": "pass|warn|fail", "detail": "…" },
      { "id": "host_pitfall_vercel", "status": "pass|warn|fail", "detail": "…" },
      { "id": "tools_list_http", "status": "pass|warn|fail", "detail": "status=200 latencyMs=…" },
      { "id": "tools_list_shape", "status": "pass|warn|fail", "detail": "N tools: …" },
      { "id": "no_accidental_402", "status": "pass|warn|fail", "detail": "…" }
    ],
    "remediation": ["…"],
    "raw": { "httpStatus": 200, "toolNames": ["…"], "truncatedNotes": "…" }
  }
}
```

**Verdict rules (simple, document in code comment):**
- any `fail` on https_scheme / tools_list_http / no_accidental_402 → **FAIL**
- vercel host → **FAIL** (preferred) or WARN if you must soft-fail for odd mirrors
- else if any warn → **WARN**
- else **PASS**

### Tests (`free-mcp.test.ts`)
- tools/list contains `scan_free_mcp_readiness`
- call against fixture’s own `/api/okx/free-mcp` → verdict PASS or WARN (never crash)
- call `https://example.vercel.app/api` (mock fetch if needed) → FAIL + vercel remediation text
- never returns payment headers / 402 for this tool itself

### Demo curl (put in evidence)
```bash
BASE=https://kind-meitner-production.up.railway.app
curl -sS -X POST "$BASE/api/okx/free-mcp" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/call","params":{"name":"scan_free_mcp_readiness","arguments":{"endpointUrl":"'"$BASE"'/api/okx/free-mcp"}}}'
```

---

## 3. Tool B — `get_asp_trust_card` (Issue #24 · P1 · Day 2)

### Purpose
Buyer agents call **before spend** → GO / CAUTION / NO-GO with honest limits.

### Input schema
```json
{
  "type": "object",
  "properties": {
    "agentId": { "type": "string", "minLength": 1, "maxLength": 64 },
    "endpointUrl": { "type": "string", "maxLength": 500 }
  },
  "required": ["agentId"],
  "additionalProperties": false
}
```

### Logic (honest, no invented on-chain credit)
1. Normalize `agentId` (digits ok, e.g. `13837`)  
2. If `endpointUrl` provided → run same probe helpers as readiness (reuse code)  
3. If only agentId → try public page `https://www.okx.ai/agents/{id}` fetch: record HTTP status only (200/404). **Do not invent** listing fields you cannot parse reliably.  
4. Compose card:

| Signal | GO | CAUTION | NO-GO |
| --- | --- | --- | --- |
| Endpoint probe | PASS | WARN | FAIL / unreachable |
| Listing page | 200 | unknown / soft fail | 404 |
| Data honesty | always state what was *not* checked (no on-chain credit, no revenue claim) |

### Output shape
```json
{
  "resource": { "access": "free", "paymentRequired": false, "walletRequired": false, "mainnet": false,
    "provenance": "kind-meitner HTTPS probes + optional okx.ai agent page status; not an OKX endorsement" },
  "data": {
    "agentId": "13837",
    "decision": "GO" | "CAUTION" | "NO_GO",
    "summary": "one sentence",
    "signals": [
      { "id": "listing_page", "status": "pass|warn|fail|skipped", "detail": "HTTP 200" },
      { "id": "endpoint_readiness", "status": "pass|warn|fail|skipped", "detail": "…" }
    ],
    "notChecked": [
      "on-chain credit score",
      "historical settlement volume",
      "OKX official endorsement"
    ],
    "remediation": ["…"]
  }
}
```

### Tests
- tools/list contains `get_asp_trust_card`
- agentId `13837` + our Railway URL → GO or CAUTION (stable)
- missing agentId → MCP error
- response always includes `notChecked` array

---

## 4. Day-by-day owner checklist (ICT)

### D0 — Mon 21 Sep (today)
- [ ] Hulk reads this brief + #23  
- [ ] Freeze scope: **only** tools A/B + evidence + video + form (no invite UX)  
- [ ] Confirm Telegram builder group + onboarding email access  
- [ ] Comment on #23: ETA for Railway deploy of tool A

### D1 — Tue 22 Sep
- [ ] Ship `scan_free_mcp_readiness` + tests  
- [ ] Deploy main/Railway  
- [ ] Save PASS curl + FAIL vercel (or mock) under `docs/evidence/dev-day/`  
- [ ] PR for tool A; update #26 evidence paths

### D2 — Wed 23 Sep
- [ ] Ship `get_asp_trust_card` + tests + deploy  
- [ ] External call proof: paste agent transcript calling #13837 (Codex/OpenClaw/Claude)  
- [ ] Judge README section in root README or `docs/okx-dev-day-judge.md`  
- [ ] Chase #18 listing status (approved / under review / fix)

### D3 — Thu 24 Sep
- [ ] Record demo video 2–4 min (script in #27)  
- [ ] Build-window delta list (commits 17–25 Sep)  
- [ ] Dry-run every form field (#25)  
- [ ] Optional: #28 positioning one-pager

### D4 — Fri 25 Sep
- [ ] Submit form **before 23:59 UTC** (26 Sep 06:59 ICT)  
- [ ] Keep submission receipt; watch email/Telegram 24h SLA  
- [ ] Do **not** book non-refundable SG travel until written finalist mail (by 30 Sep)

---

## 5. Issue order (do not reorder)

1. **#23** Tool A readiness  
2. **#26** Evidence + judge README (start as soon as first PASS exists)  
3. **#24** Tool B trust card  
4. **#18** Listing #13837  
5. **#27** Demo video  
6. **#25** Submission form  
7. **#28** Positioning docs (parallel anytime)  
8. #17 / #19 / #20 — only if 1–6 green

---

## 6. Explicit non-goals (reject in review)

- Invite-to-room / trending registry as the demo  
- Claiming live OKX market prices or mainnet revenue  
- Putting readiness behind paid x402 for Dev Day  
- Desktop-only chatbot as the product  
- Fake on-chain credit scores

---

## 7. One-sentence pitch (form + video VO)

> Kind Meitner Markets is the Free-MCP readiness scanner and pre-spend trust gate for OKX.AI — builders and buyer-agents call it before listing or before paying, with pass/warn/fail evidence instead of opaque review loops.
