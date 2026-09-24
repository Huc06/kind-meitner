import { describe, expect, it, vi } from "vitest";
import { parseAgentIdOrUrl, resolveOkxAgent, executeOkxAgentTool, isLocalFreeMcpEndpoint } from "./agent-mcp-resolver.ts";
import { OkxMarketplaceIntelligence } from "./intelligence.ts";

describe("OKX Agent MCP Resolver", () => {
  it("parses agent IDs and URLs correctly", () => {
    expect(parseAgentIdOrUrl("13837")).toEqual({ agentId: "13837" });
    expect(parseAgentIdOrUrl("#13837")).toEqual({ agentId: "13837" });
    expect(parseAgentIdOrUrl("https://www.okx.ai/agents/13837")).toEqual({ agentId: "13837" });
    expect(parseAgentIdOrUrl("https://www.okx.ai/agents/okx-market-scout-v1?ref=test")).toEqual({ agentId: "okx-market-scout-v1" });
    expect(parseAgentIdOrUrl("https://my-agent.example.com/api/mcp")).toEqual({
      agentId: "my-agent.example.com",
      explicitEndpointUrl: "https://my-agent.example.com/api/mcp",
    });
  });

  it("does not treat non-OKX /agents/ paths as catalog IDs", () => {
    expect(parseAgentIdOrUrl("https://evil.example/agents/13837")).toEqual({
      agentId: "evil.example",
      explicitEndpointUrl: "https://evil.example/agents/13837",
    });
  });

  it("resolves catalog agents with in-process OkxMarketplaceIntelligence", async () => {
    const server = new OkxMarketplaceIntelligence();
    const resolved = await resolveOkxAgent("okx-market-scout-v1", { localIntelligence: server });
    expect(resolved.agentId).toBe("okx-market-scout-v1");
    expect(resolved.name).toBe("Markets");
    expect(resolved.provider).toBe("OKX.ai");
    expect(resolved.status).toBe("available");
    expect(resolved.tools.some((tool) => tool.name === "scan_free_mcp_readiness")).toBe(true);
    expect(resolved.tools.some((tool) => tool.name === "get_asp_trust_card")).toBe(true);
  });

  it("aliases ASP #13837 to the local Markets catalog", async () => {
    const server = new OkxMarketplaceIntelligence();
    const resolved = await resolveOkxAgent("13837", { localIntelligence: server });
    expect(resolved.status).toBe("available");
    expect(resolved.name).toBe("Markets");
    expect(resolved.tools.some((tool) => tool.name === "scan_free_mcp_readiness")).toBe(true);
  });

  it("marks unknown agents without an MCP URL as offline", async () => {
    const server = new OkxMarketplaceIntelligence();
    const resolved = await resolveOkxAgent("99999", { localIntelligence: server });
    expect(resolved.status).toBe("offline");
    expect(resolved.tools).toEqual([]);
  });

  it("resolves remote agents via mocked tools/list fetch", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          tools: [
            {
              name: "analyze_token_sentiment",
              description: "Analyzes sentiment on X Layer",
              inputSchema: { type: "object", properties: { symbol: { type: "string" } } },
            },
          ],
        },
      }),
    });

    const resolved = await resolveOkxAgent("https://agent-777.up.railway.app/api/mcp", { fetch: mockFetch as typeof fetch });
    expect(resolved.status).toBe("available");
    expect(resolved.tools.length).toBe(1);
    expect(resolved.tools[0]?.name).toBe("analyze_token_sentiment");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://agent-777.up.railway.app/api/mcp",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("does not fall back to local tools when a remote probe fails", async () => {
    const server = new OkxMarketplaceIntelligence();
    const mockFetch = vi.fn().mockRejectedValue(new Error("network down"));
    const resolved = await resolveOkxAgent("https://agent-777.up.railway.app/api/mcp", {
      fetch: mockFetch as typeof fetch,
      localIntelligence: server,
    });
    expect(resolved.status).toBe("offline");
    expect(resolved.tools).toEqual([]);
  });

  it("does not treat a remote free-mcp URL as the local catalog", () => {
    expect(isLocalFreeMcpEndpoint("https://kind-meitner-production.up.railway.app/api/okx/free-mcp")).toBe(false);
    expect(isLocalFreeMcpEndpoint("/api/okx/free-mcp")).toBe(true);
    expect(isLocalFreeMcpEndpoint("http://127.0.0.1:8807/api/okx/free-mcp", 8807)).toBe(true);
  });

  it("executes tools in-process via OkxMarketplaceIntelligence", async () => {
    const server = new OkxMarketplaceIntelligence();
    const result = await executeOkxAgentTool(
      {
        endpointUrl: "/api/okx/free-mcp",
        toolName: "scan_free_mcp_readiness",
        arguments: { endpointUrl: "https://scanner.example/api/okx/free-mcp" },
      },
      { localIntelligence: server },
    );

    expect(result.ok).toBe(true);
    expect(result.result).toBeDefined();
  });

  it("does not execute remote URLs in-process even if they contain the local path", async () => {
    const server = new OkxMarketplaceIntelligence();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { content: [{ type: "text", text: "{\"ok\":true}" }] } }),
    });
    const result = await executeOkxAgentTool(
      {
        endpointUrl: "https://other-agent.example/api/okx/free-mcp",
        toolName: "scan_free_mcp_readiness",
        arguments: { endpointUrl: "https://scanner.example/api/okx/free-mcp" },
      },
      { localIntelligence: server, fetch: mockFetch as typeof fetch },
    );
    expect(mockFetch).toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });
});
