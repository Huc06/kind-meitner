# Kind Meitner Dev Day — Impact + Schedule (detail)

**Timezone:** Asia/Saigon (ICT = UTC+7)  
**Today:** Mon 21 Sep 2026 ~22:10 ICT  
**Hard gate:** Submit form **Fri 25 Sep 2026 23:59 UTC** = **Sat 26 Sep 06:59 ICT**  
**Finale:** Tue 7 Oct 2026 Singapore (only after written finalist mail by ~30 Sep)  
**Track:** Build a Company (OKX AI) · **Route:** Singapore  

**Product intent (locked):** multichat **workbench** — interact + execute (buttons/chips/agent turns). Not JSON theater.  
Sources: `okx-hackathon-interact-execute.md` (intent) · `okx-feature-uiux-spec.md` (fields) · master issue **#31**

---

## 1. Impact — what “good” looks like (show it, don’t claim it)

### 1.1 One-line impact

> Kind Meitner **stops failed OKX listings and dumb first spends** by letting builder + buyer agents **run** readiness and trust gates in one room — with visible refuse/allow.

### 1.2 Who feels impact

| Actor | Pain now (field) | Impact after Kind Meitner | How we **show** it |
| --- | --- | --- | --- |
| ASP builder | Opaque review, vercel.app rejects, 10× resubmit | FAIL→fix→PASS in minutes | Loop A in `#dev-day-gate`: Apply host + Run scan again |
| Buyer agent | Listed ≠ works; pay dead ASP | NO_GO blocks spend; GO allows free call only | Loop B: Block spend → Continue with free tools |
| Other agents (ecosystem) | No shared free gate | Call Free-MCP tools on #13837 | External agent call + same result as room card |
| Judges | Need company, not wrapper | Operable workbench + public ASP | They can tap chips themselves |

### 1.3 Impact metrics (honest — use in README / talk track)

| Metric | Target by submit | How measured |
| --- | --- | --- |
| Time to first FAIL→PASS on bad host | **&lt; 2 minutes** Ops time in room | Stopwatch Loop A |
| Buyer spend blocked on bad id | **1 tap** after NO_GO | Block spend CTA → Scout refuse message |
| Free tool executed only after GO | **1 continuous room scroll** | Trust GO → Continue → tool activity row |
| Public callable tools | `scan_free_mcp_readiness` + `get_asp_trust_card` live | `tools/list` on Railway |
| Seats speaking | ≥3 distinct authors in room | Transcript authors |
| JSON-as-UI | **0** primary screens | Evidence stays collapsed |

**Do not claim:** revenue, mainnet volume, OKX endorsement, live market prices.

### 1.4 Impact storyboard (what appears on screen — execute)

```
BEFORE                         AFTER (in one room)
─────────────────────────      ──────────────────────────────────
Builder guess & pray list  →   FAIL card → Apply host → PASS
Buyer pays unknown ASP     →   NO_GO → Block spend
“Here’s our API JSON”      →   Buttons: Run again / Continue
One bot monologue          →   Coach + Markets + Scout turns
```

### 1.5 Competitive impact (say out loud)

| | Latch402 / Preflight | Signal bots | **Kind Meitner** |
| --- | --- | --- | --- |
| Impact type | Deep paid scan | Noise | **Operating gate for list + spend** |
| Where impact shows | Isolated tool | Chart | **Multichat workbench CTAs** |
| Behavior change | RELEASE/BLOCK code | None | **Host change + refuse pay + free call** |

---

## 2. Schedule — full calendar (ICT)

### 2.1 Milestone map

