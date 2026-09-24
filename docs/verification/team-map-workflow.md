# Team Map workflow engine

Pure TypeScript state model for Team Map workflow demos (`src/lib/team-map-workflow.ts`).
No React. Demo/UI agents consume snapshots + `computeWowFacts`; they do not invent metrics.

## Prove

```sh
pnpm exec vitest run src/lib/team-map-workflow.test.ts --maxWorkers=2
```

## Contract

- `createEmptyWorkflow()` → empty snapshot (`startedAt: 0`).
- `applyEvent(snapshot, event)` → immutable next snapshot (event always appended).
- `transferOwnership(snapshot, { taskId, toAgentId, reason, at })` → `{ snapshot, transfer, events }` with every `OwnershipTransfer` field filled.
- `computeWowFacts(snapshot)` → counts/timings derived only from events/timestamps. Empty or unknown intervals → `null` (UI: **Not measured**). Never hardcode showcase numbers.
- Query helpers: `getActiveAgents`, `getWorkingAgents`, `getBlockedTasks`, `getCompletedTasks`, `getOwnershipTransfers`.

`testsExecuted` is always `null` until an event type records it.
