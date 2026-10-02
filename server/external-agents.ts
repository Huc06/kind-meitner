// External agents: remote A2A agents a room can talk to, reached either
// directly or through a zroute proxy. They are room participants, not models:
// nothing here touches bot records, engine selection, wallets or payments.
//
// Protocol: A2A JSON-RPC 2.0. Identity comes from the agent card at
// /.well-known/agent.json; chat uses `message/send`. A zroute connection is
// the same wire protocol through a proxy, plus a route ID sent as message
// metadata and a REQUIRED upstream identity (card `metadata.upstream`).
//
// Credentials (development only): a connection may name an environment
// variable (`credentialEnv`, KIND_MEITNER_EXT_*) whose value the server sends
// as a bearer token. The value is read at call time, never stored, returned,
// logged or written into messages.
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const Text = z.string().trim().min(1);

export type ExternalTransport = "direct" | "zroute";
export type ExternalAgentStatus = "draft" | "checking" | "ready" | "offline" | "revoked" | "error";

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
  reportedUpstream?: { agentId?: string; name?: string; provider?: string };
  capabilities: string[];
  network?: string;
  status: ExternalAgentStatus;
  provenance: "direct-endpoint" | "zroute-proxy" | "local-catalog";
  /** Name of the server-side environment variable holding the credential. */
  credentialEnv?: string;
  lastCheckedAt?: string;
  lastLatencyMs?: number;
  createdAt: string;
};

/** What the browser may see: no credential variable, no query string. */
export type PublicExternalAgent = Omit<ExternalAgentConnection, "credentialEnv" | "endpointUrl"> & {
  endpointHost: string;
  endpointPath: string;
  credentialsConfigured: boolean;
  readOnly: true;
};

export type ConnectionCheck = {
  ok: boolean;
  status: "ready" | "offline" | "invalid" | "unauthorized" | "timeout" | "error";
  provider: string;
  agentId?: string;
  agentName?: string;
  upstream?: { agentId?: string; name?: string; provider?: string };
  capabilities: string[];
  latencyMs?: number;
  provenance: string;
  safeMessage: string;
};

export type ExternalAgentResult =
  | { ok: true; text: string; latencyMs: number; upstream?: { agentId?: string; name?: string; provider?: string }; contextId?: string }
  | { ok: false; status: "timeout" | "unauthorized" | "offline" | "invalid" | "error"; safeMessage: string; latencyMs: number };

export interface ExternalAgentAdapter {
  checkConnection(connection: ExternalAgentConnection): Promise<ConnectionCheck>;
  sendMessage(input: {
    connection: ExternalAgentConnection;
    roomId: string;
    requestId: string;
    message: string;
    conversationId?: string;
  }): Promise<ExternalAgentResult>;
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
} as const;

/** Read-only milestone: text chat and read-only research only. Anything that
 * moves value or signs is refused even if the agent advertises it. */
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
 * development flag is on. No credentials or fragments in the URL. */
export function validateEndpoint(raw: string): { ok: true; url: URL } | { ok: false; message: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, message: "Endpoint is not a valid URL." };
  }
  if (url.username || url.password) return { ok: false, message: "Endpoint must not contain credentials." };
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
});

function credentialFor(connection: ExternalAgentConnection): string | undefined {
  if (!connection.credentialEnv || !validCredentialEnv(connection.credentialEnv)) return undefined;
  const value = process.env[connection.credentialEnv];
  return value && value.trim() ? value.trim() : undefined;
}

export function toPublic(connection: ExternalAgentConnection): PublicExternalAgent {
  const { credentialEnv, endpointUrl, ...rest } = connection;
  const url = new URL(endpointUrl);
  return {
    ...rest,
    endpointHost: url.host,
    endpointPath: url.pathname,
    credentialsConfigured: Boolean(credentialEnv && credentialFor(connection)),
    readOnly: true,
  };
}