| When | Milestone | Exit criteria |
| --- | --- | --- |
| **Mon 21 night** | Intent + docs locked | interact-execute + this doc on `main` |
| **Tue 22 (D1)** | Readiness **executes** | #23 on Railway; can run scan from API; start cards stub OK |
| **Wed 23 (D2)** | Trust + room workbench | #24 live; #30 seed; #29 CTAs working for Loop A |
| **Thu 24 (D3)** | Full Loop A+B in room | Coach/Scout (#20), faces (#17), Loop B CTAs; polish |
| **Fri 25 (D4)** | Package freeze AM · **Submit before 06:59 Sat ICT** | Form + links; no new features after freeze |
| **26–30 Sep** | Validation window | Reply OKX &lt;24h if asked |
| **By 30 Sep** | Finalist mail | Travel only after written confirm |
| **7 Oct** | Singapore finale | Live Loop A+B on stage |

### 2.2 Day-by-day — owners & hours

#### Mon 21 Sep (tonight) — DONE / close-out
| Time ICT | Owner | Task |
| --- | --- | --- |
| Done | Grok Bot | Plans on main; #31 tracker; interact-execute intent |
| Tonight | **You** | Confirm Telegram + ASP #13837 dashboard status → comment #18 |
| Tonight | **Hulk** | Read interact-execute + feature-uiux-spec; branch for #23 |

#### Tue 22 Sep — D1 Ship readiness execution
| Time ICT | Owner | Task | Done when |
| --- | --- | --- | --- |
| 09:00–09:15 | You + Hulk | 15-min sync: Loop A only today | Shared checklist |
| 09:15–18:00 | **Hulk** | Implement #23 `scan_free_mcp_readiness` + tests + PR + Railway | tools/list shows tool; self-scan works |
| 14:00–16:00 | Hulk | Human `label` on checks + optional `primaryActions` hints | UI can map without raw ids |
| 16:00–19:00 | Hulk | Start #29 Readiness **action** card: Run scan again + Apply host | Buttons fill composer / re-run |
| 19:00–20:00 | You | Manual: curl scan vercel → expect FAIL; Railway → PASS | Comment results on #23 |
| 20:00 | Grok Bot | Update #31 checkboxes from PR links | Tracker current |

**D1 exit:** Loop A runnable at least via Markets 1:1 or API + card CTAs stubbed.

#### Wed 23 Sep — D2 Trust + workbench room
| Time ICT | Owner | Task | Done when |
| --- | --- | --- | --- |
| 09:00–13:00 | **Hulk** | #24 `get_asp_trust_card` + deploy | GO/NO_GO works |
| 11:00–15:00 | **Hulk** | #30 seed `#dev-day-gate` + chips | Empty room → chip → Send starts scan |
| 13:00–18:00 | **Hulk** | #29 Trust CTAs: Block spend · Continue free tools · Re-check | Loop B buttons live |
| 15:00–18:00 | Hulk | #20 Listing Coach + Spend Scout catalog + prompts (verbs) | Importable seats |
| 18:00–20:00 | **You** | Drive Loop A end-to-end in room (stopwatch) | &lt;2 min FAIL→PASS |
| 20:00 | You | Note #18 listing status | Comment |

**D2 exit:** Loop A complete in room; Loop B at least NO_GO + Block.

#### Thu 24 Sep — D3 Impact polish
| Time ICT | Owner | Task | Done when |
| --- | --- | --- | --- |
| 09:00–12:00 | **Hulk** | Finish Loop B Continue → free tool executes in room | Tool activity after GO |
| 10:00–14:00 | Hulk | #17 OKX chart faces on 3 seats | No Cursor mascot hero |
| 12:00–16:00 | Hulk | Judge README impact section (metrics §1.3) + evidence curls (#26) | Folder exists |
| 14:00–17:00 | **You + Hulk** | Rehearse Loop A+B twice; fix friction | Both loops &lt;3 min each |
| 17:00–20:00 | You | Capture screen recording if you want artifact (optional vs form needs) | Link ready if required |
| 20:00 | Freeze features | No new scope | Only bugfixes Fri |

**D3 exit:** Impact storyboard §1.4 visible in one room scroll.

#### Fri 25 Sep — D4 Submit day
| Time ICT | Owner | Task |
| --- | --- | --- |
| 09:00–11:00 | Hulk | Bugfix only; Railway smoke |
| 09:00–12:00 | **You** | Draft form fields (#25); gather URLs |
| 12:00–15:00 | You | Final Loop A+B once more |
| **15:00–18:00** | **You** | **Submit form** (buffer before 06:59 Sat) |
| 18:00–20:00 | You | Receipt filed; Telegram watch |

**Do not** start new features Friday.

### 2.3 Buffer & slip rules

| If behind by | Cut (in order) | Never cut |
| --- | --- | --- |
| End D1 | Avatar polish (#17), positioning (#28) | #23 tool live |
| End D2 | Soft animations, Evidence drawer | Room chips + Run scan again |
| End D3 | External Codex proof, #16 welcome | Loop A+B CTAs |
| Fri noon still broken Loop A | Submit with API+1:1 Markets + honest README limits | Lying about multichat |

### 2.4 Your calendar blocks (copy to calendar)

- **Tue 22 19:00** — Verify Railway scans  
- **Wed 23 18:00** — Drive Loop A in room  
- **Thu 24 14:00** — Rehearse A+B  
- **Fri 25 15:00** — Submit form  
- **Tue 30 Sep** — Watch finalist email (no travel booking before)

---

## 3. Work package ↔ impact ↔ schedule

| Issue | Impact shown | Schedule slot |
| --- | --- | --- |
| #23 Readiness tool | Scan **executes** | D1 all day |
| #29 Readiness CTAs | Apply host / Run again | D1 PM → D2 |
| #24 Trust tool | Trust **executes** | D2 AM |
| #29 Trust CTAs | Block / Continue | D2 PM |
| #30 Room + chips | Workbench entry | D2 |
| #20 Coach/Scout | Multi-agent impact | D2–D3 |
| #17 Faces | OKX company look | D3 |
| #26 Evidence/README | Impact metrics written | D3 |
| #18 Listing | Public ASP link | ongoing / D2 night check |
| #25 Submit | Official entry | **D4 15:00 ICT** |
| #27 Recording | Optional artifact | D3 eve if needed |
| #28 Positioning | Talk track | anytime spare |
| #16/#15/#14 | Hold | after spine / never #15 pre-submit |

---

## 4. Daily stand-up questions (5 min)

1. Which loop works now — A, B, neither?  
2. What CTA is missing?  
3. Blocker (CI, Railway, ASP, prompt)?  
4. Still on schedule vs §2.2?  

Post answers as a comment on **#31** each evening D1–D3.

---

## 5. Definition of impact-ready (ship bar)

All must be true:

1. Loop A in `#dev-day-gate` with **Apply host** + **Run scan again** (not JSON).  
2. Loop B with **Block spend** + **Continue with free tools** executing a real tool.  
3. Three seats visible.  
4. Public Free-MCP lists both gate tools.  
5. README states honest impact metrics (§1.3) with no revenue/mainnet lies.  
6. Form submitted before deadline with live URLs.

---

## 6. Roles

| Role | Owns |
| --- | --- |
| **Hulk** | Code #23 #24 #29 #30 #20 #17 #26 |
| **You** | ASP #18, Telegram, drive loops, submit #25, calendar |
| **Grok Bot** | Plans, issue hygiene, schedule/impact docs only |

