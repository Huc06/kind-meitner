import { describe, expect, it } from "vitest";

import type { Message } from "@/state/store";
import type { RoutineRun } from "@/lib/routines";
import { healthOf, serviceChecks } from "./launch-runs";

const envelope = (verdict: string, status: string) => JSON.stringify({
  resource: { access: "free" },
  data: {
    endpointUrl: "https://service.example/mcp",
    verdict,
    checks: [{ id: "tools_list_http", status, detail: "status=200" }],
    remediation: verdict === "PASS" ? [] : ["Use a public HTTPS endpoint."],
  },
});

const check = (id: string, at: number, ok: boolean, output: string): Message => ({
  id, role: "bot", kind: "activity", at,
  tool: { name: "scan_free_mcp_readiness", ok, output },
});

const run = (id: string, startedAt: number, finishedAt: number): RoutineRun => ({
  id, routineId: "r1", routineName: "Monitor", target: "okx-task", botId: "b", runOn: "maus",
  scheduledFor: startedAt, status: "completed", manual: false, startedAt, finishedAt, createdAt: startedAt,
});

describe("serviceChecks", () => {
  it("keeps a failed call unverified with the service's own error, never a pass", () => {
    const [failed] = serviceChecks([check("m1", 1_000, false, JSON.stringify({ error: "HTTP 503: Service Unavailable" }))], []);
    expect(failed?.data).toBeNull();
    expect(failed?.error).toBe("HTTP 503: Service Unavailable");
    expect(healthOf(failed!)).toBe("unverified");
  });

  it("pairs monitor runs by time and leaves hand-started checks unpaired", () => {
    const checks = serviceChecks(
      [check("manual", 10_000, true, envelope("PASS", "pass")), check("scheduled", 70_400, true, envelope("PASS", "pass"))],
      [run("run-1", 70_000, 70_450)],
    );
    expect(checks.map((c) => c.monitorRun?.id ?? null)).toEqual([null, "run-1"]);
  });

  it("compares each readable result with the previous readable one, skipping failures", () => {
    const checks = serviceChecks([
      check("a", 1_000, true, envelope("PASS", "pass")),
      check("b", 2_000, false, "timeout"),
      check("c", 3_000, true, envelope("FAIL", "fail")),
    ], []);
    expect(checks[0]?.comparison).toBeNull();
    expect(checks[1]?.comparison).toBeNull();
    expect(checks[2]?.comparison).toMatchObject({ changed: true, verdictFrom: "PASS", verdictTo: "FAIL" });
    expect(healthOf(checks[2]!)).toBe("unverified");
  });
});
