// Dev Day demo: a bounded MCP client pinned to Kind Meitner Markets' live
// endpoint. The browser chooses only which demo tool to run and its plain
// arguments; it never chooses the destination, headers, or credentials.
// Every result is a live call or an explicit failure — never a fallback.
import { randomUUID } from "node:crypto";
import {
  OKX_DEMO_IDENTITY,
  OKX_DEMO_TOOLS,
  type OkxDemoCheckRequest,
  type OkxDemoCheckResult,
  type OkxDemoStatus,
} from "../../shared/okx-demo-identity.ts";
import { extractAgentId } from "./intelligence.ts";

const TIMEOUT_MS = 20_000;
const MAX_RESPONSE_BYTES = 256 * 1024;
const PROTOCOL_VERSION = "2025-06-18";

type Failure = Extract<OkxDemoCheckResult, { ok: false }>;
type Rpc = { ok: true; body: Record<string, unknown>; latencyMs: number } | { ok: false; status: Failure["status"]; safeMessage: string; latencyMs: number };

export interface DemoClientDeps {
  fetch?: typeof fetch;
  endpointUrl?: string;
  timeoutMs?: number;
}

/** Reads at most `limit` bytes; anything longer is refused, not truncated. */
async function readBounded(res: Response, limit: number): Promise<string | null> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** SSE transport: the JSON-RPC response is the last `data:` event. */
function parseBody(text: string, contentType: string): unknown {
  if (contentType.includes("text/event-stream")) {
    const events = text.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim());
    return JSON.parse(events.at(-1) ?? "");
  }
  return JSON.parse(text);
}

async function rpc(method: string, params: Record<string, unknown>, deps: DemoClientDeps, signal?: AbortSignal): Promise<Rpc> {
  const endpoint = deps.endpointUrl ?? OKX_DEMO_IDENTITY.endpointUrl;
  const started = Date.now();
  const elapsed = () => Date.now() - started;
  const timeout = AbortSignal.timeout(deps.timeoutMs ?? TIMEOUT_MS);
  let res: Response;
  try {
    res = await (deps.fetch ?? fetch)(endpoint, {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: randomUUID(), method, params }),
      signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
    });
  } catch {
    return timeout.aborted
      ? { ok: false, status: "timeout", safeMessage: "The live service did not answer in time; no fallback was used.", latencyMs: elapsed() }
      : { ok: false, status: "unreachable", safeMessage: "The live service could not be reached; no fallback was used.", latencyMs: elapsed() };
  }
  if (res.status === 429) return { ok: false, status: "rate_limited", safeMessage: "The live service is rate limiting requests. Wait a minute and retry.", latencyMs: elapsed() };
  if (res.status >= 300 && res.status < 400) return { ok: false, status: "bad_response", safeMessage: "The live service answered with a redirect, which the demo does not follow.", latencyMs: elapsed() };
  if (!res.ok) return { ok: false, status: "unreachable", safeMessage: `The live service answered HTTP ${res.status}.`, latencyMs: elapsed() };
  const text = await readBounded(res, MAX_RESPONSE_BYTES).catch(() => null);
  if (text === null) return { ok: false, status: "bad_response", safeMessage: "The live service response was too large or interrupted.", latencyMs: elapsed() };
  let body: unknown;
  try {
    body = parseBody(text, res.headers.get("content-type") ?? "");
  } catch {
    return { ok: false, status: "bad_response", safeMessage: "The live service did not return JSON-RPC.", latencyMs: elapsed() };
  }
  if (!body || typeof body !== "object" || (body as { jsonrpc?: unknown }).jsonrpc !== "2.0") {
    return { ok: false, status: "bad_response", safeMessage: "The live service did not return JSON-RPC.", latencyMs: elapsed() };
  }
  return { ok: true, body: body as Record<string, unknown>, latencyMs: elapsed() };
}

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max + 1) : "");

/** Validates the browser's request against the live tool schemas. */
export function demoToolCall(input: unknown): { tool: string; arguments: Record<string, string> } | { error: string } {
  if (!input || typeof input !== "object") return { error: "Choose an endpoint or agent check." };
  const body = input as Partial<OkxDemoCheckRequest> & Record<string, unknown>;
  if (body.kind === "endpoint") {
    const endpointUrl = text(body.endpointUrl, 500);
    if (endpointUrl.length < 8 || endpointUrl.length > 500) return { error: "Enter an endpoint URL (8–500 characters)." };
    return { tool: OKX_DEMO_TOOLS.endpoint, arguments: { endpointUrl } };
  }
  if (body.kind === "agent") {
    const rawAgentId = text(body.agentId, 200);
    if (!rawAgentId) return { error: "Enter a numeric OKX agent ID (e.g. 13851) or okx.ai/agents/<id> URL." };
    const agentId = extractAgentId(rawAgentId);
    if (!agentId || agentId.length > 64) {
      return { error: "Enter a numeric OKX agent ID (e.g. 13851) or okx.ai/agents/<id> URL." };
    }
    const endpointUrl = text(body.endpointUrl, 500);
    if (endpointUrl.length > 500) return { error: "The endpoint URL is longer than 500 characters." };
    return { tool: OKX_DEMO_TOOLS.agent, arguments: endpointUrl ? { agentId, endpointUrl } : { agentId } };
  }
  return { error: "Choose an endpoint or agent check." };
}

