# Feature + UI/UX show — long form: no bugs, CI gates, no mock / fake demo

**Scope ONLY:** features, UI/UX show, automated + manual verification so production cannot ship mocks or silent bugs.  
**Not in this doc:** Telegram, submit forms, prize schedule, marketing.

**Companion shorter doc:** `2026-09-21-okx-feature-uiux-show-verify.md`  
**This doc adds:** CI required tests, bug matrix, UI state machines, race/double-click, SSRF, parse failures, anti-mock grep gates.

**PR policy for Hulk:** A PR that adds F1–F4 is **not mergeable** until the CI sections below are green for the touched packages. Decorative UI without the CI tests = reject.

---

# 0. Definitions

| Term | Meaning |
| --- | --- |
| **Live tool call** | JSON-RPC `tools/call` handled by Free-MCP server path that performs real outbound I/O when the check requires it (or deterministic host-rule FAIL without network, e.g. vercel hostname) |
| **Action card** | Transcript UI bound to a **specific tool result message id**; re-renders only when that payload changes |
| **CTA execute** | Click causes new store message / new tool activity / composer mutation that can be asserted in tests — not CSS-only |
| **Mock / demo sai** | Hardcoded verdict, seeded transcript without activities, `DEMO_FORCE_*`, stub `/free-mcp` in prod, client inventing PASS |

---

# 1. Feature inventory (runtime)

## 1.1 F1 — `scan_free_mcp_readiness`

### Contract
- Method path: existing `POST /api/okx/free-mcp`
- Name exact string `scan_free_mcp_readiness`
- Description starts with `Free resource:`
- Annotations: `readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: false`
- Input: `{ endpointUrl: string, agentId?: string }` additionalProperties false

### Algorithm (no shortcuts)
1. If `endpointUrl` missing/empty → MCP error (`isError`), no `data.verdict`
2. Trim URL; parse with `URL` constructor; on throw → FAIL check `https_scheme` (or error — pick one and test it; prefer structured FAIL with remediation)
3. If protocol !== `https:` → FAIL `https_scheme`
4. If hostname is `vercel.app` or ends with `.vercel.app` → FAIL `host_pitfall_vercel` **before** outbound fetch (deterministic; CI-friendly)
5. SSRF allowlist/blocklist (see §3.3): if blocked → FAIL or error with clear detail (never hang)
6. Else POST `{"jsonrpc":"2.0","id":"km-scan","method":"tools/list"}` with `Content-Type: application/json`, timeout 8000ms, redirect max 3
7. Map status → `tools_list_http` / `no_accidental_402`
8. Parse JSON-RPC tools array → `tools_list_shape`
9. Soft initialize optional
10. Aggregate verdict per earlier rules; build `remediation[]` from library; include `label` human strings on each check

### Bug risks → required behavior

| Bug | Required behavior | CI |
| --- | --- | --- |
| Hang on dead IP | AbortSignal 8s; verdict FAIL or error, never open socket forever | fake timer or mock fetch delay >8s |
| SSRF to 169.254.169.254 | Blocked before fetch | unit test blocked host |
| Double JSON encode | `content[0].text` parses once to `{resource,data}` | parse test |
| Breaking old tools | tools/list still contains prior 5 names | extend existing discovery test |
| Payment headers on free call | Still 200 free envelope | mirror existing payment-header test |
| Empty remediation on vercel FAIL | Must include vercel string | string match |
| Client shows PASS while server FAIL | Card bound to payload.verdict only | UI test |

---

## 1.2 F2 — `get_asp_trust_card`

### Contract
- Name `get_asp_trust_card`
- Input `{ agentId: string, endpointUrl?: string }`
- Output `decision` ∈ `GO|CAUTION|NO_GO`; `notChecked` length ≥ 3; `safeNextStep` non-empty string

### Algorithm
1. Missing agentId → isError  
2. GET `https://www.okx.ai/agents/{encodeURIComponent(agentId)}` timeout 8s → `listing_page`  
3. If endpointUrl → run shared readiness helper → map to `endpoint_readiness`  
4. Decision matrix (same as feature-uiux-spec)  
5. Never invent credit/revenue fields  

### Bug risks

