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

it("parses real production 99999 NO_GO with Block spend and Continue disabled", () => {
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
  expect(html).toContain("Block spend");
  expect(html).toContain("Continue free tools");
  expect(html).toMatch(/disabled[^>]{0,120}aria-label="Continue free tools"|aria-label="Continue free tools"[^>]{0,80}disabled/);
});

it("parses real production GO envelope for live listing agent 11167 and enables Continue", () => {
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
  expect(html).toContain("Continue free tools");
  expect(html).not.toContain("Block spend");
  expect(html).not.toMatch(/disabled[^>]{0,120}aria-label="Continue free tools"|aria-label="Continue free tools"[^>]{0,80}disabled/);
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

it("parses real production GO envelope for live listing agent 8136 (Continue substitute while 13837 is 404)", () => {
  const text = JSON.parse(envelope("trust-go-8136.json")).result.content[0].text;
  const msg = {
    id: "g8136",
    role: "bot" as const,
    kind: "activity" as const,
    at: 1,
    tool: { name: "get_asp_trust_card", ok: true, output: text },
  };
  const data = parseOkxActionCard(msg.tool);
  expect(data).toMatchObject({ kind: "trust", decision: "GO", agentId: "8136" });
  const html = renderToStaticMarkup(createElement(OkxGateToolResult, {
    message: msg,
    enabled: true,
    composerDraftId: "group:test",
    fallback: createElement("div", null, "fallback"),
  }));
  expect(html).toContain("Continue free tools");
  expect(html).not.toMatch(/disabled[^>]{0,120}aria-label="Continue free tools"|aria-label="Continue free tools"[^>]{0,80}disabled/);
});