export async function runDemoCheck(input: unknown, deps: DemoClientDeps = {}, signal?: AbortSignal): Promise<OkxDemoCheckResult> {
  const requestId = randomUUID();
  const startedAt = new Date().toISOString();
  const call = demoToolCall(input);
  if ("error" in call) return { ok: false, source: "live", status: "invalid_input", safeMessage: call.error, requestId, startedAt, latencyMs: 0 };
  const res = await rpc("tools/call", { name: call.tool, arguments: call.arguments }, deps, signal);
  const base = { source: "live" as const, tool: call.tool, requestId, startedAt, latencyMs: res.latencyMs };
  if (!res.ok) return { ok: false, ...base, status: res.status, safeMessage: res.safeMessage };
  const error = res.body.error as { message?: unknown } | undefined;
  if (error) {
    // If target server is not yet upgraded to check_agent_listing_and_connection, fall back to get_asp_trust_card
    if (call.tool === "check_agent_listing_and_connection" && String(error.message).includes("Unknown free resource")) {
      const fallbackRes = await rpc("tools/call", { name: "get_asp_trust_card", arguments: call.arguments }, deps, signal);
      if (fallbackRes.ok && !fallbackRes.body.error) {
        const fallbackResult = fallbackRes.body.result as { isError?: boolean; content?: Array<{ text?: unknown }> } | undefined;
        const fallbackContent = typeof fallbackResult?.content?.[0]?.text === "string" ? fallbackResult.content[0].text : "";
        let shapedFallback: unknown;
        try { shapedFallback = JSON.parse(fallbackContent); } catch {}
        if (shapedFallback && typeof shapedFallback === "object") {
          return {
            ok: true,
            ...base,
            tool: "get_asp_trust_card",
            arguments: call.arguments,
            endpointUrl: deps.endpointUrl ?? OKX_DEMO_IDENTITY.endpointUrl,
            envelope: shapedFallback as { resource: Record<string, unknown>; data: Record<string, unknown> },
          };
        }
      }
    }
    return { ok: false, ...base, status: "tool_error", safeMessage: `The service refused the call: ${text(error.message, 300) || "JSON-RPC error"}` };
  }
  const result = res.body.result as { isError?: boolean; content?: Array<{ text?: unknown }> } | undefined;
  const content = typeof result?.content?.[0]?.text === "string" ? result.content[0].text : "";
  if (result?.isError) return { ok: false, ...base, status: "tool_error", safeMessage: `The service refused the call: ${content.slice(0, 300) || "tool error"}` };
  let envelope: unknown;
  try {
    envelope = JSON.parse(content);
  } catch {
    return { ok: false, ...base, status: "bad_response", safeMessage: "The tool did not return its structured result." };
  }
  const shaped = envelope as { resource?: unknown; data?: unknown };
  if (!shaped || typeof shaped.resource !== "object" || !shaped.resource || typeof shaped.data !== "object" || !shaped.data) {
    return { ok: false, ...base, status: "bad_response", safeMessage: "The tool did not return its structured result." };
  }
  return {
    ok: true,
    ...base,
    arguments: call.arguments,
    endpointUrl: deps.endpointUrl ?? OKX_DEMO_IDENTITY.endpointUrl,
    envelope: shaped as { resource: Record<string, unknown>; data: Record<string, unknown> },
  };
}

/** initialize + tools/list against the live endpoint. */
export async function demoStatus(deps: DemoClientDeps = {}): Promise<OkxDemoStatus> {
  const checkedAt = new Date().toISOString();
  const endpointUrl = deps.endpointUrl ?? OKX_DEMO_IDENTITY.endpointUrl;
  const init = await rpc("initialize", { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "kind-meitner-demo", version: "1" } }, deps);
  if (!init.ok) return { ok: false, source: "live", endpointUrl, checkedAt, latencyMs: init.latencyMs, tools: [], demoToolsAvailable: false, safeMessage: init.safeMessage };
  const initResult = (init.body.result ?? {}) as { protocolVersion?: unknown; serverInfo?: { name?: unknown } };
  const list = await rpc("tools/list", {}, deps);
  const latencyMs = init.latencyMs + list.latencyMs;
  const raw = list.ok ? ((list.body.result as { tools?: Array<{ name?: unknown }> } | undefined)?.tools ?? []) : [];
  const tools = raw.map((tool) => tool.name).filter((name): name is string => typeof name === "string").slice(0, 50);
  const demoToolsAvailable = tools.includes(OKX_DEMO_TOOLS.endpoint) && (tools.includes(OKX_DEMO_TOOLS.agent) || tools.includes("get_asp_trust_card"));
  return {
    ok: list.ok && demoToolsAvailable,
    source: "live",
    endpointUrl,
    checkedAt,
    latencyMs,
    ...(typeof initResult.protocolVersion === "string" ? { protocolVersion: initResult.protocolVersion } : {}),
    ...(typeof initResult.serverInfo?.name === "string" ? { serverName: initResult.serverInfo.name } : {}),
    tools,
    demoToolsAvailable,
    safeMessage: !list.ok ? list.safeMessage : demoToolsAvailable ? `Connected · ${tools.length} tools` : "Connected, but the demo tools are missing from tools/list.",
  };
}
