export interface CatalogAgent {
  id: string;
  name: string;
  description: string;
  provider: string;
  avatar?: string;
  capabilities: string[];
  status?: string;
  soul?: string;
}

export type HubAgent = {
  id: string;
  name: string;
  summary: string;
  provider: string;
  capabilities: string[];
  importedBotId?: string;
  rooms: { id: string; name: string }[];
};

export type HubService = {
  id: string;
  name: string;
  endpoint: string;
  tools: { name: string; description: string }[];
  provenance: string;
  okxAgentId?: string;
};

export type ImportHubAgentResult = {
  kind: "added" | "already" | "notFound" | "dmRoom" | "invalid" | "network";
  room?: string;
  message?: string;
};

export type HubBotLike = {
  id: string;
  name?: string;
  description?: string;
  okxImport?: {
    externalAgentId: string;
    provider?: string;
    capabilities?: readonly string[] | string[];
  } | null;
};

export type HubGroupLike = {
  id: string;
  name: string;
  memberIds?: readonly string[] | string[];
  dm?: boolean;
};

let catalogCache: CatalogAgent[] | null = null;

export function clearHubCatalogCache(): void {
  catalogCache = null;
}

function parseCatalogResponse(value: unknown): CatalogAgent[] | null {
  if (!value || typeof value !== "object") return null;
  const rawList = (value as { agents?: unknown }).agents;
  if (!Array.isArray(rawList)) return null;

  const agents: CatalogAgent[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const { id, name, description, provider, capabilities } = record;
    if (
      typeof id !== "string" ||
      typeof name !== "string" ||
      typeof description !== "string" ||
      typeof provider !== "string" ||
      !Array.isArray(capabilities) ||
      !capabilities.every((c) => typeof c === "string")
    ) {
      return null;
    }
    agents.push({
      id,
      name,
      description,
      provider,
      capabilities: [...capabilities],
      avatar: typeof record.avatar === "string" ? record.avatar : undefined,
      status: typeof record.status === "string" ? record.status : undefined,
      soul: typeof record.soul === "string" ? record.soul : undefined,
    });
  }
  return agents;
}

export async function loadHubCatalog(): Promise<{
  agents: CatalogAgent[];
  stale: boolean;
}> {
  try {
    const res = await fetch("/api/okx/agents");
    if (!res.ok) {
      throw new Error(`Catalog request failed: ${res.status}`);
    }
    const body = await res.json();
    const parsed = parseCatalogResponse(body);
    if (!parsed) {
      throw new Error("Invalid catalog response format");
    }
    catalogCache = parsed;
    return { agents: catalogCache, stale: false };
  } catch (err) {
    if (catalogCache !== null) {
      return { agents: catalogCache, stale: true };
    }
    throw err;
  }
}

export function mergeHubAgents(
  catalog: readonly CatalogAgent[],
  bots: readonly HubBotLike[] = [],
  groups: readonly HubGroupLike[] = [],
): HubAgent[] {
  const seenIds = new Set<string>();
  const result: HubAgent[] = [];

  for (const agent of catalog) {
    seenIds.add(agent.id);
    const matchingBot = bots.find(
      (b) => b.okxImport?.externalAgentId === agent.id,
    );
    const rooms = matchingBot
      ? groups
          .filter(
            (g) =>
              !g.dm &&
              Array.isArray(g.memberIds) &&
              g.memberIds.includes(matchingBot.id),
          )
          .map((g) => ({ id: g.id, name: g.name }))
      : [];

    result.push({
      id: agent.id,
      name: agent.name,
      summary: agent.description,
      provider: agent.provider,
      capabilities: [...agent.capabilities],
      importedBotId: matchingBot?.id,
      rooms,
    });
  }

  for (const bot of bots) {
    const extId = bot.okxImport?.externalAgentId;
    if (extId && !seenIds.has(extId)) {
      seenIds.add(extId);
      const rooms = groups
        .filter(
          (g) =>
            !g.dm &&
            Array.isArray(g.memberIds) &&
            g.memberIds.includes(bot.id),
        )
        .map((g) => ({ id: g.id, name: g.name }));

      result.push({
        id: extId,
        name: bot.name ?? extId,
        summary: bot.description ?? "",
        provider: bot.okxImport?.provider ?? "OKX.ai",
        capabilities: bot.okxImport?.capabilities
          ? [...bot.okxImport.capabilities]
          : [],
        importedBotId: bot.id,
        rooms,
      });
    }
  }

  return result;
}

