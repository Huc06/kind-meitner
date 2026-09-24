# OKX Dev Day 2026 — Submission package (issue #25)

**Status:** form-ready worksheet; not a submission or evidence of acceptance. **Owner:** submitting human. **Last public-guidance review:** 2026-09-24. **Form status:** deliberately not opened by this issue; copy the values below into the official form only after its live labels, required fields, character limits, and declarations are rechecked.

This package is for **Kind Meitner Markets**, the all-in-one multichat workbench for the **Build a Company** track documented in the [positioning](okx-dev-day-positioning.md), [judge guide](okx-dev-day-judge.md), [evidence register](evidence/dev-day/README.md), and [video materials](okx-dev-day-video-materials.md).

---

## Official requirements and clock

The public [OKX Dev Day 2026 Builder Kit](https://www.okx.com/en-au/learn/okx-dev-day-builder-kit) requires submission by **25 September 2026, 23:59 UTC**. It lists team/track/route, project summary, repository, a **2–4 minute working-product/integration demo video**, a product/deployment/test link, and an event guidelines declaration. Existing projects must identify build-period features (17–25 Sep) with supporting commit history.

| Clock item | Exact value | Human action |
| --- | --- | --- |
| Submission deadline | **2026-09-25 23:59 UTC (UTC+0)** | Submit before this time; do not treat a saved form as submitted. |
| Vietnam / ICT equivalent | **2026-09-26 06:59 ICT (UTC+7)** | Local deadline for convenience check. |
| Build-period dates | **17–25 Sep 2026** | Verified git log range submitted below. |
| Official form URL | `https://forms.gle/81S2gnFCzqSoeDEA7` | Human-only: open, authenticate, review, and submit. |

---

## Form-fill worksheet

### 1. Team, track, and participation route

| Form concept | Enter this exact value / placeholder | Verification before submit |
| --- | --- | --- |
| Team name | `[CONFIRM_TEAM_NAME]` | Use the accepted-team/roster name exactly; do not infer from GitHub. |
| Team members | `[MEMBER_1_FULL_NAME + EMAIL]`; `[MEMBER_2_FULL_NAME + EMAIL]`; `[MEMBER_3_FULL_NAME + EMAIL]`; `[MEMBER_4_FULL_NAME + EMAIL]` | Up to 4 eligible members; confirm final roster and consent. |
| Project name | `Kind Meitner Markets` | Consistent across repository, video, and form. |
| Primary track | **Build a Company** | Selected track: multi-agent AI company operations and trust workbench. |
| Participation route | `[CHOOSE EXACTLY ONE: Singapore finale | Remote Build]` | Select Singapore finale if attending, otherwise Remote Build. |
| Contact / submitting owner | `[HUMAN_OWNER_NAME + HUMAN_OWNER_EMAIL]` | Authorized person receiving email receipt and verification requests. |

### 2. Form-ready project copy

**One-line summary**

> Kind Meitner Markets is an AI company operations workbench and trust gate for the OKX.AI ecosystem: builders scan before listing, buyers get bounded pre-spend trust guidance, and audited agents are instantly cloned into autonomous, scheduled company teams.

**Project description**

> Building an AI-native company requires two things: knowing which marketplace agents you can trust, and seamlessly orchestrating them into productive corporate workflows. Kind Meitner Markets addresses both in `#dev-day-gate`:
>
> 1. **The Gate (Pre-Listing & Pre-Spend Trust):** Builders call `scan_free_mcp_readiness` at `POST /api/okx/free-mcp` for automated pre-listing checks with concrete remediation (e.g., catching Vercel endpoint shape issues). Buyers and judges call `get_asp_trust_card` to evaluate reachability and trust before spending funds, triggering automated safety actions like Block Spend on `NO_GO`. 100% free, read-only Free-MCP with zero wallet friction.
>
> 2. **The Company (Audit-to-Hire & Automation):** With an innovative Audit-to-Hire model, users recruit vetted OKX agents directly from chat action cards via `[+ Clone to Team]`. Supporting both direct in-process MCP tools and dynamic OKX Onchain OS proxy dispatchers, Kind Meitner enables teams to schedule recurring routines using an interactive Date & Time Picker, auto-approved background execution, and local treasury budget controls.

**Core integration statement**

> The project implements a free OKX.AI A2MCP-compatible JSON-RPC surface (`POST /api/okx/free-mcp`), an active OKX marketplace listing (ASP `#13851`), dynamic agent delegation routed through the OKX Onchain OS dispatcher, and a visual multichat console where audited agents become scheduled corporate teammates.

### 3. Links and evidence fields

| Form concept | Value to enter | Current evidence state / guardrail |
| --- | --- | --- |
| Repository | `https://github.com/Huc06/kind-meitner` | Verified public repository on branch `main`. |
| Judge-facing technical guide | `https://github.com/Huc06/kind-meitner/blob/main/docs/okx-dev-day-judge.md` | Live 5-minute judge verification instructions. |
| Evidence register | `https://github.com/Huc06/kind-meitner/tree/main/docs/evidence/dev-day/` | Checked-in live Free-MCP JSON transcripts and screenshots. |
| Product/deployment URL | `https://kind-meitner-production.up.railway.app/api/okx/free-mcp` | Verified live HTTPS host deployed on Railway. |
| ASP/listing URL | `https://www.okx.ai/agents/13851` | Verified canonical listing on OKX.AI (HTTP 200 · trust GO). |
| Demo-video URL | `[PUBLIC_OR_REVIEWER-ACCESSIBLE_2_TO_4_MIN_VIDEO_URL]` | Required 2–4 minute room-scroll demo video (pending recording). |
| Technical references | `docs/okx-dev-day-positioning.md`; `docs/okx-dev-day-video-materials.md` | Complete positioning, competitive matrix, and video shot list. |

---

## Existing-project build-window delta (17–25 Sep 2026)

The project existed prior to Dev Day. Only the new OKX readiness, trust, and multi-agent company orchestration work built during the hackathon window is submitted:

| Commit | Date | Hackathon Build Addition |
| --- | --- | --- |
| `ea0f3e3` | 2026-09-22 | Free-MCP readiness scanner (`scan_free_mcp_readiness`). |
| `90f1d53` | 2026-09-22 | ASP trust-card contract (`get_asp_trust_card`) with explicit `notChecked` limits. |
| `249154e` | 2026-09-22 | Interactive visual Action Cards (Readiness FAIL/PASS & Trust GO/NO_GO). |
| `4b90e41` | 2026-09-22 | Idempotent `#dev-day-gate` room seed with `@Markets`, `Listing Coach`, `Spend Scout`. |
| `1c4adb0` | 2026-09-22 | Live Free-MCP production evidence pack captured against Railway. |
| `685180f` | 2026-09-22 | Locked Action Card CTAs (`Apply host`, `Block spend`, `Re-check`). |
| `c913b69` | 2026-09-23 | **`[+ Clone to Team]`** Action Card CTA and dynamic OKX agent import architecture. |
| `bf41cf5` | 2026-09-23 | Agent routine scheduler, tool resolution, and chat integration. |
| `2e71ee1` | 2026-09-23 | Canonical ASP `#13851` trust starter chip and verification tests. |
| `9fc159b` | 2026-09-23 | Railway `docker-entrypoint.sh` automated Free-MCP MCP server configuration. |
| `33465bb` | 2026-09-24 | Dynamic OKX agent metadata resolution, trust card enrichments, and adaptive composer commands. |
| `a82086f` | 2026-09-24 | Interactive Date & Time Picker directly in routine composer / calendar. |
| `6224225` | 2026-09-24 | Auto-approved permissions for cloned ASP bots during autonomous routines. |
| `ada98ee` | 2026-09-24 | OKX Treasury & Budget settings in sidebar profile menu. |
| `4e54e69` | 2026-09-24 | Multi-agent Team Map visualization and OKX agent retargeting. |
| `de96c0a` | 2026-09-24 | Full interactive public access for Railway remote deployments (`KIND_MEITNER_PUBLIC_ACCESS`). |

**Build-window delta summary for the form**

> During the Dev Day build window (17–25 Sep), we implemented the complete two-loop agent operations workbench:
> - **Loop 1 (The Gate):** Free-MCP readiness scanner with host-shape remediation, pre-spend trust cards with explicit `notChecked` limits, interactive Action Cards with locked CTAs (`Apply host`, `Block spend`), and live verification of canonical ASP `#13851`.
> - **Loop 2 (The Company):** Instant `[+ Clone to Team]` audit-to-hire execution (binding in-process tools for open agents, and dynamic proxy dispatchers via OKX Onchain OS for closed agents), recurring Routine scheduling with interactive Date/Time pickers, auto-approved background execution, and OKX Treasury budgeting.

---

## Final human review and receipt checklist

### Before pressing submit

- [ ] Confirm `[CONFIRM_TEAM_NAME]`, member roster, and contact email.
- [ ] Confirm **Build a Company** is selected as the primary track.
- [ ] Verify `https://kind-meitner-production.up.railway.app/api/okx/free-mcp` and `https://www.okx.ai/agents/13851` are live in a clean window.
- [ ] Record the 2–4 minute video following `docs/okx-dev-day-video-materials.md` and upload (YouTube Unlisted / Loom).
- [ ] Replace `[PUBLIC_OR_REVIEWER-ACCESSIBLE_2_TO_4_MIN_VIDEO_URL]` with the uploaded video link.
- [ ] Affirm the form declaration and submit before **25 Sep 2026, 23:59 UTC**.

### Immediately after submission

- [ ] Capture the confirmation page / receipt screenshot locally.
- [ ] Save the confirmation receipt email.
- [ ] Monitor team email and Telegram for organizer verification requests within 24 hours.

---

## Explicit human-only gates

No automated workflow may clear these gates:

| Gate | Human-only decision/action | Minimum evidence before pass |
| --- | --- | --- |
| Record | Review preflight checklist, operate recorder in `#dev-day-gate`, and approve local take. | 2–4 min complete video meeting quality and truth guidelines. |
| Publish video | Upload video to YouTube/Loom and verify link is accessible. | Accessible video URL with crisp 1080p display and clear audio. |
| Submit form | Open `https://forms.gle/81S2gnFCzqSoeDEA7`, review all fields, and press submit manually. | Complete worksheet data copied into live form before deadline. |
| Receipt | Retain confirmation screenshot/email and monitor response channels. | Saved confirmation receipt. |
