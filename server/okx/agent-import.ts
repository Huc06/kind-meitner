// Catalog discovery data for the OKX onboarding flow. This module stays free of
// network, credential and wallet dependencies; a live Portal adapter can
// replace the lookup behind the same shape in a later milestone.

export type OkxAgentCapability = "chat" | "market-intelligence";

export interface OkxCatalogAgent {
  id: string;
  name: string;
  description: string;
  provider: "OKX.ai";
  avatar: "chart";
  capabilities: OkxAgentCapability[];
  status: "available";
}

export interface OkxImportDescriptor {
  kind: "okx-catalog";
  externalAgentId: string;
  provider: "OKX.ai";
  capabilities: OkxAgentCapability[];
}

export const OKX_CATALOG_AGENTS: readonly OkxCatalogAgent[] = [
  {
    id: "okx-market-scout-v1",
    name: "Market Scout",
    description: "Summarizes OKX marketplace demand, pricing and active task categories.",
    provider: "OKX.ai",
    avatar: "chart",
    capabilities: ["chat", "market-intelligence"],
    status: "available",
  },
  {
    id: "okx-listing-coach-v1",
    name: "Listing Coach",
    description: "Helps ASPs shape clear, competitive OKX marketplace listings.",
    provider: "OKX.ai",
    avatar: "chart",
    capabilities: ["chat"],
    status: "available",
  },
  {
    id: "okx-spend-scout-v1",
    name: "Spend Scout",
    description: "Finds efficient marketplace options for an OKX task budget.",
    provider: "OKX.ai",
    avatar: "chart",
    capabilities: ["chat", "market-intelligence"],
    status: "available",
  },
];

export function listCatalogOkxAgents(): readonly OkxCatalogAgent[] {
  return OKX_CATALOG_AGENTS;
}

export function findCatalogOkxAgent(id: string): OkxCatalogAgent | undefined {
  return OKX_CATALOG_AGENTS.find((agent) => agent.id === id);
}

export function okxImportDescriptor(agent: OkxCatalogAgent): OkxImportDescriptor {
  return {
    kind: "okx-catalog",
    externalAgentId: agent.id,
    provider: agent.provider,
    capabilities: [...agent.capabilities],
  };
}