export async function importHubAgent(
  agentId: string,
  roomId: string,
): Promise<ImportHubAgentResult> {
  try {
    const requestId =
      globalThis.crypto?.randomUUID?.() ??
      `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

    const res = await fetch("/api/okx/agents/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId, roomId, requestId }),
    });

    const body = await res.json().catch(() => ({}));
    const returnedRoom =
      typeof body?.room?.id === "string"
        ? body.room.id
        : typeof body?.room === "string"
          ? body.room
          : roomId;

    if (res.status === 201 || (res.ok && body?.created === true)) {
      return { kind: "added", room: returnedRoom };
    }

    if (res.status === 200 || (res.ok && body?.created === false)) {
      return { kind: "already", room: returnedRoom };
    }

    const message =
      typeof body?.error === "string"
        ? body.error
        : typeof body?.message === "string"
          ? body.message
          : undefined;

    if (res.status === 404) {
      return { kind: "notFound", message: message ?? "Agent or room not found" };
    }

    if (
      res.status === 400 &&
      (message?.includes("DM") || message?.toLowerCase().includes("non-dm"))
    ) {
      return {
        kind: "dmRoom",
        message: message ?? "OKX agents can only join non-DM rooms",
      };
    }

    if (res.status === 400) {
      return { kind: "invalid", message: message ?? "Invalid import request" };
    }

    return {
      kind: "invalid",
      message: message ?? `Request failed with status ${res.status}`,
    };
  } catch (err) {
    return {
      kind: "network",
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}

/** The public deployment of this workspace's Free A2MCP service and its OKX.AI
 * listing. The readiness scanner only probes public HTTPS hosts, and the trust
 * card takes an okx.ai agent id, so the card advertises these rather than the
 * local relative route it reads the tool list from. */
export const PUBLIC_FREE_MCP_ENDPOINT = "https://kind-meitner-production.up.railway.app/api/okx/free-mcp";
export const PUBLIC_OKX_AGENT_ID = "13851";

export async function loadFreeMcpService(
  endpoint = "/api/okx/free-mcp",
): Promise<HubService> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "hub-tools-list",
      method: "tools/list",
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to load Free MCP tools: ${res.status}`);
  }

  const body = await res.json();
  const rawTools = Array.isArray(body?.result?.tools) ? body.result.tools : [];
  const tools = rawTools
    .filter((t: unknown) => t && typeof (t as Record<string, unknown>).name === "string")
    .map((t: Record<string, unknown>) => ({
      name: String(t.name),
      description: typeof t.description === "string" ? t.description : "",
    }));

  return {
    id: "okx-free-mcp",
    name: "Kind Meitner Markets · Free A2MCP",
    endpoint: PUBLIC_FREE_MCP_ENDPOINT,
    tools,
    provenance: "kind-meitner local registry and public OKX.AI setup guidance",
    okxAgentId: PUBLIC_OKX_AGENT_ID,
  };
}

export function readinessPrompt(endpoint: string): string {
  return `@Markets run scan_free_mcp_readiness for ${endpoint.trim()}`;
}

export function trustPrompt(agentId: string, endpoint?: string): string {
  const id = agentId.trim();
  const ep = endpoint?.trim();
  if (ep) {
    return `@Markets run get_asp_trust_card for agentId ${id} with endpointUrl ${ep}`;
  }
  return `@Markets run get_asp_trust_card for agentId ${id}`;
}
