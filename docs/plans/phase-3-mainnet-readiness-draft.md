> **STATUS: DRAFT / RESEARCH ONLY — NOT APPROVED, NOT FOR IMPLEMENTATION.**
> This document does not authorize any mainnet variable, wallet, credential, feature flag, or paid endpoint. It does not certify Phase 2 as complete. It is planning material to accelerate Phase 3 once Phase 2 exit criteria are actually met and independent review/approval occurs, per `docs/plans/2026-09-15-okx-a2mcp-roadmap.md` Phase 3.

# Phase 3 mainnet readiness — planning draft

## 0. Precondition (partially met — see below)

Per the roadmap, Phase 3 work is only meaningful after Phase 2 exit criteria are met:

- The full protocol sequence (`402` → `PAYMENT-REQUIRED` → payment → SDK-verified settlement) is demonstrated on X Layer testnet (`eip155:1952`) with an integration test and a manual test producing a testnet-only receipt.
- `OKX_X402_TESTNET_ENABLED` remains off by default in production configuration.
- PR #7 is rebased, CI-green, and merged.

**This paragraph is superseded.** The original draft stated that PR #7 was open with failing CI and that no testnet evidence existed. Both statements have since been overtaken by events:

- **Third bullet — met.** PR #7 merged as `7b528bd3`.
- **Second bullet — met.** `OKX_X402_TESTNET_ENABLED` is read as a strict `=== "true"` comparison (`server/index.ts:6234`), so the route is off unless explicitly enabled.
- **First bullet — substantially met, with one gap.** A real X Layer testnet settlement has been performed and recorded in [`docs/x402-testnet-local.md`](../x402-testnet-local.md) §4. The receipt is independently verifiable on-chain:

  | Field | Value |
  | --- | --- |
  | Transaction | `0xe059043a5c61673610b4a0b82ba2b458a8217b9f2e4ddae042a78956337bb527` |
  | Chain ID | `0x7a0` (1952) — X Layer testnet, matching `eip155:1952` |
  | Receipt status | `0x1` (success), block 41,087,246 |
  | Token | `0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c` (test USD₮0) |
  | Settlement | `Transfer` of `10000` (= $0.01 at 6 decimals) to the configured recipient |
  | Replay control | `AuthorizationUsed` emitted — the EIP-3009 nonce was consumed |

  **The remaining gap is the automated half of the exit criterion.** The roadmap asks for "an integration test [that] demonstrates the entire x402 challenge/settlement sequence on testnet". `server/okx/x402-testnet.e2e.test.ts` declares itself `"(mock facilitator, no network or funds)"` — it proves the protocol shape, not a testnet settlement. The real settlement above was produced manually via `scripts/x402-testnet-buyer-sample.mjs`, not by a test.

This draft remains planning material. Phase 2 evidence existing does not authorize any mainnet variable, and Phase 3 still ends in a separate, human-approved mainnet change request.

## 1. Purpose

Phase 3, per the roadmap, produces "a decision document, not an automatic release." This draft organizes the six required evidence areas so that, once Phase 2 is genuinely exit-ready, the team can populate each section with real artifacts rather than starting from a blank page. No item below may be marked complete without a concrete, checkable artifact (test output, review report, signed document, dashboard link).

## 2. Required evidence areas

### 2.1 Independent security review

Scope, per roadmap wording: "transaction construction, SDK verification, recipient/asset/amount validation, and secrets."

Planning checklist (to execute against the real mainnet-candidate code, not testnet code, once it exists):
- Transaction/payload construction: validate recipient address, asset/token contract, amount, and network identifier are read from reviewed server-side configuration, never from client-supplied input.
- Nonce and replay handling: confirm each payment/settlement request is bound to a unique, server-tracked identifier and that a retried or duplicated request cannot be settled twice.
- Ordering and state-mutation safety: apply a checks-effects-interactions style discipline — validate and authorize before any balance/ledger mutation, and perform external calls (facilitator/chain) only after invariants are confirmed.
- Signer isolation: confirm the signer/credential used for mainnet is distinct from any testnet or development credential, is least-privilege scoped, and cannot be reached from client-side code or logs.
- SDK verification path: confirm settlement is only accepted from the official SDK's verified/settled response, never from a locally constructed or fallback representation.
- Reviewer independence: the review should be performed or countersigned by someone other than the implementer.

