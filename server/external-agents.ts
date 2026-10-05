// External agents: remote A2A agents a room can talk to, reached either
// directly or through a zroute proxy. They are room participants, not models:
// nothing here touches bot records or engine selection.
//
// Protocol: A2A JSON-RPC 2.0 (v0.2/v0.3 method names). Identity comes from the
// agent card at /.well-known/agent-card.json (v0.3+) or agent.json (v0.2);
// chat uses `message/send`, or `message/stream`
// (Server-Sent Events) when the card advertises streaming, and `tasks/cancel`
// when the person stops a streamed task. A zroute connection is the same wire
// protocol through a proxy, plus a route ID sent as message metadata and a
// REQUIRED upstream identity (card and result `metadata.upstream`).
//
// Credentials: a per-connection bearer token in the encrypted server secret
// store (external-agent-secrets.ts), or — development fallback — a named
// KIND_MEITNER_EXT_* environment variable. Every request also carries a
// one-time Ed25519-signed proof (X-KM-Request-Proof) bound to connection,
// agent, purpose, request ID and expiry, so an agent can reject replays.
//
// Payments: off unless the person opts a connection into X Layer TESTNET
// payments. An HTTP 402 then becomes an approval card (external-payments.ts);
// nothing is signed without that approval and mainnet is refused outright.
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decodePaymentRequiredHeader } from "@okxweb3/x402-core/http";
import type { PaymentRequired } from "@okxweb3/x402-core/types";
import { z } from "zod";

const Text = z.string().trim().min(1);

export type ExternalTransport = "direct" | "zroute";
export type ExternalAgentStatus = "draft" | "checking" | "ready" | "offline" | "revoked" | "error";
type UpstreamIdentity = { agentId?: string; name?: string; provider?: string };

export type ExternalAgentConnection = {
  id: string;
  displayName: string;
  provider: string;
  transport: ExternalTransport;
  protocol: "a2a";
  endpointUrl: string;
  routeId?: string;
  upstreamAgentId?: string;
  /** Identity the agent itself reported on the last successful check. */
  reportedName?: string;
  reportedUpstream?: UpstreamIdentity;
  capabilities: string[];
  /** Set from the agent card: the agent supports `message/stream`. */
  streaming?: boolean;
  /** The person opted this connection into approval-gated TESTNET payments. */
  paymentsTestnet?: boolean;
  network?: string;
  status: ExternalAgentStatus;
  provenance: "direct-endpoint" | "zroute-proxy" | "local-catalog";
  /** Development fallback: server environment variable holding the token. */
  credentialEnv?: string;
  lastCheckedAt?: string;
  lastLatencyMs?: number;
  createdAt: string;
};

/** What the browser may see: no credential, no variable name, no query. */
export type PublicExternalAgent = Omit<ExternalAgentConnection, "credentialEnv" | "endpointUrl"> & {
  endpointHost: string;
  endpointPath: string;
  credentialsConfigured: boolean;
  credentialSource?: "secret-store" | "environment";
  readOnly: boolean;
};

export type ConnectionCheck = {
  ok: boolean;
  status: "ready" | "offline" | "invalid" | "unauthorized" | "timeout" | "error";
  provider: string;
  agentId?: string;
  agentName?: string;
  upstream?: UpstreamIdentity;
  capabilities: string[];
  streaming?: boolean;
  latencyMs?: number;
  provenance: string;
  safeMessage: string;
};

export type PaymentRequiredChallenge = PaymentRequired;

export type ExternalAgentResult =
  | { ok: true; text: string; flags: ContentFlag[]; latencyMs: number; upstream?: UpstreamIdentity; contextId?: string; paymentResponse?: string }
  | { ok: false; status: "timeout" | "unauthorized" | "offline" | "invalid" | "error" | "cancelled"; safeMessage: string; latencyMs: number }
  | { ok: false; status: "payment_required"; safeMessage: string; latencyMs: number; challenge: PaymentRequiredChallenge };

/** What the adapter needs from the secret store; injectable for tests. */
export interface ExternalAgentSecretsLike {
  token(connectionId: string): string | undefined;
  signProof(payload: string): string;
}

export interface SendInput {
  connection: ExternalAgentConnection;
  roomId: string;
  requestId: string;
  message: string;
  conversationId?: string;
  /** Streaming: called with the full reply text so far. */
  onText?: (text: string) => void;
  /** The person pressed Stop. */
  signal?: AbortSignal;
  /** Approved x402 payment headers for the retry after a 402. */
  paymentHeaders?: Record<string, string>;
}

