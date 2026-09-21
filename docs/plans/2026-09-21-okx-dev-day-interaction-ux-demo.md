# Dev Day: Interaction UX + demo (not score theater)

**Why this doc exists:** Build X winners didn’t flash dashboards. They showed **agents calling agents**, evidence moving, then a decision (pay / block / settle). Judges must *see* Kind Meitner change another agent’s next action.

**Depends on:** tools in build-brief (`scan_free_mcp_readiness`, `get_asp_trust_card`)  
**Implementer:** Hulk · **Planner:** Grok Bot  
**Issues:** UX #29 · Demo interaction #27 rewrite · Diff #28

---

## 1. What “winners look like” (interaction pattern)

| Winner pattern | What the camera sees | Our equivalent |
| --- | --- | --- |
| Credit / reputation | Agent A asks score → Agent B returns proof → A proceeds or stops | Buyer agent calls `get_asp_trust_card` → GO/NO_GO → buyer’s *next tool* changes |
| Proof before pay | Work artifact verified before settlement | Builder agent calls `scan_free_mcp_readiness` → FAIL → builder *doesn’t submit* / fixes URL |
| Risk gate | Explicit BLOCK with reason + fix | Verdict card with remediation checklist the agent (or human) executes |
| Onchain receipt | Explorer link after action | For Free path: **evidence JSON + curl transcript**; optional x402 testnet receipt as slide 2 only |

**Anti-pattern (do not demo):** static “score 87” with no second agent reacting. Numbers without a changed next action = fluff.

---

## 2. Product interaction design (3 actors)

```
┌─────────────┐     tools/call      ┌──────────────────────┐
│ Builder     │ ──────────────────► │ Kind Meitner Markets │
│ agent       │ ◄── PASS/FAIL+fix │ Free A2MCP #13837    │
└─────────────┘     remediation     └──────────────────────┘
                                              ▲
┌─────────────┐     tools/call               │
│ Buyer       │ ─────────────────────────────┘
│ agent       │ ◄── GO/CAUTION/NO_GO
└─────────────┘      then buyer calls target ASP *only if GO*
```

### Scene A — Builder gate (primary, 45–60s)
1. Builder agent prepares to register `https://….vercel.app/...`
2. Calls Kind Meitner `scan_free_mcp_readiness`
3. Gets **FAIL** + vercel remediation
4. Switches endpoint to Railway HTTPS
5. Re-scans → **PASS**
6. *Only then* proceeds to listing / keeps under-review fixes  
**Impact visible:** listing pain avoided on camera.

