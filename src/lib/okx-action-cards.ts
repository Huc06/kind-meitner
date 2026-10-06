import type { Message } from "@/state/store";

export type GateStatus = "pass" | "warn" | "fail" | "skipped";
export type ReadinessVerdict = "PASS" | "WARN" | "FAIL";
export type TrustDecision = "GO" | "CAUTION" | "NO_GO";
export type ListingStatus = "found" | "not_found" | "could_not_verify" | "request_failed";
export type ConnectionStatus = "not_checked" | "passed" | "failed" | "could_not_verify" | "unsupported";
export type EndpointAssociation = "none" | "verified" | "unverified" | "known_mismatch";
export type GateSignal = {
  id: string;
  status: GateStatus;
  detail: string;
  label?: string;
};

/** Optional evidence for the card last-run line. Never invent values. */
export type GateLastRun = {
  latencyMs?: number;
  toolCount?: number;
};
export type EnvelopeResource = {
  access?: string;
  paymentRequired?: boolean;
  walletRequired?: boolean;
  mainnet?: boolean;
  provenance?: string;
  limitations?: string[];
  lastChecked?: string | number;
};

export type ReadinessRunCardData = {
  kind: "readiness";
  endpointUrl: string;
  verdict: ReadinessVerdict;
  checks: GateSignal[];
  remediation: string[];
  rawJson: string;
  score?: number | string;
  resource?: EnvelopeResource;
  lastRun?: GateLastRun;
  limitations?: string[];
  lastChecked?: string | number;
};

export type TrustCardData = {
  kind: "trust";
  agentId: string;
  agentName?: string;
  description?: string;
  score?: string;
  avatarUrl?: string;
  services?: Array<{
    serviceId: number | string;
    name: string;
    description: string;
    price: string;
    symbol?: string;
    serviceType?: string;
    endpoint?: string;
  }>;
  listingStatus?: ListingStatus;
  connectionStatus?: ConnectionStatus;
  endpointAssociation?: EndpointAssociation;
  endpointAssociationDetail?: string;
  listingUrl?: string;
  marketplaceRating?: string;
  reviewCount?: number;
  checksPerformed?: GateSignal[];
  nextActions?: string[];
  decision?: TrustDecision;
  summary: string;
  signals: GateSignal[];
  notChecked: string[];
  remediation: string[];
  safeNextStep: string;
  rawJson: string;
  resource?: EnvelopeResource;
  lastRun?: GateLastRun;
  limitations?: string[];
  lastChecked?: string | number;
};
export type OkxActionCardData = ReadinessRunCardData | TrustCardData;

/** Known-good Railway Free-MCP URL used by Apply host (Dev Day Loop A). */
export const OKX_PRODUCTION_FREE_MCP_URL =
  "https://kind-meitner-production.up.railway.app/api/okx/free-mcp";

const READINESS_TOOL = "scan_free_mcp_readiness";
const TRUST_TOOL = "get_asp_trust_card";
const CHECK_TOOL = "check_agent_listing_and_connection";
const statuses = new Set<GateStatus>(["pass", "warn", "fail", "skipped"]);
const readinessVerdicts = new Set<ReadinessVerdict>(["PASS", "WARN", "FAIL"]);
const trustDecisions = new Set<TrustDecision>(["GO", "CAUTION", "NO_GO"]);
const listingStatuses = new Set<ListingStatus>(["found", "not_found", "could_not_verify", "request_failed"]);
const connectionStatuses = new Set<ConnectionStatus>(["not_checked", "passed", "failed", "could_not_verify", "unsupported"]);
const endpointAssociations = new Set<EndpointAssociation>(["none", "verified", "unverified", "known_mismatch"]);
const MAX_TEXT = 1_000;
const MAX_ROWS = 20;
const MAX_ITEMS = 12;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, max = MAX_TEXT): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
}

function listOfText(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_ITEMS) return null;
  const values = value.map((item) => text(item));
  return values.every((item): item is string => item !== null) ? values : null;
}

function signals(value: unknown): GateSignal[] | null {
  if (!Array.isArray(value) || value.length > MAX_ROWS) return null;
  const rows: GateSignal[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const id = text(item.id, 120);
    const status = text(item.status, 20);
    const detail = text(item.detail);
    const label = item.label === undefined ? undefined : text(item.label, 240);
    if (!id || !status || !statuses.has(status as GateStatus) || !detail || item.label !== undefined && !label) return null;
    rows.push({ id, status: status as GateStatus, detail, ...(label ? { label } : {}) });
  }
  return rows;
}