export interface ExternalAgentAdapter {
  checkConnection(connection: ExternalAgentConnection): Promise<ConnectionCheck>;
  sendMessage(input: SendInput): Promise<ExternalAgentResult>;
}

export const MESSAGES = {
  notHttps: "Endpoint is not HTTPS.",
  unsupported: "The agent did not return a supported response.",
  noAuth: "Authentication is not configured on the server.",
  unreachable: "The upstream agent could not be reached.",
  upstreamMissing: "The zroute proxy responded, but the upstream identity was missing.",
  capability: "This capability is not enabled for this connection.",
  timeout: "The request timed out; no fallback was executed.",
  notInRoom: "The agent is connected, but not available in this room.",
  revoked: "This connection was removed; requests to it are refused.",
  cancelled: "Stopped by you; no fallback was executed.",
  paymentRequired: "The agent asked for payment.",
  paymentsOff: "The agent asked for payment, but payments are off for this connection. Nothing was paid.",
} as const;

/** Advertised capabilities are untrusted. Value-moving ones are never taken
 * from a card; testnet payments exist only as the person's own opt-in. */
const ALLOWED_CAPABILITIES = new Set(["chat", "text", "research", "market-intelligence", "readiness", "trust", "read-only", "summarize", "search"]);
const FORBIDDEN_CAPABILITY = /wallet|pay|sign|transfer|escrow|swap|trade|execute|mint|withdraw|deposit|x402|key/i;

export function allowedCapabilities(declared: unknown): string[] {
  if (!Array.isArray(declared)) return [];
  const out: string[] = [];
  for (const raw of declared) {
    if (typeof raw !== "string") continue;
    const cap = raw.trim().toLowerCase().slice(0, 40);
    if (!cap || FORBIDDEN_CAPABILITY.test(cap) || !ALLOWED_CAPABILITIES.has(cap)) continue;
    if (!out.includes(cap)) out.push(cap);
  }
  return out;
}

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
export function loopbackAllowed(): boolean {
  return process.env.KIND_MEITNER_ALLOW_LOOPBACK_AGENTS === "1";
}

/** HTTPS only; plain http only for loopback hosts and only when the
 * development flag is on. No credentials (userinfo or credential-like query
 * keys) or fragments in the URL: tokens go to the server secret store. */
const CREDENTIAL_QUERY_KEY = /token|secret|key|auth|pass|sig|session|credential|bearer/i;
export function validateEndpoint(raw: string): { ok: true; url: URL } | { ok: false; message: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, message: "Endpoint is not a valid URL." };
  }
  if (url.username || url.password) return { ok: false, message: "Endpoint must not contain credentials." };
  if ([...url.searchParams.keys()].some((key) => CREDENTIAL_QUERY_KEY.test(key))) {
    return { ok: false, message: "Endpoint must not contain credentials; set the token as a server credential." };
  }
  const loopback = LOOPBACK.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback && loopbackAllowed())) {
    return { ok: false, message: MESSAGES.notHttps };
  }
  if (loopback && !loopbackAllowed()) return { ok: false, message: "Loopback endpoints are only allowed in development." };
  url.hash = "";
  return { ok: true, url };
}

const CREDENTIAL_ENV = /^KIND_MEITNER_EXT_[A-Z0-9_]{1,60}$/;
export function validCredentialEnv(name: unknown): name is string {
  return typeof name === "string" && CREDENTIAL_ENV.test(name);
}

const CreateInput = z.object({
  transport: z.enum(["direct", "zroute"], { message: "transport must be direct or zroute" }),
  protocol: z.literal("a2a", { message: "Only the A2A protocol is supported." }).optional(),
  displayName: Text.max(80, "Agent name is too long.").describe("Agent name"),
  provider: Text.max(80).optional(),
  endpointUrl: z.string(),
  routeId: Text.max(120).optional(),
  upstreamAgentId: Text.max(120).optional(),
  capabilities: z.array(z.string()).max(20).optional(),
  credentialEnv: z.union([z.literal(""), z.string().regex(CREDENTIAL_ENV, "Credential variable must look like KIND_MEITNER_EXT_NAME.")]).optional()
    .transform((value) => value || undefined),
  paymentsTestnet: z.boolean().optional(),
});

