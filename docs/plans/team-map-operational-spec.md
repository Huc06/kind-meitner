# Team Map: Operational Workspace Product Specification

## 1. Product Definition
**Team Map is an operational workspace for team leads and operators to monitor real-time agent health, current workloads, active collaboration, and immediately intervene at points of friction within five seconds.**

---

## 2. Core User & Jobs

### Primary User
- **Team Lead / Operator**: Responsible for orchestrating multi-agent workflows, resolving blockers, reviewing deliverables, and maintaining team health.

### Primary Job
- **Identify friction points and intervene immediately**: Pinpoint within 5 seconds whether any agent is blocked, waiting on user input, or requiring approval, and resolve it in one click.

### Secondary Jobs
1. **Understand live workload**: See which agents are currently working, their active task titles, and progress.
2. **Inspect active collaboration**: Trace direct peer-to-peer exchanges and ownership transfers.
3. **Audit completed work**: Drill into historical receipts, messages, artifacts, and decisions on demand via the detail drawer.

---

## 3. Information Hierarchy & Surface Model

### Ranked Information Priority
1. **Attention Items (P0)**: Blocked agents, failed tasks, user input required, pending review/approval.
2. **Live Agent Status & Active Task (P1)**: Avatar, Name, Role, Presence (Working, Blocked, Reviewing, Ready), Task Title (1 line), Progress bar.
3. **Active Collaboration & Handoffs (P2)**: Directed relationship lines, persistent channels, structured ownership transfer cards.
4. **Detailed History & Intervention Actions (P3)**: Right-side Detail Drawer with actions (`Unblock`, `Approve`, `Resume`, `Inspect`).
5. **Historical Workflow Analytics (P4)**: Collapsed by default under "Workflow Insights" (Speedup, Time saved, Parallel branches).

### Surface Model (Max 3 Tiers)
- **Tier 1 (Base App / Canvas)**: `#0B0C0E`
- **Tier 2 (Section Container)**: `#15171A` with subtle hairline border `rgba(255,255,255,0.08)`
- **Tier 3 (Interactive / Selected / Attention)**:
  - Interactive hover: `#20242A`
  - Selected / Active: `#1C2025` with accent left indicator
  - Blocked / Urgent: `rgba(239, 68, 68, 0.12)` with `border-danger/60`
  - Waiting / Review: `rgba(245, 158, 11, 0.12)` with `border-warning/60`

---

## 4. Attention Rail Component Specification
- Placed immediately between the canvas and bottom panels.
- **Auto-collapsing**: Only renders when attention items exist. If all agents are healthy (`idle` / `ready` / normal `working`), renders a compact single-line health indicator: `All systems operational · No blockers`.
- **Ranking Order**:
  1. `blocked`: Blocked agent / task
  2. `input_needed`: Waiting on user input / credential
  3. `review`: Review or approval required
  4. `warning`: Degraded or long-running warning
- **Interaction**: Clicking an attention item selects the agent on the canvas, centers viewport, and opens the Detail Drawer with direct action buttons (`Unblock`, `Approve`, `Provide Input`).
