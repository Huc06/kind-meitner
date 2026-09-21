# Feature plan + UI/UX show — verify real (no mock / no fake demo)

**Scope ONLY:** what to build (features) + what to show (UI/UX) + how to **check it is really running**.  
**Out of scope:** Telegram, submit form, video file, prize schedule, marketing pitch decks.

**Rule:** If a screen can be faked with hardcoded PASS/JSON without calling Free-MCP or without a real tool activity row, it is **demo sai** — reject in review.

---

# PART 1 — FEATURE PLAN (what must run)

## F0. Non-negotiable runtime truth

| # | Truth | How you verify later |
| --- | --- | --- |
| T1 | Readiness scan hits a **real HTTPS** `tools/list` (or fails for real network/host reasons) | Change URL → different checks; vercel host always FAIL without mocking the check table |
| T2 | Trust check hits real `okx.ai/agents/{id}` status and/or real endpoint probe | Bad id 99999 → NO_GO; 13837 + live Railway → not NO_GO from 404 alone if page 200 |
| T3 | Room CTAs cause a **new** Markets tool call or a **new** composer→send turn | Network/tool activity row appears after click; not only local React state paint |
| T4 | Continue-with-free-tools runs an **actual** free tool (`get_free_a2mcp_launch_checklist` or listed free tool) | Activity name matches; payload is live response |
| T5 | No fixture “always PASS” in production Railway build | Grep: no `DEMO_FORCE_PASS`, no stub handler on `/api/okx/free-mcp` for these tools |

**Forbidden mocks for show:**
- Hardcoded card with `verdict: "PASS"` without `tools/call`
- Fake member messages inserted into history without agents
- Local-only “scan” that doesn’t POST outbound
- Screenshot of JSON instead of action card + activity

---

## F1. `scan_free_mcp_readiness` (server)

**Runs on:** `POST /api/okx/free-mcp` · `tools/call` name exact.

**Does:**
1. Validate `endpointUrl` (https)
2. FAIL if host is `*.vercel.app`
3. POST real `tools/list` to that URL (8s timeout)
4. Classify HTTP/shape/402
5. Return structured result **for the client to render an action card**

**Does not:** invent marketplace data; skip network “for demo.”

**Verify checklist (post-deploy):**
```bash
BASE=https://kind-meitner-production.up.railway.app
# 1) tool exists
curl -sS -X POST "$BASE/api/okx/free-mcp" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/list"}' | jq -r '.result.tools[].name' | grep scan_free_mcp_readiness

# 2) real PASS path (self)
curl -sS -X POST "$BASE/api/okx/free-mcp" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"2","method":"tools/call","params":{"name":"scan_free_mcp_readiness","arguments":{"endpointUrl":"'"$BASE"'/api/okx/free-mcp"}}}' \
  | jq -r '.result.content[0].text' | jq -r '.data.verdict'

# 3) real FAIL path (vercel host — no need for host to be up)
curl -sS -X POST "$BASE/api/okx/free-mcp" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"3","method":"tools/call","params":{"name":"scan_free_mcp_readiness","arguments":{"endpointUrl":"https://demo.vercel.app/api/okx/free-mcp"}}}' \
  | jq -r '.result.content[0].text' | jq -r '.data.verdict'
# expect FAIL and remediation mentioning vercel
```

**Pass criteria:** (2) PASS or WARN · (3) FAIL · changing URL changes output · latency not always 0ms.

---

## F2. `get_asp_trust_card` (server)

**Does:** real listing GET + optional readiness reuse · decision GO|CAUTION|NO_GO · always `notChecked` · `safeNextStep` string for UI.

**Verify:**
```bash
# NO_GO-ish bad id
curl … tools/call get_asp_trust_card arguments: {"agentId":"99999"}
# expect decision NO_GO or CAUTION with listing_page fail — not GO

# 13837 + railway endpoint
curl … {"agentId":"13837","endpointUrl":"$BASE/api/okx/free-mcp"}
# expect not NO_GO solely from empty mock; decision GO|CAUTION with real signals
```

---

## F3. Action card UI (client) — show layer over real tool results

**Mount when:** transcript has Markets tool success for F1/F2 names AND JSON parses.  
**If parse fails:** show normal tool error UI — **do not** show a decorative fake card.

### F3a. Readiness action card (show)

**Visible**
- Verdict chip PASS|WARN|FAIL (from **live** payload)
- Human host line
- Check rows: **label** from payload or mapped from id (never invent pass rows client-side)
- Fix list from `remediation[]` only if server sent them

**Buttons (must execute, not decorate)**

| Button | Real effect | Verify |
| --- | --- | --- |
| **Run scan again** | New composer fill `@Markets` scan same URL **or** direct retrigger that creates new `tools/call` activity | Second activity row / new message id |
| **Apply suggested host** | Fills composer with Railway HTTPS URL message for Coach/Ops | Composer text changes; after Send, new human/agent message |
| **Copy fix** | Clipboard gets remediation text | Paste matches server remediation |

**Evidence:** collapsed; opening it shows **same** payload as tool result (optional). Not required for show.

### F3b. Trust action card (show)

| Button | Real effect | Verify |
| --- | --- | --- |
| **Block spend** | Fill/send Scout refuse-pay turn | New Scout (or Ops) message refusing pay |
| **Continue with free tools only** | Triggers **real** free `tools/call` in room | Activity for e.g. `get_free_a2mcp_launch_checklist` |
| **Re-check agent** | New trust `tools/call` | New activity + possibly new card |

**Client must not:** flip NO_GO→GO in UI without a new tool result.

---

## F4. `#dev-day-gate` workbench room (show + run)