function credentialFor(connection: ExternalAgentConnection, secrets?: ExternalAgentSecretsLike): { value: string; source: "secret-store" | "environment" } | undefined {
  const stored = secrets?.token(connection.id);
  if (stored) return { value: stored, source: "secret-store" };
  if (!connection.credentialEnv || !validCredentialEnv(connection.credentialEnv)) return undefined;
  const value = process.env[connection.credentialEnv]?.trim();
  return value ? { value, source: "environment" } : undefined;
}

export function toPublic(connection: ExternalAgentConnection, secrets?: ExternalAgentSecretsLike): PublicExternalAgent {
  const { credentialEnv: _credentialEnv, endpointUrl, ...rest } = connection;
  const url = new URL(endpointUrl);
  const credential = credentialFor(connection, secrets);
  return {
    ...rest,
    endpointHost: url.host,
    endpointPath: url.pathname,
    credentialsConfigured: Boolean(credential),
    ...(credential ? { credentialSource: credential.source } : {}),
    readOnly: !connection.paymentsTestnet,
  };
}

/** Removes anything that looks like a credential before text is stored. */
export function redact(text: string): string {
  return text
    .replace(/(authorization|api[_-]?key|token|secret)(["']?\s*[:=]\s*["']?)(bearer\s+)?[^\s"',}]+/gi, "$1$2$3[redacted]")
    .replace(/\bbearer\s+(?!\[redacted\])[^\s"',}]+/gi, "Bearer [redacted]")
    .replace(/\b(sk|pk|xox[a-z])-[A-Za-z0-9_-]{10,}\b/g, "[redacted]")
    .replace(/\b0x[0-9a-fA-F]{64}\b/g, "[redacted]");
}

export type ContentFlag = "hidden-characters" | "unsafe-link" | "instructions-to-agents" | "redacted-secret" | "truncated";
const MAX_REPLY = 20_000;
// Control characters are exactly what this pattern exists to strip.
// oxlint-disable-next-line no-control-regex
const HIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
const UNSAFE_LINK = /(\]\(\s*|<)(javascript|data|vbscript|file):[^)>\s]*[)>]?/gi;
const INJECTION = /\b(ignore|disregard|forget)\s+(all\s+|any\s+|the\s+|your\s+)?(previous|prior|above|earlier|system)\s+(instructions|messages|rules|prompts?)\b|\byou\s+are\s+now\b|\b(reveal|print|show)\s+(your|the)\s+(system\s+prompt|instructions|api\s+key|secrets?|private\s+key)\b|\bnew\s+instructions\s*:/i;

/** Reply text is untrusted input. Hidden/control characters and script links
 * are removed, secrets redacted, length capped; instruction-like text is kept
 * (it may be legitimate) but flagged so the UI and reading bots treat it as data. */
export function sanitizeReply(raw: string): { text: string; flags: ContentFlag[] } {
  const flags: ContentFlag[] = [];
  let text = raw.normalize("NFC");
  const visible = text.replace(HIDDEN, "");
  if (visible !== text) flags.push("hidden-characters");
  text = visible.replace(/\r\n?/g, "\n");
  const linked = text.replace(UNSAFE_LINK, (_m, open: string) => (open.startsWith("]") ? "](#blocked-link)" : "[blocked link]"));
  if (linked !== text) flags.push("unsafe-link");
  text = linked;
  const redacted = redact(text);
  if (redacted !== text) flags.push("redacted-secret");
  text = redacted;
  if (INJECTION.test(text)) flags.push("instructions-to-agents");
  if (text.length > MAX_REPLY) {
    text = `${text.slice(0, MAX_REPLY)}\n[truncated]`;
    flags.push("truncated");
  }
  return { text, flags };
}


const Upstream = z.object({ agentId: Text.max(120).optional(), name: Text.max(120).optional(), provider: Text.max(120).optional() });
const Part = z.object({ kind: z.string().optional(), type: z.string().optional(), text: z.string().optional() });
const Parts = z.array(Part).default([]);
const Metadata = z.object({ agentId: Text.max(120).optional(), upstream: Upstream.optional() }).partial().default({});

/** A2A agent card: only the fields identity and capabilities need. */
const AgentCard = z.object({
  name: Text.max(120),
  provider: z.object({ organization: Text.max(120).optional() }).optional(),
  capabilities: z.object({ streaming: z.boolean().optional() }).partial().default({}),
  skills: z.array(z.object({ id: z.string().optional(), tags: z.array(z.string()).optional() })).default([]),
  metadata: Metadata,
});