/** Pull latency / tool count only when the server already stated them. */
export function extractGateLastRun(
  data: Record<string, unknown>,
  rows: GateSignal[],
): GateLastRun | undefined {
  let latencyMs: number | undefined;
  let toolCount: number | undefined;
  for (const row of rows) {
    const latency = row.detail.match(/\blatencyMs=(\d+)\b/);
    if (latency) latencyMs = Number(latency[1]);
    const tools = row.detail.match(/\b(\d+)\s+tools?\b/i);
    if (tools) toolCount = Number(tools[1]);
  }
  if (isRecord(data.raw) && Array.isArray(data.raw.toolNames)) {
    const names = data.raw.toolNames.filter((name): name is string => typeof name === "string");
    if (names.length > 0 && names.length === data.raw.toolNames.length) toolCount = names.length;
  }
  if (latencyMs === undefined && toolCount === undefined) return undefined;
  return {
    ...(latencyMs !== undefined ? { latencyMs } : {}),
    ...(toolCount !== undefined ? { toolCount } : {}),
  };
}

export function extractEnvelope(parsed: unknown): {
  data: Record<string, unknown> | null;
  resource: EnvelopeResource | undefined;
} {
  if (Array.isArray(parsed) && parsed.length > 0) {
    for (const item of parsed) {
      if (isRecord(item)) {
        if (isRecord(item.text)) {
          const res = extractEnvelope(item.text);
          if (res.data) return res;
        }
        if (typeof item.text === "string") {
          try {
            const res = extractEnvelope(JSON.parse(item.text));
            if (res.data) return res;
          } catch {
            /* not json string */
          }
        }
        const res = extractEnvelope(item);
        if (res.data) return res;
      }
    }
    return { data: null, resource: undefined };
  }
  if (!isRecord(parsed)) return { data: null, resource: undefined };

  let resource: EnvelopeResource | undefined;
  const rawRes = isRecord(parsed.resource) ? parsed.resource : undefined;
  if (rawRes) {
    resource = {
      access: text(rawRes.access, 100) ?? undefined,
      paymentRequired: typeof rawRes.paymentRequired === "boolean" ? rawRes.paymentRequired : undefined,
      walletRequired: typeof rawRes.walletRequired === "boolean" ? rawRes.walletRequired : undefined,
      mainnet: typeof rawRes.mainnet === "boolean" ? rawRes.mainnet : undefined,
      provenance: text(rawRes.provenance, 500) ?? undefined,
      limitations: listOfText(rawRes.limitations) ?? undefined,
      lastChecked: typeof rawRes.lastChecked === "string" || typeof rawRes.lastChecked === "number" ? rawRes.lastChecked : undefined,
    };
  }

  if (isRecord(parsed.result)) {
    const inner = extractEnvelope(parsed.result);
    if (inner.data) {
      return {
        data: inner.data,
        resource: resource ?? inner.resource,
      };
    }
  }

  if (Array.isArray(parsed.content)) {
    const inner = extractEnvelope(parsed.content);
    if (inner.data) {
      return {
        data: inner.data,
        resource: resource ?? inner.resource,
      };
    }
  }

  if (isRecord(parsed.data)) {
    if (!resource && isRecord(parsed.data.resource)) {
      const dRes = parsed.data.resource;
      resource = {
        access: text(dRes.access, 100) ?? undefined,
        paymentRequired: typeof dRes.paymentRequired === "boolean" ? dRes.paymentRequired : undefined,
        walletRequired: typeof dRes.walletRequired === "boolean" ? dRes.walletRequired : undefined,
        mainnet: typeof dRes.mainnet === "boolean" ? dRes.mainnet : undefined,
        provenance: text(dRes.provenance, 500) ?? undefined,
        limitations: listOfText(dRes.limitations) ?? undefined,
        lastChecked: typeof dRes.lastChecked === "string" || typeof dRes.lastChecked === "number" ? dRes.lastChecked : undefined,
      };
    }
    return { data: parsed.data, resource };
  }
  return { data: parsed, resource };
}

export function extractCardPayload(parsed: unknown): Record<string, unknown> | null {
  return extractEnvelope(parsed).data;
}

/** Parse an arbitrary `{ resource, data }` or `{ data }` envelope from an OKX gate tool.
 * Never fabricates a verdict/decision from malformed data. */
