#!/usr/bin/env node
// kind-meitner Laptop Claude Relay Runner
// Outbound long-poll connection to the kind-meitner server.
// Runs Claude Code locally with tools disabled. Single dependency-free script.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
const MODEL_REGEX = /^[a-z0-9.-]+$/i;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateJob(job) {
  if (!job || typeof job !== "object") {
    return { ok: false, error: "Invalid job payload" };
  }
  if (typeof job.prompt !== "string") {
    return { ok: false, error: "Missing or invalid prompt string" };
  }
  if (job.model !== undefined && (typeof job.model !== "string" || !MODEL_REGEX.test(job.model))) {
    return { ok: false, error: `Invalid model ID: ${String(job.model)}` };
  }
  if (
    job.resumeSessionId !== undefined &&
    (typeof job.resumeSessionId !== "string" || !UUID_REGEX.test(job.resumeSessionId))
  ) {
    return { ok: false, error: `Invalid resume session ID: ${String(job.resumeSessionId)}` };
  }
  return { ok: true };
}

export function validateServerUrl(serverUrl) {
  let parsed;
  try {
    parsed = new URL(serverUrl);
  } catch {
    throw new Error(`Invalid server URL: ${serverUrl}`);
  }
  const isLocal =
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
    parsed.protocol === "http:";
  if (parsed.protocol !== "https:" && !isLocal) {
    throw new Error(
      `Insecure server URL: ${serverUrl}. Only HTTPS is permitted (HTTP allowed only on 127.0.0.1 / localhost).`,
    );
  }
  return parsed.origin;
}

