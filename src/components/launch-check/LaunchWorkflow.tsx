import { t } from "@/lib/i18n";
import type { Routine } from "@/lib/routines";
import { cn } from "@/lib/cn";
import { healthOf, type ServiceCheck } from "./launch-runs";

type StepStatus = "waiting" | "running" | "completed" | "attention" | "failed" | "paused" | "active";

const STATUS_KEY = {
  waiting: "launch.status.waiting",
  running: "launch.status.running",
  completed: "launch.status.completed",
  attention: "launch.status.attention",
  failed: "launch.status.failed",
  paused: "launch.status.paused",
  active: "launch.status.active",
} as const satisfies Record<StepStatus, string>;

const STATUS_TONE: Record<StepStatus, string> = {
  waiting: "text-ink-secondary border-hairline",
  running: "text-accent border-accent/50",
  completed: "text-success border-success/50",
  attention: "text-warning border-warning/50",
  failed: "text-danger border-danger/50",
  paused: "text-ink-secondary border-hairline",
  active: "text-success border-success/50",
};

function Step({ name, who, does, status }: { name: string; who: string; does: string; status: StepStatus }) {
  return (
    <li className="min-w-0 rounded border border-hairline bg-inset p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-[13px] font-semibold">{name}</span>
        <span className={cn("label-mono rounded border px-1.5 py-0.5", STATUS_TONE[status])}>{t(STATUS_KEY[status])}</span>
      </div>
      <p className="mt-1 text-[12px]">{does}</p>
      <p className="mt-0.5 text-[11.5px] text-ink-secondary break-words">{who}</p>
    </li>
  );
}

/** Workflow steps with their real status. Only one coordinator runs these
 * steps, so they are shown as steps of one agent, never as separate agents. */
export function LaunchWorkflow({ latest, running, monitor, hasMonitor, coordinatorName }: {
  latest: ServiceCheck | null;
  running: boolean;
  monitor: Routine | null;
  hasMonitor: boolean;
  coordinatorName: string | null;
}) {
  const health = latest ? healthOf(latest) : null;
  const checker: StepStatus = running ? "running" : !latest ? "waiting" : !latest.data ? "failed" : health === "working" ? "completed" : "attention";
  const explainer: StepStatus = running ? "waiting" : latest ? "completed" : "waiting";
  const monitorStatus: StepStatus = monitor ? "active" : hasMonitor ? "paused" : "waiting";

  return (
    <section aria-labelledby="launch-workflow-title" className="rounded border border-hairline bg-surface p-4">
      <h2 id="launch-workflow-title" className="label-mono text-ink-secondary">{t("launch.workflow.title")}</h2>
      <p className="mt-1.5 text-[12.5px]">{t("launch.workflow.oneCoordinator")}</p>
      <ol className="mt-3 space-y-2">
        <li className="rounded border border-hairline bg-inset p-2.5 text-[13px]">
          <span className="font-semibold">{t("launch.role.user")}</span>
          <span className="ml-2 text-[12px] text-ink-secondary">{t("launch.workflow.userDoes")}</span>
        </li>
        <li aria-hidden="true" className="pl-4 text-ink-secondary">↓</li>
        <Step
          name={t("launch.role.coordinator")}
          who={t("launch.workflow.coordinatorWho", { bot: coordinatorName ?? "—" })}
          does={t("launch.workflow.coordinatorDoes")}
          status={running ? "running" : latest ? "completed" : "waiting"}
        />
        <li aria-hidden="true" className="pl-4 text-ink-secondary">↓</li>
        <li>
          <ol className="grid gap-2 sm:grid-cols-3" aria-label={t("launch.workflow.stepsLabel")}>
            <Step name={t("launch.role.checker")} who={t("launch.workflow.checkerWho")} does={t("launch.workflow.checkerDoes")} status={checker} />
            <Step name={t("launch.role.explainer")} who={t("launch.workflow.explainerWho")} does={t("launch.workflow.explainerDoes")} status={explainer} />
            <Step name={t("launch.role.monitor")} who={t("launch.workflow.monitorWho")} does={t("launch.workflow.monitorDoes")} status={monitorStatus} />
          </ol>
        </li>
      </ol>
    </section>
  );
}
