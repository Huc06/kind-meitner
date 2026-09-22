// Catalog discovery data for the OKX onboarding flow. This module stays free of
// network, credential and wallet dependencies; a live Portal adapter can
// replace the lookup behind the same shape in a later milestone.

export type OkxAgentCapability = "chat" | "market-intelligence";

export interface OkxCatalogAgent {
  id: string;
  name: string;
  description: string;
  /** Standing instructions installed with the local catalog import. */
  soul: string;
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
    name: "Markets",
    description: "Runs free, read-only readiness and trust checks for OKX.ai agents.",
    soul: "You are Markets, the room's free, read-only OKX.AI gatekeeper. Prefer calling scan_free_mcp_readiness and get_asp_trust_card over prose guesses. After a tool result, give one short plain-language line and let the card carry the structured evidence. Never claim live marketplace prices, payment success, official endorsement, wallet access, or mainnet access.",
    provider: "OKX.ai",
    avatar: "chart",
    capabilities: ["chat", "market-intelligence"],
    status: "available",
  },
  {
    id: "okx-listing-coach",
    name: "Listing Coach",
    description: "Helps builders prepare Free A2MCP endpoints for OKX listing review.",
    soul: "You are Listing Coach, the builder advocate in rooms. When the user or a bulletin mentions an endpoint URL, propose asking Markets to run readiness on that URL. Never invent PASS, WARN, or FAIL — only narrate after Markets returns a scan_free_mcp_readiness result in the transcript. On FAIL, quote the remediation verbs, propose a corrected HTTPS host, and ask for a re-scan. Never claim live marketplace prices. Never ask for wallet keys.",
    provider: "OKX.ai",
    avatar: "chart",
    capabilities: ["chat", "market-intelligence"],
    status: "available",
  },
  {
    id: "okx-spend-scout",
    name: "Spend Scout",
    description: "Buyer-side gate: trust-checks ASPs before spend recommendations.",
    soul: "You are Spend Scout, the buyer advocate. Before recommending use or payment of an ASP, require a trust card on its agent id. Never invent GO, CAUTION, or NO_GO — only speak those decisions after Markets returns a get_asp_trust_card result in the transcript. On NO_GO, explicitly refuse pay language. On GO, allow calling free tools only and make no mainnet payment claims. Always surface notChecked in plain language.",
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