/** Removes anything that looks like a credential before text is stored. */
export function redact(text: string): string {
  return text
    .replace(/(authorization|api[_-]?key|token|secret)(["'\s:=]+)(bearer\s+)?[^\s"',}]+/gi, "$1$2$3[redacted]")
    .replace(/\bbearer\s+(?!\[redacted\])[^\s"',}]+/gi, "Bearer [redacted]")
    .replace(/\b(sk|pk|xox[a-z])-[A-Za-z0-9_-]{10,}\b/g, "[redacted]");
}

type Fetch = typeof fetch;
const DEFAULT_TIMEOUT_MS = 30_000;
function timeoutMs(): number {
  const fromEnv = Number(process.env.KIND_MEITNER_EXTERNAL_AGENT_TIMEOUT_MS);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_TIMEOUT_MS;
}

const Upstream = z.object({ agentId: Text.max(120).optional(), name: Text.max(120).optional(), provider: Text.max(120).optional() });
type UpstreamIdentity = z.infer<typeof Upstream>;
const Part = z.object({ kind: z.string().optional(), type: z.string().optional(), text: z.string().optional() });
const Parts = z.array(Part).default([]);
const Metadata = z.object({ agentId: Text.max(120).optional(), upstream: Upstream.optional() }).partial().default({});

/** A2A agent card: only the fields identity and capabilities need. */
const AgentCard = z.object({
  name: Text.max(120),
  provider: z.object({ organization: Text.max(120).optional() }).optional(),
  skills: z.array(z.object({ id: z.string().optional(), tags: z.array(z.string()).optional() })).default([]),
  metadata: Metadata,
});

const SendResult = z.object({
  jsonrpc: z.literal("2.0"),
  result: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("message"), parts: Parts, contextId: z.string().optional(), metadata: Metadata }),
    z.object({
      kind: z.literal("task"),
      contextId: z.string().optional(),
      status: z.object({ state: z.string(), message: z.object({ parts: Parts }).optional() }),
      artifacts: z.array(z.object({ parts: Parts })).default([]),
      metadata: Metadata,
    }),
  ]),
});

type CardIdentity = { name: string; agentId: string; provider?: string; capabilities: string[]; upstream?: UpstreamIdentity };

function parseCard(body: unknown): CardIdentity | null {
  const card = AgentCard.safeParse(body);
  if (!card.success) return null;
  const { name, provider, skills, metadata } = card.data;
  const skillCaps = skills.flatMap((skill) => [skill.id ?? "", ...(skill.tags ?? [])]);
  return {
    name,
    agentId: metadata.agentId ?? name,
    provider: provider?.organization,
    capabilities: allowedCapabilities(["chat", ...skillCaps]),
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

async function timedFetch(fetchImpl: Fetch, url: string, init: RequestInit): Promise<{ res: Response; latencyMs: number } | { timeout: true; latencyMs: number } | { failed: true; latencyMs: number }> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const res = await fetchImpl(url, { ...init, signal: controller.signal, redirect: "error" });
    return { res, latencyMs: Date.now() - started };
  } catch (error) {
    const latencyMs = Date.now() - started;
    return error instanceof Error && error.name === "AbortError" ? { timeout: true, latencyMs } : { failed: true, latencyMs };
  } finally {
    clearTimeout(timer);
  }
}

function headersFor(connection: ExternalAgentConnection): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
  const credential = credentialFor(connection);
  if (credential) headers.authorization = `Bearer ${credential}`;
  return headers;
}

class A2AAdapter implements ExternalAgentAdapter {
  private readonly fetchImpl: Fetch;
  private readonly zroute: boolean;
  constructor(fetchImpl: Fetch, zroute: boolean) {
    this.fetchImpl = fetchImpl;
    this.zroute = zroute;
  }

