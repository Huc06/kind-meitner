# Hackathon clarification: Interact + Execute (not JSON theater)

**For:** product owner + Hulk  
**This doc supersedes** any reading of the feature spec that sounds like “show the JSON-RPC envelope on screen.”  
**Wire format still exists** (Free A2MCP must return structured data for *agents*). **Humans and room agents never primary-view that envelope.**

---

## 1. What you actually want (stated plainly)

You are building for **OKX Dev Day / Build a Company** — a hackathon where winners look like **working companies other agents plug into**, not API docs.

What you want Kind Meitner to be:

> A **multichat workbench** where Builder, Markets, and Buyer **do the gate work live**: paste a URL, run a scan, hit fail, apply a fix, re-run, trust-check an ASP, refuse or allow the next call — with UI that is **buttons, chips, checklists, and agent turns**, not a pretty print of `{ resource, data }`.

What you do **not** want:

- A demo that opens DevTools / expands “Evidence JSON”
- Cards whose main content is an envelope schema
- “Feature A / Feature B” slides
- Score theater without a changed next action
- Invite/trending as the hero if nothing executes

**Envelope JSON = machine contract on the wire.**  
**Interact + execute = product.**

---

## 2. One sentence product

**Kind Meitner Markets is the listing + spend gate other OKX agents run inside a shared room — you execute scans and trust checks; the room shows decisions and next actions.**

---

## 3. Who interacts (three seats, one room)

