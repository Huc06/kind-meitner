# External agents (A2A, direct or zroute)

External agents are room participants reached over the A2A protocol
(JSON-RPC 2.0: agent card at `/.well-known/agent.json`, chat via
`message/send`, or `message/stream` when the card advertises streaming).
They are not models: the model menu still only picks the engine for local
bots.

- **Direct**: kind-meitner calls the agent's A2A endpoint.
- **zroute**: kind-meitner calls a proxy that speaks A2A. The proxy must report
  the real upstream agent in its card and every reply
  (`metadata.upstream.agentId`); missing or mismatched upstream identity is an
  error. An optional route ID is sent as `params.metadata.routeId`.
  **Not yet verified against a real zroute deployment** — only against the
  local A2A route proxy below.

## Add one

OKX Agent Hub → Agents → **Add external agent**. The server checks the
endpoint (HTTPS, agent card shape, identity, upstream for zroute) before the
agent can be invited. Choose it in the room's responder menu
(“External agents”). Plain messages then go only to that agent; a timeout,
Stop, removal or failure is shown in the room and never falls back to a bot.

## Streaming and Stop

When the agent card has `capabilities.streaming: true`, replies stream into
one room message. **Stop** aborts the request and, if the agent reported a
task ID, sends `tasks/cancel`. The partial reply stays, labelled “stopped”.

## Credentials

Paste an agent's API token into the card's **Server credential** field. It is
written to `DATA_DIR/external-agent-secrets.enc` (AES-256-GCM, mode 0600) with
its key in `external-agent-secrets.key` (mode 0600), and is never returned to
the browser, stored in messages or logged. Values that look like a private key
or seed phrase are refused. This protects the secrets file on its own; anyone
who can read the whole data directory as this user can read the token. A
hosted deployment should keep the key in an OS keychain or KMS.

Development fallback: a connection may name a server environment variable
matching `KIND_MEITNER_EXT_*`.

## Request proofs (replay protection)

Every request carries `X-KM-Request-Proof: <base64url payload>.<Ed25519 signature>`.
The payload binds `cid` (connection), `aid` (agent), `aud` (endpoint origin),
`purpose` (`agent-card`, `message/send`, `message/stream`, `tasks/cancel`),
`rid` (request ID), a fresh `nonce`, `iat` and `exp` (120 s). Agents fetch the
public key from `GET /api/external-agents/proof-key`, verify the signature,
audience and expiry, and reject any nonce they have seen. The server never
reuses a request ID within a process; replay rejection is the agent's check.

## Untrusted replies

Replies are filtered before storage: hidden/control/bidi characters and
`javascript:`/`data:`/`vbscript:`/`file:` links are removed, credential-shaped
values redacted, length capped at 20 000 characters. Text that tries to
instruct agents is kept but flagged in the room, and bots reading the room see
external replies wrapped as untrusted data, never as instructions.

## Testnet payments (x402, approval-gated)

Off unless the connection is created with **Allow X Layer testnet payments**.
When such an agent answers HTTP 402 with an x402 `PAYMENT-REQUIRED` challenge:

1. The server accepts only `exact` on `eip155:1952` (X Layer testnet). Any
   other network — including mainnet — is refused before signing.
2. Per-request and monthly limits apply (atomic units, default 100000 /
   1000000; `KIND_MEITNER_TESTNET_PAY_MAX_ATOMIC`,
   `KIND_MEITNER_TESTNET_PAY_MONTHLY_ATOMIC`).
3. The room shows an approval card. Nothing is signed until **Approve**.
4. Approve signs an EIP-3009 authorization with the server-held testnet wallet
   (official `@okxweb3/x402` client) and resends the request.
5. The card says **settled** only if the agent returns a successful
   `PAYMENT-RESPONSE`; otherwise “authorization signed, settlement not
   confirmed”. Signed authorizations count toward the monthly limit.

The testnet wallet address is shown in the Hub; its key stays in the
encrypted secret store. Fund it from an X Layer testnet faucet. Trading,
arbitrary signing and mainnet remain unsupported.

## Local development

Plain-http endpoints are refused except loopback with
`KIND_MEITNER_ALLOW_LOOPBACK_AGENTS=1`. Local helpers for a real (not mocked)
setup — every answer is a real Claude CLI turn:

```sh
KIND_MEITNER_ALLOW_LOOPBACK_AGENTS=1 pnpm dev:server
node scripts/dev/a2a-claude-agent.mjs --port 8810 --name "Research Agent" --stream --verify-proof http://127.0.0.1:8799
node scripts/dev/a2a-claude-agent.mjs --port 8812 --name "Paid Agent" --agent-id local-paid-agent --price 10000 --verify-proof http://127.0.0.1:8799
node scripts/dev/a2a-claude-agent.mjs --port 8813 --name "Research Agent"
node scripts/dev/a2a-route-proxy.mjs --port 8820 --upstream http://127.0.0.1:8813/
```

The paid agent verifies the EIP-3009 signature locally but has no
facilitator, so it never settles or claims settlement.
`KIND_MEITNER_EXTERNAL_AGENT_TIMEOUT_MS` (default 30000) bounds each request.
