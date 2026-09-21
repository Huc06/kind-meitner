# OKX Dev Day 2026 — Submission package (issue #25)

**Status:** form-ready worksheet; not a submission or evidence of acceptance. **Owner:** submitting human. **Last public-guidance review:** 2026-09-22. **Form status:** deliberately not opened by this issue; copy the values below into the official form only after its live labels, required fields, character limits, and declarations are rechecked.

This package is for **Kind Meitner Markets**, the free, read-only readiness and pre-spend gate documented in the [positioning](okx-dev-day-positioning.md), [judge guide](okx-dev-day-judge.md), [evidence register](evidence/dev-day/README.md), and [video materials](okx-dev-day-video-materials.md). Those documents—not this worksheet—define the product contract, evidence limits, and recording plan.

## Official requirements and clock

The public [OKX Dev Day 2026 Builder Kit](https://www.okx.com/en-au/learn/okx-dev-day-builder-kit), reviewed without authentication on 2026-09-22, says that every team submits one complete package through the official form by **25 September 2026, 23:59 UTC**. It lists team/track/route, project summary, repository, a **2–4 minute working-product/integration demo video**, a product/deployment/test link where available, and an accuracy/event-guidelines declaration. Existing projects must identify the build-period features/integrations, supporting commit history, and a demo of the new functionality. The page also says the team receives an email receipt and must answer missing-link questions by email or Telegram within 24 hours.

| Clock item | Exact value | Human action |
| --- | --- | --- |
| Submission deadline | **2026-09-25 23:59 UTC (UTC+0)** | Submit before this time; do not treat a saved form as submitted. |
| Vietnam / ICT equivalent | **2026-09-26 06:59 ICT (UTC+7)** | Use this local deadline only as a convenience check. |
| Build-period dates | **17–25 Sep 2026** in the project plan; Builder Kit says online build continues until 25 Sep | Confirm any precise start/end interpretation in the live Builder Kit/form before declaring eligibility. |
| Snapshot countdown | **4 days, 5 hours, 4 minutes, 3 seconds** at 2026-09-22T01:54:57+07:00 | Recalculate immediately before submitting; this static number expires. |
| Official form | `https://forms.gle/81S2gnFCzqSoeDEA7` | Human-only: open, authenticate if needed, review, and submit. |

The public form itself was not opened because submission is a human-only gate. Therefore no claim is made that the table headings below are the form's exact current wording; they are the exact **values/placeholders** to reconcile with the live fields.

## Form-fill worksheet

### 1. Team, track, and participation route

| Form concept | Enter this exact value / placeholder | Verification before submit |
| --- | --- | --- |
| Team name | `[CONFIRM_TEAM_NAME]` | Use the accepted-team/roster name exactly; do not infer it from a GitHub account. |
| Team members | `[MEMBER_1_FULL_NAME + EMAIL]`; `[MEMBER_2_FULL_NAME + EMAIL]`; `[MEMBER_3_FULL_NAME + EMAIL]`; `[MEMBER_4_FULL_NAME + EMAIL]` | Keep only actual eligible members. Public guidance permits up to four members and one team per participant; confirm the final roster and consent. |
| Project name | `Kind Meitner Markets` | Keep this title consistent across repository, video, and form. |
| Primary track | **Build a Company** | This is the selected track: the product is an OKX AI agent/service and an agent discovery/coordination tool. |
| Participation route | `[CHOOSE EXACTLY ONE: Singapore finale | Remote Build]` | The project plan says “Singapore finale aim,” not confirmation. Select Singapore only if the team has the required status; otherwise select Remote Build. |
| Contact / submitting owner | `[HUMAN_OWNER_NAME + HUMAN_OWNER_EMAIL]` | Must be a person authorized to make the declaration and receive validation requests. |

### 2. Form-ready project copy

**One-line summary**

> Kind Meitner Markets is a free, read-only A2MCP readiness and pre-spend trust gate for OKX.AI agents: builders scan before listing and buyers get bounded GO/CAUTION/NO_GO guidance before a consequential service call.

**Project description**

> ASP builders can lose review cycles to a Free A2MCP endpoint that is not callable, while buyer agents can be asked to spend before basic endpoint signals are visible. Kind Meitner Markets exposes two free JSON-RPC tools at `POST /api/okx/free-mcp`: `scan_free_mcp_readiness` returns PASS/WARN/FAIL checks and remediation before a Free A2MCP listing; `get_asp_trust_card` returns GO/CAUTION/NO_GO, observed signals, explicit `notChecked` limits, and a safe next step before a consequential target call. The workflow changes behavior—FAIL means fix and re-scan; NO_GO means do not call/pay. The current surface is read-only and paymentless: it has no wallet, custody, settlement, mainnet, or live-market/OKX-endorsement claim. The repository provides isolated-fixture proof of the protocol and room workflow; public deployment, listing, external-agent, and video evidence remain clearly labelled human gates.

**Core integration statement**

> The project implements a free OKX.AI A2MCP-compatible JSON-RPC surface with discoverable read-only tools. The Dev Day delta adds the readiness scanner, trust-card contract, result cards, and an idempotent `#dev-day-gate` workflow that shows agents changing their next action. It intentionally does not claim x402 payment, settlement, custody, mainnet, or an OKX endorsement.

Use the [positioning’s form-ready description](okx-dev-day-positioning.md#form-ready-project-description) if the live form has a shorter field. Do not invent a character limit; trim only after viewing the field.

### 3. Links and evidence fields

| Form concept | Value to enter | Current evidence state / guardrail |
| --- | --- | --- |
| Repository | `https://github.com/Huc06/kind-meitner` | Human verifies that this is the intended reviewable repository and that the final commit/README are accessible. |
| Judge-facing technical guide | `[PUBLIC_REPOSITORY_URL]/blob/[FINAL_SUBMISSION_COMMIT]/docs/okx-dev-day-judge.md` | It links fixture evidence and names all live-proof limits. Replace both placeholders with the final public commit. |
| Evidence register | `[PUBLIC_REPOSITORY_URL]/tree/[FINAL_SUBMISSION_COMMIT]/docs/evidence/dev-day/` | Checked-in proof is local fixture evidence only; it is not public HTTPS, listing, payment, or external-agent proof. |
| Product/deployment URL | `[VERIFIED_PUBLIC_HTTPS_URL]/api/okx/free-mcp` **only after human verification** | If unavailable, use the exact truthful status required by the form: `Public deployment pending; no public HTTPS claim.` Never use a loopback URL or an unverified Railway/other host. |
| ASP/listing URL | `[OFFICIAL_LISTING_URL_IF_HUMAN_VERIFIED]` | If ASP #13837 is under review, unavailable, or unverified, state exactly `ASP #13837 status: [under review | unavailable | not verified]`; do not claim approval/callability. |
| Demo-video URL | `[PUBLIC_OR_REVIEWER-ACCESSIBLE_2_TO_4_MIN_VIDEO_URL]` | Required by the Builder Kit. It is currently **pending human recording, review, and publication**; do not submit a local filename, fabricated link, or fixture as a video. |
| Optional technical references | `docs/free-a2mcp-asp.md`; `docs/okx-dev-day-video-materials.md` at `[FINAL_SUBMISSION_COMMIT]` | Use only accessible, final links selected by the human reviewer. |

### Video / ASP-under-review fallback

Until a human has recorded and made the required video accessible, the honest field status is:

> **Video pending human record/review/publish; no public video URL exists in this package.** The available reproducible evidence is an isolated local fixture. Public HTTPS readiness, listing approval, external-agent calls, payment, settlement, and OKX review are not claimed.

If the listing remains under review or cannot be verified at recording time, use the [video materials’ ASP #13837 under-review fallback](okx-dev-day-video-materials.md#asp-13837-under-review-fallback): show the labelled local fixture, a deterministic Builder `FAIL` with remediation, and Buyer `NO_GO → do not call`; do **not** substitute a mock `PASS`/`GO` or declare the listing approved. This fallback supports truthful recording, but it does not remove the Builder Kit’s video requirement.

## Existing-project build-window delta

The project existed before Dev Day. Submit only the new readiness/trust work and its supporting evidence—not the pre-existing desktop application—as the build-period delta. The following commits were captured with:

```sh
git log --since='2026-09-17T00:00:00Z' --until='2026-09-26T00:00:00Z' \
  --format='%h %ad %s' --date=short
```

| Commit | Date | Submission-relevant addition |
| --- | --- | --- |
| `ea0f3e3` | 2026-09-22 | Free-MCP readiness scanner. |
| `90f1d53` | 2026-09-22 | ASP trust-card contract and explicit `notChecked` limits. |
| `6b1a6f2` | 2026-09-22 | Catalog roles used by the Dev Day workflow. |
| `6d90091` | 2026-09-22 | Readiness and trust result cards in the operations UI. |
| `4b90e41` | 2026-09-22 | Idempotent `#dev-day-gate` room seed and starter prompts. |
| `34e3e92` | 2026-09-22 | Reproducible fixture evidence, judge guide, and live-proof boundaries. |
| `67b8075` | 2026-09-22 | Product positioning and comparison limits. |
| `ff44e8d` | 2026-09-22 | Video capture plan, local/public evidence split, and recording gates. |
| `[FINAL_SUBMISSION_COMMIT]` | `[DATE]` | This submission package and any final, reviewed documentation-only adjustments. |

**Build-window delta prose for the form**

> During the Dev Day build window we added a Free A2MCP readiness scanner, an ASP trust-card contract with explicit limits, agent-facing readiness/trust result cards, and an idempotent `#dev-day-gate` workflow. We also added reproducible isolated-fixture evidence, judge documentation, positioning, and a capture plan. The commit list above identifies the implementation and documentation delta; the existing desktop application is not presented as newly built work.

Before submitting, regenerate the command output, select the actual final reviewed commit, and remove any commit that is not part of the submitted implementation. A new listing/deployment alone is not represented as qualifying functionality.

## Final human review and receipt checklist

### Before pressing submit

- [ ] Open the official Builder Kit and form; confirm the deadline, required fields, character limits, declarations, primary-track labels, route labels, and any changed requirements.
- [ ] Confirm `[CONFIRM_TEAM_NAME]`, every roster member, email/contact detail, eligibility, and exactly one participation route with the responsible human.
- [ ] Confirm **Build a Company** remains the single primary track and that every project statement matches the final code and evidence.
- [ ] Replace all `[PLACEHOLDERS]`; do not leave placeholders, a loopback URL, an unaudited host, or a claimed-but-inaccessible link.
- [ ] Verify repository visibility, final commit SHA, README/judge/evidence links, and every URL in a clean logged-out/private window as appropriate.
- [ ] Review the final 2–4 minute video in full: it shows the working product/integration, labels the selected evidence mode, preserves `notChecked` limits, and contains no secret, customer data, payment, deployment, listing, or endorsement claim beyond evidence.
- [ ] If public HTTPS proof is absent, use the labelled local-fixture/under-review fallback; do not claim `PASS`, `GO`, public deployment, listing approval, an external-agent call, payment, settlement, or OKX endorsement.
- [ ] Regenerate the build-window log; verify the delta table against final commit history and the live code.
- [ ] Read and affirm the form declaration only after all information is accurate and the submitter is authorized.

### Immediately after submission

- [ ] Capture the confirmation page/receipt locally, including UTC time, submitting owner, project/team name, and any submission ID—redacting personal data before sharing.
- [ ] Save the receipt email and record its received time; Builder Kit guidance says an email receipt follows submission.
- [ ] Record the final form answers, final commit SHA, repository URL, product/listing status, video URL, and video file hash/duration in a private team record.
- [ ] Monitor the declared team email and the official builder channel for validation messages until at least **2026-09-30**; reply within the published **24-hour** window if links or details are requested.
- [ ] Do not book non-refundable travel until the team receives written finalist confirmation.

## Explicit human-only gates

No agent or automation may clear these gates for this issue:

| Gate | Human-only decision/action | Minimum evidence before pass |
| --- | --- | --- |
| Record | Authorize inputs, run the recorder, and approve the local take. | Completed video preflight and full normal-speed review. |
| Deploy / public probe | Approve the host and collect public HTTPS output. | Exact URL, UTC time, status, redacted request/response, and `notChecked` fields. |
| Listing | Inspect/update the official listing and choose its exact status. | Official source, timestamp, and no inference from an ID or fixture. |
| Publish video | Approve title, rights/privacy, truth labels, destination, and upload/publish manually. | Reviewed final video, accessible link, file hash/duration, and owner approval. |
| Submit form | Review all form values/declaration and activate submit manually. | Accurate team/track/route, evidence links, 2–4 minute video, final delta, and authorization. |
| Receipt / validation | Retain confirmation and respond to organizer follow-ups. | Submission receipt and monitored team contact channel. |

## Handoff statement

This issue prepares content only. It does **not** open or submit the Google Form, record or publish a video, deploy/probe a public service, change an ASP listing, access external accounts, merge code, or claim submission/acceptance. The submitting human must complete every unchecked gate above.
