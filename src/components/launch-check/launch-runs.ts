import type { Message } from "@/state/store";
import type { Routine, RoutineRun } from "@/lib/routines";
import { parseOkxActionCard, type ReadinessRunCardData } from "@/lib/okx-action-cards";
import { compareReadiness, type ReadinessComparison } from "@/lib/launch-check";
import { OKX_DEMO_TOOLS } from "../../../shared/okx-demo-identity";

/** One recorded service check in the room, oldest first. `data` is null when
 * the call failed or the response could not be read; `error` then says why. */
export type ServiceCheck = {
  id: string;
  at: number;
  data: ReadinessRunCardData | null;
  error: string | null;
  /** The monitor run that produced this check, when one did. */
  monitorRun: RoutineRun | null;
  /** Compared with the previous readable check, when there is one. */
  comparison: ReadinessComparison | null;
  raw: string;
};

export type ServiceHealth = "working" | "attention" | "unverified";

export function healthOf(check: ServiceCheck): ServiceHealth {
  if (!check.data) return "unverified";
  if (check.data.verdict === "PASS") return "working";
  if (check.data.verdict === "WARN") return "attention";
  return "unverified";
}

/** Pairs a check with the monitor run that finished closest to it (within a
 * few seconds). Unpaired checks were started by hand. */
function pairRun(at: number, runs: RoutineRun[], used: Set<string>): RoutineRun | null {
  let best: RoutineRun | null = null;
  for (const run of runs) {
    if (used.has(run.id) || run.finishedAt === undefined || run.startedAt === undefined) continue;
    if (at < run.startedAt - 1_000 || Math.abs(run.finishedAt - at) > 5_000) continue;
    if (!best || Math.abs(run.finishedAt - at) < Math.abs((best.finishedAt ?? 0) - at)) best = run;
  }
  if (best) used.add(best.id);
  return best;
}

export function serviceChecks(messages: Message[], runs: RoutineRun[]): ServiceCheck[] {
  const used = new Set<string>();
  const checks: ServiceCheck[] = [];
  let previous: ReadinessRunCardData | null = null;
  for (const message of [...messages].sort((a, b) => a.at - b.at)) {
    const tool = message.tool;
    if (!tool || tool.name !== OKX_DEMO_TOOLS.endpoint) continue;
    const parsed = tool.ok === false ? null : parseOkxActionCard(tool);
    const data = parsed?.kind === "readiness" ? parsed : null;
    checks.push({
      id: message.id,
      at: message.at,
      data,
      error: data ? null : failureText(tool.output),
      monitorRun: pairRun(message.at, runs, used),
      comparison: data && previous ? compareReadiness(previous, data) : null,
      raw: tool.output ?? "",
    });
    if (data) previous = data;
  }
  return checks;
}

function failureText(output: string | undefined): string {
  if (!output) return "";
  try {
    const parsed: unknown = JSON.parse(output);
    if (parsed && typeof parsed === "object" && "error" in parsed && typeof parsed.error === "string") return parsed.error;
  } catch {
    // Not JSON: show the text as the service returned it.
  }
  return output.slice(0, 300);
}

export type MonitorCadenceLabel = "minute" | "hour" | "other";

export function cadenceOf(routine: Routine): MonitorCadenceLabel {
  if (routine.schedule.type !== "cron") return "other";
  if (routine.schedule.expression === "* * * * *") return "minute";
  if (routine.schedule.expression === "0 * * * *") return "hour";
  return "other";
}
