import { describe, expect, it, vi } from "vitest";
import type { ConnectedServiceRegistry } from "./connected-services.ts";
import { OutcomeScheduler, type MessageAppendSink } from "./outcome-scheduler.ts";

describe("OutcomeScheduler", () => {
  function makeMockRegistry(mockResultGenerator: () => unknown) {
    return {
      executePinnedTool: vi.fn().mockImplementation(async () => {
        return {
          ok: true,
          durationMs: 45,
          result: mockResultGenerator(),
        };
      }),
    } as unknown as ConnectedServiceRegistry;
  }

  it("strictly enforces max 3 runs cap for 1-minute demo schedules", () => {
    const registry = makeMockRegistry(() => ({}));
    const scheduler = new OutcomeScheduler(registry);

    const sched = scheduler.createSchedule({
      place: "Singapore",
      intervalMinutes: 1,
      maxRuns: 10, // requested 10, must be clamped to 3
    });

    expect(sched.maxRuns).toBe(3);
    expect(sched.intervalMinutes).toBe(1);
    expect(sched.status).toBe("active");
  });

  it("prevents overlapping execution when a run is already in flight", async () => {
    let resolveExecution!: (val: unknown) => void;
    const promise = new Promise((resolve) => {
      resolveExecution = resolve;
    });
    const registry = {
      executePinnedTool: vi.fn().mockReturnValue(promise),
    } as unknown as ConnectedServiceRegistry;

    const scheduler = new OutcomeScheduler(registry);
    const sched = scheduler.createSchedule({ place: "Singapore" });

    // Start first run (stays in-flight)
    const runPromise1 = scheduler.executeRun(sched.id);
    expect(sched.inFlight).toBe(true);

    // Attempt second run while first is in-flight -> must return null (skipped)
    const runPromise2 = await scheduler.executeRun(sched.id);
    expect(runPromise2).toBeNull();
    expect(registry.executePinnedTool).toHaveBeenCalledTimes(1);

    // Finish first run
    resolveExecution!({
      ok: true,
      durationMs: 50,
      result: {
        structuredContent: {
          windows: [{ rank: 1, start: "T1", end: "T2", score: 80, limiting_factor: "AQI" }],
        },
      },
    });

    const run1Result = await runPromise1;
    expect(run1Result?.ok).toBe(true);
    expect(sched.inFlight).toBe(false);
    expect(sched.runCount).toBe(1);
  });

  it("diffs consecutive runs and detects identical window vs score change", async () => {
    let callCount = 0;
    const registry = makeMockRegistry(() => {
      callCount++;
      return {
        content: [{ type: "text", text: `Run ${callCount} summary` }],
        structuredContent: {
          windows: [
            {
              rank: 1,
              start: "2026-10-08T05:00:00+08:00",
              end: "2026-10-08T05:45:00+08:00",
              score: callCount === 1 ? 83 : callCount === 2 ? 83 : 87,
              limiting_factor: "PM2.5 AQI 147",
            },
          ],
        },
      };
    });

    const appendSpy = vi.fn();
    const sink: MessageAppendSink = { appendMessage: appendSpy };
    const scheduler = new OutcomeScheduler(registry, sink);
    const sched = scheduler.createSchedule({ place: "Singapore", threadId: "room-thread-1" });

    // Run 1: Initial capture
    const r1 = await scheduler.executeRun(sched.id);
    expect(r1?.runNumber).toBe(1);
    expect(r1?.diffText).toContain("Run 1/3 initial window captured");
    expect(appendSpy).toHaveBeenCalledTimes(1);

    // Run 2: Same data -> "No change since last run"
    const r2 = await scheduler.executeRun(sched.id);
    expect(r2?.runNumber).toBe(2);
    expect(r2?.diffText).toBe("No change since last run");
    expect(appendSpy).toHaveBeenCalledTimes(2);

    // Run 3: Changed score (83 -> 87)
    const r3 = await scheduler.executeRun(sched.id);
    expect(r3?.runNumber).toBe(3);
    expect(r3?.diffText).toContain("Suitability score: 83 → 87");
    expect(sched.status).toBe("completed"); // Reached cap of 3
    expect(appendSpy).toHaveBeenCalledTimes(3);

    // Run 4 should not execute because status is completed
    const r4 = await scheduler.executeRun(sched.id);
    expect(r4).toBeNull();
  });

  it("handles pause, resume, and cancel lifecycle transitions", () => {
    const registry = makeMockRegistry(() => ({}));
    const scheduler = new OutcomeScheduler(registry);
    const sched = scheduler.createSchedule({ place: "Singapore" });

    expect(sched.status).toBe("active");
    scheduler.pause(sched.id);
    expect(sched.status).toBe("paused");

    scheduler.resume(sched.id);
    expect(sched.status).toBe("active");

    scheduler.cancel(sched.id);
    expect(sched.status).toBe("cancelled");
  });
});
