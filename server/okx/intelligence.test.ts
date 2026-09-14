import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  OkxMarketplaceIntelligence,
  type AspProfile,
} from "./intelligence.ts";

const dirs: string[] = [];

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "kind-meitner-okx-intel-"));
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

describe("OKX Marketplace Intelligence ('Bloomberg for Agents')", () => {
  const sampleAsps: AspProfile[] = [
    {
      id: "asp-alpha-audit",
      name: "Alpha Solidity Auditor",
      category: "audit",
      reputationScore: 96,
      medianPrice: 120,
      averageTurnaroundMinutes: 180,
      tasksCompleted: 45,
      disputesCount: 1,
      rejectionsCount: 1,
      disputesWon: 1,
      rejectRate: 0,
      disputeRate: 0,
      recentVolume7d: 25,
      trustTier: "neutral",
      updatedAt: Date.now(),
    },
    {
      id: "asp-beta-audit",
      name: "Beta Audit Express",
      category: "audit",
      reputationScore: 82,
      medianPrice: 80,
      averageTurnaroundMinutes: 60,
      tasksCompleted: 30,
      disputesCount: 2,
      rejectionsCount: 3,
      disputesWon: 1,
      rejectRate: 0,
      disputeRate: 0,
      recentVolume7d: 14,
      trustTier: "neutral",
      updatedAt: Date.now(),
    },
    {
      id: "asp-risky-scraper",
      name: "Fast Scraper Bot",
      category: "data",
      reputationScore: 55,
      medianPrice: 20,
      averageTurnaroundMinutes: 15,
      tasksCompleted: 10,
      disputesCount: 4,
      rejectionsCount: 4,
      disputesWon: 0,
      rejectRate: 0,
      disputeRate: 0,
      recentVolume7d: 8,
      trustTier: "neutral",
      updatedAt: Date.now(),
    },
  ];

  it("indexes ASPs, calculates rates and trust tiers correctly", () => {
    const dir = tempDir();
    const storageFile = join(dir, "market.json");
    const intel = new OkxMarketplaceIntelligence({ storageFile });

    intel.indexAsps(sampleAsps);

    const elite = intel.getAsp("asp-alpha-audit");
    expect(elite).toBeDefined();
    expect(elite?.trustTier).toBe("elite");
    expect(elite?.rejectRate).toBeLessThanOrEqual(0.05);
    expect(elite?.trendingRank).toBe(1); // Top 7d volume + reputation

    const risky = intel.getAsp("asp-risky-scraper");
    expect(risky?.trustTier).toBe("high_risk");
    expect(risky?.rejectRate).toBe(0.4); // 4 / 10

    // Verify disk persistence
    const restored = new OkxMarketplaceIntelligence({ storageFile });
    expect(restored.getAsp("asp-alpha-audit")?.name).toBe("Alpha Solidity Auditor");
  });

  it("computes category benchmarks and market overview", () => {
    const intel = new OkxMarketplaceIntelligence();
    intel.indexAsps(sampleAsps);

    const benchmarks = intel.getCategoryBenchmarks("audit");
    expect(benchmarks).toHaveLength(1);
    expect(benchmarks[0].category).toBe("audit");
    expect(benchmarks[0].aspCount).toBe(2);
    expect(benchmarks[0].minPrice).toBe(80);
    expect(benchmarks[0].maxPrice).toBe(120);
    expect(benchmarks[0].averagePrice).toBe(100);
    expect(benchmarks[0].totalTasks7d).toBe(39); // 25 + 14

    const overview = intel.getMarketOverview();
    expect(overview.totalAsps).toBe(3);
    expect(overview.activeAsps24h).toBe(3);
    expect(overview.topTrending.length).toBeGreaterThanOrEqual(1);
    expect(overview.topTrending[0].id).toBe("asp-alpha-audit");
  });

  it("handles A2MCP tool calls and logs monetized query usage", async () => {
    const intel = new OkxMarketplaceIntelligence({ queryFeeUsdt: 0.05 });
    intel.indexAsps(sampleAsps);

    // 1. query_market_benchmarks
    const resBenchmarks = await intel.handleMcpToolCall("query_market_benchmarks", { category: "audit" }, "caller-agent-1");
    expect(resBenchmarks.isError).toBeFalsy();
    const parsedBenchmarks = JSON.parse(resBenchmarks.content[0].text);
    expect(parsedBenchmarks.benchmarks).toHaveLength(1);
    expect(parsedBenchmarks.benchmarks[0].category).toBe("audit");

    // 2. get_asp_reputation
    const resAsp = await intel.handleMcpToolCall("get_asp_reputation", { aspId: "asp-alpha-audit" });
    expect(resAsp.isError).toBeFalsy();
    const parsedAsp = JSON.parse(resAsp.content[0].text);
    expect(parsedAsp.id).toBe("asp-alpha-audit");
    expect(parsedAsp.reputationScore).toBe(96);

    // 3. get_trending_asps
    const resTrending = await intel.handleMcpToolCall("get_trending_asps", { limit: 2 });
    expect(resTrending.isError).toBeFalsy();
    const parsedTrending = JSON.parse(resTrending.content[0].text);
    expect(parsedTrending.trending).toHaveLength(2);

    // 4. Missing ASP
    const resNotFound = await intel.handleMcpToolCall("get_asp_reputation", { aspId: "non-existent" });
    expect(resNotFound.isError).toBe(true);

    // 5. Query monetization records
    const usage = intel.getQueryUsage();
    expect(usage).toHaveLength(4);
    expect(usage[0].fee).toBe(0.05);
    expect(usage[0].token).toBe("USDT");
  });

  it("generates comprehensive A2A research intelligence report", () => {
    const intel = new OkxMarketplaceIntelligence();
    intel.indexAsps(sampleAsps);

    const report = intel.generateIntelligenceReport();
    expect(report).toContain("Bloomberg for OKX Agents");
    expect(report).toContain("Executive Market Snapshot");
    expect(report).toContain("Category Pricing & Friction Matrix");
    expect(report).toContain("Top Trending ASPs");
    expect(report).toContain("Market Risk & Dispute Outliers");
    expect(report).toContain("Strategic Directives for ASP Operators");
    expect(report).toContain("Alpha Solidity Auditor");
  });

  it("calculates true statistical median for even-sized price distributions", () => {
    const intel = new OkxMarketplaceIntelligence();
    intel.indexAsps([
      {
        id: "asp-1",
        name: "A1",
        category: "pricing_test",
        reputationScore: 80,
        medianPrice: 80,
        averageTurnaroundMinutes: 10,
        tasksCompleted: 10,
        disputesCount: 0,
        rejectionsCount: 0,
        disputesWon: 0,
        rejectRate: 0,
        disputeRate: 0,
        recentVolume7d: 5,
        trustTier: "neutral",
        updatedAt: 1,
      },
      {
        id: "asp-2",
        name: "A2",
        category: "pricing_test",
        reputationScore: 85,
        medianPrice: 120,
        averageTurnaroundMinutes: 10,
        tasksCompleted: 10,
        disputesCount: 0,
        rejectionsCount: 0,
        disputesWon: 0,
        rejectRate: 0,
        disputeRate: 0,
        recentVolume7d: 5,
        trustTier: "neutral",
        updatedAt: 1,
      },
    ]);

    const benchmarks = intel.getCategoryBenchmarks("pricing_test");
    expect(benchmarks).toHaveLength(1);
    // Median of [80, 120] is (80 + 120) / 2 = 100
    expect(benchmarks[0].medianPrice).toBe(100);
    expect(benchmarks[0].averagePrice).toBe(100);
  });

  it("clamps reputation scores and failure rates within valid bounds", () => {
    const intel = new OkxMarketplaceIntelligence();
    intel.indexAsps([
      {
        id: "asp-overflow",
        name: "Overflow Bot",
        category: "test",
        reputationScore: 150, // Should clamp to 100
        medianPrice: 10,
        averageTurnaroundMinutes: 10,
        tasksCompleted: 5,
        disputesCount: 10, // 10 / 5 = 2.0 -> Should clamp to 1.0
        rejectionsCount: 10,
        disputesWon: 0,
        rejectRate: 0,
        disputeRate: 0,
        recentVolume7d: 1,
        trustTier: "neutral",
        updatedAt: 1,
      },
    ]);

    const asp = intel.getAsp("asp-overflow");
    expect(asp?.reputationScore).toBe(100);
    expect(asp?.rejectRate).toBe(1);
    expect(asp?.disputeRate).toBe(1);
  });

  it("categorizes high-dispute ASPs as high_risk despite high reputation or low rejection rate", () => {
    const intel = new OkxMarketplaceIntelligence();
    intel.indexAsps([
      {
        id: "asp-high-dispute-high-rep",
        name: "Disputed Star ASP",
        category: "audit",
        reputationScore: 98, // Would qualify for elite if not for high dispute rate
        medianPrice: 150,
        averageTurnaroundMinutes: 120,
        tasksCompleted: 50,
        disputesCount: 10, // disputeRate = 10 / 50 = 0.20 (> 0.15 high_risk threshold)
        rejectionsCount: 0, // rejectRate = 0 (perfect low reject rate)
        disputesWon: 2,
        rejectRate: 0,
        disputeRate: 0,
        recentVolume7d: 30,
        trustTier: "neutral",
        updatedAt: Date.now(),
      },
      {
        id: "asp-high-reject-high-rep",
        name: "Flaky Star ASP",
        category: "audit",
        reputationScore: 95,
        medianPrice: 100,
        averageTurnaroundMinutes: 60,
        tasksCompleted: 40,
        disputesCount: 1, // disputeRate = 1 / 40 = 0.025 (low)
        rejectionsCount: 12, // rejectRate = 12 / 40 = 0.30 (> 0.25 high_risk threshold)
        disputesWon: 1,
        rejectRate: 0,
        disputeRate: 0,
        recentVolume7d: 20,
        trustTier: "neutral",
        updatedAt: Date.now(),
      },
    ]);

    const disputed = intel.getAsp("asp-high-dispute-high-rep");
    expect(disputed).toBeDefined();
    expect(disputed?.trustTier).toBe("high_risk");
    expect(disputed?.disputeRate).toBe(0.2);
    expect(disputed?.rejectRate).toBe(0);

    const flaky = intel.getAsp("asp-high-reject-high-rep");
    expect(flaky).toBeDefined();
    expect(flaky?.trustTier).toBe("high_risk");
    expect(flaky?.rejectRate).toBe(0.3);
  });

  it("strictly requires low dispute rates for elite and verified tiers", () => {
    const intel = new OkxMarketplaceIntelligence();
    intel.indexAsps([
      {
        // Meets all elite criteria EXCEPT disputeRate (0.075 > 0.05). Should downgrade to verified (0.075 <= 0.10).
        id: "asp-marginal-dispute-elite-candidate",
        name: "Marginal Dispute Auditor",
        category: "audit",
        reputationScore: 92,
        medianPrice: 100,
        averageTurnaroundMinutes: 90,
        tasksCompleted: 40,
        disputesCount: 3, // 3 / 40 = 0.075 (> 0.05 elite bound, <= 0.10 verified bound)
        rejectionsCount: 1, // 1 / 40 = 0.025 (<= 0.05)
        disputesWon: 1,
        rejectRate: 0,
        disputeRate: 0,
        recentVolume7d: 20,
        trustTier: "neutral",
        updatedAt: Date.now(),
      },
      {
        // Meets reputation/reject criteria for verified, but disputeRate is 0.125 (> 0.10 verified bound, <= 0.15 high_risk bound).
        // Should fall back to neutral.
        id: "asp-excessive-dispute-verified-candidate",
        name: "Borderline Verified ASP",
        category: "audit",
        reputationScore: 85,
        medianPrice: 90,
        averageTurnaroundMinutes: 80,
        tasksCompleted: 40,
        disputesCount: 5, // 5 / 40 = 0.125 (> 0.10 verified bound, <= 0.15 high_risk bound)
        rejectionsCount: 2, // 2 / 40 = 0.05 (<= 0.12)
        disputesWon: 2,
        rejectRate: 0,
        disputeRate: 0,
        recentVolume7d: 15,
        trustTier: "neutral",
        updatedAt: Date.now(),
      },
      {
        // True elite ASP: disputeRate <= 0.05, rejectRate <= 0.05, rep >= 90, tasks >= 20
        id: "asp-true-elite",
        name: "True Elite Auditor",
        category: "audit",
        reputationScore: 95,
        medianPrice: 120,
        averageTurnaroundMinutes: 100,
        tasksCompleted: 50,
        disputesCount: 2, // 2 / 50 = 0.04 (<= 0.05)
        rejectionsCount: 2, // 2 / 50 = 0.04 (<= 0.05)
        disputesWon: 2,
        rejectRate: 0,
        disputeRate: 0,
        recentVolume7d: 25,
        trustTier: "neutral",
        updatedAt: Date.now(),
      },
      {
        // True verified ASP: disputeRate <= 0.10, rejectRate <= 0.12, rep >= 75
        id: "asp-true-verified",
        name: "True Verified ASP",
        category: "audit",
        reputationScore: 78,
        medianPrice: 70,
        averageTurnaroundMinutes: 45,
        tasksCompleted: 30,
        disputesCount: 3, // 3 / 30 = 0.10 (<= 0.10)
        rejectionsCount: 3, // 3 / 30 = 0.10 (<= 0.12)
        disputesWon: 1,
        rejectRate: 0,
        disputeRate: 0,
        recentVolume7d: 10,
        trustTier: "neutral",
        updatedAt: Date.now(),
      },
    ]);

    const marginal = intel.getAsp("asp-marginal-dispute-elite-candidate");
    expect(marginal?.trustTier).toBe("verified");
    expect(marginal?.disputeRate).toBe(0.075);

    const borderline = intel.getAsp("asp-excessive-dispute-verified-candidate");
    expect(borderline?.trustTier).toBe("neutral");
    expect(borderline?.disputeRate).toBe(0.125);

    const elite = intel.getAsp("asp-true-elite");
    expect(elite?.trustTier).toBe("elite");

    const verified = intel.getAsp("asp-true-verified");
    expect(verified?.trustTier).toBe("verified");
  });

  it("persists queryUsage durably across instances via storageFile", async () => {
    const dir = tempDir();
    const storageFile = join(dir, "monetization.json");
    const intel1 = new OkxMarketplaceIntelligence({ storageFile, queryFeeUsdt: 0.05 });
    intel1.indexAsps(sampleAsps);

    // Perform two valid MCP tool calls
    const res1 = await intel1.handleMcpToolCall("query_market_benchmarks", { category: "audit" }, "caller-alpha");
    expect(res1.isError).toBeFalsy();

    const res2 = await intel1.handleMcpToolCall("get_trending_asps", { limit: 5 }, "caller-beta");
    expect(res2.isError).toBeFalsy();

    const usage1 = intel1.getQueryUsage();
    expect(usage1).toHaveLength(2);
    expect(usage1[0].tool).toBe("query_market_benchmarks");
    expect(usage1[0].callerId).toBe("caller-alpha");
    expect(usage1[0].fee).toBe(0.05);
    expect(usage1[0].token).toBe("USDT");
    expect(usage1[1].tool).toBe("get_trending_asps");
    expect(usage1[1].callerId).toBe("caller-beta");

    // Instantiate a new OkxMarketplaceIntelligence pointing to the same storageFile
    const intel2 = new OkxMarketplaceIntelligence({ storageFile });
    const usage2 = intel2.getQueryUsage();
    expect(usage2).toHaveLength(2);
    expect(usage2[0].id).toBe(usage1[0].id);
    expect(usage2[0].tool).toBe("query_market_benchmarks");
    expect(usage2[0].callerId).toBe("caller-alpha");
    expect(usage2[0].fee).toBe(0.05);
    expect(usage2[1].id).toBe(usage1[1].id);
    expect(usage2[1].tool).toBe("get_trending_asps");

    // Perform a third tool call on the reloaded instance
    const res3 = await intel2.handleMcpToolCall("get_asp_reputation", { aspId: "asp-alpha-audit" }, "caller-gamma");
    expect(res3.isError).toBeFalsy();
    expect(intel2.getQueryUsage()).toHaveLength(3);

    // Verify a third instance sees all 3 records
    const intel3 = new OkxMarketplaceIntelligence({ storageFile });
    expect(intel3.getQueryUsage()).toHaveLength(3);
    expect(intel3.getQueryUsage()[2].tool).toBe("get_asp_reputation");
    expect(intel3.getQueryUsage()[2].callerId).toBe("caller-gamma");
  });

  it("rejects unknown tool calls without recording billable query usage", async () => {
    const intel = new OkxMarketplaceIntelligence({ queryFeeUsdt: 0.05 });
    intel.indexAsps(sampleAsps);

    // Attempt calling unknown / arbitrary tools
    const res1 = await intel.handleMcpToolCall("unsupported_tool", { param: "value" }, "caller-attacker");
    expect(res1.isError).toBe(true);
    expect(res1.content[0].text).toBe("Unknown tool: unsupported_tool");

    const res2 = await intel.handleMcpToolCall("execute_arbitrary_code", {}, "caller-attacker");
    expect(res2.isError).toBe(true);
    expect(res2.content[0].text).toBe("Unknown tool: execute_arbitrary_code");

    // Verify zero query usage was billed or recorded
    expect(intel.getQueryUsage()).toHaveLength(0);

    // Now execute a valid tool call and ensure it is billed
    const validRes = await intel.handleMcpToolCall("get_trending_asps", { limit: 1 }, "caller-legit");
    expect(validRes.isError).toBeFalsy();

    const usageAfterValid = intel.getQueryUsage();
    expect(usageAfterValid).toHaveLength(1);
    expect(usageAfterValid[0].tool).toBe("get_trending_asps");
    expect(usageAfterValid[0].callerId).toBe("caller-legit");

    // Call another unknown tool and verify count remains 1
    const res3 = await intel.handleMcpToolCall("another_bogus_tool", {});
    expect(res3.isError).toBe(true);
    expect(intel.getQueryUsage()).toHaveLength(1);
  });
});
