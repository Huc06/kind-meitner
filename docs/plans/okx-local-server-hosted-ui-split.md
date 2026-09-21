# OKX local server + hosted UI split — design draft

> **STATUS: DRAFT — not implemented, not approved.** Scoped only to the OKX
> A2MCP surface (`/api/okx/*`). Does not change kind-meitner's core chat,
> routines, or computer-use architecture, and does not require any change
> to those areas to ship.

## 1. Problem

The current OKX A2MCP server (`server/index.ts`, routes under `/api/okx/*`)
is designed to run as one process that a single operator deploys — for
example on Railway — using that operator's own `OKX_API_KEY`,
`OKX_SECRET_KEY`, and `OKX_PASSPHRASE`.

That is wrong for a multi-user product. Those three values are OKX
Developer Portal credentials tied to a real account and, for the x402
path, to real payment settlement. No user should have to hand their OKX
credentials to an operator-run server to use their own agent. The
credential owner and the server process holding that credential must be
the same party.

## 2. Goal

Split the OKX surface into two independently deployed pieces:

- **Hosted UI** — a static build (or a UI-only server instance with no OKX
  credentials configured) reachable at a public URL. Its only job is to
  serve the interface.
- **Local OKX server** — a small process the user starts on their own
  machine (`npx <package> okx-serve`, exact name TBD). It binds
  `127.0.0.1` only, reads `OKX_API_KEY` / `OKX_SECRET_KEY` /
  `OKX_PASSPHRASE` and the x402 testnet configuration from that machine's
  own environment, and is the only thing that ever calls the OKX API on
  the user's behalf.

The browser, running on the same machine as the local server, loads the
hosted UI's HTML/JS and then talks directly to `http://127.0.0.1:<port>`
for every OKX call. The hosted UI origin never receives, proxies, stores,
or logs an OKX credential — it cannot, because it never runs the code path
that reads one.

```text
┌────────────────────────────┐
│ Browser (user's machine)    │
│ loads UI from hosted origin │
└──────────────┬──────────────┘
               │ HTTP to http://127.0.0.1:<port>
               ▼
┌────────────────────────────┐
│ Local OKX server            │   binds 127.0.0.1 only
│ (same machine as browser)   │   reads OKX_* from local env
└──────────────┬──────────────┘
               │ HTTPS
               ▼
        OKX Developer Portal API
```

This only works when the browser and the local server are on the same
machine — `127.0.0.1` in the browser always means "this machine," never a
different one. That is a deliberate scope limit (see §6): it is not a
remote-access or multi-device solution.

## 3. What moves where

Routes currently in `server/index.ts` under `/api/okx/*`:

| Route | Needs a real OKX credential? | Where it belongs |
| --- | --- | --- |
| `POST /api/okx/free-mcp` | No — free, read-only, no wallet/payment | Can stay on the hosted side as a demo; also fine to run locally |
| `GET /api/okx/agents`, `POST /api/okx/agents/import` | No — mock catalog, no OKX credential | Hosted side (this is the M1 onboarding demo) |
| `POST /api/okx/webhook` | Yes — verifies against `OKX_WEBHOOK_SECRET` | Local server only |
| `POST /api/okx/mcp` (legacy EIP-3009) | Yes, when explicitly enabled | Local server only; stays disabled by default per existing hardening |
| `GET/POST /api/okx/settings` | Yes — this is the credential-configured-state endpoint | Local server only |
| `GET /api/okx/intelligence`, `/api/okx/disputes`, `/api/okx/treasury` | Depends on data source; treat as local-server routes if they read live OKX state | Local server |
| `POST /api/okx/x402-testnet/market-intelligence` | Yes — full credential trio plus `OKX_X402_TESTNET_PAY_TO`/`RESOURCE_URL` | Local server only |

Rule of thumb: **any route that reads `OKX_API_KEY`/`OKX_SECRET_KEY`/
`OKX_PASSPHRASE`, or that becomes meaningful only once those are set, runs
on the local server.** Routes that work identically with no credential
configured (the free/mock demo surface) can stay hosted, because they were
already designed to need nothing.

