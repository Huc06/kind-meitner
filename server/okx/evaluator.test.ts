import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OkxDisputeEvaluator, type DisputeInput } from "./evaluator.ts";

describe("OKX Dispute Resolution Evaluator ASP", () => {
  const baseSpec = `Build an ERC-20 staking contract with the following requirements:
- Stake token and earn reward tokens linearly.
- Support emergency withdrawal function for users.
- Include unit test coverage demonstrating deposit, harvest, and withdraw.
- Deliver cleanly formatted TypeScript or Solidity code.`;

  it("deliberates and awards PASS for high quality, comprehensive deliverables", async () => {
    const evaluator = new OkxDisputeEvaluator({
      confidenceThreshold: 0.65,
      slashingProtectionEnabled: true,
      arbitrationFeeRatio: 0.05,
    });

    const highQualityDeliverable = `// Solidity Staking Vault Contract
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract StakingVault {
    IERC20 public immutable stakingToken;
    IERC20 public immutable rewardToken;
    
    mapping(address => uint256) public balances;
    
    constructor(address _staking, address _reward) {
        stakingToken = IERC20(_staking);
        rewardToken = IERC20(_reward);
    }

    function stake(uint256 amount) external {
        stakingToken.transferFrom(msg.sender, address(this), amount);
        balances[msg.sender] += amount;
    }

    function emergencyWithdraw() external {
        uint256 amount = balances[msg.sender];
        balances[msg.sender] = 0;
        stakingToken.transfer(msg.sender, amount);
    }
}

// Tests:
// - test_deposit_and_harvest: PASSED
// - test_emergency_withdrawal: PASSED
// Unit test suite verification: 100% success across 8 test suites.`;

    const input: DisputeInput = {
      disputeId: "disp-pass-01",
      taskId: "task-vault-01",
      spec: baseSpec,
      deliverable: highQualityDeliverable,
      rejectionReason: "I changed my mind and also wanted a front-end UI included.",
      escrowAmount: 200,
      token: "USDT",
    };

    const result = await evaluator.deliberate(input);

    expect(result.verdict).toBe("PASS");
    expect(result.rubric.totalScore).toBeGreaterThanOrEqual(75);
    expect(result.suggestedBuyerRefundRatio).toBe(0.0);
    expect(result.arbitrationFeeEarned).toBe(10); // 5% of 200
    expect(result.deliberationTranscript).toContain("[Buyer Advocate]");
    expect(result.deliberationTranscript).toContain("[Seller Advocate]");
    expect(result.deliberationTranscript).toContain("[Chief Arbiter Final Verdict]");

    // Should be safe to broadcast
    expect(result.safeToVote).toBe(true);

    const voteRes = await evaluator.submitVote("disp-pass-01");
    expect(voteRes.submitted).toBe(true);
    expect(voteRes.txHash).toBeDefined();

    // Fee claiming
    const feeRes = await evaluator.claimFee("disp-pass-01");
    expect(feeRes.success).toBe(true);
    expect(feeRes.amount).toBe(10);

    // Double-claim should throw
    await expect(evaluator.claimFee("disp-pass-01")).rejects.toThrow("already claimed");
  });

  it("deliberates and awards FULL_REFUND for severely deficient or empty deliverables", async () => {
    const evaluator = new OkxDisputeEvaluator({
      confidenceThreshold: 0.65,
    });

    const deficientDeliverable = `// WIP - contract not finished yet. Coming soon.`;

    const input: DisputeInput = {
      disputeId: "disp-fail-02",
      taskId: "task-vault-02",
      spec: baseSpec,
      deliverable: deficientDeliverable,
      rejectionReason: "Deliverable is completely incomplete, missing all code, logic, and tests.",
      escrowAmount: 150,
      token: "USDT",
    };

    const result = await evaluator.deliberate(input);

    expect(result.verdict).toBe("FULL_REFUND");
    expect(result.rubric.totalScore).toBeLessThan(40);
    expect(result.suggestedBuyerRefundRatio).toBe(1.0);
    expect(result.buyerAdvocate.missingRequirements.length).toBeGreaterThan(0);
    expect(result.safeToVote).toBe(true);
  });

  it("deliberates and awards PARTIAL_REFUND for partially functional deliverables with defects", async () => {
    const evaluator = new OkxDisputeEvaluator();

    // Has contract code, but missing tests and emergency withdraw
    const partialDeliverable = `// Staking basic
contract Staking {
    function stake() public {}
    function harvest() public {}
}
// Note: tests could not be run due to local setup.`;

    const input: DisputeInput = {
      disputeId: "disp-partial-03",
      taskId: "task-vault-03",
      spec: baseSpec,
      deliverable: partialDeliverable,
      rejectionReason: "Missing emergency withdrawal function and zero unit test coverage.",
      escrowAmount: 100,
      token: "USDT",
    };

    const result = await evaluator.deliberate(input);

    expect(result.verdict).toBe("PARTIAL_REFUND");
    expect(result.rubric.totalScore).toBeGreaterThanOrEqual(40);
    expect(result.rubric.totalScore).toBeLessThan(75);
    expect(result.suggestedBuyerRefundRatio).toBe(0.5);
  });

  it("enforces OKB stake slashing protection when jury confidence is low", async () => {
    // Force a high confidence threshold to test stake protection
    const evaluator = new OkxDisputeEvaluator({
      confidenceThreshold: 0.99,
      slashingProtectionEnabled: true,
    });

    const input: DisputeInput = {
      disputeId: "disp-risky-04",
      taskId: "task-vault-04",
      spec: baseSpec,
      deliverable: `function deposit() public {}`,
      rejectionReason: "Questionable quality",
      escrowAmount: 50,
      token: "USDT",
    };

    const result = await evaluator.deliberate(input);
    expect(result.safeToVote).toBe(false);

    // Submitting vote without bypass is withheld
    const voteRes = await evaluator.submitVote("disp-risky-04");
    expect(voteRes.submitted).toBe(false);
    expect(voteRes.reason).toContain("OKB Stake Protection");

    // With explicit bypass override
    const voteBypass = await evaluator.submitVote("disp-risky-04", { bypassStakeProtection: true });
    expect(voteBypass.submitted).toBe(true);
  });

  it("supports pluggable custom LLM caller", async () => {
    const mockLlm = async (system: string, _user: string) => {
      if (system.includes("Buyer Advocate")) {
        return JSON.stringify({
          arguments: ["Custom LLM buyer critique"],
          missingRequirements: ["Missing audit report"],
          positiveFindings: [],
          suggestedVerdict: "FULL_REFUND",
          suggestedScore: 20,
          confidence: 0.9,
        });
      }
      if (system.includes("Seller Advocate")) {
        return JSON.stringify({
          arguments: ["Custom LLM seller defense"],
          missingRequirements: [],
          positiveFindings: ["Clean code delivered"],
          suggestedVerdict: "PASS",
          suggestedScore: 85,
          confidence: 0.85,
        });
      }
      return "{}";
    };

    const evaluator = new OkxDisputeEvaluator({ llmCaller: mockLlm });
    const input: DisputeInput = {
      disputeId: "disp-llm-05",
      taskId: "task-vault-05",
      spec: baseSpec,
      deliverable: "sample deliverable",
      rejectionReason: "reason",
      escrowAmount: 100,
      token: "USDT",
    };

    const result = await evaluator.deliberate(input);
    expect(result.buyerAdvocate.arguments).toContain("Custom LLM buyer critique");
    expect(result.sellerAdvocate.arguments).toContain("Custom LLM seller defense");
  });

  it("guarantees mathematical rubric consistency where totalScore equals sum of dimensions", async () => {
    const evaluator = new OkxDisputeEvaluator();
    const testCases: DisputeInput[] = [
      {
        disputeId: "disp-math-1",
        taskId: "task-1",
        spec: "Build REST API in Node.js with JWT auth and unit tests.",
        deliverable: "const express = require('express'); // fully implemented api with auth and tests",
        rejectionReason: "Too fast",
        escrowAmount: 100,
        token: "USDT",
      },
      {
        disputeId: "disp-math-2",
        taskId: "task-2",
        spec: baseSpec,
        deliverable: "function incomplete() {}",
        rejectionReason: "Broken code and missing unit tests",
        escrowAmount: 50,
        token: "USDT",
      },
    ];

    for (const tc of testCases) {
      const res = await evaluator.deliberate(tc);
      const dimensionSum =
        res.rubric.completeness +
        res.rubric.correctnessQuality +
        res.rubric.specAlignment +
        res.rubric.goodFaithEffort;
      expect(res.rubric.totalScore).toBe(dimensionSum);
    }
  });

  it("evaluates plain-text non-markdown specs and short keywords correctly", async () => {
    const evaluator = new OkxDisputeEvaluator();
    const plainSpec =
      "Implement a DEX swap router with ETH and OKB support. Include CLI and API endpoints. Deliver unit tests.";

    const completeDeliverable = `// DEX Swap Router Implementation
export class SwapRouter {
  swapEthForOkb(amount: number) { return amount * 2; }
  swapOkbForEth(amount: number) { return amount / 2; }
}
// CLI and API endpoints:
export function cli() {}
export function api() {}
// Unit tests verified: passed 100%`;

    const result = await evaluator.deliberate({
      disputeId: "disp-plain-spec",
      taskId: "task-plain",
      spec: plainSpec,
      deliverable: completeDeliverable,
      rejectionReason: "Dislike the variable names.",
      escrowAmount: 80,
      token: "USDT",
    });

    expect(result.verdict).toBe("PASS");
    expect(result.rubric.totalScore).toBeGreaterThanOrEqual(75);
    expect(result.buyerAdvocate.missingRequirements).toHaveLength(0);
  });

  it("records and updates OKB stake slashing penalties", () => {
    const evaluator = new OkxDisputeEvaluator({ okbStakeBalance: 100 });
    expect(evaluator.getOkbStake()).toBe(100);

    const slash1 = evaluator.recordSlashingPenalty(15, "Frivolous vote out of consensus");
    expect(slash1.slashedAmount).toBe(15);
    expect(slash1.currentStake).toBe(85);
    expect(evaluator.getOkbStake()).toBe(85);

    // Negative or zero slash has no effect
    const slashZero = evaluator.recordSlashingPenalty(-5);
    expect(slashZero.slashedAmount).toBe(0);
    expect(evaluator.getOkbStake()).toBe(85);

    // Slashing more than remaining caps at current stake
    const slashMax = evaluator.recordSlashingPenalty(100);
    expect(slashMax.slashedAmount).toBe(85);
    expect(evaluator.getOkbStake()).toBe(0);
  });

  it("persists deliberations, fee records, and stake balance to disk with 0o600 permissions and reloads across instances", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "okx-evaluator-persist-"));
    const storageFile = join(tempDir, "evaluator-state.json");

    try {
      const evaluator1 = new OkxDisputeEvaluator({
        storageFile,
        okbStakeBalance: 100,
        arbitrationFeeRatio: 0.05,
      });

      const input: DisputeInput = {
        disputeId: "disp-persist-01",
        taskId: "task-persist-01",
        spec: baseSpec,
        deliverable: `contract StakingVault { function stake() external {} }`,
        rejectionReason: "Minor issue",
        escrowAmount: 200,
        token: "USDT",
      };

      const result1 = await evaluator1.deliberate(input);
      expect(result1.disputeId).toBe("disp-persist-01");

      // Verify file was written with 0o600 POSIX permissions
      expect(existsSync(storageFile)).toBe(true);
      const stat = statSync(storageFile);
      expect(stat.mode & 0o777).toBe(0o600);

      // Verify serialized state content
      const raw1 = readFileSync(storageFile, "utf8");
      const parsed1 = JSON.parse(raw1);
      expect(Array.isArray(parsed1.deliberations)).toBe(true);
      expect(parsed1.deliberations).toHaveLength(1);
      expect(parsed1.deliberations[0].disputeId).toBe("disp-persist-01");
      expect(Array.isArray(parsed1.fees)).toBe(true);
      expect(parsed1.fees).toHaveLength(1);
      expect(parsed1.fees[0].claimed).toBe(false);
      expect(parsed1.fees[0].feeAmount).toBe(10);
      expect(parsed1.okbStake).toBe(100);

      // Claim fee and apply slashing penalty to verify mutated state persistence
      const feeRes = await evaluator1.claimFee("disp-persist-01");
      expect(feeRes.success).toBe(true);
      evaluator1.recordSlashingPenalty(25, "Quorum divergence");

      const raw2 = readFileSync(storageFile, "utf8");
      const parsed2 = JSON.parse(raw2);
      expect(parsed2.fees[0].claimed).toBe(true);
      expect(parsed2.fees[0].txHash).toBeDefined();
      expect(parsed2.okbStake).toBe(75);

      // Initialize a second evaluator instance pointing to the same storageFile
      const evaluator2 = new OkxDisputeEvaluator({
        storageFile,
      });

      // Confirm reloaded deliberations, fees, and stake
      expect(evaluator2.getOkbStake()).toBe(75);
      const reloadedDelib = evaluator2.getDeliberation("disp-persist-01");
      expect(reloadedDelib).toBeDefined();
      expect(reloadedDelib?.taskId).toBe("task-persist-01");
      expect(reloadedDelib?.verdict).toBe(result1.verdict);

      const feeRecords = evaluator2.getFeeRecords();
      expect(feeRecords).toHaveLength(1);
      expect(feeRecords[0].claimed).toBe(true);
      expect(feeRecords[0].txHash).toBe(feeRes.txHash);

      // Verify double-claim prevention is maintained across reloaded instance
      await expect(evaluator2.claimFee("disp-persist-01")).rejects.toThrow("already claimed");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("evaluates boundary scores at exact tipping points (40 and 75) and enforces stake slashing protection", async () => {
    // 1. Test exact score 75 tipping point (PARTIAL_REFUND -> PASS)
    // When rawSum is 93 and blended advocate score is 33:
    // targetTotal = Math.round(93 * 0.7 + 33 * 0.3) = Math.round(65.1 + 9.9) = 75.
    const mockLlm75 = async (system: string) => {
      if (system.includes("Buyer Advocate")) {
        return JSON.stringify({
          arguments: ["Advocate critique"],
          missingRequirements: [],
          positiveFindings: [],
          suggestedVerdict: "PARTIAL_REFUND",
          suggestedScore: 33,
          confidence: 0.8,
        });
      }
      return JSON.stringify({
        arguments: ["Advocate defense"],
        missingRequirements: [],
        positiveFindings: ["Substantive code present"],
        suggestedVerdict: "PARTIAL_REFUND",
        suggestedScore: 33,
        confidence: 0.8,
      });
    };

    const evaluator75 = new OkxDisputeEvaluator({
      llmCaller: mockLlm75,
      confidenceThreshold: 0.65,
      slashingProtectionEnabled: true,
    });

    const result75 = await evaluator75.deliberate({
      disputeId: "disp-boundary-75",
      taskId: "task-75",
      spec: baseSpec,
      deliverable: `// Substantive deliverable matching full spec length requirements\ncontract TokenStaking { function stake() external {} }`,
      rejectionReason: "Subjective preference",
      escrowAmount: 100,
      token: "USDT",
    });

    expect(result75.rubric.totalScore).toBe(75);
    expect(result75.verdict).toBe("PASS");
    expect(result75.suggestedBuyerRefundRatio).toBe(0.0);
    // At score 75, margin is min(|75 - 40|, |75 - 75|) = 0.
    // marginConfidence = 0.40. With alignment 1.0, overallConfidence = 1.0 * 0.4 + 0.4 * 0.6 = 0.64.
    expect(result75.confidence).toBe(0.64);
    // Because 0.64 < 0.65, safeToVote must be false to protect staked OKB from slashing
    expect(result75.safeToVote).toBe(false);

    // Automatic submission must be withheld
    const vote75 = await evaluator75.submitVote("disp-boundary-75");
    expect(vote75.submitted).toBe(false);
    expect(vote75.reason).toContain("Vote withheld by OKB Stake Protection");

    // Explicit bypass override allows vote broadcast
    const vote75Bypass = await evaluator75.submitVote("disp-boundary-75", { bypassStakeProtection: true });
    expect(vote75Bypass.submitted).toBe(true);

    // 2. Test exact score 40 tipping point (FULL_REFUND -> PARTIAL_REFUND)
    // When deliverable is short (<60 chars), rawSum is 19. If blended advocate score is 89:
    // targetTotal = Math.round(19 * 0.7 + 89 * 0.3) = Math.round(13.3 + 26.7) = 40.
    const mockLlm40 = async (system: string) => {
      if (system.includes("Buyer Advocate")) {
        return JSON.stringify({
          arguments: ["Advocate critique"],
          missingRequirements: [],
          positiveFindings: [],
          suggestedVerdict: "PARTIAL_REFUND",
          suggestedScore: 89,
          confidence: 0.8,
        });
      }
      return JSON.stringify({
        arguments: ["Advocate defense"],
        missingRequirements: [],
        positiveFindings: [],
        suggestedVerdict: "PARTIAL_REFUND",
        suggestedScore: 89,
        confidence: 0.8,
      });
    };

    const evaluator40 = new OkxDisputeEvaluator({
      llmCaller: mockLlm40,
      confidenceThreshold: 0.65,
      slashingProtectionEnabled: true,
    });

    const result40 = await evaluator40.deliberate({
      disputeId: "disp-boundary-40",
      taskId: "task-40",
      spec: baseSpec,
      deliverable: "WIP short",
      rejectionReason: "Incomplete",
      escrowAmount: 100,
      token: "USDT",
    });

    expect(result40.rubric.totalScore).toBe(40);
    expect(result40.verdict).toBe("PARTIAL_REFUND");
    expect(result40.suggestedBuyerRefundRatio).toBe(0.5);
    // At score 40, margin is min(|40 - 40|, |40 - 75|) = 0 -> marginConfidence = 0.40.
    // overallConfidence = 0.64.
    expect(result40.confidence).toBe(0.64);
    expect(result40.safeToVote).toBe(false);

    const vote40 = await evaluator40.submitVote("disp-boundary-40");
    expect(vote40.submitted).toBe(false);
    expect(vote40.reason).toContain("OKB Stake Protection");

    const vote40Bypass = await evaluator40.submitVote("disp-boundary-40", { bypassStakeProtection: true });
    expect(vote40Bypass.submitted).toBe(true);

    // 3. Contrast with non-boundary score (e.g. score 76, margin = 1):
    // rawSum 93, blended score 36: Math.round(93 * 0.7 + 36 * 0.3) = Math.round(65.1 + 10.8) = 76.
    // margin = 1 -> marginConfidence = 0.4 + 1/10 = 0.50 -> overallConfidence = 0.40 + 0.30 = 0.70 >= 0.65.
    const mockLlm76 = async () =>
      JSON.stringify({
        arguments: ["Advocate point"],
        missingRequirements: [],
        positiveFindings: ["Substantive code present"],
        suggestedVerdict: "PASS",
        suggestedScore: 36,
        confidence: 0.8,
      });

    const evaluator76 = new OkxDisputeEvaluator({
      llmCaller: mockLlm76,
      confidenceThreshold: 0.65,
      slashingProtectionEnabled: true,
    });

    const result76 = await evaluator76.deliberate({
      disputeId: "disp-non-boundary-76",
      taskId: "task-76",
      spec: baseSpec,
      deliverable: `// Substantive deliverable matching full spec length requirements\ncontract TokenStaking { function stake() external {} }`,
      rejectionReason: "Subjective preference",
      escrowAmount: 100,
      token: "USDT",
    });

    expect(result76.rubric.totalScore).toBe(76);
    expect(result76.confidence).toBe(0.7);
    expect(result76.safeToVote).toBe(true);
  });

  it("throws clear error when claiming fee for a nonexistent dispute ID", async () => {
    const evaluator = new OkxDisputeEvaluator();
    await expect(evaluator.claimFee("nonexistent-dispute-999")).rejects.toThrow(
      "No fee record found for dispute nonexistent-dispute-999",
    );
  });

  it("guarantees mathematical rubric consistency across edge and boundary score ranges", async () => {
    const testCases: Array<{ buyerScore: number; sellerScore: number; deliv: string }> = [
      { buyerScore: 0, sellerScore: 0, deliv: "short" },
      { buyerScore: 10, sellerScore: 20, deliv: "contract A {}" },
      { buyerScore: 33, sellerScore: 33, deliv: "// long substantive deliverable exceeding sixty characters in length" },
      { buyerScore: 40, sellerScore: 40, deliv: "// long substantive deliverable exceeding sixty characters in length" },
      { buyerScore: 50, sellerScore: 70, deliv: "// long substantive deliverable exceeding sixty characters in length" },
      { buyerScore: 89, sellerScore: 89, deliv: "short" },
      { buyerScore: 100, sellerScore: 100, deliv: "// long substantive deliverable exceeding sixty characters in length" },
    ];

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i]!;
      const mockLlm = async (system: string) => {
        const score = system.includes("Buyer Advocate") ? tc.buyerScore : tc.sellerScore;
        return JSON.stringify({
          arguments: ["Advocate argument"],
          missingRequirements: [],
          positiveFindings: ["Found something"],
          suggestedVerdict: score >= 75 ? "PASS" : score >= 40 ? "PARTIAL_REFUND" : "FULL_REFUND",
          suggestedScore: score,
          confidence: 0.8,
        });
      };

      const evaluator = new OkxDisputeEvaluator({ llmCaller: mockLlm });
      const res = await evaluator.deliberate({
        disputeId: `disp-matrix-${i}`,
        taskId: `task-matrix-${i}`,
        spec: baseSpec,
        deliverable: tc.deliv,
        rejectionReason: "Testing rubric consistency",
        escrowAmount: 100,
        token: "USDT",
      });

      const dimensionSum =
        res.rubric.completeness +
        res.rubric.correctnessQuality +
        res.rubric.specAlignment +
        res.rubric.goodFaithEffort;

      expect(res.rubric.totalScore).toBe(dimensionSum);
      expect(res.rubric.completeness).toBeGreaterThanOrEqual(0);
      expect(res.rubric.completeness).toBeLessThanOrEqual(30);
      expect(res.rubric.correctnessQuality).toBeGreaterThanOrEqual(0);
      expect(res.rubric.correctnessQuality).toBeLessThanOrEqual(30);
      expect(res.rubric.specAlignment).toBeGreaterThanOrEqual(0);
      expect(res.rubric.specAlignment).toBeLessThanOrEqual(20);
      expect(res.rubric.goodFaithEffort).toBeGreaterThanOrEqual(0);
      expect(res.rubric.goodFaithEffort).toBeLessThanOrEqual(20);
      expect(res.rubric.totalScore).toBeGreaterThanOrEqual(0);
      expect(res.rubric.totalScore).toBeLessThanOrEqual(100);
    }
  });
});
