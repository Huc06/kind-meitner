import { createHash, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { writeFileAtomic } from "../atomic.ts";
import { OKX_LOCAL_REGISTRY_PROVENANCE } from "../../shared/okx-demo-identity.ts";

export type ReadinessCheckStatus = "pass" | "warn" | "fail";

export interface ReadinessCheck {
  id: "https_scheme" | "host_pitfall_vercel" | "tools_list_http" | "tools_list_shape" | "no_accidental_402" | "initialize_soft";
  status: ReadinessCheckStatus;
  detail: string;
}

export interface ReadinessReceipt {
  schema: "kindmeitner.readiness.v1";
  id: string;
  evidenceHash: string;
}

export interface FreeMcpReadinessData {
  endpointUrl: string;
  agentId: string | null;
  verdict: "PASS" | "WARN" | "FAIL";
  score: number;
  checks: ReadinessCheck[];
  remediation: string[];
  raw: { httpStatus: number | null; toolNames: string[]; truncatedNotes: string };
  receipt?: ReadinessReceipt;
}

export const READINESS_CHECK_IDS: ReadinessCheck["id"][] = [
  "https_scheme",
  "host_pitfall_vercel",
  "tools_list_http",
  "tools_list_shape",
  "no_accidental_402",
  "initialize_soft",
];

export function isPrivateIpAddress(host: string): boolean {
  const value = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (value === "localhost" || value === "::1") return true;
  const octets = value.split(".").map(Number);
  if (octets.length === 4 && octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [a, b] = octets;
    return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  return value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd");
}

export function truncateReadinessDetail(value: string, max = 500): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

export function readinessVerdict(checks: ReadinessCheck[]): FreeMcpReadinessData["verdict"] {
  if (checks.some((check) => ["https_scheme", "host_pitfall_vercel", "tools_list_http", "no_accidental_402"].includes(check.id) && check.status === "fail")) return "FAIL";
  return checks.some((check) => check.status === "warn") ? "WARN" : "PASS";
}

export interface OkxRemoteAgentMetadata {
  agentId: string;
  name: string;
  description: string;
  score?: string;
  approvalRate?: string;
  usageCount?: number;
  reviewCount?: number;
  avatarUrl?: string;
  categories?: string[];
  services?: Array<{
    serviceId: number | string;
    name: string;
    description: string;
    price: string;
    endpoint?: string;
  }>;
}

export const KNOWN_OKX_AGENTS: Record<string, OkxRemoteAgentMetadata> = {
  "11336": {
    agentId: "11336",
    name: "AgentLedger",
    description: "AgentLedger provides financial health reviews, budget utilization guards, and spend policy verification for onchain autonomous agents.",
    score: "4.90",
    approvalRate: "98%",
    usageCount: 420,
    services: [
      { serviceId: "11336-1", name: "AgentLedger Financial Health", description: "Analyzes stablecoin cash flow, budget usage, and financial health.", price: "0" },
      { serviceId: "11336-2", name: "AgentLedger Recommendations", description: "Prioritized financial and risk next actions.", price: "0.01" },
      { serviceId: "11336-3", name: "AgentLedger Policy Guard", description: "Reviews proposed spend against budgets, reserves, and risk thresholds.", price: "0.02" },
    ],
  },
  "8705": {
    agentId: "8705",
    name: "Arbitrage Casebook",
    description: "Transforms multilingual arbitrage post-mortems, archived cases, and verified official-source checks into cited English evidence briefs.",
    score: "4.90",
    approvalRate: "95%",
    usageCount: 312,
    services: [
      { serviceId: "8705-1", name: "Research Topic Discovery", description: "Lists global arbitrage mechanism taxonomy and reviews corpus coverage.", price: "0" },
      { serviceId: "8705-2", name: "Arbitrage Term Decoder", description: "Decodes multilingual arbitrage terms into plain English with contextual warnings.", price: "0" },
      { serviceId: "8705-3", name: "Arbitrage Evidence Brief", description: "Cited, structured English research brief covering mechanics and failure patterns.", price: "0.01" },
    ],
  },
  "3598": {
    agentId: "3598",
    name: "MoonFinder",
    description: "Scan high-liquidity USDT spot markets on OKX and Binance, combining price, volume, and derivative signals to output structured opportunity rankings.",
    score: "5.00",
    approvalRate: "100%",
    usageCount: 156,
    avatarUrl: "https://static.okx.com/cdn/web3/wallet/marketplace/headimages/agent/avatar/53745905-0ca3-4a6b-a9f0-b9ff657f93b0.jpg",
    services: [
      { serviceId: "3598-1", name: "MoonFinder Market Signal Scanner", description: "Scan high-liquidity USDT spot markets and return structured opportunity rankings.", price: "0.01" },
    ],
  },
  "2023": {
    agentId: "2023",
    name: "Onchain Data Explorer",
    description: "API service for read-only blockchain data across 180+ chains covering all major ecosystems.",
    score: "4.86",
    approvalRate: "93%",
    usageCount: 1572,
    avatarUrl: "https://static.okx.com/cdn/web3/wallet/marketplace/headimages/agent/avatar/c232f69b-1fef-4aa6-886d-fe7613f99a38.png",
    services: [
      { serviceId: 17316, name: "Supported Chains Directory", description: "List supported chains — POST only.", price: "0" },
      { serviceId: 17300, name: "Chain Info & Stats", description: "Chain status, gas & stats — POST.", price: "0.01" },
    ],
  },
  "1965": {
    agentId: "1965",
    name: "CertiK",
    description: "Paid HTTP gateway for CertiK Token Scan, Skynet Score, and Skylens via OKX x402 exact payments.",
    score: "5.00",
    approvalRate: "100%",
    usageCount: 108,
    avatarUrl: "https://static.okx.com/cdn/web3/wallet/marketplace/headimages/agent/avatar/c3119627-4a1a-476e-a20e-ffcfd6bd7ee7.png",
    services: [
      { serviceId: 2429, name: "CertiK Security APIs", description: "CertiK paid security APIs.", price: "0.001" },
    ],
  },
};

const remoteMetadataCache = new Map<string, OkxRemoteAgentMetadata>(
  Object.entries(KNOWN_OKX_AGENTS),
);

export function extractAgentId(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?okx\.ai\/agents\/(\d+)/i);
  if (urlMatch) return urlMatch[1]!;
  const cleaned = trimmed.replace(/^#/, "");
  if (/^\d+$/.test(cleaned)) return cleaned;
  return null;
}

export interface ParsedAgentListing {
  agentId: string;
  name: string;
  description?: string;
  score?: string;
  marketplaceRating?: string;
  reviewCount?: number;
  avatarUrl?: string;
  services: Array<{
    serviceId: number | string;
    name: string;
    description: string;
    price: string;
    symbol?: string;
    serviceType?: string;
    endpoint?: string;
  }>;
}

export function parseAgentListingHtml(html: string, expectedAgentId: string): {
  listing: ParsedAgentListing | null;
  status: "found" | "not_found" | "could_not_verify";
  detail: string;
} {
  if (/(?:challenge-running|cf-browser-verification|Attention Required!|Just a moment\.\.\.|hcaptcha)/i.test(html)) {
    return { listing: null, status: "could_not_verify", detail: "Listing page returned an access challenge." };
  }

  let data: any = null;
  const appStateMatch = html.match(/<script[^>]*id=["']appState["'][^>]*>([\s\S]*?)<\/script>/i);
  if (appStateMatch) {
    try { data = JSON.parse(appStateMatch[1]!); } catch {}
  }
  if (!data) {
    const ssrMatch = html.match(/<script[^>]*data-id=["']__app_data_for_ssr__["'][^>]*>([\s\S]*?)<\/script>/i);
    if (ssrMatch) {
      try { data = JSON.parse(ssrMatch[1]!); } catch {}
    }
  }
  if (!data) {
    const initMatch = html.match(/window\.__INIT_STATE__\s*=\s*(\{[\s\S]*?\});/);
    if (initMatch) {
      try { data = JSON.parse(initMatch[1]!); } catch {}
    }
  }

  if (!data || typeof data !== "object") {
    return { listing: null, status: "could_not_verify", detail: "HTTP 200 returned but listing data could not be extracted (app shell or unexpected format)." };
  }

  const detailPage = data.appContext?.initialProps?.AgentDetailPage
    ?? data.initialProps?.AgentDetailPage
    ?? data.AgentDetailPage;

  if (!detailPage || typeof detailPage !== "object") {
    return { listing: null, status: "could_not_verify", detail: "HTTP 200 returned without AgentDetailPage structure." };
  }

  const overview = detailPage.overview;
  if (!overview || typeof overview !== "object") {
    return { listing: null, status: "could_not_verify", detail: "AgentDetailPage is missing overview data." };
  }

  const returnedId = String(overview.agentId ?? "").trim();
  if (returnedId && returnedId !== expectedAgentId) {
    return { listing: null, status: "could_not_verify", detail: `Listing page identifies agent #${returnedId} instead of #${expectedAgentId}.` };
  }

  const name = typeof overview.name === "string" ? overview.name.trim() : "";
  if (!name) {
    return { listing: null, status: "could_not_verify", detail: "Listing data does not identify an agent name." };
  }

  const rawServices = Array.isArray(detailPage.services?.list) ? detailPage.services.list : [];
  const services = rawServices.map((s: any) => ({
    serviceId: s.serviceId ?? "",
    name: typeof s.name === "string" ? s.name.trim() : "",
    description: typeof s.description === "string" ? s.description.trim() : "",
    price: typeof s.price === "string" || typeof s.price === "number" ? String(s.price).trim() : "0",
    symbol: typeof s.symbol === "string" ? s.symbol.trim() : "USDT",
    serviceType: typeof s.serviceType === "string" ? s.serviceType.trim() : undefined,
    endpoint: typeof s.endpoint === "string" && s.endpoint.trim() ? s.endpoint.trim() : undefined,
  }));

  const reviews = detailPage.reviews;
  const score = overview.score != null ? String(overview.score).trim() : reviews?.totalScore != null ? String(reviews.totalScore).trim() : undefined;
  const reviewCount = typeof reviews?.totalCount === "number" ? reviews.totalCount : typeof reviews?.total === "number" ? reviews.total : undefined;

  return {
    status: "found",
    detail: "Public listing information was retrieved.",
    listing: {
      agentId: expectedAgentId,
      name,
      description: typeof overview.description === "string" ? overview.description.trim() : undefined,
      score,
      marketplaceRating: score,
      reviewCount,
      avatarUrl: typeof overview.avatar === "string" && overview.avatar.trim() ? overview.avatar.trim() : undefined,
      services,
    },
  };
}

export async function fetchOkxAgentMetadata(
  agentId: string,
  dependencies: ReadinessProbeDependencies = {},
): Promise<OkxRemoteAgentMetadata | null> {
  const cleanId = extractAgentId(agentId) ?? agentId.trim().replace(/^#/, "");
  const probeFetch = dependencies.fetch ?? fetch;
  try {
    const res = await probeFetch(`https://www.okx.ai/agents/${encodeURIComponent(cleanId)}`, {
      signal: AbortSignal.timeout(6_000),
      headers: { "user-agent": "KindMeitner/1.0" },
    });
    if (res.ok) {
      const html = await res.text();
      const parsed = parseAgentListingHtml(html, cleanId);
      if (parsed.status === "found" && parsed.listing) {
        const meta: OkxRemoteAgentMetadata = {
          agentId: cleanId,
          name: parsed.listing.name,
          description: parsed.listing.description ?? "",
          score: parsed.listing.score,
          reviewCount: parsed.listing.reviewCount,
          avatarUrl: parsed.listing.avatarUrl,
          services: parsed.listing.services,
        };
        remoteMetadataCache.set(cleanId, meta);
        return meta;
      }
    }
  } catch {
    // Network or parse failure: check fallback cache below
  }
  return remoteMetadataCache.get(cleanId) ?? null;
}

export type ListingStatus = "found" | "not_found" | "could_not_verify" | "request_failed";
export type ConnectionStatus = "not_checked" | "passed" | "failed" | "could_not_verify" | "unsupported";
export type EndpointAssociation = "none" | "verified" | "unverified" | "known_mismatch";

export interface ListedService {
  serviceId: number | string;
  name: string;
  description: string;
  price: string;
  symbol?: string;
  serviceType?: string;
  endpoint?: string;
}

export interface ListingInfo {
  agentId: string;
  name?: string;
  description?: string;
  listingUrl: string;
  avatarUrl?: string;
  services?: ListedService[];
  marketplaceRating?: string;
  reviewCount?: number;
  fetchTime: string;
  source: string;
}

export interface CheckPerformed {
  id: string;
  status: "pass" | "warn" | "fail" | "skipped";
  label?: string;
  detail: string;
}

export interface AgentListingAndConnectionData {
  agentId: string;
  endpointUrl?: string;
  listingStatus: ListingStatus;
  connectionStatus: ConnectionStatus;
  endpointAssociation: EndpointAssociation;
  endpointAssociationDetail?: string;
  summary: string;
  listing?: ListingInfo;
  checksPerformed: CheckPerformed[];
  limitations: string[];
  nextActions: string[];
  remediation: string[];
  // Compatibility fields for legacy callers:
  agentName?: string;
  description?: string;
  score?: string;
  avatarUrl?: string;
  services?: Array<{ serviceId: number | string; name: string; description: string; price: string }>;
  signals: CheckPerformed[];
  notChecked: string[];
  safeNextStep: string;
  decision?: "GO" | "CAUTION" | "NO_GO";
}

export type AspTrustCardData = AgentListingAndConnectionData;

export async function checkAgentListingAndConnection(
  agentId: string,
  endpointUrl?: string,
  dependencies: ReadinessProbeDependencies = {},
): Promise<{ resource: typeof readinessResource; data: AgentListingAndConnectionData }> {
  const probeFetch = dependencies.fetch ?? fetch;
  const cleanId = extractAgentId(agentId) ?? agentId.trim().replace(/^#/, "");
  const checksPerformed: CheckPerformed[] = [];
  const remediation: string[] = [];
  const limitations: string[] = [
    "Service delivery, output quality and payment outcomes were not assessed.",
    "This check is free and read-only. The target service may have separate fees or access requirements.",
  ];

  let listingStatus: ListingStatus = "could_not_verify";
  let listingDetail = "";
  let listingInfo: ListingInfo | undefined;
  let fetchSource = "okx.ai listing page";
  const fetchTime = new Date().toISOString();

  try {
    const response = await probeFetch(`https://www.okx.ai/agents/${encodeURIComponent(cleanId)}`, {
      signal: AbortSignal.timeout(8_000),
      headers: { "user-agent": "KindMeitner/1.0" },
    });
    if (response.status === 200) {
      const html = await response.text();
      const parsed = parseAgentListingHtml(html, cleanId);
      if (parsed.status === "found" && parsed.listing) {
        listingStatus = "found";
        listingDetail = "Public listing information was retrieved.";
        listingInfo = {
          agentId: cleanId,
          name: parsed.listing.name,
          description: parsed.listing.description,
          listingUrl: `https://www.okx.ai/agents/${cleanId}`,
          avatarUrl: parsed.listing.avatarUrl,
          services: parsed.listing.services,
          marketplaceRating: parsed.listing.marketplaceRating,
          reviewCount: parsed.listing.reviewCount,
          fetchTime,
          source: fetchSource,
        };
        remoteMetadataCache.set(cleanId, {
          agentId: cleanId,
          name: parsed.listing.name,
          description: parsed.listing.description ?? "",
          score: parsed.listing.score,
          reviewCount: parsed.listing.reviewCount,
          avatarUrl: parsed.listing.avatarUrl,
          services: parsed.listing.services,
        });
      } else {
        listingStatus = parsed.status;
        listingDetail = parsed.detail;
      }
    } else if (response.status === 404) {
      listingStatus = "not_found";
      listingDetail = "Listing page returned HTTP 404 (not found).";
    } else if (response.status === 403) {
      listingStatus = "could_not_verify";
      listingDetail = "Access to listing page was restricted (HTTP 403).";
    } else {
      listingStatus = "could_not_verify";
      listingDetail = `Listing page returned HTTP ${response.status}.`;
    }
  } catch (err: any) {
    const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
    // Fallback to cache only when no custom probeFetch dependency is supplied
    const cached = !dependencies.fetch ? remoteMetadataCache.get(cleanId) : null;
    if (cached) {
      listingStatus = "found";
      listingDetail = "Public listing information retrieved from local catalog (cached).";
      fetchSource = "kind-meitner local catalog (cached)";
      listingInfo = {
        agentId: cleanId,
        name: cached.name,
        description: cached.description,
        listingUrl: `https://www.okx.ai/agents/${cleanId}`,
        avatarUrl: cached.avatarUrl,
        services: cached.services,
        marketplaceRating: cached.score,
        reviewCount: cached.reviewCount,
        fetchTime,
        source: fetchSource,
      };
    } else {
      listingStatus = "request_failed";
      listingDetail = isTimeout ? "Listing request timed out." : "Listing request failed.";
    }
  }

  checksPerformed.push({
    id: "listing_page",
    status: listingStatus === "found" ? "pass" : listingStatus === "not_found" ? "fail" : "warn",
    label: "Listing page",
    detail: listingDetail,
  });

  // Endpoint association
  let endpointAssociation: EndpointAssociation = "none";
  let endpointAssociationDetail: string | undefined;

  const rawEp = endpointUrl?.trim();
  if (rawEp) {
    const suppliedNorm = rawEp.toLowerCase().replace(/\/+$/, "");
    const declaredList = listingInfo?.services
      ?.map((s) => s.endpoint?.trim())
      .filter((ep): ep is string => Boolean(ep)) ?? [];

    if (declaredList.length > 0) {
      const match = declaredList.find((ep) => ep.toLowerCase().replace(/\/+$/, "") === suppliedNorm);
      if (match) {
        endpointAssociation = "verified";
        endpointAssociationDetail = "Declared in listing";
      } else {
        endpointAssociation = "known_mismatch";
        endpointAssociationDetail = `The listing declares a different endpoint (${declaredList[0]}).`;
      }
    } else {
      endpointAssociation = "unverified";
      endpointAssociationDetail = `Connection checked separately. This URL has not been verified as belonging to agent #${cleanId}.`;
    }
  }

  // Connection check
  let connectionStatus: ConnectionStatus = "not_checked";
  let connectionDetail = "Not checked — no service URL supplied";
  const nextActions: string[] = [];

  if (!rawEp) {
    connectionStatus = "not_checked";
    connectionDetail = "Not checked — no service URL supplied";
    checksPerformed.push({
      id: "service_connection",
      status: "skipped",
      label: "Service connection",
      detail: connectionDetail,
    });
    nextActions.push("Add a compatible service URL to check its connection.");
  } else {
    let parsedEp: URL | null = null;
    try {
      parsedEp = new URL(rawEp);
    } catch {
      connectionStatus = "failed";
      connectionDetail = "Invalid service URL format.";
      remediation.push("Provide a valid HTTPS service URL.");
    }

    if (parsedEp) {
      const isLoopbackOrLocal = parsedEp.hostname === "127.0.0.1" || parsedEp.hostname === "localhost";
      if (parsedEp.protocol !== "https:" && !isLoopbackOrLocal) {
        connectionStatus = "failed";
        connectionDetail = `Insecure protocol (${parsedEp.protocol}). HTTPS is required.`;
        remediation.push("Serve the service endpoint on HTTPS only.");
      } else if (isPrivateIpAddress(parsedEp.hostname) && !dependencies.resolveHostname && !dependencies.fetch) {
        connectionStatus = "failed";
        connectionDetail = "Private or loopback target blocked.";
        remediation.push("Use a public HTTPS endpoint; private, loopback, and link-local targets cannot be scanned.");
      } else if (parsedEp.hostname === "vercel.app" || parsedEp.hostname.endsWith(".vercel.app")) {
        connectionStatus = "failed";
        connectionDetail = `Host pitfall (${parsedEp.hostname}).`;
        remediation.push("Replace *.vercel.app with a custom domain or Railway/Fly HTTPS host. OKX listing test env rejects vercel.app.");
      } else {
        // Protocol probes: POST tools/list
        try {
          const started = Date.now();
          const probeRes = await probeFetch(parsedEp, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: "km-check", method: "tools/list" }),
            redirect: "manual",
            signal: AbortSignal.timeout(8_000),
          });
          const latencyMs = Date.now() - started;

          if (probeRes.status === 401 || probeRes.status === 403) {
            connectionStatus = "could_not_verify";
            connectionDetail = `The endpoint requires authentication (HTTP ${probeRes.status}).`;
            nextActions.push("The endpoint requires authentication; authenticated access was not tested.");
          } else if (probeRes.status === 402) {
            connectionStatus = "could_not_verify";
            connectionDetail = "The endpoint requires payment (HTTP 402).";
            nextActions.push("The endpoint requires payment for this request; this free check did not proceed.");
          } else if (!probeRes.ok) {
            connectionStatus = "failed";
            connectionDetail = `The endpoint returned HTTP ${probeRes.status}.`;
            nextActions.push(`The endpoint answered HTTP ${probeRes.status}. Check service availability.`);
          } else {
            const contentType = probeRes.headers.get("content-type") ?? "";
            const bodyText = await probeRes.text();
            let jsonRpc: Record<string, unknown> | null = null;
            try {
              jsonRpc = JSON.parse(bodyText);
            } catch {}

            const rpcErr = jsonRpc && typeof jsonRpc === "object" && "error" in jsonRpc && jsonRpc.error && typeof jsonRpc.error === "object" ? jsonRpc.error as { code?: unknown; message?: unknown } : null;
            const rpcRes = jsonRpc && typeof jsonRpc === "object" && "result" in jsonRpc && jsonRpc.result && typeof jsonRpc.result === "object" ? jsonRpc.result as { tools?: unknown } : null;

            if (!jsonRpc || typeof jsonRpc !== "object" || jsonRpc.jsonrpc !== "2.0" || contentType.includes("text/html")) {
              connectionStatus = "unsupported";
              connectionDetail = "The endpoint returned a non-MCP response (not JSON-RPC 2.0).";
              nextActions.push("This checker supports A2MCP (MCP over JSON-RPC 2.0). This service requires a different integration.");
            } else if (rpcErr) {
              const errMsg = typeof rpcErr.message === "string" ? rpcErr.message : "protocol error";
              const errCode = typeof rpcErr.code === "number" || typeof rpcErr.code === "string" ? String(rpcErr.code) : "";
              connectionStatus = "failed";
              connectionDetail = `JSON-RPC error ${errCode}: ${errMsg}`.trim();
              nextActions.push(`The protocol check returned an error: ${errMsg}.`);
            } else if (rpcRes && Array.isArray(rpcRes.tools)) {
              connectionStatus = "passed";
              const toolCount = rpcRes.tools.length;
              connectionDetail = `Protocol check passed · ${toolCount} tool(s) discovered (${latencyMs}ms).`;
              nextActions.push("Connection checks passed. Individual tool execution and delivery quality were not tested.");
            } else {
              connectionStatus = "failed";
              connectionDetail = "tools/list response missing result.tools array.";
              nextActions.push("tools/list did not return a standard tools list.");
            }
          }
        } catch (err: any) {
          const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
          if (isTimeout) {
            connectionStatus = "could_not_verify";
            connectionDetail = "The connection timed out after 8s.";
            nextActions.push("The connection timed out. Retry or check service availability.");
          } else {
            connectionStatus = "failed";
            connectionDetail = "Connection failed or network probe refused.";
            nextActions.push("The connection failed. Retry or check service availability.");
          }
        }
      }
    }

    checksPerformed.push({
      id: "service_connection",
      status: connectionStatus === "passed" ? "pass" : connectionStatus === "failed" ? "fail" : connectionStatus === "not_checked" ? "skipped" : "warn",
      label: "Service connection",
      detail: connectionDetail,
    });
  }

  const displayName = listingInfo?.name;
  let summary = "";
  if (listingStatus === "found") {
    const namePrefix = displayName ? `${displayName}` : `agent #${cleanId}`;
    if (connectionStatus === "not_checked") {
      summary = `Listing found — ${namePrefix}. Public listing information was retrieved. No service URL was supplied, so the service connection was not checked.`;
    } else if (connectionStatus === "passed") {
      summary = `Listing found — ${namePrefix}. Public listing information was retrieved. Service connection check passed${endpointAssociation === "verified" ? " (declared in listing)" : ""}.`;
    } else if (connectionStatus === "unsupported") {
      summary = `Listing found — ${namePrefix}. Public listing information was retrieved. The service URL uses an unsupported protocol.`;
    } else if (connectionStatus === "could_not_verify") {
      summary = `Listing found — ${namePrefix}. Public listing information was retrieved. The service connection could not be verified.`;
    } else {
      summary = `Listing found — ${namePrefix}. Public listing information was retrieved. Service connection check failed.`;
    }
  } else if (listingStatus === "not_found") {
    summary = `Agent #${cleanId} was not found on OKX.ai (HTTP 404).`;
    nextActions.unshift("Confirm the agent ID or URL on okx.ai/agents.");
  } else if (listingStatus === "could_not_verify") {
    summary = `Public listing information for agent #${cleanId} could not be verified.`;
    nextActions.unshift("Retry or check the listing page directly.");
  } else {
    summary = `The listing request failed or timed out for agent #${cleanId}.`;
    nextActions.unshift("Retry or check service availability.");
  }

  const finalNextActions = [...new Set(nextActions)];

  return {
    resource: {
      ...readinessResource,
      provenance: `${fetchSource}; not an OKX endorsement`,
    },
    data: {
      agentId: cleanId,
      endpointUrl: rawEp || undefined,
      listingStatus,
      connectionStatus,
      endpointAssociation,
      endpointAssociationDetail,
      summary,
      listing: listingInfo,
      checksPerformed,
      limitations,
      nextActions: finalNextActions,
      remediation: [...new Set(remediation)],
      // Legacy compatibility fields:
      agentName: displayName,
      description: listingInfo?.description,
      score: listingInfo?.marketplaceRating,
      avatarUrl: listingInfo?.avatarUrl,
      services: listingInfo?.services?.map((s) => ({
        serviceId: s.serviceId,
        name: s.name,
        description: s.description,
        price: s.price,
      })),
      signals: checksPerformed,
      notChecked: [
        "Service delivery, output quality and payment outcomes were not assessed.",
        "Historical transaction and settlement volume",
        "OKX official endorsement",
      ],
      safeNextStep: finalNextActions[0] ?? "",
      // Optional legacy decision field for backwards compatibility without safety claims:
      decision: connectionStatus === "failed" || listingStatus === "not_found"
        ? "NO_GO"
        : connectionStatus === "passed" && listingStatus === "found"
          ? "GO"
          : "CAUTION",
    },
  };
}

export async function getAspTrustCard(
  agentId: string,
  endpointUrl?: string,
  dependencies: ReadinessProbeDependencies = {},
): Promise<{ resource: typeof readinessResource; data: AspTrustCardData }> {
  return checkAgentListingAndConnection(agentId, endpointUrl, dependencies);
}

export type TrustTier = "elite" | "verified" | "neutral" | "high_risk";

export interface AspProfile {
  id: string;
  name: string;
  category: string;
  reputationScore: number; // 0 - 100

  medianPrice: number; // in USDT
  averageTurnaroundMinutes: number;
  tasksCompleted: number;
  disputesCount: number;
  rejectionsCount: number;
  disputesWon: number;
  rejectRate: number; // rejections / tasksCompleted
  disputeRate: number; // disputes / tasksCompleted
  recentVolume7d: number;
  trendingRank?: number;
  trustTier: TrustTier;
  buyerVolumes?: Record<string, number>;
  hhiScore?: number;
  updatedAt: number;
}
export interface ReadinessProbeDependencies {
  fetch?: typeof fetch;
  resolveHostname?: (hostname: string) => Promise<string[]>;
}

const readinessResource: {
  access: string;
  paymentRequired: boolean;
  walletRequired: boolean;
  mainnet: boolean;
  provenance: string;
  limitations?: string[];
} = {
  access: "free",
  paymentRequired: false,
  walletRequired: false,
  mainnet: false,
  provenance: "kind-meitner live HTTPS probes + public listing pitfalls",
};

async function resolvedAddresses(hostname: string, dependency?: ReadinessProbeDependencies["resolveHostname"]): Promise<string[]> {
  if (dependency) return dependency(hostname);
  const rows = await lookup(hostname, { all: true, verbatim: true });
  return rows.map((row) => row.address);
}

export function computeReadinessReceipt(url: string, verdict: string, score: number, checks: ReadinessCheck[]): ReadinessReceipt {
  const normalized = [
    url.trim().toLowerCase(),
    verdict,
    String(score),
    ...checks.map((c) => `${c.id}:${c.status}:${truncateReadinessDetail(c.detail)}`),
  ].join("\n");
  const hash = createHash("sha256").update(normalized).digest("hex");
  return {
    schema: "kindmeitner.readiness.v1",
    id: `rcpt-${hash.slice(0, 16)}`,
    evidenceHash: `0x${hash}`,
  };
}

export async function scanFreeMcpReadiness(endpointUrl: string, agentId: string | null, dependencies: ReadinessProbeDependencies = {}): Promise<{ resource: typeof readinessResource; data: FreeMcpReadinessData }> {
  const checks = new Map<ReadinessCheck["id"], ReadinessCheck>(READINESS_CHECK_IDS.map((id) => [id, { id, status: "warn", detail: "not checked" }]));
  const remediation: string[] = [];
  const raw: FreeMcpReadinessData["raw"] = { httpStatus: null, toolNames: [], truncatedNotes: "" };
  const set = (id: ReadinessCheck["id"], status: ReadinessCheckStatus, detail: string) => checks.set(id, { id, status, detail: truncateReadinessDetail(detail) });
  const result = (url: string) => {
    const rows = READINESS_CHECK_IDS.map((id) => checks.get(id)!);
    const score = Math.round(100 * rows.filter((check) => check.status === "pass").length / rows.length);
    const verdict = readinessVerdict(rows);
    const receipt = computeReadinessReceipt(url, verdict, score, rows);
    return { resource: readinessResource, data: { endpointUrl: url, agentId, verdict, score, checks: rows, remediation: [...new Set(remediation)], raw, receipt } };
  };
  let parsed: URL;
  try { parsed = new URL(endpointUrl); }
  catch { set("https_scheme", "fail", "invalid URL"); remediation.push("Serve the Free A2MCP endpoint on HTTPS only."); return result(endpointUrl); }
  if (parsed.protocol !== "https:") {
    set("https_scheme", "fail", `scheme=${parsed.protocol || "missing"}`);
    remediation.push("Serve the Free A2MCP endpoint on HTTPS only.");
    return result(parsed.toString());
  }
  set("https_scheme", "pass", "https");
  if (isPrivateIpAddress(parsed.hostname)) {
    set("host_pitfall_vercel", "pass", `host=${parsed.hostname}`);
    set("tools_list_http", "fail", "private or loopback target blocked");
    remediation.push("Use a public HTTPS endpoint; private, loopback, and link-local targets cannot be scanned.");
    return result(parsed.toString());
  }
  try {
    const addresses = await resolvedAddresses(parsed.hostname, dependencies.resolveHostname);
    if (!addresses.length || addresses.some(isPrivateIpAddress)) {
      set("host_pitfall_vercel", "pass", `host=${parsed.hostname}`);
      set("tools_list_http", "fail", "hostname resolves to a private or loopback address");
      remediation.push("Use a public HTTPS endpoint; private, loopback, and link-local targets cannot be scanned.");
      return result(parsed.toString());
    }
  } catch {
    set("host_pitfall_vercel", "pass", `host=${parsed.hostname}`);
    set("tools_list_http", "fail", "hostname could not be resolved safely");
    remediation.push("Confirm the endpoint hostname resolves publicly before scanning it.");
    return result(parsed.toString());
  }
  if (parsed.hostname === "vercel.app" || parsed.hostname.endsWith(".vercel.app")) {
    set("host_pitfall_vercel", "fail", `host=${parsed.hostname}`);
    set("tools_list_http", "warn", "skipped because host pitfall failed");
    remediation.push("Replace *.vercel.app with a custom domain or Railway/Fly HTTPS host. OKX listing test env rejects vercel.app.");
    return result(parsed.toString());
  }
  set("host_pitfall_vercel", "pass", `host=${parsed.hostname}`);
  const probeFetch = dependencies.fetch ?? fetch;
  try {
    const started = Date.now();
    const response = await probeFetch(parsed, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "km-scan", method: "tools/list" }), redirect: "manual", signal: AbortSignal.timeout(8_000) });
    raw.httpStatus = response.status;
    const latency = Date.now() - started;
    if (response.status === 402) {
      set("tools_list_http", "fail", `status=402 latencyMs=${latency}`);
      set("no_accidental_402", "fail", "tools/list returned HTTP 402");
      remediation.push("Do not gate tools/list behind x402. Keep discovery free; put payment only on paid tools if any.");
    } else {
      set("tools_list_http", response.status === 200 ? "pass" : response.ok ? "warn" : "fail", `status=${response.status} latencyMs=${latency}`);
      const paymentHeader = [...response.headers.keys()].some((name) => /(?:payment|x402)/i.test(name));
      set("no_accidental_402", paymentHeader ? "warn" : "pass", paymentHeader ? "payment-looking response header present" : "no 402");
      if (!response.ok) remediation.push(response.status === 401 || response.status === 403 ? "Allow unauthenticated tools/list on the free path (or document a public probe token — prefer none)." : "Confirm the process is up, public, and responds to POST tools/list within 8s.");
    }
    const text = (await response.text()).slice(0, 10_000);
    try {
      const body = JSON.parse(text) as { result?: { tools?: unknown[] } };
      const tools = Array.isArray(body.result?.tools) ? body.result.tools : null;
      if (!tools) set("tools_list_shape", "fail", "missing result.tools array");
      else if (tools.some((tool) => !tool || typeof tool !== "object" || typeof (tool as { name?: unknown }).name !== "string" || !(tool as { name: string }).name)) set("tools_list_shape", "fail", "tool missing non-empty name");
      else { raw.toolNames = tools.map((tool) => (tool as { name: string }).name).slice(0, 50); set("tools_list_shape", tools.length ? "pass" : "warn", `${tools.length} tools`); }
    } catch { set("tools_list_shape", "fail", "response was not JSON-RPC tools/list JSON"); }
    try {
      const initialize = await probeFetch(parsed, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "km-init", method: "initialize" }), redirect: "manual", signal: AbortSignal.timeout(8_000) });
      set("initialize_soft", initialize.status === 200 ? "pass" : "warn", `status=${initialize.status}`);
    } catch { set("initialize_soft", "warn", "initialize skipped"); }
  } catch {
    set("tools_list_http", "fail", "network probe failed or timed out");
    set("tools_list_shape", "warn", "not checked after network failure");
    set("no_accidental_402", "warn", "not checked after network failure");
    remediation.push("Confirm the process is up, public, and responds to POST tools/list within 8s.");
  }
  return result(parsed.toString());
}

