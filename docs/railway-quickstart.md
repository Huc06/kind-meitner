# Deploying kind-meitner on Railway — Quickstart

This concise guide walks through deploying a single-service kind-meitner instance on [Railway](https://railway.app), establishing authorized access, configuring an initial model via environment variables, and completing your first chat.

For comprehensive details on Docker deployment, pairing mechanics, native provider CLI logins (Claude/Codex), backups, and reverse proxies, see [Self-hosting the kind-meitner server](self-hosting.md).

---

## 1. Deploy the Docker Service & Volume

kind-meitner includes a production-ready `Dockerfile` and `railway.toml`.

1. In Railway, create a new project and choose **Deploy from GitHub repo**, selecting your `kind-meitner` fork.
2. In the service settings, navigate to **Volumes** and click **Add Volume**:
   - Mount path: `/data`
   - *Crucial:* A persistent volume ensures workspaces, bot state, transcripts, and settings survive container restarts and deployments.

---

## 2. Public Networking & Domain

1. In service **Settings** → **Networking**, click **Generate Domain** (e.g. `your-app.up.railway.app`) or attach a custom domain.
2. Under **Variables**, set:
   - `KIND_MEITNER_PUBLIC_URL=https://your-app.up.railway.app` (use your actual HTTPS domain without trailing slash).

---

## 3. First Access & Authentication

Choose one of two first-access methods:

### Option A: Email Magic Link (Recommended for hosted teams)
Add your authorized email(s) as Railway service variables:
- `KIND_MEITNER_SIGNIN_EMAILS=alice@example.com,bob@example.com`
- Set up an email delivery provider (e.g. Resend, Postmark, or SMTP) as documented in [Email sign-in setup](self-hosting.md#email-sign-in).

### Option B: Terminal Pairing Code
If email delivery is not configured, mint a single-use pairing code directly from the running Railway container:
1. Open the Railway web dashboard and click into the service **Terminal** (or use the Railway CLI: `railway shell`).
2. Run:
   ```bash
   pnpm pair
   ```
3. Copy the output code or pairing link and paste it into your browser to authorize your session.

---

## 4. Configure First Model (OpenAI-Compatible / OpenRouter)

For hosted deployments, an OpenAI-compatible API key (via OpenRouter, Groq, or OpenAI) provides a zero-setup first model path without requiring native CLI authentication on the server:

In Railway **Variables**, add:
- `OPENAI_COMPAT_API_KEY`: your provider API key.
- `OPENAI_COMPAT_URL`: (optional) custom base endpoint, e.g. `https://openrouter.ai/api/v1` or `https://api.groq.com/openai/v1`. Defaults to OpenAI public API if omitted.
- `OPENAI_COMPAT_MODEL`: (optional) default model ID, e.g. `anthropic/claude-3.5-sonnet` or `llama-3.3-70b-versatile`.

> **Capability Boundary:** API-key connections through OpenAI-compatible endpoints are strictly for **chat and reasoning**. They do not support full agentic tool loops or computer use. For full agent capabilities (bash execution, file editing, MCP servers), configure Claude/Codex logins as documented in [Custom engines](custom-engines.md) and [Engines setup](verification/engines-ui.md).

---

## 5. Verify First Chat

1. Navigate to your Railway public URL: `https://your-app.up.railway.app`.
2. Authenticate using your email link or pairing code.
3. Open a conversation with any bot or create a new one.
4. Send a prompt to verify the model responds.

---

## 6. Advanced References

- [Full self-hosting guide](self-hosting.md) — Comprehensive guide to pairing, multi-account routing, backups, and security policies.
- [Custom engines reference](custom-engines.md) — Endpoint specifications, streaming parameters, and limits.
- [Dev Day positioning & Free-MCP](okx-dev-day-positioning.md) — Details on running the free OKX Dev Day intelligence gate.
