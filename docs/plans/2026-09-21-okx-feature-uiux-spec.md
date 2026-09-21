# Kind Meitner — Feature + UI/UX spec (Dev Day product)

**Scope of this document:** features and UI/UX only. No video, no submission form, no marketing calendar.  
**Audience:** Hulk (@Huc06) implementation.  
**Related issues:** #23 #24 #29 #30 #20 #17 (and catalog touch on #18 copy only if listing text must name tools).  
**Stack anchors:** React chat/`GroupView`, Free A2MCP `server/okx/intelligence.ts`, OKX catalog `server/okx/agent-import.ts`, tokens `bg-sidebar` / `bg-raised` / `bg-app` / `hairline` / `bg-composer`.

---

## 0. Product surfaces (what we are building)

| Layer | What it is | User sees |
| --- | --- | --- |
| **L1 Protocol** | Free A2MCP tools on `POST /api/okx/free-mcp` | External agents + Markets bot call tools |
| **L2 Multichat** | Room `#dev-day-gate` with 3 OKX agents | Shared transcript, handoffs, tool chips |
| **L3 Cards** | ReadinessRunCard / TrustCard in transcript | Verdict-first UI, not raw JSON dump |
| **L4 Identity** | Catalog roles + chart avatars | Roster looks like OKX agents, not mascots |

Desktop is an **ops console for the room**, not a separate dashboard app.

---

# PART A — FEATURES (backend + agent behavior)

## A1. Feature: Free-MCP readiness scanner (`scan_free_mcp_readiness`) — #23

### A1.1 Job story
As a **builder agent** (or Markets bot acting for a builder), I pass a candidate ASP HTTPS URL and get a structured gate: PASS / WARN / FAIL with per-check evidence and remediation verbs I can execute next.

### A1.2 Placement
- Register in `getFreeToolDeclarations()` beside existing free tools.
- Handle in `handleFreeMcpToolCall()`.
- Description **must** start with `Free resource:` and use annotations `{ readOnlyHint: true, destructiveHint: false, openWorldHint: false }`.
- Never require wallet, payment headers, or mainnet.

### A1.3 Input (strict)
| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `endpointUrl` | string | yes | 8–500 chars; trim; reject non-http(s); **https only for PASS path** (http → FAIL check `https_scheme`) |
| `agentId` | string | no | ≤64; stored in output only (no marketplace invent) |

Invalid JSON / missing `endpointUrl` → MCP tool error (`isError: true`) with plain message: `endpointUrl is required`.

### A1.4 Check pipeline (ordered, each always present in `checks[]`)

| id | pass | warn | fail | Notes |
| --- | --- | --- | --- | --- |
| `https_scheme` | `https:` | — | missing/http/invalid URL | |
| `host_pitfall_vercel` | host not `*.vercel.app` | (unused) | hostname ends with `.vercel.app` or equals `vercel.app` | Remediation fixed copy below |
| `dns_or_tcp` | TCP/TLS connect ok | slow >3s | connection refused / DNS fail / TLS error | May merge into http check if simpler |
| `tools_list_http` | status 200 | 2xx other / 429 | timeout, 401/403/404/5xx, **402** | POST body: `{"jsonrpc":"2.0","id":"km-scan","method":"tools/list"}` · `Content-Type: application/json` · timeout **8000ms** · follow redirects ≤3 |
| `tools_list_shape` | `result.tools` array, each has non-empty `name` | tools empty array | not JSON-RPC / no tools key | Record `toolNames` in `raw` |
| `no_accidental_402` | discovery not payment-gated | payment headers on 200 (note only) | HTTP 402 on tools/list | |
| `initialize_soft` | initialize 200 optional | skip if method missing | — | Soft only; never flips PASS→FAIL alone |

**Verdict aggregation**
- Any of `https_scheme`, `host_pitfall_vercel`, `tools_list_http`, `no_accidental_402` = fail → **FAIL**
- Else any warn → **WARN**
- Else → **PASS**
- `score`: optional 0–100 = round(100 * passCount / totalChecks); UI may hide score or show tiny.

### A1.5 Remediation library (exact strings agents can follow)