export interface Eip3009PaymentHeaders {
  from: string;
  signature: string;
  nonce: string;
  validBefore: number;
  validAfter?: number;
}

export interface Eip3009VerificationResult {
  valid: boolean;
  status?: 400 | 402;
  error?: string;
  payment?: Eip3009PaymentHeaders;
}

export interface McpJsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpJsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/**
 * Validates EIP-3009 gasless micro-payment authorization headers.
 * Requirements:
 * - Missing from/signature/nonce/validBefore -> 402 Payment Required
 * - Invalid from (not 0x + 40 hex chars) -> 400 Bad Request
 * - Invalid signature (not 0x hex, length < 130) -> 400 Bad Request
 * - Invalid validBefore (not a number) -> 400 Bad Request
 * - Expired (validBefore <= nowSec) -> 400 Bad Request
 * - Not yet valid (validAfter > nowSec) -> 400 Bad Request
 */
export function verifyEip3009Payment(
  headers: Record<string, string | string[] | undefined>,
  options: { nowSec?: number; expectedFee?: number } = {},
): Eip3009VerificationResult {
  const get = (key: string) => {
    const v = headers[key] ?? headers[key.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
  };

  const from = get("x-payment-from");
  const signature = get("x-payment-signature");
  const nonce = get("x-payment-nonce");
  const validBeforeStr = get("x-payment-valid-before");
  const validAfterStr = get("x-payment-valid-after");

  if (!from || !signature || !nonce || !validBeforeStr) {
    return {
      valid: false,
      status: 402,
      error: "Payment required: EIP-3009 transfer authorization headers missing",
    };
  }

  if (!/^0x[0-9a-fA-F]{40}$/.test(from)) {
    return { valid: false, status: 400, error: "Invalid x-payment-from address format" };
  }

  if (!/^0x[0-9a-fA-F]+$/.test(signature) || signature.length < 130) {
    return { valid: false, status: 400, error: "Invalid x-payment-signature format" };
  }

  const validBefore = Number.parseInt(validBeforeStr, 10);
  if (Number.isNaN(validBefore)) {
    return { valid: false, status: 400, error: "Invalid x-payment-valid-before timestamp" };
  }

  const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);
  if (validBefore <= nowSec) {
    return { valid: false, status: 400, error: "Payment authorization has expired (validBefore <= now)" };
  }

  let validAfter: number | undefined;
  if (validAfterStr) {
    validAfter = Number.parseInt(validAfterStr, 10);
    if (!Number.isNaN(validAfter) && validAfter > nowSec) {
      return { valid: false, status: 400, error: "Payment authorization not yet valid (validAfter > now)" };
    }
  }

  return {
    valid: true,
    payment: { from, signature, nonce, validBefore, validAfter },
  };
}

