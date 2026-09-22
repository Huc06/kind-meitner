import type { Message } from "@/state/store";

export type GateStatus = "pass" | "warn" | "fail" | "skipped";
export type ReadinessVerdict = "PASS" | "WARN" | "FAIL";
export type TrustDecision = "GO" | "CAUTION" | "NO_GO";

export type GateSignal = {
  id: string;
  status: GateStatus;
  detail: string;
  label?: string;
};

export type ReadinessRunCardData = {
  kind: "readiness";
  endpointUrl: string;
  verdict: ReadinessVerdict;
  checks: GateSignal[];
  remediation: string[];
  rawJson: string;
};

export type TrustCardData = {
  kind: "trust";
  agentId: string;
  decision: TrustDecision;
  summary: string;
  signals: GateSignal[];
  notChecked: string[];
  remediation: string[];
  safeNextStep: string;
  rawJson: string;
};

export type OkxActionCardData = ReadinessRunCardData | TrustCardData;

/** Known-good Railway Free-MCP URL used by Apply host (Dev Day Loop A). */
export const OKX_PRODUCTION_FREE_MCP_URL =
  "https://kind-meitner-production.up.railway.app/api/okx/free-mcp";

const READINESS_TOOL = "scan_free_mcp_readiness";
const TRUST_TOOL = "get_asp_trust_card";
const statuses = new Set<GateStatus>(["pass", "warn", "fail", "skipped"]);
const readinessVerdicts = new Set<ReadinessVerdict>(["PASS", "WARN", "FAIL"]);
const trustDecisions = new Set<TrustDecision>(["GO", "CAUTION", "NO_GO"]);
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
  if (!isRecord(parsed)) return null;
  const data = isRecord(parsed.data) ? parsed.data : parsed;
  const rawJson = tool.output.length <= 20_000 ? tool.output : tool.output.slice(0, 20_000);

  if (isReadinessTool(tool.name)) {
    const endpointUrl = text(data.endpointUrl, 2_000);
    const verdict = text(data.verdict, 20);
    const checks = signals(data.checks);
    const remediation = listOfText(data.remediation);
    if (!endpointUrl || !verdict || !readinessVerdicts.has(verdict as ReadinessVerdict) || !checks || !remediation) return null;
    return { kind: "readiness", endpointUrl, verdict: verdict as ReadinessVerdict, checks, remediation, rawJson };
  }

  const agentId = text(data.agentId, 128);
  const decision = text(data.decision, 20);
  const summary = text(data.summary);
  const signalsList = signals(data.signals);
  const notChecked = listOfText(data.notChecked);
  const remediation = listOfText(data.remediation);
  const safeNextStep = text(data.safeNextStep);
  if (!agentId || !decision || !trustDecisions.has(decision as TrustDecision) || !summary || !signalsList || !notChecked || !remediation || !safeNextStep) return null;
  return {
    kind: "trust",
    agentId,
    decision: decision as TrustDecision,
    summary,
    signals: signalsList,
    notChecked,
    remediation,
    safeNextStep,
    rawJson,
  };
}

/** Tool providers namespace MCP calls (for example `mcp__markets__…`), so
 * match the terminal tool segment instead of assuming a display name. */
export function isReadinessTool(name: string): boolean {
  return name === READINESS_TOOL || name.endsWith(`__${READINESS_TOOL}`);
}

export function isTrustTool(name: string): boolean {
  return name === TRUST_TOOL || name.endsWith(`__${TRUST_TOOL}`);
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
    endpoint_readiness: "Endpoint readiness",
  };
  return labels[row.id] ?? row.id.replace(/[_-]+/g, " ");
}