const MessageResult = z.object({ kind: z.literal("message"), parts: Parts, contextId: z.string().optional(), metadata: Metadata });
const TaskResult = z.object({
  kind: z.literal("task"),
  id: z.string().optional(),
  contextId: z.string().optional(),
  status: z.object({ state: z.string(), message: z.object({ parts: Parts }).optional() }),
  artifacts: z.array(z.object({ parts: Parts })).default([]),
  metadata: Metadata,
});
const RpcError = z.object({ jsonrpc: z.literal("2.0"), error: z.object({ message: z.string() }) });
const SendResult = z.object({ jsonrpc: z.literal("2.0"), result: z.discriminatedUnion("kind", [MessageResult, TaskResult]) });

/** One Server-Sent Event of `message/stream`. */
const StreamEvent = z.object({
  jsonrpc: z.literal("2.0"),
  result: z.discriminatedUnion("kind", [
    MessageResult,
    TaskResult,
    z.object({
      kind: z.literal("status-update"),
      taskId: z.string().optional(),
      contextId: z.string().optional(),
      final: z.boolean().optional(),
      status: z.object({ state: z.string(), message: z.object({ parts: Parts }).optional() }),
      metadata: Metadata,
    }),
    z.object({
      kind: z.literal("artifact-update"),
      taskId: z.string().optional(),
      contextId: z.string().optional(),
      append: z.boolean().optional(),
      lastChunk: z.boolean().optional(),
      artifact: z.object({ parts: Parts }),
      metadata: Metadata,
    }),
  ]),
});

type CardIdentity = { name: string; agentId: string; provider?: string; capabilities: string[]; streaming: boolean; upstream?: UpstreamIdentity };

function parseCard(body: unknown): CardIdentity | null {
  const card = AgentCard.safeParse(body);
  if (!card.success) return null;
  const { name, provider, skills, metadata, capabilities } = card.data;
  const skillCaps = skills.flatMap((skill) => [skill.id ?? "", ...(skill.tags ?? [])]);
  return {
    name,
    agentId: metadata.agentId ?? name,
    provider: provider?.organization,
    capabilities: allowedCapabilities(["chat", ...skillCaps]),
    streaming: capabilities.streaming === true,
    upstream: metadata.upstream,
  };
}

const textFromParts = (parts: z.infer<typeof Parts>): string =>
  parts.flatMap((part) => ((part.kind ?? part.type) === "text" && part.text ? [part.text] : [])).join("\n");

/** A2A `message/send` returns either a Message or a completed Task. */
export function parseSendResult(body: unknown): { text: string; contextId?: string; upstream?: UpstreamIdentity } | null {
  const parsed = SendResult.safeParse(body);
  if (!parsed.success) return null;
  const result = parsed.data.result;
  const text = result.kind === "message"
    ? textFromParts(result.parts)
    : result.status.state === "completed"
      ? result.artifacts.map((artifact) => textFromParts(artifact.parts)).filter(Boolean).join("\n") || textFromParts(result.status.message?.parts ?? [])
      : "";
  return text ? { text, contextId: result.contextId, upstream: result.metadata.upstream } : null;
}

/** Folds `message/stream` events into the reply so far. */
export class StreamAccumulator {
  text = "";
  taskId?: string;
  contextId?: string;
  upstream?: UpstreamIdentity;
  done = false;
  failed = false;
  private artifactText = "";

  push(raw: unknown): boolean {
    const parsed = StreamEvent.safeParse(raw);
    if (!parsed.success) return false;
    const event = parsed.data.result;
    this.contextId = event.contextId ?? this.contextId;
    this.upstream = event.metadata.upstream ?? this.upstream;
    if (event.kind === "message") {
      this.text = textFromParts(event.parts);
      this.done = true;
    } else if (event.kind === "task") {
      this.taskId = event.id ?? this.taskId;
      const artifacts = event.artifacts.map((artifact) => textFromParts(artifact.parts)).filter(Boolean).join("\n");
      if (artifacts) this.artifactText = artifacts;
      this.settle(event.status.state, event.status.message?.parts);
    } else if (event.kind === "artifact-update") {
      this.taskId = event.taskId ?? this.taskId;
      const chunk = textFromParts(event.artifact.parts);
      this.artifactText = event.append ? this.artifactText + chunk : chunk;
      this.text = this.artifactText;
    } else {
      this.taskId = event.taskId ?? this.taskId;
      this.settle(event.status.state, event.status.message?.parts, event.final);
    }
    return true;
  }

