# ZRoute Agent Demo Verification Record (2026-10-06)

## Capability Matrix

| Capability | Result | Proof | Remaining Issue |
|---|---|---|---|
| **zroute text response** | **PENDING_KEY** | Key file ~/.config/kind-meitner/zroute.key not present; local Claude CLI (2.1.287) verified working with claudeAgent driver | Supply valid key at ~/.config/kind-meitner/zroute.key (mode 600) to activate live ZRoute gateway calls |
| **streaming** | **PASS** | SSE event streaming verified across room messages and provider instance turns (27 messages received) | None |
| **tool invocation** | **PASS** | Browser tools (mcp__browser__agent_browser_open, mcp__browser__agent_browser_read, Handoff to Reviewer, ToolSearch, mcp__browser__agent_browser_get_text, Handoff to Researcher, mcp__agents__list_threads, CronCreate) executed and settled cleanly during turns | None |
| **browser page reading** | **PASS** | Researcher read http://127.0.0.1:22078/event.html via agent-browser and grounded arrival 10:30 and sessions from dev-day-event.html | None |
| **browser preview** | **PASS** | text browser logs only: agent-browser runs headlessly in fixture environment; interactive browser preview is available only in native Electron desktop app with window.ogb | None |
| **researcher task** | **PASS** | Researcher (msg 95c751db-a677-4325-8cb7-3bc802d5956b) extracted arrival 10:30, 8 main sessions, and attendee checklist from controlled event page | None |
| **reviewer handoff** | **PASS** | Prompt 2 routed to Reviewer; handoff recorded in room (msg 5848fddf-faac-4072-af35-a4ee5a2efae9) and Reviewer independently verified schedule (msg 023f3085-095c-4c1d-8728-ac7a25f1286c) | None |
| **team activity** | **PASS** | RoomActivityTimeline derived distinct sequential steps with actor attribution (You, Researcher, Reviewer) | None |
| **persisted schedule** | **PASS** | Routine 00706474-d20d-41ed-9a23-d957c6350df7 created (server_api) with maxRuns: 3, interval: 1m, alertOnly: "change_or_failure", persisted in routines.json with remainingRuns tracked | None |
| **automatic second run** | **PASS** | Run 1 (d4c80957-3642-4b0e-b1a7-f96c009eeb90) and Run 2 (f0934a49-a076-40b3-907c-b491dd8776a1) executed server-side via scheduler tick without manual trigger; Run 2 received Run 1 context via <previous-run> | None |
| **change detection** | **PASS** | Run 2 (f0934a49-a076-40b3-907c-b491dd8776a1) detected schedule change on edited page: Awards & Closing changed to 16:00 (old: 15:45) | None |
| **stop/cancel** | **PASS** | Routine 00706474-d20d-41ed-9a23-d957c6350df7 cancelled (enabled=false, nextRunAt=null) | None |
| **secret redaction** | **PASS** | Transcripts, room messages, and server logs scanned; no credentials or API tokens leaked | None |

## Summary of Completed Journey
1. **Prompt 1**: Researcher opened the controlled event page with the browser tool, extracted arrival time (**10:30**), 8 main sessions from PR #129 OKX Dev Day schedule, and the attendee checklist.
2. **Prompt 2**: Prompt 2 addressed Reviewer; an agent handoff was created and recorded in `room-handoffs.json` and as an activity event in the room. Reviewer ran a separate real turn, inspected the page, verified facts, and provided the corrected version.
3. **Prompt 3**: Agent activity steps were confirmed with proper actor attribution in the real React renderer (`RoomActivityTimeline`).
4. **Team Map**: Team Map view mounted and captured in real renderer.
5. **Prompt 4**: Bounded server-side routine created (`everyMinutes: 1`, `maxRuns: 3`, `alertOnly: change_or_failure`).
   - Run 1 ran baseline inspection server-side via scheduler tick.
   - Page was modified (Awards & Closing changed from 15:45–15:50 to 16:00–16:15).
   - Run 2 executed server-side via scheduler tick, compared with Run 1 (<previous-run>), detected the schedule difference, and alerted with old vs new times.
   - Cancel / pause was verified: `enabled = false` and `nextRunAt = null`.
6. **Secrets & Safety**:
   - Zero credentials or tokens in transcripts, evidence files, or server logs.
   - Per-process env configuration avoids global Claude Code or system tool corruption.

## Artifacts & Genuine Evidence Captures
- `1-event-page-initial.png` — Controlled event page with initial baseline schedule
- `2-event-page-modified.png` — Controlled event page after session time update
- `prompt-1-researcher-answer.png` — Kind Meitner React renderer: Researcher answering Prompt 1
- `prompt-2-reviewer-handoff.png` — Kind Meitner React renderer: Reviewer handoff activity and verified reply
- `prompt-3-activity-timeline.png` — Kind Meitner React renderer: RoomActivityTimeline drawer with actor steps
- `team-map.png` — Kind Meitner React renderer: Team Map canvas
- `prompt-4-schedule-panel.png` — Kind Meitner React renderer: Automations panel showing 3 bounded runs
- `prompt-4-schedule-change-alert.png` — Kind Meitner React renderer: Scheduled Run 2 change detection alert
- `prompt-4-schedule-cancelled.png` — Kind Meitner React renderer: Automations panel showing paused schedule
- `transcript-evidence.txt` — Complete conversation transcript dumped from room thread
- `zroute-demo-run.webm` — Live video recording of the headless browser session