| Bug | Required | CI |
| --- | --- | --- |
| GO on 404 listing | Impossible if listing_page fail | mock 404 → NO_GO |
| Client upgrades NO_GO→GO | Forbidden | UI test: button doesn’t mutate decision |
| Missing notChecked | Reject response shape | schema expect |
| SSRF via endpointUrl | Same blocker as F1 | shared helper tests |

---

## 1.3 F3 — Action cards (UI)

### Binding rules (anti-bug)
- Card receives `messageId` + parsed `data` from **that** message only  
- When a newer tool result arrives, render a **new** card instance (new message id) — do not overwrite previous card’s verdict in place without key change  
- React `key={messageId}` required  

### CTA semantics

#### Run scan again
1. Read `data.endpointUrl` from card props  
2. Either: (A) `setComposerDraft` with `@Markets` + URL instruction and focus textarea, or (B) dispatch room send that invokes Markets tool  
3. Must not call `setState({ verdict: 'PASS' })` locally  

#### Apply suggested host
1. Prefer remediation line containing Railway/custom domain; fallback constant production Free-MCP URL from config/env **display only** (same URL Markets uses)  
2. Fill composer with concrete `https://…` string  
3. Do not mark host “applied” until user Send creates a message  

#### Block spend
1. Fill or send Scout-facing refuse text including agentId  
2. Assert new message in store  

#### Continue with free tools only
1. Only enabled when `decision === 'GO'` or `CAUTION` (product choice: enable on GO only is safer — **require GO**)  
2. On GO: invoke/call path that results in `tools/call` `get_free_a2mcp_launch_checklist` (or documented free tool)  
3. Disabled + aria-disabled on NO_GO  

#### Re-check agent
1. New trust tools/call with same agentId (+ endpoint if any)  

### UI state machine — Readiness card

```
idle_hidden
  → (tool activity in flight for scan) show ActivityRun/chip only
  → (tool success + parse ok) show_card(verdict)
  → (tool success + parse fail) show_raw_tool_error (no decorative card)
  → (CTA Run/Apply) composer_dirty | new_activity (not verdict_local_mutate)
```

### UI state machine — Trust card

```
idle_hidden → activity → show_card(decision)
  NO_GO: primary=Block, Continue disabled
  GO: primary=Continue, Block still available
  CAUTION: primary=Re-check or Block; Continue optional disabled (prefer disabled)
```

### Double-click / race
- CTA buttons: disable for 500ms after click OR ignore re-entry while `toolInFlight` for that bot  
- Do not enqueue 5 parallel scans from spam clicks (server also caps concurrency ≤4)

### A11y bugs to avoid
- Verdict color-only → always text inside chip  
- Button without name → aria-label on icon-only  
- Evidence toggle → aria-expanded  

---

## 1.4 F4 — Room seed + chips

### Seed idempotency
- Lookup existing group by name `#dev-day-gate` (or normalized) in section `Dev Day`  
- If exists: select it, return id — **do not** create duplicate rooms  
- If missing members: add missing catalog bots then patch memberIds (don’t orphan)

### Chip behavior
- onClick → `setComposerDraft(groupId, text)` only  
- Do not `dispatch send` automatically (prevents accidental spam in CI). Show helper text: “Enter to send”  
- Chip texts must include URL/agentId literals that F1/F2 understand  

### Empty state bugs
- After first real message (`messages.length > 0`), hide center empty hero; chips move to overflow “Starters”  
- Do not re-show empty hero when scrolling  

---

## 1.5 F5 — Catalog Coach / Scout

### Prompt bugs
- Must not claim “I scanned” without tool  
- Must not output fake JSON envelope as user-visible truth  
- On NO_GO must include refuse-pay language when asked to pay  

### Import bugs
- Catalog id stable (`okx-listing-coach`, `okx-spend-scout`)  
- Re-import doesn’t duplicate bots with new ids every time (match existing import dedupe patterns)

---

## 1.6 F6 — Avatars
- `avatar: "chart"` never falls through to mascot  
- Pure UI; no runtime truth dependency  

---

# 2. CI REQUIREMENTS (mandatory for merge)