export async function executeJob(job, { baseUrl, token, claudeCli }) {
  const validation = validateJob(job);
  if (!validation.ok) {
    console.error(`[runner] Job rejected: ${validation.error}`);
    await postDone(baseUrl, token, job.id, 1);
    return false;
  }

  const cliArgs = [
    "--output-format", "stream-json",
    "--input-format", "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--tools", "",
    "--strict-mcp-config",
    "--permission-mode", "dontAsk",
    "--permission-prompts", "none",
    "--disable-slash-commands",
    "-p",
  ];

  if (job.model) {
    cliArgs.push("--model", job.model);
  }
  if (job.resumeSessionId) {
    cliArgs.push("--resume", job.resumeSessionId);
  }
  if (job.system) {
    cliArgs.push("--append-system-prompt", job.system);
  }

  let binary = claudeCli;
  let spawnArgs = cliArgs;
  if (claudeCli.endsWith(".ts")) {
    binary = process.execPath;
    spawnArgs = ["--experimental-strip-types", claudeCli, ...cliArgs];
  }

  let child;
  try {
    child = spawn(binary, spawnArgs, {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
  } catch (err) {
    console.error("[runner] Failed to spawn Claude CLI:", err);
    await postDone(baseUrl, token, job.id, 1);
    return false;
  }

  let observedSessionId = null;
  let linesBuffer = [];
  let flushTimer = null;

  const flushEvents = async () => {
    if (linesBuffer.length === 0) return;
    const batch = linesBuffer;
    linesBuffer = [];
    try {
      await fetch(`${baseUrl}/api/engine-relay/jobs/${encodeURIComponent(job.id)}/events`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lines: batch }),
      });
    } catch (err) {
      console.error("[runner] Failed to send events:", err.message);
    }
  };

  const queueLine = (line) => {
    if (!line.trim()) return;
    try {
      const parsed = JSON.parse(line);
      if (parsed.type === "system" && parsed.subtype === "init" && typeof parsed.session_id === "string") {
        observedSessionId = parsed.session_id;
      }
    } catch {}
    linesBuffer.push(line);
    if (linesBuffer.length >= 10) {
      void flushEvents();
    } else if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        void flushEvents();
      }, 100);
    }
  };

  let stdoutBuf = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdoutBuf += chunk;
    let nl;
    while ((nl = stdoutBuf.indexOf("\n")) !== -1) {
      const line = stdoutBuf.slice(0, nl);
      stdoutBuf = stdoutBuf.slice(nl + 1);
      queueLine(line);
    }
  });

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[claude stderr] ${chunk}`);
  });

  // Prompt sent on stdin as a stream-json user message
  const userMsg = {
    type: "user",
    message: { role: "user", content: job.prompt },
  };
  child.stdin.write(JSON.stringify(userMsg) + "\n");
  child.stdin.end();

  // Periodic lease loop (every 2s)
  let cancelled = false;
  const leaseInterval = setInterval(async () => {
    if (cancelled || child.exitCode !== null) return;
    try {
      const res = await fetch(`${baseUrl}/api/engine-relay/jobs/${encodeURIComponent(job.id)}/lease`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.cancelled) {
          cancelled = true;
          child.kill("SIGTERM");
          setTimeout(() => {
            if (child.exitCode === null) child.kill("SIGKILL");
          }, 1000);
        }
      }
    } catch {
      // Lease check failed, will retry next interval
    }
  }, 2000);

  await new Promise((resolve) => {
    child.on("close", resolve);
    child.on("error", resolve);
  });

  clearInterval(leaseInterval);
  clearTimeout(flushTimer);
  if (stdoutBuf.trim()) queueLine(stdoutBuf);
  await flushEvents();

  const exitCode = child.exitCode ?? (cancelled ? 1 : 0);
  await postDone(baseUrl, token, job.id, exitCode, observedSessionId);
  return true;
}

async function postDone(baseUrl, token, jobId, exitCode, sessionId) {
  try {
    await fetch(`${baseUrl}/api/engine-relay/jobs/${encodeURIComponent(jobId)}/done`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ exitCode, sessionId: sessionId ?? undefined }),
    });
  } catch (err) {
    console.error("[runner] Failed to post done:", err.message);
  }
}

export async function runRunnerLoop({ baseUrl, token, claudeCli, signal }) {
  console.log(`[runner] Connected to ${baseUrl}. Waiting for jobs...`);
  let backoffMs = 1000;

  while (!signal?.aborted) {
    try {
      const res = await fetch(`${baseUrl}/api/engine-relay/poll`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });

      if (res.status === 401 || res.status === 403) {
        console.error("[runner] Authentication failed: token invalid or revoked.");
        await sleep(5000, signal);
        continue;
      }

      if (res.status === 204) {
        backoffMs = 1000;
        continue;
      }

      if (res.status === 200) {
        backoffMs = 1000;
        const job = await res.json();
        await executeJob(job, { baseUrl, token, claudeCli });
        continue;
      }

      await sleep(backoffMs, signal);
      backoffMs = Math.min(backoffMs * 2, 30_000);
    } catch (err) {
      if (signal?.aborted) break;
      console.error(`[runner] Network error (${err.message}); retrying in ${backoffMs}ms`);
      await sleep(backoffMs, signal);
      backoffMs = Math.min(backoffMs * 2, 30_000);
    }
  }
}

function sleep(ms, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

// CLI entry point
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { values: flags } = parseArgs({
    options: {
      server: { type: "string" },
      token: { type: "string" },
      claude: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
    strict: false,
  });

  if (flags.help) {
    console.log("Usage: node runner.mjs --server <https-url> --token <token> [--claude <path>]");
    process.exit(0);
  }

  const rawServer = flags.server || process.env.KIND_MEITNER_RELAY_SERVER;
  const token = flags.token || process.env.KIND_MEITNER_RELAY_TOKEN;
  const claudeCli = flags.claude || process.env.KIND_MEITNER_CLAUDE_PATH || "claude";

  if (!rawServer) {
    console.error("Error: --server or KIND_MEITNER_RELAY_SERVER is required");
    process.exit(1);
  }
  if (!token) {
    console.error("Error: --token or KIND_MEITNER_RELAY_TOKEN is required");
    process.exit(1);
  }

  let baseUrl;
  try {
    baseUrl = validateServerUrl(rawServer);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const controller = new AbortController();
  process.on("SIGINT", () => controller.abort());
  process.on("SIGTERM", () => controller.abort());

  runRunnerLoop({ baseUrl, token, claudeCli, signal: controller.signal })
    .catch((err) => {
      console.error("[runner] Fatal error:", err);
      process.exit(1);
    });
}
