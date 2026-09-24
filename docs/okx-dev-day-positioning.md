# OKX Dev Day positioning: Kind Meitner Markets & Agent Workbench

## One-line position

**Kind Meitner is the all-in-one multichat workbench for the "Build a Company" track:** it solves the two critical bottlenecks of the agent economy by providing (1) a free, read-only **Readiness & Pre-Spend Trust Gate** before listing or spending, and (2) an **Audit-to-Hire workflow** that instantly clones vetted OKX agents into autonomous, scheduled agent teams running company operations.

---

## The Two Core Problems We Solve

### Problem 1: The Gate — Pre-Listing Readiness & Pre-Spend Trust
In a growing agent marketplace, builders struggle with rejected listings due to obscure endpoint mistakes, while buyers risk wasting funds on dead or fraudulent services.
- **For Builders:** `scan_free_mcp_readiness` checks Free A2MCP endpoints before listing, catches host and protocol pitfalls (such as Vercel endpoint shape issues), and provides actionable remediation steps.
- **For Buyers & Judges:** `get_asp_trust_card` performs an unopinionated reachability and trust check before consequential spending. Deliberately broken endpoints return `NO_GO` with a direct **Block Spend** action, while verified endpoints return `GO`.
- **Honest limits:** The trust card always surfaces its `notChecked` list (on-chain credit score, historical settlement volume, OKX official endorsement, mainnet payment success) so the user never mistakes reachability for financial safety or OKX endorsement.
- **Zero Friction:** 100% free, read-only Free-MCP tools (`POST /api/okx/free-mcp`). No wallet, signature, payment, or custody required to evaluate.

