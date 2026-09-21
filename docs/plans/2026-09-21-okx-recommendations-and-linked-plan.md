# Kind Meitner: detailed plan, links, and recommendations

Plain language. No codes like S2 or F1.

This is the file to read when the short easy doc feels too thin. It connects every piece, then adds what I (Grok Bot, planning) recommend you change or add so the show is stronger and less buggy.


## Map of documents (what to open when)

1. This file  
   Full story, links, and my recommendations.

2. Easy checklist  
   `docs/plans/2026-09-21-okx-feature-uiux-easy.md`  
   Day to day build list in short form.

3. CI and bug bars  
   `docs/plans/2026-09-21-okx-feature-uiux-ci-nobugs.md`  
   Exact tests CI must run. Use when writing vitest.

4. Show verify smoke  
   `docs/plans/2026-09-21-okx-feature-uiux-show-verify.md`  
   How to prove the app is not a fake demo.

5. Interact intent  
   `docs/plans/2026-09-21-okx-hackathon-interact-execute.md`  
   Why buttons matter more than JSON on screen.

6. Field level schemas  
   `docs/plans/2026-09-21-okx-feature-uiux-spec.md`  
   Input and output shapes if you need them.

7. Free MCP contract already in repo  
   `docs/free-a2mcp-asp.md`  
   How the public endpoint must stay free.

8. Master GitHub tracker  
   Issue https://github.com/Huc06/kind-meitner/issues/31


## Map of GitHub work (linked)

Build in this order. Each item links to the issue.

1. Listing readiness scan tool  
   https://github.com/Huc06/kind-meitner/issues/23  
   Server work first. Must be live on Railway before cards matter.

2. Pre spend trust tool  
   https://github.com/Huc06/kind-meitner/issues/24  
   Reuse the same probe helper as the scan tool.

3. Evidence folder and judge facing README notes  
   https://github.com/Huc06/kind-meitner/issues/26  
   Curl transcripts after the tools exist. Not a fake screenshot of JSON as the product.

4. Action cards in chat  
   https://github.com/Huc06/kind-meitner/issues/29  
   Apply host, Run scan again, Block spend, Continue with free tools. Buttons must create real turns.

5. Dev Day Gate room seed and chips  
   https://github.com/Huc06/kind-meitner/issues/30  
   One room, three seats, chips fill composer only.

6. Listing Coach and Spend Scout in catalog  
   https://github.com/Huc06/kind-meitner/issues/20  
   So the room has real roles, not one bot renamed three times.

7. Chart avatars  
   https://github.com/Huc06/kind-meitner/issues/17  
   Looks like OKX agents. Do this before you care about screenshots.

8. ASP listing page follow up  
   https://github.com/Huc06/kind-meitner/issues/18  
   https://www.okx.ai/agents/13837  
   Endpoint: `https://kind-meitner-production.up.railway.app/api/okx/free-mcp`

Hold for later (not the product spine):

1. Welcome shell PR https://github.com/Huc06/kind-meitner/pull/16 (CI red)
2. Sidebar PR that drops OKX views https://github.com/Huc06/kind-meitner/pull/15 (do not merge into the show path)
3. Chore docs https://github.com/Huc06/kind-meitner/pull/14


## Product in one paragraph

Kind Meitner Markets is a free gate other agents call before listing or before spending. Inside the desktop app you operate that gate in a shared room. Listing Coach brings a URL. Markets runs a real scan. You hit Apply host and Run scan again until it passes. Spend Scout asks for trust. You Block spend on a bad id or Continue only when trust says GO, and Continue must fire a real free tool. The wire still returns structured data for agents. People see action cards and new tool rows, not a JSON envelope as the hero.


## Detailed feature: listing readiness scan

### Purpose
Stop builders from burning days on listing review when the endpoint host or shape is already wrong.

### Behavior
1. Input is an https URL (optional agent id only echoed).
2. If host is vercel.app, FAIL with a clear fix: use Railway or a custom domain because OKX listing tests reject vercel.app.
3. Otherwise POST tools/list to that URL with an eight second timeout.
4. FAIL on timeout, 402 on discovery, bad JSON, or missing tools list.
5. PASS or WARN only from live results.
6. Response stays a free resource (no wallet, no payment, no mainnet).

### How this links
Issue 23. CI cases in the CI doc (server list tests). Show path step “scan vercel then scan Railway” in the easy doc. Probe helper shared with trust tool (issue 24).


## Detailed feature: pre spend trust

### Purpose
Stop buyer side agents from talking about pay when the ASP page is dead or the endpoint is not callable.

### Behavior
1. Input is agent id. Optional endpoint URL.
2. GET the public okx.ai agent page.
3. If endpoint given, run the readiness helper.
4. Decision only GO, CAUTION, or NO_GO.
5. Always list what you did not check (credit, settlements, endorsement).
6. Always give a next step sentence the UI can show and the Block or Continue buttons can follow.

### How this links
Issue 24. Trust card UI in issue 29. Spend Scout prompts in issue 20. Continue must call an existing free tool such as get_free_a2mcp_launch_checklist (already on Free MCP today).


## Detailed UI: action cards

### Readiness card
Shows verdict, host, human check lines, fix lines.
Buttons: Apply suggested host, Run scan again, Copy fix.
Evidence collapsed.
React key is the tool message id so old FAIL does not morph into PASS.

### Trust card
Shows decision, signals, not verified chips, next step.
Buttons: Block spend, Continue with free tools (GO only), Re check agent.
Continue disabled on NO_GO.

### How this links
Issue 29. Parser shared with server shapes from the field spec doc. UI unit tests in the CI doc. Interact intent doc explains why these buttons exist.