  private settle(state: string, parts?: z.infer<typeof Parts>, final?: boolean) {
    const statusText = parts ? textFromParts(parts) : "";
    this.text = this.artifactText || (state === "working" ? this.text + statusText : statusText || this.text);
    if (state === "completed") this.done = true;
    if (state === "failed" || state === "canceled" || state === "rejected") this.failed = true;
    if (final && !this.failed) this.done = true;
  }
}

type Fetch = typeof fetch;
const DEFAULT_TIMEOUT_MS = 30_000;
function timeoutMs(): number {
  const fromEnv = Number(process.env.KIND_MEITNER_EXTERNAL_AGENT_TIMEOUT_MS);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_TIMEOUT_MS;
}

const PROOF_TTL_MS = 120_000;
/** One-time request proof: Ed25519 over the canonical JSON payload. The
 * agent verifies it with GET /api/external-agents/proof-key, checks `aud`,
 * `exp`, and rejects any `nonce` it has seen. */
export function requestProof(secrets: ExternalAgentSecretsLike, claims: { connectionId: string; agentId?: string; audience: string; purpose: string; requestId: string }): string {
  const now = Date.now();
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    cid: claims.connectionId,
    ...(claims.agentId ? { aid: claims.agentId } : {}),
    aud: claims.audience,
    purpose: claims.purpose,
    rid: claims.requestId,
    nonce: randomUUID(),
    iat: now,
    exp: now + PROOF_TTL_MS,
  })).toString("base64url");
  return `${payload}.${secrets.signProof(payload)}`;
}

type Opened = { res: Response; latencyMs: number; done: () => void } | { error: "timeout" | "cancelled" | "failed"; latencyMs: number };

class A2AAdapter implements ExternalAgentAdapter {
  private readonly fetchImpl: Fetch;
  private readonly zroute: boolean;
  private readonly secrets?: ExternalAgentSecretsLike;
  constructor(fetchImpl: Fetch, zroute: boolean, secrets?: ExternalAgentSecretsLike) {
    this.fetchImpl = fetchImpl;
    this.zroute = zroute;
    this.secrets = secrets;
  }

  private headers(connection: ExternalAgentConnection, url: URL, purpose: string, requestId: string, accept = "application/json"): Record<string, string> {
    const headers: Record<string, string> = { "content-type": "application/json", accept };
    const credential = credentialFor(connection, this.secrets);
    if (credential) headers.authorization = `Bearer ${credential.value}`;
    if (this.secrets) {
      headers["x-km-request-proof"] = requestProof(this.secrets, {
        connectionId: connection.id,
        agentId: connection.upstreamAgentId ?? connection.reportedName,
        audience: url.origin,
        purpose,
        requestId,
      });
    }
    return headers;
  }

