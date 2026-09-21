import { describe, expect, it } from "vitest";

import {
  findCatalogOkxAgent,
  listCatalogOkxAgents,
  okxImportDescriptor,
} from "./agent-import.ts";

describe("OKX agent catalog", () => {
  it("exposes the deterministic chart-marked Market Scout entry", () => {
    expect(listCatalogOkxAgents()).toEqual([
      expect.objectContaining({
        id: "okx-market-scout-v1",
        name: "Market Scout",
        provider: "OKX.ai",
        avatar: "chart",
        capabilities: ["chat", "market-intelligence"],
        status: "available",
      }),
    ]);
  });

  it("finds Market Scout by opaque external id and does not invent unknown agents", () => {
    expect(findCatalogOkxAgent("okx-market-scout-v1")?.name).toBe("Market Scout");
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
