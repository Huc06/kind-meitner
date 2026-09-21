# Kind Meitner feature and UI show (easy read)

What to build. How it looks. How we know it really works and is not a fake demo. How CI must catch bugs.

No Telegram. No submit form. No prize schedule.

If something in older plan docs uses codes like "F1" or "S2", ignore those labels. Use the plain names in this file.


## What we are building

One shared room called Dev Day Gate with three agents:

1. Markets (runs the real Free MCP tools)
2. Listing Coach (builder seat)
3. Spend Scout (buyer seat)

Two real tools on the public Free MCP endpoint:

1. Listing readiness scan (checks an ASP URL before listing)
2. Pre spend trust check (checks an agent id before spend talk)

After each tool runs, the chat shows an action card with buttons that do something real (new scan, apply host, block spend, continue with a free tool). Not a JSON dump.


## Absolute rules (fake demo = reject)

1. The readiness tool must really look at the URL (or fail for a real host rule like vercel.app). Do not hardcode PASS.
2. The trust tool must really check the listing page and optional endpoint. Do not hardcode GO.
3. Every important button must create a new chat turn or a new tool activity. A button that only changes colors is a bug.
4. Production code must not contain names like DEMO_FORCE_PASS or alwaysReturnPass.
5. Do not seed a fake chat history that looks finished without tool activities.


## Feature: listing readiness scan

Name on the wire: scan_free_mcp_readiness

What it does when Markets calls it:

1. Needs an https URL.
2. If the host is vercel.app, return FAIL immediately and tell the user to use Railway or a custom domain. OKX listing tests reject vercel.app.
3. Otherwise POST tools/list to that URL with an 8 second timeout.
4. FAIL if the call times out, returns 402 on discovery, or does not return a normal tools list.
5. PASS or WARN only when the live check is healthy.
6. Always return free resource flags (no wallet, no payment, no mainnet).

Human labels on each check. Not cryptic ids as the only text.

Bugs to prevent:

1. Hanging forever on a dead host (must time out).
2. Calling internal addresses like localhost or cloud metadata IPs (must block).
3. Breaking the older free tools that already exist.
4. Returning PASS when the URL was http only.
5. Empty fix text on a vercel FAIL.


## Feature: pre spend trust check

Name on the wire: get_asp_trust_card

What it does:

1. Needs an agent id.
2. GETs the public okx.ai agent page for that id.
3. If an endpoint URL is also given, runs the same readiness helper.
4. Decision is only GO, CAUTION, or NO_GO.
5. Always includes a short list of things we did not check (on chain credit, settlements, OKX endorsement).
6. Always includes a plain "what to do next" sentence.

Bugs to prevent:

1. GO when the listing page is 404.
2. Missing "what we did not check".
3. Client UI flipping NO_GO to GO without a new tool result.


## UI: readiness action card

Show after a real readiness tool result.

What people see:

1. Big verdict: PASS, WARN, or FAIL
2. The host name
3. A short list of checks in normal language
4. A Fix section only if the server sent fix lines

Buttons that must work:

1. Apply suggested host  
   Puts a concrete https Railway (or fix) URL into the composer so the next send is real.

2. Run scan again  
   Starts another readiness tool call for the same URL (new activity in the transcript).

3. Copy fix  
   Copies the fix lines to the clipboard.

Evidence or raw JSON stays collapsed. Never the first thing on the card.

Card must use the message id as React key so an old FAIL card does not silently turn into PASS.


## UI: trust action card

Show after a real trust tool result.

What people see:

1. Big decision: GO, CAUTION, or NO_GO
2. Short signals (listing page, endpoint)
3. Chips for "not verified"
4. Next step sentence

Buttons:

1. Block spend  
   Creates a room message that refuses pay for that agent id.

2. Continue with free tools only  
   Enabled only on GO. Must trigger a real free tool call such as get_free_a2mcp_launch_checklist. New activity must appear.

3. Re check agent  
   Runs trust again for the same id.

On NO_GO, Continue must be disabled. The UI must not invent GO.


## UI: Dev Day Gate room

Create once (if it already exists, just open it; do not duplicate).

Includes:

1. Three members above
2. Bulletin: gate before list, gate before spend, free MCP only
3. Mentions based routing
4. Empty state with four starter chips that only fill the composer (user presses Enter to send)

Chip intents:

1. Scan a vercel URL (should FAIL)
2. Scan our Railway Free MCP URL (should PASS or WARN)
3. Trust agent 99999 (should NO_GO or fail listing)
4. Trust agent 13837 with Railway endpoint (should GO or CAUTION)

After the first real message, hide the big empty hero. Keep starters in a small control if needed.


## UI: catalog agents

Add Listing Coach and Spend Scout with chart avatars.

Listing Coach asks Markets to scan and proposes host fixes in chat. Does not invent FAIL.

Spend Scout asks for trust, refuses pay on NO_GO, and only continues to free tools on GO.


## UI: avatars

Chart marks for the three seats. Do not fall back to Cursor or SupaMaus mascots for catalog chart agents.


## How the show should look when everything is real

1. Open Dev Day Gate. See three faces and the bulletin.
2. Tap "scan vercel". Send. See Markets tool activity. See FAIL card with Apply and Run again.
3. Apply host. Send. Run scan again. See a second tool activity. See PASS or WARN card.
4. Tap trust 99999. Send. See NO_GO. Tap Block spend. See a refuse message.
5. Tap trust 13837. Send. See GO or CAUTION. On GO tap Continue. See a free tool activity name in the transcript.

If any step is a painted card with no tool activity, it is wrong.