  /** fetch bounded by the timeout and the person's Stop, telling them apart. */
  private async open(url: string, init: RequestInit, signal?: AbortSignal): Promise<Opened> {
    const started = Date.now();
    const controller = new AbortController();
    let reason: "timeout" | "cancelled" | undefined;
    const timer = setTimeout(() => {
      reason = "timeout";
      controller.abort();
    }, timeoutMs());
    const onStop = () => {
      reason = "cancelled";
      controller.abort();
    };
    if (signal?.aborted) onStop();
    signal?.addEventListener("abort", onStop, { once: true });
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onStop);
    };
    try {
      const res = await this.fetchImpl(url, { ...init, signal: controller.signal, redirect: "error" });
      return { res, latencyMs: Date.now() - started, done };
    } catch {
      done();
      return { error: reason ?? "failed", latencyMs: Date.now() - started };
    }
  }

  async checkConnection(connection: ExternalAgentConnection): Promise<ConnectionCheck> {
    const provenance = this.zroute ? "zroute-proxy" : "direct-endpoint";
    const base = { provider: connection.provider, capabilities: [] as string[], provenance };
    const valid = validateEndpoint(connection.endpointUrl);
    if (!valid.ok) return { ...base, ok: false, status: "invalid", safeMessage: valid.message };
    if (connection.credentialEnv && !credentialFor(connection, this.secrets)) {
      return { ...base, ok: false, status: "unauthorized", safeMessage: MESSAGES.noAuth };
    }
    // A2A v0.3+ publishes the card at agent-card.json; v0.2 agents at agent.json.
    // Only a 404 moves on to the older path; any other answer is the result.
    const fetchCard = (file: string) => {
      const card = new URL(valid.url);
      card.pathname = `${card.pathname.replace(/\/$/, "")}/.well-known/${file}`;
      card.search = "";
      return this.open(card.toString(), { method: "GET", headers: this.headers(connection, card, "agent-card", randomUUID()) });
    };
    let opened = await fetchCard("agent-card.json");
    if (!("error" in opened) && opened.res.status === 404) {
      opened.done();
      opened = await fetchCard("agent.json");
    }
    if ("error" in opened) {
      return opened.error === "timeout"
        ? { ...base, ok: false, status: "timeout", latencyMs: opened.latencyMs, safeMessage: "The agent did not answer before the timeout." }
        : { ...base, ok: false, status: "offline", latencyMs: opened.latencyMs, safeMessage: MESSAGES.unreachable };
    }
    const { res, latencyMs } = opened;
    try {
      if (res.status === 401 || res.status === 403) {
        return { ...base, ok: false, status: "unauthorized", latencyMs, safeMessage: credentialFor(connection, this.secrets) ? "The agent rejected the server credential or request proof." : MESSAGES.noAuth };
      }
      if (!res.ok) return { ...base, ok: false, status: "offline", latencyMs, safeMessage: MESSAGES.unreachable };
      const identity = parseCard(await res.json().catch(() => null));
      if (!identity) return { ...base, ok: false, status: "invalid", latencyMs, safeMessage: MESSAGES.unsupported };
      if (connection.upstreamAgentId && !this.zroute && identity.agentId !== connection.upstreamAgentId) {
        return { ...base, ok: false, status: "invalid", latencyMs, safeMessage: `The agent reported identity "${identity.agentId}", not "${connection.upstreamAgentId}".` };
      }
      if (this.zroute) {
        if (!identity.upstream?.agentId) return { ...base, ok: false, status: "invalid", latencyMs, safeMessage: MESSAGES.upstreamMissing };
        if (connection.upstreamAgentId && identity.upstream.agentId !== connection.upstreamAgentId) {
          return { ...base, ok: false, status: "invalid", latencyMs, safeMessage: `The zroute proxy routes to "${identity.upstream.agentId}", not "${connection.upstreamAgentId}".` };
        }
      }
      return {
        ok: true,
        status: "ready",
        provider: this.zroute ? "zroute proxy" : identity.provider ?? connection.provider,
        agentId: identity.agentId,
        agentName: identity.name,
        upstream: identity.upstream,
        capabilities: identity.capabilities,
        streaming: identity.streaming,
        latencyMs,
        provenance,
        safeMessage: this.zroute ? `Connected through zroute to ${identity.upstream?.name ?? identity.upstream?.agentId}.` : `Connected to ${identity.name}.`,
      };
    } finally {
      opened.done();
    }
  }

  async sendMessage(input: SendInput): Promise<ExternalAgentResult> {
    const { connection } = input;
    const valid = validateEndpoint(connection.endpointUrl);
    if (!valid.ok) return { ok: false, status: "invalid", safeMessage: valid.message, latencyMs: 0 };
    if (connection.credentialEnv && !credentialFor(connection, this.secrets)) return { ok: false, status: "unauthorized", safeMessage: MESSAGES.noAuth, latencyMs: 0 };
    const streaming = Boolean(connection.streaming && input.onText);
    const method = streaming ? "message/stream" : "message/send";
    const body = {
      jsonrpc: "2.0",
      id: input.requestId,
      method,
      params: {
        message: {
          kind: "message",
          role: "user",
          messageId: input.requestId,
          ...(input.conversationId ? { contextId: input.conversationId } : {}),
          parts: [{ kind: "text", text: input.message }],
        },
        configuration: { blocking: true, acceptedOutputModes: ["text/plain"] },
        metadata: { roomId: input.roomId, ...(this.zroute && connection.routeId ? { routeId: connection.routeId } : {}) },
      },
    };
    const headers = { ...this.headers(connection, valid.url, method, input.requestId, streaming ? "text/event-stream" : "application/json"), ...input.paymentHeaders };
    const opened = await this.open(valid.url.toString(), { method: "POST", headers, body: JSON.stringify(body) }, input.signal);
    if ("error" in opened) {
      if (opened.error === "timeout") return { ok: false, status: "timeout", safeMessage: MESSAGES.timeout, latencyMs: opened.latencyMs };
      if (opened.error === "cancelled") return { ok: false, status: "cancelled", safeMessage: MESSAGES.cancelled, latencyMs: opened.latencyMs };
      return { ok: false, status: "offline", safeMessage: MESSAGES.unreachable, latencyMs: opened.latencyMs };
    }
    const { res, latencyMs } = opened;
    try {
      if (res.status === 402) {
        const header = res.headers.get("payment-required");
        let challenge: PaymentRequiredChallenge | undefined;
        try {
          challenge = header ? decodePaymentRequiredHeader(header) : undefined;
        } catch {
          challenge = undefined;
        }
        if (!challenge) return { ok: false, status: "invalid", safeMessage: MESSAGES.unsupported, latencyMs };
        return { ok: false, status: "payment_required", safeMessage: MESSAGES.paymentRequired, latencyMs, challenge };
      }
      if (res.status === 401 || res.status === 403) return { ok: false, status: "unauthorized", safeMessage: MESSAGES.noAuth, latencyMs };
      if (!res.ok) return { ok: false, status: "offline", safeMessage: MESSAGES.unreachable, latencyMs };
      const paymentResponse = res.headers.get("payment-response") ?? undefined;
      if (streaming && res.headers.get("content-type")?.includes("text/event-stream") && res.body) {
        return await this.readStream(res, input, latencyMs, paymentResponse);
      }
      const body: unknown = await res.json().catch(() => null);
      const parsed = parseSendResult(body);
      if (!parsed) {
        const rpcError = RpcError.safeParse(body);
        return rpcError.success
          ? { ok: false, status: "error", safeMessage: `The agent returned an error: ${sanitizeReply(rpcError.data.error.message).text.slice(0, 200)}`, latencyMs }
          : { ok: false, status: "invalid", safeMessage: MESSAGES.unsupported, latencyMs };
      }
      if (this.zroute && !parsed.upstream?.agentId) return { ok: false, status: "invalid", safeMessage: MESSAGES.upstreamMissing, latencyMs };
      const clean = sanitizeReply(parsed.text);
      return { ok: true, text: clean.text, flags: clean.flags, latencyMs, upstream: parsed.upstream, contextId: parsed.contextId, ...(paymentResponse ? { paymentResponse } : {}) };
    } catch {
      return input.signal?.aborted
        ? { ok: false, status: "cancelled", safeMessage: MESSAGES.cancelled, latencyMs }
        : { ok: false, status: "timeout", safeMessage: MESSAGES.timeout, latencyMs };
    } finally {
      opened.done();
    }
  }

  private async readStream(res: Response, input: SendInput, latencyMs: number, paymentResponse?: string): Promise<ExternalAgentResult> {
    const acc = new StreamAccumulator();
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let last = "";
    const started = Date.now() - latencyMs;
    try {
      while (!acc.done && !acc.failed) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary: number;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const event = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const data = event.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
          if (!data) continue;
          let parsed: unknown;
          try {
            parsed = JSON.parse(data);
          } catch {
            continue;
          }
          acc.push(parsed);
          if (acc.text !== last) {
            last = acc.text;
            input.onText?.(sanitizeReply(acc.text).text);
          }
        }
      }
    } catch {
      if (input.signal?.aborted) {
        await this.cancelTask(input, acc.taskId);
        return { ok: false, status: "cancelled", safeMessage: MESSAGES.cancelled, latencyMs: Date.now() - started };
      }
      return { ok: false, status: "timeout", safeMessage: MESSAGES.timeout, latencyMs: Date.now() - started };
    } finally {
      reader.releaseLock();
    }
    if (acc.failed || !acc.done || !acc.text) return { ok: false, status: "invalid", safeMessage: MESSAGES.unsupported, latencyMs: Date.now() - started };
    if (this.zroute && !acc.upstream?.agentId) return { ok: false, status: "invalid", safeMessage: MESSAGES.upstreamMissing, latencyMs: Date.now() - started };
    const clean = sanitizeReply(acc.text);
    return { ok: true, text: clean.text, flags: clean.flags, latencyMs: Date.now() - started, upstream: acc.upstream, contextId: acc.contextId, ...(paymentResponse ? { paymentResponse } : {}) };
  }

  /** Best effort: tell the agent to stop a task the person cancelled. */
  private async cancelTask(input: SendInput, taskId?: string): Promise<void> {
    if (!taskId) return;
    const valid = validateEndpoint(input.connection.endpointUrl);
    if (!valid.ok) return;
    const requestId = `${input.requestId}:cancel`;
    const opened = await this.open(valid.url.toString(), {
      method: "POST",
      headers: this.headers(input.connection, valid.url, "tasks/cancel", requestId),
      body: JSON.stringify({ jsonrpc: "2.0", id: requestId, method: "tasks/cancel", params: { id: taskId } }),
    });
    if (!("error" in opened)) opened.done();
  }
}