CI already runs `pnpm typecheck` + `vitest run` on ubuntu/mac/windows (`.github/workflows/ci.yml`).  
New work must add tests that fail if mocks regress.

## 2.1 Server — extend `server/okx/free-mcp.test.ts`

Add a nested `describe("Dev Day gate tools", …)` using the same `launchVerificationServer` fixture.

### Required cases (names indicative — keep stable)

1. **`lists scan_free_mcp_readiness and get_asp_trust_card as Free resource`**  
   - tools/list contains both names  
   - description includes `Free resource`  
   - annotations match read-only triple  

2. **`scan self fixture URL returns PASS or WARN without throwing`**  
   - call F1 with `endpointUrl: ${baseUrl}/api/okx/free-mcp`  
   - parse envelope; verdict in `PASS|WARN`  
   - `checks` is non-empty array  
   - `resource.paymentRequired === false`  

3. **`scan vercel.app host returns FAIL with remediation (no network required)`**  
   - `https://something.vercel.app/api/x`  
   - verdict `FAIL`  
   - some check id `host_pitfall_vercel` status fail  
   - remediation joined string matches `/vercel\.app/i`  

4. **`scan missing endpointUrl is MCP error`**  
   - `isError` or jsonrpc error; no silent PASS  

5. **`scan http:// URL fails https_scheme`**  
   - verdict FAIL or error; not PASS  

6. **`scan blocked SSRF host does not call fetch`** (inject mock fetch spy)  
   - `http://127.0.0.1/...` or `http://169.254.169.254/` rejected  
   - fetch spy not called **or** called 0 times for that URL  

7. **`scan respects timeout`** (mock fetch hang)  
   - resolves within test timeout budget with FAIL/error  

8. **`trust missing agentId errors`**  

9. **`trust agentId with mocked listing 404 → NO_GO`**  
   - mock global fetch for okx.ai agents path  

10. **`trust 13837-shaped id + self endpoint not NO_GO from empty stub`**  
    - listing mock 200 + self endpoint → decision `GO|CAUTION`  

11. **`trust payload always includes notChecked length >= 3 and safeNextStep`**  

12. **`payment-looking headers still free on F1/F2`**  
    - mirror existing checklist payment header test  

13. **`legacy free tools still listed`**  
    - arrayContaining previous three/five names  

### Mock policy inside CI
- **Allowed:** mock **outbound** `fetch` for third-party hosts (okx.ai, hung servers, SSRF targets)  
- **Allowed:** deterministic vercel hostname FAIL without DNS  
- **Forbidden:** mock the Free-MCP **handler** to return PASS for all inputs  
- **Forbidden:** `vi.spyOn(intelligence, 'handleFreeMcpToolCall').mockResolvedValue(fakePass)` in tests that claim integration  

---

## 2.2 Anti-mock grep gate (CI script or test file)

Add `server/okx/dev-day-no-mock.guard.test.ts` (or scripts check run from vitest):

```ts
// Pseudocode requirements — implement as filesystem read tests
const banned = [
  /DEMO_FORCE_PASS/,
  /DEMO_FORCE_GO/,
  /FAKE_READINESS_VERDICT/,
  /mockPassAlways/,
  /alwaysReturnPass/,
];
// Scan server/okx/**/*.ts excluding *.test.ts for banned patterns → expect zero
```

Also ban in `src/**` production components (exclude stories/tests):
- `verdict: "PASS"` object literals in card defaultProps that render without props  
- `decision: "GO"` defaults that show Continue enabled with empty props  

---

## 2.3 UI unit tests (new files)

Suggested:
- `src/components/ReadinessRunCard.test.ts`  
- `src/components/TrustCard.test.ts`  
- `src/lib/dev-day-gate.test.ts` (seed idempotency, chip strings)

### Required UI cases

**ReadinessRunCard**
1. Renders FAIL chip when props.verdict=FAIL (from props — simulating parsed server data)  
2. Does not render decorative PASS when props missing/invalid — shows fallback or null  
3. **Run scan again** calls provided `onRescan(endpointUrl)` once  
4. Double-click calls `onRescan` once (guard)  
5. **Apply suggested host** calls `onApplyHost` with https URL string  
6. Check rows render `label` if present else mapped id — never invent extra pass rows beyond props.checks  

