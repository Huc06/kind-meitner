#!/usr/bin/env node
// A real A2A agent for local development: serves an agent card and answers
// with the installed Claude CLI. Not a mock: every reply is a real model turn.
//
//   node scripts/dev/a2a-claude-agent.mjs --port 8810 --name "Research Agent" \
//     [--stream] [--verify-proof http://127.0.0.1:8799] \
//     [--price 10000 --pay-to 0x... --asset 0x...]
//
//   --stream         advertise and serve `message/stream` (SSE, real token stream)
//   --verify-proof   require kind-meitner's one-time X-KM-Request-Proof: Ed25519
//                    signature, audience, expiry, and a never-seen nonce
//   --price          answer `message/send` with HTTP 402 + an x402 challenge on
//                    X Layer testnet; a retry must carry a valid EIP-3009
//                    authorization signature (verified locally). This agent has
//                    no facilitator, so it never claims settlement.
//   A2A_AGENT_TOKEN=... requires `Authorization: Bearer <token>`.
import { spawn } from "node:child_process";
import { createPublicKey, randomUUID, verify } from "node:crypto";
import { createServer } from "node:http";
import { encodePaymentRequiredHeader, decodePaymentSignatureHeader } from "@okxweb3/x402-core/http";
import { recoverTypedDataAddress } from "viem";

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : process.argv[i + 1];
};
const has = (flag) => process.argv.includes(flag);
const port = Number(arg("--port", "8810"));
const name = arg("--name", "Research Agent");
const agentId = arg("--agent-id", "local-research-agent");
const stream = has("--stream");
const proofServer = arg("--verify-proof", undefined);
const price = arg("--price", undefined);
const payTo = arg("--pay-to", "0x000000000000000000000000000000000000dEaD");
const asset = arg("--asset", "0xcb8bf24c6ce16ad21d707c9505421a17f2bec79d");
const token = process.env.A2A_AGENT_TOKEN;
const origin = `http://127.0.0.1:${port}`;

const card = {
  name,
  description: "Local research agent answering through the Claude CLI. Text answers only.",
  url: `${origin}/`,
  version: "1.1.0",
  provider: { organization: "Local Claude CLI" },
  capabilities: { streaming: stream },
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/plain"],
  skills: [{ id: "research", name: "Research", tags: ["chat", "research"] }],
  metadata: { agentId },
};

// --- request proofs ------------------------------------------------------
let proofKey;
const seenNonces = new Map();
async function checkProof(header) {
  if (!proofServer) return null;
  if (!proofKey) {
    const res = await fetch(new URL("/api/external-agents/proof-key", proofServer));
    proofKey = createPublicKey((await res.json()).publicKeyPem);
  }
  if (!header) return "missing request proof";
  const [payload, signature] = header.split(".");
  if (!payload || !signature || !verify(null, Buffer.from(payload), proofKey, Buffer.from(signature, "base64url"))) return "bad signature";
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  const now = Date.now();
  if (claims.aud !== origin) return "wrong audience";
  if (claims.exp < now) return "expired proof";
  for (const [nonce, exp] of seenNonces) if (exp < now) seenNonces.delete(nonce);
  if (seenNonces.has(claims.nonce)) return "replayed proof";
  seenNonces.set(claims.nonce, claims.exp);
  return null;
}

