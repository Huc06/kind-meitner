import { randomUUID } from "node:crypto";
import type { RoomAddress, RoomHandoffs } from "../room-handoffs.ts";
import type { DisputeInput, DeliberationResult } from "./evaluator.ts";
import { OkxDisputeEvaluator } from "./evaluator.ts";
import type { OkxGateway } from "./gateway.ts";
import { OkxMarketplaceIntelligence } from "./intelligence.ts";
import { OkxRecurringEngine } from "./scheduler.ts";

export interface OkxMetaAgentConfig {
  gateway: OkxGateway;
  evaluator?: OkxDisputeEvaluator;
  scheduler?: OkxRecurringEngine;
  intelligence?: OkxMarketplaceIntelligence;
  handoffs?: RoomHandoffs;
}

export interface RoomDeliberationTurn {
  speakerRole: "buyer_advocate" | "seller_advocate" | "chief_arbiter";
  speakerName: string;
  text: string;
  timestamp: number;
}

export interface RoomDeliberationSession {
  sessionId: string;
  disputeId: string;
  groupId?: string;
  threadId: string;
  turns: RoomDeliberationTurn[];
  finalResult: DeliberationResult;
}

/**
 * OKX Meta-Agent Orchestrator.
 * Coordinates multi-agent discussions, tool executions, and room handoffs
 * across the OKX.ai agent ecosystem (Evaluator, Scheduler, Intelligence, and Gateway).
 */
export class OkxMetaAgentOrchestrator {
  readonly gateway: OkxGateway;
  readonly evaluator: OkxDisputeEvaluator;
  readonly scheduler?: OkxRecurringEngine;
  readonly intelligence: OkxMarketplaceIntelligence;
  readonly handoffs?: RoomHandoffs;
  private readonly deliberationSessions = new Map<string, RoomDeliberationSession>();

  constructor(config: OkxMetaAgentConfig) {
    this.gateway = config.gateway;
    this.evaluator = config.evaluator ?? new OkxDisputeEvaluator({ gateway: config.gateway });
    this.scheduler = config.scheduler;
    this.intelligence = config.intelligence ?? new OkxMarketplaceIntelligence();
    this.handoffs = config.handoffs;
  }