| Seat | Who | What they *do* (verbs) |
| --- | --- | --- |
| **You (Ops)** | Human | Seed room, tap starter chips, approve obvious next steps, unstick |
| **Listing Coach** | Builder agent | Propose URL, ask for scan, **apply host fix in chat**, request re-scan |
| **Markets** | Gate ASP (#13837 tools) | **Execute** readiness / trust tools; post **action cards** |
| **Spend Scout** | Buyer agent | Ask trust, **refuse pay** on NO_GO, **proceed to call free tool** on GO |

If only Markets talks and Coach/Scout are silent, the product failed the hackathon bar.

---

## 4. What “execute” means in the UI (concrete controls)

Every important state exposes **at least one primary action** that changes system state or the next message — not “view JSON.”

### 4.1 Readiness action card (after a scan runs)

**Shows people:**
- Big verdict: FAIL / WARN / PASS  
- Plain host (e.g. `demo.vercel.app`)  
- 3–6 check rows in human words (“Vercel host blocked by OKX test env”) — **not** check ids like `host_pitfall_vercel` as the headline  
- **Fix list** as actionable lines  

**Execute controls (required):**

| Control | What it executes |
| --- | --- |
| **Apply suggested host** | Fills composer for Listing Coach / you with a corrected Railway HTTPS URL template (or copies the exact remediation line into an @Listing Coach message). Prefer one-tap fill. |
| **Run scan again** | Fills (or directly queues) `@Markets` to scan the **current** URL again — same as re-executing the tool. Must not require opening raw tool UI. |
| **Copy fix for Coach** | Copies a ready `@Listing Coach …` message into clipboard |
| Evidence (secondary, collapsed) | Optional advanced; **default collapsed**; never the first thing visible |

**Failed product:** card that only says `verdict: FAIL` + expandable JSON.

### 4.2 Trust action card (after trust runs)

**Shows people:**
- Big decision: GO / CAUTION / NO_GO  
- One sentence summary  
- “Not verified” chips in plain language (credit, settlements, endorsement)  

**Execute controls (required):**

| Control | What it executes |
| --- | --- |
| **Block spend** (on NO_GO/CAUTION) | Fills `@Spend Scout` with explicit refuse-pay instruction / pins next step |
| **Continue with free tools only** (on GO/CAUTION) | Fills `@Spend Scout` or `@Markets` to call a **safe free** tool (e.g. launch checklist) — demonstrates proceed |
| **Re-check agent** | Re-executes trust on same agentId (+ endpoint if known) |

**Failed product:** decision enum with no button that changes the buyer’s next act.

### 4.3 Room starter chips (before anything ran)

Tapping a chip **executes a conversation move** (fill composer with a full @-routed instruction). Optionally **Send** if you add an explicit “Send” on the chip row — default = fill only so Ops stays in control; hackathon preference: **Fill + focus send** so one Enter executes the turn.

Chips are not documentation links.

### 4.4 Listing Coach / Spend Scout turns

These agents must **emit executable talk**:
- Coach: “I’ll switch the host to Railway — Markets, scan this next: `https://…`”  
- Scout: “NO_GO — I will not recommend pay. Markets, call `get_free_a2mcp_launch_checklist` only if GO.”  

Prompts in catalog (#20) are written for **verbs**, not “summarize the JSON.”

---

## 5. End-to-end interactive loop (what happens on screen)

This is the product loop judges should be able to **drive**, not watch as a recording script only.

### Loop A — List gate (interact)

1. Ops opens `#dev-day-gate` (seeded room).  
2. Ops taps chip **Scan vercel URL** → composer fills with @Listing Coach / @Markets instruction → Ops hits Send.  
3. Listing Coach narrates intent → Markets **executes** scan tool.  
4. **Action card FAIL** appears (vercel).  
5. Ops (or Coach) taps **Apply suggested host** → composer gets Railway URL message → Send.  
6. Tap **Run scan again** (or Coach asks) → Markets executes again → **PASS** card.  
7. Visible outcome: host changed + second execution — not a JSON diff.

### Loop B — Spend gate (interact)

1. Chip **Trust bad id** → Send.  
2. Spend Scout asks → Markets executes trust → **NO_GO** card.  
3. Tap **Block spend** → Scout confirms refuse in chat.  
4. Chip **Trust #13837** → **GO** card.  
5. Tap **Continue with free tools only** → Markets/Scout **executes** a free tool call in-room.  
6. Visible outcome: buyer behavior changed twice.

### Loop C — External agent (protocol proof, still execute)

An outside Codex/OpenClaw calls the same Free-MCP tools. That proves L1.  
**Hackathon wow still returns to the room** where humans execute loops A/B. External call is backup proof, not the main UX.

---

## 6. Reframe of layers (so Hulk doesn’t build the wrong thing)

| Layer | Build | User-facing? |
| --- | --- | --- |
| Free-MCP JSON envelope | Yes — agents/parsers | **No** as primary UI |
| Check ids (`host_pitfall_vercel`) | Yes — in data | Map to **human labels** in UI |
| Action cards | Yes | **Yes — hero** |
| Composer fill / re-run / block / continue buttons | Yes | **Yes — hero** |
| Multichat turns | Yes | **Yes — hero** |
| Raw Evidence drawer | Optional | Hidden by default |

The earlier `okx-feature-uiux-spec.md` remains useful for **field contracts and SSRF**.  
**This doc wins on product intent:** if a conflict appears (“show envelope” vs “execute”), **execute wins**.

---

## 7. UI copy rules (hackathon tone)

- Prefer: “Blocked: Vercel hosts aren’t accepted in OKX listing tests”  
- Avoid: “`host_pitfall_vercel`: fail” as the only line  
- Prefer button: **Run scan again**  
- Avoid button: **View payload** as primary  
- Prefer: **Continue with free tools only**  
- Avoid: **Download result JSON**

---

## 8. What Hulk should implement differently (delta on #29/#30)

Update issues conceptually:

1. **#29 cards = action panels**  
   - Primary CTAs mandatory (tables in §4)  
   - Humanized check labels  
   - Evidence collapsed  
   - Parsing envelope is fine **internally**

2. **#30 room = workbench**  
   - Chips + optional one-tap send affordance  
   - Seed must leave you one Enter away from Loop A  

3. **#20 prompts = verbs**  
   - Coach/Scout instructed to request re-scan / refuse pay / call free tool — not “explain the schema”

4. **#23/#24 tools**  
   - Still return structured data (agents need it)  
   - Add optional `humanSummary` string per check/decision to make UI mapping trivial  

Suggested additive fields (non-breaking):
```json
"checks": [{ "id": "host_pitfall_vercel", "status": "fail", "detail": "…", "label": "Vercel host not allowed for OKX listing tests" }]
"decisionLabel": "Do not spend"
"primaryActions": [{ "id": "rescan", "label": "Run scan again" }, { "id": "apply_host_fix", "label": "Apply Railway HTTPS host" }]
```
UI may hardcode actions if server omits `primaryActions`; server hints are nice-to-have.

---

## 9. Acceptance = interactivity (replace “JSON looks right”)

Pass only if:

- [ ] From empty room, Ops can complete Loop A with **taps + Enter** (≤ few messages)  
- [ ] FAIL card offers **Apply host** + **Run scan again** and both change the next execution  
- [ ] NO_GO card offers **Block spend** and Scout’s next message refuses pay  
- [ ] GO path offers **Continue with free tools** and a **real tool runs** in the room after  
- [ ] At no point is expanded JSON the only way to understand the result  
- [ ] Three seats speak; not a single bot monologue with a JSON blob  

---

## 10. Longer “why this wins the hackathon”

Build X winners were **rails** — credit, proof, risk — that **other agents call**, then behavior changes.  

Your wedge:

1. **Protocol:** Free-MCP readiness + trust (what agents call).  
2. **Company UX:** Kind Meitner **room** where those gates are **operated** — clickable, multi-agent, visible refuse/allow.  

Latch402 may scan deeper on paid x402 in isolation.  
You win the **company** track by showing the **operating surface**: multichat gate that executes list/spend decisions.

JSON envelopes without execution = infrastructure demo.  
**Interact + execute in a room = company demo.**

---

## 11. Issue mapping (product language)

| Issue | Build in product language |
| --- | --- |
| #23 | Markets can **run** a list-readiness scan |
| #24 | Markets can **run** a pre-spend trust check |
| #29 | Results become **action cards** (run again / apply fix / block / continue) |
| #30 | **Workbench room** with chips that start loops |
| #20 | Coach/Scout **execute conversational moves** |
| #17 | Seats look like OKX agents in that workbench |

Out of this doc: video file, form submit, calendar.