export function adapterFor(transport: ExternalTransport, deps: { fetch?: Fetch; secrets?: ExternalAgentSecretsLike } = {}): ExternalAgentAdapter {
  return new A2AAdapter(deps.fetch ?? fetch, transport === "zroute", deps.secrets);
}

/** Connections persist in DATA_DIR/external-agents.json, secrets excluded. */
export class ExternalAgentRegistry {
  private readonly file: string;
  private connections: ExternalAgentConnection[] = [];
  private readonly inflight = new Set<string>();

  constructor(dataDir: string) {
    this.file = join(dataDir, "external-agents.json");
    if (existsSync(this.file)) {
      try {
        // Written only by this class; the file is the registry's own state.
        const parsed: unknown = JSON.parse(readFileSync(this.file, "utf8"));
        if (Array.isArray(parsed)) this.connections = parsed as ExternalAgentConnection[];
      } catch {
        this.connections = [];
      }
    }
  }

  private save(): void {
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.connections, null, 2), { mode: 0o600 });
    renameSync(tmp, this.file);
  }

  list(): ExternalAgentConnection[] {
    return this.connections;
  }
  get(id: string): ExternalAgentConnection | undefined {
    return this.connections.find((c) => c.id === id);
  }

  create(input: unknown): { ok: true; connection: ExternalAgentConnection } | { ok: false; message: string } {
    const parsed = CreateInput.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid connection." };
    const body = parsed.data;
    const endpoint = validateEndpoint(body.endpointUrl);
    if (!endpoint.ok) return { ok: false, message: endpoint.message };
    if (body.transport === "zroute" && !body.upstreamAgentId) return { ok: false, message: "zroute connections need the upstream agent identifier." };
    const capabilities = allowedCapabilities(body.capabilities ?? ["chat"]);
    const connection: ExternalAgentConnection = {
      id: randomUUID(),
      displayName: body.displayName,
      provider: body.transport === "zroute" ? "zroute proxy" : body.provider ?? "External",
      transport: body.transport,
      protocol: "a2a",
      endpointUrl: endpoint.url.toString(),
      ...(body.transport === "zroute" && body.routeId ? { routeId: body.routeId } : {}),
      ...(body.upstreamAgentId ? { upstreamAgentId: body.upstreamAgentId } : {}),
      capabilities: capabilities.includes("chat") ? capabilities : ["chat", ...capabilities],
      status: "draft",
      provenance: body.transport === "zroute" ? "zroute-proxy" : "direct-endpoint",
      ...(body.credentialEnv ? { credentialEnv: body.credentialEnv } : {}),
      ...(body.paymentsTestnet ? { paymentsTestnet: true, network: "eip155:1952" } : {}),
      createdAt: new Date().toISOString(),
    };
    this.connections.push(connection);
    this.save();
    return { ok: true, connection };
  }

  applyCheck(id: string, check: ConnectionCheck): ExternalAgentConnection | undefined {
    const connection = this.get(id);
    if (!connection || connection.status === "revoked") return connection;
    connection.status = check.ok ? "ready" : check.status === "offline" || check.status === "timeout" ? "offline" : "error";
    connection.lastCheckedAt = new Date().toISOString();
    if (check.latencyMs !== undefined) connection.lastLatencyMs = check.latencyMs;
    if (check.ok) {
      connection.reportedName = check.agentName;
      connection.reportedUpstream = check.upstream;
      connection.streaming = check.streaming === true;
      // Advertised capabilities stay untrusted: only the intersection with
      // what the user declared and the server allows is kept.
      connection.capabilities = connection.capabilities.filter((cap) => cap === "chat" || check.capabilities.includes(cap));
    }
    this.save();
    return connection;
  }

  revoke(id: string): ExternalAgentConnection | undefined {
    const connection = this.get(id);
    if (!connection) return undefined;
    connection.status = "revoked";
    delete connection.credentialEnv;
    delete connection.paymentsTestnet;
    this.save();
    return connection;
  }

  /** One in-flight request per request ID: a double-clicked send or a retried
   * POST cannot produce two external calls or two activity entries. */
  claim(requestId: string): boolean {
    if (this.inflight.has(requestId)) return false;
    this.inflight.add(requestId);
    return true;
  }
  release(requestId: string): void {
    this.inflight.delete(requestId);
  }
}