  /**
   * Tool definition schema for room agents / Meta-Agent.
   */
  getRoomTools(): Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> {
    return [
      {
        name: "post_okx_task",
        description: "Post a task or subcontract work to an ASP agent on the OKX.ai marketplace.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Title of the task" },
            spec: { type: "string", description: "Detailed specification and acceptance criteria" },
            budget: { type: "number", description: "Budget in USDT" },
            targetAspId: { type: "string", description: "Optional specific ASP Agent ID" },
          },
          required: ["title", "spec", "budget"],
        },
      },
      {
        name: "check_dispute_status",
        description: "Check the state, consensus metrics, and verdict of an active OKX dispute.",
        parameters: {
          type: "object",
          properties: {
            disputeId: { type: "string", description: "Dispute ID" },
          },
          required: ["disputeId"],
        },
      },
      {
        name: "query_market_pulse",
        description: "Query Bloomberg intelligence benchmarks for OKX agent categories and trending ASPs.",
        parameters: {
          type: "object",
          properties: {
            category: { type: "string", description: "Optional category filter" },
          },
        },
      },
      {
        name: "deliberate_dispute",
        description: "Trigger a 3-agent deliberative jury (Buyer Advocate, Seller Advocate, Chief Arbiter) on a rejected task.",
        parameters: {
          type: "object",
          properties: {
            disputeId: { type: "string", description: "Unique Dispute ID" },
            taskId: { type: "string", description: "Associated Task ID" },
            spec: { type: "string", description: "Original task specification" },
            deliverable: { type: "string", description: "Submitted deliverable from seller" },
            rejectionReason: { type: "string", description: "Reason given by buyer for rejection" },
            escrowAmount: { type: "number", description: "Escrow amount in USDT" },
          },
          required: ["disputeId", "taskId", "spec", "deliverable", "rejectionReason", "escrowAmount"],
        },
      },
    ];
  }

  /**
   * Dispatches a tool call from the room or Meta-Agent.
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    context?: { groupId?: string; threadId?: string; botId?: string },
  ): Promise<{ ok: boolean; result: unknown; formattedMessage: string }> {
    switch (toolName) {
      case "post_okx_task": {
        const title = String(args.title ?? "").trim();
        const spec = String(args.spec ?? "").trim();
        const budget = Number(args.budget);
        const targetAspId = args.targetAspId ? String(args.targetAspId).trim() : undefined;

        if (!title) {
          return {
            ok: false,
            result: null,
            formattedMessage: "⚠️ Task title cannot be empty.",
          };
        }
        if (!spec) {
          return {
            ok: false,
            result: null,
            formattedMessage: "⚠️ Task specification cannot be empty.",
          };
        }
        if (!Number.isFinite(budget) || budget <= 0) {
          return {
            ok: false,
            result: null,
            formattedMessage: `⚠️ Invalid budget amount: ${args.budget}. Must be a positive number.`,
          };
        }

        const task = await this.gateway.postTask({ title, spec, budget, targetAspId });
        return {
          ok: true,
          result: task,
          formattedMessage: `✅ **OKX Task Posted**: \`${task.id}\`\n- **Title**: ${task.title}\n- **Budget**: ${task.escrowAmount} ${task.token}\n- **Assigned ASP**: ${task.aspId ?? "Open Market Pool"}`,
        };
      }

      case "check_dispute_status": {
        const disputeId = String(args.disputeId ?? "");
        const deliberation = this.evaluator.getDeliberation(disputeId);
        if (!deliberation) {
          return {
            ok: false,
            result: null,
            formattedMessage: `⚠️ Dispute \`${disputeId}\` not found in Evaluator registry.`,
          };
        }
        return {
          ok: true,
          result: deliberation,
          formattedMessage: `⚖️ **Dispute \`${disputeId}\` Status**:
- **Verdict**: \`${deliberation.verdict}\` (Rubric Score: ${deliberation.rubric.totalScore}/100)
- **Confidence**: ${(deliberation.confidence * 100).toFixed(1)}% | **OKB Slashing Protected**: ${deliberation.safeToVote ? "YES" : "NO"}
- **Buyer Refund Ratio**: ${deliberation.suggestedBuyerRefundRatio * 100}%`,
        };
      }

      case "query_market_pulse": {
        const category = typeof args.category === "string" ? args.category : undefined;
        const benchmarks = this.intelligence.getCategoryBenchmarks(category);
        const trending = this.intelligence.getTrendingAsps(3);
        return {
          ok: true,
          result: { benchmarks, trending },
          formattedMessage: `📈 **OKX Market Pulse**:\n` +
            benchmarks.map((b) => `• **${b.category}**: Median $${b.medianPrice} USDT | Reject Rate: ${(b.averageRejectRate * 100).toFixed(1)}% (${b.aspCount} ASPs)`).join("\n") +
            `\n\n🔥 **Trending ASPs**:\n` +
            trending.map((t) => `• **${t.name}** (${t.category}): Score ${t.reputationScore}/100 | Volume 7d: ${t.recentVolume7d}`).join("\n"),
        };
      }

      case "deliberate_dispute": {
        const disputeId = typeof args.disputeId === "string" ? args.disputeId.trim() : "";
        const taskId = typeof args.taskId === "string" ? args.taskId.trim() : "";
        const spec = typeof args.spec === "string" ? args.spec.trim() : "";
        const deliverable = typeof args.deliverable === "string" ? args.deliverable.trim() : "";
        const rejectionReason = typeof args.rejectionReason === "string" ? args.rejectionReason.trim() : "";
        const escrowAmount = typeof args.escrowAmount === "number" || (typeof args.escrowAmount === "string" && args.escrowAmount.trim() !== "")
          ? Number(args.escrowAmount)
          : NaN;

        if (!disputeId || !taskId || !spec || !deliverable || !rejectionReason) {
          return {
            ok: false,
            result: null,
            formattedMessage: "⚠️ Missing or invalid dispute parameters: disputeId, taskId, spec, deliverable, and rejectionReason must be non-empty strings.",
          };
        }
        if (!Number.isFinite(escrowAmount) || escrowAmount <= 0) {
          return {
            ok: false,
            result: null,
            formattedMessage: `⚠️ Invalid escrow amount: ${String(args.escrowAmount)}. Must be a positive finite number.`,
          };
        }

        const disputeInput: DisputeInput = {
          disputeId,
          taskId,
          spec,
          deliverable,
          rejectionReason,
          escrowAmount,
          token: "USDT",
        };

        const session = await this.conductRoomDeliberation(
          context?.groupId,
          context?.threadId ?? "thread-dispute",
          disputeInput,
        );

        return {
          ok: true,
          result: session.finalResult,
          formattedMessage: session.finalResult.deliberationTranscript,
        };
      }

      default:
        return {
          ok: false,
          result: null,
          formattedMessage: `Unknown OKX tool: ${toolName}`,
        };
    }
  }

  /**
   * Conducts a multi-agent deliberative discourse in the room.
   * Leverages RoomHandoffs if available to enqueue child turns.
   */
  async conductRoomDeliberation(
    groupId: string | undefined,
    threadId: string,
    input: DisputeInput,
  ): Promise<RoomDeliberationSession> {
    const finalResult = await this.evaluator.deliberate(input);

    const turns: RoomDeliberationTurn[] = [
      {
        speakerRole: "buyer_advocate",
        speakerName: "Buyer Advocate Agent",
        text: `**Buyer Representation**: I have reviewed the task specification and deliverable.\n` +
          `• **Key Findings**: ${finalResult.buyerAdvocate.arguments.join(" ")}\n` +
          `• **Unmet Requirements**: ${finalResult.buyerAdvocate.missingRequirements.length > 0 ? finalResult.buyerAdvocate.missingRequirements.join(", ") : "None"}\n` +
          `• **Proposed Verdict**: \`${finalResult.buyerAdvocate.suggestedVerdict}\` (Score: ${finalResult.buyerAdvocate.suggestedScore}/100)`,
        timestamp: Date.now(),
      },
      {
        speakerRole: "seller_advocate",
        speakerName: "Seller Advocate Agent",
        text: `**Seller Defense**: Looking at the submitted work in context of the agreement:\n` +
          `• **Substantive Merits**: ${finalResult.sellerAdvocate.arguments.join(" ")}\n` +
          `• **Deliverable Proofs**: ${finalResult.sellerAdvocate.positiveFindings.length > 0 ? finalResult.sellerAdvocate.positiveFindings.join(", ") : "Good faith completion"}\n` +
          `• **Proposed Verdict**: \`${finalResult.sellerAdvocate.suggestedVerdict}\` (Score: ${finalResult.sellerAdvocate.suggestedScore}/100)`,
        timestamp: Date.now() + 100,
      },
      {
        speakerRole: "chief_arbiter",
        speakerName: "Chief Arbiter Agent",
        text: `**Jury Consensus Ruling**:\n` +
          `• **Verdict**: **\`${finalResult.verdict}\`** (Rubric Score: **${finalResult.rubric.totalScore}/100**)\n` +
          `• **Rationale**: ${finalResult.arbiterRationale}\n` +
          `• **Confidence**: ${(finalResult.confidence * 100).toFixed(1)}% | **OKB Slashing Safe**: ${finalResult.safeToVote ? "✅ YES" : "⚠️ WITHHELD"}`,
        timestamp: Date.now() + 200,
      },
    ];

    // If RoomHandoffs is present, register nodes
    if (this.handoffs) {
      try {
        const rootAddress: RoomAddress = {
          groupId,
          threadId,
          botId: "meta-agent",
        };
        const rootId = `dispute-root-${input.disputeId}`;

        for (const [idx, turn] of turns.entries()) {
          const targetAddress: RoomAddress = {
            groupId,
            threadId,
            botId: turn.speakerRole,
          };
          this.handoffs.enqueue(
            rootAddress,
            rootId,
            undefined,
            targetAddress,
            `deliberation-step-${idx}`,
            turn.text,
            true,
          );
        }
      } catch (err) {
        console.warn(`[OkxMetaAgent] Failed to enqueue deliberation turn in RoomHandoffs:`, err);
      }
    }

    const session: RoomDeliberationSession = {
      sessionId: `session-${randomUUID().slice(0, 8)}`,
      disputeId: input.disputeId,
      groupId,
      threadId,
      turns,
      finalResult,
    };

    this.deliberationSessions.set(session.sessionId, session);
    return session;
  }

  getSession(sessionId: string): RoomDeliberationSession | undefined {
    return this.deliberationSessions.get(sessionId);
  }
}
