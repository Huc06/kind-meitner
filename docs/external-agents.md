# External agents (A2A, direct or zroute)

External agents are room participants reached over the A2A protocol
(JSON-RPC 2.0: agent card at `/.well-known/agent.json`, chat via
`message/send`). They are not models: the model menu still only picks the
engine for local bots. This milestone is **read-only** — text chat only, no
wallet, payment, signing or delegated execution.

- **Direct**: kind-meitner calls the agent's A2A endpoint.
- **zroute**: kind-meitner calls a proxy that speaks A2A. The proxy must report
  the real upstream agent in its card and every reply
  (`metadata.upstream.agentId`); missing or mismatched upstream identity is an
  error. An optional route ID is sent as `params.metadata.routeId`.

## Add one

OKX Agent Hub → Agents → **Add external agent**. The server checks the
endpoint (HTTPS, agent card shape, identity, upstream for zroute) before the
agent can be invited. Choose it in the room's responder menu
(“External agents”). Plain messages then go only to that agent; a timeout,
removal or failure is shown in the room and never falls back to a bot.

## Credentials (development only)

There is no production credential store for external agents yet. A connection
may name a server environment variable matching `KIND_MEITNER_EXT_*`; its value
is sent as `Authorization: Bearer …`. The value is read at call time and never
returned to the browser, written to `external-agents.json`, stored in messages
or logged. Never paste keys, seed phrases or wallet secrets into the form.

## Local development

Plain-http endpoints are refused except loopback with
`KIND_MEITNER_ALLOW_LOOPBACK_AGENTS=1`. Two local helpers give a real (not
mocked) setup on this machine:

```sh
node scripts/dev/a2a-claude-agent.mjs --port 8810 --name "Research Agent"   # answers with the Claude CLI
node scripts/dev/a2a-route-proxy.mjs --port 8820 --upstream http://127.0.0.1:8810/   # zroute-shaped proxy
KIND_MEITNER_ALLOW_LOOPBACK_AGENTS=1 pnpm dev:server
```

`KIND_MEITNER_EXTERNAL_AGENT_TIMEOUT_MS` (default 30000) bounds each request.
The local proxy only mimics zroute's shape; it does not prove compatibility
with a real zroute deployment.
