# Kind Meitner Markets — Service Guide (OKX.AI listing #13851)

Ready-to-paste guide for the **Free Readiness Trust** service. Every tool name, argument and
behaviour below was observed on the live endpoint on 2026-10-04 and re-checked on
2026-10-05 (UTC). Re-run the read-only checks any time with `pnpm dev-day:smoke`
([`scripts/dev-day-gate-smoke.sh`](../scripts/dev-day-gate-smoke.sh)).

> **Field limits:** OKX's public docs do not document a separate "Service Guide" field or
> its length limit. A secondary summary mentions a 500-character ASP description; that is
> unconfirmed. Paste the **Short description** into any short field and this guide into
> any long-form field, then check for truncation on the listing page.

---

## Short description (≈300 characters)

Free, read-only checks for the OKX.AI agent economy. Builders scan a Free MCP endpoint
before listing and get PASS/WARN/FAIL with fixes. Callers check an agent ID before using it
and get GO/CAUTION/NO_GO with the evidence found and what was not checked. No wallet, no
payment, not an OKX endorsement.

---

## What the service does

- **Endpoint readiness** (`scan_free_mcp_readiness`): probes a public HTTPS Free MCP
  endpoint the way a caller would (`tools/list`, a soft `initialize`) and returns a
  verdict, a score, each check with its detail, and concrete remediation.
- **Agent trust evidence** (`get_asp_trust_card`): checks whether an OKX.AI agent's listing
  page is reachable and, if you pass its endpoint, whether that endpoint is ready. It returns
  a decision, the signals behind it, an explicit **not checked** list, and a safe next step.
- **Reference material** (`list_okx_ai_use_cases`, `get_free_a2mcp_launch_checklist`) and
  **sample registry data** (`get_asp_reputation`, `get_trending_asps`,
  `query_market_benchmarks`). The registry is illustrative sample data, **not** OKX.AI
  marketplace statistics.

## Who should use it

- **ASP builders** preparing a Free A2MCP listing who want to know whether callers can
  reach and use their endpoint.
- **Agent developers** checking that a service answers MCP correctly before integrating.
- **Callers** who want to see what evidence exists about an agent before deciding what to do
  next.

## How to call it

| | |
|---|---|
| Endpoint | `https://kind-meitner-production.up.railway.app/api/okx/free-mcp` |
| Protocol | MCP over JSON-RPC 2.0 (A2MCP), HTTP `POST`, `content-type: application/json` |
| Lifecycle | `initialize` (server reports protocol `2024-11-05`, server `kind-meitner-free-okx-ai` 1.0.0) → `tools/list` → `tools/call` |
| Authentication | None. Do not send credentials, API keys or payment headers. |
| Price | Free (`0`). The endpoint never returns `402 Payment Required`. |
| Rate limit | 60 requests per minute per IP (server configuration); excess requests get HTTP 429. |

### Tools used most

**`scan_free_mcp_readiness`**: `endpointUrl` (string, required, 8–500 chars), `agentId` (string, optional, ≤64).

```json
{"jsonrpc":"2.0","id":"1","method":"tools/call",
 "params":{"name":"scan_free_mcp_readiness",
           "arguments":{"endpointUrl":"https://kind-meitner-production.up.railway.app/api/okx/free-mcp"}}}
```

Observed result (2026-10-04, abridged): `"verdict": "PASS"`, `"score": 100`, checks
`https_scheme`, `host_pitfall_vercel`, `tools_list_http` (`status=200`), `tools_list_shape`
(`7 tools`), `no_accidental_402`, `initialize_soft`, all `pass`; `remediation: []`; and a
receipt with schema `kindmeitner.readiness.v1` plus an evidence hash.

**`get_asp_trust_card`**: `agentId` (string, required, 1–64), `endpointUrl` (string, optional, ≤500).

```json
{"jsonrpc":"2.0","id":"2","method":"tools/call",
 "params":{"name":"get_asp_trust_card",
           "arguments":{"agentId":"13851",
                        "endpointUrl":"https://kind-meitner-production.up.railway.app/api/okx/free-mcp"}}}
```

