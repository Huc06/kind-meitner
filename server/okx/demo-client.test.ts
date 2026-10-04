import { describe, expect, it } from "vitest";
import { OKX_DEMO_IDENTITY } from "../../shared/okx-demo-identity.ts";
import { demoStatus, demoToolCall, runDemoCheck } from "./demo-client.ts";

type Call = { url: string; body: { method: string; params: Record<string, unknown> }; init: RequestInit };
function fakeFetch(answer: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const impl = (async (url: string | URL | Request, init: RequestInit = {}) => {
    const call = { url: String(url), body: JSON.parse(String(init.body)), init };
    calls.push(call);
    return answer(call);
  }) as typeof fetch;
  return { fetch: impl, calls };
}
const rpcResult = (result: unknown, headers: Record<string, string> = { "content-type": "application/json" }) =>
  new Response(JSON.stringify({ jsonrpc: "2.0", id: "x", result }), { status: 200, headers });
const toolText = (envelope: unknown) => rpcResult({ content: [{ type: "text", text: JSON.stringify(envelope) }] });
const envelope = { resource: { provenance: "live probes" }, data: { verdict: "FAIL", checks: [{ id: "https_scheme", status: "fail" }] } };

describe("demo tool calls", () => {
  it("maps checks to the live tool schemas and refuses anything else", () => {
    expect(demoToolCall({ kind: "endpoint", endpointUrl: " https://a.example/mcp " })).toEqual({ tool: "scan_free_mcp_readiness", arguments: { endpointUrl: "https://a.example/mcp" } });
    expect(demoToolCall({ kind: "agent", agentId: "13851" })).toEqual({ tool: "get_asp_trust_card", arguments: { agentId: "13851" } });
    expect(demoToolCall({ kind: "agent", agentId: "13851", endpointUrl: "https://a.example/mcp" })).toMatchObject({ arguments: { endpointUrl: "https://a.example/mcp" } });
    expect(demoToolCall({ kind: "endpoint", endpointUrl: "x".repeat(501) })).toHaveProperty("error");
    expect(demoToolCall({ kind: "agent", agentId: "" })).toHaveProperty("error");
    expect(demoToolCall({ kind: "trade", amount: 1 })).toHaveProperty("error");
  });

  it("only ever posts tools/call to the pinned endpoint with the validated arguments", async () => {
    const { fetch, calls } = fakeFetch(() => toolText(envelope));
    const result = await runDemoCheck({ kind: "endpoint", endpointUrl: "https://a.example/mcp", headers: { authorization: "x" } }, { fetch });
    expect(result).toMatchObject({ ok: true, source: "live", tool: "scan_free_mcp_readiness", envelope });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(OKX_DEMO_IDENTITY.endpointUrl);
    expect(calls[0]!.body).toMatchObject({ method: "tools/call", params: { name: "scan_free_mcp_readiness", arguments: { endpointUrl: "https://a.example/mcp" } } });
    expect(calls[0]!.init.redirect).toBe("manual");
    expect(JSON.stringify(calls[0]!.init.headers)).not.toMatch(/authorization/i);
  });

  it("reads the JSON-RPC answer from an SSE response", async () => {
    const sse = `event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: "x", result: { content: [{ type: "text", text: JSON.stringify(envelope) }] } })}\n\n`;
    const { fetch } = fakeFetch(() => new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } }));
    expect(await runDemoCheck({ kind: "agent", agentId: "13851" }, { fetch })).toMatchObject({ ok: true, envelope });
  });
});

describe("demo failures never become results", () => {
  const failing: Array<[string, () => Response | Promise<Response>, string]> = [
    ["tool error", () => rpcResult({ isError: true, content: [{ type: "text", text: "endpointUrl is required" }] }), "tool_error"],
    ["JSON-RPC error", () => new Response(JSON.stringify({ jsonrpc: "2.0", id: "x", error: { code: -32601, message: "nope" } })), "tool_error"],
    ["rate limit", () => new Response("", { status: 429 }), "rate_limited"],
    ["redirect", () => new Response("", { status: 302, headers: { location: "http://10.0.0.1/" } }), "bad_response"],
    ["server error", () => new Response("", { status: 503 }), "unreachable"],
    ["non-JSON", () => new Response("<html>", { status: 200 }), "bad_response"],
    ["unstructured tool text", () => rpcResult({ content: [{ type: "text", text: "PASS" }] }), "bad_response"],
    ["oversized body", () => new Response("x".repeat(300 * 1024), { status: 200 }), "bad_response"],
    ["network failure", () => Promise.reject(new TypeError("fetch failed")), "unreachable"],
  ];
  it.each(failing)("%s", async (_name, answer, status) => {
    const { fetch } = fakeFetch(answer);
    const result = await runDemoCheck({ kind: "endpoint", endpointUrl: "https://a.example/mcp" }, { fetch });
    expect(result).toMatchObject({ ok: false, source: "live", status });
    expect(result).not.toHaveProperty("envelope");
  });

  it("reports a timeout without a result", async () => {
    // Server tsconfig lib predates ES2024, so Promise.withResolvers is not typed here.
    const { fetch } = fakeFetch(({ init }) => new Promise<Response>((_, reject) => {
      init.signal!.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    const result = await runDemoCheck({ kind: "agent", agentId: "13851" }, { fetch, timeoutMs: 20 });
    expect(result).toMatchObject({ ok: false, status: "timeout" });
    expect(result.ok ? "" : result.safeMessage).toMatch(/no fallback/);
  });

  it("refuses invalid input without calling the service", async () => {
    const { fetch, calls } = fakeFetch(() => toolText(envelope));
    expect(await runDemoCheck({ kind: "endpoint", endpointUrl: "" }, { fetch })).toMatchObject({ ok: false, status: "invalid_input" });
    expect(calls).toHaveLength(0);
  });
});

describe("demo status", () => {
  it("is ready only when the live tools/list includes both demo tools", async () => {
    const tools = (names: string[]) => fakeFetch(({ body }) => body.method === "initialize"
      ? rpcResult({ protocolVersion: "2024-11-05", serverInfo: { name: "kind-meitner-free-okx-ai" } })
      : rpcResult({ tools: names.map((name) => ({ name })) }));
    expect(await demoStatus({ fetch: tools(["scan_free_mcp_readiness", "get_asp_trust_card"]).fetch }))
      .toMatchObject({ ok: true, protocolVersion: "2024-11-05", demoToolsAvailable: true, safeMessage: "Connected · 2 tools" });
    expect(await demoStatus({ fetch: tools(["scan_free_mcp_readiness"]).fetch })).toMatchObject({ ok: false, demoToolsAvailable: false });
  });
});