## Detailed UI: room

Name: Dev Day Gate.
Members: Markets, Listing Coach, Spend Scout.
Bulletin about gate before list and spend.
Chips fill composer. User sends.
Seed is idempotent.

### How this links
Issue 30. Catalog issue 20. Avatars issue 17. GroupView already supports rooms and tool chips in the app today.


## My recommendations (planning POV)

These are improvements I want you to take seriously. They are ordered by leverage.


### Recommendation 1: Ship the tools before any pretty card

If Railway does not list both new tools, the room is theater. Merge server PRs with the CI tests first. Cards second.

Why: every fake demo risk starts when UI is built against imaginary payloads.


### Recommendation 2: One shared parser for tool text

Put parse logic in one module used by GroupView, ChatView, and tests. If JSON is bad, show the normal tool error, never a decorative PASS card.

Why: UI and server drifting is how you get “looks PASS in UI, curl says FAIL”.


### Recommendation 3: Continue only on GO, not on CAUTION

CAUTION should push Re check or Block, not Continue. That keeps the show honest when listing is up but endpoint was not probed.

Why: Continue is the strongest claim in the UI. Reserve it for the clean path.


### Recommendation 4: Apply host should paste a real known good URL

Use the production Free MCP URL as the default suggested host when the failure was vercel. Do not paste vague advice only.

Why: the next Run scan again must be one Enter away from PASS. That is the impact moment.


### Recommendation 5: Make Listing Coach and Spend Scout thin wrappers around Markets

Their job is to ask Markets to run tools and narrate. They must not invent verdicts. Put that in system prompts and keep prompts short.

Why: multi agent show fails when one model hallucinates a FAIL without a tool row.


### Recommendation 6: Deterministic vercel FAIL without network in CI

Host rule runs before fetch. Tests stay green offline.

Why: flaky CI will tempt people to stub PASS.


### Recommendation 7: Cap concurrent scans and disable CTA while Markets is busy

Double click must not fire five scans. Disable Run scan again while toolInFlight for Markets.

Why: race bugs look like “random FAIL” in the show.


### Recommendation 8: Do not merge the PR that drops OKX views into this path

PR 15 reworks chat and removes OKX view routing. Keep it away until after the gate show is stable.

Why: you can lose invite and room affordances you still need.


### Recommendation 9: Treat ASP 13837 copy as product surface

Even while under review, title and description should name readiness and trust in plain words and keep fee zero. Empty title on the listing page weakens the company story.

Why: judges and external agents land on that URL.


### Recommendation 10: Add a tiny “last run” line under the card

One line: “Scanned 12s ago · 412ms · 5 tools”. Taken from the payload. Helps you spot stubs (0ms every time is suspicious).

Why: easy realness check without opening Evidence.


### Recommendation 11: Prefer mentions routing in the room

So @Markets, @Listing Coach, @Spend Scout stay clear on camera and in tests.

Why: defaultResponder quirks can make the wrong bot talk.


### Recommendation 12: Keep trending and invite demos out of the hero path

They can exist. They must not replace the gate loops.

Why: Build X style winners were rails other agents call, not catalog tourism.


### Recommendation 13: Write curl outputs into docs/evidence/dev-day after each Railway deploy

PASS self, FAIL vercel, trust samples. Same folder issue 26 asks for.

Why: you can recheck without the app when something regresses.


### Recommendation 14: Freeze feature scope once both loops work in the room

Polish avatars and README after. Do not open welcome shell work until loops are real.

Why: calendar pressure makes scope the main bug.


## Extra feature ideas I recommend if you have spare time after loops work

Only after readiness, trust, cards, and room are real.

1. Compare two URLs side by side in one card (before and after host fix) using two real scans already in the transcript. No new server tool required if you render two message cards.

2. “Safe catalog” soft warning when trust is CAUTION: Scout lists which free tools are allowed. Still no pay language.

3. Export the last gate run as a short markdown snippet for builders to paste into their listing notes. Generated from the same payload the card shows.

4. Rate limit message in the card when the server rejects overload, so the show fails loudly instead of hanging.

Do not do these instead of the core loops.


## Risks I want you to watch

1. Building cards against fixture JSON in Storybook and never hitting Railway.
2. Seeding a finished transcript for screenshots.
3. Merging red CI by ignoring avatar width failures in unrelated PRs and assuming gate tests are fine.
4. Letting Spend Scout say “you can pay” on CAUTION.
5. SSRF open to localhost from a crafted URL in a public Free MCP.


## What “good” looks like when you check later

1. curl on Railway lists both tools.
2. vercel scan FAIL with vercel mentioned in fixes.
3. self scan PASS or WARN with nonzero latency sometimes.
4. In the room, two scan activities with different ids for FAIL then PASS.
5. NO_GO then Block creates a new refuse message.
6. GO then Continue shows get_free_a2mcp_launch_checklist (or the free tool you chose) as a real activity.
7. Guard test passes. No force pass strings in production source.


## Suggested next actions (people)

Hulk: open a branch for the readiness tool from main, add the server tests from the CI doc, deploy Railway, paste curl into issue 23.

You: when that lands, run the room smoke from the easy doc once. Comment pass or fail on issue 31 with what you saw.

Grok Bot: keep docs and issues aligned. No feature coding.


## One screen summary

Build real scan and trust tools.  
Show them as action cards in a three seat room.  
Buttons must create new tool turns.  
CI must ban fake PASS and prove vercel FAIL.  
My strongest advice: tools and CI first, cards second, room third, avatars fourth, everything else later.