**Seed creates (idempotent):**
- Group with 3 members: Markets (Free-MCP capable), Listing Coach, Spend Scout  
- Bulletin: gate before list / spend  
- `defaultResponder: mentions`  
- Empty state + **4 chips** that only fill composer with real @ instructions (no auto fake replies)

**Chips → exact fill (execute after user Send):**

1. Scan vercel — instruction that causes Markets to call F1 on `https://demo.vercel.app/api/okx/free-mcp`  
2. Scan Railway — F1 on production Free-MCP URL  
3. Trust 99999 — F2  
4. Trust 13837 + Railway endpoint — F2  

**Verify room is real:**
- Members are real bot ids in `group.memberIds`  
- After Send, `kind: activity` with `tool.name` appears from Markets  
- Authors differ across Coach / Markets / Scout (not one bot rewriting history)

**Demo sai:** pre-seeded transcript with PASS/FAIL messages and no tool activities.

---

## F5. Catalog agents (feature supporting show)

| id | name | Must do when prompted |
| --- | --- | --- |
| (existing Markets / ASP-backed) | Markets | Call F1/F2 tools — not invent verdicts |
| `okx-listing-coach` | Listing Coach | Ask Markets to scan; propose host fix in chat |
| `okx-spend-scout` | Spend Scout | Ask trust; refuse pay on NO_GO; allow free tool only on GO |

**Verify prompts:** ask Coach “scan this vercel URL” → tool activity from Markets, not Coach hallucinating FAIL.

---

## F6. Avatars (UI show only)

Chart marks on 3 seats. **Verify:** no Cursor/SupaMaus as default for catalog chart agents. Does not affect runtime truth of F1–F4.

---

# PART 2 — UI/UX SHOW SCRIPT (what you look at)

Order of screens for a correct show (all live):

### Screen 1 — Sidebar
- Section Dev Day · room `#dev-day-gate`  
- 3 chart faces  

### Screen 2 — Empty room
- Bulletin visible  
- Line: three agents / one gate  
- 4 chips — **tap chip → composer fills** (watch composer, not a modal mock)

### Screen 3 — Loop A live
1. Send chip 1 → Markets activity `scan_free_mcp_readiness`  
2. Card FAIL (vercel) with **Run scan again** + **Apply suggested host** enabled  
3. Apply host → Send → Run scan again / new scan  
4. Card PASS on Railway  
5. Confirm two distinct tool activities in transcript  

### Screen 4 — Loop B live
1. Trust 99999 → NO_GO card → **Block spend** → Scout refuse message  
2. Trust 13837 → GO/CAUTION → **Continue with free tools** → **new** free tool activity  

### Screen 5 — Optional 1:1 Markets
Same cards if tool run in DM — proves UI not room-fake-only.

---

# PART 3 — SHOW LAYOUT (UI spec, action-first)

## Readiness card
```
[ FAIL ]  Listing readiness
demo.vercel.app

• HTTPS scheme              ok
• Vercel host not allowed   blocked   ← human label
• tools/list reachable      failed

Fix
• Use Railway/custom HTTPS (not vercel.app)
• Run scan again after host change

[ Apply suggested host ]  [ Run scan again ]  [ Copy fix ]
```

## Trust card
```
[ NO_GO ]  Pre-spend trust
Agent 99999

• Listing page     not found
• Endpoint probe   skipped

Not verified: on-chain credit · settlements · OKX endorsement

Next: Do not call pay tools.

[ Block spend ]  [ Re-check agent ]
```
(On GO, primary becomes **Continue with free tools only**.)

Tokens: existing `bg-raised` / hairline / quiet shell. Verdict = largest text. No scoreboard.

---

# PART 4 — ACCEPTANCE MATRIX (check running vs sai)

| Check | Running (OK) | Demo sai (reject) |
| --- | --- | --- |
| Vercel scan | FAIL from server; remediation present | Card FAIL painted without tools/call |
| Railway scan | PASS/WARN; latency & toolNames vary | Always identical instant PASS |
| Run scan again | Second activity id | Button no-ops / only toggles CSS |
| Apply host | Composer changes to https Railway URL | Toast “applied” with no text change |
| Block spend | New refuse message in room | Chip disables with no message |
| Continue | Real free tool activity | Fake “success” banner |
| Room seed | 3 memberIds | 1 bot renamed three times |
| tools/list | Both F1 F2 names on Railway | Only local vitest mock |

---

# PART 5 — IMPLEMENT ORDER (features/UI only)

1. F1 server + Railway (verify curl matrix)  
2. F2 server + Railway  
3. F3 cards wired to **live** tool payloads + CTAs that create turns  
4. F5 catalog Coach/Scout  
5. F4 room seed + chips  
6. F6 avatars  

Do not ship F3 decorative cards before F1 returns live FAIL/PASS.

---

# PART 6 — FILE TOUCH MAP

| Feature | Files (expected) |
| --- | --- |
| F1 F2 | `server/okx/intelligence.ts`, `server/okx/free-mcp.test.ts`, `docs/free-a2mcp-asp.md` |
| F3 | new card components; wire `GroupView` / `ChatView` tool result path |
| F4 | seed helper + empty/chips in `GroupView` or small `DevDayGate` module; `createGroup` |
| F5 | `server/okx/agent-import.ts` (+ prompts wherever catalog stores instructions) |
| F6 | `Avatar.tsx` / catalog avatar field |

---

# PART 7 — ONE-PAGE “IS IT REAL?” SMOKE (after any PR)

1. `tools/list` has both tools on Railway  
2. vercel URL → FAIL via curl  
3. self URL → PASS/WARN via curl  
4. In app room: chip → Send → activity → card  
5. Run scan again → second activity  
6. Trust 99999 → NO_GO → Block spend → new message  
7. Continue on GO → free tool activity name visible  

If any step uses a stub, mark PR **not show-ready**.