| Trigger | Remediation entries (array strings) |
| --- | --- |
| vercel host | `Replace *.vercel.app with a custom domain or Railway/Fly HTTPS host. OKX listing test env rejects vercel.app.` |
| http scheme | `Serve the Free A2MCP endpoint on HTTPS only.` |
| timeout / 5xx | `Confirm the process is up, public, and responds to POST tools/list within 8s.` |
| 402 on list | `Do not gate tools/list behind x402. Keep discovery free; put payment only on paid tools if any.` |
| bad shape | `Return JSON-RPC 2.0 result.tools[] with name on each tool for method tools/list.` |
| 401/403 | `Allow unauthenticated tools/list on the free path (or document a public probe token — prefer none).` |

### A1.6 Output envelope (UI parsers depend on this)
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
    "verdict": "PASS",
    "score": 86,
    "checks": [
      { "id": "https_scheme", "status": "pass", "detail": "https" },
      { "id": "host_pitfall_vercel", "status": "pass", "detail": "host=kind-meitner-production.up.railway.app" },
      { "id": "tools_list_http", "status": "pass", "detail": "status=200 latencyMs=412" },
      { "id": "tools_list_shape", "status": "pass", "detail": "5 tools" },
      { "id": "no_accidental_402", "status": "pass", "detail": "no 402" },
      { "id": "initialize_soft", "status": "warn", "detail": "skipped" }
    ],
    "remediation": [],
    "raw": { "httpStatus": 200, "toolNames": ["…"], "truncatedNotes": "" }
  }
}
```

### A1.7 Server UX constraints
- Cap concurrent outbound scans (e.g. 4) to avoid abuse; on overload return WARN check `rate_limited` or error message.
- Truncate `detail` / `raw` strings to ≤500 chars.
- Never echo response bodies that look like secrets.
- SSRF: block link-local, localhost, metadata IPs (10/8, 127/8, 169.254/16, ::1). Scanning our own public Railway URL must remain allowed (public DNS).

### A1.8 Tests (`free-mcp.test.ts`)
1. tools/list contains tool + Free resource description + annotations  
2. Fixture self-URL → not throw; verdict PASS or WARN  
3. Mock vercel host → FAIL + vercel remediation substring  
4. Mock 402 → FAIL `no_accidental_402`  
5. Missing endpointUrl → isError  
6. Existing five free tools still listed  

---

## A2. Feature: ASP trust card tool (`get_asp_trust_card`) — #24

### A2.1 Job story
As a **buyer agent**, I pass an OKX.ai agent id (and optional endpoint) and get GO / CAUTION / NO_GO plus honest `notChecked` so I know what was *not* verified.

### A2.2 Input
| Field | Required | Rules |
| --- | --- | --- |
| `agentId` | yes | 1–64; trim; allow digits `13837` |
| `endpointUrl` | no | same validation as A1 when present |

### A2.3 Signals
| id | How | pass | fail | skipped |
| --- | --- | --- | --- | --- |
| `listing_page` | GET `https://www.okx.ai/agents/{agentId}` timeout 8s | HTTP 200 | 404 / DNS fail | network policy block |
| `endpoint_readiness` | If `endpointUrl` set, run A1 pipeline (reuse helpers) | verdict PASS | FAIL | no endpointUrl → skipped |
| `endpoint_warn` | — | — | — | map readiness WARN into signal warn |

**Do not parse** HTML for price/revenue/credit. Status code + optional `<title>` length > 0 as soft warn if title empty.

### A2.4 Decision matrix
| listing_page | endpoint_readiness | decision |
| --- | --- | --- |
| fail | * | **NO_GO** |
| * | fail | **NO_GO** |
| pass | pass | **GO** |
| pass | skipped | **CAUTION** (listing reachable, endpoint not probed) |
| pass | warn | **CAUTION** |
| warn/skipped | pass | **CAUTION** |
| warn/skipped | skipped | **CAUTION** |

### A2.5 Output
```json
{
  "resource": {
    "access": "free",
    "paymentRequired": false,
    "walletRequired": false,
    "mainnet": false,
    "provenance": "kind-meitner HTTPS probes + optional okx.ai agent page status; not an OKX endorsement"
  },
  "data": {
    "agentId": "13837",
    "decision": "GO",
    "summary": "Listing page reachable and endpoint readiness PASS.",
    "signals": [
      { "id": "listing_page", "status": "pass", "detail": "HTTP 200" },
      { "id": "endpoint_readiness", "status": "pass", "detail": "verdict=PASS" }
    ],
    "notChecked": [
      "on-chain credit score",
      "historical settlement volume",
      "OKX official endorsement",
      "mainnet payment success"
    ],
    "remediation": [],
    "safeNextStep": "Caller may use free read-only tools on this endpoint. Do not treat this as payment approval."
  }
}
```

