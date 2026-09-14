import { describe, expect, it } from "vitest";
import { OkxDisputeEvaluator, isDeadband, type DisputeInput } from "./evaluator.ts";
import { OkxGateway } from "./gateway.ts";
import { ESCROW_WINDOW_MS, OkxDeliveryWatcher } from "./watcher.ts";

describe("Challenger M5-2: Adversarial Multi-Agent Lifecycle & Boundary Verification", () => {
  describe("1. Evaluator Slashing Deadband Barrier (Boundary Scores 41, 76 vs 43, 78)", () => {
    const baseSpec = `Build an on-chain vault with stake and emergency withdrawal features.`;

    it("verifies mathematical deadband barrier predicates across the boundary", () => {
      // Deadband zone 1: [38, 42]
      expect(isDeadband(38)).toBe(true);
      expect(isDeadband(41)).toBe(true);
      expect(isDeadband(42)).toBe(true);
      expect(isDeadband(37)).toBe(false);
      expect(isDeadband(43)).toBe(false);

      // Deadband zone 2: [73, 77]
      expect(isDeadband(73)).toBe(true);
      expect(isDeadband(76)).toBe(true);
      expect(isDeadband(77)).toBe(true);
      expect(isDeadband(72)).toBe(false);
      expect(isDeadband(78)).toBe(false);
    });

    it("evaluates boundary score 41 -> safeToVote: false, confidence < 0.65", async () => {
      // With deliverable < 60 chars (rawSum = 19 -> 13.3) and blended advocate score 92:
      // targetTotal = round(13.3 + 92 * 0.3) = round(13.3 + 27.6) = round(40.9) = 41.
      const mockLlm41 = async () =>
        JSON.stringify({
          arguments: ["Deliverable submitted but incomplete"],
          missingRequirements: ["Emergency withdrawal"],
          positiveFindings: [],
          suggestedVerdict: "PARTIAL_REFUND",
          suggestedScore: 92,
          confidence: 0.85,
        });

      const evaluator = new OkxDisputeEvaluator({
        llmCaller: mockLlm41,
        confidenceThreshold: 0.65,
        slashingProtectionEnabled: true,
      });

      const input: DisputeInput = {
        disputeId: "disp-adversarial-41",
        taskId: "task-adv-41",
        spec: baseSpec,
        deliverable: "Short deliverable under sixty characters.",
        rejectionReason: "Missing essential features",
        escrowAmount: 100,
        token: "USDT",
      };

      const result = await evaluator.deliberate(input);

      // Score verification
      expect(result.rubric.totalScore).toBe(41);
      expect(evaluator.isDeadband(41)).toBe(true);

      // Confidence clamped due to deadband
      expect(result.confidence).toBeLessThan(0.65);
      expect(result.confidence).toBe(0.52);

      // Slashing protection guarantees veto
      expect(result.safeToVote).toBe(false);

      // On-chain submission withheld
      const submitRes = await evaluator.submitVote("disp-adversarial-41");
      expect(submitRes.submitted).toBe(false);
      expect(submitRes.reason).toContain("OKB Stake Protection");
    });

    it("evaluates boundary score 76 -> safeToVote: false, confidence < 0.65", async () => {
      // With substantive deliverable >= 60 chars (rawSum = 93 -> 65.1) and blended advocate score 36:
      // targetTotal = round(65.1 + 36 * 0.3) = round(65.1 + 10.8) = round(75.9) = 76.
      const mockLlm76 = async () =>
        JSON.stringify({
          arguments: ["Substantive code provided with minor deviations"],
          missingRequirements: [],
          positiveFindings: ["Full contract structure implemented"],
          suggestedVerdict: "PASS",
          suggestedScore: 36,
          confidence: 0.85,
        });

      const evaluator = new OkxDisputeEvaluator({
        llmCaller: mockLlm76,
        confidenceThreshold: 0.65,
        slashingProtectionEnabled: true,
      });

      const input: DisputeInput = {
        disputeId: "disp-adversarial-76",
        taskId: "task-adv-76",
        spec: baseSpec,
        deliverable: `// Substantive vault contract exceeding sixty characters in length
contract AdversarialVault {
  function stake() external payable {}
  function emergencyWithdraw() external {}
}`,
        rejectionReason: "Minor preference discrepancy",
        escrowAmount: 100,
        token: "USDT",
      };

      const result = await evaluator.deliberate(input);

      // Score verification
      expect(result.rubric.totalScore).toBe(76);
      expect(evaluator.isDeadband(76)).toBe(true);

      // Confidence clamped due to deadband
      expect(result.confidence).toBeLessThan(0.65);
      expect(result.confidence).toBe(0.52);

      // Slashing protection guarantees veto
      expect(result.safeToVote).toBe(false);

      // On-chain submission withheld
      const submitRes = await evaluator.submitVote("disp-adversarial-76");
      expect(submitRes.submitted).toBe(false);
      expect(submitRes.reason).toContain("OKB Stake Protection");
    });

    it("evaluates boundary score 43 -> safeToVote: true, confidence >= 0.65", async () => {
      // With deliverable < 60 chars (rawSum = 19 -> 13.3) and blended advocate score 99:
      // targetTotal = round(13.3 + 99 * 0.3) = round(13.3 + 29.7) = round(43.0) = 43.
      const mockLlm43 = async () =>
        JSON.stringify({
          arguments: ["Partial deliverable matching 43 target"],
          missingRequirements: ["Feature B"],
          positiveFindings: [],
          suggestedVerdict: "PARTIAL_REFUND",
          suggestedScore: 99,
          confidence: 0.90,
        });

      const evaluator = new OkxDisputeEvaluator({
        llmCaller: mockLlm43,
        confidenceThreshold: 0.65,
        slashingProtectionEnabled: true,
      });

      const input: DisputeInput = {
        disputeId: "disp-adversarial-43",
        taskId: "task-adv-43",
        spec: baseSpec,
        deliverable: "Short code snippet under sixty chars.",
        rejectionReason: "Missing items",
        escrowAmount: 100,
        token: "USDT",
      };

      const result = await evaluator.deliberate(input);

      // Score verification
      expect(result.rubric.totalScore).toBe(43);
      expect(evaluator.isDeadband(43)).toBe(false);

      // Outside deadband zone: margin = min(|43-40|, |43-75|) = 3 -> marginConfidence = 0.7 -> confidence = 0.82
      expect(result.confidence).toBeGreaterThanOrEqual(0.65);
      expect(result.confidence).toBe(0.82);

      // Safe to vote
      expect(result.safeToVote).toBe(true);

      // On-chain submission executes
      const submitRes = await evaluator.submitVote("disp-adversarial-43");
      expect(submitRes.submitted).toBe(true);
      expect(submitRes.txHash).toBeDefined();
    });

    it("evaluates boundary score 78 -> safeToVote: true, confidence >= 0.65", async () => {
      // With substantive deliverable >= 60 chars (rawSum = 93 -> 65.1) and blended advocate score 43:
      // targetTotal = round(65.1 + 43 * 0.3) = round(65.1 + 12.9) = round(78.0) = 78.
      const mockLlm78 = async () =>
        JSON.stringify({
          arguments: ["Solid deliverable satisfying spec"],
          missingRequirements: [],
          positiveFindings: ["All criteria met"],
          suggestedVerdict: "PASS",
          suggestedScore: 43,
          confidence: 0.90,
        });

      const evaluator = new OkxDisputeEvaluator({
        llmCaller: mockLlm78,
        confidenceThreshold: 0.65,
        slashingProtectionEnabled: true,
      });

      const input: DisputeInput = {
        disputeId: "disp-adversarial-78",
        taskId: "task-adv-78",
        spec: baseSpec,
        deliverable: `// Substantive vault contract exceeding sixty characters in length
contract Vault78 {
  function deposit() external payable {}
  function withdraw() external {}
}`,
        rejectionReason: "Subjective styling disagreement",
        escrowAmount: 100,
        token: "USDT",
      };

      const result = await evaluator.deliberate(input);

      // Score verification
      expect(result.rubric.totalScore).toBe(78);
      expect(evaluator.isDeadband(78)).toBe(false);

      // Outside deadband: margin = min(|78-40|, |78-75|) = 3 -> marginConfidence = 0.7 -> confidence = 0.82
      expect(result.confidence).toBeGreaterThanOrEqual(0.65);
      expect(result.confidence).toBe(0.82);

      // Safe to vote
      expect(result.safeToVote).toBe(true);

      // On-chain submission executes
      const submitRes = await evaluator.submitVote("disp-adversarial-78");
      expect(submitRes.submitted).toBe(true);
      expect(submitRes.txHash).toBeDefined();
    });
  });

  describe("2. Delivery Review Watcher 72h Window Boundary & Escrow Expiration", () => {
    const baseTime = 1789365000000;

    it("confirms ESCROW_WINDOW_MS is precisely 259,200,000 ms (72 hours)", () => {
      expect(ESCROW_WINDOW_MS).toBe(72 * 60 * 60 * 1000);
      expect(ESCROW_WINDOW_MS).toBe(259_200_000);
    });

    it("triggers autonomous acceptance on unexpired passing deliverable 1ms before 72h deadline", async () => {
      const cliCalls: string[] = [];
      const runner = async (cmd: string, args: string[]) => {
        cliCalls.push(`${cmd} ${args.join(" ")}`);
        return { exitCode: 0, stdout: "tx: 0xaccept123", stderr: "" };
      };

      const gateway = new OkxGateway({ commandRunner: runner });
      // Exactly 259,199,999 ms ago (1 ms before 72h expiration)
      const deliveredAt = baseTime - (ESCROW_WINDOW_MS - 1);

      gateway.ledger.recordTask({
        id: "task-unexpired-pass",
        title: "Clean Task",
        spec: "Spec",
        status: "delivered",
        deliverable: "https://github.com/repo/clean - 100% test coverage and verified build",
        createdAt: deliveredAt,
        updatedAt: deliveredAt,
        metadata: { deliveredAt },
      });

      const watcher = new OkxDeliveryWatcher({ gateway, now: () => baseTime });

      expect(watcher.isExpired(gateway.ledger.getTask("task-unexpired-pass")!)).toBe(false);
      expect(watcher.getTimeRemainingMs(gateway.ledger.getTask("task-unexpired-pass")!)).toBe(1);

      const res = await watcher.checkTask("task-unexpired-pass");
      expect(res.checked).toBe(true);
      expect(res.passed).toBe(true);
      expect(res.action).toBe("accepted");
      expect(cliCalls[0]).toBe("onchainos agent accept --task-id task-unexpired-pass");
      expect(gateway.ledger.getTask("task-unexpired-pass")?.status).toBe("completed");

      watcher.destroy();
    });

    it("triggers autonomous rejection on unexpired defective deliverable within review window", async () => {
      const cliCalls: string[] = [];
      const runner = async (cmd: string, args: string[]) => {
        cliCalls.push(`${cmd} ${args.join(" ")}`);
        return { exitCode: 0, stdout: "tx: 0xreject123", stderr: "" };
      };

      const gateway = new OkxGateway({ commandRunner: runner });
      const deliveredAt = baseTime - 36 * 60 * 60 * 1000; // 36h elapsed (36h remaining)

      gateway.ledger.recordTask({
        id: "task-unexpired-defect",
        title: "Defective Task",
        spec: "Spec",
        status: "delivered",
        deliverable: "Execution finished with FATAL ERROR: segmentation fault",
        createdAt: deliveredAt,
        updatedAt: deliveredAt,
        metadata: { deliveredAt },
      });

      const watcher = new OkxDeliveryWatcher({ gateway, now: () => baseTime });

      const res = await watcher.checkTask("task-unexpired-defect");
      expect(res.checked).toBe(true);
      expect(res.passed).toBe(false);
      expect(res.action).toBe("rejected");
      expect(cliCalls[0]).toContain("onchainos agent reject --task-id task-unexpired-defect");
      expect(gateway.ledger.getTask("task-unexpired-defect")?.status).toBe("rejected");

      watcher.destroy();
    });

    it("strictly skips review and suppresses CLI calls when escrow window is expired (> 259,200,000 ms)", async () => {
      let cliCalled = false;
      const runner = async () => {
        cliCalled = true;
        return { exitCode: 0, stdout: "ok", stderr: "" };
      };

      const gateway = new OkxGateway({ commandRunner: runner });

      // Case A: Exactly at deadline (259,200,000 ms elapsed -> 0ms remaining)
      const exactDeadline = baseTime - ESCROW_WINDOW_MS;
      gateway.ledger.recordTask({
        id: "task-exact-deadline",
        title: "Exact Deadline Task",
        spec: "Spec",
        status: "delivered",
        deliverable: "Valid deliverable",
        createdAt: exactDeadline,
        updatedAt: exactDeadline,
        metadata: { deliveredAt: exactDeadline },
      });

      // Case B: 1ms past deadline (259,200,001 ms elapsed -> -1ms remaining)
      const pastDeadline1ms = baseTime - (ESCROW_WINDOW_MS + 1);
      gateway.ledger.recordTask({
        id: "task-past-deadline-1ms",
        title: "Past Deadline 1ms",
        spec: "Spec",
        status: "delivered",
        deliverable: "Valid deliverable",
        createdAt: pastDeadline1ms,
        updatedAt: pastDeadline1ms,
        metadata: { deliveredAt: pastDeadline1ms },
      });

      // Case C: Severely expired (75 hours elapsed)
      const severelyExpired = baseTime - 75 * 60 * 60 * 1000;
      gateway.ledger.recordTask({
        id: "task-severely-expired",
        title: "Severely Expired Task",
        spec: "Spec",
        status: "delivered",
        deliverable: "FATAL ERROR: would normally be rejected",
        createdAt: severelyExpired,
        updatedAt: severelyExpired,
        metadata: { deliveredAt: severelyExpired },
      });

      const watcher = new OkxDeliveryWatcher({ gateway, now: () => baseTime });

      // Case A evaluation
      const resA = await watcher.checkTask("task-exact-deadline");
      expect(resA.checked).toBe(false);
      expect(resA.action).toBe("skipped");
      expect(resA.expired).toBe(true);
      expect(resA.reason).toContain("expired");

      // Case B evaluation
      const resB = await watcher.checkTask("task-past-deadline-1ms");
      expect(resB.checked).toBe(false);
      expect(resB.action).toBe("skipped");
      expect(resB.expired).toBe(true);
      expect(resB.timeRemainingMs).toBe(-1);

      // Case C evaluation: Even with fatal defect, expired escrow cannot be rejected on-chain
      const resC = await watcher.checkTask("task-severely-expired");
      expect(resC.checked).toBe(false);
      expect(resC.action).toBe("skipped");
      expect(resC.expired).toBe(true);

      // Crucial invariant: CLI was NEVER invoked for any expired task
      expect(cliCalled).toBe(false);

      watcher.destroy();
    });

    it("adjudicates batch review with mixed expired, passing, and defective deliverables", async () => {
      const runner = async (_cmd: string, args: string[]) => {
        if (args.includes("accept")) {
          return { exitCode: 0, stdout: "tx: 0xaccept_batch", stderr: "" };
        }
        if (args.includes("reject")) {
          return { exitCode: 0, stdout: "tx: 0xreject_batch", stderr: "" };
        }
        return { exitCode: 0, stdout: "ok", stderr: "" };
      };

      const gateway = new OkxGateway({ commandRunner: runner });

      // Task 1: Unexpired valid (24h ago) -> should accept
      gateway.ledger.recordTask({
        id: "batch-valid",
        title: "Valid",
        spec: "S1",
        status: "delivered",
        deliverable: "All tests green",
        createdAt: baseTime - 24 * 3600 * 1000,
        updatedAt: baseTime - 24 * 3600 * 1000,
        metadata: { deliveredAt: baseTime - 24 * 3600 * 1000 },
      });

      // Task 2: Unexpired defective (48h ago) -> should reject
      gateway.ledger.recordTask({
        id: "batch-defect",
        title: "Defect",
        spec: "S2",
        status: "delivered",
        deliverable: "BUILD FAILED at step 2",
        createdAt: baseTime - 48 * 3600 * 1000,
        updatedAt: baseTime - 48 * 3600 * 1000,
        metadata: { deliveredAt: baseTime - 48 * 3600 * 1000 },
      });

      // Task 3: Expired (73h ago) -> should skip
      gateway.ledger.recordTask({
        id: "batch-expired",
        title: "Expired",
        spec: "S3",
        status: "delivered",
        deliverable: "Completed artifact",
        createdAt: baseTime - 73 * 3600 * 1000,
        updatedAt: baseTime - 73 * 3600 * 1000,
        metadata: { deliveredAt: baseTime - 73 * 3600 * 1000 },
      });

      const watcher = new OkxDeliveryWatcher({ gateway, now: () => baseTime });
      const results = await watcher.reviewPendingDeliveries();

      expect(results).toHaveLength(3);
      expect(results.find((r) => r.taskId === "batch-valid")?.action).toBe("accepted");
      expect(results.find((r) => r.taskId === "batch-defect")?.action).toBe("rejected");
      expect(results.find((r) => r.taskId === "batch-expired")?.action).toBe("skipped");
      expect(results.find((r) => r.taskId === "batch-expired")?.expired).toBe(true);

      expect(gateway.ledger.getTask("batch-valid")?.status).toBe("completed");
      expect(gateway.ledger.getTask("batch-defect")?.status).toBe("rejected");
      expect(gateway.ledger.getTask("batch-expired")?.status).toBe("delivered"); // Unaltered

      watcher.destroy();
    });
  });
});