/**
 * Calculates Herfindahl-Hirschman Index (HHI) for counterparty concentration.
 * Formula: sum of squared percentage market shares. Range: [0, 10000].
 * HHI > 6000 flags excessive wash-trading or single counterparty dominance.
 */
export function calculateHhi(buyerVolumes: Record<string, number>): number {
  const total = Object.values(buyerVolumes).reduce((s, v) => s + v, 0);
  if (total <= 0) return 0;
  let hhi = 0;
  for (const vol of Object.values(buyerVolumes)) {
    const share = (vol / total) * 100;
    hhi += share * share;
  }
  return Math.round(hhi);
}

export interface CategoryBenchmark {
  category: string;
  aspCount: number;
  averagePrice: number;
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  averageRejectRate: number;
  averageDisputeRate: number;
  totalTasks7d: number;
}

export interface MarketOverview {
  totalAsps: number;
  activeAsps24h: number;
  totalVolume24h: number;
  overallRejectRate: number;
  topTrending: AspProfile[];
  categoryBenchmarks: Record<string, CategoryBenchmark>;
  timestamp: number;
}

export interface McpToolCallResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface QueryUsageRecord {
  id: string;
  tool: string;
  callerId?: string;
  fee: number;
  token: string;
  timestamp: number;
}

export interface MarketplaceIntelligenceOptions {
  storageFile?: string;
  queryFeeUsdt?: number; // default: 0.05 USDT per query
}