`safeNextStep` by decision:
- GO: above  
- CAUTION: `Probe or fix endpoint before paying. Free tools only if readiness is known.`  
- NO_GO: `Do not call pay/x402 tools. Fix listing or endpoint first.`

### A2.6 Tests
- listed tool; 13837 + railway → GO|CAUTION; missing agentId error; always `notChecked.length >= 3`; decision enum only those three.

---

## A3. Feature: Catalog agents for room seats — #20

### A3.1 Catalog entries (add to `OKX_CATALOG_AGENTS`)

Keep Market Scout. Add:

```ts
{
  id: "okx-listing-coach",
  name: "Listing Coach",
  summary: "Helps builders prepare Free A2MCP endpoints for OKX listing review.",
  avatar: "chart",
  // capabilities / blurb: free, read-only guidance; asks Markets to scan URLs
}
{
  id: "okx-spend-scout",
  name: "Spend Scout",
  summary: "Buyer-side gate: trust-checks ASPs before spend recommendations.",
  avatar: "chart",
}
```

Exact field names must match existing `OkxCatalogAgent` type — extend type if new fields needed; do not break import API.

### A3.2 Behavioral contract (system / instructions text)

**Listing Coach**
- Role: builder advocate in rooms.  
- When user or bulletin mentions an endpoint URL: propose calling Markets / ask room to run readiness on that URL.  
- On FAIL: quote remediation verbs; propose a corrected HTTPS host; ask for re-scan.  
- Never claim live marketplace prices.  
- Never ask for wallet keys.

**Spend Scout**
- Role: buyer advocate.  
- Before recommending use/pay of an ASP: require trust card on agent id.  
- On NO_GO: explicitly refuse pay language.  
- On GO: allow calling free tools only; still no mainnet payment claims.  
- Always surface `notChecked` in plain language.

**Markets** (existing Free-MCP-backed bot / imported ASP)
- Prefer tool calls `scan_free_mcp_readiness` / `get_asp_trust_card` over prose guesses.  
- After tool result, one short plain-language line + let the card UI carry structure.

### A3.3 Invite panel UX copy
For each catalog row in `OkxAgentInvite`:
- Title = name  
- One line summary  
- Badge: `Free · read-only`  
- Provider line: `OKX.AI catalog`  
- No “live prices” wording  

---

## A4. Feature: `#dev-day-gate` room seed — #30

### A4.1 Create
- Action path: reuse `createGroup` with `memberIds: [marketsBotId, listingCoachId, spendScoutId]`  
- `name`: `#dev-day-gate` (or `Dev Day Gate` if `#` unsupported in name — prefer visible hash in UI label)  
- `section`: `Dev Day`  
- `bulletin`: `Gate before list · Gate before spend · Free A2MCP only`  
- `defaultResponder`: prefer `{ kind: "mentions" }` so @ routing is clear; OR member Markets for tool-heavy prompts — **recommend `mentions`** so Builder/Buyer speak when @’d and Markets when @Markets / tool owner.

### A4.2 Seed entry points (pick one implementation)
1. **Settings / command:** “Seed Dev Day room” button (dev or always-visible under Team library)  
2. **First-run helper:** if catalog agents missing, import Listing Coach + Spend Scout then create group  
3. **Idempotent:** if group with same name+section exists, focus it; don’t duplicate  

### A4.3 Starter chips (composer fill only — no auto-send)
Render above composer when room empty or bulletin focused (pattern like FirstConversationWelcome, but room-scoped):

| Chip label | Fills composer with |
| --- | --- |
| Scan vercel URL | `@Listing Coach check https://demo.vercel.app/api/okx/free-mcp for listing readiness with @Markets` |
| Scan our Railway | `@Markets scan_free_mcp_readiness on https://kind-meitner-production.up.railway.app/api/okx/free-mcp` |
| Trust bad id | `@Spend Scout trust-check agent 99999 before any spend` |
| Trust #13837 | `@Spend Scout trust-check agent 13837 with endpoint https://kind-meitner-production.up.railway.app/api/okx/free-mcp` |

