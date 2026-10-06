import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OkxGateToolResult } from "../../src/components/OkxGateToolResult.tsx";
import { parseOkxActionCard, isOkxGateTool } from "../../src/lib/okx-action-cards.ts";

function envelope(name: string) {
  return readFileSync(new URL(`./issue66-evidence/${name}`, import.meta.url), "utf8");
}
function message(toolName: string, file: string) {
  return {
    id: toolName,
    role: "bot" as const,
    kind: "activity" as const,
    at: Date.now(),
    tool: { name: toolName, ok: true, output: envelope(file) },
  };
}

it("parses real production vercel FAIL envelope and exposes Apply host", () => {
  const msg = message("scan_free_mcp_readiness", "scan-vercel-envelope.json");
  expect(isOkxGateTool(msg.tool.name)).toBe(true);
  const data = parseOkxActionCard(msg.tool);
  expect(data).toMatchObject({ kind: "readiness", verdict: "FAIL" });
  const html = renderToStaticMarkup(createElement(OkxGateToolResult, {
    message: msg,
    enabled: true,
    composerDraftId: "group:test",
    fallback: createElement("div", null, "fallback"),
  }));
  expect(html).toContain("Apply host");
  expect(html).toContain("FAIL");
});

it("parses real production self PASS envelope", () => {
  const data = parseOkxActionCard(message("scan_free_mcp_readiness", "scan-self-envelope.json").tool);
  expect(data).toMatchObject({ kind: "readiness", verdict: "PASS" });
});

it("parses real production 99999 NO_GO listing check result", () => {
  const text = JSON.parse(envelope("trust-99999.json")).result.content[0].text;
  const msg = {
    id: "t",
    role: "bot" as const,
    kind: "activity" as const,
    at: 1,
    tool: { name: "get_asp_trust_card", ok: true, output: text },
  };
  const data = parseOkxActionCard(msg.tool);
  expect(data).toMatchObject({ kind: "trust", decision: "NO_GO", agentId: "99999" });
  const html = renderToStaticMarkup(createElement(OkxGateToolResult, {
    message: msg,
    enabled: true,
    composerDraftId: "group:test",
    fallback: createElement("div", null, "fallback"),
  }));
  expect(html).toContain("Listing not found");
  expect(html).toContain("Connection: Not checked");
  expect(html).toContain("View listing");
  expect(html).toContain("HTTP 404");
});

it("parses real production GO envelope for live listing agent 11167", () => {
  const text = JSON.parse(envelope("trust-go-11167.json")).result.content[0].text;
  const msg = {
    id: "g",
    role: "bot" as const,
    kind: "activity" as const,
    at: 1,
    tool: { name: "get_asp_trust_card", ok: true, output: text },
  };
  const data = parseOkxActionCard(msg.tool);
  expect(data).toMatchObject({ kind: "trust", decision: "GO", agentId: "11167" });
  const html = renderToStaticMarkup(createElement(OkxGateToolResult, {
    message: msg,
    enabled: true,
    composerDraftId: "group:test",
    fallback: createElement("div", null, "fallback"),
  }));
  expect(html).toContain("Listing found");
  expect(html).toContain("Connection: Passed");
  expect(html).toContain("View listing");
  expect(html).toContain("verdict=PASS");
});

it("parses real production 13837+endpoint as NO_GO due to listing_page HTTP 404", () => {
  const text = JSON.parse(envelope("trust-13837-ep.json")).result.content[0].text;
  const data = parseOkxActionCard({ name: "get_asp_trust_card", ok: true, output: text });
  expect(data).toMatchObject({ kind: "trust", decision: "NO_GO", agentId: "13837" });
  if (data?.kind === "trust") {
    expect(data.signals).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "listing_page", status: "fail", detail: "HTTP 404" }),
      expect.objectContaining({ id: "endpoint_readiness", status: "pass", detail: "verdict=PASS" }),
    ]));
  }
});

it("parses real production GO envelope for Kind Meitner Markets #13851", () => {
  const text = JSON.parse(envelope("trust-go-13851.json")).result.content[0].text;
  const msg = {
    id: "g13851",
    role: "bot" as const,
    kind: "activity" as const,
    at: 1,
    tool: { name: "get_asp_trust_card", ok: true, output: text },
  };
  const data = parseOkxActionCard(msg.tool);
  expect(data).toMatchObject({ kind: "trust", decision: "GO", agentId: "13851" });
  const html = renderToStaticMarkup(createElement(OkxGateToolResult, {
    message: msg,
    enabled: true,
    composerDraftId: "group:test",
    fallback: createElement("div", null, "fallback"),
  }));
  expect(html).toContain("Listing found");
  expect(html).toContain("Connection: Passed");
  expect(html).toContain("View listing");
});

it("renders real production scan envelope with header, boundary, disclaimer, and counts", () => {
  const msg = message("scan_free_mcp_readiness", "scan-self-envelope.json");
  const html = renderToStaticMarkup(createElement(OkxGateToolResult, {
    message: msg,
    enabled: true,
    composerDraftId: "group:test",
    fallback: createElement("div", null, "fallback"),
  }));
  expect(html).toContain("Free MCP listing readiness");
  expect(html).toContain("PASS");
  expect(html).toContain("Access: Free");
  expect(html).toContain("Payment required: No");
  expect(html).toContain("Wallet required: No");
  expect(html).toContain("Mainnet: No");
  expect(html).toContain("Source: kind-meitner live HTTPS probes + public listing pitfalls");
  expect(html).toContain("This is a local listing-readiness check, not an OKX review or endorsement.");
  expect(html).toContain("6 passed · 0 warned · 0 failed");
});

it("renders real production listing check envelope with header, disclaimer, and counts", () => {
  const text = JSON.parse(envelope("trust-go-13851.json")).result.content[0].text;
  const msg = {
    id: "g13851",
    role: "bot" as const,
    kind: "activity" as const,
    at: 1,
    tool: { name: "get_asp_trust_card", ok: true, output: text },
  };
  const html = renderToStaticMarkup(createElement(OkxGateToolResult, {
    message: msg,
    enabled: true,
    composerDraftId: "group:test",
    fallback: createElement("div", null, "fallback"),
  }));
  expect(html).toContain("Listing &amp; connection check");
  expect(html).toContain("Listing found");
  expect(html).toContain("Connection: Passed");
  expect(html).toContain("Service delivery, output quality and payment outcomes were not assessed.");
  expect(html).toContain("kind-meitner HTTPS probes + optional okx.ai agent page status; not an OKX endorsement");
  expect(html).toContain("2 passed · 0 not checked");
});
