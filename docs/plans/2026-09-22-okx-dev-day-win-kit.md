# OKX Dev Day — Win kit (plans + checklist)

**Written:** 2026-09-22 evening ICT · **Tracker:** #31 · **Deadline:** form **25 Sep 2026 23:59 UTC** · Finale **7 Oct Singapore**  
**Track:** Build a Company · **Builder kit:** https://www.okx.com/en-gb/learn/okx-dev-day-builder-kit · **Form:** https://forms.gle/81S2gnFCzqSoeDEA7  

This doc is the **win playbook**: what judges score, what we already shipped, what still blocks a win, and the exact kit to assemble. Features-first; evidence/video/submit after loops.

---

## 1. What “win” means (judging reality)

From Dev Day builder kit + our locked USP:

| Judge lens | What they want | Our answer |
| --- | --- | --- |
| Working product | Other agents can call a live service | Public Free-MCP HTTPS |
| OKX AI / X Layer integration | Real OKX.ai ASP / A2MCP | ASP **#13837** + Free A2MCP endpoint |
| End-to-end workflow | Demo shows new functionality in build window | `#dev-day-gate` room: FAIL→PASS + NO_GO→GO |
| Build-window delta | Work **17–25 Sep** only counts | Commits: readiness, trust, CTAs, room seed, gate UX |
| Not a chatbot theater | Rails other agents install | Tools other agents call — not invite-only |

**USP (one sentence):**  
> Kind Meitner Markets is the **Free-MCP listing readiness + pre-spend trust gate** for OKX.AI — builders/buyers call before list or pay; the desktop room is the ops console.

**Non-wins (do not demo as hero):** fake prices, Cursor mascots, invite-only wow, mainnet/x402 claims, EIP-3009 as settled pay.

---

## 2. Win kit inventory (have / gap)

### A. Live service (required)
| Item | Status 22 Sep | Link / proof |
| --- | --- | --- |
| Free-MCP URL | **HAVE** | `https://kind-meitner-production.up.railway.app/api/okx/free-mcp` |
| `scan_free_mcp_readiness` | **HAVE** | smoke PASS |
| `get_asp_trust_card` | **HAVE** | smoke PASS |
| Provenance flags free/no wallet/no mainnet | **HAVE** | envelope on every tool result |
| ASP listing #13837 | **GAP — HTTP 404** | https://www.okx.ai/agents/13837 · issue **#18** |

### B. Multichat product surface (required for Build a Company story)
| Item | Status | Notes |
| --- | --- | --- |
| `#dev-day-gate` seed | **HAVE** on main | `POST /api/okx/dev-day-gate` |
| Markets + Listing Coach + Spend Scout | **HAVE** | catalog + souls |
| ChartAvatar for OKX imports | **HAVE** | invite + BotAvatar |
| Action cards + CTAs | **HAVE** | Apply / Block / Continue-GO-only / Re-check |
| Last-run + never-invent souls | **HAVE** (#78) | confirm after Railway redeploy |
| Desktop loop proof dump | **GAP** | issue **#66** |

### C. Submission package (required by form; defer until A+B green)
| Item | Issue | Status |
| --- | --- | --- |
| Evidence folder + judge README | #26 / #68 | DEFER drafts #52 |
| 2–4 min room-scroll video | #27 | DEFER draft #54 |
| Positioning vs Latch402 | #28 | DEFER draft #53 |
| Form filled + receipt | #25 | HARD deadline |
| Visual E2E | #56 | DEFER draft #57 |

### D. Noise / closed (not the win path)
Closed as done/dupe: #17 #20 #21 #74. Close draft PRs #42 #49. Do not merge #15 (drops OKX views).

---

## 3. Day plan to win (ICT)

### Tonight–Wed 23 — features + ops
1. **#18** — Publish ASP #13837 until `curl -I` → **200** (or document rejection + resubmit).  
2. **#66** — Desktop: seed room → 4 starters → screenshots Loop A + Block + Continue-on-GO.  
3. Close PRs **#42/#49**.  
4. Re-run `bash scripts/dev-day-gate-smoke.sh` after any Railway deploy.

### Thu 24 — package (only after #66 green or honest fallback VO)
1. Evidence pack (#26): curl PASS/FAIL/trust transcripts → `docs/evidence/dev-day/`.  
2. Record 2–4 min **room scroll** video (#27) — camera never leaves `#dev-day-gate`.  
3. Short positioning one-pager (#28) if spare.

### Fri 25 before 23:59 UTC — submit
1. Fill form (#25) with: pitch USP, repo, video, Railway URL, ASP link (or Railway + “under review”), build-window delta 17–25 Sep.  
2. Keep receipt; watch Telegram 24h SLA.

### 7 Oct finale
Live 3–5 min: same room script, slower; external agent calling Free-MCP optional wow.

---

## 4. Demo script (win kit VO)

**≤90s cut / 3–5 min finale**

1. **Problem (10s):** ASP listings die on vercel.app / broken free shape; buyers almost pay blind.  
2. **Room (5s):** Open `#dev-day-gate` — Markets / Coach / Scout, chart marks.  
3. **Loop A (30s):** Scan vercel → FAIL card → Apply host → Re-check → PASS + last-run.  
4. **Loop B (30s):** Trust 99999 → NO_GO → Block. Trust 13837 + Railway → GO → Continue free tool.  
5. **Close (10s):** “Other agents call the same Free-MCP; desktop is the gate console.”

If 13837 still 404: end Loop B on Block + say listing under review; optionally show GO mechanics on a **public** agent id with clear VO that it is not our ASP.

---

## 5. Fake-demo reject list (from easy plan)

1. Hardcoded PASS/GO.  
2. Button that only changes color (no new turn/tool).  
3. Seeded finished chat without tool activities.  
4. GO when listing 404.  
5. Live price / mainnet / wallet claims.

We already verified production does **not** GO on 13837 while 404 — keep that honesty.

---

## 6. Build-window talking points (17–25 Sep)

Ship story for judges (from recent merges):

- Free-MCP readiness scanner + private-DNS hardening  
- ASP trust card  
- Action-card CTAs (Apply / Block / Continue / Re-check)  
- `#dev-day-gate` room seed + catalog Coach/Scout  
- Gate UX last-run + never-invent mention routing  
- CI stabilizers so the spine could land  

Listing-only without these tools is **not** enough per builder kit.

---

## 7. Issue hygiene (audit summary)

| Bucket | Issues |
| --- | --- |
| Critical path | #18 · #66 · #31 · #25 |
| Defer package | #68 · #26 · #27 · #28 · #56 |
| Scale (post) | #72 · #73 · #75 · #76 · #77 |
| Park / low | #19 · #45 · #13 · #2 · #8 · #9 · #10 |
| Closed done/dupe | #17 · #20 · #21 · #74 |

Nothing random-tào-lao left open; #18 was the main stale lie (said 200, was 404) — corrected.

---

## 8. Owner split

| Who | Owns |
| --- | --- |
| **Hulk** | #66 desktop proof · close #42/#49 · any leftover feature bugs |
| **Ops / you** | #18 ASP publish · #25 form · video approve · Telegram |
| **This bot** | Planning/verify/comments only unless explicitly asked to code |

---

## 9. Definition of “ready to submit”

- [ ] Smoke PASS on Railway  
- [ ] #66 desktop loops evidenced (or written honest fallback)  
- [ ] #13837 HTTP 200 **or** form uses Railway + under-review note  
- [ ] Evidence folder + video link + repo README  
- [ ] Form submitted + receipt saved  
- [ ] Zero fake-demo / mainnet claims in VO and listing copy
