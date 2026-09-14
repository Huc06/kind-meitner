import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { OkxGateway } from "./gateway.ts";
import {
  DEFAULT_DEFECT_MARKERS,
  ESCROW_WINDOW_MS,
  evaluateDeliverableCriteria,
  getTaskDeliveredAt,
  OkxDeliveryWatcher,
  URGENT_BUFFER_MS,
} from "./watcher.ts";

const dirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "omb-okx-watcher-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const d of dirs) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
  dirs.length = 0;
});

describe("OkxDeliveryWatcher & Escrow Review Daemon", () => {
  describe("Constants & Acceptance Criteria Verification", () => {
    it("defines exact 72-hour escrow window and 12-hour urgent buffer", () => {
      expect(ESCROW_WINDOW_MS).toBe(72 * 60 * 60 * 1000);
      expect(ESCROW_WINDOW_MS).toBe(259_200_000);

      expect(URGENT_BUFFER_MS).toBe(12 * 60 * 60 * 1000);
      expect(URGENT_BUFFER_MS).toBe(43_200_000);
    });

    it("verifies deliverable criteria: accepts clean deliverables and rejects defective markers", () => {
      // 1. Clean valid deliverable passes
      const clean = evaluateDeliverableCriteria("https://github.com/project/release/v1.0.0 - all tests green");
      expect(clean.passed).toBe(true);
      expect(clean.reason).toBeUndefined();

      // 2. Missing or undefined deliverable fails
      const missing = evaluateDeliverableCriteria(undefined);
      expect(missing.passed).toBe(false);
      expect(missing.reason).toContain("missing or undefined");

      // 3. Empty or whitespace deliverable fails
      const empty = evaluateDeliverableCriteria("   \n\t  ");
      expect(empty.passed).toBe(false);
      expect(empty.reason).toContain("empty");

      // 4. Fatal defect markers fail
      for (const marker of DEFAULT_DEFECT_MARKERS) {
        const defective = evaluateDeliverableCriteria(
          `Delivery summary: Completed implementation but encountered ${marker} during execution`,
        );
        expect(defective.passed).toBe(false);
        expect(defective.defectMarker).toBe(marker);
        expect(defective.reason).toContain(marker);
      }
    });
  });

  describe("72-Hour Window Timing & Urgent Threshold Calculations", () => {
    const baseTime = 1789365000000;

    it("calculates delivery deadlines and remaining review window accurately", () => {
      const gateway = new OkxGateway();
      const watcher = new OkxDeliveryWatcher({ gateway, now: () => baseTime });

      const task = {
        id: "task-timing-1",
        title: "Timing Task",
        spec: "Spec",
        status: "delivered" as const,
        deliverable: "https://example.com/ok",
        createdAt: baseTime,
        updatedAt: baseTime,
        metadata: { deliveredAt: baseTime },
      };

      const deadline = watcher.getDeliveryDeadline(task);
      expect(deadline).toBe(baseTime + ESCROW_WINDOW_MS);
      expect(deadline - baseTime).toBe(259_200_000);

      // Immediately after delivery: 72 hours remaining
      expect(watcher.getTimeRemainingMs(task, baseTime)).toBe(ESCROW_WINDOW_MS);
      expect(watcher.isUrgent(task, baseTime)).toBe(false);
      expect(watcher.isExpired(task, baseTime)).toBe(false);

      // 24 hours elapsed: 48 hours remaining (> 12h urgent buffer)
      const after24h = baseTime + 24 * 60 * 60 * 1000;
      expect(watcher.getTimeRemainingMs(task, after24h)).toBe(48 * 60 * 60 * 1000);
      expect(watcher.isUrgent(task, after24h)).toBe(false);
      expect(watcher.isExpired(task, after24h)).toBe(false);

      // 60 hours elapsed: exactly 12 hours remaining (urgent threshold boundary)
      const after60h = baseTime + 60 * 60 * 60 * 1000;
      expect(watcher.getTimeRemainingMs(task, after60h)).toBe(URGENT_BUFFER_MS);
      expect(watcher.isUrgent(task, after60h)).toBe(true);
      expect(watcher.isExpired(task, after60h)).toBe(false);

      // 68 hours elapsed: 4 hours remaining (urgent)
      const after68h = baseTime + 68 * 60 * 60 * 1000;
      expect(watcher.getTimeRemainingMs(task, after68h)).toBe(4 * 60 * 60 * 1000);
      expect(watcher.isUrgent(task, after68h)).toBe(true);
      expect(watcher.isExpired(task, after68h)).toBe(false);

      // Exactly 72 hours elapsed: 0ms remaining (expired)
      const after72h = baseTime + 72 * 60 * 60 * 1000;
      expect(watcher.getTimeRemainingMs(task, after72h)).toBe(0);
      expect(watcher.isUrgent(task, after72h)).toBe(false);
      expect(watcher.isExpired(task, after72h)).toBe(true);

      // 73 hours elapsed: overdue (-1 hour remaining)
      const after73h = baseTime + 73 * 60 * 60 * 1000;
      expect(watcher.getTimeRemainingMs(task, after73h)).toBe(-1 * 60 * 60 * 1000);
      expect(watcher.isUrgent(task, after73h)).toBe(false);
      expect(watcher.isExpired(task, after73h)).toBe(true);
    });

    it("resolves deliveredAt fallback across metadata, updatedAt, and createdAt", () => {
      const t1 = {
        id: "t1",
        title: "T1",
        spec: "S1",
        status: "delivered" as const,
        createdAt: 100,
        updatedAt: 200,
        metadata: { deliveredAt: 300 },
      };
      expect(getTaskDeliveredAt(t1)).toBe(300);

      const t2 = {
        id: "t2",
        title: "T2",
        spec: "S2",
        status: "delivered" as const,
        createdAt: 100,
        updatedAt: 200,
      };
      expect(getTaskDeliveredAt(t2)).toBe(200);

      const t3 = {
        id: "t3",
        title: "T3",
        spec: "S3",
        status: "created" as const,
        createdAt: 100,
        updatedAt: 200,
      };
      expect(getTaskDeliveredAt(t3)).toBe(100);
    });
  });

  describe("Automated Acceptance on Valid Deliverables", () => {
    it("calls agentAccept, updates ledger to completed, and emits delivery_accepted event", async () => {
      const dir = tempDir();
      const ledgerFile = join(dir, "tasks.json");
      const cliCommands: string[] = [];

      const runner = async (cmd: string, args: string[]) => {
        cliCommands.push(`${cmd} ${args.join(" ")}`);
        if (args[0] === "agent" && args[1] === "accept") {
          return {
            exitCode: 0,
            stdout: "Escrow released to seller tx: 0x9999000011112222333344445555666677778888aaaabbbbccccddddeeeeffff",
            stderr: "",
          };
        }
        return { exitCode: 0, stdout: "ok", stderr: "" };
      };

      const gateway = new OkxGateway({ ledgerFile, commandRunner: runner });
      gateway.ledger.recordTask({
        id: "task-valid-1",
        title: "Smart Contract Testing",
        spec: "Deliver 100% test coverage suite",
        status: "delivered",
        deliverable: "https://github.com/okx/audit-suite/pull/42 - all 85 tests passing with 0 errors",
        createdAt: Date.now() - 10_000,
        updatedAt: Date.now() - 5_000,
      });

      const watcher = new OkxDeliveryWatcher({ gateway });

      const acceptedEvents: any[] = [];
      watcher.on("delivery_accepted", (evt) => acceptedEvents.push(evt));

      const res = await watcher.checkTask("task-valid-1");

      expect(res.checked).toBe(true);
      expect(res.passed).toBe(true);
      expect(res.action).toBe("accepted");
      expect(res.txHash).toBe("0x9999000011112222333344445555666677778888aaaabbbbccccddddeeeeffff");

      // Verify CLI execution
      expect(cliCommands[0]).toBe("onchainos agent accept --task-id task-valid-1");

      // Verify ledger update
      const updated = gateway.ledger.getTask("task-valid-1");
      expect(updated?.status).toBe("completed");
      expect(updated?.txHash).toBe("0x9999000011112222333344445555666677778888aaaabbbbccccddddeeeeffff");

      // Verify event emission
      expect(acceptedEvents).toHaveLength(1);
      expect(acceptedEvents[0].task.id).toBe("task-valid-1");
      expect(acceptedEvents[0].txHash).toContain("0x99990000");

      watcher.destroy();
    });

    it("respects customEvaluator passing adjudication", async () => {
      const runner = async () => ({
        exitCode: 0,
        stdout: "tx: 0xaaaabbbbccccddddeeeeffff0000111122223333444455556666777788889999",
        stderr: "",
      });

      const gateway = new OkxGateway({ commandRunner: runner });
      gateway.ledger.recordTask({
        id: "task-custom-eval-pass",
        title: "Benchmark Report",
        spec: "Generate report",
        status: "delivered",
        deliverable: "Report artifact generated",
        createdAt: 1000,
        updatedAt: 1000,
      });

      let customEvaluatorCalled = false;
      const watcher = new OkxDeliveryWatcher({
        gateway,
        customEvaluator: async (task) => {
          customEvaluatorCalled = true;
          expect(task.id).toBe("task-custom-eval-pass");
          return { passed: true };
        },
      });

      const res = await watcher.checkTask("task-custom-eval-pass");
      expect(customEvaluatorCalled).toBe(true);
      expect(res.action).toBe("accepted");
      expect(gateway.ledger.getTask("task-custom-eval-pass")?.status).toBe("completed");

      watcher.destroy();
    });
  });

  describe("Automated Rejection and Dispute Escalation on Defective Deliverables", () => {
    it("calls agentReject and locks escrow into dispute when defect marker is detected", async () => {
      const cliCommands: string[] = [];
      const runner = async (cmd: string, args: string[]) => {
        cliCommands.push(`${cmd} ${args.join(" ")}`);
        if (args[0] === "agent" && args[1] === "reject") {
          return {
            exitCode: 0,
            stdout: "Dispute opened onchain tx: 0x7777888899990000111122223333444455556666aaaabbbbccccddddeeeeffff",
            stderr: "",
          };
        }
        return { exitCode: 0, stdout: "ok", stderr: "" };
      };

      const gateway = new OkxGateway({ commandRunner: runner });
      gateway.ledger.recordTask({
        id: "task-defect-1",
        title: "API Endpoint Implementation",
        spec: "Implement GET /api/v1/metrics",
        status: "delivered",
        deliverable: "Attempted build but encountered: BUILD FAILED at step 3",
        createdAt: Date.now() - 20_000,
        updatedAt: Date.now() - 10_000,
      });

      const watcher = new OkxDeliveryWatcher({ gateway });

      const rejectedEvents: any[] = [];
      watcher.on("delivery_rejected", (evt) => rejectedEvents.push(evt));

      const res = await watcher.checkTask("task-defect-1");

      expect(res.checked).toBe(true);
      expect(res.passed).toBe(false);
      expect(res.action).toBe("rejected");
      expect(res.reason).toContain("BUILD FAILED");
      expect(res.txHash).toBe("0x7777888899990000111122223333444455556666aaaabbbbccccddddeeeeffff");

      // Verify CLI execution with reason
      expect(cliCommands[0]).toContain("onchainos agent reject --task-id task-defect-1 --reason");
      expect(cliCommands[0]).toContain("BUILD FAILED");

      // Verify ledger update
      const updated = gateway.ledger.getTask("task-defect-1");
      expect(updated?.status).toBe("rejected");
      expect(updated?.rejectionReason).toContain("BUILD FAILED");
      expect(updated?.txHash).toBe("0x7777888899990000111122223333444455556666aaaabbbbccccddddeeeeffff");

      // Verify event emission
      expect(rejectedEvents).toHaveLength(1);
      expect(rejectedEvents[0].task.id).toBe("task-defect-1");
      expect(rejectedEvents[0].reason).toContain("BUILD FAILED");

      watcher.destroy();
    });

    it("rejects empty or missing deliverable strings", async () => {
      const runner = async () => ({
        exitCode: 0,
        stdout: "tx: 0x5555666677778888999900001111222233334444aaaabbbbccccddddeeeeffff",
        stderr: "",
      });

      const gateway = new OkxGateway({ commandRunner: runner });
      gateway.ledger.recordTask({
        id: "task-empty-deliverable",
        title: "Empty Task",
        spec: "Spec",
        status: "delivered",
        deliverable: "   ",
        createdAt: 1000,
        updatedAt: 1000,
      });

      const watcher = new OkxDeliveryWatcher({ gateway });
      const res = await watcher.checkTask("task-empty-deliverable");

      expect(res.passed).toBe(false);
      expect(res.action).toBe("rejected");
      expect(res.reason).toContain("empty");
      expect(gateway.ledger.getTask("task-empty-deliverable")?.status).toBe("rejected");

      watcher.destroy();
    });

    it("rejects when customEvaluator flags defects or policy breaches", async () => {
      const runner = async () => ({
        exitCode: 0,
        stdout: "tx: 0x6666777788889999000011112222333344445555aaaabbbbccccddddeeeeffff",
        stderr: "",
      });

      const gateway = new OkxGateway({ commandRunner: runner });
      gateway.ledger.recordTask({
        id: "task-custom-reject",
        title: "Security Audit",
        spec: "Security review",
        status: "delivered",
        deliverable: "https://audit.example.com/findings.pdf",
        createdAt: 1000,
        updatedAt: 1000,
      });

      const watcher = new OkxDeliveryWatcher({
        gateway,
        customEvaluator: async () => ({
          passed: false,
          reason: "Critical reentrancy vulnerability unaddressed",
        }),
      });

      const res = await watcher.checkTask("task-custom-reject");
      expect(res.passed).toBe(false);
      expect(res.action).toBe("rejected");
      expect(res.reason).toBe("Critical reentrancy vulnerability unaddressed");
      expect(gateway.ledger.getTask("task-custom-reject")?.rejectionReason).toBe(
        "Critical reentrancy vulnerability unaddressed",
      );

      watcher.destroy();
    });
  });

  describe("Escrow Review Window Expiration & Urgent State Handling", () => {
    it("skips review and does not call CLI if 72-hour window has already expired", async () => {
      let cliCalled = false;
      const runner = async () => {
        cliCalled = true;
        return { exitCode: 0, stdout: "ok", stderr: "" };
      };

      const now = 1789365000000;
      const expiredDeliveredAt = now - 75 * 60 * 60 * 1000; // 75 hours ago (> 72 hours)

      const gateway = new OkxGateway({ commandRunner: runner });
      gateway.ledger.recordTask({
        id: "task-expired-1",
        title: "Old Task",
        spec: "Spec",
        status: "delivered",
        deliverable: "https://old.link",
        createdAt: expiredDeliveredAt,
        updatedAt: expiredDeliveredAt,
        metadata: { deliveredAt: expiredDeliveredAt },
      });

      const watcher = new OkxDeliveryWatcher({ gateway, now: () => now });
      const res = await watcher.checkTask("task-expired-1");

      expect(res.checked).toBe(false);
      expect(res.action).toBe("skipped");
      expect(res.expired).toBe(true);
      expect(res.reason).toContain("expired");
      expect(cliCalled).toBe(false);

      watcher.destroy();
    });

    it("emits urgent_task event when remaining review window is within 12 hours", async () => {
      const runner = async () => ({
        exitCode: 0,
        stdout: "tx: 0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff",
        stderr: "",
      });

      const now = 1789365000000;
      // 66 hours elapsed -> 6 hours remaining (< 12 hours urgent buffer)
      const urgentDeliveredAt = now - 66 * 60 * 60 * 1000;

      const gateway = new OkxGateway({ commandRunner: runner });
      gateway.ledger.recordTask({
        id: "task-urgent-1",
        title: "Urgent Task",
        spec: "Spec",
        status: "delivered",
        deliverable: "Valid deliverable submitted late",
        createdAt: urgentDeliveredAt,
        updatedAt: urgentDeliveredAt,
        metadata: { deliveredAt: urgentDeliveredAt },
      });

      const watcher = new OkxDeliveryWatcher({ gateway, now: () => now });

      const urgentEvents: any[] = [];
      watcher.on("urgent_task", (evt) => urgentEvents.push(evt));

      const res = await watcher.checkTask("task-urgent-1");

      expect(res.urgent).toBe(true);
      expect(res.timeRemainingMs).toBe(6 * 60 * 60 * 1000);
      expect(urgentEvents).toHaveLength(1);
      expect(urgentEvents[0].task.id).toBe("task-urgent-1");

      watcher.destroy();
    });

    it("skips non-delivered tasks gracefully", async () => {
      const gateway = new OkxGateway();
      gateway.ledger.recordTask({
        id: "task-in-progress",
        title: "WIP Task",
        spec: "Spec",
        status: "in_progress",
        createdAt: 1000,
        updatedAt: 1000,
      });

      const watcher = new OkxDeliveryWatcher({ gateway });
      const res = await watcher.checkTask("task-in-progress");

      expect(res.checked).toBe(false);
      expect(res.action).toBe("skipped");
      expect(res.reason).toContain("not in delivered status");

      watcher.destroy();
    });

    it("throws error when requested task ID does not exist in ledger", async () => {
      const gateway = new OkxGateway();
      const watcher = new OkxDeliveryWatcher({ gateway });
      await expect(watcher.checkTask("non-existent-task")).rejects.toThrow(
        "Task non-existent-task not found in ledger",
      );
      watcher.destroy();
    });
  });

  describe("Batch Review & Event Listener Integration", () => {
    it("reviews all pending delivered tasks in reviewPendingDeliveries()", async () => {
      const runner = async (_cmd: string, args: string[]) => {
        if (args.includes("accept")) {
          return {
            exitCode: 0,
            stdout: "tx: 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            stderr: "",
          };
        }
        if (args.includes("reject")) {
          return {
            exitCode: 0,
            stdout: "tx: 0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            stderr: "",
          };
        }
        return { exitCode: 0, stdout: "ok", stderr: "" };
      };

      const gateway = new OkxGateway({ commandRunner: runner });
      gateway.ledger.recordTask({
        id: "batch-task-1",
        title: "Task 1",
        spec: "S1",
        status: "delivered",
        deliverable: "Valid clean code bundle",
        createdAt: 1000,
        updatedAt: 1000,
      });
      gateway.ledger.recordTask({
        id: "batch-task-2",
        title: "Task 2",
        spec: "S2",
        status: "delivered",
        deliverable: "FATAL ERROR: Failed to compile module",
        createdAt: 1000,
        updatedAt: 1000,
      });
      gateway.ledger.recordTask({
        id: "batch-task-3",
        title: "Task 3",
        spec: "S3",
        status: "in_progress",
        createdAt: 1000,
        updatedAt: 1000,
      });

      const watcher = new OkxDeliveryWatcher({ gateway });

      const reviewCompletedEvents: any[] = [];
      watcher.on("review_completed", (evt) => reviewCompletedEvents.push(evt));

      const results = await watcher.reviewPendingDeliveries();

      expect(results).toHaveLength(2); // Only delivered tasks
      expect(results[0].taskId).toBe("batch-task-1");
      expect(results[0].action).toBe("accepted");
      expect(results[1].taskId).toBe("batch-task-2");
      expect(results[1].action).toBe("rejected");

      expect(gateway.ledger.getTask("batch-task-1")?.status).toBe("completed");
      expect(gateway.ledger.getTask("batch-task-2")?.status).toBe("rejected");
      expect(gateway.ledger.getTask("batch-task-3")?.status).toBe("in_progress");

      expect(reviewCompletedEvents).toHaveLength(1);
      expect(reviewCompletedEvents[0].count).toBe(2);

      watcher.destroy();
    });

    it("automatically reviews deliverable upon receiving delivery_submitted webhook event", async () => {
      const runner = async (_cmd: string, args: string[]) => {
        if (args.includes("accept")) {
          return {
            exitCode: 0,
            stdout: "tx: 0x1234123412341234123412341234123412341234123412341234123412341234",
            stderr: "",
          };
        }
        return { exitCode: 0, stdout: "ok", stderr: "" };
      };

      const gateway = new OkxGateway({ commandRunner: runner });
      gateway.ledger.recordTask({
        id: "task-webhook-auto",
        title: "Webhook Task",
        spec: "Spec",
        status: "in_progress",
        createdAt: 1000,
        updatedAt: 1000,
      });

      const watcher = new OkxDeliveryWatcher({ gateway, autoAttach: true });

      const acceptedEvents: any[] = [];
      watcher.on("delivery_accepted", (evt) => acceptedEvents.push(evt));

      // Simulate webhook arrival
      gateway.handleWebhook(
        JSON.stringify({
          type: "delivery_submitted",
          data: {
            taskId: "task-webhook-auto",
            deliverable: "https://github.com/okx/pr/100 - all verification passed",
          },
        }),
      );

      // Wait microtask tick for async checkTask to execute
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(acceptedEvents).toHaveLength(1);
      expect(acceptedEvents[0].task.id).toBe("task-webhook-auto");
      expect(gateway.ledger.getTask("task-webhook-auto")?.status).toBe("completed");

      watcher.destroy();
    });

    it("manages startPolling, stopPolling, and destroy lifecycle cleanly", () => {
      const gateway = new OkxGateway();
      const watcher = new OkxDeliveryWatcher({ gateway });

      watcher.startPolling(5000);
      expect((watcher as any).pollTimer).toBeDefined();

      watcher.stopPolling();
      expect((watcher as any).pollTimer).toBeUndefined();

      watcher.startPolling(1000);
      watcher.destroy();
      expect((watcher as any).pollTimer).toBeUndefined();
    });
  });
});
