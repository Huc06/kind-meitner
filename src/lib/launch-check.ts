import type { GateSignal, GateStatus, ReadinessRunCardData, ReadinessVerdict } from "./okx-action-cards";

/** How often a launch monitor repeats. "minute" exists only to make a second
 * run visible during a live demonstration. */
export type MonitorCadence = "minute" | "hour";

export const MONITOR_CRON: Record<MonitorCadence, string> = {
  minute: "* * * * *",
  hour: "0 * * * *",
};

export type LaunchPlan = {
  check: boolean;
  explain: boolean;
  monitor: MonitorCadence | null;
};

/** What the coordinator understood from one chat line. Rule-based on
 * purpose: the demo coordinator never asks a model to decide which tool runs. */
export type LaunchIntent =
  | { kind: "plan"; plan: LaunchPlan }
  | { kind: "explain" }
  | { kind: "schedule"; cadence: MonitorCadence; team: boolean }
  | { kind: "unknown" };

const MONITOR_WORDS = /\b(keep checking|keep an eye|monitor\w*|every\s+(?:\d+\s+)?(?:minute|hour)s?|hourly|each\s+(?:minute|hour)|schedule\w*)\b/;
const CHECK_WORDS = /\b(check\w*|verify|test|works?|working|scan|run)\b/;
const EXPLAIN_WORDS = /\b(explain|what does|what do|mean\w*|why|fix)\b/;
const TEAM_WORDS = /\b(team|together)\b/;

function cadenceOf(text: string): MonitorCadence | null {
  if (!MONITOR_WORDS.test(text)) return null;
  if (/\bhour(?:ly|s)?\b/.test(text)) return "hour";
  return "minute";
}

/** `hasResult` is whether a readiness result already exists in this room, so a
 * follow-up "keep checking" schedules the same check instead of re-planning. */
export function interpretLaunchRequest(input: string, hasResult: boolean): LaunchIntent {
  const text = input.toLowerCase().replace(/\s+/g, " ").trim();
  if (!text) return { kind: "unknown" };
  const cadence = cadenceOf(text);
  if (cadence && hasResult) return { kind: "schedule", cadence, team: TEAM_WORDS.test(text) };
  const explain = EXPLAIN_WORDS.test(text);
  if (CHECK_WORDS.test(text) || cadence) {
    return { kind: "plan", plan: { check: true, explain, monitor: cadence } };
  }
  if (explain) return { kind: "explain" };
  return { kind: "unknown" };
}

export type ReadinessExplanation = {
  verdict: ReadinessVerdict;
  /** Checks that did not pass, exactly as the service reported them. */
  findings: GateSignal[];
  /** The service's own remediation lines; never generated here. */
  fixes: string[];
  passed: number;
  total: number;
};

/** Explains only what the result contains: the verdict, the non-passing
 * checks with their reported detail, and the service's remediation. */
export function explainReadiness(data: ReadinessRunCardData): ReadinessExplanation {
  return {
    verdict: data.verdict,
    findings: data.checks.filter((check) => check.status === "fail" || check.status === "warn"),
    fixes: data.remediation.slice(0, 3),
    passed: data.checks.filter((check) => check.status === "pass").length,
    total: data.checks.length,
  };
}

export type CheckChange = { id: string; from: GateStatus | "missing"; to: GateStatus | "missing" };

export type ReadinessComparison = {
  changed: boolean;
  verdictFrom: ReadinessVerdict;
  verdictTo: ReadinessVerdict;
  checks: CheckChange[];
};

/** Compares two runs by verdict and per-check status. Detail text (latency,
 * timestamps) is ignored so an unchanged service reads as unchanged. */
export function compareReadiness(previous: ReadinessRunCardData, next: ReadinessRunCardData): ReadinessComparison {
  const before = new Map(previous.checks.map((check) => [check.id, check.status]));
  const after = new Map(next.checks.map((check) => [check.id, check.status]));
  const checks: CheckChange[] = [];
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const from = before.get(id) ?? "missing";
    const to = after.get(id) ?? "missing";
    if (from !== to) checks.push({ id, from, to });
  }
  return {
    changed: previous.verdict !== next.verdict || checks.length > 0,
    verdictFrom: previous.verdict,
    verdictTo: next.verdict,
    checks,
  };
}
