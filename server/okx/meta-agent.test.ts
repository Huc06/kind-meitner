import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { RoomHandoffs } from "../room-handoffs.ts";
import { OkxDisputeEvaluator, type DisputeInput } from "./evaluator.ts";
import { OkxGateway } from "./gateway.ts";
import { OkxMarketplaceIntelligence } from "./intelligence.ts";
import { OkxMetaAgentOrchestrator } from "./meta-agent.ts";

const dirs: string[] = [];

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "kind-meitner-okx-meta-"));
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

describe("OKX Meta-Agent Group Orchestrator", () => {
  it("exposes tools to the room and executes post_okx_task and query_market_pulse", async () => {
    const dir = tempDir();
    const gateway = new OkxGateway({ ledgerFile: join(dir, "tasks.json") });
    const intelligence = new OkxMarketplaceIntelligence();
    intelligence.indexAsps([
      {
        id: "asp-dex-auditor",
        name: "DEX Auditor",
        category: "audit",
        reputationScore: 92,
        medianPrice: 100,
        averageTurnaroundMinutes: 120,
        tasksCompleted: 20,
        disputesCount: 1,
        rejectionsCount: 1,
        disputesWon: 1,
        rejectRate: 0.05,
        disputeRate: 0.05,
        recentVolume7d: 10,
        trustTier: "elite",
        updatedAt: Date.now(),
      },
    ]);

    const metaAgent = new OkxMetaAgentOrchestrator({
      gateway,
      intelligence,
    });

    const tools = metaAgent.getRoomTools();
    expect(tools.map((t) => t.name)).toContain("post_okx_task");
    expect(tools.map((t) => t.name)).toContain("check_dispute_status");
    expect(tools.map((t) => t.name)).toContain("query_market_pulse");
    expect(tools.map((t) => t.name)).toContain("deliberate_dispute");

    // Execute post_okx_task
    const postRes = await metaAgent.executeTool("post_okx_task", {
      title: "Audit AMM Pool",
      spec: "Check reentrancy on swap function",
      budget: 50,
      targetAspId: "asp-dex-auditor",
    });

    expect(postRes.ok).toBe(true);
    expect(postRes.formattedMessage).toContain("OKX Task Posted");
    expect(postRes.formattedMessage).toContain("50 USDT");
    expect(postRes.formattedMessage).toContain("asp-dex-auditor");

    // Execute query_market_pulse
    const pulseRes = await metaAgent.executeTool("query_market_pulse", { category: "audit" });
    expect(pulseRes.ok).toBe(true);
    expect(pulseRes.formattedMessage).toContain("OKX Market Pulse");
    expect(pulseRes.formattedMessage).toContain("DEX Auditor");
  });

  it("coordinates 3-agent room deliberation and enqueues turns via RoomHandoffs", async () => {
    const dir = tempDir();
    const handoffFile = join(dir, "handoffs.json");
    const gateway = new OkxGateway();
    const evaluator = new OkxDisputeEvaluator();

    const changedRooms = new Set<string>();
    const handoffs = new RoomHandoffs(handoffFile, {
      validate: () => undefined,
      busy: () => false,
      run: async () => ({ ok: true, text: "Deliberation acknowledged" }),
      report: () => {},
      changed: (groupIds) => {
        for (const g of groupIds) changedRooms.add(g);
      },
    });

    const metaAgent = new OkxMetaAgentOrchestrator({
      gateway,
      evaluator,
      handoffs,
    });

    const disputeInput: DisputeInput = {
      disputeId: "disp-meta-001",
      taskId: "task-meta-001",
      spec: "Deliver Rust data pipeline with SQLite storage and benchmarks.\n- Implement ingest queue.\n- Include unit tests.",
      deliverable: "// Rust Pipeline\npub struct IngestQueue {}\n// Tests: cargo test passing 100%",
      rejectionReason: "I wanted Python instead of Rust.",
      escrowAmount: 120,
      token: "USDT",
    };

    const session = await metaAgent.conductRoomDeliberation(
      "group-disputes",
      "thread-deliberate-1",
      disputeInput,
    );

    expect(session.sessionId).toBeDefined();
    expect(session.turns).toHaveLength(3);

    // Verify 3 distinct agent persona turns
    const roles = session.turns.map((t) => t.speakerRole);
    expect(roles).toEqual(["buyer_advocate", "seller_advocate", "chief_arbiter"]);

    expect(session.turns[0].text).toContain("Buyer Representation");
    expect(session.turns[1].text).toContain("Seller Defense");
    expect(session.turns[2].text).toContain("Jury Consensus Ruling");

    // Verify final consensus
    expect(session.finalResult.verdict).toBe("PASS");
    expect(session.finalResult.rubric.totalScore).toBeGreaterThanOrEqual(75);

    // Verify tool execution wrapper
    const checkRes = await metaAgent.executeTool("check_dispute_status", {
      disputeId: "disp-meta-001",
    });
    expect(checkRes.ok).toBe(true);
    expect(checkRes.formattedMessage).toContain("PASS");
  });

  it("validates inputs for post_okx_task and rejects empty or invalid parameters", async () => {
    const metaAgent = new OkxMetaAgentOrchestrator({
      gateway: new OkxGateway(),
    });

    // Empty title
    const resEmptyTitle = await metaAgent.executeTool("post_okx_task", {
      title: "",
      spec: "Valid spec",
      budget: 20,
    });
    expect(resEmptyTitle.ok).toBe(false);
    expect(resEmptyTitle.formattedMessage).toContain("title cannot be empty");

    // Empty spec
    const resEmptySpec = await metaAgent.executeTool("post_okx_task", {
      title: "Valid Title",
      spec: "   ",
      budget: 20,
    });
    expect(resEmptySpec.ok).toBe(false);
    expect(resEmptySpec.formattedMessage).toContain("specification cannot be empty");

    // Negative / NaN budget
    const resNegBudget = await metaAgent.executeTool("post_okx_task", {
      title: "Valid Title",
      spec: "Valid spec",
      budget: -10,
    });
    expect(resNegBudget.ok).toBe(false);
    expect(resNegBudget.formattedMessage).toContain("Invalid budget amount");

    const resNanBudget = await metaAgent.executeTool("post_okx_task", {
      title: "Valid Title",
      spec: "Valid spec",
      budget: "not-a-number",
    });
    expect(resNanBudget.ok).toBe(false);
    expect(resNanBudget.formattedMessage).toContain("Invalid budget amount");
  });
});