Chips dismissible per room id (localStorage key `km.devday.chips.{groupId}`).

### A4.4 Room header UX
- Title + member avatar stack (3× chart marks, overlap -6px)  
- Bulletin pinned under header (one line, `text-ink-secondary`, hairline bottom)  
- Existing Manage Members / call controls unchanged  

### A4.5 Turn presence
Keep `TurnPresence` / working dots. When Markets runs a tool, activity label must include tool name: `Markets · scan_free_mcp_readiness` (use existing live activity helpers if possible).

---

# PART B — UI/UX (visual + interaction)

## B1. Design principles
1. **Verdict first** — decision chip is the largest type in the card; score is optional caption.  
2. **Conversation, not dashboard** — cards live in `GroupView` transcript like `RoutineRunCard` / `OptionCard`.  
3. **Fix verbs** — every FAIL shows checklist the next agent can act on.  
4. **Honest empty** — `notChecked` always visible on trust.  
5. **Quiet chrome** — use existing tokens; no new brand colors; success/warn/danger from existing semantic if present, else:
   - PASS/GO: `text-emerald` / soft green wash if token exists; else `text-ink` + label  
   - WARN/CAUTION: amber  
   - FAIL/NO_GO: red / destructive  
6. **Room stillness** — GroupView comment: avatars idle; don’t animate all three.

## B2. Component: `ReadinessRunCard` — #29

### B2.1 When to mount
In transcript renderer (GroupView + ChatView activity/tool success path): if tool name is `scan_free_mcp_readiness` and payload parses to envelope above → render card instead of (or above) raw JSON collapse.

Parse: `JSON.parse` of tool result text content; tolerate `{ resource, data }` wrapper.

### B2.2 Layout ( asc → desc visual weight)
```
┌──────────────────────────────────────────────┐
│ [FAIL]  Readiness                          ⋮ │  ← verdict chip + title + menu
│ demo.vercel.app                              │  ← host only (truncate)
│ ──────────────────────────────────────────── │
│ ✓ https_scheme          pass                 │
│ ✗ host_pitfall_vercel   fail                 │  ← fail rows use stronger ink
│ ✗ tools_list_http       fail   status=…      │
│ …                                            │
│ Fix                                          │
│ ☐ Replace *.vercel.app with …                │
│ ☐ Re-scan after DNS propagates               │
│                                              │
│ [Copy fixes]  [Re-scan]  [Evidence]          │
└──────────────────────────────────────────────┘
```

### B2.3 Anatomy
| Element | Spec |
| --- | --- |
| Container | `rounded-2xl bg-raised ring-1 ring-hairline` · padding `14px 16px` · max-width same as bubbles |
| Verdict chip | Pill: `PASS`/`WARN`/`FAIL` · bold 12px · bg soft tint · `aria-label="Readiness verdict FAIL"` |
| Title | `Readiness` 13px medium |
| Host | 12px mono/secondary; full URL in `title` tooltip |
| Check row | icon (Check / AlertTriangle / X) + id as humanized label + status word + detail truncated |
| Fix section | heading `Fix` only if `remediation.length`; checklist non-interactive boxes (visual) OR real checkboxes local-only (don’t persist server) |
| Copy fixes | copies remediation joined by `\n` |
| Re-scan | fills composer with `@Markets scan again: {endpointUrl}` (no auto-send) |
| Evidence | toggles `<pre>` collapsed raw JSON / `raw` object · max-h 240px scroll |

### B2.4 Loading / error
- While tool in flight: existing `RoomToolChip` / activity run is enough; don’t mount empty card.  
- Parse failure: fall back to default tool result UI + one line “Couldn’t render readiness card”.  

### B2.5 Motion
Optional: checks stagger fade-in 40ms each, ≤800ms total. Prefer CSS only. Reduced-motion: instant.

---

## B3. Component: `TrustCard` — #29