// --- x402 testnet challenge / verification -------------------------------
const requirement = () => ({
  scheme: "exact",
  network: "eip155:1952",
  amount: String(price),
  asset,
  payTo,
  maxTimeoutSeconds: 300,
  extra: { name: "USDC_TEST", version: "2" },
});
const usedAuthNonces = new Set();
async function verifyPayment(header) {
  let payload;
  try {
    payload = decodePaymentSignatureHeader(header);
  } catch {
    return "unreadable payment header";
  }
  const req = requirement();
  const accepted = payload.accepted ?? {};
  if (accepted.network !== req.network || accepted.amount !== req.amount || accepted.payTo !== req.payTo) return "payment does not match the challenge";
  const { authorization, signature } = payload.payload ?? {};
  if (!authorization || !signature) return "missing authorization";
  if (usedAuthNonces.has(authorization.nonce)) return "authorization already used";
  if (Number(authorization.validBefore) * 1000 < Date.now()) return "authorization expired";
  if (authorization.to.toLowerCase() !== req.payTo.toLowerCase() || authorization.value !== req.amount) return "authorization does not match";
  const signer = await recoverTypedDataAddress({
    domain: { name: req.extra.name, version: req.extra.version, chainId: 1952, verifyingContract: req.asset },
    types: { TransferWithAuthorization: [
      { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
    ] },
    primaryType: "TransferWithAuthorization",
    message: { ...authorization, value: BigInt(authorization.value), validAfter: BigInt(authorization.validAfter), validBefore: BigInt(authorization.validBefore) },
    signature,
  });
  if (signer.toLowerCase() !== authorization.from.toLowerCase()) return "signature does not match payer";
  usedAuthNonces.add(authorization.nonce);
  console.log(`[${name}] verified testnet EIP-3009 authorization from ${signer} for ${req.amount} units (not settled: no facilitator)`);
  return null;
}

// --- Claude --------------------------------------------------------------
const running = new Map();
function runClaude(prompt, onDelta) {
  return new Promise((resolve, reject) => {
    const args = onDelta
      ? ["-p", prompt, "--output-format", "stream-json", "--include-partial-messages", "--verbose", "--max-turns", "1"]
      : ["-p", prompt, "--output-format", "text", "--max-turns", "1"];
    const child = spawn("claude", args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    let lines = "";
    child.stdout.on("data", (chunk) => {
      if (!onDelta) {
        out += chunk;
        return;
      }
      lines += chunk;
      let nl;
      while ((nl = lines.indexOf("\n")) !== -1) {
        const line = lines.slice(0, nl);
        lines = lines.slice(nl + 1);
        try {
          const event = JSON.parse(line);
          const delta = event.type === "stream_event" && event.event?.delta?.type === "text_delta" ? event.event.delta.text : "";
          if (delta) {
            out += delta;
            onDelta(delta);
          }
        } catch {
          /* non-JSON line */
        }
      }
    });
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("error", reject);
    child.on("close", (code, signal) => (code === 0 ? resolve(out.trim()) : reject(new Error(signal ? `stopped (${signal})` : err.trim() || `claude exited ${code}`))));
    resolve.child = child;
    running.set(prompt, child);
  });
}

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
};

const tasks = new Map();

createServer(async (req, res) => {
  if (token && req.headers.authorization !== `Bearer ${token}`) return send(res, 401, { error: "unauthorized" });
  const proofError = await checkProof(req.headers["x-km-request-proof"]);
  if (proofError) {
    console.log(`[${name}] rejected request: ${proofError}`);
    return send(res, 401, { error: proofError });
  }
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
  if (rpc.method === "tasks/cancel") {
    const task = tasks.get(rpc.params?.id);
    task?.child?.kill("SIGTERM");
    console.log(`[${name}] tasks/cancel ${rpc.params?.id} → ${task ? "stopped" : "unknown task"}`);
    return send(res, 200, { jsonrpc: "2.0", id: rpc.id, result: { kind: "task", id: rpc.params?.id, status: { state: "canceled" }, artifacts: [] } });
  }
  if (rpc.method !== "message/send" && rpc.method !== "message/stream") {
    return send(res, 200, { jsonrpc: "2.0", id: rpc.id, error: { code: -32601, message: "method not found" } });
  }
  if (price) {
    const paid = req.headers["payment-signature"];
    if (!paid) {
      console.log(`[${name}] 402: asking ${price} testnet units`);
      const challenge = encodePaymentRequiredHeader({
        x402Version: 2,
        error: "payment required",
        resource: { url: `${origin}/`, description: "One research answer (testnet)", mimeType: "application/json" },
        accepts: [requirement()],
      });
      return send(res, 402, { error: "payment required" }, { "PAYMENT-REQUIRED": challenge });
    }
    const paymentError = await verifyPayment(paid);
    if (paymentError) {
      console.log(`[${name}] payment rejected: ${paymentError}`);
      return send(res, 402, { error: paymentError });
    }
  }
  const text = (rpc.params?.message?.parts ?? []).filter((p) => p.kind === "text").map((p) => p.text).join("\n");
  const contextId = rpc.params?.message?.contextId ?? randomUUID();
  console.log(`[${name}] ${rpc.method} ${rpc.id} (${text.length} chars)`);

  if (rpc.method === "message/stream") {
    const taskId = randomUUID();
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    const emit = (result) => res.write(`data: ${JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result })}\n\n`);
    emit({ kind: "task", id: taskId, contextId, status: { state: "working" }, artifacts: [], metadata: { agentId } });
    const task = { child: undefined };
    tasks.set(taskId, task);
    const pending = runClaude(text, (delta) => emit({ kind: "artifact-update", taskId, contextId, append: true, artifact: { parts: [{ kind: "text", text: delta }] }, metadata: { agentId } }));
    task.child = running.get(text);
    req.on("close", () => task.child?.kill("SIGTERM"));
    try {
      await pending;
      emit({ kind: "status-update", taskId, contextId, final: true, status: { state: "completed" }, metadata: { agentId } });
    } catch (error) {
      emit({ kind: "status-update", taskId, contextId, final: true, status: { state: "canceled", message: { parts: [{ kind: "text", text: String(error.message) }] } }, metadata: { agentId } });
    } finally {
      tasks.delete(taskId);
      res.end();
    }
    return;
  }
  try {
    const answer = await runClaude(text);
    send(res, 200, { jsonrpc: "2.0", id: rpc.id, result: { kind: "message", role: "agent", messageId: randomUUID(), contextId, parts: [{ kind: "text", text: answer }], metadata: { agentId } } });
  } catch (error) {
    console.log(`[${name}] error answering ${rpc.id}: ${String(error.message ?? error).slice(0, 300)}`);
    send(res, 200, { jsonrpc: "2.0", id: rpc.id, error: { code: -32000, message: String(error.message ?? error).slice(0, 200) } });
  }
}).listen(port, "127.0.0.1", () => console.log(`A2A agent "${name}" on ${origin}/${stream ? " (streaming)" : ""}${proofServer ? " (proof required)" : ""}${price ? ` (402: ${price} testnet units)` : ""}`));