Artifact to produce later: a written review report naming the reviewer, scope, findings, and remediation status for each finding.

### 2.2 Balance, receipt, and execution model

Scope, per roadmap wording: "real balance provider, verified transaction/receipt model, serialized signer and nonce execution, and durable replay/idempotency controls."

Planning checklist:
- Balance source of truth: define whether balance is read live from chain/facilitator or from a local ledger reconciled against chain state, and how divergence is detected.
- Receipt model: define what constitutes a "settled" receipt (e.g., SDK-confirmed settlement object with a transaction hash) versus a "pending" or "submitted" state, and confirm only the former can mark a resource as paid.
- Serialized execution: if multiple requests can race for the same signer/nonce, define how requests are serialized or queued so nonce reuse or out-of-order submission cannot occur.
- Idempotency: define the durable key (e.g., request/session/payment ID) used to guarantee a repeated request cannot produce a second on-chain charge or a second local credit.
- Failure handling: define the exact behavior when the facilitator/chain call fails or times out after being sent — this must not silently resolve to "assume settled" or "assume failed" without reconciliation.

Artifact to produce later: a written model description plus tests demonstrating idempotent behavior under simulated duplicate/racing requests.

### 2.3 Incident response, key rotation, monitoring, and alerting

Scope, per roadmap wording: "explicit operator recovery, incident response, key rotation, monitoring, and alerting procedures."

Planning checklist, informed by general incident-response and key-management practice:
- Key rotation: maintain a rotation inventory (secret name, system, environment, owner, storage location, last rotation date) for `OKX_API_KEY`/`OKX_SECRET_KEY`/`OKX_PASSPHRASE`; define a rotate-then-revoke sequence (create new credential, deploy, confirm working, then revoke the old one) so rotation never causes an outage; define minimum rotation cadence and mandatory immediate rotation on suspected exposure.
- Least privilege and scoping: mainnet credentials should be scoped as narrowly as the OKX Developer Portal allows (only the permissions the payment flow needs), separate from any testnet or other-purpose credential.
- Incident severity and ownership: define severity tiers for a payment incident (e.g., funds misdirected, duplicate settlement, credential leak, facilitator outage) with a named on-call owner and escalation path for each tier.
- Detection to containment: define the immediate containment step for each severity (e.g., disable the feature flag, rotate the exposed credential, pause the affected route) and who is authorized to execute it without waiting for further approval.
- Monitoring and alerting: monitor both infrastructure health (latency, error rate, facilitator availability) and business-level signals (settlement success rate, unexpected recipient/amount patterns, spend velocity) with alert thresholds tuned to avoid both missed incidents and alert fatigue.
- Reconciliation: define a recurring process that compares local ledger/records against on-chain/facilitator state and flags discrepancies.
- Post-incident review: require a written post-incident report for any triggered severity tier before resuming normal operation.

Artifact to produce later: a named on-call/escalation document, a rotation runbook, and evidence that monitoring/alerting is actually wired to a real channel (not just planned).

### 2.4 Rate-limit and abuse-control review

Scope, per roadmap wording: "Rate-limit and abuse-control review appropriate for public paid access."

