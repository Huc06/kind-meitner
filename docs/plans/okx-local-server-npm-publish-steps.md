# Publishing the OKX local server for `npx`

> **Not done yet. Requires your explicit go-ahead before any step here is
> executed.** Publishing to the public npm registry is an external action:
> once a package name is taken, other people can install it, and unpublishing
> a version after 72 hours is restricted by npm's own policy — this is not
> something to run speculatively.

## Why this is needed

Right now `npx kind-meitner-okx-server` (or any name) fails because:

- The main `package.json` has `"private": true` and no `"bin"` field.
- Nothing under this name has ever been published — confirmed via
  `npm view <name>`, which 404s for every name candidate checked so far.

`npx <package>` only works once a package with that exact name and a `bin`
entry exists on the npm registry.

## Recommended shape: a separate package, not the whole app

Publishing the entire `kind-meitner` app would ship the full chat/bot/
computer-use codebase for a feature that only needs
`server/okx-local-server.ts` plus its `server/okx/*.ts` dependencies and
`server/config.ts`. A minimal separate package is safer and matches the
sui-cli-web-server precedent (a small dedicated server package, not the
whole monorepo).

### 1. Pick and reserve a name

Check availability first — do not assume a name is free without checking:

```sh
npm view <candidate-name>
```

A `404` means it is free. Candidates to consider (not yet checked as of
this writing): `kind-meitner-okx-server`, `okx-local-server`. Re-check
immediately before publishing, since availability can change.

### 2. Create the package directory

A new, minimal package — for example `packages/okx-local-server/` in this
repo, or its own repo entirely:

```text
okx-local-server/
├── package.json
├── src/
│   ├── okx-local-server.ts   (copy of server/okx-local-server.ts)
│   ├── config.ts             (copy of server/config.ts, or a trimmed version)
│   └── okx/                  (copy of server/okx/*.ts this file imports)
└── README.md
```

`package.json` needs, at minimum:

```json
{
  "name": "<the-chosen-name>",
  "version": "0.1.0",
  "bin": {
    "<the-chosen-name>": "./dist/okx-local-server.js"
  },
  "files": ["dist"],
  "engines": { "node": ">=24" }
}
```

### 3. Build to plain JS

`npx` runs the `bin` entry directly; it should not depend on
`--experimental-strip-types` or a dev-only toolchain. Compile the TypeScript
to a `dist/` directory before publishing (a plain `tsc` build is enough —
this file has no framework dependency).

### 4. Verify locally before publishing anything

```sh
npm pack --dry-run
```

Inspect the file list it prints. Confirm it contains only what is intended
(no `.env`, no test files, no unrelated source).

### 5. Log in and publish — only with explicit confirmation

```sh
npm login          # requires your own npm account
npm publish --access public
```

This step is irreversible in practice: `npm unpublish` for a version older
than 72 hours is restricted, and even within that window it can break
anyone who has already installed it. Do not run this without deciding, in
that moment, that the name and content are final.

### 6. Confirm `npx` actually works

From a clean shell, ideally on a different machine or a fresh
`~/.npm` cache:

```sh
npx <the-chosen-name>
```

Confirm the banner and pairing token described in
`docs/plans/okx-local-server-hosted-ui-split.md` appear as expected.

## What this document does not do

- It does not publish anything. No `npm publish` command has been run.
- It does not choose a final name. The candidates above are unchecked
  suggestions, not a decision.
- It does not change how `pnpm okx-serve` works today from a source
  checkout — that remains the supported path until a decision is made
  to publish a standalone package.
