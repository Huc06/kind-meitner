import { randomUUID } from "node:crypto";
import { diffOutdoorWindows, type OutdoorWindowItem } from "../../shared/connected-services.ts";
import type { ConnectedServiceRegistry } from "./connected-services.ts";

export interface OutdoorWindowDeliverable {
  content?: Array<{ type: string; text: string }>;
  structuredContent?: {
    location?: { resolved_name?: string };
    windows?: OutdoorWindowItem[];
    [key: string]: unknown;
  };
}

export interface ScheduleRunRecord {
  runNumber: number;
  runAt: number;
  durationMs: number;
  ok: boolean;
  diffText: string;
  summaryText: string;
  bestWindow?: OutdoorWindowItem;
  error?: string;
}

export interface OutcomeSchedule {
  id: string;
  serviceId: "outdoorwindow";
  toolName: "get_outdoor_windows";
  inputs: {
    place: string;
    activity: string;
    duration_minutes: number;
    [key: string]: unknown;
  };
  intervalMinutes: number;
  maxRuns: number;
  runCount: number;
  status: "active" | "paused" | "completed" | "cancelled";
  threadId?: string;
  createdAt: number;
  lastRunAt?: number;
  nextRunAt?: number;
  inFlight: boolean;
  lastWindows?: OutdoorWindowItem[];
  history: ScheduleRunRecord[];
}

export interface MessageAppendSink {
  appendMessage(threadId: string, message: {
    role: "bot" | "user";
    kind: "activity" | "text";
    text?: string;
    tool?: { name: string; ok: boolean; summary: string; output?: string };
  }): unknown;
}

export class OutcomeScheduler {
  private readonly schedules: Map<string, OutcomeSchedule> = new Map();
  private readonly registry: ConnectedServiceRegistry;
  private readonly storeSink?: MessageAppendSink;
  private timer?: NodeJS.Timeout;

  constructor(registry: ConnectedServiceRegistry, storeSink?: MessageAppendSink) {
    this.registry = registry;
    this.storeSink = storeSink;
  }

  start(tickIntervalMs = 5_000): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, tickIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  createSchedule(options: {
    place: string;
    activity?: string;
    duration_minutes?: number;
    intervalMinutes?: number;
    maxRuns?: number;
    threadId?: string;
  }): OutcomeSchedule {
    const intervalMinutes = Math.max(1, options.intervalMinutes ?? 1);
    // Safety guard: Demo 1-minute schedules are strictly capped at 3 runs with no overlap
    const maxRuns = intervalMinutes === 1 ? Math.min(options.maxRuns ?? 3, 3) : Math.max(1, options.maxRuns ?? 3);

    const schedule: OutcomeSchedule = {
      id: `sched-${randomUUID().slice(0, 8)}`,
      serviceId: "outdoorwindow",
      toolName: "get_outdoor_windows",
      inputs: {
        place: options.place,
        activity: options.activity ?? "run",
        duration_minutes: options.duration_minutes ?? 45,
      },
      intervalMinutes,
      maxRuns,
      runCount: 0,
      status: "active",
      threadId: options.threadId,
      createdAt: Date.now(),
      nextRunAt: Date.now(), // Trigger first run immediately
      inFlight: false,
      history: [],
    };

    this.schedules.set(schedule.id, schedule);
    return schedule;
  }

  getSchedule(id: string): OutcomeSchedule | undefined {
    return this.schedules.get(id);
  }

  listSchedules(): OutcomeSchedule[] {
    return Array.from(this.schedules.values());
  }

  pause(id: string): OutcomeSchedule {
    const schedule = this.schedules.get(id);
    if (!schedule) throw new Error(`Schedule ${id} not found`);
    if (schedule.status === "active") {
      schedule.status = "paused";
    }
    return schedule;
  }

  resume(id: string): OutcomeSchedule {
    const schedule = this.schedules.get(id);
    if (!schedule) throw new Error(`Schedule ${id} not found`);
    if (schedule.status === "paused") {
      schedule.status = "active";
      schedule.nextRunAt = Date.now();
    }
    return schedule;
  }

  cancel(id: string): OutcomeSchedule {
    const schedule = this.schedules.get(id);
    if (!schedule) throw new Error(`Schedule ${id} not found`);
    schedule.status = "cancelled";
    return schedule;
  }

  async executeRun(id: string): Promise<ScheduleRunRecord | null> {
    const schedule = this.schedules.get(id);
    if (!schedule) return null;
    if (schedule.status !== "active") return null;
    if (schedule.runCount >= schedule.maxRuns) {
      schedule.status = "completed";
      return null;
    }

    // Overlap prevention: Skip if prior run is still in-flight
    if (schedule.inFlight) {
      return null;
    }

    schedule.inFlight = true;
    const runNumber = schedule.runCount + 1;

    try {
      const res = await this.registry.executePinnedTool({
        serviceId: schedule.serviceId,
        toolName: schedule.toolName,
        arguments: schedule.inputs,
      });

      const deliverable = res.result as OutdoorWindowDeliverable | undefined;
      const currentWindows = deliverable?.structuredContent?.windows ?? [];
      const bestWindow = currentWindows[0];
      const summaryText = deliverable?.content?.[0]?.text ?? (res.error ? `Failed: ${res.error}` : "Window computed");

      // Calculate diff against previous run
      const diffText = schedule.history.length === 0
        ? `Run 1/${schedule.maxRuns} initial window captured: score ${bestWindow?.score ?? "N/A"}`
        : diffOutdoorWindows(schedule.lastWindows, currentWindows);

      const record: ScheduleRunRecord = {
        runNumber,
        runAt: Date.now(),
        durationMs: res.durationMs,
        ok: res.ok,
        diffText,
        summaryText,
        bestWindow,
        error: res.error,
      };

      schedule.history.push(record);
      schedule.runCount = runNumber;
      schedule.lastRunAt = record.runAt;
      schedule.lastWindows = currentWindows;
      schedule.nextRunAt = schedule.runCount < schedule.maxRuns
        ? Date.now() + schedule.intervalMinutes * 60_000
        : undefined;

      if (schedule.runCount >= schedule.maxRuns) {
        schedule.status = "completed";
      }

      // Append to room transcript and activity if threadId is set
      if (schedule.threadId && this.storeSink) {
        this.storeSink.appendMessage(schedule.threadId, {
          role: "bot",
          kind: "activity",
          text: `[OutdoorWindow scheduled run ${runNumber}/${schedule.maxRuns}] ${diffText}`,
          tool: {
            name: "get_outdoor_windows",
            ok: res.ok,
            summary: `Scheduled OutdoorWindow update · Run ${runNumber}/${schedule.maxRuns}`,
            output: JSON.stringify({ diff: diffText, summary: summaryText, bestWindow }),
          },
        });
      }

      return record;
    } finally {
      schedule.inFlight = false;
    }
  }

  async tick(): Promise<void> {
    const now = Date.now();
    for (const schedule of this.schedules.values()) {
      if (
        schedule.status === "active" &&
        !schedule.inFlight &&
        schedule.runCount < schedule.maxRuns &&
        schedule.nextRunAt &&
        now >= schedule.nextRunAt
      ) {
        await this.executeRun(schedule.id);
      }
    }
  }
}
