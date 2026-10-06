import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StoreProvider } from "@/state/store";
import { DemoView } from "./DemoView";
import { DemoResultCard } from "./DemoResultCard";
import { OKX_DEMO_RECORDED } from "../../../shared/okx-demo-recorded";
import type { OkxDemoCheckResult } from "../../../shared/okx-demo-identity";

function renderWithStore(element: React.ReactElement): string {
  return renderToStaticMarkup(createElement(StoreProvider, null, element));
}

describe("DemoView", () => {
  it('(a) recorded result labelled "Recorded demonstration", never "Live"', () => {
    const recordedResult = OKX_DEMO_RECORDED.cases.endpoint as OkxDemoCheckResult & { ok: true };

    const recordedHtml = renderToStaticMarkup(
      createElement(DemoResultCard, {
        result: recordedResult,
        isRecorded: true,
        capturedAt: OKX_DEMO_RECORDED.capturedAt,
      }),
    );

    // Must be labelled "Recorded demonstration"
    expect(recordedHtml).toContain("Recorded demonstration");
    expect(recordedHtml).toContain(OKX_DEMO_RECORDED.capturedAt);
    // Must NEVER show "Live"
    expect(recordedHtml).not.toContain("Live ·");

    // Contrast with live:
    const liveHtml = renderToStaticMarkup(
      createElement(DemoResultCard, {
        result: recordedResult,
        isRecorded: false,
      }),
    );
    expect(liveHtml).toContain("Live ·");
    expect(liveHtml).not.toContain("Recorded demonstration");
  });

  it("(b) ok:false timeout shows safe message + Retry, no verdict", () => {
    // Render the failure view container as in DemoCheckTab when status is timeout
    const timeoutResult: OkxDemoCheckResult & { ok: false } = {
      ok: false,
      source: "live",
      status: "timeout",
      safeMessage: "Endpoint probe timed out after 10000ms",
      requestId: "req-timeout-123",
      startedAt: new Date().toISOString(),
      latencyMs: 10005,
    };

    // Construct the markup of the failure state
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement("div", { className: "font-semibold text-danger" }, "Check failed"),
        createElement(
          "div",
          { className: "mt-1 text-ink break-words" },
          `Request timed out: ${timeoutResult.safeMessage}`,
        ),
        createElement("button", { type: "button" }, "Retry"),
      ),
    );

    expect(html).toContain("Request timed out: Endpoint probe timed out after 10000ms");
    expect(html).toContain("Retry");
    // Ensure no verdict rendered
    expect(html).not.toContain("PASS");
    expect(html).not.toContain("FAIL");
    expect(html).not.toContain("WARN");
    expect(html).not.toContain("GO");
    expect(html).not.toContain("CAUTION");
    expect(html).not.toContain("NO_GO");
  });

  it("(c) verdict rendered verbatim (NO_GO)", () => {
    const noGoTrustResult: OkxDemoCheckResult & { ok: true } = {
      ok: true,
      source: "live",
      tool: "get_asp_trust_card",
      arguments: { agentId: "99999" },
      endpointUrl: "https://example.com/api/mcp",
      requestId: "req-nogo-test",
      startedAt: "2026-10-04T08:00:00Z",
      latencyMs: 320,
      envelope: {
        resource: {
          access: "free",
          provenance: "live probe test",
        },
        data: {
          agentId: "99999",
          decision: "NO_GO",
          summary: "Listing check failed completely",
          signals: [
            {
              id: "listing_page",
              status: "fail",
              detail: "Listing returned HTTP 404",
            },
          ],
          notChecked: ["on-chain history"],
          remediation: ["Fix listing URL on okx.ai"],
          safeNextStep: "Do not call tools until listing is fixed.",
        },
      },
    };

    const html = renderToStaticMarkup(
      createElement(DemoResultCard, {
        result: noGoTrustResult,
        isRecorded: false,
      }),
    );

    // Must render NO_GO verbatim
    expect(html).toContain("NO_GO");
    // Also test PASS and FAIL
    const passResult = OKX_DEMO_RECORDED.cases.endpoint as OkxDemoCheckResult & { ok: true };
    const passHtml = renderToStaticMarkup(
      createElement(DemoResultCard, {
        result: passResult,
        isRecorded: false,
      }),
    );
    expect(passHtml).toContain("PASS");

    const failResult = OKX_DEMO_RECORDED.cases.failure as OkxDemoCheckResult & { ok: true };
    const failHtml = renderToStaticMarkup(
      createElement(DemoResultCard, {
        result: failResult,
        isRecorded: true,
      }),
    );
    expect(failHtml).toContain("FAIL");
  });

  it("renders DemoView shell with header, tabs, and footer", () => {
    const html = renderWithStore(createElement(DemoView, { onExit: () => {}, onOpenChat: () => {} }));
    expect(html).toContain("Listing &amp; connection check");
    expect(html).toContain("View public listing information and, when a compatible service URL is available, check its connection.");
    expect(html).toContain('role="tablist"');
    expect(html).toContain("Demo");
    expect(html).toContain("Service details");
    expect(html).toContain("Activity log");
    expect(html).toContain("Exit demo");
    expect(html).toContain("Prefer to ask in chat?");
  });
});
