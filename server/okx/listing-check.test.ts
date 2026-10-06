import { describe, expect, it } from "vitest";
import {
  checkAgentListingAndConnection,
  extractAgentId,
  getAspTrustCard,
  parseAgentListingHtml,
} from "./intelligence.ts";

function createMockOkxPage(agentId: string, name: string, options: {
  score?: string;
  reviewCount?: number;
  services?: Array<{ serviceId: number; name: string; price: string; serviceType?: string; endpoint?: string }>;
} = {}) {
  const pageData = {
    appContext: {
      initialProps: {
        AgentDetailPage: {
          overview: {
            agentId,
            name,
            score: options.score ?? "5.00",
            description: "A test agent.",
          },
          services: {
            list: options.services ?? [
              {
                serviceId: 1,
                name: "Test Service",
                price: "0",
                serviceType: "A2MCP",
                endpoint: "https://declared.example/mcp",
              },
            ],
          },
          reviews: {
            totalScore: options.score ?? "5.00",
            totalCount: options.reviewCount ?? 1,
          },
        },
      },
    },
  };
  return `<!doctype html><html><head><script id="appState" type="application/json">${JSON.stringify(pageData)}</script></head><body></body></html>`;
}

describe("Listing and connection check regressions (Section 10)", () => {
  it("extractAgentId handles numeric IDs and okx.ai/agents URLs", () => {
    expect(extractAgentId("13867")).toBe("13867");
    expect(extractAgentId("#13867")).toBe("13867");
    expect(extractAgentId("https://www.okx.ai/agents/13867")).toBe("13867");
    expect(extractAgentId("https://okx.ai/agents/13851?tab=services")).toBe("13851");
    expect(extractAgentId("http://okx.ai/agents/99999")).toBe("99999");
    expect(extractAgentId("abc")).toBeNull();
    expect(extractAgentId("https://example.com/agents/13867")).toBeNull();
    expect(extractAgentId("")).toBeNull();
  });

  it("1. listing + no endpoint (e.g. 13867): neutral Not checked, no caution", async () => {
    const html = createMockOkxPage("13867", "Bespoke UX & Web", {
      services: [{ serviceId: 40890, name: "Website Design", price: "5", serviceType: "A2A" }],
    });
    const res = await checkAgentListingAndConnection("13867", undefined, {
      fetch: async () => new Response(html, { status: 200 }),
    });

    expect(res.data.listingStatus).toBe("found");
    expect(res.data.connectionStatus).toBe("not_checked");
    expect(res.data.endpointAssociation).toBe("none");
    expect(res.data.summary).toBe(
      "Listing found — Bespoke UX & Web. Public listing information was retrieved. No service URL was supplied, so the service connection was not checked."
    );
    expect(res.data.nextActions).toEqual(["Add a compatible service URL to check its connection."]);
    expect(res.data.checksPerformed).toEqual([
      expect.objectContaining({ id: "listing_page", status: "pass" }),
      expect.objectContaining({ id: "service_connection", status: "skipped", detail: "Not checked — no service URL supplied" }),
    ]);
    expect(res.data.limitations).toContain("Service delivery, output quality and payment outcomes were not assessed.");
  });

  it("2. definitive nonexistent agent (HTTP 404)", async () => {
    const res = await checkAgentListingAndConnection("999999", undefined, {
      fetch: async () => new Response("Not found", { status: 404 }),
    });
    expect(res.data.listingStatus).toBe("not_found");
    expect(res.data.connectionStatus).toBe("not_checked");
    expect(res.data.summary).toContain("HTTP 404");
  });

  it("3. HTTP 200 generic page without identity (app shell / challenge)", async () => {
    const res = await checkAgentListingAndConnection("13867", undefined, {
      fetch: async () => new Response("<html><head><title>OKX</title></head><body>Loading...</body></html>", { status: 200 }),
    });
    expect(res.data.listingStatus).toBe("could_not_verify");
  });

  it("4. timeout and access restriction (403)", async () => {
    const res403 = await checkAgentListingAndConnection("13867", undefined, {
      fetch: async () => new Response("Forbidden", { status: 403 }),
    });
    expect(res403.data.listingStatus).toBe("could_not_verify");

    const resTimeout = await checkAgentListingAndConnection("13867", undefined, {
      fetch: async () => {
        const err = new Error("Timed out");
        err.name = "TimeoutError";
        throw err;
      },
    });
    expect(resTimeout.data.listingStatus).toBe("request_failed");
  });

  it("5. identity mismatch (page identifies different agent ID)", async () => {
    const html = createMockOkxPage("12345", "Other Agent");
    const parsed = parseAgentListingHtml(html, "13867");
    expect(parsed.status).toBe("could_not_verify");
    expect(parsed.detail).toContain("identifies agent #12345 instead of #13867");
  });

  it("6. valid MCP connection (passed)", async () => {
    const html = createMockOkxPage("13851", "Kind Meitner Markets", {
      services: [{ serviceId: 1, name: "Free Readiness", price: "0", endpoint: "https://declared.example/mcp" }],
    });
    const res = await checkAgentListingAndConnection("13851", "https://declared.example/mcp", {
      fetch: async (input) => {
        const url = String(input);
        if (url.includes("okx.ai")) return new Response(html, { status: 200 });
        return new Response(JSON.stringify({ jsonrpc: "2.0", id: "1", result: { tools: [{ name: "t1" }] } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    expect(res.data.listingStatus).toBe("found");
    expect(res.data.connectionStatus).toBe("passed");
    expect(res.data.endpointAssociation).toBe("verified");
    expect(res.data.nextActions).toContain("Connection checks passed. Individual tool execution and delivery quality were not tested.");
  });

  it("7. invalid protocol response (JSON-RPC error)", async () => {
    const html = createMockOkxPage("13851", "Kind Meitner Markets");
    const res = await checkAgentListingAndConnection("13851", "https://declared.example/mcp", {
      fetch: async (input) => {
        if (String(input).includes("okx.ai")) return new Response(html, { status: 200 });
        return new Response(JSON.stringify({ jsonrpc: "2.0", id: "1", error: { code: -32601, message: "Method not found" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    expect(res.data.connectionStatus).toBe("failed");
    expect(res.data.nextActions[0]).toContain("The protocol check returned an error");
  });

  it("8. auth-required (401/403) does not report broken service", async () => {
    const html = createMockOkxPage("13851", "Kind Meitner Markets");
    const res = await checkAgentListingAndConnection("13851", "https://declared.example/mcp", {
      fetch: async (input) => {
        if (String(input).includes("okx.ai")) return new Response(html, { status: 200 });
        return new Response("Unauthorized", { status: 401 });
      },
    });
    expect(res.data.connectionStatus).toBe("could_not_verify");
    expect(res.data.nextActions).toContain("The endpoint requires authentication; authenticated access was not tested.");
  });

  it("9. payment-required (402) does not report broken service", async () => {
    const html = createMockOkxPage("13851", "Kind Meitner Markets");
    const res = await checkAgentListingAndConnection("13851", "https://declared.example/mcp", {
      fetch: async (input) => {
        if (String(input).includes("okx.ai")) return new Response(html, { status: 200 });
        return new Response("Payment Required", { status: 402 });
      },
    });
    expect(res.data.connectionStatus).toBe("could_not_verify");
    expect(res.data.nextActions).toContain("The endpoint requires payment for this request; this free check did not proceed.");
  });

  it("10. unsupported protocol (returns HTML or non-JSON-RPC)", async () => {
    const html = createMockOkxPage("13851", "Kind Meitner Markets");
    const res = await checkAgentListingAndConnection("13851", "https://declared.example/mcp", {
      fetch: async (input) => {
        if (String(input).includes("okx.ai")) return new Response(html, { status: 200 });
        return new Response("<html><body>Hello</body></html>", { status: 200, headers: { "content-type": "text/html" } });
      },
    });
    expect(res.data.connectionStatus).toBe("unsupported");
    expect(res.data.nextActions).toContain("This checker supports A2MCP (MCP over JSON-RPC 2.0). This service requires a different integration.");
  });

  it("11. unverified association (agent listing declares no endpoint)", async () => {
    const html = createMockOkxPage("13867", "Bespoke UX & Web", {
      services: [{ serviceId: 40890, name: "Website Design", price: "5", serviceType: "A2A" }],
    });
    const res = await checkAgentListingAndConnection("13867", "https://other.example/mcp", {
      fetch: async (input) => {
        if (String(input).includes("okx.ai")) return new Response(html, { status: 200 });
        return new Response(JSON.stringify({ jsonrpc: "2.0", id: "1", result: { tools: [] } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    expect(res.data.endpointAssociation).toBe("unverified");
    expect(res.data.endpointAssociationDetail).toBe("Connection checked separately. This URL has not been verified as belonging to agent #13867.");
  });

  it("12. known mismatch (agent declares endpoint A, user supplied endpoint B)", async () => {
    const html = createMockOkxPage("13851", "Kind Meitner Markets", {
      services: [{ serviceId: 1, name: "S1", price: "0", endpoint: "https://declared.example/mcp" }],
    });
    const res = await checkAgentListingAndConnection("13851", "https://different.example/mcp", {
      fetch: async (input) => {
        if (String(input).includes("okx.ai")) return new Response(html, { status: 200 });
        return new Response(JSON.stringify({ jsonrpc: "2.0", id: "1", result: { tools: [] } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    expect(res.data.endpointAssociation).toBe("known_mismatch");
    expect(res.data.endpointAssociationDetail).toContain("The listing declares a different endpoint");
  });

  it("13. legacy compatibility with getAspTrustCard", async () => {
    const html = createMockOkxPage("13851", "Kind Meitner Markets");
    const legacy = await getAspTrustCard("13851", undefined, {
      fetch: async () => new Response(html, { status: 200 }),
    });
    expect(legacy.data.listingStatus).toBe("found");
    expect(legacy.data.connectionStatus).toBe("not_checked");
    expect(legacy.data.endpointAssociation).toBe("none");
    expect(legacy.data.checksPerformed).toBeDefined();
    expect(legacy.data.limitations).toContain("Service delivery, output quality and payment outcomes were not assessed.");
  });
});
