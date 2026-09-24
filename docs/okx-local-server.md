# Running the OKX local server

```sh
pnpm okx-serve
```

Starts a small server on your own machine that holds your OKX credentials
locally and never sends them to any hosted UI. See
[`docs/plans/okx-local-server-hosted-ui-split.md`](plans/okx-local-server-hosted-ui-split.md)
for the full design. This page is the quick terminal-facing reference.

## Setting up credentials once, instead of every run

```sh
pnpm okx-setup
```

Prompts for `OKX_API_KEY`, `OKX_SECRET_KEY`, `OKX_PASSPHRASE`, and an optional
base URL, then writes them to `okx-credentials.json` in this server's data
directory at file mode `0600` (readable and writable only by you). Every
`pnpm okx-serve` run after that picks them up automatically — no need to
`export` anything each time.

An explicit `OKX_API_KEY` / `OKX_SECRET_KEY` / `OKX_PASSPHRASE` environment
variable still takes precedence over the stored file when set, matching
every other `OKX_*` override in this codebase. The banner shows exactly
which source is in effect:

```text
✓ POST /api/okx/webhook   ready (credentials from OKX_API_KEY/SECRET/PASSPHRASE env vars)
```
or
```text
✓ POST /api/okx/webhook   ready (credentials from /home/you/.kind-meitner/okx-credentials.json (run `pnpm okx-setup` to change))
```

The stored file is read only by this process at startup. It is never
returned through any HTTP route — `GET /api/okx/settings` only ever
reports whether credentials are configured, as a boolean.

## What you'll see

On startup it prints a banner with the URL to open, where its data lives,
and — most importantly — a checklist of exactly what this process can do
right now, based on what you've configured:

```text
────────────────────────────────────────────────────────────────
  OKX local server
────────────────────────────────────────────────────────────────

  Open in your browser's hosted UI, or call directly at:
    http://127.0.0.1:8899

  What this process can do right now:
    ✓ GET  /api/health                              always available
    ✓ GET  /api/okx/settings                          always available (read-only)
    ✓ GET  /api/okx/intelligence                      always available (read-only)
    ✓ GET  /api/okx/disputes                          always available (read-only)
    ✓ GET  /api/okx/treasury                          always available (read-only)
    ✗ POST /api/okx/webhook                           NOT ready — credentials not set — run `pnpm okx-setup` or export OKX_API_KEY/OKX_SECRET_KEY/OKX_PASSPHRASE
    ✓ POST /api/okx/mcp (legacy)                      off by default — this is expected, not an error
    ✓ POST /api/okx/x402-testnet/market-intelligence off by default — this is expected, not an error
    ✓ POST /api/okx/settings                          requires the pairing token below

  Pairing token (required to save settings, receive webhooks, or use paid MCP/x402 routes):

     <printed once, here, at startup>
```

## Works with zero configuration

These respond immediately, no environment variables needed:

| Route | What it returns |
| --- | --- |
| `GET /api/health` | A liveness check. |
| `GET /api/okx/settings` | Whether credentials/webhook secret are configured (booleans only — never the values). |
| `GET /api/okx/intelligence` | Local market-intelligence overview, ASP list, category benchmarks. |
| `GET /api/okx/disputes` | Local dispute/evaluator ledger state. |
| `GET /api/okx/treasury` | Local treasury balance and spend limits. |

## Needs configuration before it does anything

| Route | Requires |
| --- | --- |
| `POST /api/okx/webhook` | `OKX_API_KEY`, `OKX_SECRET_KEY`, `OKX_PASSPHRASE` — via `pnpm okx-setup` (recommended) or the equivalent environment variables (and, to verify signatures, `OKX_WEBHOOK_SECRET`). Without these it still runs, but the gateway has no credentials to act on. |
| `POST /api/okx/mcp` (legacy paid MCP) | `OKX_LEGACY_EIP3009_ENABLED=true`. Off by default on purpose — this is not the official x402 path, and enabling it is a deliberate, reviewed choice, not a default. |
| `POST /api/okx/x402-testnet/market-intelligence` | `OKX_X402_TESTNET_ENABLED=true` plus the full credential trio, `OKX_X402_TESTNET_PAY_TO`, and `OKX_X402_TESTNET_RESOURCE_URL`. Off by default — see the OKX A2MCP roadmap's Phase 2 exit criteria before enabling this outside a reviewed testnet exercise. |

## Always requires the pairing token, regardless of the above

`POST /api/okx/settings` needs the `x-okx-pairing-token` header set to the
value printed at startup, whether or not credentials are configured yet.
This is the one write-capable route this server always exposes, so it is
never left open just because CORS/localhost allows the request through.

## Connecting a hosted UI to this server

By default only `http://localhost:*` and `http://127.0.0.1:*` origins are
allowed to call this server from a browser. To let a hosted UI (e.g. on
Railway) call into it too:

```sh
KIND_MEITNER_OKX_ALLOWED_ORIGINS=https://your-app.example.com pnpm okx-serve
```

Then, in that hosted UI's OKX settings, enter this machine's address
(`http://127.0.0.1:<port>` if the UI is opened on this same machine) and
paste the pairing token from the terminal.

## Port already in use?

The server tries `8899` first, then `8898`, `8897`, `8896`, `8009`, `8010`
in order, printing which one it actually used:

```text
Port 8899 is in use — trying 8898 instead…
```

To force an exact port instead of the fallback list:

```sh
OKX_LOCAL_SERVER_PORT=9000 pnpm okx-serve
```

## Not available via `npx` yet

`npx <package> okx-serve` does not work today — nothing under this name is
published to npm. Use `pnpm okx-serve` from a checkout of this repository
in the meantime. See
[`docs/plans/okx-local-server-npm-publish-steps.md`](plans/okx-local-server-npm-publish-steps.md)
for the (unexecuted) steps to change that, which require an explicit,
separate decision before anything is published.
