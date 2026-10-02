import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExternalAgentLabel } from "./ExternalAgentLabel";

const base = { connectionId: "c1", displayName: "Research Agent", provider: "Acme", requestId: "r1", status: "completed" as const };

describe("ExternalAgentLabel", () => {
  it("labels a direct reply with its transport, latency and as untrusted content", () => {
    const html = renderToStaticMarkup(createElement(ExternalAgentLabel, { external: { ...base, transport: "direct", provenance: "direct-endpoint", latencyMs: 812 } }));
    expect(html).toContain("Research Agent · direct endpoint");
    expect(html).toContain("812 ms");
    expect(html).toContain("Untrusted content");
    expect(html).not.toContain("data-content-flags");
    expect(html).not.toMatch(/official/i);
  });

  it("warns about filtered content", () => {
    const html = renderToStaticMarkup(createElement(ExternalAgentLabel, { external: { ...base, transport: "direct", provenance: "direct-endpoint", contentFlags: ["instructions-to-agents", "unsafe-link"] } }));
    expect(html).toContain("Contains instructions aimed at agents");
    expect(html).toContain("Unsafe link blocked");
  });

  it("names the upstream agent behind a zroute proxy", () => {
    const html = renderToStaticMarkup(createElement(ExternalAgentLabel, { external: { ...base, transport: "zroute", provenance: "zroute-proxy", upstreamName: "Acme Research" } }));
    expect(html).toContain("Research Agent · zroute proxy → Acme Research");
  });
});