Observed result (2026-10-04, abridged): `"decision": "GO"`; signals `listing_page` pass
(`HTTP 200`) and `endpoint_readiness` pass (`verdict=PASS`); `notChecked`: on-chain credit
score, historical settlement volume, OKX official endorsement, mainnet payment success;
`safeNextStep`: "Caller may use free read-only tools on this endpoint. Do not treat this as
payment approval."

Every result is wrapped as `{"resource": {...}, "data": {...}}` inside the MCP text content.
`resource` states `access: free`, `paymentRequired: false`, `walletRequired: false`,
`mainnet: false`, and a `provenance` string.

### How to read the results

| Result | Meaning | Not meaning |
|---|---|---|
| `PASS` | Every readiness check passed at the time of the probe. | Listing approval, or uptime later. |
| `WARN` | Usable, with issues worth fixing (see `remediation`). | Broken. |
| `FAIL` | A caller would likely fail; fix the listed items first. | That the service is malicious. |
| `GO` | The listing page was reachable and (if given) the endpoint passed readiness. | That the agent is safe, endorsed, or fit to receive payments. |
| `CAUTION` | Some signals are missing or incomplete. | A negative judgement. |
| `NO_GO` | The listing or endpoint check failed. Fix or investigate before proceeding. | Proof of fraud. |

Always read `notChecked`. Missing evidence is never proof of safety.

## Boundaries

- Free and read-only. No wallet access, signing, or payment execution.
- No guarantee of OKX.AI listing approval.
- No guarantee that another service is safe; the trust card reports reachability and
  readiness evidence only.
- Not an official OKX endorsement.
- **Live vs local:** readiness and trust results come from live HTTPS probes made at call time.
  Reputation, trending and benchmark tools return illustrative sample records from a local
  registry.
- Never put credentials or secrets in tool arguments. The service doesn't need them and
  doesn't forward them.
- Only public HTTPS targets are probed; private, loopback and link-local addresses are refused.

## Errors and limitations (observed 2026-10-04, re-checked 2026-10-05)

| Situation | Observed behaviour |
|---|---|
| Invalid URL (`not-a-url`) | `FAIL`, score 0, `https_scheme` fail "invalid URL"; later checks "not checked". |
| Plain HTTP (`http://…`) | `FAIL`, score 0, `https_scheme` fail `scheme=http:`. |
| Private/loopback target (`https://127.0.0.1/mcp`) | `FAIL`, score 33, `tools_list_http` fail "private or loopback target blocked"; remediation "Use a public HTTPS endpoint…". No request is made to the target. |
| Missing required argument | MCP error result (`isError: true`): `endpointUrl is required`. |
| Unknown extra argument | MCP error result: `Unsupported argument: <name>. Accepted: …`. |
| Unknown tool | MCP error result: `Unknown free resource: <name>`. |
| Unknown agent ID (`999999999`) | `NO_GO`; `listing_page` fail `HTTP 404`; `endpoint_readiness` skipped "no endpointUrl provided"; next step "Fix listing or endpoint first." |
| Target timeout | Probes use an 8-second timeout; the affected check fails with a timeout detail. *(Behaviour from source code; not exercised live.)* |
| Target requires payment (`402`) | `no_accidental_402` fails, flagging that a Free listing must not challenge for payment. *(From source code; not exercised live against a third party.)* |
| Rate limit | HTTP 429 after 60 requests per minute per IP. *(From server configuration; not exercised live.)* |

## Publication status

- Listing page `https://www.okx.ai/agents/13851` is public (HTTP 200 on 2026-10-05, title
  "Kind Meitner Markets"), shows the **Free Readiness Trust** service, "Unrated", and the
  endpoint above.
- OKX's process: register the ASP, then list it on the marketplace; review completes
  within 24 hours and the result goes to the Agentic Wallet email
  ([OKX docs](https://web3.okx.com/onchainos/dev-docs/okxai/registerasp)).
- **Unknown:** whether the listing is in a sandbox or fully published state, and its review
  status. These need the authenticated owner view. A reachable page is not proof of approval.
- **Unconfirmed hypothesis:** that an empty Service Guide field keeps a listing in sandbox.
  No OKX source states this.
- This guide is **prepared, not published**: paste it into the owner dashboard yourself.