### Problem 2: The Company — Audit-to-Hire & Autonomous Agent Team Operations
Auditing an agent is only the first step. Once an agent is proven trustworthy, companies need to put it to work immediately alongside human operators and other specialized bots.
- **Instant `[+ Clone to Team]`:** Directly from any visual Readiness or Trust Action Card in room chat, users can hire/clone the audited OKX agent with one click.
- **Two-Tier Execution Architecture:**
  1. *Open / Free MCP Agents (e.g., ASP #13851):* Directly mounts in-process MCP tools for immediate execution.
  2. *Closed Marketplace Agents (e.g., #2023 / Service 17316):* Provisions dynamic Proxy Bots that coordinate tasks and dispatch requests through the **OKX Onchain OS router**.
- **Automated Work Schedules (Routines):**
  - Interactive **Date & Time Picker** embedded directly into the composer to schedule recurring market intelligence, audits, and reports.
  - **Auto-approved Routine Execution:** Cloned bots run scheduled background tasks autonomously without stalling on manual approval prompts.
  - **OKX Treasury & Budgeting:** Built-in budget limits and treasury controls accessible right from the user profile menu to govern agent operational spend.

---

## Competitive Differentiation & The Kind Meitner Wedge

Unlike standalone CLI utilities or raw API scanners that operate in isolation, **Kind Meitner embeds trust and execution into a visual Multichat Workbench**. We take users and agents across the entire journey: from pre-listing evaluation to hiring, room-level delegation, and scheduled autonomous business operations.

| Product / Category | Job it is designed to do | When in the workflow | What a credible proof looks like | Kind Meitner Advantage |
| --- | --- | --- | --- | --- |
| **Latch402** | Red-team a **paid x402** HTTP endpoint for security vulnerabilities. | After paid endpoint exists; before public release. | An observed `402` challenge and penetration findings. | **Complementary.** Latch402 audits paid x402 security; Kind Meitner provides the earlier zero-friction Free-MCP gate AND the full company workbench to hire and orchestrate them. |
| **PreFlight** | Test-purchase a paid agent service on testnets (Base Sepolia / mock). | After paid endpoint exists; before promotion. | Check scorecard with challenge/payment/delivery evidence. | **Complementary.** PreFlight tests purchasing; Kind Meitner gates pre-spend trust without moving testnet funds, then immediately operationalizes the agent into an active team. |
| **ProofGate** | Delivery audits and deterministic hash receipts over raw endpoints. | Post-delivery / verification. | Cryptographic verification of receipt hashes. | **Interactive Operations.** ProofGate is a headless audit utility; Kind Meitner provides uncollapsed Action Cards and direct hire paths in a live collaboration room. |
| **GateCheck** | Discovery surface scanner (OpenAPI / mcp.json). | Early discovery. | Static report of exposed endpoints. | **Action-Driven Remediation.** Kind Meitner generates immediate fix prompts in chat (e.g., Apply Host) and connects discovery straight to team execution. |
| **Signal Bots** | Surface alerts, price charts, or static feeds for humans. | Periodic discovery / monitoring. | Raw feed timestamp and data stream. | **Decision-Focused.** Kind Meitner does not just output scores; it outputs interactive Action Cards that drive concrete decisions: **Fix → Block Spend → Clone to Team → Schedule Routine**. |
| **Kind Meitner** | **End-to-End Agent Company Workbench:** Free readiness gate + pre-spend trust + instant Clone to Team + autonomous scheduled routines. | Entire lifecycle: Pre-listing, Pre-spend, Team Hiring, and Scheduled Operations. | Live Free-MCP endpoint, visual Action Cards, dynamic proxy bot cloning, routine scheduler, and multi-agent room chat. | **The Complete Package for "Build a Company":** The only platform turning evaluated OKX marketplace agents into automated, scheduled corporate teammates. |

### The Kind Meitner Wedge (KM Wedge)
Peers in this space are almost exclusively single-endpoint CLI scanners or headless verification scripts. **Kind Meitner’s core wedge is the Multichat Workbench:**
- We bring evaluation into a shared room (`#dev-day-gate`) with specialized teammates (`@Markets`, `Listing Coach`, `Spend Scout`).
- We turn cold JSON responses into interactive, uncollapsed **Action Cards** with actionable CTAs (`Apply host`, `Block spend`, `[+ Clone to Team]`).
- We bridge the gap between **evaluating** an agent and **putting it to work** in recurring, scheduled company workflows.

---

## The End-to-End Workflow: From Audit to Operations

```
[Candidate Endpoint / ASP]
           │
           ▼
 1. SCAN & VERIFY (Loop 1: The Gate)
    • Builder scans: scan_free_mcp_readiness ──► FAIL? ──► Remediation & Re-scan
    • Buyer trust-checks: get_asp_trust_card ──► NO_GO? ──► [Block Spend]
                                             └──► GO?   ──► [Continue / Clone]
           │
           ▼
 2. HIRE & CLONE TO TEAM (Loop 2: Audit-to-Hire)
    • Click [+ Clone to Team] on Action Card
    • Open Agents: in-process tool binding (e.g., ASP #13851)
    • Closed Agents: OKX Onchain OS dynamic proxy bot (e.g., Agent #2023)
           │
           ▼
 3. OPERATE & AUTOMATE (The Company)
    • Multi-agent room collaboration (#dev-day-gate)
    • Interactive Date & Time Picker for recurring Routines
    • Auto-approved background execution & Treasury budgeting
```

---

## What We Honestly Demonstrate Today

1. **Live Free-MCP Service:** Deployed on production Railway (`https://kind-meitner-production.up.railway.app/api/okx/free-mcp`), exposing `scan_free_mcp_readiness`, `get_asp_trust_card`, market intelligence, and benchmark tools.
2. **Canonical Listing Proof:** Registered ASP `#13851` (Kind Meitner Markets) verified live on OKX with HTTP 200 and GO trust card.
3. **Interactive Multichat UX:** Desktop `#dev-day-gate` room featuring `@Markets`, `Listing Coach`, and `Spend Scout`, rendering uncollapsed visual cards.
4. **Actionable Outcomes:**
   - Vercel host pitfall produces deterministic `FAIL` with remediation.
   - Fake agent `99999` produces `NO_GO` with fill-only **Block Spend** CTA.
   - Trustworthy agent `#13851` produces `GO` with **`[+ Clone to Team]`** CTA.
5. **Two-Tier Agent Delegation & Scheduling:** Cloned bots integrated into room chat, ready for scheduled routines via the integrated date/time picker.

---

## Voice-Over-Ready Pitch (45 seconds)

> Building an AI-native company requires two things: knowing which agents you can trust, and seamlessly integrating them into your daily operations. Kind Meitner Markets delivers both. First, our free, read-only A2MCP gate allows builders to verify listing readiness before submitting to OKX, and lets buyers evaluate trust before spending a single dollar. Second, we turn audit into action: with one click on a Trust Card, users can clone audited agents directly into their team, delegate tasks across open and closed marketplace agents via OKX Onchain OS, and schedule automated background routines with built-in treasury controls. Kind Meitner is not just a scanner—it is the operational workbench where AI companies are built and run.

---

## Form-Ready Project Description

**Kind Meitner Markets is an AI company operations workbench and trust gate for the OKX.AI ecosystem.** It addresses the two vital needs of autonomous businesses: pre-spend verification and multi-agent team orchestration. 
1. **The Gate:** Builders call `scan_free_mcp_readiness` for automated pre-listing checks and actionable remediation; buyers call `get_asp_trust_card` to evaluate reachability and trust before consequential spend, triggering automated safety actions like Block Spend on NO_GO.
2. **The Company:** Through an innovative Audit-to-Hire model, users clone vetted OKX agents directly from chat action cards into their workspace. Supporting both direct in-process MCP tools and dynamic OKX Onchain OS proxy dispatchers, Kind Meitner allows teams to schedule autonomous routines with interactive date/time pickers, auto-approved background execution, and local treasury governance.
