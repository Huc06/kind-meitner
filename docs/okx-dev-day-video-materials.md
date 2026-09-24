# OKX Dev Day video materials — issue #27

**Purpose:** a capture-ready, 2–4 minute demonstration of Kind Meitner Markets as an all-in-one multichat workbench for the **"Build a Company"** track. It proves both (1) the free, read-only readiness and pre-spend trust gate, and (2) the audit-to-hire workflow cloning vetted OKX agents into autonomous, scheduled company operations.

The official [OKX Dev Day 2026 Builder Kit](https://www.okx.com/en-us/learn/okx-dev-day-builder-kit) requires a **2–4 minute video** demonstrating the working product and integration. Dates, form requirements, and acceptance status were reviewed on 2026-09-24; recheck live form details before submitting.

---

## Claim boundary — read before capture

The demo tells one continuous 2-loop story:
1. **Loop 1 (The Gate):** Builder and Buyer agents use `scan_free_mcp_readiness` and `get_asp_trust_card` in `#dev-day-gate`; verdicts change next actions (remediation, re-scan, or Block Spend).
2. **Loop 2 (The Company):** Auditing leads directly to hiring. Vetted agents are recruited with `[+ Clone to Team]` into autonomous, scheduled routines with interactive Date/Time pickers, auto-approved background execution, and treasury governance.

The product is **free, read-only, paymentless**, and does not use a wallet, custody, settlement, mainnet, or an OKX endorsement. A `GO` is not payment approval.

| Evidence state | May say/show | Must not say/show as completed |
| --- | --- | --- |
| Isolated local fixture | `tools/list` exposes gate tools; a `*.vercel.app` candidate fails locally without probing it; missing inputs fail; `#dev-day-gate` is seeded. Label fixture frames **LOCAL FIXTURE · NO EXTERNAL NETWORK**. | A public HTTPS `PASS`, public listing, independent external-agent call, public UI deployment, payment, settlement, or OKX review/approval. |
| Human-verified public deployment | Live Railway HTTPS `tools/list`, readiness PASS, and trust GO against canonical ASP `#13851` (`https://www.okx.ai/agents/13851`). | Any broader claim than captured responses prove (no mainnet settlement, no OKX endorsement). |

Use the [judge guide](okx-dev-day-judge.md), [evidence register](evidence/dev-day/README.md), and [positioning](okx-dev-day-positioning.md) as the source of truth for the contract and limits.

---

## URLs and artifacts to show

| On-screen item | URL/value | When it may be shown |
| --- | --- | --- |
| Public Free A2MCP route | `https://kind-meitner-production.up.railway.app/api/okx/free-mcp` | Live deployed HTTPS host verified on Railway. |
| Canonical product listing | `https://www.okx.ai/agents/13851` | Live public listing on OKX.AI (HTTP 200). |
| Historical unlisted case | Agent `#13837` | Unlisted test case proving HTTP 404 listing yields honest `NO_GO`. |
| Builder failure candidate | `https://demo.vercel.app/api/okx/free-mcp` | Deterministic fixture demonstration producing known host-pitfall `FAIL`. |
| Builder repaired candidate | `https://kind-meitner-production.up.railway.app/api/okx/free-mcp` | Live verified Railway HTTPS host producing `PASS`. |
| Repository / build delta | `https://github.com/Huc06/kind-meitner` | Commits within build period (17–25 Sep 2026). |
| Evidence register | `docs/evidence/dev-day/README.md` | Boundary reference distinguishing local and public evidence. |

---

## 3:15 multichat room-scroll and operational workspace shot list and narration

**Format:** one continuous desktop capture of `#dev-day-gate`, routine calendar, and Team Map workspace. The presenter scrolls naturally between turns, pauses long enough to read cards and CTAs, and demonstrates live operational intervention. Planned runtime is **3:15** (well within the 2–4 minute limit).

| Time | Camera / visible evidence | Narration (or on-screen captions) | Required truth label |
| --- | --- | --- | --- |
| **0:00–0:15** | Wide shot: sidebar, `Dev Day` section, `#dev-day-gate`, and Markets, Listing Coach, Spend Scout. Bulletin: “Gate before list · Gate before spend · Free A2MCP only.” | “Welcome to Kind Meitner Markets. In the autonomous agent economy, building an AI company requires two things: knowing which marketplace agents you can trust, and orchestrating them into a productive corporate team. Today, we demonstrate our multichat workbench for the 'Build a Company' track.” | If local: **LOCAL FIXTURE · NO EXTERNAL NETWORK**. Live: **PUBLIC HTTPS DEPLOYMENT**. |
| **0:15–0:40** | Builder proposes `https://demo.vercel.app/api/okx/free-mcp`; Markets runs `scan_free_mcp_readiness`; scroll to uncollapsed `FAIL` Run Card and its Vercel remediation. | “First, the Gate protects Builders. A builder tests a candidate Free A2MCP endpoint before listing. The gate immediately returns a FAIL verdict with actionable remediation—explaining that Vercel host shape is rejected by OKX listing environments—preventing wasted review cycles.” | “Known host-pitfall result; no live Vercel probe.” |
| **0:40–1:05** | Builder applies the fix with `Apply host` using `https://kind-meitner-production.up.railway.app/api/okx/free-mcp` and re-scans. Scroll to `PASS` Run Card (7/7 checks green). | “The builder applies the fix with our live Railway host and re-scans. All 7 readiness checks pass. The endpoint is reachable and ready to list.” | host + UTC + **PUBLIC HTTPS EVIDENCE**. |
| **1:05–1:30** | Buyer asks Markets to trust-check bad example `99999`; scroll to `NO_GO` card, `notChecked` limits, and fill-only `[Block Spend]` CTA. Buyer responds: “Skipping spend.” | “Next, the Gate protects Buyers. Before committing company funds to an unknown agent, Spend Scout requests a Trust Card. With a fraudulent or dead agent, the gate issues an honest NO_GO verdict, allowing the buyer to Block Spend before any budget is lost.” | “NO_GO · no payment or target call performed.” |
| **1:30–2:00** | Buyer trust-checks canonical ASP `#13851` (Kind Meitner Markets); scroll to `GO` card (HTTP 200, endpoint PASS). The card displays the prominent **`[+ Clone to Team]`** CTA button. | “For verified agents, we check our canonical listing, ASP #13851. The trust card returns GO, proving live HTTP 200 reachability and endpoint readiness. The card is honest about what it did not check, and because reachability and readiness pass, the action card unlocks the `[+ Clone to Team]` button.” | **PUBLIC LISTING HTTP 200 · GO · NOT_CHECKED SHOWN**. |
| **2:00–2:35** | Click **`[+ Clone to Team]`**. The agent is recruited into the room. Open the composer/calendar, show the interactive **Date & Time Picker**, and schedule an automated recurring market intelligence routine. Highlight auto-approved execution. | “Here we transition from Audit to Hire. With one click, the vetted agent is recruited directly into our company workspace. We put it to work immediately: using our interactive Date & Time Picker, we schedule an autonomous recurring Routine. Cloned bots run scheduled tasks without stalling for manual prompts.” | “Autonomous routine scheduled · auto-approved permissions.” |
| **2:35–3:05** | Switch to **Team Map** tab (or `?fixture=sample`). Show **Board View** with parallel active tasks across teams. Highlight the **Attention Rail** at top (`P0 Blocked`). Click the blocked task, open Collaboration Drawer, and click **`[Unblock Task]`** 1-click CTA. Show **Workflow Facts** (1.80× parallel speedup, time saved). | “Finally, we orchestrate the company in Team Map 2.0. Operators get a 5-second operational overview in Board View: live tasks, progress bars, and an intelligent Attention Rail surfacing friction points. If a teammate is blocked, the operator intervenes with one click to unblock the deliverable. Derived workflow analytics prove our multi-agent parallel speedup.” | “Team Map 2.0 · Live Attention Rail · 1-Click Intervention.” |
| **3:05–3:20** | Show OKX Treasury & Budget settings in sidebar profile menu. Pan out over `#dev-day-gate` and Team Map. | “Kind Meitner Markets is the all-in-one operational workbench for OKX.AI—unifying listing readiness, pre-spend trust, and autonomous multi-agent company execution. Built for OKX Dev Day 2026.” | **Kind Meitner Markets · Build a Company**. |

---

## Exact preflight checklist (before recording)

All boxes are mandatory; stop capture if any fails.

1. [ ] **Human ownership:** Confirmed authority to record `#dev-day-gate`, public URL, repository, and account names.
2. [ ] **Scope:** The story is `#dev-day-gate` with Markets, Builder/Listing Coach, Buyer/Spend Scout, and Cloned Agent; no private keys, real seed phrases, or external customer data opened.
3. [ ] **Truth label:** Display appropriate label on recording layout (**PUBLIC HTTPS DEPLOYMENT** or **LOCAL FIXTURE**).
4. [ ] **Live endpoint verification:** Verify `https://kind-meitner-production.up.railway.app/api/okx/free-mcp` returns HTTP 200 for `tools/list` and `https://www.okx.ai/agents/13851` is live.
5. [ ] **Clean room:** Seed room with synthetic turns: Vercel FAIL card, Railway PASS card, 99999 NO_GO card, #13851 GO card with `[+ Clone to Team]`.
6. [ ] **Feature integrity:** Test `[+ Clone to Team]` and Date/Time picker in Routine composer beforehand to ensure zero UI hitches.
7. [ ] **Recorder hygiene:** Mute system notifications; set Do Not Disturb; hide unrelated browser tabs/bookmarks; check audio levels and readable 1080p font size.
8. [ ] **Narration timing:** Rehearse narration at 2:40–3:00; leave pauses for Action Cards and CTAs to be read by judges.
9. [ ] **Capture destination:** Save take locally with date/version tag before uploading.

---

## Exact recording checklist (human-only execution)

1. [ ] Begin capture with wide shot of `#dev-day-gate` and state the two-loop purpose (Gate + Company).
2. [ ] Record the 6 scenes in strict chronological order, keeping camera inside `#dev-day-gate` and workspace views.
3. [ ] Pause on each Action Card (`FAIL`, `PASS`, `NO_GO`, `GO`) long enough for viewers to read signals and `notChecked` limits.
4. [ ] Demonstrate `Apply host`, `Block spend`, and `[+ Clone to Team]` button interactions clearly.
5. [ ] Demonstrate the Date & Time Picker when configuring the autonomous routine.
6. [ ] If any secret, error popup, or private notification appears, discard the take and restart from preflight.
7. [ ] Confirm finished video runtime is between **2:00 and 4:00** (target 2:50).

---

## Capture evidence list

| Artifact | Minimum contents | State now |
| --- | --- | --- |
| Local fixture JSON | `fixture-free-mcp.json`, tool names, Vercel `FAIL`, and seeded-room result. | Verified in repository. |
| Targeted test output | `server/okx/` test suite and `dev-day-gate.test.ts` (170 tests passing). | Verified green. |
| Public HTTPS transcript | Live Railway `tools/list` and scan outputs. | Verified live on Railway. |
| Canonical listing record | OKX.AI page `https://www.okx.ai/agents/13851` HTTP 200. | Verified live on OKX. |
| Final video review | 2–4 min MP4/WebM room-scroll video link. | Pending human capture. |

---

## Human-only gates

No agent or automated workflow may clear these gates:

| Gate | Human must decide/perform | Evidence required before passing |
| --- | --- | --- |
| Record | Review preflight checklist, operate the recorder, and approve the local take. | Complete take meeting 2–4 min length and truth guidelines. |
| Publish | Approve final title, video privacy (Unlisted/Public), and upload to YouTube/Loom. | Accessible video link with crisp audio/visuals. |
| Submit | Fill out official form (`https://forms.gle/81S2gnFCzqSoeDEA7`) and confirm declaration. | Complete submission package with verified links and team roster. |
