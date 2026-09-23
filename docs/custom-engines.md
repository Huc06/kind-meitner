# Engines

kind-meitner ships two engines:

- **Claude** (`claudeAgent`) — the Claude Code CLI.
- **Grok** — the Grok CLI (`grokAgent`) in the default fleet, and the xAI API driver (`grok`) when an instance is configured with `XAI_API_KEY`.

Other built-in agents (Codex, Antigravity, Gemini, Kimi, Droid, Cursor, OpenCode, Qwen, Hermes, Pi, MiniMax, OpenAI-compatible, custom ACP, and the Box agent) are not registered. A saved instance that still names one of those drivers stays in config and shows as unavailable.
