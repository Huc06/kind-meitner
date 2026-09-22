import { describe, expect, it } from "vitest";

import { isOkxGateTool, OKX_PRODUCTION_FREE_MCP_URL, parseOkxActionCard } from "./okx-action-cards";

const readiness = {
  resource: { access: "free" },
  data: {
    endpointUrl: "https://demo.vercel.app/api/okx/free-mcp",
    agentId: null,
    verdict: "FAIL",
    score: 33,
    checks: [{ id: "host_pitfall_vercel", status: "fail", detail: "host=demo.vercel.app" }],
    remediation: ["Replace *.vercel.app with a custom domain or Railway/Fly HTTPS host. OKX listing test env rejects vercel.app."],
    raw: { httpStatus: null },
  },
};

const trust = {
  resource: { access: "free" },
  data: {
    agentId: "99999",
    decision: "NO_GO",
    summary: "Listing or endpoint checks failed.",
    signals: [{ id: "listing_page", status: "fail", detail: "HTTP 404" }],
    notChecked: ["on-chain credit score", "historical settlement volume", "OKX official endorsement"],
    remediation: [],
    safeNextStep: "Do not call pay/x402 tools. Fix listing or endpoint first.",
  },
};

describe("OKX action-card payload parsing", () => {
  it("accepts the #23 readiness envelope from a namespaced persisted tool result", () => {
    const parsed = parseOkxActionCard({ name: "mcp__markets__scan_free_mcp_readiness", ok: true, output: JSON.stringify(readiness) });
    expect(parsed).toMatchObject({ kind: "readiness", verdict: "FAIL", endpointUrl: readiness.data.endpointUrl });
    expect(parsed?.kind === "readiness" && parsed.checks).toHaveLength(1);
  });

  it("accepts the #24 trust envelope and preserves explicit uncertainty", () => {
    const parsed = parseOkxActionCard({ name: "get_asp_trust_card", ok: true, output: JSON.stringify(trust) });
    expect(parsed).toMatchObject({ kind: "trust", decision: "NO_GO", agentId: "99999", notChecked: trust.data.notChecked });
  });

  it("rejects malformed, incomplete, and unsettled payloads without inventing a result", () => {
    expect(parseOkxActionCard({ name: "scan_free_mcp_readiness", ok: true, output: "not JSON" })).toBeNull();
    expect(parseOkxActionCard({ name: "scan_free_mcp_readiness", ok: true, output: JSON.stringify({ data: { verdict: "PASS" } }) })).toBeNull();
    expect(parseOkxActionCard({ name: "get_asp_trust_card", output: JSON.stringify(trust) })).toBeNull();
  });

  it("only treats the two explicit gate tools as action-card candidates", () => {
    expect(isOkxGateTool("mcp__markets__scan_free_mcp_readiness")).toBe(true);
    expect(isOkxGateTool("query_market_benchmarks")).toBe(false);
  });

  it("exposes the known-good Railway Free-MCP URL for Apply host", () => {
    expect(OKX_PRODUCTION_FREE_MCP_URL).toBe(
      "https://kind-meitner-production.up.railway.app/api/okx/free-mcp",
    );
  });
});