### B3.1 Layout
```
┌──────────────────────────────────────────────┐
│ [NO_GO]  Trust                               │
│ Agent 99999                                  │
│ ──────────────────────────────────────────── │
│ listing_page      fail · HTTP 404            │
│ endpoint_readiness skipped                   │
│                                              │
│ Not checked                                  │
│ [on-chain credit] [settlement vol] […]       │
│                                              │
│ Next: Do not call pay/x402 tools. …          │
│ [Copy next step]                             │
└──────────────────────────────────────────────┘
```

### B3.2 Rules
- Decision chip uses same size as readiness but label GO/CAUTION/NO_GO.  
- `Not checked` = wrap chips `rounded-full bg-inset text-[11px] px-2 py-0.5`.  
- No numeric “trust score” unless product later adds one — **omit**.  
- `safeNextStep` is the footer sentence (from tool); if missing, derive from decision defaults in A2.5.

---

## B4. Transcript integration UX

### B4.1 Authoring
- Card appears under Markets’ tool activity, same column as other agent messages.  
- Show small Markets avatar + name + time (existing message chrome).  
- Do **not** hide the short Markets prose reply if present — card then prose, or prose then card; prefer **card then one-line summary**.

### B4.2 RoomToolChip
Keep chip for the tool name; card is the rich body. Avoid duplicating verdict in chip if card visible (chip can stay generic `scan_free_mcp_readiness`).

### B4.3 1:1 vs Group
Same components in ChatView and GroupView. Group is primary; 1:1 still works for debugging.

---

## B5. Avatar / identity UX — #17

### B5.1 Rules
- Catalog `avatar: "chart"` for Markets, Listing Coach, Spend Scout.  
- `BotAvatar` / `SoftAvatarPlate`: when `avatarCrop === "chart"` or catalog mark, **never** fall through to Cursor/SupaMaus mascot.  
- Room header stack: 24px marks, 2px app-bg ring, overlap.  
- Sidebar room row: show stacked faces or first three initials if overflow.

### B5.2 Visual
- Chart glyph on quiet circular plate (PR #16 soft plate OK if CI fixed; else minimal circle + glyph).  
- Distinct hue wash per bot id via existing `gradientFor` — keep subtle.

---

## B6. Empty / first state for `#dev-day-gate`

When `messages.length === 0`:
1. Bulletin already under header  
2. Centered quiet prompt: `Three agents. One gate — list readiness, then spend trust.`  
3. Four starter chips (A4.3)  
4. No fake assistant history  

After first real message: hide center prompt; chips can move to a single `+ Starters` popover near composer.

---

## B7. Copy deck (UI strings → `en.json`)

Add keys (suggested):
```
devday.room.bulletin
devday.empty.title
devday.chip.scanVercel
devday.chip.scanRailway
devday.chip.trustBad
devday.chip.trust13837
readiness.title
readiness.copyFixes
readiness.rescan
readiness.evidence
trust.title
trust.notChecked
trust.copyNext
gate.badge.freeReadonly
```

All user-visible English first; follow project i18n pattern.

---

## B8. Accessibility
- Verdict not color-only: text inside chip.  
- Buttons focusable, `aria-expanded` on Evidence.  
- Checklist items are listitems; if checkboxes used, label binds.  
- Contrast: chip text on tint must pass existing `check:contrast` if run.

---

## B9. Non-goals (feature/UI)
- Separate Trust dashboard route / analytics charts  
- Scoreboard wall of numbers  
- Trending ASP carousel as home  
- Auto-send chips  
- Wallet connect affordances on these cards  
- Animating all member avatars in the room  

---

## B10. Implementation order (features/UI only)

1. **A1** tool readiness (#23)  
2. **A2** tool trust (#24) — share probe helpers  
3. **B2/B3/B4** cards (#29) parsing real payloads  
4. **A3** catalog agents (#20)  
5. **A4/B6** room seed + empty chips (#30)  
6. **B5** avatar defaults (#17)  

Evidence curls and docs can trail each tool PR; not specified here.

---

## B11. Acceptance (feature/UX)

**Readiness**
- [ ] Tool callable; vercel → FAIL card with host pitfall + fix list  
- [ ] Railway self → PASS/WARN card  

**Trust**
- [ ] NO_GO shows notChecked + safe next step  
- [ ] GO does not claim endorsement  

**Room**
- [ ] Seed creates 3-member room with bulletin + chips  
- [ ] Cards render in group transcript under Markets  

**Identity**
- [ ] No Cursor mascot on the three seats  