## CI that must pass before merge

CI already runs typecheck and vitest. New PRs for this work must add tests like these.


### Server tests (in free mcp test file)

1. tools list includes both new tools as Free resource with read only annotations.
2. Scan of the local fixture Free MCP URL returns PASS or WARN and a free envelope.
3. Scan of a vercel.app URL returns FAIL and mentions vercel in the fix text (no live vercel needed).
4. Missing URL is an error, not PASS.
5. http URL does not PASS.
6. Localhost or metadata style hosts are blocked and do not get a real fetch (or fetch spy stays at zero).
7. Hung fetch ends within the timeout path.
8. Trust without agent id errors.
9. Trust with mocked listing 404 returns NO_GO.
10. Trust with mocked listing 200 plus self endpoint returns GO or CAUTION.
11. Trust always has at least three "not checked" items and a next step sentence.
12. Payment looking headers still leave these tools free.
13. Older free tools are still listed.


### Guard test

Scan production server and UI source (not test files) and fail if DEMO_FORCE_PASS, DEMO_FORCE_GO, FAKE_READINESS_VERDICT, mockPassAlways, or alwaysReturnPass appear.


### UI tests

Readiness card:

1. Shows FAIL when given FAIL data from the server parse.
2. Does not show a pretty PASS card when the payload is invalid.
3. Run scan again calls the handler once even if clicked twice quickly.
4. Apply suggested host passes an https URL to the handler.
5. Does not invent extra green checks beyond what the payload contains.

Trust card:

1. Continue is disabled on NO_GO.
2. Continue is enabled on GO and fires the handler.
3. Block spend fires its handler.
4. Decision text is visible (not color only).

Room helpers:

1. Seeding twice returns the same room.
2. Chip texts still contain vercel.app, the Railway host, 99999, and 13837.


### Types and parsing

One shared parser turns tool text into readiness or trust view models. UI and tests use the same parser. Bad JSON means no decorative card.


## Manual smoke after deploy (you or Hulk)

1. curl tools list on Railway shows both tool names.
2. curl vercel URL scan returns FAIL.
3. curl self Railway scan returns PASS or WARN.
4. In the app, chip to send creates a tool activity then a card.
5. Run scan again creates a second activity id.
6. Trust 99999 then Block spend creates a new message.
7. GO then Continue shows a free tool activity name.

Write the message or activity ids on the PR if you want proof.


## PR checklist (plain language)

Copy into the PR:

1. Readiness tool live on Free MCP with tests above.
2. Trust tool live with tests above.
3. Action cards with working buttons (no local fake verdict).
4. Room seed does not duplicate.
5. Guard test green (no force pass strings).
6. Typecheck green.
7. Manual smoke done on Railway plus desktop room.
8. No fake transcript for the show.


## Build order

1. Readiness tool plus server tests plus Railway.
2. Trust tool plus server tests plus Railway.
3. Action cards plus UI tests wired to live tool messages.
4. Listing Coach and Spend Scout catalog.
5. Dev Day Gate room and chips.
6. Chart avatars.


## Files you will likely touch

1. server/okx/intelligence.ts
2. server/okx/free-mcp.test.ts
3. server/okx/dev-day-no-mock.guard.test.ts (new)
4. src/lib/okx-gate-types.ts (new)
5. src/lib/parse-gate-tool-result.ts (new)
6. src/components/ReadinessRunCard.tsx (new)
7. src/components/TrustCard.tsx (new)
8. their test files
9. src/lib/dev-day-gate.ts (new) for seed and chips
10. GroupView and ChatView to mount cards
11. server/okx/agent-import.ts for catalog
12. docs/free-a2mcp-asp.md to mention the tools


## Older docs

Keep field level detail in the older long docs if needed. For day to day reading and review, use this easy file first. When CI rules conflict with a short note elsewhere, this file wins for tests and anti fake rules.




## Locked decisions (from recommendations review)

These are now product rules, not optional ideas.

1. Ship readiness and trust tools with CI before polishing cards.
2. One shared parser for tool JSON. Bad JSON means no pretty card.
3. Continue with free tools is enabled only on GO. Not on CAUTION. Not on NO_GO.
4. Apply suggested host pastes the real production Free MCP https URL when the fail was vercel.
5. Listing Coach and Spend Scout only ask Markets to run tools. They never invent PASS FAIL GO.
6. Vercel FAIL is decided by hostname before any network call so CI stays stable.
7. While Markets has a tool in flight, disable Run scan again and Re check.
8. Do not merge PR 15 (drops OKX views) into this show path.
9. ASP 13837 listing text should name readiness and trust when you can edit it.
10. Under each card show a one line last run hint (age, latency, tool count) from the payload when present.
11. Dev Day Gate uses mentions routing.
12. Trending and invite flows are not the hero. Gate loops are.
13. After each Railway deploy, save curl outputs under docs/evidence/dev-day.
14. When both room loops work, freeze new features. Avatars and README only after that.

Production Free MCP URL to paste on Apply host:
https://kind-meitner-production.up.railway.app/api/okx/free-mcp

## Want more detail and recommendations?

Open `docs/plans/2026-09-21-okx-recommendations-and-linked-plan.md` for links across docs and issues plus planning recommendations.


## Extras added (error copy, flag, smoke)

1. Fixed error strings and flag spec: `docs/okx-dev-day-error-copy-and-flag.md`
2. Feature flag name `devDayGateCards` default on (`!== false`). Cards off, tools still on.
3. Smoke after Railway: `pnpm dev-day:smoke` or `bash scripts/dev-day-gate-smoke.sh`