Planning checklist:
- Layered limits: apply limits at the network/gateway level (raw request volume), the authentication level (per-credential or per-session), and the business-logic level (e.g., payment attempts per resource per time window), since a single layer is insufficient for a paid endpoint.
- Duplicate-payment risk: explicitly test that retries, double-clicks, or concurrent requests from the same caller cannot produce multiple real settlements for one logical purchase (ties into 2.2's idempotency control).
- Shared-state limiter: the current in-process rate limiter (noted in the roadmap's Phase 1 operational note as resetting on restart and being per-instance) is not sufficient for a horizontally scaled paid mainnet endpoint; a shared/edge limiter is required before that scenario applies.
- Abuse signals: define what an abusive pattern looks like for this endpoint (e.g., scraping paid content without payment, repeated failed payment attempts, credential probing) and what automatic response is appropriate (temporary block, CAPTCHA-equivalent, manual review).

Artifact to produce later: load/abuse test results demonstrating the limiter holds under concurrent and adversarial request patterns.

### 2.5 No-fallback-as-settled test plan

Scope, per roadmap wording: "A test plan demonstrating that no local fallback/generated value is reported as settled."

Planning checklist:
- Enumerate every code path that could produce a "success" response without an actual SDK-verified settlement (e.g., a caught exception that defaults to success, a local record created before chain confirmation, a mocked/fixture value left reachable in production).
- For each path, write a test that forces the failure/ambiguous condition and asserts the response is an explicit error or pending state — never a fabricated success or synthetic transaction hash.
- Confirm this applies uniformly to both the request-processing path and the settlement/receipt path, matching the discipline already applied in the testnet code (`x402PublicFailure` returning only `{ error, traceId }`, no raw provider detail).

Artifact to produce later: a test suite (or an explicit extension of the existing x402 test suite) covering these failure paths, plus a manual review sign-off that no other fallback path exists.

### 2.6 Written human approval

Scope, per roadmap wording: "Written human approval naming the network, assets, recipient, limits, and rollback owner."

Planning template (fields to complete, not to pre-fill):

```text
Mainnet change request — OKX x402 payment path

Network:              (e.g., eip155:196 — must be explicit, no default)
Asset(s):             (exact token contracts/symbols to be accepted)
Recipient address:    (exact payee address; who controls its key; how it was verified)
Per-transaction limit:
Rolling/period limit:
Feature flag(s) and their exact production value after this change:
Rollback owner:       (name + contact + how to execute rollback)
Monitoring dashboard/alert channel link:
Security review reference (2.1):
Evidence this is not a testnet-to-mainnet copy-paste of contract/recipient data:
Approver name, role, and date:
```

This form must be completed and signed by a named human approver — not generated or self-approved by an agent — before any mainnet variable is set, per the roadmap's explicit requirement that Phase 3 ends in "a separate mainnet change request," not an automatic deployment.

## 3. Explicit non-goals of this draft

- This document does not approve, schedule, or recommend a mainnet launch date.
- This document does not supply, infer, or validate any real mainnet contract address, recipient address, or credential.
- This document does not modify `OKX_X402_TESTNET_ENABLED` or introduce any mainnet-equivalent flag.
- Completing this draft's checklists is necessary but not sufficient for Phase 3 exit; the roadmap's exit criteria ("all items are evidenced and approved in a separate mainnet change request") still govern.

## 4. Suggested next steps (still Phase 2, not Phase 3)

1. ~~Fix CI on PR #7 and merge it.~~ Done — merged as `7b528bd3`.
2. ~~Run the **local** testnet exercise in `docs/x402-testnet-local.md`.~~ Done — a verified on-chain settlement is recorded in §4 of that runbook and reproduced in section 0 above.
3. Run the **Railway** half of that runbook (§5): set the service-scoped sealed variables, redeploy, re-run the self-check against the public HTTPS host, and capture a deployed-testnet receipt. Tracked in issue #8. **This is the current blocker for Phase 2 exit.**
4. Close the automated-test gap: either extend `x402-testnet.e2e.test.ts` with an opt-in testnet integration path (skipped by default so CI never spends funds), or record an explicit, reviewed waiver stating that the manual receipt satisfies this criterion.
5. Only after steps 3 and 4, begin populating section 2 of this draft with actual artifacts rather than checklist items.
