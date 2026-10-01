import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearHubCatalogCache,
  importHubAgent,
  loadFreeMcpService,
  loadHubCatalog,
  mergeHubAgents,
  readinessPrompt,
  trustPrompt,
  type CatalogAgent,
} from "./agent-hub";

const sampleCatalog: CatalogAgent[] = [
  {
    id: "okx-market-scout-v1",
    name: "Markets",
    description: "Summarizes OKX marketplace demand and checks readiness.",
    provider: "OKX.ai",
    capabilities: ["chat", "market-intelligence"],
  },
  {
    id: "okx-listing-coach",
    name: "Listing Coach",
    description: "Helps builders prepare Free A2MCP endpoints for review.",
    provider: "OKX.ai",
    capabilities: ["chat"],
  },
];

describe("agent-hub", () => {
  beforeEach(() => {
    clearHubCatalogCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("loadHubCatalog", () => {
    it("loads catalog from API and populates cache", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({ source: "catalog", agents: sampleCatalog }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

      const result = await loadHubCatalog();
      expect(result.stale).toBe(false);
      expect(result.agents).toHaveLength(2);
      expect(result.agents[0].id).toBe("okx-market-scout-v1");
      expect(fetchSpy).toHaveBeenCalledWith("/api/okx/agents");
    });

    it("returns stale cache when refresh fails after previous success", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ source: "catalog", agents: sampleCatalog }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        )
        .mockRejectedValueOnce(new Error("Network connection lost"));

      const initial = await loadHubCatalog();
      expect(initial.stale).toBe(false);

      const cached = await loadHubCatalog();
      expect(cached.stale).toBe(true);
      expect(cached.agents).toEqual(initial.agents);
    });

    it("throws when refresh fails and cache is empty", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("Connection refused"),
      );

      await expect(loadHubCatalog()).rejects.toThrow("Connection refused");
    });

    it("throws when catalog response returns non-200 and cache is empty", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Server error" }), {
          status: 500,
          statusText: "Internal Server Error",
        }),
      );

      await expect(loadHubCatalog()).rejects.toThrow("Catalog request failed: 500");
    });
  });

  describe("importHubAgent", () => {
    it("handles added (201 created) result", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            agent: { id: "bot-1", name: "Markets" },
            room: { id: "room-abc" },
            activityMessageId: "msg-1",
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
      );

      const result = await importHubAgent("okx-market-scout-v1", "room-abc");
      expect(result).toEqual({ kind: "added", room: "room-abc" });
    });

    it("handles already imported (200 OK) result", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            agent: { id: "bot-1", name: "Markets" },
            room: { id: "room-abc" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

      const result = await importHubAgent("okx-market-scout-v1", "room-abc");
      expect(result).toEqual({ kind: "already", room: "room-abc" });
    });

    it("handles DM room rejection (400 bad request)", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: "OKX agents can only join non-DM rooms",
          }),
          { status: 400, headers: { "content-type": "application/json" } },
        ),
      );

      const result = await importHubAgent("okx-market-scout-v1", "dm-123");
      expect(result).toEqual({
        kind: "dmRoom",
        message: "OKX agents can only join non-DM rooms",
      });
    });

    it("handles notFound (404) result", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: "no such room" }),
          { status: 404, headers: { "content-type": "application/json" } },
        ),
      );

      const result = await importHubAgent("okx-market-scout-v1", "room-404");
      expect(result).toEqual({
        kind: "notFound",
        message: "no such room",
      });
    });

    it("handles network failure gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new TypeError("Failed to fetch"),
      );

      const result = await importHubAgent("okx-market-scout-v1", "room-1");
      expect(result).toEqual({
        kind: "network",
        message: "Failed to fetch",
      });
    });

    it("handles generic 400 invalid request", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: "agentId is required" }),
          { status: 400, headers: { "content-type": "application/json" } },
        ),
      );

      const result = await importHubAgent("", "room-1");
      expect(result).toEqual({
        kind: "invalid",
        message: "agentId is required",
      });
    });
  });

  describe("mergeHubAgents", () => {
    it("matches imported bots and non-DM rooms", () => {
      const bots = [
        {
          id: "bot-markets",
          name: "Markets",
          description: "Market bot",
          okxImport: {
            externalAgentId: "okx-market-scout-v1",
            provider: "OKX.ai",
            capabilities: ["chat", "market-intelligence"],
          },
        },
      ];

      const groups = [
        {
          id: "room-1",
          name: "general",
          memberIds: ["bot-markets", "user-1"],
          dm: false,
        },
        {
          id: "dm-room",
          name: "bot-dm",
          memberIds: ["bot-markets", "user-1"],
          dm: true,
        },
        {
          id: "room-2",
          name: "random",
          memberIds: ["user-1"],
          dm: false,
        },
      ];

      const merged = mergeHubAgents(sampleCatalog, bots, groups);
      expect(merged).toHaveLength(2);

      const markets = merged.find((a) => a.id === "okx-market-scout-v1");
      expect(markets).toBeDefined();
      expect(markets?.importedBotId).toBe("bot-markets");
      expect(markets?.summary).toBe(sampleCatalog[0].description);
      expect(markets?.rooms).toEqual([{ id: "room-1", name: "general" }]);

      const coach = merged.find((a) => a.id === "okx-listing-coach");
      expect(coach).toBeDefined();
      expect(coach?.importedBotId).toBeUndefined();
      expect(coach?.rooms).toEqual([]);
    });

    it("includes non-catalog imported bots with okxImport descriptor", () => {
      const bots = [
        {
          id: "bot-asp-13851",
          name: "ASP #13851",
          description: "Autonomous ASP",
          okxImport: {
            externalAgentId: "13851",
            provider: "OKX.ai",
            capabilities: ["chat"],
          },
        },
      ];

      const groups = [
        {
          id: "room-asp",
          name: "asp-lab",
          memberIds: ["bot-asp-13851"],
        },
      ];

      const merged = mergeHubAgents(sampleCatalog, bots, groups);
      expect(merged).toHaveLength(3);
      const asp = merged.find((a) => a.id === "13851");
      expect(asp).toBeDefined();
      expect(asp?.name).toBe("ASP #13851");
      expect(asp?.importedBotId).toBe("bot-asp-13851");
      expect(asp?.rooms).toEqual([{ id: "room-asp", name: "asp-lab" }]);
    });
  });

  describe("loadFreeMcpService", () => {
    it("parses tools/list from /api/okx/free-mcp", async () => {
      const mockRpcResponse = {
        jsonrpc: "2.0",
        id: "hub-tools-list",
        result: {
          tools: [
            {
              name: "scan_free_mcp_readiness",
              description: "Probes public HTTPS endpoint",
            },
            {
              name: "get_asp_trust_card",
              description: "Evaluates ASP trust tier",
            },
          ],
        },
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockRpcResponse), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

      const service = await loadFreeMcpService();
      expect(service.id).toBe("okx-free-mcp");
      // The scanner only probes public HTTPS hosts, so the card targets the
      // public deployment and its okx.ai listing, not the local route.
      expect(service.endpoint).toBe("https://kind-meitner-production.up.railway.app/api/okx/free-mcp");
      expect(service.okxAgentId).toBe("13851");
      expect(service.provenance).toBe(
        "kind-meitner local registry and public OKX.AI setup guidance",
      );
      expect(service.tools).toEqual([
        {
          name: "scan_free_mcp_readiness",
          description: "Probes public HTTPS endpoint",
        },
        {
          name: "get_asp_trust_card",
          description: "Evaluates ASP trust tier",
        },
      ]);

      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/okx/free-mcp",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "hub-tools-list",
            method: "tools/list",
          }),
        }),
      );
    });

    it("throws on failed HTTP status", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Server Error", { status: 503 }),
      );

      await expect(loadFreeMcpService()).rejects.toThrow("Failed to load Free MCP tools: 503");
    });
  });

  describe("readinessPrompt and trustPrompt", () => {
    it("creates scan_free_mcp_readiness prompt for an endpoint", () => {
      expect(readinessPrompt("https://demo.vercel.app/api/okx/free-mcp")).toBe(
        "@Markets run scan_free_mcp_readiness for https://demo.vercel.app/api/okx/free-mcp",
      );
    });

    it("creates get_asp_trust_card prompt without endpointUrl", () => {
      expect(trustPrompt("99999")).toBe(
        "@Markets run get_asp_trust_card for agentId 99999",
      );
    });

    it("creates get_asp_trust_card prompt with endpointUrl", () => {
      expect(
        trustPrompt(
          "13851",
          "https://kind-meitner-production.up.railway.app/api/okx/free-mcp",
        ),
      ).toBe(
        "@Markets run get_asp_trust_card for agentId 13851 with endpointUrl https://kind-meitner-production.up.railway.app/api/okx/free-mcp",
      );
    });
  });
});
