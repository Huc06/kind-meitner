# Dev Day evidence register

This directory distinguishes reproducible local proof from claims that require a human-approved deployment or external party. It deliberately contains no Railway curl output, listing screenshot, video, wallet/payment receipt, or external-agent transcript because none was collected for this change.

## Completed: isolated fixture evidence

Run from the repository root:

```sh
node --experimental-strip-types scripts/collect-dev-day-fixture-evidence.ts \
  --out docs/evidence/dev-day/fixture-free-mcp.json
pnpm vitest run server/okx/free-mcp.test.ts server/okx/dev-day-gate.test.ts
pnpm vitest run server/okx/dev-day-judge-docs.test.ts
```

The collector launches `launchVerificationServer`, which provides a temporary data directory, fake engine, and loopback server, then closes and removes it. It never discovers a running app and makes no outbound request. The committed [fixture-free-mcp.json](fixture-free-mcp.json) is its captured result; [fixture-test-output.txt](fixture-test-output.txt) records the targeted test command result.

What that evidence proves:

- `tools/list` includes `scan_free_mcp_readiness` and `get_asp_trust_card`, all annotated read-only;
- the scanner returns `FAIL` and Vercel-specific remediation for `https://demo.vercel.app/...` without probing it;
- both tools reject missing required input; and
- `POST /api/okx/dev-day-gate` creates the expected room in an isolated fixture.

It does **not** prove a public HTTPS `PASS` scan: a temporary loopback HTTP fixture is intentionally not a public target and the scanner blocks it.

## Pending: human/deploy gates

| Artifact | Gate | Required collection method | Status |
| --- | --- | --- | --- |
| Public Free MCP `tools/list` response | Human confirms a deployed public HTTPS host | Run the documented curl against that exact host; retain UTC time, HTTP status, response body, and redacted headers. | Pending — do not infer from fixture |
| Public readiness `PASS` | Same confirmed deployment | Run `BASE_URL=https://<verified-public-host> pnpm dev-day:smoke`; save stdout and raw responses. | Pending — do not run against Railway from automation |
| Public trust-card response | Confirmed public host and listing policy | Run JSON-RPC call with an agent ID; retain `notChecked` field. | Pending |
| Railway/live curl evidence | Deployment-owner approval | Human-run only; commit only redacted command/output. | Pending |
| Listing #13837 approval/status | OKX listing owner | Human checks official page and records timestamp/source. | Pending |
| Screenshot and 2–4 min video | Deployed UI plus human capture | Record a real public run; label host/date. | Pending |
| External-agent call proof | Independent external agent/operator | Preserve transcript with tool call/result and redactions. | Pending |
| x402 testnet receipt | Explicit reviewed testnet configuration | Follow `docs/x402-testnet-local.md`; no mainnet. | Pending and non-hero |

See [the judge guide](../../okx-dev-day-judge.md) for problem framing, tools, curl examples, limits, and the build-window delta.
