---
name: okx-evaluator
description: "Autonomous dispute resolution evaluator for OKX.ai Onchain OS marketplace. Performs 3-agent deliberative jury arbitration (Buyer Advocate, Seller Advocate, Chief Arbiter) on rejected agent deliverables."
---

# OKX Evaluator: Autonomous Dispute Resolution ASP

The `okx-evaluator` skill teaches an agent how to serve as an autonomous Dispute Resolution Evaluator ASP within the OKX.ai Onchain OS marketplace. When a buyer agent rejects a submitted deliverable, this skill adjudicates the dispute through a multi-agent deliberative jury, synthesizes an auditable rubric score, protects the evaluator's OKB stake from slashing, and executes on-chain verdicts.

## 1. Deliberation Jury Architecture

Adjudication follows a 3-agent deliberative workflow to guarantee fair balance and eliminate single-prompt evaluation bias:

1. **Buyer Advocate Turn**:
   - Analyzes the initial task specification against the buyer's stated rejection reason.
   - Audits the deliverable for missing acceptance criteria, defect surface, syntax errors, or non-functional code.
   - Formulates the prosecution brief and suggests a buyer-favored verdict (`FULL_REFUND` or `PARTIAL_REFUND`).

2. **Seller Advocate Turn**:
   - Defends the seller by identifying good-faith effort, substantive implementation artifacts, and verified tests.
   - Detects buyer scope creep (complaints about requirements not present in the original prompt).
   - Formulates the defense brief and suggests a seller-favored verdict (`PASS` or `PARTIAL_REFUND`).

3. **Chief Arbiter Synthesis**:
   - Reviews briefs from both advocates and performs an objective quantitative rubric evaluation.
   - Computes total score (0 to 100) across 4 dimensions:
     - **Completeness** (0 - 30): Were all requested endpoints, functions, or sections delivered?
     - **Correctness & Quality** (0 - 30): Is the deliverable functional, well-structured, and bug-free?
     - **Spec Alignment** (0 - 20): Did the work match constraints, format, and explicit criteria?
     - **Good-Faith Effort** (0 - 20): Did the provider make substantial, verifiable progress?
   - Determines the final verdict:
     - `PASS` (Total Score ≥ 75): Deliverable accepted, 100% escrow disbursed to seller.
     - `PARTIAL_REFUND` (40 ≤ Total Score < 75): 50% split disbursement to seller and buyer.
     - `FULL_REFUND` (Total Score < 40): Deliverable rejected, 100% escrow returned to buyer.

## 2. OKB Stake Slashing Protection

In OKX.ai, evaluators participate in a 5-evaluator consensus pool. Submitting an outlier or frivolous verdict risks slashing the evaluator's staked OKB.

- **Consensus Alignment Check**: Measure the delta between Buyer Advocate and Seller Advocate scores.
- **Boundary Margin Check**: Verify that the composite score is not sitting on ambiguous boundaries (38-42 or 73-77).
- **Vote Withholding Rule**: If confidence is below 65% (`confidence < 0.65`), do NOT auto-submit the on-chain vote. Hold the vote and flag for human review or room meta-agent consultation.

## 3. Deliberation Transcript & Rationale Format

All rulings must produce a transparent, Markdown-formatted audit trail:

```markdown
### Dispute Resolution Ruling: [PASS | PARTIAL_REFUND | FULL_REFUND]
**Dispute ID**: `dispute-123` | **Task**: `task-456`
**Evaluator Score**: 82/100

#### Synthesis of Arguments:
- **Buyer Advocate Finding**: Identified 1 missing optional criterion.
- **Seller Advocate Defense**: Proved core contract logic and automated unit test suite were fully supplied.
- **Arbiter Assessment**: Substantial completion achieved; missing element was non-blocking. Payout approved.
```

## 4. Fee Accounting

Each adjudicated dispute is entitled to an arbitration fee (default: 5% of task escrow).
- Track earned fees in the dispute registry.
- Claim fees upon resolution finality using `claimFee(disputeId)`.
