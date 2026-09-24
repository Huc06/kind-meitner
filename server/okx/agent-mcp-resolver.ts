import { listCatalogOkxAgents, findCatalogOkxAgent } from "./agent-import.ts";
import { OkxMarketplaceIntelligence } from "./intelligence.ts";

const LOCAL_FREE_MCP_PATH = "/api/okx/free-mcp";
const LOCAL_ASP_ALIASES: Record<string, string> = {
  "13837": "okx-market-scout-v1",
};

export interface ResolvedOkxAgentTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ResolvedOkxAgent {
  agentId: string;
  name: string;
  description: string;
  endpointUrl: string;
  provider: "OKX.ai";
  avatar: "chart";
  status: "available" | "offline";
  tools: ResolvedOkxAgentTool[];
}

export interface ResolveOkxAgentDependencies {
  fetch?: typeof fetch;
  localIntelligence?: OkxMarketplaceIntelligence;
  localPort?: number;
}

export function parseAgentIdOrUrl(input: string): { agentId: string; explicitEndpointUrl?: string } {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const match = url.pathname.match(/\/agents\/([^/?#]+)/i);
      if (match?.[1] && isOkxAgentHost(url.hostname)) {
        return { agentId: decodeURIComponent(match[1]) };
      }
      return { agentId: url.hostname, explicitEndpointUrl: trimmed };
    } catch {
      return { agentId: trimmed };
    }
  }
  return { agentId: trimmed.replace(/^#/, "") };
}

export function isLocalFreeMcpEndpoint(endpointUrl: string, localPort?: number): boolean {
  const trimmed = endpointUrl.trim();
  if (trimmed === LOCAL_FREE_MCP_PATH) return true;
  try {
    const url = new URL(trimmed);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.pathname !== LOCAL_FREE_MCP_PATH) return false;
    const localHost = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    if (!localHost) return false;
    if (localPort != null && url.port && url.port !== String(localPort)) return false;
    return true;
  } catch {
    return false;
  }
}

function isOkxAgentHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "okx.ai" || host === "www.okx.ai";
}

function catalogAgentFor(agentId: string) {
  const aliased = LOCAL_ASP_ALIASES[agentId] ?? agentId;
  return findCatalogOkxAgent(aliased)
    ?? listCatalogOkxAgents().find((agent) => agent.id === agentId || agent.name.toLowerCase() === agentId.toLowerCase());
}

function localEndpoint(deps: ResolveOkxAgentDependencies): string {
  return deps.localPort ? `http://127.0.0.1:${deps.localPort}${LOCAL_FREE_MCP_PATH}` : LOCAL_FREE_MCP_PATH;
}

function toolsFromIntelligence(intelligence: OkxMarketplaceIntelligence): ResolvedOkxAgentTool[] {
  return intelligence.getFreeToolDeclarations().map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema as Record<string, unknown>,
  }));
}

function availableAgent(
  agentId: string,
  catalog: ReturnType<typeof catalogAgentFor>,
  endpointUrl: string,
  tools: ResolvedOkxAgentTool[],
): ResolvedOkxAgent {
  return {
    agentId,
    name: catalog?.name ?? `OKX Agent #${agentId}`,
    description: catalog?.description ?? `Autonomous service provider #${agentId} on OKX.ai.`,
    endpointUrl,
    provider: "OKX.ai",
    avatar: "chart",
    status: "available",
    tools,
  };
}

function offlineAgent(
  agentId: string,
  catalog: ReturnType<typeof catalogAgentFor>,
  endpointUrl: string,
): ResolvedOkxAgent {
  return {
    agentId,
    name: catalog?.name ?? `OKX Agent #${agentId}`,
    description: catalog?.description ?? `Autonomous service provider #${agentId} on OKX.ai.`,
    endpointUrl,
    provider: "OKX.ai",
    avatar: "chart",
    status: "offline",
    tools: [],
  };
}

function assertHttpUrl(endpointUrl: string): URL {
  const url = new URL(endpointUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) MCP endpoints are supported");
  }
  return url;
}

export async function resolveOkxAgent(
  agentIdOrUrl: string,
  deps: ResolveOkxAgentDependencies = {},
): Promise<ResolvedOkxAgent> {
  const { agentId, explicitEndpointUrl } = parseAgentIdOrUrl(agentIdOrUrl);
  const catalog = catalogAgentFor(agentId);

  if (!explicitEndpointUrl) {
    if (catalog && deps.localIntelligence) {
      return availableAgent(agentId, catalog, localEndpoint(deps), toolsFromIntelligence(deps.localIntelligence));
    }
    return offlineAgent(agentId, catalog, "");
  }

  if (deps.localIntelligence && isLocalFreeMcpEndpoint(explicitEndpointUrl, deps.localPort)) {
    return availableAgent(agentId, catalog, explicitEndpointUrl, toolsFromIntelligence(deps.localIntelligence));
  }

  try {
    assertHttpUrl(explicitEndpointUrl);
  } catch {
    return offlineAgent(agentId, catalog, explicitEndpointUrl);
  }

  const probeFetch = deps.fetch ?? fetch;
  try {
    const res = await probeFetch(explicitEndpointUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "tools-list-probe",
        method: "tools/list",
        params: {},
      }),
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return offlineAgent(agentId, catalog, explicitEndpointUrl);
    const data = await res.json() as {
      result?: { tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> };
    };
    const remoteTools = Array.isArray(data?.result?.tools) ? data.result.tools : [];
    return availableAgent(
      agentId,
      catalog,
      explicitEndpointUrl,
      remoteTools.map((tool) => ({
        name: tool.name,
        description: tool.description ?? "",
        inputSchema: tool.inputSchema ?? {},
      })),
    );
  } catch {
    return offlineAgent(agentId, catalog, explicitEndpointUrl);
  }
}

export async function executeOkxAgentTool(
  params: {
    endpointUrl: string;
    toolName: string;
    arguments: Record<string, unknown>;
  },
  deps: ResolveOkxAgentDependencies = {},
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const { endpointUrl, toolName, arguments: args } = params;
  const resolvedEndpoint = endpointUrl.trim() || LOCAL_FREE_MCP_PATH;

  if (deps.localIntelligence && isLocalFreeMcpEndpoint(resolvedEndpoint, deps.localPort)) {
    try {
      const toolRes = await deps.localIntelligence.handleFreeMcpToolCall(toolName, args);
      if (toolRes.isError) {
        return { ok: false, error: toolRes.content?.[0]?.text ?? "Tool call failed" };
      }
      const text = toolRes.content?.[0]?.text ?? "{}";
      try {
        return { ok: true, result: JSON.parse(text) };
      } catch {
        return { ok: true, result: text };
      }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  try {
    assertHttpUrl(resolvedEndpoint);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  const probeFetch = deps.fetch ?? fetch;
  try {
    const res = await probeFetch(resolvedEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "tool-call-exec",
        method: "tools/call",
        params: { name: toolName, arguments: args },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
    const data = await res.json() as { error?: { message?: string }; result?: { isError?: boolean; content?: Array<{ text?: string }> } };
    if (data.error) return { ok: false, error: data.error.message ?? "Tool execution failed" };
    if (data.result?.isError) {
      return { ok: false, error: data.result.content?.[0]?.text ?? "Tool execution failed" };
    }
    return { ok: true, result: data.result };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
