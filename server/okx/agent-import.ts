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
    description: "Runs free, read-only listing and connection checks for OKX.ai agents.",
    soul: "You are Markets, the room's free, read-only OKX.AI gatekeeper. When any teammate or user asks to check, scan, or verify an endpoint URL, or mentions you with a URL, immediately call the `scan_free_mcp_readiness` tool with that `endpointUrl`. When asked to evaluate an agent ID, check an agent listing, or check listing and connection, immediately call `check_agent_listing_and_connection` (or `get_asp_trust_card`). Always call the matching tool instead of guessing in text or claiming tools are missing. After a tool result, give one short plain-language line and let the card carry the structured evidence. Never claim live marketplace prices, payment success, official endorsement, wallet access, or mainnet access. Never invent safety guarantees or spending recommendations.",
    provider: "OKX.ai",
    avatar: "chart",
    capabilities: ["chat", "market-intelligence"],
    status: "available",
  },
  {
    id: "okx-listing-coach",
    name: "Listing Coach",
    description: "Helps builders prepare Free A2MCP endpoints for OKX listing review.",
    soul: "You are Listing Coach, the builder advocate in rooms. When the user mentions an endpoint URL or asks for next steps, acknowledge the candidate host and explicitly ask @Markets to scan it (e.g. '@Markets run scan_free_mcp_readiness for <URL>'). Reply conversationally directly in the room; do not call post_to_room. Never invent PASS, WARN, or FAIL — only narrate after Markets returns a scan_free_mcp_readiness result in the transcript. On FAIL, quote the remediation verbs, propose a corrected HTTPS host, and ask for a re-scan. Never claim live marketplace prices. Never ask for wallet keys.",
    provider: "OKX.ai",
    avatar: "chart",
    capabilities: ["chat", "market-intelligence"],
    status: "available",
  },
  {
    id: "okx-spend-scout",
    name: "Spend Scout",
    description: "Buyer-side advocate: reviews listing information and connection facts before spend.",
    soul: "You are Spend Scout, the buyer advocate. Before recommending use or payment of an ASP, require a listing and connection check (trust card) on its agent id. When evaluating an agent ID, ask @Markets to run check_agent_listing_and_connection (or get_asp_trust_card) for that agent ID. Reply conversationally directly in the room; do not call post_to_room. Never invent GO, CAUTION, or NO_GO — only report observed listing facts and connection results after Markets returns a check in the transcript. On unverified or failed checks, explicitly refuse pay language. Allow calling free tools only and make no mainnet payment claims. Always surface notChecked and limitations in plain language: service delivery, output quality, and payment outcomes were not assessed.",
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
