# Full Dev Day gap review — PRs · issues · agents · bots

**Date:** 2026-09-21 ICT · **Deadline:** submit **25 Sep 23:59 UTC** · **Route:** Accepted · Singapore finale · Build a Company  
**Reviewer:** Grok Bot (planning) · **Implementer:** Hulk (@Huc06)

---

## Executive scorecard

| Area | Status | Notes |
| --- | --- | --- |
| Strategy / docs | 🟢 Strong | PR #22 has USP, build brief, multichat, interaction plans |
| Free-MCP endpoint on Railway | 🟡 Exists | URL known; box curl 403 via proxy — verify from Mac/Railway logs |
| ASP #13837 listing | 🟡 Page 200 | Title/meta empty (“Hire  on OKX.AI”) — likely still under review / incomplete copy (#18) |
| `scan_free_mcp_readiness` | 🔴 Missing | Not on `main` — only old free tools |
| `get_asp_trust_card` | 🔴 Missing | Not on `main` |
| Multichat `#dev-day-gate` seed | 🔴 Missing | Issue #30 only |
| ReadinessRunCard / TrustCard UI | 🔴 Missing | Issue #29 only |
| Catalog Builder/Buyer roles | 🔴 Thin | `OKX_CATALOG_AGENTS` = **Market Scout only** on main |
| OKX chart avatars everywhere | 🟡 Partial | Catalog `avatar: "chart"`; PR #16 soft plates still may show mascot defaults |
| Demo video | 🔴 Missing | #27 |
| Evidence pack / judge README | 🔴 Missing | #26 |
| Submission form draft | 🔴 Missing | #25 |
| Chat shell polish | 🟡 PR open | #16 — **CI failing** (typecheck+test all OS) |
| Sidebar/transcript rework | ⚠️ Risk | #15 — “drop the OKX views” — **do not merge blind** before Dev Day |

**Bottom line:** Planning is ahead of code. **Zero of the win spine tools/UI exist on `main` yet.** ~4 days left → Hulk must open implementation PRs for #23/#24 first, not more docs.

---

## 1. Open PRs — what they are · merge advice