**TrustCard**
1. NO_GO disables Continue (`disabled` attribute)  
2. GO enables Continue  
3. Continue click invokes `onContinueFreeTools`  
4. Block invokes `onBlockSpend`  
5. Decision text content includes `NO_GO` / `GO` (a11y)  

**Seed / chips**
1. Second seed returns same group id  
2. Chip strings contain `vercel.app` / Railway host / `99999` / `13837` literals  

### Optional but recommended
- GroupView integration test: given a tool success message with F1 payload JSON in content, card mounts once  

---

## 2.4 Typecheck / lint
- `pnpm typecheck` clean for new files  
- No `any` escape on card props — define `ReadinessData` / `TrustData` types shared from `shared/` or `src/lib/okx-gate-types.ts`  
- Prefer zod/parse helper `parseReadinessPayload(text): Result<>` used by UI and tests  

---

## 2.5 What CI does **not** need for this scope
- Full Electron e2e of Loop A (nice later)  
- Real network to okx.ai in CI (mock listing)  
- iOS/Android avatar tests  

---

# 3. Deep bug matrix (manual + automated)

## 3.1 Server

| ID | Scenario | Expect | Auto? |
| --- | --- | --- | --- |
| S1 | vercel host | FAIL + remediation | CI #3 |
| S2 | self free-mcp | PASS/WARN | CI #2 |
| S3 | http URL | FAIL scheme | CI #5 |
| S4 | 402 on tools/list | FAIL no_accidental_402 | CI mock fetch 402 |
| S5 | 500 on tools/list | FAIL http | CI mock |
| S6 | invalid JSON body from target | FAIL shape | CI mock |
| S7 | tools: [] | WARN or FAIL shape (document choice; test it) | CI |
| S8 | timeout | FAIL/error &lt; test limit | CI #7 |
| S9 | 127.0.0.1 | block SSRF | CI #6 |
| S10 | ::1 / localhost name | block | CI |
| S11 | metadata IP | block | CI |
| S12 | huge body 10MB | truncate/reject; no OOM | CI mock |
| S13 | concurrent 10 scans | no crash; queue/cap | stress optional |
| S14 | payment headers on F1 | still free | CI #12 |
| S15 | unknown tool name | existing error path | already |
| S16 | trust 404 | NO_GO | CI #9 |
| S17 | trust 200 + endpoint FAIL | NO_GO | CI |
| S18 | trust 200 + endpoint PASS | GO | CI #10 |
| S19 | trust 200 + no endpoint | CAUTION | CI |
| S20 | agentId with spaces | trim or error | CI |

## 3.2 UI

| ID | Scenario | Expect | Auto? |
| --- | --- | --- | --- |
| U1 | parse fail | no fake card | CI |
| U2 | verdict FAIL paint | chip FAIL | CI |
| U3 | rescan CTA | callback once | CI |
| U4 | apply host | https in callback | CI |
| U5 | continue on NO_GO | disabled | CI |
| U6 | continue on GO | fires handler | CI |
| U7 | two tool messages | two cards keys | CI/integration |
| U8 | spam click rescan | one in-flight | CI |
| U9 | empty room chips | fill composer only | CI |
| U10 | seed twice | one room | CI |
| U11 | reduced motion | no crash | manual |
| U12 | dark theme | contrast ok | manual / contrast script if exists |
| U13 | long URL | truncate + title tooltip | CI |
| U14 | missing remediation | hide Fix section | CI |

## 3.3 SSRF blocklist (implement explicitly)

