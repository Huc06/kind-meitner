import { describe, expect, it } from "vitest";

import {
  findCatalogOkxAgent,
  listCatalogOkxAgents,
  okxImportDescriptor,
} from "./agent-import.ts";

describe("OKX agent catalog", () => {
  it("exposes the deterministic catalog roles with chart marks and honest summaries", () => {
    expect(listCatalogOkxAgents()).toEqual([
      expect.objectContaining({
        id: "okx-market-scout-v1",
        name: "Markets",
        description: "Runs free, read-only readiness and trust checks for OKX.ai agents.",
        avatar: "chart",
        provider: "OKX.ai",
        capabilities: ["chat", "market-intelligence"],
        status: "available",
      }),
      expect.objectContaining({
        id: "okx-listing-coach",
        name: "Listing Coach",
        description: "Helps builders prepare Free A2MCP endpoints for OKX listing review.",
        avatar: "chart",
      }),
      expect.objectContaining({
        id: "okx-spend-scout",
        name: "Spend Scout",
        description: "Buyer-side gate: trust-checks ASPs before spend recommendations.",
        avatar: "chart",
      }),
    ]);
  });

  it("keeps the Listing Coach, Spend Scout, and Markets behavioral contracts in standing instructions", () => {
    const listingCoach = findCatalogOkxAgent("okx-listing-coach")!;
    const spendScout = findCatalogOkxAgent("okx-spend-scout")!;
    const markets = findCatalogOkxAgent("okx-market-scout-v1")!;

    expect(listingCoach.soul).toContain("readiness");
    expect(listingCoach.soul).toContain("Never invent PASS, WARN, or FAIL");
    expect(listingCoach.soul).toContain("scan_free_mcp_readiness");
    expect(listingCoach.soul).toContain("Never ask for wallet keys");
    expect(spendScout.soul).toContain("trust card");
    expect(spendScout.soul).toContain("Never invent GO, CAUTION, or NO_GO");
    expect(spendScout.soul).toContain("get_asp_trust_card");
    expect(spendScout.soul).toContain("notChecked");
    expect(markets.soul).toContain("scan_free_mcp_readiness");
    expect(markets.soul).toContain("get_asp_trust_card");
  });

  it("finds one agent by opaque external id and does not invent unknown agents", () => {
    expect(findCatalogOkxAgent("okx-market-scout-v1")?.name).toBe("Markets");
    expect(findCatalogOkxAgent("not-an-okx-agent")).toBeUndefined();
  });

  it("copies the catalog capability list into an explicit safe import descriptor", () => {
    const agent = findCatalogOkxAgent("okx-market-scout-v1")!;
    const descriptor = okxImportDescriptor(agent);
    expect(descriptor).toEqual({
      kind: "okx-catalog",
      externalAgentId: "okx-market-scout-v1",
      provider: "OKX.ai",
      capabilities: ["chat", "market-intelligence"],
    });
    expect(descriptor.capabilities).not.toBe(agent.capabilities);
  });
});
