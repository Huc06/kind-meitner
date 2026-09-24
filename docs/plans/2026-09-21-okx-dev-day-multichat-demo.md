# Dev Day stage: **Multichat room** (not A/B tool theater)

**Intent:** Judges watch **one Kind Meitner channel** where several OKX-imported agents talk to each other. Readiness + trust are *what they say and do in the room*, not a separate “Tool A / Tool B” slideshow.

**Reuse:** existing `Group` / room (`memberIds`, turns, activity) + OKX agent import + Free A2MCP tools.  
**Do not rebuild** invite-to-trending as the hero; keep Free readiness/trust as the job.

Companion: interaction-ux-demo.md · build-brief.md

---

## 1. Why multichat is the product surface

Build X winners looked like **coordination**: agent asks → another answers with proof → a third acts.  
Kind Meitner already has that UI: **Channels / rooms** with multiple bots, handoffs, activity rows, Team map.

| Weak demo | Strong demo |
| --- | --- |
| Open Markets 1:1 → call tool → show JSON | Open **#dev-day-gate** room → Builder posts URL → Markets replies FAIL card → Builder posts fixed URL → Markets PASS → Buyer asks trust → Markets NO_GO/GO → Buyer posts “calling target ASP” |
| “Feature A and feature B” | One continuous **group transcript** |

A/B tools stay on the **wire** (`scan_free_mcp_readiness`, `get_asp_trust_card`). The **show** is the room.

---

## 2. Demo room roster (3 members minimum)

Seed one room: name **`#dev-day-gate`** (or “Listing & Spend Gate”).

| Seat | Catalog / bot role | Job in the room | Speaks via |
| --- | --- | --- | --- |
| **Markets** | Kind Meitner Markets (ASP #13837) | Runs readiness + trust; posts Run/Trust cards | Free-MCP tools |
| **Builder** | e.g. “Listing Coach” (catalog agent) | Proposes endpoint URLs; applies remediation in chat | LLM + may call Markets |
| **Buyer** | e.g. “Spend Scout” (catalog agent) | Asks “can I use agent X?”; only proceeds on GO | LLM + may call Markets |

Optional 4th: **Ops** (human) — you type the kickoff once; then stay quiet so agents drive.

OKX chart avatars (#17) matter here: roster must *look* like OKX agents sharing a channel, not Cursor mascots.

---

## 3. Room play script (what appears in one scroll)

Pinned bulletin (one line):  
`Gate before list · Gate before spend · Free A2MCP only`

### Beat 1 — Kickoff (human or pinned starter)
> “Builder: check `https://demo.vercel.app/api/okx/free-mcp` for listing. Buyer: wait for PASS before trusting any ASP.”

### Beat 2 — Builder → Markets (readiness FAIL)
- Builder message: proposes vercel URL  
- Markets tool activity: `scan_free_mcp_readiness`  
- **ReadinessRunCard** in room (FAIL + vercel fix checklist)  
- Builder reply: “Switching to Railway…” + new URL  

### Beat 3 — Builder → Markets (PASS)
- Markets re-scan → PASS card  
- Builder: “Ready to keep / submit listing.”  

### Beat 4 — Buyer → Markets (trust)
- Buyer: “Trust-check agent 99999 before pay.”  
- Markets: `get_asp_trust_card` → **NO_GO** card  
- Buyer: “Skipping pay.”  

### Beat 5 — Buyer → Markets → proceed
- Buyer: “Trust-check 13837 + Railway endpoint.”  
- Markets: **GO** card  
- Buyer: “Calling free tool on Markets / target.” (shows second tool activity)  

**Camera never leaves the room.** Sidebar shows 3 avatars active. Optional Team map glance ≤5s.

---

## 4. Feature / UX (multichat-native)

### M1 — Demo room seed (Issue #30)
- One-click or scripted seed: create group with Markets + Builder + Buyer memberIds  
- Pin bulletin + 3 starter chips that **@ / route** to the right member (or fill composer with “@Builder …”)  
- Persist as “Dev Day” section in sidebar  

### M2 — Cards render in **group** transcript (#29, room-aware)
Same ReadinessRunCard / TrustCard as before, but:
- Author avatar = Markets  
- Visible to all members (group message, not DM-only)  
- Remediation checklist copyable; Builder’s next message can quote it  

### M3 — Turn / handoff clarity
- Activity rows already show which bot ran a tool — keep labels loud: `Markets · scan_free_mcp_readiness`  
- If defaultResponder exists, set Markets as tool owner for gate prompts; Builder/Buyer as conversational  

### M4 — Catalog roles (#20 retarget, not trending hero)
Expand/rename catalog agents to **Listing Coach** + **Spend Scout** whose system prompts know to:
1. Call / ask Markets for scan or trust  
2. Narrate the decision in the room  
3. Never invent live prices  

Trending/`get_trending_asps` may stay as a quiet capability; **not** a demo beat.

### M5 — Invite path (secondary wow)
From ASP page story: “import Markets into this room” still cool — but only after Beats 2–5 work. Invite is (re)entry, not the plot.

---

## 5. How this diffs / impacts (say in room + VO)

- **Latch402:** deep paid x402 scan in isolation → we show **gatekeepers inside a working team chat**  
- **Signal bots:** one agent spams numbers → we show **Builder + Markets + Buyer changing each other’s next message**  
- **Impact:** the room is a reusable pattern every OKX builder can copy: *put the Free readiness ASP in your agent channel before list/pay*

---

## 6. Demo video / live finale framing

1. Wide shot: sidebar **#dev-day-gate** with 3 OKX marks  
2. Scroll Beats 2→5 without cutting products  
3. Brief cutaway: same tools via external Codex calling #13837 (proves public ASP)  
4. Close on room: PASS + GO cards still visible  

Forbidden: split-screen “Tool A | Tool B” feature tour; scoreboard montage; invite-only flex.

---

## 7. Ship order (updated)

1. #23 / #24 tools (wire)  
2. #26 evidence  
3. **#30 demo room seed + prompts**  
4. #29 cards in **group** transcript  
5. #20 catalog Listing Coach / Spend Scout prompts (+ #17 marks)  
6. #27 video = full room scroll  
7. #25 submit  

If cut: **manual room** with 3 bots + scripted human pasting Builder/Buyer lines still beats A/B slides; seed (#30) saves live nerves.

---

## 8. Acceptance

- [ ] One room, ≥3 members, single continuous story  
- [ ] FAIL→fix→PASS and NO_GO→GO both visible as **chat turns**  
- [ ] No segment that only lists tool names without a reply from another member  
- [ ] Desktop multichat is the hero; external ASP call is proof, not the whole show  