Block fetch when hostname resolves to or URL host is:
- `localhost`, `*.localhost`
- `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
- `169.254.0.0/16`, `::1`, `fc00::/7`, `fe80::/10`
- Prefer block by parsed hostname **and** resolved IP if DNS used  

Allow: public Railway host, public https endpoints under test.

---

# 4. Shared parse module (prevent UI/server drift bugs)

Create `parseGateToolResult(text: string)`:

```
ok ReadinessViewModel | TrustViewModel
err { reason: 'invalid_json' | 'missing_data' | 'bad_enum' }
```

Rules:
- Accept only enums for verdict/decision  
- Coerce missing checks to `[]` (then UI shows empty — not invented passes)  
- Reject if `resource.paymentRequired === true` for these tools (should never happen — surface error UI)

UI and tests import the same parser — **single source of truth**.

---

# 5. UI/UX show layouts (canonical — action first)

## 5.1 Readiness
(Same as show-verify PART3 — verdict → human checks → Fix → **Apply / Run again / Copy**)

## 5.2 Trust
(Verdict → signals → Not verified chips → Next → **Block / Continue / Re-check**)

## 5.3 Room empty
Bulletin · title · 4 chips · no fake history

## 5.4 Show path (human QA script)
1. tools/list curl both names  
2. curl vercel FAIL / self PASS  
3. Room chip vercel → Send → activity → FAIL card  
4. Apply → Send → Run again → PASS card · **two activity rows**  
5. Trust 99999 → NO_GO → Block → new message  
6. Trust 13837 GO → Continue → **free tool activity name visible**  
7. Confirm Evidence collapsed by default  

Any step skipped with a stub = **demo sai**.

---

# 6. PR checklist (Hulk — paste into PR body)

```markdown
## Feature / UI show
- [ ] F1 scan_free_mcp_readiness on Free-MCP
- [ ] F2 get_asp_trust_card on Free-MCP
- [ ] F3 action cards + CTAs (no local verdict mutate)
- [ ] F4 room seed idempotent + chips fill only
- [ ] F5 catalog Coach/Scout (if in PR)
- [ ] F6 chart avatars (if in PR)

## CI
- [ ] free-mcp Dev Day gate describe cases (§2.1) green
- [ ] no-mock guard test green (§2.2)
- [ ] ReadinessRunCard + TrustCard unit tests (§2.3) green
- [ ] pnpm typecheck green

## Anti-demo-sai
- [ ] No DEMO_FORCE_* 
- [ ] CTA creates new activity/message (describe how tested)
- [ ] Continue disabled on NO_GO
- [ ] Vercel FAIL deterministic in CI without live vercel
```

---

# 7. File manifest

| Path | Purpose |
| --- | --- |
| `server/okx/intelligence.ts` | F1 F2 + SSRF helper |
| `server/okx/free-mcp.test.ts` | §2.1 cases |
| `server/okx/dev-day-no-mock.guard.test.ts` | §2.2 |
| `src/lib/okx-gate-types.ts` | types |
| `src/lib/parse-gate-tool-result.ts` | §4 parser |
| `src/components/ReadinessRunCard.tsx` | F3a |
| `src/components/TrustCard.tsx` | F3b |
| `src/components/ReadinessRunCard.test.ts` | §2.3 |
| `src/components/TrustCard.test.ts` | §2.3 |
| `src/lib/dev-day-gate.ts` | seed + chip strings |
| `src/lib/dev-day-gate.test.ts` | idempotency |
| Wire in `GroupView.tsx` / `ChatView.tsx` | mount cards |
| `server/okx/agent-import.ts` | F5 catalog |
| `docs/free-a2mcp-asp.md` | mention tools |

---

# 8. Explicit non-goals (bugs from scope creep)
- Mock marketplace prices for show  
- Auto-send chips in production  
- Client-side “simulate scan” without server  
- Merging PR #15 that drops OKX surfaces mid-flight  
- Treating Evidence JSON as the show  

---

# 9. Relationship to other docs
- **Intent (buttons not JSON):** `okx-hackathon-interact-execute.md`  
- **Field tables:** `okx-feature-uiux-spec.md`  
- **Short verify:** `okx-feature-uiux-show-verify.md`  
- **This doc wins for CI + bug bars.** If short verify conflicts with CI section, **CI section wins**.

---

# 10. Definition of done (feature + UI show)

Done when:
1. All §2.1–2.3 tests exist and pass in CI on the PR  
2. Manual §5.4 smoke passes on Railway + desktop room  
3. No banned mock strings in production paths  
4. Loops A/B execute with new activity ids — verified once by you or Hulk with message ids noted on the PR  

Not done when: “looks right in Storybook” / “JSON sample in docs” / “hardcoded card screenshot”.
