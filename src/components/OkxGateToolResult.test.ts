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
  decision: "NO_GO" as const,
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

  it("renders no spend controls on a read-only NO_GO card", () => {
    const html = renderToStaticMarkup(createElement(TrustCard, {
      data: trustBase,
      hideSpendControls: true,
      onRecheck: () => {},
    }));

    expect(buttonHtml(html, "Block spend")).toBeNull();
    expect(buttonHtml(html, "Continue free tools")).toBeNull();
    expect(isDisabledButton(html, "Re-check")).toBe(false);
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

  it("disables trust CTAs while busy", () => {
    const html = renderToStaticMarkup(createElement(TrustCard, {
      data: { ...trustBase, decision: "NO_GO" },
      onRecheck: () => {},
      busy: true,
    }));
    expect(isDisabledButton(html, "Re-check")).toBe(true);
  });

  it("renders a last-run line from evidence and message time", () => {
    const html = renderToStaticMarkup(createElement(ReadinessRunCard, {
      data: {
        ...readinessData,
        lastRun: { latencyMs: 412, toolCount: 5 },
      },
      onRescan: () => {},
      onApplyHost: () => {},
      ranAt: Date.now() - 12_000,
    }));
    expect(html).toContain("Last run");
    expect(html).toContain("412ms");
    expect(html).toContain("5 tools");
  });

  it("omits the last-run line when no evidence or time is available", () => {
    const html = renderToStaticMarkup(createElement(ReadinessRunCard, {
      data: readinessData,
      onRescan: () => {},
      onApplyHost: () => {},
    }));
    expect(html).not.toContain("Last run");
  });

  it("renders a listing and connection card without a made-up score and always exposes scope and limitations", () => {
    const html = renderToStaticMarkup(createElement(TrustCard, {
      data: { ...trustBase, listingStatus: "not_found", connectionStatus: "not_checked" },
      onRecheck: () => {},
    }));

    expect(html).toContain("Listing &amp; connection check");
    expect(html).toContain("Listing not found");
    expect(html).toContain("Connection: Not checked");
    expect(html).toContain("Service delivery, output quality and payment outcomes were not assessed.");
    expect(html).toContain("Re-check");
    expect(html).toContain("Copy result");
    expect(html).toContain("View listing");
  });

  it("renders neutral styling for Not checked connection and failure for actual failures", () => {
    const notCheckedHtml = renderToStaticMarkup(createElement(TrustCard, {
      data: { ...trustBase, listingStatus: "found", connectionStatus: "not_checked" },
      onRecheck: () => {},
    }));
    expect(notCheckedHtml).toContain("Listing found");
    expect(notCheckedHtml).toContain("Connection: Not checked");

    const failedHtml = renderToStaticMarkup(createElement(TrustCard, {
      data: {
        ...trustBase,
        listingStatus: "found",
        connectionStatus: "failed",
        summary: "Connection failed.",
      },
      onRecheck: () => {},
    }));
    expect(failedHtml).toContain("Connection: Failed");
  });

  it("renders readiness card with header, boundary, disclaimer, score, and counts", () => {
    const html = renderToStaticMarkup(createElement(ReadinessRunCard, {
      data: {
        ...readinessData,
        score: 83,
        checks: [
          { id: "https_scheme", status: "pass" as const, detail: "https" },
          { id: "host_pitfall_vercel", status: "fail" as const, detail: "host=demo.vercel.app" },
          { id: "tools_list_shape", status: "warn" as const, detail: "not checked" },
        ],
        resource: {
          access: "free",
          paymentRequired: false,
          walletRequired: false,
          mainnet: false,
          provenance: "custom provenance test signal",
        },
      },
      onRescan: () => {},
      onApplyHost: () => {},
    }));

    expect(html).toContain("Free MCP listing readiness");
    expect(html).toContain("FAIL");
    expect(html).toContain("https://demo.vercel.app/api/okx/free-mcp");
    expect(html).toContain("Score: 83");
    expect(html).toContain("1 passed · 1 warned · 1 failed");
    expect(html).toContain("Access: Free");
    expect(html).toContain("Payment required: No");
    expect(html).toContain("Wallet required: No");
    expect(html).toContain("Mainnet: No");
    expect(html).toContain("Source: custom provenance test signal");
    expect(html).toContain("This is a local listing-readiness check, not an OKX review or endorsement.");
    expect(html).toContain("Copy evidence");
  });

  it("renders listing and connection card with header, disclaimer, counts, and run details", () => {
    const html = renderToStaticMarkup(createElement(TrustCard, {
      data: {
        ...trustBase,
        listingStatus: "not_found",
        connectionStatus: "not_checked",
        signals: [
          { id: "listing_page", status: "fail" as const, detail: "HTTP 404" },
          { id: "service_connection", status: "skipped" as const, detail: "Not checked" },
        ],
      },
      onRecheck: () => {},
    }));

    expect(html).toContain("Listing &amp; connection check");
    expect(html).toContain("99999");
    expect(html).toContain("0 passed · 1 not checked · 1 failed");
    expect(html).toContain("Service delivery, output quality and payment outcomes were not assessed.");
    expect(html).toContain("Copy result");
  });

  it("renders verified association when declared in listing", () => {
    const html = renderToStaticMarkup(createElement(TrustCard, {
      data: {
        ...trustBase,
        agentId: "13851",
        listingStatus: "found",
        connectionStatus: "passed",
        endpointAssociation: "verified",
        signals: [
          { id: "listing_page", status: "pass" as const, detail: "HTTP 200" },
        ],
      },
    }));

    expect(html).toContain("Listing &amp; connection check");
    expect(html).toContain("Listing found");
    expect(html).toContain("Declared in listing");
  });

  it("renders Unknown and never No for undefined wallet, payment, and mainnet", () => {
    const html = renderToStaticMarkup(createElement(ReadinessRunCard, {
      data: {
        ...readinessData,
        resource: undefined,
      },
      onRescan: () => {},
      onApplyHost: () => {},
    }));

    expect(html).toContain("Access: Unknown");
    expect(html).toContain("Payment required: Unknown");
    expect(html).toContain("Wallet required: Unknown");
    expect(html).toContain("Mainnet: Unknown");
    expect(html).not.toContain("Payment required: No");
    expect(html).not.toContain("Wallet required: No");
    expect(html).not.toContain("Mainnet: No");

    const trustHtml = renderToStaticMarkup(createElement(TrustCard, {
      data: {
        ...trustBase,
        resource: undefined,
      },
    }));
    expect(trustHtml).toContain("Listing &amp; connection check");
    expect(trustHtml).toContain("Service delivery, output quality and payment outcomes were not assessed.");
  });

  it("distinguishes Yes, No, and Unknown correctly in boundary values", () => {
    const html = renderToStaticMarkup(createElement(ReadinessRunCard, {
      data: {
        ...readinessData,
        resource: {
          access: "metered",
          paymentRequired: true,
          walletRequired: false,
          mainnet: undefined,
        },
      },
      onRescan: () => {},
      onApplyHost: () => {},
    }));

    expect(html).toContain("Access: Metered");
    expect(html).toContain("Payment required: Yes");
    expect(html).toContain("Wallet required: No");
    expect(html).toContain("Mainnet: Unknown");
  });

  it("removes '· OKX.ai Marketplace Agent' from TrustCard and uses localized accurate provenance", () => {
    const html = renderToStaticMarkup(createElement(TrustCard, {
      data: {
        ...trustBase,
        agentName: "Markets",
        score: "4.9",
      },
    }));

    expect(html).not.toContain("· OKX.ai Marketplace Agent");
    // The agent name comes from the okx.ai listing page, not the sample registry.
    expect(html).not.toContain("Local registry");
  });

  it("uses distinct default provenance for readiness vs trust cards", () => {
    const readinessHtml = renderToStaticMarkup(createElement(ReadinessRunCard, {
      data: {
        ...readinessData,
        resource: undefined,
      },
    }));
    const source = (html: string) => html.match(/Source: ([^<]+)/)?.[1];
    expect(source(readinessHtml)).toBeTruthy();

    const trustHtml = renderToStaticMarkup(createElement(TrustCard, {
      data: {
        ...trustBase,
        resource: undefined,
      },
    }));
    expect(trustHtml).toContain("okx.ai listing page; not an OKX endorsement");
  });

  it("renders limitations and last-checked when supplied", () => {
    const readinessHtml = renderToStaticMarkup(createElement(ReadinessRunCard, {
      data: {
        ...readinessData,
        lastChecked: "2026-10-02 12:00 UTC",
        limitations: ["Endpoint rate limit: 60 rpm", "Free tier only"],
      },
    }));
    expect(readinessHtml).toContain("Last checked: 2026-10-02 12:00 UTC");
    expect(readinessHtml).toContain("Endpoint rate limit: 60 rpm");
    expect(readinessHtml).toContain("Free tier only");

    const trustHtml = renderToStaticMarkup(createElement(TrustCard, {
      data: {
        ...trustBase,
        lastChecked: "2026-10-02 14:00 UTC",
        limitations: ["No on-chain history", "Testnet only"],
      },
    }));
    expect(trustHtml).toContain("Last checked: 2026-10-02 14:00 UTC");
    expect(trustHtml).toContain("No on-chain history");
    expect(trustHtml).toContain("Testnet only");
  });

  it("structures cards with actionable sections and lengthy metadata in expandable details", () => {
    const readinessHtml = renderToStaticMarkup(createElement(ReadinessRunCard, {
      data: {
        ...readinessData,
        checks: [
          { id: "https_scheme", status: "pass", detail: "https" },
          { id: "host_pitfall", status: "fail", detail: "host=demo.vercel.app" },
        ],
        remediation: ["Switch to Railway host"],
      },
    }));

    expect(readinessHtml).toContain("<details");
    expect(readinessHtml).toContain("Details &amp; metadata");
    expect(readinessHtml).toContain("Failed checks (1)");
    expect(readinessHtml).toContain("Switch to Railway host");

    const trustHtml = renderToStaticMarkup(createElement(TrustCard, {
      data: {
        ...trustBase,
        services: [
          { serviceId: "s1", name: "Market Snapshot", description: "Real-time snapshot", price: "0" },
        ],
      },
    }));

    expect(trustHtml).toContain("<details");
    expect(trustHtml).toContain("Run details");
    expect(trustHtml).toContain("Activity");
  });
});
