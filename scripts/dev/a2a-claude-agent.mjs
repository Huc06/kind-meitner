#!/usr/bin/env node
// A real A2A agent for local development: serves an agent card and answers
// `message/send` by running the installed Claude CLI (`claude -p`). Not a
// mock: every reply is a real model turn on this machine.
//
//   node scripts/dev/a2a-claude-agent.mjs --port 8810 --name "Research Agent"
//
// Optional: A2A_AGENT_TOKEN=... requires `Authorization: Bearer <token>`.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : process.argv[i + 1];
};
const port = Number(arg("--port", "8810"));
const name = arg("--name", "Research Agent");
const agentId = arg("--agent-id", "local-research-agent");
const token = process.env.A2A_AGENT_TOKEN;

const card = {
  name,
  description: "Local research agent answering through the Claude CLI. Read-only: text answers only.",
  url: `http://127.0.0.1:${port}/`,
  version: "1.0.0",
  provider: { organization: "Local Claude CLI" },
  capabilities: { streaming: false },
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/plain"],
  skills: [{ id: "research", name: "Research", tags: ["chat", "research"] }],
  metadata: { agentId },
};

function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p", prompt, "--output-format", "text", "--max-turns", "1"], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(err.trim() || `claude exited ${code}`))));
  });
}

const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

createServer(async (req, res) => {
  if (token && req.headers.authorization !== `Bearer ${token}`) return send(res, 401, { error: "unauthorized" });
  if (req.method === "GET" && req.url === "/.well-known/agent.json") return send(res, 200, card);
  if (req.method !== "POST") return send(res, 404, { error: "not found" });
  let raw = "";
  for await (const chunk of req) raw += chunk;
  let rpc;
  try {
    rpc = JSON.parse(raw);
  } catch {
    return send(res, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } });
  }
  if (rpc.method !== "message/send") return send(res, 200, { jsonrpc: "2.0", id: rpc.id, error: { code: -32601, message: "method not found" } });
  const parts = rpc.params?.message?.parts ?? [];
  const text = parts.filter((p) => p.kind === "text").map((p) => p.text).join("\n");
  const contextId = rpc.params?.message?.contextId ?? randomUUID();
  console.log(`[${name}] message/send ${rpc.id} (${text.length} chars)`);
  try {
    const answer = await runClaude(text);
    send(res, 200, {
      jsonrpc: "2.0",
      id: rpc.id,
      result: { kind: "message", role: "agent", messageId: randomUUID(), contextId, parts: [{ kind: "text", text: answer }], metadata: { agentId } },
    });
  } catch (error) {
    send(res, 200, { jsonrpc: "2.0", id: rpc.id, error: { code: -32000, message: String(error.message ?? error).slice(0, 200) } });
  }
}).listen(port, "127.0.0.1", () => console.log(`A2A agent "${name}" on http://127.0.0.1:${port}/`));
