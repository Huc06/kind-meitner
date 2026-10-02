import { describe, expect, it } from "vitest";

import {
  extractGateLastRun,
  formatGateLastRunSummary,
  isOkxGateTool,
  OKX_PRODUCTION_FREE_MCP_URL,
  parseOkxActionCard,
} from "./okx-action-cards";

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

  it("extracts last-run latency and tool count only from server evidence", () => {
    const checks = [
      { id: "tools_list_http", status: "pass" as const, detail: "status=200 latencyMs=412" },
      { id: "tools_list_shape", status: "pass" as const, detail: "7 tools" },
    ];
    expect(extractGateLastRun({ raw: { toolNames: ["a", "b", "c", "d", "e", "f", "g"] } }, checks)).toEqual({
      latencyMs: 412,
      toolCount: 7,
    });
    expect(extractGateLastRun({}, [{ id: "listing_page", status: "fail", detail: "HTTP 404" }])).toBeUndefined();
    expect(formatGateLastRunSummary({ latencyMs: 412, toolCount: 7 }, 1, "12s ago")).toBe(
      "12s ago · 412ms · 7 tools",
    );
    expect(formatGateLastRunSummary(undefined, undefined, undefined)).toBeNull();
  });

  it("attaches lastRun on readiness parse when detail evidence is present", () => {
    const envelope = {
      resource: { access: "free" },
      data: {
        endpointUrl: "https://kind-meitner-production.up.railway.app/api/okx/free-mcp",
        verdict: "PASS",
        checks: [
          { id: "tools_list_http", status: "pass", detail: "status=200 latencyMs=88" },
          { id: "tools_list_shape", status: "pass", detail: "7 tools" },
        ],
        remediation: [],
        raw: { toolNames: ["a", "b", "c", "d", "e", "f", "g"] },
      },
    };
    const parsed = parseOkxActionCard({
      name: "scan_free_mcp_readiness",
      ok: true,
      output: JSON.stringify(envelope),
    });
    expect(parsed).toMatchObject({ kind: "readiness", lastRun: { latencyMs: 88, toolCount: 7 } });
  });

  it("accepts Claude-style array-wrapped tool output", () => {
    const arrayOutput = [
      {
        type: "text",
        text: readiness,
      },
    ];
    const parsed = parseOkxActionCard({
      name: "mcp__agents__scan_free_mcp_readiness",
      ok: true,
      output: JSON.stringify(arrayOutput),
    });
    expect(parsed).toMatchObject({
      kind: "readiness",
      verdict: "FAIL",
      endpointUrl: readiness.data.endpointUrl,
    });
  });

  it("unwraps real tool-result contract with top-level content array (Defect 18)", () => {
    const mcpResult = {
      content: [
        {
          type: "text",
          text: JSON.stringify(readiness),
        },
      ],
    };
    const parsed = parseOkxActionCard({
      name: "scan_free_mcp_readiness",
      ok: true,
      output: JSON.stringify(mcpResult),
    });
    expect(parsed).toMatchObject({
      kind: "readiness",
      verdict: "FAIL",
      endpointUrl: readiness.data.endpointUrl,
    });
  });

  it("unwraps real trust card contract with top-level content array (Defect 18)", () => {
    const mcpResult = {
      content: [
        {
          type: "text",
          text: JSON.stringify(trust),
        },
      ],
    };
    const parsed = parseOkxActionCard({
      name: "get_asp_trust_card",
      ok: true,
      output: JSON.stringify(mcpResult),
    });
    expect(parsed).toMatchObject({
      kind: "trust",
      decision: "NO_GO",
      agentId: "99999",
    });
  });

  it("unwraps nested result.content tool outputs from JSON-RPC responses", () => {
    const rpcEnvelope = {
      jsonrpc: "2.0",
      id: "scan-1",
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify(readiness),
          },
        ],
      },
    };
    const parsed = parseOkxActionCard({
      name: "scan_free_mcp_readiness",
      ok: true,
      output: JSON.stringify(rpcEnvelope),
    });
    expect(parsed).toMatchObject({
      kind: "readiness",
      verdict: "FAIL",
      endpointUrl: readiness.data.endpointUrl,
    });
  });

  it("handles malformed and empty content arrays without fabricating results", () => {
    // Empty content array
    expect(parseOkxActionCard({
      name: "scan_free_mcp_readiness",
      ok: true,
      output: JSON.stringify({ content: [] }),
    })).toBeNull();

    // Content is not an array
    expect(parseOkxActionCard({
      name: "scan_free_mcp_readiness",
      ok: true,
      output: JSON.stringify({ content: "not an array" }),
    })).toBeNull();

    // Content text is not JSON
    expect(parseOkxActionCard({
      name: "scan_free_mcp_readiness",
      ok: true,
      output: JSON.stringify({ content: [{ type: "text", text: "invalid non-json string" }] }),
    })).toBeNull();

    // Content text is empty object
    expect(parseOkxActionCard({
      name: "scan_free_mcp_readiness",
      ok: true,
      output: JSON.stringify({ content: [{ type: "text", text: "{}" }] }),
    })).toBeNull();

    // Content text is missing required readiness fields
    expect(parseOkxActionCard({
      name: "scan_free_mcp_readiness",
      ok: true,
      output: JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ verdict: "PASS" }) }] }),
    })).toBeNull();

    // In-flight or error tool calls
    expect(parseOkxActionCard({
      name: "scan_free_mcp_readiness",
      ok: false,
      output: JSON.stringify(readiness),
    })).toBeNull();
  });

  it("parses limitations and lastChecked when supplied in data or resource", () => {
    const withMetadata = {
      resource: {
        access: "free",
        limitations: ["No mainnet settlement", "Rate limited to 10 req/min"],
        lastChecked: "2026-10-02T12:00:00Z",
      },
      data: {
        ...readiness.data,
      },
    };
    const parsed = parseOkxActionCard({
      name: "scan_free_mcp_readiness",
      ok: true,
      output: JSON.stringify(withMetadata),
    });
    expect(parsed).toMatchObject({
      kind: "readiness",
      limitations: ["No mainnet settlement", "Rate limited to 10 req/min"],
      lastChecked: "2026-10-02T12:00:00Z",
    });
  });

  it("is independent of key ordering in envelope and signals", () => {
    const reverseOrder = {
      data: {
        remediation: ["Fix scheme"],
        score: 50,
        checks: [
          { status: "pass", id: "tools_list", detail: "ok" },
          { detail: "host=demo.vercel.app", status: "fail", id: "host_pitfall" },
        ],
        verdict: "WARN",
        endpointUrl: "https://example.com/api",
      },
      resource: {
        provenance: "probe",
        mainnet: false,
        walletRequired: false,
        paymentRequired: false,
        access: "free",
      },
    };
    const parsed = parseOkxActionCard({
      name: "scan_free_mcp_readiness",
      ok: true,
      output: JSON.stringify(reverseOrder),
    });
    expect(parsed).toMatchObject({
      kind: "readiness",
      verdict: "WARN",
      endpointUrl: "https://example.com/api",
      score: 50,
    });
    expect(parsed?.kind === "readiness" && parsed.checks).toHaveLength(2);
  });
});
