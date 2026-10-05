import { describe, expect, it } from "vitest";

import { compareReadiness, explainReadiness, interpretLaunchRequest } from "./launch-check";
import type { ReadinessRunCardData } from "./okx-action-cards";

const run = (verdict: ReadinessRunCardData["verdict"], statuses: Record<string, "pass" | "warn" | "fail">, detail = "x"): ReadinessRunCardData => ({
  kind: "readiness",
  endpointUrl: "https://service.example/mcp",
  verdict,
  checks: Object.entries(statuses).map(([id, status]) => ({ id, status, detail })),
  remediation: verdict === "PASS" ? [] : ["Use a public HTTPS endpoint."],
  rawJson: "{}",
});

describe("interpretLaunchRequest", () => {
  it("plans check, explain and a one-minute monitor from the opening request", () => {
    expect(interpretLaunchRequest(
      "Before I publish my agent service, check that it works, explain anything I need to fix, and keep checking it every minute.",
      false,
    )).toEqual({ kind: "plan", plan: { check: true, explain: true, monitor: "minute" } });
  });

  it("answers a question about the result without re-running anything", () => {
    expect(interpretLaunchRequest("What does that mean?", true)).toEqual({ kind: "explain" });
  });

  it("turns a follow-up into a schedule once a result exists", () => {
    expect(interpretLaunchRequest("Keep checking it every minute and tell me if anything changes.", true))
      .toEqual({ kind: "schedule", cadence: "minute", team: false });
    expect(interpretLaunchRequest("Can the team handle this together every hour after the demo?", true))
      .toEqual({ kind: "schedule", cadence: "hour", team: true });
  });

  it("plans first when monitoring is requested before any result exists", () => {
    expect(interpretLaunchRequest("monitor it hourly", false))
      .toEqual({ kind: "plan", plan: { check: true, explain: false, monitor: "hour" } });
  });

  it("does not guess at unrelated requests", () => {
    expect(interpretLaunchRequest("send 5 USDT to Alice", true)).toEqual({ kind: "unknown" });
    expect(interpretLaunchRequest("   ", false)).toEqual({ kind: "unknown" });
  });
});

describe("explainReadiness", () => {
  it("cites only non-passing checks and the service's own fixes", () => {
    const failed = run("FAIL", { https_scheme: "pass", tools_list_http: "fail", initialize_soft: "warn" });
    const explanation = explainReadiness(failed);
    expect(explanation.verdict).toBe("FAIL");
    expect(explanation.findings.map((f) => f.id)).toEqual(["tools_list_http", "initialize_soft"]);
    expect(explanation.fixes).toEqual(["Use a public HTTPS endpoint."]);
    expect([explanation.passed, explanation.total]).toEqual([1, 3]);
  });

  it("has no findings to invent for a clean pass", () => {
    const explanation = explainReadiness(run("PASS", { a: "pass", b: "pass" }));
    expect(explanation.findings).toEqual([]);
    expect(explanation.fixes).toEqual([]);
  });
});

describe("compareReadiness", () => {
  it("treats a repeat with different detail text as unchanged", () => {
    const comparison = compareReadiness(run("PASS", { a: "pass" }, "12ms"), run("PASS", { a: "pass" }, "40ms"));
    expect(comparison.changed).toBe(false);
  });

  it("reports verdict and per-check transitions, including appearing checks", () => {
    const comparison = compareReadiness(run("PASS", { a: "pass" }), run("FAIL", { a: "fail", b: "warn" }));
    expect(comparison).toMatchObject({ changed: true, verdictFrom: "PASS", verdictTo: "FAIL" });
    expect(comparison.checks).toEqual([
      { id: "a", from: "pass", to: "fail" },
      { id: "b", from: "missing", to: "warn" },
    ]);
  });
});