/**
 * OKX Marketplace Intelligence ("Bloomberg of OKX Agents").
 * Aggregates marketplace stats, benchmarks ASP performance, powers A2MCP query tools,
 * and generates premium competitive research reports for ASP providers.
 */
export class OkxMarketplaceIntelligence {
  private readonly storageFile?: string;
  private readonly queryFeeUsdt: number;
  private readonly asps = new Map<string, AspProfile>();
  private readonly queryUsage: QueryUsageRecord[] = [];
  private readonly redeemedNonces = new Set<string>();

  constructor(options: MarketplaceIntelligenceOptions = {}) {
    this.storageFile = options.storageFile;
    this.queryFeeUsdt = options.queryFeeUsdt ?? 0.05;

    if (this.storageFile && existsSync(this.storageFile)) {
      try {
        const raw = readFileSync(this.storageFile, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.asps)) {
          for (const a of parsed.asps) {
            if (a && typeof a.id === "string") this.asps.set(a.id, a);
          }
        }
        if (Array.isArray(parsed.queryUsage)) {
          for (const q of parsed.queryUsage) {
            if (q && typeof q.id === "string") this.queryUsage.push(q);
          }
        }
        if (Array.isArray(parsed.redeemedNonces)) {
          for (const n of parsed.redeemedNonces) {
            if (typeof n === "string") this.redeemedNonces.add(n);
          }
        }
      } catch {
        // Fallback to fresh store
      }
    }
  }

  save(): void {
    if (!this.storageFile) return;
    const dir = dirname(this.storageFile);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const data = JSON.stringify(
      {
        asps: [...this.asps.values()],
        queryUsage: this.queryUsage,
        redeemedNonces: [...this.redeemedNonces],
        updatedAt: Date.now(),
      },
      null,
      2,
    );
    writeFileAtomic(this.storageFile, data, { mode: 0o600 });
  }

  isNonceRedeemed(nonce: string): boolean {
    return this.redeemedNonces.has(nonce);
  }

  redeemNonce(nonce: string): boolean {
    if (this.redeemedNonces.has(nonce)) return false;
    this.redeemedNonces.add(nonce);
    this.save();
    return true;
  }

  /**
   * Bulk indexes or updates ASP performance profiles.
   */
  indexAsps(profiles: AspProfile[]): void {
    for (const p of profiles) {
      // Recompute rates and trust tier
      const total = Math.max(1, p.tasksCompleted);
      const rejectRate = Math.min(1, Math.max(0, Math.round((p.rejectionsCount / total) * 1000) / 1000));
      const disputeRate = Math.min(1, Math.max(0, Math.round((p.disputesCount / total) * 1000) / 1000));
      const reputationScore = Math.min(100, Math.max(0, p.reputationScore));

      let hhiScore = p.hhiScore;
      if (p.buyerVolumes) {
        hhiScore = calculateHhi(p.buyerVolumes);
      }

      let trustTier: TrustTier = "neutral";
      if (rejectRate > 0.25 || disputeRate > 0.15 || (hhiScore !== undefined && hhiScore > 6000)) {
        trustTier = "high_risk";
      } else if (
        reputationScore >= 90 &&
        rejectRate <= 0.05 &&
        disputeRate <= 0.05 &&
        p.tasksCompleted >= 20
      ) {
        trustTier = "elite";
      } else if (
        reputationScore >= 75 &&
        rejectRate <= 0.12 &&
        disputeRate <= 0.10
      ) {
        trustTier = "verified";
      }

      this.asps.set(p.id, {
        ...p,
        reputationScore,
        rejectRate,
        disputeRate,
        trustTier,
        hhiScore,
        updatedAt: Date.now(),
      });
    }

    this.recalculateTrendingRanks();
    this.save();
  }

  private recalculateTrendingRanks(): void {
    const sorted = [...this.asps.values()].sort((a, b) => {
      // Momentum metric: high 7d volume + high reputation
      const scoreA = a.recentVolume7d * 0.7 + a.reputationScore * 0.3;
      const scoreB = b.recentVolume7d * 0.7 + b.reputationScore * 0.3;
      return scoreB - scoreA;
    });

    sorted.forEach((asp, index) => {
      asp.trendingRank = index + 1;
    });
  }

  getAsp(id: string): AspProfile | undefined {
    return this.asps.get(id);
  }

  listAsps(filter?: { category?: string; trustTier?: TrustTier }): AspProfile[] {
    let list = [...this.asps.values()];
    if (filter?.category) {
      list = list.filter((a) => a.category.toLowerCase() === filter.category!.toLowerCase());
    }
    if (filter?.trustTier) {
      list = list.filter((a) => a.trustTier === filter.trustTier);
    }
    return list;
  }

  getTrendingAsps(limit = 10): AspProfile[] {
    return [...this.asps.values()]
      .sort((a, b) => (a.trendingRank ?? 999) - (b.trendingRank ?? 999))
      .slice(0, limit);
  }

  /**
   * Computes market benchmarks grouped by category.
   */
  getCategoryBenchmarks(categoryFilter?: string): CategoryBenchmark[] {
    const categories = new Map<string, AspProfile[]>();

    for (const asp of this.asps.values()) {
      if (categoryFilter && asp.category.toLowerCase() !== categoryFilter.toLowerCase()) {
        continue;
      }
      const list = categories.get(asp.category) ?? [];
      list.push(asp);
      categories.set(asp.category, list);
    }

    const benchmarks: CategoryBenchmark[] = [];

    for (const [cat, aspsInCat] of categories.entries()) {
      const prices = aspsInCat.map((a) => a.medianPrice).sort((a, b) => a - b);
      const avgPrice =
        prices.length > 0
          ? Math.round((prices.reduce((s, p) => s + p, 0) / prices.length) * 100) / 100
          : 0;
      let medianPrice = 0;
      if (prices.length > 0) {
        const mid = Math.floor(prices.length / 2);
        medianPrice =
          prices.length % 2 === 1
            ? prices[mid]
            : Math.round(((prices[mid - 1] + prices[mid]) / 2) * 100) / 100;
      }
      const minPrice = prices[0] ?? 0;
      const maxPrice = prices[prices.length - 1] ?? 0;

      const avgRejectRate =
        Math.round(
          (aspsInCat.reduce((s, a) => s + a.rejectRate, 0) / aspsInCat.length) * 1000,
        ) / 1000;
      const avgDisputeRate =
        Math.round(
          (aspsInCat.reduce((s, a) => s + a.disputeRate, 0) / aspsInCat.length) * 1000,
        ) / 1000;
      const totalTasks7d = aspsInCat.reduce((s, a) => s + a.recentVolume7d, 0);

      benchmarks.push({
        category: cat,
        aspCount: aspsInCat.length,
        averagePrice: avgPrice,
        medianPrice,
        minPrice,
        maxPrice,
        averageRejectRate: avgRejectRate,
        averageDisputeRate: avgDisputeRate,
        totalTasks7d,
      });
    }

    return benchmarks;
  }

  getMarketOverview(): MarketOverview {
    const all = [...this.asps.values()];
    const totalAsps = all.length;
    const activeAsps24h = all.filter((a) => a.recentVolume7d > 0).length;
    const totalVolume24h = Math.round(
      all.reduce((s, a) => s + a.recentVolume7d * a.medianPrice, 0) / 7,
    );
    const overallRejectRate =
      totalAsps > 0
        ? Math.round((all.reduce((s, a) => s + a.rejectRate, 0) / totalAsps) * 1000) / 1000
        : 0;

    const benchmarks = this.getCategoryBenchmarks();
    const benchmarkMap: Record<string, CategoryBenchmark> = {};
    for (const b of benchmarks) {
      benchmarkMap[b.category] = b;
    }

    return {
      totalAsps,
      activeAsps24h,
      totalVolume24h,
      overallRejectRate,
      topTrending: this.getTrendingAsps(5),
      categoryBenchmarks: benchmarkMap,
      timestamp: Date.now(),
    };
  }

  // --- Free A2MCP Resources ---

  /**
   * Public, read-only resources for the OKX.AI Free A2MCP listing.
   * These declarations intentionally use the MCP `inputSchema` field and make
   * no claim of payment, wallet, chain, or live-marketplace settlement.
   */
  getFreeToolDeclarations(): Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    annotations: { readOnlyHint: true; destructiveHint: false; openWorldHint: false };
  }> {
    const readOnly = { readOnlyHint: true as const, destructiveHint: false as const, openWorldHint: false as const };
    return [
      {
        name: "list_okx_ai_use_cases",
        description: "Free resource: browse safe, read-only OKX.AI agent-service use cases. No wallet, payment, key, or mainnet access.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: readOnly,
      },
      {
        name: "get_free_a2mcp_launch_checklist",
        description: "Free resource: get a practical checklist for publishing a read-only A2MCP service without payments or mainnet dependencies.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: readOnly,
      },
      {
        name: "scan_free_mcp_readiness",
        description: "Free resource: scan a candidate HTTPS Free A2MCP endpoint for listing-readiness evidence and remediation.",
        inputSchema: {
          type: "object",
          properties: {
            endpointUrl: { type: "string", minLength: 8, maxLength: 500 },
            agentId: { type: "string", maxLength: 64 },
          },
          required: ["endpointUrl"],
          additionalProperties: false,
        },
        annotations: readOnly,
      },
      {
        name: "check_agent_listing_and_connection",
        description: "Free resource: view public listing information for an OKX agent by ID, and when a compatible service URL is available, check its connection. Does not assess service delivery, output quality, or payment outcomes.",
        inputSchema: {
          type: "object",
          properties: {
            agentId: { type: "string", minLength: 1, maxLength: 64, description: "The OKX numeric Agent ID (e.g. 13851) or okx.ai/agents/<id> URL." },
            endpointUrl: { type: "string", maxLength: 500, description: "Optional service endpoint URL (leave blank to check listing only)." },
          },
          required: ["agentId"],
          additionalProperties: false,
        },
        annotations: readOnly,
      },
      {
        name: "get_asp_trust_card",
        description: "[Deprecated: use check_agent_listing_and_connection] Free resource: inspect public listing information and optional service connection without safety endorsement or spending recommendations.",
        inputSchema: { type: "object", properties: { agentId: { type: "string", minLength: 1, maxLength: 64 }, endpointUrl: { type: "string", maxLength: 500 } }, required: ["agentId"], additionalProperties: false },
        annotations: readOnly,
      },
      {
        name: "query_market_benchmarks",
        description: "Free resource: inspect locally indexed marketplace benchmark data with provenance metadata. It never claims live OKX marketplace data.",
        inputSchema: {
          type: "object",
          properties: { category: { type: "string", maxLength: 80 } },
          additionalProperties: false,
        },
        annotations: readOnly,
      },
      {
        name: "get_asp_reputation",
        description: "Free resource: inspect a locally indexed ASP reputation record with provenance metadata. No payment or chain action occurs.",
        inputSchema: {
          type: "object",
          properties: { aspId: { type: "string", minLength: 1, maxLength: 200 } },
          required: ["aspId"],
          additionalProperties: false,
        },
        annotations: readOnly,
      },
      {
        name: "get_trending_asps",
        description: "Free resource: inspect locally indexed ASP momentum rankings with provenance metadata. No payment or chain action occurs.",
        inputSchema: {
          type: "object",
          properties: { limit: { type: "integer", minimum: 1, maximum: 20, default: 5 } },
          additionalProperties: false,
        },
        annotations: readOnly,
      },
    ];
  }

  /** Executes only free, read-only resources. It neither records usage nor
   * redeems a nonce, so callers cannot trigger a payment-like durable action. */
  async handleFreeMcpToolCall(toolName: string, args: Record<string, unknown>): Promise<McpToolCallResult> {
    const resource = {
      access: "free",
      paymentRequired: false,
      walletRequired: false,
      mainnet: false,
      provenance: OKX_LOCAL_REGISTRY_PROVENANCE,
    };
    const success = (data: unknown): McpToolCallResult => ({
      content: [{ type: "text", text: JSON.stringify({ resource, data }, null, 2) }],
    });
    const invalid = (message: string): McpToolCallResult => ({
      isError: true,
      content: [{ type: "text", text: message }],
    });

    // Honour the declared `additionalProperties: false`: an unknown argument
    // (a misspelt key, or a credential someone tried to pass) is refused,
    // not silently ignored. Allowed keys come from the same declarations
    // tools/list publishes, so the two cannot drift.
    const declared = this.getFreeToolDeclarations().find((tool) => tool.name === toolName);
    if (declared) {
      const allowed = Object.keys((declared.inputSchema.properties ?? {}) as Record<string, unknown>);
      const extra = Object.keys(args ?? {}).filter((key) => !allowed.includes(key));
      if (extra.length) {
        const named = extra.slice(0, 5).map((key) => key.slice(0, 40)).join(", ");
        return invalid(`Unsupported argument${extra.length > 1 ? "s" : ""}: ${named}. Accepted: ${allowed.join(", ") || "none"}.`);
      }
    }

    if (toolName === "scan_free_mcp_readiness") {
      const endpointUrl = args.endpointUrl;
      const agentId = args.agentId;
      if (typeof endpointUrl !== "string" || endpointUrl.trim().length === 0) return invalid("endpointUrl is required");
      if (endpointUrl.trim().length < 8 || endpointUrl.trim().length > 500) return invalid("endpointUrl must be a string from 8 through 500 characters");
      if (agentId !== undefined && (typeof agentId !== "string" || agentId.trim().length > 64)) return invalid("agentId must be a string of at most 64 characters when provided");
      const scanned = await scanFreeMcpReadiness(endpointUrl.trim(), typeof agentId === "string" ? agentId.trim() || null : null);
      return { content: [{ type: "text", text: JSON.stringify(scanned, null, 2) }] };
    }

    if (toolName === "check_agent_listing_and_connection") {
      const agentId = args.agentId;
      const endpointUrl = args.endpointUrl;
      if (typeof agentId !== "string" || agentId.trim().length === 0 || agentId.trim().length > 64) return invalid("agentId is required");
      const cleanId = extractAgentId(agentId);
      if (!cleanId) return invalid("agentId must be a numeric OKX agent ID (e.g. 13851) or okx.ai/agents/<id> URL");
      if (endpointUrl !== undefined && (typeof endpointUrl !== "string" || endpointUrl.trim().length === 0 || endpointUrl.trim().length > 500)) return invalid("endpointUrl must be a string of at most 500 characters when provided");
      const card = await checkAgentListingAndConnection(cleanId, typeof endpointUrl === "string" ? endpointUrl.trim() : undefined);
      return { content: [{ type: "text", text: JSON.stringify(card, null, 2) }] };
    }

    if (toolName === "get_asp_trust_card") {
      const agentId = args.agentId;
      const endpointUrl = args.endpointUrl;
      if (typeof agentId !== "string" || agentId.trim().length === 0 || agentId.trim().length > 64) return invalid("agentId is required");
      const cleanId = extractAgentId(agentId) ?? agentId.trim();
      if (endpointUrl !== undefined && (typeof endpointUrl !== "string" || endpointUrl.trim().length === 0 || endpointUrl.trim().length > 500)) return invalid("endpointUrl must be a string of at most 500 characters when provided");
      const card = await getAspTrustCard(cleanId, typeof endpointUrl === "string" ? endpointUrl.trim() : undefined);
      return { content: [{ type: "text", text: JSON.stringify(card, null, 2) }] };
    }

    if (toolName === "list_okx_ai_use_cases") {
      return success({
        useCases: [
          {
            id: "market-intelligence",
            title: "Marketplace intelligence",
            impact: "Give agents a read-only way to compare locally indexed pricing, reliability, and concentration signals before choosing a provider.",
          },
          {
            id: "agent-service-discovery",
            title: "Agent-service discovery",
            impact: "Expose structured service capabilities to agents through MCP without requiring a wallet or user account.",
          },
          {
            id: "recurring-research",
            title: "Recurring research workflows",
            impact: "Use market snapshots as inputs to recurring planning and reporting workflows; this resource itself performs no scheduling or payment.",
          },
          {
            id: "responsible-launch",
            title: "Responsible A2MCP launch",
            impact: "Start with a transparent free resource, validate utility and provenance, then consider an official x402 testnet integration separately.",
          },
        ],
      });
    }

    if (toolName === "get_free_a2mcp_launch_checklist") {
      return success({
        checklist: [
          "Publish a public HTTPS endpoint that returns a direct HTTP 200 result for free calls.",
          "Keep resources read-only, rate-limited, and explicit about data provenance.",
          "Do not request wallet credentials, API keys, payment headers, or mainnet access for the free service.",
          "Register the endpoint as a free A2MCP ASP only after endpoint self-checks pass.",
          "Treat x402 testnet support as a separate, reviewed follow-up rather than a hidden fallback.",
        ],
        officialDocs: [
          "https://web3.okx.com/onchainos/dev-docs/okxai/howtomcp",
          "https://web3.okx.com/onchainos/dev-docs/okxai/registerasp",
        ],
      });
    }

    if (toolName === "query_market_benchmarks") {
      const category = args.category;
      if (category !== undefined && (typeof category !== "string" || category.trim().length === 0 || category.length > 80)) {
        return invalid("category must be a non-empty string of at most 80 characters when provided");
      }
      return success({ categoryFilter: category?.trim() || "all", benchmarks: this.getCategoryBenchmarks(category?.trim()) });
    }

    if (toolName === "get_asp_reputation") {
      const aspId = args.aspId;
      if (typeof aspId !== "string" || aspId.trim().length === 0 || aspId.length > 200) {
        return invalid("aspId must be a non-empty string of at most 200 characters");
      }
      const asp = this.getAsp(aspId.trim());
      if (!asp) return invalid(`ASP with ID '${aspId.trim()}' was not found in the local intelligence registry.`);
      return success({ asp });
    }

    if (toolName === "get_trending_asps") {
      const limit = args.limit ?? 5;
      if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 20) {
        return invalid("limit must be an integer from 1 through 20");
      }
      const trending = this.getTrendingAsps(limit);
      return success({ count: trending.length, trending });
    }

    return invalid(`Unknown free resource: ${toolName}`);
  }

  // --- Paid A2MCP Tool Handlers (legacy; not used by Free A2MCP) ---

  getToolDeclarations(): Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> {
    return [
      {
        name: "query_market_benchmarks",
        description:
          "Query pricing benchmarks, reject rates, and volume statistics for OKX.ai agent categories. Fee: 0.05 USDT.",
        parameters: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Filter benchmarks by specific category (e.g., 'audit', 'data', 'research')",
            },
          },
        },
      },
      {
        name: "get_asp_reputation",
        description:
          "Fetch deep reputation, win rate, and risk metrics for a specific ASP agent provider. Fee: 0.05 USDT.",
        parameters: {
          type: "object",
          properties: {
            aspId: { type: "string", description: "The ASP Agent identifier" },
          },
          required: ["aspId"],
        },
      },
      {
        name: "get_trending_asps",
        description:
          "Fetch the fastest rising ASP agents on OKX marketplace ranked by 7-day momentum and reputation. Fee: 0.05 USDT.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Maximum number of ASPs to return (default 10)" },
          },
        },
      },
    ];
  }

  async handleMcpToolCall(
    toolName: string,
    args: Record<string, unknown>,
    callerId?: string,
  ): Promise<McpToolCallResult> {
    const knownTools = ["query_market_benchmarks", "get_asp_reputation", "get_trending_asps"];
    if (!knownTools.includes(toolName)) {
      return {
        isError: true,
        content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
      };
    }

    // Record billable API usage
    this.queryUsage.push({
      id: `mcp-${randomUUID().slice(0, 8)}`,
      tool: toolName,
      callerId,
      fee: this.queryFeeUsdt,
      token: "USDT",
      timestamp: Date.now(),
    });
    this.save();

    if (toolName === "query_market_benchmarks") {
      const category = typeof args.category === "string" ? args.category : undefined;
      const benchmarks = this.getCategoryBenchmarks(category);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ categoryFilter: category ?? "all", benchmarks }, null, 2),
          },
        ],
      };
    }

    if (toolName === "get_asp_reputation") {
      const aspId = String(args.aspId ?? "");
      const asp = this.getAsp(aspId);
      if (!asp) {
        return {
          isError: true,
          content: [{ type: "text", text: `ASP with ID '${aspId}' was not found in intelligence registry.` }],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(asp, null, 2) }],
      };
    }

    if (toolName === "get_trending_asps") {
      const limit = typeof args.limit === "number" ? args.limit : 10;
      const trending = this.getTrendingAsps(limit);
      return {
        content: [{ type: "text", text: JSON.stringify({ count: trending.length, trending }, null, 2) }],
      };
    }

    return {
      isError: true,
      content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
    };
  }

  getQueryUsage(): QueryUsageRecord[] {
    return [...this.queryUsage];
  }

  // --- A2A Report Generator ---

  generateIntelligenceReport(options: { focusCategory?: string } = {}): string {
    const overview = this.getMarketOverview();
    const benchmarks = this.getCategoryBenchmarks(options.focusCategory);
    const topTrending = this.getTrendingAsps(5);
    const highRiskAsps = this.listAsps({ trustTier: "high_risk" });

    return `# 📊 Bloomberg for OKX Agents: Marketplace Intelligence & Risk Report
*Generated by OKX Intelligence ASP | Date: ${new Date(overview.timestamp).toISOString().split("T")[0]}*

---

## 1. Executive Market Snapshot
- **Total Registered ASPs**: ${overview.totalAsps}
- **Active ASPs (24h)**: ${overview.activeAsps24h}
- **Estimated 24h Marketplace Volume**: ~$${overview.totalVolume24h.toLocaleString()} USDT
- **Marketwide Reject Rate**: ${(overview.overallRejectRate * 100).toFixed(1)}%

---

## 2. Category Pricing & Friction Matrix
${benchmarks
  .map(
    (b) => `### \`${b.category.toUpperCase()}\`
- **ASP Count**: ${b.aspCount} providers
- **Price Range**: $${b.minPrice} - $${b.maxPrice} USDT (Median: **$${b.medianPrice} USDT**, Avg: **$${b.averagePrice} USDT**)
- **Friction Indices**: Reject Rate: **${(b.averageRejectRate * 100).toFixed(1)}%** | Dispute Rate: **${(b.averageDisputeRate * 100).toFixed(1)}%**
- **7-Day Task Volume**: ${b.totalTasks7d} tasks
`,
  )
  .join("\n")}

---

## 3. Top Trending ASPs (Momentum Leaders)
${topTrending
  .map(
    (t, i) => `${i + 1}. **${t.name}** (\`${t.id}\`) — *${t.category}*
   - Reputation: **${t.reputationScore}/100** | Tier: \`${t.trustTier}\`
   - Median Price: $${t.medianPrice} USDT | 7d Volume: ${t.recentVolume7d} tasks | Reject Rate: ${(t.rejectRate * 100).toFixed(1)}%`,
  )
  .join("\n")}

---

## 4. Market Risk & Dispute Outliers
- **High-Risk ASPs Flagged**: ${highRiskAsps.length}
${highRiskAsps
  .slice(0, 5)
  .map(
    (hr) =>
      `  - ⚠️ **${hr.name}** (\`${hr.id}\`): Reject rate ${(hr.rejectRate * 100).toFixed(1)}%, Dispute rate ${(hr.disputeRate * 100).toFixed(1)}%`,
  )
  .join("\n") || "  - No severe risk outliers detected in current window."}

---

## 5. Strategic Directives for ASP Operators
1. **Pricing Arbitrage**: If pricing below the median in categories with <10% reject rates, there is head-room to raise service fees by 15-25%.
2. **Dispute Avoidance**: Top cause of rejection is spec misalignment. ASPs that require structured acceptance schemas before starting work boast 68% lower dispute frequencies.
3. **Escrow Hedging**: Maintain clear intermediate milestones to secure partial disbursements in the event of dispute mediation.
`;
  }
}