  async checkConnection(connection: ExternalAgentConnection): Promise<ConnectionCheck> {
    const provenance = this.zroute ? "zroute-proxy" : "direct-endpoint";
    const base = { provider: connection.provider, capabilities: [] as string[], provenance };
    const valid = validateEndpoint(connection.endpointUrl);
    if (!valid.ok) return { ...base, ok: false, status: "invalid", safeMessage: valid.message };
    if (connection.credentialEnv && !credentialFor(connection)) {
      return { ...base, ok: false, status: "unauthorized", safeMessage: MESSAGES.noAuth };
    }
    const card = new URL(valid.url);
    card.pathname = `${card.pathname.replace(/\/$/, "")}/.well-known/agent.json`;
    card.search = "";
    const response = await timedFetch(this.fetchImpl, card.toString(), { method: "GET", headers: headersFor(connection) });
    if ("timeout" in response) return { ...base, ok: false, status: "timeout", latencyMs: response.latencyMs, safeMessage: "The agent did not answer before the timeout." };
    if ("failed" in response) return { ...base, ok: false, status: "offline", latencyMs: response.latencyMs, safeMessage: MESSAGES.unreachable };
    const { res, latencyMs } = response;
    if (res.status === 401 || res.status === 403) return { ...base, ok: false, status: "unauthorized", latencyMs, safeMessage: connection.credentialEnv ? "The agent rejected the server credential." : MESSAGES.noAuth };
    if (!res.ok) return { ...base, ok: false, status: "offline", latencyMs, safeMessage: MESSAGES.unreachable };
    const identity = parseCard(await res.json().catch(() => null));
    if (!identity) return { ...base, ok: false, status: "invalid", latencyMs, safeMessage: MESSAGES.unsupported };
    if (connection.upstreamAgentId && !this.zroute && identity.agentId && identity.agentId !== connection.upstreamAgentId) {
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
      latencyMs,
      provenance,
      safeMessage: this.zroute ? `Connected through zroute to ${identity.upstream?.name ?? identity.upstream?.agentId}.` : `Connected to ${identity.name}.`,
    };
  }

  async sendMessage(input: { connection: ExternalAgentConnection; roomId: string; requestId: string; message: string; conversationId?: string }): Promise<ExternalAgentResult> {
    const { connection } = input;
    const valid = validateEndpoint(connection.endpointUrl);
    if (!valid.ok) return { ok: false, status: "invalid", safeMessage: valid.message, latencyMs: 0 };
    if (connection.credentialEnv && !credentialFor(connection)) return { ok: false, status: "unauthorized", safeMessage: MESSAGES.noAuth, latencyMs: 0 };
    const body = {
      jsonrpc: "2.0",
      id: input.requestId,
      method: "message/send",
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
    const response = await timedFetch(this.fetchImpl, valid.url.toString(), { method: "POST", headers: headersFor(connection), body: JSON.stringify(body) });
    if ("timeout" in response) return { ok: false, status: "timeout", safeMessage: MESSAGES.timeout, latencyMs: response.latencyMs };
    if ("failed" in response) return { ok: false, status: "offline", safeMessage: MESSAGES.unreachable, latencyMs: response.latencyMs };
    const { res, latencyMs } = response;
    if (res.status === 401 || res.status === 403) return { ok: false, status: "unauthorized", safeMessage: MESSAGES.noAuth, latencyMs };
    if (!res.ok) return { ok: false, status: "offline", safeMessage: MESSAGES.unreachable, latencyMs };
    const parsed = parseSendResult(await res.json().catch(() => null));
    if (!parsed) return { ok: false, status: "invalid", safeMessage: MESSAGES.unsupported, latencyMs };
    if (this.zroute && !parsed.upstream?.agentId) return { ok: false, status: "invalid", safeMessage: MESSAGES.upstreamMissing, latencyMs };
    return { ok: true, text: redact(parsed.text).slice(0, 20_000), latencyMs, upstream: parsed.upstream, contextId: parsed.contextId };
  }
}

export function adapterFor(transport: ExternalTransport, fetchImpl: Fetch = fetch): ExternalAgentAdapter {
  return new A2AAdapter(fetchImpl, transport === "zroute");
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
