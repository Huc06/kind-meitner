import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReadinessRunCard } from "./ReadinessRunCard";
import { TrustCard } from "./TrustCard";

const readinessData = {
  kind: "readiness" as const,
  endpointUrl: "https://demo.vercel.app/api/okx/free-mcp",
  verdict: "FAIL" as const,
  checks: [{ id: "host_pitfall_vercel", status: "fail" as const, detail: "host=demo.vercel.app" }],
  remediation: ["Replace *.vercel.app with a custom domain."],
  rawJson: '{"data":{"verdict":"FAIL"}}',
};

const trustBase = {
  kind: "trust" as const,
  agentId: "99999",
  summary: "Listing or endpoint checks failed.",
  signals: [{ id: "listing_page", status: "fail" as const, detail: "HTTP 404" }],
  notChecked: ["on-chain credit score", "historical settlement volume", "OKX official endorsement"],
  remediation: [] as string[],
  safeNextStep: "Do not call pay/x402 tools. Fix listing or endpoint first.",
  rawJson: '{"data":{"decision":"NO_GO"}}',
};


function buttonHtml(html: string, ariaLabel: string): string | null {
  const marker = `aria-label="${ariaLabel}"`;
  const idx = html.indexOf(marker);
  if (idx < 0) return null;
  const start = html.lastIndexOf("<button", idx);
  const end = html.indexOf("</button>", idx);
  if (start < 0 || end < 0) return null;
  return html.slice(start, end + "</button>".length);
}

function isDisabledButton(html: string, ariaLabel: string): boolean {
  const button = buttonHtml(html, ariaLabel);
  return Boolean(button && /\sdisabled(?:=""|(?=\s|>))/.test(button));
}

describe("OKX action cards", () => {
  it("renders a readiness verdict, Apply host, fill-only re-scan, and collapsed evidence", () => {
    const html = renderToStaticMarkup(createElement(ReadinessRunCard, {
      data: readinessData,
      onRescan: () => {},
      onApplyHost: () => {},
    }));

    expect(html).toContain("Readiness verdict FAIL");
    expect(html).toContain("Vercel host");
    expect(html).toContain("Apply host");
    expect(html).toContain("Copy fixes");
    expect(html).toContain("Re-scan");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("&quot;verdict&quot;");
  });

  it("disables readiness CTAs while busy", () => {
    const html = renderToStaticMarkup(createElement(ReadinessRunCard, {
      data: readinessData,
      onRescan: () => {},
      onApplyHost: () => {},
      busy: true,
    }));
    expect(isDisabledButton(html, "Apply host")).toBe(true);
    expect(isDisabledButton(html, "Re-scan")).toBe(true);
  });

  it("renders a trust decision without a made-up score and always exposes not-checked evidence", () => {
    const html = renderToStaticMarkup(createElement(TrustCard, {
      data: { ...trustBase, decision: "NO_GO" },
      onBlockSpend: () => {},
      onContinue: () => {},
      onRecheck: () => {},
    }));

    expect(html).toContain("Trust decision NO_GO");
    expect(html).toContain("Not checked");
    expect(html).toContain("Block spend");
    expect(html).toContain("Continue free tools");
    expect(html).toContain("Re-check");
    expect(html).toContain("Copy next step");
    expect(html).toContain("Do not call pay/x402 tools.");
    expect(html).not.toContain("Trust score");
  });

  it("disables Continue on NO_GO and enables Continue on GO", () => {
    const noGo = renderToStaticMarkup(createElement(TrustCard, {
      data: { ...trustBase, decision: "NO_GO" },
      onBlockSpend: () => {},
      onContinue: () => {},
      onRecheck: () => {},
    }));
    expect(isDisabledButton(noGo, "Continue free tools")).toBe(true);
    expect(noGo).toContain("Block spend");

    const go = renderToStaticMarkup(createElement(TrustCard, {
      data: {
        ...trustBase,
        decision: "GO",
        agentId: "13837",
        summary: "Listing reachable and endpoint ready.",
        signals: [{ id: "listing_page", status: "pass", detail: "HTTP 200" }],
        safeNextStep: "Proceed with free tools only.",
        rawJson: '{"data":{"decision":"GO"}}',
      },
      onBlockSpend: () => {},
      onContinue: () => {},
      onRecheck: () => {},
    }));
    expect(go).toContain("Continue free tools");
    expect(isDisabledButton(go, "Continue free tools")).toBe(false);
    // Block spend is for NO_GO/CAUTION only
    expect(go).not.toContain("Block spend");
  });

  it("disables Continue on CAUTION and keeps Block spend available", () => {
    const html = renderToStaticMarkup(createElement(TrustCard, {
      data: {
        ...trustBase,
        decision: "CAUTION",
        summary: "Listing up but endpoint not fully probed.",
        safeNextStep: "Re-check before spend.",
        rawJson: '{"data":{"decision":"CAUTION"}}',
      },
      onBlockSpend: () => {},
      onContinue: () => {},
      onRecheck: () => {},
    }));
    expect(isDisabledButton(html, "Continue free tools")).toBe(true);
    expect(html).toContain("Block spend");
  });
});
