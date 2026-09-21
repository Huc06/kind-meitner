# OKX Dev Day video materials — issue #27

**Purpose:** a capture-ready, 2–4 minute demonstration of Kind Meitner Markets as a free, read-only readiness and pre-spend gate for OKX.AI agents. This is a plan and evidence checklist—not a claim that a video, deployment, listing, or external-agent proof already exists.

The official [OKX Dev Day 2026 Builder Kit](https://www.okx.com/en-us/learn/okx-dev-day-builder-kit) says the project package includes a **2–4 minute video** that demonstrates the working product and integration. It also requires a product/listing/deployment URL where available, and asks existing projects to identify build-period work with commit evidence. The public Builder Kit was reviewed on 2026-09-22; dates, form requirements, and acceptance status must be rechecked by the submitting human before any submission.

## Claim boundary — read before capture

The demo tells one bounded story: Builder and Buyer agents use `scan_free_mcp_readiness` and `get_asp_trust_card` in `#dev-day-gate`; the resulting verdict changes their next action. The product is **free, read-only, paymentless**, and does not use a wallet, custody, settlement, mainnet, or an OKX endorsement. A `GO` is not payment approval.

| Evidence state | May say/show | Must not say/show as completed |
| --- | --- | --- |
| Isolated local fixture | `tools/list` exposes both gate tools; a `*.vercel.app` candidate fails locally without probing it; missing inputs fail; `#dev-day-gate` can be seeded. Label every fixture frame **LOCAL FIXTURE · NO EXTERNAL NETWORK**. | A public HTTPS `PASS`, public listing, independent external-agent call, public UI deployment, payment, settlement, or OKX review/approval. |
| Human-verified public deployment | A dated public HTTPS `tools/list` and scan/trust output whose URL, UTC time, status, redacted request/response, and `notChecked` limits are preserved. | Any broader claim than the captured response proves. In particular, no marketplace, payment, or endorsement claim. |
| ASP listing under review/unavailable | The Free A2MCP implementation and local fixture workflow; the listing status exactly as **under review**, **unavailable**, or **not verified**. | That ASP #13837 is approved, callable through OKX, or reviewed by OKX. |

Use the [judge guide](okx-dev-day-judge.md), [evidence register](evidence/dev-day/README.md), and [Free A2MCP launch guide](free-a2mcp-asp.md) as the source of truth for the contract and limits.

## URLs and artifacts to show

Show a URL only after the condition in the right-hand column is met. Do not open a wallet, credentials page, payment route, or the submission form during capture.

| On-screen item | URL/value | When it may be shown |
| --- | --- | --- |
| Public Free A2MCP route | `https://<verified-public-host>/api/okx/free-mcp` | Only after a human verifies this exact deployed HTTPS host. Keep `<verified-public-host>` on drafts/fixture footage. |
| Local fixture route | `http://127.0.0.1:<fixture-port>/api/okx/free-mcp` | Only in a clearly labelled local-fixture shot; the scanner must be shown rejecting it as non-public if it is used as a scan target. |
| Builder failure candidate | `https://demo.vercel.app/api/okx/free-mcp` | Safe deterministic fixture demonstration: this candidate produces the known host-pitfall `FAIL`; it is not proof that any live Vercel service was contacted. |
| Builder repaired candidate | `https://<verified-public-host>/api/okx/free-mcp` | Only with a human-collected public HTTPS result. Otherwise preserve the placeholder or use the fallback described below. |
| Repository / build delta | Repository URL selected by the submitter; `git log --since='2026-09-17' --until='2026-09-26' --format='%h %ad %s' --date=short` | Show the exact branch/commit range that the human will submit; do not imply a different repository is the submitted source. |
| Evidence register | `docs/evidence/dev-day/README.md` | Always; use it to make local/public boundaries visible. |
| Official builder reference | <https://www.okx.com/en-us/learn/okx-dev-day-builder-kit> | Optional end card or accompanying material. It is a public reference, not proof of team acceptance or submission. |
| Official OKX.AI references | <https://web3.okx.com/onchainos/dev-docs/okxai/howtomcp> and <https://web3.okx.com/onchainos/dev-docs/okxai/registerasp> | Optional end card; do not show a logged-in portal or submission workflow. |

## 2:50 multichat room-scroll shot list and narration

**Format:** one continuous desktop capture of `#dev-day-gate`, with only a short evidence closeout. Keep the sidebar and three room members visible. The presenter should scroll naturally between turns, pause long enough to read a card, and avoid a split-screen tool tour. Total planned runtime is **2:50**, within the required 2–4 minutes.

| Time | Camera / visible evidence | Narration (or on-screen captions) | Required truth label |
| --- | --- | --- | --- |
| 0:00–0:15 | Wide shot: sidebar, `Dev Day` section, `#dev-day-gate`, and Markets, Builder/Listing Coach, Buyer/Spend Scout. Pinned bulletin: “Gate before list · Gate before spend · Free A2MCP only.” | “Kind Meitner Markets is a free, read-only gate for agents before they list a Free A2MCP endpoint or take a consequential next step. The room is the workflow: one agent asks, the gate returns evidence, and another changes what it does.” | If local: **LOCAL FIXTURE · NO EXTERNAL NETWORK**. |
| 0:15–0:45 | Builder proposes `https://demo.vercel.app/api/okx/free-mcp`; Markets activity shows `scan_free_mcp_readiness`; scroll to the `FAIL` Run Card and its Vercel-specific remediation. | “The Builder starts with a host shape that the readiness gate rejects. This FAIL is not a score: it includes a concrete remediation. The Builder does not submit from a failing result.” | “Known host-pitfall result; no live Vercel probe.” |
| 0:45–1:10 | Builder quotes the remediation and posts the repaired endpoint. If public proof exists, scroll to the dated `PASS`/`WARN` card with expanded evidence; otherwise show the fallback card/text below. | “After changing the endpoint, the Builder re-scans. We only call this public readiness when a human has saved the exact HTTPS URL, UTC time, and response. The local fixture proves the protocol behavior, not a deployment.” | Public run: host + UTC + **PUBLIC HTTPS EVIDENCE**. Fallback: **LOCAL FIXTURE — PUBLIC PASS PENDING**. |
| 1:10–1:38 | Buyer asks Markets to trust-check the deliberately bad/unreachable example; scroll to `NO_GO`, `notChecked`, and safe next step. Buyer replies “Skipping pay / target call.” | “The Buyer gets a NO_GO and stops. The card names what was observed, what was not checked, and the safe next step. It is not a payment decision or an OKX reputation claim.” | “NO_GO · no payment or target call performed.” |
| 1:38–2:08 | Buyer asks for agent `13837` plus the verified endpoint **only if** a public proof is available; show `GO` or `CAUTION`, `notChecked`, then a direct free `tools/list`/free-tool call. | “For a verified public endpoint, the Buyer may proceed only with the bounded free action. GO is not approval to pay. The product does not move money, hold funds, or settle a transaction.” | “PUBLIC HTTPS EVIDENCE” or use the under-review fallback—never fabricate `GO`. |
| 2:08–2:30 | Keep both Builder and Buyer reactions in the scroll: `FAIL → fix → re-scan` and `NO_GO → do not call`. Briefly expand raw evidence/provenance on a card. | “The value is the changed next action: fix before listing, or stop before a risky first call. The desktop is an operations view of the same agent-callable, read-only evidence.” | Preserve `notChecked` and local-provenance text onscreen. |
| 2:30–2:50 | Evidence-register close: show fixture JSON/test output and, if available, the separate dated public transcript. End on `#dev-day-gate`, not a dashboard. | “Today’s checked-in evidence is a disposable local fixture. A public deployment, listing status, external-agent transcript, recording, and submission remain human gates. We show only the proof we have.” | **Fixture proof ≠ deployment/listing/payment proof.** |

### ASP #13837 under-review fallback

If ASP #13837 is still under review, unavailable, or cannot be independently verified when recording, replace 0:45–1:10 and 1:38–2:08 with this continuous room story:

1. Leave the repaired URL as `https://<verified-public-host>/api/okx/free-mcp` only if a human has a public transcript; otherwise show `https://<public-host-pending>/api/okx/free-mcp` and a visible “public verification pending” note.
2. Show the deterministic Builder `FAIL` and remediation from the isolated fixture, then Builder says: “I will re-scan after public HTTPS deployment; I will not submit this endpoint from fixture evidence.”
3. Show Buyer `NO_GO` for the bad candidate and: “ASP #13837 is under review / unverified; do not pay or call a target service from this result.”
4. Close on `tools/list` in the local fixture, labelled **LOCAL FIXTURE · NO EXTERNAL NETWORK**, and the evidence register’s pending-gates table.

This fallback still demonstrates the actual decision workflow without claiming listing approval, an external call, a `PASS`, a `GO`, or a deployment. Do not substitute a screenshot, mock card, or manually edited success result for missing public evidence.

## Exact preflight checklist (before the human records)

All boxes are mandatory; stop capture when any fails.

1. [ ] **Human ownership:** a named human confirms authority to record the selected app/fixture, public URL, repository, and any visible account names.
2. [ ] **Scope:** the selected story is `#dev-day-gate` with Markets, Builder, and Buyer; no payment, wallet, API key, secret, browser profile, customer data, submission form, or production-admin screen will be opened.
3. [ ] **Evidence classification:** choose exactly one capture mode: `local fixture only`, `public HTTPS verified`, or `ASP under review fallback`. Add its truth label to the recording layout before any capture.
4. [ ] **Fixture isolation:** for local mode, launch only the disposable fixture using `node --experimental-strip-types scripts/control-kind-meitner.ts launch` or the evidence collector; confirm the printed URL is loopback and the temporary data directory is disposable. Do not target a running app.
5. [ ] **Public proof gate:** for public mode, a human has collected and reviewed the exact URL, UTC timestamp, HTTP status, redacted request/response, `notChecked` fields, and the matching on-screen card. If any item is absent, select the fallback.
6. [ ] **Listing gate:** the human has recorded the actual listing state as approved, under review, unavailable, or not verified. The narration matches that exact state; no status is inferred from an ID, repository, or fixture.
7. [ ] **Clean room:** seed/rehearse the three-member room with only synthetic demo text. Ensure the Builder failure and Buyer NO_GO messages are visible in scroll order and no sensitive history remains above/below the planned crop.
8. [ ] **Tool-output integrity:** use actual generated cards/responses. Do not hand-edit verdicts, timestamps, IDs, raw evidence, tool traces, or `notChecked` lists.
9. [ ] **Recorder hygiene:** close notifications; set Do Not Disturb; hide bookmarks/tabs; use a neutral desktop; crop browser chrome if it reveals private data; check audio input, system audio, resolution, and readable font size.
10. [ ] **Narration rehearsal:** time the full narration at 2:40–3:10; retain pauses for `FAIL`, remediation, `NO_GO`, `notChecked`, and evidence labels. Remove any claim of live prices, reputation, payment, settlement, mainnet, custody, revenue, or OKX endorsement.
11. [ ] **Capture destination:** save a local draft with a date/version; do not upload, share, publish, or submit it from the recorder workflow.

## Exact recording checklist (human-only execution)

1. [ ] Start a new recording only after every preflight box is checked; announce the selected mode in the first frame.
2. [ ] Record the timed shot list in order, keeping a single continuous multichat scroll for 0:00–2:30.
3. [ ] Hold each verdict card long enough to read its decision and limits; do not cut around `notChecked`, local provenance, `CAUTION`, or failed/under-review states.
4. [ ] When showing a URL, show the exact captured public host and UTC evidence or the literal pending placeholder—not a lookalike or unaudited hostname.
5. [ ] If any popup, secret, customer content, logged-in account, unstable result, or inaccurate narration appears, stop the recording; discard that take locally and return to preflight.
6. [ ] End on the evidence boundary and human gates. Save the local draft; do not publish, send, upload, submit, or merge anything as part of recording.
7. [ ] Review the full local take at normal speed. Confirm duration is 2:00–4:00, all truth labels are legible, no secrets/PII are visible, and narration matches the captured evidence.

## Capture evidence list

Store only redacted, dated artifacts under `docs/evidence/dev-day/` when a human authorizes their inclusion. Each artifact must state its source, UTC time, environment, command/steps, status, and what it does **not** prove.

| Artifact | Minimum contents | State now |
| --- | --- | --- |
| Local fixture JSON | `fixture-free-mcp.json`, collector command, `externalNetworkAccess: false`, tool names, Vercel `FAIL`, invalid-input errors, and seeded-room result. | Existing local evidence. |
| Targeted test output | `pnpm vitest run server/okx/free-mcp.test.ts server/okx/dev-day-gate.test.ts server/okx/dev-day-judge-docs.test.ts` output. | Existing targeted evidence; re-run after material changes. |
| Room capture manifest | Capture mode, room roster, synthetic-message confirmation, take filename/hash, duration, source URL(s), UTC time, visible labels, and reviewer. | Pending human capture. |
| Public HTTPS transcript | Redacted `tools/list`, readiness, and trust-card requests/responses; exact host, UTC, HTTP status, and `notChecked`. | Pending human/deploy approval. |
| Listing-state record | Official source URL, observed state/time, redacted screenshot if permitted, and label `approved`, `under review`, `unavailable`, or `not verified`. | Pending listing owner. |
| Independent agent transcript | Independent operator/agent, tool call and result, date/time, redactions, and limits. | Pending external operator. |
| Build-window delta | Repository URL plus commit log covering the official build period and a concise list of submission-relevant changes. | Human selects final submitted commit range. |
| Final video review | Local file name/hash, duration, full-screen review checklist, and explicit human record/publish approvals. | Pending human approval. |

## Human-only gates

These are deliberate stop points. No agent or automated workflow may pass them, and this issue does not authorize recording, publication, deployment, listing changes, form submission, or merging.

| Gate | Human must decide/perform | Evidence required before passing |
| --- | --- | --- |
| Record | Approve the selected capture mode, verify participant/data authority, run the recorder, and review the local take. | Completed preflight and recording checklists; local reviewed draft. |
| Deploy / public probe | Approve deployment and target host, then collect redacted public HTTPS evidence. | Exact URL, UTC, request/response, and endpoint/status review. |
| ASP/listing | Check or update the official listing and describe its actual status. | Official source and timestamp; no inference from fixture or ID. |
| Publish | Approve final title, video, privacy/rights, disclosure labels, and destination; upload/publish manually. | Full local review, final evidence manifest, and explicit owner approval. |
| Submit | Complete the official form and its declaration manually. | Human-confirmed accurate links, team/track, build delta, and final media. |

## Draft PR and material-decision text (do not post automatically)

The local commit should be proposed as a **Draft PR** from `docs/issue-27-video-materials` into `docs/issue-28-positioning`.

**Draft PR title:** `docs: add Dev Day video capture materials`

**Draft PR body:**

> ## Summary
> Adds a 2:50 multichat `#dev-day-gate` shot list, narration, capture/evidence checklist, public-URL boundaries, an ASP-under-review fallback, and explicit human-only record/publish gates for Dev Day video materials.
>
> ## Verification
> - `pnpm vitest run server/okx/free-mcp.test.ts server/okx/dev-day-gate.test.ts server/okx/dev-day-judge-docs.test.ts`
> - Documentation diff review confirms the plan does not claim a public deployment, listing approval, external-agent call, payment, settlement, or published video.
>
> ## Human gates remaining
> Recording, deployment/public probe, listing verification, publication, and form submission remain manual and are not performed by this PR.

**Material decision comment:**

> **Material decision:** Record the hero as one `#dev-day-gate` room scroll, not a dashboard or A/B tool tour. The evidence boundary is part of the story: use a verified public HTTPS PASS/GO only with dated, redacted artifacts; otherwise use the labelled local-fixture/ASP-under-review fallback and show FAIL→fix intent plus NO_GO→do-not-call. No recording, deployment, listing update, publishing, or form submission is authorized by this documentation change.

## Review before handoff

Before creating or updating a PR, the human reviewer should confirm:

- [ ] The public Builder Kit link is still available and still specifies a 2–4 minute working-product/integration video.
- [ ] Every recorded statement matches the selected evidence state and the visible labels.
- [ ] The finished take contains no deployment/listing/payment/endorsement claim beyond collected evidence.
- [ ] The fallback is used when public HTTPS or ASP approval is missing.
- [ ] The PR is marked Draft, targets `docs/issue-28-positioning`, and contains only documentation/material changes.
- [ ] The material-decision comment is reviewed and manually posted only if the project owner chooses to do so.
