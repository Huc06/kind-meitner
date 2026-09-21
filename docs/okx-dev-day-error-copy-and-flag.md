# Dev Day extras: fixed error copy + feature flag

Hulk implements these when building the gate tools and cards. Copy here is canonical English. Add matching keys under `src/locales/en.json` when wiring UI.


## Fixed error copy (do not improvise in UI)

Use these exact user-visible strings (or i18n keys that resolve to them).


### Scan or trust timed out

Key idea: `okxGate.error.timeout`

Text:
`The check timed out after 8 seconds. Confirm the URL is public https and responds to tools/list, then run again.`


### Address blocked for safety (SSRF / localhost / metadata)

Key idea: `okxGate.error.blockedHost`

Text:
`That address cannot be scanned from this service. Use a public https endpoint (for example Railway or your custom domain), not localhost or a private network.`


### Tool result could not be shown as a card (parse fail)

Key idea: `okxGate.error.parseCard`

Text:
`The gate tool returned data this app could not read. Open the normal tool result below, or run the check again.`

Do not invent a PASS or GO card when parse fails.


### Missing URL

Key idea: `okxGate.error.missingUrl`

Text:
`Add an https endpoint URL to scan.`


### Missing agent id

Key idea: `okxGate.error.missingAgentId`

Text:
`Add an OKX.ai agent id to trust-check.`


### Server busy / too many scans

Key idea: `okxGate.error.busy`

Text:
`Too many scans at once. Wait a moment, then run again.`


## Feature flag: Dev Day gate cards

Name: `devDayGateCards`

Intent: when false, still run Free MCP tools and show normal tool activity, but do not mount readiness or trust action cards. Lets you kill card UI fast if it regresses without turning off the tools.

### How to wire (follow existing pattern)

1. Extend `FeatureFlagConfig.features` in `src/lib/feature-flags.ts` with `devDayGateCards?: boolean`.
2. Add helper:

```ts
/** Action cards for listing readiness and pre-spend trust. On unless explicitly switched off. */
export function devDayGateCardsEnabled(config: FeatureFlagConfig | null | undefined): boolean {
  return config?.features?.devDayGateCards !== false;
}
```

3. Default **on** (`!== false`), same style as `skillAuthoringEnabled`.
4. In GroupView / ChatView, mount readiness and trust cards only when `devDayGateCardsEnabled(...)` is true.
5. Optional: server `config.json` features.devDayGateCards for ops. No Settings UI required for Dev Day unless you already have a features panel.

Tools stay callable even when the flag is off.


## Smoke script

Run after each Railway deploy:

```bash
pnpm exec bash scripts/dev-day-gate-smoke.sh
# or
bash scripts/dev-day-gate-smoke.sh
```

Optional base URL:

```bash
BASE_URL=https://kind-meitner-production.up.railway.app bash scripts/dev-day-gate-smoke.sh
```

Expect exit 0 only when tools list includes both gate tools, vercel scan FAIL, and self scan PASS or WARN.