export function parseOkxActionCardEnvelope(
  toolName: string,
  envelope: unknown,
  rawJson?: string,
): OkxActionCardData | null {
  if (!isOkxGateTool(toolName)) return null;
  const { data, resource } = extractEnvelope(envelope);
  if (!data) return null;
  const jsonText = rawJson ?? (typeof envelope === "string" ? envelope : JSON.stringify(envelope, null, 2));
  const rawJsonSlice = jsonText.length <= 20_000 ? jsonText : jsonText.slice(0, 20_000);

  if (isReadinessTool(toolName)) {
    const endpointUrl = text(data.endpointUrl, 2_000);
    const verdict = text(data.verdict, 20);
    const checks = signals(data.checks);
    const remediation = listOfText(data.remediation);
    const score = typeof data.score === "number" || typeof data.score === "string" ? data.score : undefined;
    if (!endpointUrl || !verdict || !readinessVerdicts.has(verdict as ReadinessVerdict) || !checks || !remediation) return null;
    const lastRun = extractGateLastRun(data, checks);
    const limitations = listOfText(data.limitations) ?? resource?.limitations;
    const lastChecked = (typeof data.lastChecked === "string" || typeof data.lastChecked === "number")
      ? data.lastChecked
      : resource?.lastChecked;
    return {
      kind: "readiness",
      endpointUrl,
      verdict: verdict as ReadinessVerdict,
      checks,
      remediation,
      rawJson: rawJsonSlice,
      ...(score !== undefined ? { score } : {}),
      ...(resource ? { resource } : {}),
      ...(lastRun ? { lastRun } : {}),
      ...(limitations && limitations.length > 0 ? { limitations } : {}),
      ...(lastChecked !== undefined ? { lastChecked } : {}),
    };
  }

  const agentId = text(data.agentId, 128);
  const agentName = text(data.agentName, 200);
  const description = text(data.description, 2000);
  const score = text(data.score, 20);
  const avatarUrl = text(data.avatarUrl, 500);
  const rawListing = isRecord(data.listing) ? data.listing : undefined;
  const rawServices = Array.isArray(data.services)
    ? data.services
    : Array.isArray(rawListing?.services)
      ? rawListing.services
      : [];

  const services = rawServices.slice(0, 10).flatMap((s: unknown) => {
    if (!isRecord(s)) return [];
    const name = text(s.name, 100);
    if (!name) return [];
    return [{
      serviceId: typeof s.serviceId === "number" || typeof s.serviceId === "string" ? s.serviceId : String(s.serviceId ?? ""),
      name,
      description: text(s.description, 500) ?? "",
      price: text(s.price, 20) ?? "0",
      ...(text(s.symbol, 20) ? { symbol: text(s.symbol, 20)! } : {}),
      ...(text(s.serviceType, 20) ? { serviceType: text(s.serviceType, 20)! } : {}),
      ...(text(s.endpoint, 500) ? { endpoint: text(s.endpoint, 500)! } : {}),
    }];
  });

  const listingStatus = text(data.listingStatus, 30);
  const connectionStatus = text(data.connectionStatus, 30);
  const endpointAssociation = text(data.endpointAssociation, 30);
  const endpointAssociationDetail = text(data.endpointAssociationDetail, 500);
  const listingUrl = text(rawListing?.listingUrl, 500);
  const marketplaceRating = text(data.marketplaceRating, 20) ?? text(rawListing?.marketplaceRating, 20) ?? score;
  const reviewCount = typeof data.reviewCount === "number" ? data.reviewCount : typeof rawListing?.reviewCount === "number" ? rawListing.reviewCount : undefined;
  const checksPerformed = signals(data.checksPerformed);
  const nextActions = listOfText(data.nextActions);

  const decision = text(data.decision, 20);
  const summary = text(data.summary);
  const signalsList = signals(data.signals) ?? checksPerformed;
  const notChecked = listOfText(data.notChecked) ?? [];
  const remediation = listOfText(data.remediation) ?? [];
  const safeNextStep = text(data.safeNextStep) ?? (nextActions && nextActions.length > 0 ? nextActions[0]! : "");

  const hasValidListingStatus = listingStatus && listingStatuses.has(listingStatus as ListingStatus);
  const hasValidDecision = decision && trustDecisions.has(decision as TrustDecision);

  if (!agentId || (!hasValidListingStatus && !hasValidDecision) || !summary || !signalsList || !safeNextStep) return null;
  const lastRun = extractGateLastRun(data, signalsList);
  const limitations = listOfText(data.limitations) ?? resource?.limitations;
  const lastChecked = (typeof data.lastChecked === "string" || typeof data.lastChecked === "number")
    ? data.lastChecked
    : resource?.lastChecked;
  return {
    kind: "trust",
    agentId,
    ...(agentName ? { agentName } : {}),
    ...(description ? { description } : {}),
    ...(score ? { score } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
    ...(services && services.length > 0 ? { services } : {}),
    ...(hasValidListingStatus ? { listingStatus: listingStatus as ListingStatus } : {}),
    ...(connectionStatus && connectionStatuses.has(connectionStatus as ConnectionStatus) ? { connectionStatus: connectionStatus as ConnectionStatus } : {}),
    ...(endpointAssociation && endpointAssociations.has(endpointAssociation as EndpointAssociation) ? { endpointAssociation: endpointAssociation as EndpointAssociation } : {}),
    ...(endpointAssociationDetail ? { endpointAssociationDetail } : {}),
    ...(listingUrl ? { listingUrl } : {}),
    ...(marketplaceRating ? { marketplaceRating } : {}),
    ...(reviewCount !== undefined ? { reviewCount } : {}),
    ...(checksPerformed ? { checksPerformed } : {}),
    ...(nextActions ? { nextActions } : {}),
    ...(hasValidDecision ? { decision: decision as TrustDecision } : {}),
    summary,
    signals: signalsList,
    notChecked,
    remediation,
    safeNextStep,
    rawJson: rawJsonSlice,
    ...(resource ? { resource } : {}),
    ...(lastRun ? { lastRun } : {}),
    ...(limitations && limitations.length > 0 ? { limitations } : {}),
    ...(lastChecked !== undefined ? { lastChecked } : {}),
  };
}

/** The provider records a completed MCP result as a string in `tool.output`.
 * Accept the real `{ resource, data }` envelope and a bare `data` object for
 * older transcripts, but never fabricate a verdict/decision from malformed data. */
export function parseOkxActionCard(tool: Message["tool"] | undefined): OkxActionCardData | null {
  if (!tool || tool.ok !== true || !tool.output || !isOkxGateTool(tool.name)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(tool.output);
  } catch {
    return null;
  }
  const rawJson = tool.output.length <= 20_000 ? tool.output : tool.output.slice(0, 20_000);
  return parseOkxActionCardEnvelope(tool.name, parsed, rawJson);
}

/** Tool providers namespace MCP calls (for example `mcp__markets__…`), so
 * match the terminal tool segment instead of assuming a display name. */
export function isReadinessTool(name: string): boolean {
  return name === READINESS_TOOL || name.endsWith(`__${READINESS_TOOL}`);
}

export function isTrustTool(name: string): boolean {
  return (
    name === TRUST_TOOL ||
    name.endsWith(`__${TRUST_TOOL}`) ||
    name === CHECK_TOOL ||
    name.endsWith(`__${CHECK_TOOL}`)
  );
}

export function isOkxGateTool(name: string | undefined): boolean {
  return Boolean(name && (isReadinessTool(name) || isTrustTool(name)));
}

export function checkLabel(row: GateSignal): string {
  if (row.label) return row.label;
  const labels: Record<string, string> = {
    https_scheme: "HTTPS scheme",
    host_pitfall_vercel: "Vercel host",
    dns_or_tcp: "Connection",
    tools_list_http: "tools/list reachable",
    tools_list_shape: "tools/list response",
    no_accidental_402: "Free discovery",
    initialize_soft: "Initialize check",
    listing_page: "Listing page",
    service_connection: "Service connection",
  };
  return labels[row.id] ?? row.id.replace(/[_-]+/g, " ");
}

/** Build the muted last-run summary from message time + parsed evidence. */
export function formatGateLastRunSummary(
  lastRun: GateLastRun | undefined,
  ranAt: number | undefined,
  ageLabel: string | undefined,
): string | null {
  const parts: string[] = [];
  if (typeof ranAt === "number" && Number.isFinite(ranAt) && ageLabel) parts.push(ageLabel);
  if (typeof lastRun?.latencyMs === "number") parts.push(`${lastRun.latencyMs}ms`);
  if (typeof lastRun?.toolCount === "number") {
    parts.push(`${lastRun.toolCount} ${lastRun.toolCount === 1 ? "tool" : "tools"}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
