import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { launchVerificationServer, type VerificationServer } from "../../scripts/control-kind-meitner.ts";
import { scanFreeMcpReadiness, getAspTrustCard } from "./intelligence.ts";

const rpc = (id: string, method: string, params?: Record<string, unknown>) => ({
  jsonrpc: "2.0",
  id,
  method,
  ...(params ? { params } : {}),
});

type JsonResponse = Omit<Response, "json"> & { json(): Promise<any> };

describe("Free A2MCP resources (/api/okx/free-mcp)", () => {
  let fixture: VerificationServer;
  let baseUrl: string;

  beforeAll(async () => {
    fixture = await launchVerificationServer();
    baseUrl = fixture.info.url;
  }, 30_000);

  afterAll(async () => {
    await fixture?.close();
  });

  async function call(
    body: unknown,
    headers: Record<string, string> = {},
  ): Promise<JsonResponse> {
    return (await fetch(`${baseUrl}/api/okx/free-mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })) as JsonResponse;
  }

  it("discovers only explicitly free, read-only resources", async () => {
    const res = await call(rpc("list-1", "tools/list"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-connect-id")).toBeTruthy();
    const body = await res.json();
    expect(body.id).toBe("list-1");
    expect(body.result.tools.map((tool: { name: string }) => tool.name)).toEqual(expect.arrayContaining([
      "list_okx_ai_use_cases",
      "get_free_a2mcp_launch_checklist",
      "query_market_benchmarks",
    ]));
    for (const tool of body.result.tools) {
      expect(tool.description).toContain("Free resource");
      expect(tool.annotations).toEqual({ readOnlyHint: true, destructiveHint: false, openWorldHint: false });
      expect(tool.inputSchema).toBeTruthy();
    }
  });

  it("returns high-impact OKX.AI use cases with no payment headers", async () => {
    const res = await call(rpc("use-cases-1", "tools/call", {
      name: "list_okx_ai_use_cases",
      arguments: {},
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBeUndefined();
    const payload = JSON.parse(body.result.content[0].text);
    expect(payload.resource).toMatchObject({
      access: "free",
      paymentRequired: false,
      walletRequired: false,
      mainnet: false,
    });
    expect(payload.data.useCases).toHaveLength(4);
  });

  it("ignores payment-looking headers and never returns a payment requirement", async () => {
    const res = await call(
      rpc("checklist-1", "tools/call", {
        name: "get_free_a2mcp_launch_checklist",
        arguments: {},
      }),
      {
        "x-payment-from": "0x1111222233334444555566667777888899990000",
        "x-payment-signature": "not-consumed-by-free-resources",
        "x-payment-nonce": "not-consumed-by-free-resources",
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requiredFee).toBeUndefined();
    expect(body.token).toBeUndefined();
    const payload = JSON.parse(body.result.content[0].text);
    expect(payload.resource.paymentRequired).toBe(false);
    expect(payload.data.checklist).toContain("Do not request wallet credentials, API keys, payment headers, or mainnet access for the free service.");
  });

  it("validates malformed calls without falling through to a payment path", async () => {
    const malformed = await call("{ not-json");
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error.code).toBe(-32700);

    const invalidCall = await call(rpc("invalid-1", "tools/call", {
      name: "get_trending_asps",
      arguments: { limit: 0 },
    }));
    expect(invalidCall.status).toBe(200);
    const invalidBody = await invalidCall.json();
    expect(invalidBody.result.isError).toBe(true);
    expect(invalidBody.result.content[0].text).toContain("limit must be an integer");
  });

  it("lists readiness scanning and rejects a missing endpoint URL", async () => {
    const listed = await call(rpc("readiness-list", "tools/list"));
    const tools = (await listed.json()).result.tools as Array<{ name: string; description: string; annotations: unknown }>;
    expect(tools).toContainEqual(expect.objectContaining({
      name: "scan_free_mcp_readiness",
      description: expect.stringContaining("Free resource:"),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    }));
    const invalid = await call(rpc("readiness-missing", "tools/call", { name: "scan_free_mcp_readiness", arguments: {} }));
    const invalidBody = await invalid.json();
    expect(invalidBody.result.isError).toBe(true);
    expect(invalidBody.result.content[0].text).toBe("endpointUrl is required");
  });

  it("completes the MCP Streamable HTTP session handshake", async () => {
    const init = await call(rpc("init-1", "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "fixture", version: "1.0.0" },
    }));
    expect(init.status).toBe(200);
    const sessionId = init.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();
    const initBody = await init.json();
    expect(initBody.result.serverInfo.name).toBe("kind-meitner-free-okx-ai");
    expect(initBody.result.protocolVersion).toBe("2024-11-05");

    const notified = await call(
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { "mcp-session-id": sessionId! },
    );
    expect(notified.status).toBe(202);

    const listed = await call(rpc("list-session", "tools/list"), { "mcp-session-id": sessionId! });
    expect(listed.status).toBe(200);
    expect((await listed.json()).result.tools.length).toBeGreaterThan(0);
  });

  it("terminates an MCP session on DELETE", async () => {
    const init = await call(rpc("init-del", "initialize", {}));
    const sessionId = init.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();

    const del = await fetch(`${baseUrl}/api/okx/free-mcp`, {
      method: "DELETE",
      headers: { "mcp-session-id": sessionId! },
    });
    expect(del.status).toBe(200);
  });
});

  it("fails known Vercel hosts without making an outbound probe", async () => {
    const scanned = await scanFreeMcpReadiness("https://demo.vercel.app/api/okx/free-mcp", null, {
      fetch: async () => { throw new Error("must not probe a known pitfall"); },
      resolveHostname: async () => ["203.0.113.10"],
    });
    expect(scanned.data.verdict).toBe("FAIL");
    expect(scanned.data.checks).toContainEqual(expect.objectContaining({ id: "host_pitfall_vercel", status: "fail" }));
    expect(scanned.data.remediation.join(" ")).toContain("OKX listing test env rejects vercel.app");
  });

  it("fails accidental 402 discovery responses", async () => {
    const scanned = await scanFreeMcpReadiness("https://scanner.example/api/okx/free-mcp", null, {
      fetch: async () => new Response(JSON.stringify({ error: "payment required" }), { status: 402 }),
      resolveHostname: async () => ["203.0.113.10"],
    });
    expect(scanned.data.verdict).toBe("FAIL");
    expect(scanned.data.checks).toContainEqual(expect.objectContaining({ id: "no_accidental_402", status: "fail" }));
    expect(scanned.data.remediation.join(" ")).toContain("Do not gate tools/list behind x402");
  });


it("returns an honest GO trust card with always-visible limits", async () => {
  const card = await getAspTrustCard("13837", "https://scanner.example/free-mcp", {
    fetch: async (input) => String(input).includes("okx.ai/agents/")
      ? new Response("<title>Kind Meitner</title>", { status: 200 })
      : new Response(JSON.stringify({ result: { tools: [{ name: "read_only" }] } }), { status: 200 }),
    resolveHostname: async () => ["203.0.113.10"],
  });
  expect(card.data.decision).toBe("GO");
  expect(card.data.notChecked.length).toBeGreaterThanOrEqual(3);
  expect(card.data.safeNextStep).toContain("free read-only tools");
});

it("blocks a hostname that resolves to loopback before fetching", async () => {
  const scanned = await scanFreeMcpReadiness("https://public-looking.example/free-mcp", null, {
    fetch: async () => { throw new Error("must not fetch a private DNS result"); },
    resolveHostname: async () => ["127.0.0.1"],
  });
  expect(scanned.data.verdict).toBe("FAIL");
  expect(scanned.data.checks).toContainEqual(expect.objectContaining({ id: "tools_list_http", status: "fail", detail: expect.stringContaining("resolves") }));
});

it("returns CAUTION when listing evidence is unavailable but endpoint readiness passes", async () => {
  const card = await getAspTrustCard("13837", "https://scanner.example/free-mcp", {
    fetch: async (input) => String(input).includes("okx.ai/agents/")
      ? new Response("temporarily unavailable", { status: 503 })
      : new Response(JSON.stringify({ result: { tools: [{ name: "read_only" }] } }), { status: 200 }),
    resolveHostname: async () => ["203.0.113.10"],
  });
  expect(card.data.decision).toBe("CAUTION");
  expect(card.data.safeNextStep).toContain("Free tools only");
  expect(card.data.notChecked).toContain("OKX official endorsement");
});

it("returns NO_GO when the endpoint readiness probe fails", async () => {
  const card = await getAspTrustCard("13837", "https://scanner.example/free-mcp", {
    fetch: async (input) => String(input).includes("okx.ai/agents/")
      ? new Response("<title>Kind Meitner</title>", { status: 200 })
      : new Response(JSON.stringify({ error: "payment required" }), { status: 402 }),
    resolveHostname: async () => ["203.0.113.10"],
  });
  expect(card.data.decision).toBe("NO_GO");
  expect(card.data.safeNextStep).toContain("Do not call pay/x402 tools");
  expect(card.data.notChecked.length).toBeGreaterThanOrEqual(3);
});