### Scene B — Buyer gate (primary, 45–60s)
1. Buyer agent wants to pay/use ASP X
2. Calls `get_asp_trust_card` for X (and our #13837 as control)
3. Bad/unreachable → **NO_GO** → buyer **does not** call pay tool
4. Good → **GO** → buyer calls the target Free tool  
**Impact visible:** spend blocked or allowed *because of* Kind Meitner.

### Scene C — Ops console (secondary, desktop UI, 20–30s)
Human opens Kind Meitner desktop → Trust / Readiness run appears as a **live activity trail** (not a settings page of numbers). Same JSON the agents got, rendered as cards.

---

## 3. Feature set (interaction-first)

### F1 — Server tools (already briefed)
- `scan_free_mcp_readiness`
- `get_asp_trust_card`  
Must return **actionable remediation** strings an agent can follow, not just codes.

### F2 — “Run card” UX in desktop (new · Issue #29)
When Kind Meitner Markets bot (or any bot) receives/produces a readiness/trust result, render a dedicated card:

**ReadinessRunCard**
- Header: endpoint host + verdict chip (PASS green / WARN amber / FAIL red)
- Timeline of checks (each row = status + one-line detail)
- Remediation as **checklist** (clickable copy; optional “fill composer with fix prompt”)
- Footer: “Evidence” expand = raw JSON / copy curl
- CTA: “Re-scan” → fills composer with a natural-language re-run, *or* triggers tool again if wire exists

**TrustCard**
- Big decision: GO / CAUTION / NO_GO
- Signals row
- Honest `Not checked` chips (kills fake-credit vibe)
- CTA: “Safe next step” text the buyer agent would say (“Call free tool only” / “Do not pay”)

Reuse existing transcript patterns (`activity` / tool result bubbles). Prefer extending message rendering over a separate dashboard route — winners’ demos stayed in the **conversation of work**.

### F3 — Demo room preset (lightweight)
One scripted room or welcome suggestions that *stage* Scene A/B:
- Suggestion chips: “Scan a vercel.app ASP”, “Scan our Railway Free-MCP”, “Trust-check agent 13837”, “Trust-check a broken id”
- Selecting a chip **fills composer** (existing welcome pattern) with a prompt that makes the Markets bot call the right tool

### F4 — External-agent proof strip
Save side-by-side:
- Codex/OpenClaw transcript calling #13837
- Same result rendered in desktop Run card  
Judges see: **protocol surface + human ops console** = complete company, not a toy UI.

---

## 4. UI/UX principles (quiet, high-trust)

- Verdict first, numbers second (score is tiny; decision is huge)
- Every fail has a **fix verb** (“Change host off vercel.app”, “Expose tools/list on HTTPS”)
- Never imply OKX endorsement; provenance line always visible
- Pale/quiet shell (existing PR #16 direction) — cards carry the drama, not chrome
- Motion: check rows reveal top→bottom in <800ms on first paint (optional polish)
- A11y: verdict not color-only (icon + text)

**Wireframes (textual)**

```
┌─ Readiness  FAIL ──────────────────────────┐
│ endpoint  foo.vercel.app                    │
│ ● https_scheme          pass                │
│ ● host_pitfall_vercel   fail  ← spotlight │
│ ● tools_list_http       fail                │
│ Fix                                        │
│ ☐ Use Railway/custom domain (not vercel)   │
│ ☐ Re-scan after DNS propagates             │
│ [ Copy fixes ]  [ Re-scan ]  [ Evidence ]  │
└────────────────────────────────────────────┘

┌─ Trust  NO_GO ─────────────────────────────┐
│ agent  99999                                │
│ listing_page   fail (404)                   │
│ endpoint       skipped                      │
│ Not checked: on-chain credit · revenue      │
│ Next: do not call pay / x402 tools          │
└────────────────────────────────────────────┘
```

---

## 5. Demo script (2–4 min video + live finale)

### Cold open (10s)
“ASP builders lose days to opaque review. Buyers pay agents that aren’t callable. We gate both.”

### Act 1 — Builder interaction (50s)
- Screen A: coding agent / OpenClaw chat  
- Call Kind Meitner Markets via OKX AI / MCP  
- FAIL on vercel → agent pastes remediation → changes URL → PASS  
- Cut to desktop: same run as ReadinessRunCard  

### Act 2 — Buyer interaction (50s)
- Buyer agent trust-checks bad id → NO_GO → refuses pay  
- Trust-checks #13837 + Railway → GO → successfully calls a free tool  

### Act 3 — Why it matters (30s)
- Overlay: Latch402 = paid x402 deep scan · we = **Free-MCP + listing pitfalls + pre-spend gate** other agents install  
- Show evidence folder + ASP link  
- Close: “Infrastructure agents call before list or pay.”

### Live finale notes (3–5 min)
Same acts, slower; keep a **pre-baked FAIL fixture** if wifi dies; never depend on live OKX marketplace search.

---

## 6. Differentiation & impact (say this out loud)

| | Latch402 / Preflight | Signal bots | **Kind Meitner** |
| --- | --- | --- | --- |
| Job | Paid endpoint / release gate | Price spam | **Free listing readiness + pre-spend trust** |
| Who calls | Sellers hardening x402 | Traders | **Builder agents + buyer agents** |
| Visible interaction | Scan → RELEASE/BLOCK | Chart | **Scan → agent changes URL / refuses pay** |
| Dev Day proof | Receipts | Vanity views | **Two-agent loop + ASP #13837 + evidence** |

**Impact claim (honest):** We shorten failed listing loops and stop dumb first spends on dead ASPs — the exact pains builders posted on X (10 rejects, vercel.app, listed ≠ works).

---

## 7. Implementation order (interaction layer)

| Day | Ship |
| --- | --- |
| D1 | Tools (§ build-brief) — without UI still demoable via external agent |
| D1–D2 | Evidence + external agent transcript |
| D2 | **ReadinessRunCard + TrustCard** in chat transcript (#29) |
| D2 | Welcome/demo suggestion chips for Scene A/B |
| D3 | Record video with Act 1–3 (external agent + desktop cards) |
| D4 | Submit |

If time-box cuts UI: **external two-agent demo alone can win** the “interaction” bar; cards are force-multiplier for live Singapore.

---

## 8. Acceptance (“feels like a winner”)

- [ ] Video shows **another agent** calling Kind Meitner and **changing behavior**
- [ ] FAIL→fix→PASS or NO_GO→refuse-pay is on camera
- [ ] Desktop shows the same run as a card, not a spreadsheet
- [ ] No “scoreboard only” segment longer than 5s
- [ ] Pitch never claims live prices / mainnet revenue / OKX endorsement