## 4. What has to change to make this possible

Confirmed by reading the current code, three real gaps exist today:

1. **The frontend only makes same-origin calls.** Every OKX-related
   `fetch()` call needs to target a configurable base URL instead of a
   bare `/api/...` path, so the OKX-specific views can be pointed at
   `http://127.0.0.1:<port>` regardless of what origin served the page.
2. **The server has no CORS handling.** `server/index.ts` sends no
   `Access-Control-Allow-Origin` header today. The local OKX server needs
   an explicit allowlist (hosted origin + `localhost` + anything the user
   sets) so the browser's same-origin policy does not block the hosted
   page from calling into `127.0.0.1`. This must be an allowlist, never a
   wildcard, because the local server holds real credentials.
3. **There is no local-server-only entry point or package.** Today
   `server/index.ts` is one process serving every route, and it
   auto-binds `0.0.0.0` when it detects `RAILWAY_ENVIRONMENT`. The local
   OKX server needs its own entry point that (a) only mounts the routes in
   §3's "local server" column, (b) always binds `127.0.0.1` regardless of
   environment variables, and (c) refuses to start if something tries to
   force a public bind.

None of this requires touching chat, routines, computer use, or any
non-OKX route.

## 5. Local server distribution

- Ship as its own npm package (name and exact `bin` entry TBD) with a
  `"bin"` field, published to the public registry — the current
  `kind-meitner` package is `"private": true` and has no `bin`, so `npx`
  cannot resolve it today; that has to be fixed for this package
  specifically, independent of whether the main app ever publishes.
- `npx <package>` starts the local OKX server in the foreground, prints
  the port it bound, and does nothing else — no account, no sign-in, no
  outbound registration to any third-party service. The only outbound
  calls it makes are to the OKX API itself, using the user's own
  credentials from their own environment.
- Configuration is local environment variables or a local `.env`, read
  the same way `server/index.ts` already reads `OKX_API_KEY` etc. today.
  No new secret-storage mechanism is introduced.

## 6. Explicit scope and non-goals

- **Same-machine only.** This design does not let a phone or a second
  computer reach the local server. If that need shows up later, it is a
  separate design (a relay or tunnel that the user's machine connects
  *out* through), not a change to this one.
- **Does not change how core kind-meitner works.** Chat, bots, routines,
  computer use, and every non-OKX route keep their current same-origin,
  single-process model. This split applies to `/api/okx/*` only.
  A shared hosted UI serving both the general app and the OKX views is
  fine; only the OKX calls get redirected to the local server.
  M1's mock-agent onboarding routes (`/api/okx/agents*`) are unaffected
  either way since they need no credential.
- **Does not add authentication to the local server.** Like any
  loopback-only server, anything already running as the same user on
  that machine can reach it. This is an accepted tradeoff, matching the
  existing loopback-trust model documented for kind-meitner's own server
  (`docs/self-hosting.md`). It must never be exposed on a non-loopback
  interface without adding real authentication in front of it first.
- **Does not change Phase 1/1.5/2 OKX roadmap exit criteria.** The x402
  testnet protocol evidence requirement, the disabled-by-default flag,
  and the Phase 3 mainnet gate all still apply; this document only moves
  *where the process holding the credential runs*, not what the process
  is allowed to do.

## 7. Open questions before implementation

- Exact package name and `bin` command name (needs a check that the
  chosen name is not already taken and is not confusingly similar to an
  existing package).
- Whether the hosted UI is the existing kind-meitner build with an OKX
  section pointed at the local server, or a separate minimal OKX-only
  static bundle.
- Default port and any port-conflict fallback behavior for the local
  server.
- Whether `/api/okx/intelligence`, `/disputes`, and `/treasury` actually
  need live OKX credentials or only local ledger state — needs a source
  read before final route placement, not assumed here.
