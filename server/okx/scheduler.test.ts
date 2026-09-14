import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { RoutineManager, type RoutineRun } from "../routines.ts";
import { OkxGateway } from "./gateway.ts";
import { OkxRecurringEngine, OkxTreasuryManager } from "./scheduler.ts";

const dirs: string[] = [];

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "kind-meitner-okx-scheduler-"));
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

describe("OKX Recurring Task Engine & Autonomous Treasury", () => {
  describe("Autonomous Treasury Manager", () => {
    it("enforces per-run limits, monthly budget caps, and maintains balance", () => {
      const dir = tempDir();
      const treasuryFile = join(dir, "treasury.json");

      const treasury = new OkxTreasuryManager({
        file: treasuryFile,
        balance: 100,
        token: "USDT",
        maxPerRunSpend: 40,
        monthlyBudgetCap: 150,
      });

      expect(treasury.getBalance()).toBe(100);

      // Check per-run cap violation
      const checkOverRun = treasury.canSpend(45);
      expect(checkOverRun.allowed).toBe(false);
      expect(checkOverRun.reason).toContain("maximum per-run spend cap");

      // Successful spend 1 (30 USDT)
      const r1 = treasury.spend({
        routineId: "routine-1",
        runId: "run-1",
        taskId: "task-1",
        amount: 30,
      });
      expect(r1.amount).toBe(30);
      expect(treasury.getBalance()).toBe(70);
      expect(treasury.getMonthlySpend()).toBe(30);

      // Successful spend 2 (35 USDT)
      treasury.spend({
        routineId: "routine-1",
        runId: "run-2",
        taskId: "task-2",
        amount: 35,
      });
      expect(treasury.getBalance()).toBe(35);
      expect(treasury.getMonthlySpend()).toBe(65);

      // Check balance insufficiency
      const checkNoBalance = treasury.canSpend(40);
      expect(checkNoBalance.allowed).toBe(false);
      expect(checkNoBalance.reason).toContain("Insufficient treasury balance");

      // Deposit more funds
      treasury.deposit(100);
      expect(treasury.getBalance()).toBe(135);

      // Successful spend 3 (40 USDT) -> monthly total now 105
      treasury.spend({
        routineId: "routine-1",
        runId: "run-3",
        taskId: "task-3",
        amount: 40,
      });
      expect(treasury.getMonthlySpend()).toBe(105);

      // Spend 4 (40 USDT) -> monthly total now 145
      treasury.spend({
        routineId: "routine-1",
        runId: "run-4",
        taskId: "task-4",
        amount: 40,
      });
      expect(treasury.getMonthlySpend()).toBe(145);

      // Next spend of 10 USDT would exceed monthly cap of 150 (145 + 10 = 155)
      const checkMonthlyCap = treasury.canSpend(10);
      expect(checkMonthlyCap.allowed).toBe(false);
      expect(checkMonthlyCap.reason).toContain("would exceed monthly budget cap");

      // Verify persistence across restart
      const restoredTreasury = new OkxTreasuryManager({
        file: treasuryFile,
        balance: 0,
        maxPerRunSpend: 40,
        monthlyBudgetCap: 150,
      });
      expect(restoredTreasury.getBalance()).toBe(55); // 135 - 40 - 40
      expect(restoredTreasury.listReceipts()).toHaveLength(4);
    });
  });

  describe("Recurring Engine Dispatch", () => {
    it("parses prompt tags and executes recurring task with escrow settlement", async () => {
      const dir = tempDir();
      const gateway = new OkxGateway({ ledgerFile: join(dir, "tasks.json") });
      const treasury = new OkxTreasuryManager({
        balance: 200,
        token: "USDT",
        maxPerRunSpend: 50,
        monthlyBudgetCap: 500,
        file: join(dir, "treasury.json"),
      });

      const engine = new OkxRecurringEngine({
        gateway,
        treasury,
        defaultTaskBudget: 15,
      });

      const prompt = `Perform weekly smart contract security scan on repo X
budget: 35
asp: asp-auditor-sec`;

      const parsed = engine.parseTaskPrompt(prompt);
      expect(parsed.budget).toBe(35);
      expect(parsed.aspId).toBe("asp-auditor-sec");
      expect(parsed.title).toBe("Perform weekly smart contract security scan on repo X");

      const mockRun: RoutineRun = {
        id: "run-rec-1",
        routineId: "routine-sec-scan",
        routineName: "Weekly Security Scan",
        target: "okx-task",
        botId: "bot-okx-agent",
        runOn: "maus",
        scheduledFor: Date.now(),
        status: "running",
        manual: false,
        createdAt: Date.now(),
      };

      const res = await engine.executeScheduledRun(mockRun, prompt);

      expect(res.ok).toBe(true);
      expect(res.task).toBeDefined();
      expect(res.task?.escrowAmount).toBe(35);
      expect(res.task?.aspId).toBe("asp-auditor-sec");
      expect(res.output).toContain("OKX Recurring Task Dispatched");
      expect(res.output).toContain("35 USDT");
      expect(treasury.getBalance()).toBe(165); // 200 - 35
    });

    it("halts execution cleanly when treasury budget limit is violated", async () => {
      const gateway = new OkxGateway();
      const treasury = new OkxTreasuryManager({
        balance: 10, // Only 10 USDT available
        token: "USDT",
        maxPerRunSpend: 25,
        monthlyBudgetCap: 100,
      });

      const engine = new OkxRecurringEngine({ gateway, treasury, defaultTaskBudget: 20 });

      const mockRun: RoutineRun = {
        id: "run-rec-fail",
        routineId: "routine-expensive",
        routineName: "Heavy Compute Task",
        target: "okx-task",
        botId: "bot-okx-agent",
        runOn: "maus",
        scheduledFor: Date.now(),
        status: "running",
        manual: false,
        createdAt: Date.now(),
      };

      const res = await engine.executeScheduledRun(mockRun, "Process data budget: 20");
      expect(res.ok).toBe(false);
      expect(res.error).toContain("Autonomous Treasury check failed");
      expect(treasury.getBalance()).toBe(10); // Unchanged
    });
  });

  describe("Integration with RoutineManager", () => {
    it("triggers startOkxTask when routine with okx-task target is scheduled", async () => {
      const dir = tempDir();
      const routineFile = join(dir, "routines.json");
      const gateway = new OkxGateway();
      const treasury = new OkxTreasuryManager({
        balance: 100,
        token: "USDT",
        maxPerRunSpend: 50,
        monthlyBudgetCap: 200,
      });
      const engine = new OkxRecurringEngine({ gateway, treasury });

      const dispatches: Array<{ runId: string; prompt: string }> = [];

      let now = new Date(2026, 8, 14, 9, 0, 0).getTime();
      let createdTask = 0;

      const routines = new RoutineManager({
        file: routineFile,
        now: () => now,
        botState: () => "ready",
        createTask: (_botId, _title) => ({ threadId: `thread-${++createdTask}` }),
        startTurn: async () => {},
        okxTaskState: () => "ready",
        startOkxTask: async (run, prompt, onDispatchError) => {
          dispatches.push({ runId: run.id, prompt });
          const res = await engine.executeScheduledRun(run, prompt);
          if (!res.ok) onDispatchError(res.error ?? "Failed");
        },
      });

      // Register an okx-task routine
      const routine = routines.create({
        name: "Monday Market Arbiter",
        prompt: "Check and harvest rewards budget: 25",
        target: "okx-task",
        botId: "bot-trader",
        schedule: {
          type: "once",
          at: now + 5000,
        },
      });

      expect(routine.target).toBe("okx-task");

      // Advance time to trigger schedule
      now += 6000;
      await routines.tick();

      expect(dispatches).toHaveLength(1);
      expect(dispatches[0].prompt).toContain("Check and harvest rewards budget: 25");
      expect(treasury.getBalance()).toBe(75); // 100 - 25
    });
  });

  describe("Treasury Concurrency & Input Sanitization", () => {
    it("rejects NaN, negative, or non-finite spend amounts without corrupting balance", () => {
      const treasury = new OkxTreasuryManager({
        balance: 100,
        token: "USDT",
        maxPerRunSpend: 50,
        monthlyBudgetCap: 200,
      });

      // NaN check
      const nanCheck = treasury.canSpend(NaN);
      expect(nanCheck.allowed).toBe(false);
      expect(nanCheck.reason).toContain("Invalid spend amount");
      expect(treasury.getBalance()).toBe(100);

      // Negative check
      const negCheck = treasury.canSpend(-20);
      expect(negCheck.allowed).toBe(false);
      expect(treasury.getBalance()).toBe(100);

      // Zero check
      const zeroCheck = treasury.canSpend(0);
      expect(zeroCheck.allowed).toBe(false);

      // Deposit non-positive throws
      expect(() => treasury.deposit(0)).toThrow("positive");
      expect(() => treasury.deposit(-10)).toThrow("positive");
      expect(treasury.getBalance()).toBe(100);
    });

    it("prevents double-spend race condition across concurrent scheduled runs via reservation lifecycle", async () => {
      const gateway = new OkxGateway();
      const treasury = new OkxTreasuryManager({
        balance: 50, // Only 50 USDT total
        token: "USDT",
        maxPerRunSpend: 40,
        monthlyBudgetCap: 200,
      });
      const engine = new OkxRecurringEngine({ gateway, treasury });

      const runA: RoutineRun = {
        id: "run-race-A",
        routineId: "routine-race",
        routineName: "Job A",
        target: "okx-task",
        botId: "bot-1",
        runOn: "maus",
        scheduledFor: Date.now(),
        status: "running",
        manual: false,
        createdAt: Date.now(),
      };

      const runB: RoutineRun = {
        id: "run-race-B",
        routineId: "routine-race",
        routineName: "Job B",
        target: "okx-task",
        botId: "bot-2",
        runOn: "maus",
        scheduledFor: Date.now(),
        status: "running",
        manual: false,
        createdAt: Date.now(),
      };

      // Both try to spend 35 USDT simultaneously (35 + 35 = 70 > 50 balance)
      const [resA, resB] = await Promise.all([
        engine.executeScheduledRun(runA, "Run A budget: 35"),
        engine.executeScheduledRun(runB, "Run B budget: 35"),
      ]);

      // Exactly one must succeed, and one must be rejected cleanly
      const successCount = [resA.ok, resB.ok].filter(Boolean).length;
      const failCount = [resA.ok, resB.ok].filter((ok) => !ok).length;

      expect(successCount).toBe(1);
      expect(failCount).toBe(1);

      // Remaining balance must be exactly 15 (50 - 35), not negative, and no orphaned funds
      expect(treasury.getBalance()).toBe(15);
      expect(treasury.getReservedAmount()).toBe(0);
      expect(treasury.listReceipts()).toHaveLength(1);
    });

    it("releases reservation cleanly if gateway postTask throws", async () => {
      const failingRunner = async () => {
        throw new Error("Network RPC timeout during payment");
      };
      const gateway = new OkxGateway({ commandRunner: failingRunner });
      const treasury = new OkxTreasuryManager({
        balance: 100,
        token: "USDT",
        maxPerRunSpend: 50,
        monthlyBudgetCap: 200,
      });
      const engine = new OkxRecurringEngine({ gateway, treasury });

      // Mock gateway.postTask to throw
      gateway.postTask = async () => {
        throw new Error("Portal API down");
      };

      const mockRun: RoutineRun = {
        id: "run-fail-recover",
        routineId: "routine-fail",
        routineName: "Failed Job",
        target: "okx-task",
        botId: "bot-1",
        runOn: "maus",
        scheduledFor: Date.now(),
        status: "running",
        manual: false,
        createdAt: Date.now(),
      };

      const res = await engine.executeScheduledRun(mockRun, "Job budget: 40");
      expect(res.ok).toBe(false);
      expect(res.error).toContain("Portal API down");

      // Balance must remain intact at 100 with zero active reservations
      expect(treasury.getBalance()).toBe(100);
      expect(treasury.getReservedAmount()).toBe(0);
      expect(treasury.getAvailableBalance()).toBe(100);
    });

    it("expires stale reservations after TTL and restores available balance", () => {
      const treasury = new OkxTreasuryManager({
        balance: 100,
        token: "USDT",
        maxPerRunSpend: 60,
        monthlyBudgetCap: 300,
      });

      const baseTime = 1700000000000;
      // Reserve 40 USDT at baseTime
      treasury.reserve(
        40,
        { routineId: "routine-old", runId: "run-old" },
        baseTime,
      );
      expect(treasury.getReservedAmount()).toBe(40);
      expect(treasury.getAvailableBalance()).toBe(60);

      // Reserve 30 USDT at baseTime + 200,000ms (3.33 minutes later)
      treasury.reserve(
        30,
        { routineId: "routine-new", runId: "run-new" },
        baseTime + 200_000,
      );
      expect(treasury.getReservedAmount()).toBe(70);
      expect(treasury.getAvailableBalance()).toBe(30);

      // At baseTime + 350,000ms (5.83 min later):
      // resOld (age 350,000ms > 300,000ms) should expire.
      // resNew (age 150,000ms <= 300,000ms) should remain active.
      const expired = treasury.expireStaleReservations(300_000, baseTime + 350_000);
      expect(expired).toBe(1);
      expect(treasury.getReservedAmount()).toBe(30);
      expect(treasury.getAvailableBalance()).toBe(70);

      // A new reservation of 60 USDT should now succeed because 40 USDT was freed up
      const resFresh = treasury.reserve(
        60,
        { routineId: "routine-fresh", runId: "run-fresh" },
        baseTime + 350_000,
      );
      expect(resFresh.reservationId).toBeDefined();
      expect(treasury.getReservedAmount()).toBe(90); // 30 + 60

      // Advancing to baseTime + 600,000ms expires resNew (age 400,000ms > 300,000ms)
      const expired2 = treasury.expireStaleReservations(300_000, baseTime + 600_000);
      expect(expired2).toBe(1);
    });

    it("automatically cleans up stale reservations during reserve() to unblock capacity", () => {
      const treasury = new OkxTreasuryManager({
        balance: 50,
        token: "USDT",
        maxPerRunSpend: 50,
        monthlyBudgetCap: 200,
      });

      const now = 1700000000000;
      // Allocate entire balance in an orphaned reservation
      treasury.reserve(50, { routineId: "r-orphan", runId: "run-orphan" }, now);
      expect(treasury.getAvailableBalance()).toBe(0);

      // Trying to reserve at now + 100,000ms fails (not stale yet)
      expect(() =>
        treasury.reserve(20, { routineId: "r2", runId: "run2" }, now + 100_000),
      ).toThrow("Insufficient treasury balance");

      // At now + 300,001ms (> 5 min TTL), reserve() automatically purges the stale reservation
      const res = treasury.reserve(25, { routineId: "r3", runId: "run3" }, now + 300_001);
      expect(res.reservationId).toBeDefined();
      expect(treasury.getReservedAmount()).toBe(25);
      expect(treasury.getAvailableBalance()).toBe(25);
    });

    it("reconciles escrow refund post-commit, restoring balance, adjusting 30-day spend, and persisting state", () => {
      const dir = tempDir();
      const treasuryFile = join(dir, "treasury-refund.json");
      const treasury = new OkxTreasuryManager({
        file: treasuryFile,
        balance: 200,
        token: "USDT",
        maxPerRunSpend: 60,
        monthlyBudgetCap: 500,
      });

      const now = Date.now();
      // Spend 50 USDT on task-escrow-1
      const receipt = treasury.spend({
        routineId: "routine-alpha",
        runId: "run-alpha",
        taskId: "task-escrow-1",
        amount: 50,
        now,
      });
      expect(receipt.amount).toBe(50);
      expect(treasury.getBalance()).toBe(150);
      expect(treasury.getMonthlySpend(now)).toBe(50);

      // Reconcile 50 USDT full refund for task-escrow-1
      const refundResult = treasury.refundTask("task-escrow-1", 50, now + 1000);
      expect(refundResult.newBalance).toBe(200);
      expect(treasury.getBalance()).toBe(200);
      expect(treasury.getMonthlySpend(now + 1000)).toBe(0);

      // Verify receipts log contains both spend and compensating negative refund receipt
      const receipts = treasury.listReceipts();
      expect(receipts).toHaveLength(2);
      expect(receipts[0].amount).toBe(50);
      expect(receipts[1].amount).toBe(-50);
      expect(receipts[1].taskId).toBe("task-escrow-1");

      // Verify persistence across reload
      const reloaded = new OkxTreasuryManager({
        file: treasuryFile,
        balance: 0,
        maxPerRunSpend: 60,
        monthlyBudgetCap: 500,
      });
      expect(reloaded.getBalance()).toBe(200);
      expect(reloaded.getMonthlySpend(now + 1000)).toBe(0);

      // Test partial refund on another task
      treasury.spend({
        routineId: "routine-beta",
        runId: "run-beta",
        taskId: "task-escrow-2",
        amount: 40,
        now: now + 2000,
      });
      expect(treasury.getBalance()).toBe(160);
      expect(treasury.getMonthlySpend(now + 2000)).toBe(40);

      // Partial 20 USDT refund
      treasury.refundTask("task-escrow-2", 20, now + 3000);
      expect(treasury.getBalance()).toBe(180);
      expect(treasury.getMonthlySpend(now + 3000)).toBe(20);

      // Invalid refund amounts reject cleanly
      expect(() => treasury.refundTask("task-escrow-2", -10)).toThrow("positive");
      expect(() => treasury.refundTask("task-escrow-2", 0)).toThrow("positive");
      expect(() => treasury.refundTask("task-escrow-2", NaN)).toThrow("positive");
    });

    it("prevents double-spend under high-concurrency stress test with 10 concurrent runs", async () => {
      const gateway = new OkxGateway();
      const treasury = new OkxTreasuryManager({
        balance: 50, // 50 USDT total
        token: "USDT",
        maxPerRunSpend: 25,
        monthlyBudgetCap: 500,
      });
      const engine = new OkxRecurringEngine({ gateway, treasury });

      // 10 concurrent runs each requesting 20 USDT (10 * 20 = 200 > 50 balance)
      // Exactly 2 runs can succeed (2 * 20 = 40 <= 50; 3 * 20 = 60 > 50)
      const runs = Array.from({ length: 10 }, (_, i) => ({
        id: `run-stress-${i}`,
        routineId: `routine-stress-${i}`,
        routineName: `Stress Task ${i}`,
        target: "okx-task" as const,
        botId: `bot-${i}`,
        runOn: "maus" as const,
        scheduledFor: Date.now(),
        status: "running" as const,
        manual: false,
        createdAt: Date.now(),
      }));

      const results = await Promise.all(
        runs.map((r, i) => engine.executeScheduledRun(r, `Job ${i} budget: 20`)),
      );

      const succeeded = results.filter((r) => r.ok);
      const failed = results.filter((r) => !r.ok);

      expect(succeeded).toHaveLength(2);
      expect(failed).toHaveLength(8);

      // Treasury state must be strictly consistent
      expect(treasury.getBalance()).toBe(10); // 50 - 40
      expect(treasury.getReservedAmount()).toBe(0); // All reservations committed or released
      expect(treasury.getAvailableBalance()).toBe(10);
      expect(treasury.listReceipts()).toHaveLength(2);
      expect(treasury.getMonthlySpend()).toBe(40);
    });

    it("rolls back reservation cleanly when onchain payment fails and gates mock txHash", async () => {
      const failingRunner = async () => {
        return {
          exitCode: 1,
          stdout: "",
          stderr: "Payment execution reverted onchain: INSUFFICIENT_ALLOWANCE",
        };
      };
      const gateway = new OkxGateway({ commandRunner: failingRunner });
      const treasury = new OkxTreasuryManager({
        balance: 100,
        token: "USDT",
        maxPerRunSpend: 50,
        monthlyBudgetCap: 200,
      });

      const engine = new OkxRecurringEngine({ gateway, treasury });

      const mockRun: RoutineRun = {
        id: "run-onchain-fail",
        routineId: "routine-onchain-fail",
        routineName: "Reverted Payment Job",
        target: "okx-task",
        botId: "bot-1",
        runOn: "maus",
        scheduledFor: Date.now(),
        status: "running",
        manual: false,
        createdAt: Date.now(),
      };

      const res = await engine.executeScheduledRun(mockRun, "Run task budget: 30");
      expect(res.ok).toBe(false);
      expect(res.error).toContain("INSUFFICIENT_ALLOWANCE");

      // Balance must not be deducted, reservation must be rolled back
      expect(treasury.getBalance()).toBe(100);
      expect(treasury.getReservedAmount()).toBe(0);
      expect(treasury.getAvailableBalance()).toBe(100);
      expect(treasury.listReceipts()).toHaveLength(0);

      // Task status in ledger should be failed
      const tasks = gateway.ledger.listTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].status).toBe("failed");
    });

    it("handles production wiring: RoutineManager with okxTaskState and startOkxTask executes okx-task routines cleanly", async () => {
      const dir = tempDir();
      const routineFile = join(dir, "prod-routines.json");
      const gateway = new OkxGateway({ ledgerFile: join(dir, "tasks.json") });
      const treasury = new OkxTreasuryManager({
        balance: 150,
        token: "USDT",
        maxPerRunSpend: 50,
        monthlyBudgetCap: 300,
        file: join(dir, "treasury.json"),
      });
      const okxRecurringEngine = new OkxRecurringEngine({ gateway, treasury });

      let now = new Date(2026, 8, 14, 10, 0, 0).getTime();
      let createdTaskCount = 0;
      const dispatchErrors: string[] = [];

      // Replicate the exact production wiring in server/index.ts
      const routines = new RoutineManager({
        file: routineFile,
        now: () => now,
        botState: () => "ready",
        createTask: (_botId, _title) => ({ threadId: `thread-prod-${++createdTaskCount}` }),
        startTurn: async () => {},
        okxTaskState: () => "ready",
        startOkxTask: async (run, prompt, onDispatchError) => {
          const res = await okxRecurringEngine.executeScheduledRun(run, prompt);
          if (!res.ok) {
            onDispatchError(res.error ?? "OKX execution failed");
            dispatchErrors.push(res.error ?? "OKX execution failed");
          }
        },
      });

      // 1. Create and trigger a successful okx-task routine
      const routine = routines.create({
        name: "Autonomous Treasury Auditor",
        prompt: "Run audit budget: 40 asp: asp-sec-bot",
        target: "okx-task",
        botId: "bot-sec",
        schedule: {
          type: "once",
          at: now + 2000,
        },
      });

      expect(routine.target).toBe("okx-task");

      now += 3000;
      await routines.tick();

      expect(dispatchErrors).toHaveLength(0);
      expect(treasury.getBalance()).toBe(110); // 150 - 40
      expect(treasury.listReceipts()).toHaveLength(1);

      // 2. Schedule another okx-task routine that exceeds balance
      routines.create({
        name: "Over-budget Job",
        prompt: "Run heavy task budget: 120", // 120 > remaining 110
        target: "okx-task",
        botId: "bot-sec",
        schedule: {
          type: "once",
          at: now + 2000,
        },
      });

      now += 3000;
      await routines.tick();

      expect(dispatchErrors).toHaveLength(1);
      expect(dispatchErrors[0]).toContain("Autonomous Treasury check failed");
      expect(treasury.getBalance()).toBe(110); // Balance preserved
    });
  });
});