| PR | What | Dev Day value | Checks | Decision |
| --- | --- | --- | --- | --- |
| **[#22](https://github.com/Huc06/kind-meitner/pull/22)** docs | Canonical plans: readiness+trust, build brief, interaction, **multichat**, clock, gap review | **Must merge** so Hulk/main share one brief | Some CI red (docs-only; iOS/Android often flaky) | **Merge ASAP** (docs-only) |
| **[#16](https://github.com/Huc06/kind-meitner/pull/16)** welcome + shell + soft avatars | First-conversation welcome, quieter sidebar, soft avatar plates | Nice for ops console; **not** win spine | **typecheck+test FAIL** mac/ubuntu/windows; mobile jobs fail | **Hold** until CI green; merge after #23/#24 if time |
| **[#15](https://github.com/Huc06/kind-meitner/pull/15)** transcript/sidebar + **drop OKX views** | Chat UX rework; removes OKX view routing | Contaminates Dev Day if it strips OKX surfaces you still need | Unknown / review required | **Do not merge** until Hulk confirms OKX import/room paths intact |
| **[#14](https://github.com/Huc06/kind-meitner/pull/14)** chore docs / dead mobile tests | Docs hygiene | Low | — | Optional anytime; no blocker |

### Merged (already on main — keep)
| PR | Keep in story |
| --- | --- |
| #3 Free A2MCP ASP | Public free endpoint contract |
| #4 Market Scout default room | Multichat precedent — extend, don’t throw away |
| #5/#6 A2MCP harden | Payment boundary |
| #7 x402 testnet **disabled** | Evidence slide only if time — not hero |
| #11 Phase 3 draft | Non-goal for submit |

---

## 2. Agent / bot matrix (what must exist for the room demo)

| Bot / agent | Needed for Singapore | On main today | Gap |
| --- | --- | --- | --- |
| **Kind Meitner Markets** (ASP #13837 Free-MCP) | Hero tool caller in room | Endpoint + listing page; tools = use cases / checklist / benchmarks / reputation / trending | **Add** readiness + trust tools; wire bot to call them |
| **Listing Coach** (Builder seat) | Proposes URLs, applies FAIL fixes in `#dev-day-gate` | **Missing** as catalog role (only Market Scout) | #20 retarget + #30 seed |
| **Spend Scout** (Buyer seat) | Trust asks; refuses pay on NO_GO | **Missing** | #20 + #30 |
| **Market Scout** | Optional 4th / legacy | Present in catalog | Demote from hero; can stay as member or rename |
| Desktop “human Ops” | Kickoff one line | You | Script only |
| External Codex/OpenClaw | Proof public ASP callable | Not automated | #26 transcript |

**Check missing for “full agents” demo:**
- [ ] 3 distinct OKX-looking faces in sidebar of one room  
- [ ] Group turns: Builder → Markets → Buyer visible as different authors  
- [ ] Markets tool activity labels show `scan_free_mcp_readiness` / `get_asp_trust_card`  
- [ ] Cards (#29) render on **group** messages, not only 1:1  
- [ ] System prompts: Builder/Buyer never invent live prices; always defer gate to Markets  
- [ ] Default responder / turn routing doesn’t mute Markets during scans  

---

## 3. Factor checklist (builder kit + our USP)

### A. Submission package (#25) — required by OKX
| Factor | Ready? |
| --- | --- |
| Team accepted + Singapore route | ✅ User confirmed |
| Track: Build a Company | ✅ |
| Project summary / pitch line | ✅ In build-brief §7 — paste to form |
| Public GitHub + README judge section | 🔴 #26 |
| Demo video 2–4 min | 🔴 #27 |
| Product / listing / deploy URL | 🟡 Railway URL + okx.ai/agents/13837 (listing copy weak) |
| Build-window delta (17–25 Sep work) | 🔴 Need commit list after tool PRs land |
| Form https://forms.gle/81S2gnFCzqSoeDEA7 | 🔴 Not drafted |
| Telegram builder group | ❓ Confirm joined |
| No non-refundable travel until finalist mail | ⚠️ Reminder |

### B. Product completeness (judges)
| Factor | Ready? |
| --- | --- |
| Working OKX AI integration (A2MCP) | 🟡 Old free tools only |
| End-to-end workflow **in multichat** | 🔴 |
| Meaningful new work in build window | 🔴 Until #23/#24/#30 merge |
| Honest provenance (free / no wallet / no mainnet claim) | ✅ Pattern exists — keep on new tools |
| Differentiation vs Latch402 | 📄 #28 docs only |

### C. Win-spine implementation
| Factor | Issue | Ready? |
| --- | --- | --- |
| Tool A readiness + vercel FAIL | #23 | 🔴 |
| Tool B trust + notChecked | #24 | 🔴 |
| Evidence PASS/FAIL/GO curls | #26 | 🔴 |
| `#dev-day-gate` room seed | #30 | 🔴 |
| Run/Trust cards in room | #29 | 🔴 |
| Catalog Listing Coach / Spend Scout | #20 | 🔴 |
| OKX avatars (no Cursor hero) | #17 | 🟡 |
| ASP listing follow-up | #18 | 🟡 |
| Video = room scroll | #27 | 🔴 |
| Positioning one-pager | #28 | 🔴 |

### D. Explicit non-goals (must stay unchecked)
- [ ] Invite/trending as hero beat  
- [ ] Mainnet / live prices / revenue claims  
- [ ] Scoreboard-only demo  
- [ ] Merge #15 if it drops needed OKX UI  

---

## 4. What’s missing — ranked for Hulk (next PRs to open)

| Priority | Open this PR | Closes | Est. |
| --- | --- | --- | --- |
| P0 | `feat/free-mcp-readiness-scanner` | #23 | D1 |
| P0 | evidence folder + judge README (can be same PR or follow) | #26 | D1–D2 |
| P1 | `feat/asp-trust-card` | #24 | D2 |
| P1 | `feat/dev-day-gate-room` | #30 | D2 |
| P1 | `feat/readiness-trust-cards` (group transcript) | #29 | D2–D3 |
| P2 | catalog Listing Coach / Spend Scout + prompts | #20 | D2–D3 |
| P2 | OKX avatar defaults | #17 | before video |
| P2 | listing #13837 copy/status | #18 | ongoing |
| P3 | fix CI + merge #16 | #19 | if spare |
| P3 | demo video + form | #27 #25 | D3–D4 |
| — | **Merge #22 docs now** | plans | today |
| ⛔ | Hold #15 | — | until OKX surface audit |

---

## 5. PR #22 body order (canonical — replace stale list)

1. Merge **#22** docs  
2. **#23** readiness tool → deploy Railway  
3. **#26** evidence + judge README  
4. **#24** trust tool  
5. **#30** multichat room seed  
6. **#29** cards in group transcript  
7. **#20** + **#17** roster faces/prompts  
8. **#18** listing  
9. **#27** video (room scroll)  
10. **#25** submit form  

Parallel: #28 positioning. After green: #16. Never block on #15/#14.

---

## 6. Reviewer ask list (you + Hulk)

**You (owner)**  
1. Confirm Telegram + onboarding email access  
2. Confirm Agentic Wallet / ASP dashboard: is #13837 approved or still “under review”?  
3. Approve: merge #22 today?  
4. Approve: hold #15 until after submit?  

**Hulk**  
1. Branch from `main` for #23 today  
2. Do not implement trending/invite as hero  
3. Every FAIL remediation = agent-readable fix verb  
4. Room demo must work with 3 bots before polishing welcome (#16)  

---

## 7. Definition of “full agents bot review = pass”

Pass only when all true:

1. External agent can `tools/call` `scan_free_mcp_readiness` + `get_asp_trust_card` on Railway Free-MCP  
2. `#dev-day-gate` shows Builder/Markets/Buyer turns with FAIL→PASS and NO_GO→GO  
3. Cards readable in-room; no scoreboard-only segment  
4. Evidence folder + 2–4 min room-scroll video + form fields filled  
5. README states build-window delta and honest free/no-mainnet limits  
6. No merge of #15 that deletes OKX paths needed for import/room  

Until (1)–(2) exist, status remains **not demo-ready**.
