// The one source for the current Dev Day demo identity: Kind Meitner Markets,
// a free read-only A2MCP service listed on OKX.AI. Server and renderer import
// this; historical evidence (e.g. the unlisted #13837 receipts) is not config.
export const OKX_DEMO_IDENTITY = {
  agentId: "13851",
  name: "Kind Meitner Markets",
  serviceName: "Free Readiness Trust",
  listingUrl: "https://www.okx.ai/agents/13851",
  endpointUrl: "https://kind-meitner-production.up.railway.app/api/okx/free-mcp",
  protocol: "A2MCP (MCP over JSON-RPC 2.0)",
  access: "Free · Read-only",
} as const;

/** Provenance for the locally indexed tools (reputation, trending,
 * benchmarks, use cases, checklist). The registry holds illustrative sample
 * records, not OKX.AI marketplace statistics; callers must be told. */
export const OKX_LOCAL_REGISTRY_PROVENANCE =
  "kind-meitner sample registry (illustrative records, not OKX.AI marketplace statistics) and public OKX.AI setup guidance";

/** The two tools the demo calls; both are read-only on the live service. */
export const OKX_DEMO_TOOLS = {
  endpoint: "scan_free_mcp_readiness",
  agent: "get_asp_trust_card",
} as const;

/** A target the live service refuses before any network probe (private /
 * loopback), so the failure case never scans a third-party host. */
export const OKX_DEMO_CONTROLLED_FAILURE_URL = "https://127.0.0.1/mcp";

export type OkxDemoCheckRequest =
  | { kind: "endpoint"; endpointUrl: string }
  | { kind: "agent"; agentId: string; endpointUrl?: string };

export type OkxDemoCheckResult =
  | {
      ok: true;
      source: "live";
      tool: string;
      arguments: Record<string, string>;
      endpointUrl: string;
      requestId: string;
      startedAt: string;
      latencyMs: number;
      /** The tool's own `{ resource, data }` envelope, unmodified. */
      envelope: { resource: Record<string, unknown>; data: Record<string, unknown> };
    }
  | {
      ok: false;
      source: "live";
      status: "invalid_input" | "timeout" | "unreachable" | "rate_limited" | "bad_response" | "tool_error";
      safeMessage: string;
      tool?: string;
      requestId: string;
      startedAt: string;
      latencyMs: number;
    };

export type OkxDemoStatus = {
  ok: boolean;
  source: "live";
  endpointUrl: string;
  checkedAt: string;
  latencyMs: number;
  protocolVersion?: string;
  serverName?: string;
  tools: string[];
  /** Both demo tools appear in the live tools/list. */
  demoToolsAvailable: boolean;
  safeMessage: string;
};
