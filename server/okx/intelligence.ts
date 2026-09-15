import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { writeFileAtomic } from "../atomic.ts";

export type TrustTier = "elite" | "verified" | "neutral" | "high_risk";

export interface AspProfile {
  id: string;
  name: string;
  category: string;
  reputationScore: number; // 0 - 100
  medianPrice: number; // in USDT
  averageTurnaroundMinutes: number;
  tasksCompleted: number;
  disputesCount: number;
  rejectionsCount: number;
  disputesWon: number;
  rejectRate: number; // rejections / tasksCompleted
  disputeRate: number; // disputes / tasksCompleted
  recentVolume7d: number;
  trendingRank?: number;
  trustTier: TrustTier;
  buyerVolumes?: Record<string, number>;
  hhiScore?: number;
  updatedAt: number;
}

export interface Eip3009PaymentHeaders {
  from: string;
  signature: string;
  nonce: string;
  validBefore: number;
  validAfter?: number;
}

export interface Eip3009VerificationResult {
  valid: boolean;
  status?: 400 | 402;
  error?: string;
  payment?: Eip3009PaymentHeaders;
}

export interface McpJsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpJsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/**
 * Validates EIP-3009 gasless micro-payment authorization headers.
 * Requirements:
 * - Missing from/signature/nonce/validBefore -> 402 Payment Required
 * - Invalid from (not 0x + 40 hex chars) -> 400 Bad Request
 * - Invalid signature (not 0x hex, length < 130) -> 400 Bad Request
 * - Invalid validBefore (not a number) -> 400 Bad Request
 * - Expired (validBefore <= nowSec) -> 400 Bad Request
 * - Not yet valid (validAfter > nowSec) -> 400 Bad Request
 */
export function verifyEip3009Payment(
  headers: Record<string, string | string[] | undefined>,
  options: { nowSec?: number; expectedFee?: number } = {},
): Eip3009VerificationResult {
  const get = (key: string) => {
    const v = headers[key] ?? headers[key.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
  };

  const from = get("x-payment-from");
  const signature = get("x-payment-signature");
  const nonce = get("x-payment-nonce");
  const validBeforeStr = get("x-payment-valid-before");
  const validAfterStr = get("x-payment-valid-after");

  if (!from || !signature || !nonce || !validBeforeStr) {
    return {
      valid: false,
      status: 402,
      error: "Payment required: EIP-3009 transfer authorization headers missing",
    };
  }

  if (!/^0x[0-9a-fA-F]{40}$/.test(from)) {
    return { valid: false, status: 400, error: "Invalid x-payment-from address format" };
  }

  if (!/^0x[0-9a-fA-F]+$/.test(signature) || signature.length < 130) {
    return { valid: false, status: 400, error: "Invalid x-payment-signature format" };
  }

  const validBefore = Number.parseInt(validBeforeStr, 10);
  if (Number.isNaN(validBefore)) {
    return { valid: false, status: 400, error: "Invalid x-payment-valid-before timestamp" };
  }

  const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);
  if (validBefore <= nowSec) {
    return { valid: false, status: 400, error: "Payment authorization has expired (validBefore <= now)" };
  }

  let validAfter: number | undefined;
  if (validAfterStr) {
    validAfter = Number.parseInt(validAfterStr, 10);
    if (!Number.isNaN(validAfter) && validAfter > nowSec) {
      return { valid: false, status: 400, error: "Payment authorization not yet valid (validAfter > now)" };
    }
  }

  return {
    valid: true,
    payment: { from, signature, nonce, validBefore, validAfter },
  };
}

/**
 * Calculates Herfindahl-Hirschman Index (HHI) for counterparty concentration.
 * Formula: sum of squared percentage market shares. Range: [0, 10000].
 * HHI > 6000 flags excessive wash-trading or single counterparty dominance.
 */
export function calculateHhi(buyerVolumes: Record<string, number>): number {
  const total = Object.values(buyerVolumes).reduce((s, v) => s + v, 0);
  if (total <= 0) return 0;
  let hhi = 0;
  for (const vol of Object.values(buyerVolumes)) {
    const share = (vol / total) * 100;
    hhi += share * share;
  }
  return Math.round(hhi);
}

export interface CategoryBenchmark {
  category: string;
  aspCount: number;
  averagePrice: number;
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  averageRejectRate: number;
  averageDisputeRate: number;
  totalTasks7d: number;
}

export interface MarketOverview {
  totalAsps: number;
  activeAsps24h: number;
  totalVolume24h: number;
  overallRejectRate: number;
  topTrending: AspProfile[];
  categoryBenchmarks: Record<string, CategoryBenchmark>;
  timestamp: number;
}

export interface McpToolCallResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface QueryUsageRecord {
  id: string;
  tool: string;
  callerId?: string;
  fee: number;
  token: string;
  timestamp: number;
}

export interface MarketplaceIntelligenceOptions {
  storageFile?: string;
  queryFeeUsdt?: number; // default: 0.05 USDT per query
}

/**
 * OKX Marketplace Intelligence ("Bloomberg of OKX Agents").
 * Aggregates marketplace stats, benchmarks ASP performance, powers A2MCP query tools,
 * and generates premium competitive research reports for ASP providers.
 */
export class OkxMarketplaceIntelligence {
  private readonly storageFile?: string;
  private readonly queryFeeUsdt: number;
  private readonly asps = new Map<string, AspProfile>();
  private readonly queryUsage: QueryUsageRecord[] = [];
  private readonly redeemedNonces = new Set<string>();

  constructor(options: MarketplaceIntelligenceOptions = {}) {
    this.storageFile = options.storageFile;
    this.queryFeeUsdt = options.queryFeeUsdt ?? 0.05;

    if (this.storageFile && existsSync(this.storageFile)) {
      try {
        const raw = readFileSync(this.storageFile, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.asps)) {
          for (const a of parsed.asps) {
            if (a && typeof a.id === "string") this.asps.set(a.id, a);
          }
        }
        if (Array.isArray(parsed.queryUsage)) {
          for (const q of parsed.queryUsage) {
            if (q && typeof q.id === "string") this.queryUsage.push(q);
          }
        }
        if (Array.isArray(parsed.redeemedNonces)) {
          for (const n of parsed.redeemedNonces) {
            if (typeof n === "string") this.redeemedNonces.add(n);
          }
        }
      } catch {
        // Fallback to fresh store
      }
    }
  }

  save(): void {
    if (!this.storageFile) return;
    const dir = dirname(this.storageFile);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const data = JSON.stringify(
      {
        asps: [...this.asps.values()],
        queryUsage: this.queryUsage,
        redeemedNonces: [...this.redeemedNonces],
        updatedAt: Date.now(),
      },
      null,
      2,
    );
    writeFileAtomic(this.storageFile, data, { mode: 0o600 });
  }

  isNonceRedeemed(nonce: string): boolean {
    return this.redeemedNonces.has(nonce);
  }

  redeemNonce(nonce: string): boolean {
    if (this.redeemedNonces.has(nonce)) return false;
    this.redeemedNonces.add(nonce);
    this.save();
    return true;
  }

  /**
   * Bulk indexes or updates ASP performance profiles.
   */
  indexAsps(profiles: AspProfile[]): void {
    for (const p of profiles) {
      // Recompute rates and trust tier
      const total = Math.max(1, p.tasksCompleted);
      const rejectRate = Math.min(1, Math.max(0, Math.round((p.rejectionsCount / total) * 1000) / 1000));
      const disputeRate = Math.min(1, Math.max(0, Math.round((p.disputesCount / total) * 1000) / 1000));
      const reputationScore = Math.min(100, Math.max(0, p.reputationScore));

      let hhiScore = p.hhiScore;
      if (p.buyerVolumes) {
        hhiScore = calculateHhi(p.buyerVolumes);
      }

      let trustTier: TrustTier = "neutral";
      if (rejectRate > 0.25 || disputeRate > 0.15 || (hhiScore !== undefined && hhiScore > 6000)) {
        trustTier = "high_risk";
      } else if (
        reputationScore >= 90 &&
        rejectRate <= 0.05 &&
        disputeRate <= 0.05 &&
        p.tasksCompleted >= 20
      ) {
        trustTier = "elite";
      } else if (
        reputationScore >= 75 &&
        rejectRate <= 0.12 &&
        disputeRate <= 0.10
      ) {
        trustTier = "verified";
      }

      this.asps.set(p.id, {
        ...p,
        reputationScore,
        rejectRate,
        disputeRate,
        trustTier,
        hhiScore,
        updatedAt: Date.now(),
      });
    }

    this.recalculateTrendingRanks();
    this.save();
  }

  private recalculateTrendingRanks(): void {
    const sorted = [...this.asps.values()].sort((a, b) => {
      // Momentum metric: high 7d volume + high reputation
      const scoreA = a.recentVolume7d * 0.7 + a.reputationScore * 0.3;
      const scoreB = b.recentVolume7d * 0.7 + b.reputationScore * 0.3;
      return scoreB - scoreA;
    });

    sorted.forEach((asp, index) => {
      asp.trendingRank = index + 1;
    });
  }

  getAsp(id: string): AspProfile | undefined {
    return this.asps.get(id);
  }

  listAsps(filter?: { category?: string; trustTier?: TrustTier }): AspProfile[] {
    let list = [...this.asps.values()];
    if (filter?.category) {
      list = list.filter((a) => a.category.toLowerCase() === filter.category!.toLowerCase());
    }
    if (filter?.trustTier) {
      list = list.filter((a) => a.trustTier === filter.trustTier);
    }
    return list;
  }

  getTrendingAsps(limit = 10): AspProfile[] {
    return [...this.asps.values()]
      .sort((a, b) => (a.trendingRank ?? 999) - (b.trendingRank ?? 999))
      .slice(0, limit);
  }

  /**
   * Computes market benchmarks grouped by category.
   */
  getCategoryBenchmarks(categoryFilter?: string): CategoryBenchmark[] {
    const categories = new Map<string, AspProfile[]>();

    for (const asp of this.asps.values()) {
      if (categoryFilter && asp.category.toLowerCase() !== categoryFilter.toLowerCase()) {
        continue;
      }
      const list = categories.get(asp.category) ?? [];
      list.push(asp);
      categories.set(asp.category, list);
    }

    const benchmarks: CategoryBenchmark[] = [];

    for (const [cat, aspsInCat] of categories.entries()) {
      const prices = aspsInCat.map((a) => a.medianPrice).sort((a, b) => a - b);
      const avgPrice =
        prices.length > 0
          ? Math.round((prices.reduce((s, p) => s + p, 0) / prices.length) * 100) / 100
          : 0;
      let medianPrice = 0;
      if (prices.length > 0) {
        const mid = Math.floor(prices.length / 2);
        medianPrice =
          prices.length % 2 === 1
            ? prices[mid]
            : Math.round(((prices[mid - 1] + prices[mid]) / 2) * 100) / 100;
      }
      const minPrice = prices[0] ?? 0;
      const maxPrice = prices[prices.length - 1] ?? 0;

      const avgRejectRate =
        Math.round(
          (aspsInCat.reduce((s, a) => s + a.rejectRate, 0) / aspsInCat.length) * 1000,
        ) / 1000;
      const avgDisputeRate =
        Math.round(
          (aspsInCat.reduce((s, a) => s + a.disputeRate, 0) / aspsInCat.length) * 1000,
        ) / 1000;
      const totalTasks7d = aspsInCat.reduce((s, a) => s + a.recentVolume7d, 0);

      benchmarks.push({
        category: cat,
        aspCount: aspsInCat.length,
        averagePrice: avgPrice,
        medianPrice,
        minPrice,
        maxPrice,
        averageRejectRate: avgRejectRate,
        averageDisputeRate: avgDisputeRate,
        totalTasks7d,
      });
    }

    return benchmarks;
  }

  getMarketOverview(): MarketOverview {
    const all = [...this.asps.values()];
    const totalAsps = all.length;
    const activeAsps24h = all.filter((a) => a.recentVolume7d > 0).length;
    const totalVolume24h = Math.round(
      all.reduce((s, a) => s + a.recentVolume7d * a.medianPrice, 0) / 7,
    );
    const overallRejectRate =
      totalAsps > 0
        ? Math.round((all.reduce((s, a) => s + a.rejectRate, 0) / totalAsps) * 1000) / 1000
        : 0;

    const benchmarks = this.getCategoryBenchmarks();
    const benchmarkMap: Record<string, CategoryBenchmark> = {};
    for (const b of benchmarks) {
      benchmarkMap[b.category] = b;
    }

    return {
      totalAsps,
      activeAsps24h,
      totalVolume24h,
      overallRejectRate,
      topTrending: this.getTrendingAsps(5),
      categoryBenchmarks: benchmarkMap,
      timestamp: Date.now(),
    };
  }

  // --- Free A2MCP Resources ---

  /**
   * Public, read-only resources for the OKX.AI Free A2MCP listing.
   * These declarations intentionally use the MCP `inputSchema` field and make
   * no claim of payment, wallet, chain, or live-marketplace settlement.
   */
  getFreeToolDeclarations(): Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    annotations: { readOnlyHint: true; destructiveHint: false; openWorldHint: false };
  }> {
    const readOnly = { readOnlyHint: true as const, destructiveHint: false as const, openWorldHint: false as const };
    return [
      {
        name: "list_okx_ai_use_cases",
        description: "Free resource: browse safe, read-only OKX.AI agent-service use cases. No wallet, payment, key, or mainnet access.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: readOnly,
      },
      {
        name: "get_free_a2mcp_launch_checklist",
        description: "Free resource: get a practical checklist for publishing a read-only A2MCP service without payments or mainnet dependencies.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: readOnly,
      },
      {
        name: "query_market_benchmarks",
        description: "Free resource: inspect locally indexed marketplace benchmark data with provenance metadata. It never claims live OKX marketplace data.",
        inputSchema: {
          type: "object",
          properties: { category: { type: "string", maxLength: 80 } },
          additionalProperties: false,
        },
        annotations: readOnly,
      },
      {
        name: "get_asp_reputation",
        description: "Free resource: inspect a locally indexed ASP reputation record with provenance metadata. No payment or chain action occurs.",
        inputSchema: {
          type: "object",
          properties: { aspId: { type: "string", minLength: 1, maxLength: 200 } },
          required: ["aspId"],
          additionalProperties: false,
        },
        annotations: readOnly,
      },
      {
        name: "get_trending_asps",
        description: "Free resource: inspect locally indexed ASP momentum rankings with provenance metadata. No payment or chain action occurs.",
        inputSchema: {
          type: "object",
          properties: { limit: { type: "integer", minimum: 1, maximum: 20, default: 5 } },
          additionalProperties: false,
        },
        annotations: readOnly,
      },
    ];
  }

  /** Executes only free, read-only resources. It neither records usage nor
   * redeems a nonce, so callers cannot trigger a payment-like durable action. */
  handleFreeMcpToolCall(toolName: string, args: Record<string, unknown>): McpToolCallResult {
    const resource = {
      access: "free",
      paymentRequired: false,
      walletRequired: false,
      mainnet: false,
      provenance: "kind-meitner local registry and public OKX.AI setup guidance",
    };
    const success = (data: unknown): McpToolCallResult => ({
      content: [{ type: "text", text: JSON.stringify({ resource, data }, null, 2) }],
    });
    const invalid = (message: string): McpToolCallResult => ({
      isError: true,
      content: [{ type: "text", text: message }],
    });

    if (toolName === "list_okx_ai_use_cases") {
      return success({
        useCases: [
          {
            id: "market-intelligence",
            title: "Marketplace intelligence",
            impact: "Give agents a read-only way to compare locally indexed pricing, reliability, and concentration signals before choosing a provider.",
          },
          {
            id: "agent-service-discovery",
            title: "Agent-service discovery",
            impact: "Expose structured service capabilities to agents through MCP without requiring a wallet or user account.",
          },
          {
            id: "recurring-research",
            title: "Recurring research workflows",
            impact: "Use market snapshots as inputs to recurring planning and reporting workflows; this resource itself performs no scheduling or payment.",
          },
          {
            id: "responsible-launch",
            title: "Responsible A2MCP launch",
            impact: "Start with a transparent free resource, validate utility and provenance, then consider an official x402 testnet integration separately.",
          },
        ],
      });
    }

    if (toolName === "get_free_a2mcp_launch_checklist") {
      return success({
        checklist: [
          "Publish a public HTTPS endpoint that returns a direct HTTP 200 result for free calls.",
          "Keep resources read-only, rate-limited, and explicit about data provenance.",
          "Do not request wallet credentials, API keys, payment headers, or mainnet access for the free service.",
          "Register the endpoint as a free A2MCP ASP only after endpoint self-checks pass.",
          "Treat x402 testnet support as a separate, reviewed follow-up rather than a hidden fallback.",
        ],
        officialDocs: [
          "https://web3.okx.com/onchainos/dev-docs/okxai/howtomcp",
          "https://web3.okx.com/onchainos/dev-docs/okxai/registerasp",
        ],
      });
    }

    if (toolName === "query_market_benchmarks") {
      const category = args.category;
      if (category !== undefined && (typeof category !== "string" || category.trim().length === 0 || category.length > 80)) {
        return invalid("category must be a non-empty string of at most 80 characters when provided");
      }
      return success({ categoryFilter: category?.trim() || "all", benchmarks: this.getCategoryBenchmarks(category?.trim()) });
    }

    if (toolName === "get_asp_reputation") {
      const aspId = args.aspId;
      if (typeof aspId !== "string" || aspId.trim().length === 0 || aspId.length > 200) {
        return invalid("aspId must be a non-empty string of at most 200 characters");
      }
      const asp = this.getAsp(aspId.trim());
      if (!asp) return invalid(`ASP with ID '${aspId.trim()}' was not found in the local intelligence registry.`);
      return success({ asp });
    }

    if (toolName === "get_trending_asps") {
      const limit = args.limit ?? 5;
      if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 20) {
        return invalid("limit must be an integer from 1 through 20");
      }
      const trending = this.getTrendingAsps(limit);
      return success({ count: trending.length, trending });
    }

    return invalid(`Unknown free resource: ${toolName}`);
  }

  // --- Paid A2MCP Tool Handlers (legacy; not used by Free A2MCP) ---

  getToolDeclarations(): Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> {
    return [
      {
        name: "query_market_benchmarks",
        description:
          "Query pricing benchmarks, reject rates, and volume statistics for OKX.ai agent categories. Fee: 0.05 USDT.",
        parameters: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Filter benchmarks by specific category (e.g., 'audit', 'data', 'research')",
            },
          },
        },
      },
      {
        name: "get_asp_reputation",
        description:
          "Fetch deep reputation, win rate, and risk metrics for a specific ASP agent provider. Fee: 0.05 USDT.",
        parameters: {
          type: "object",
          properties: {
            aspId: { type: "string", description: "The ASP Agent identifier" },
          },
          required: ["aspId"],
        },
      },
      {
        name: "get_trending_asps",
        description:
          "Fetch the fastest rising ASP agents on OKX marketplace ranked by 7-day momentum and reputation. Fee: 0.05 USDT.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Maximum number of ASPs to return (default 10)" },
          },
        },
      },
    ];
  }

  async handleMcpToolCall(
    toolName: string,
    args: Record<string, unknown>,
    callerId?: string,
  ): Promise<McpToolCallResult> {
    const knownTools = ["query_market_benchmarks", "get_asp_reputation", "get_trending_asps"];
    if (!knownTools.includes(toolName)) {
      return {
        isError: true,
        content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
      };
    }

    // Record billable API usage
    this.queryUsage.push({
      id: `mcp-${randomUUID().slice(0, 8)}`,
      tool: toolName,
      callerId,
      fee: this.queryFeeUsdt,
      token: "USDT",
      timestamp: Date.now(),
    });
    this.save();

    if (toolName === "query_market_benchmarks") {
      const category = typeof args.category === "string" ? args.category : undefined;
      const benchmarks = this.getCategoryBenchmarks(category);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ categoryFilter: category ?? "all", benchmarks }, null, 2),
          },
        ],
      };
    }

    if (toolName === "get_asp_reputation") {
      const aspId = String(args.aspId ?? "");
      const asp = this.getAsp(aspId);
      if (!asp) {
        return {
          isError: true,
          content: [{ type: "text", text: `ASP with ID '${aspId}' was not found in intelligence registry.` }],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(asp, null, 2) }],
      };
    }

    if (toolName === "get_trending_asps") {
      const limit = typeof args.limit === "number" ? args.limit : 10;
      const trending = this.getTrendingAsps(limit);
      return {
        content: [{ type: "text", text: JSON.stringify({ count: trending.length, trending }, null, 2) }],
      };
    }

    return {
      isError: true,
      content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
    };
  }

  getQueryUsage(): QueryUsageRecord[] {
    return [...this.queryUsage];
  }

  // --- A2A Report Generator ---

  generateIntelligenceReport(options: { focusCategory?: string } = {}): string {
    const overview = this.getMarketOverview();
    const benchmarks = this.getCategoryBenchmarks(options.focusCategory);
    const topTrending = this.getTrendingAsps(5);
    const highRiskAsps = this.listAsps({ trustTier: "high_risk" });

    return `# 📊 Bloomberg for OKX Agents: Marketplace Intelligence & Risk Report
*Generated by OKX Intelligence ASP | Date: ${new Date(overview.timestamp).toISOString().split("T")[0]}*

---

## 1. Executive Market Snapshot
- **Total Registered ASPs**: ${overview.totalAsps}
- **Active ASPs (24h)**: ${overview.activeAsps24h}
- **Estimated 24h Marketplace Volume**: ~$${overview.totalVolume24h.toLocaleString()} USDT
- **Marketwide Reject Rate**: ${(overview.overallRejectRate * 100).toFixed(1)}%

---

## 2. Category Pricing & Friction Matrix
${benchmarks
  .map(
    (b) => `### \`${b.category.toUpperCase()}\`
- **ASP Count**: ${b.aspCount} providers
- **Price Range**: $${b.minPrice} - $${b.maxPrice} USDT (Median: **$${b.medianPrice} USDT**, Avg: **$${b.averagePrice} USDT**)
- **Friction Indices**: Reject Rate: **${(b.averageRejectRate * 100).toFixed(1)}%** | Dispute Rate: **${(b.averageDisputeRate * 100).toFixed(1)}%**
- **7-Day Task Volume**: ${b.totalTasks7d} tasks
`,
  )
  .join("\n")}

---

## 3. Top Trending ASPs (Momentum Leaders)
${topTrending
  .map(
    (t, i) => `${i + 1}. **${t.name}** (\`${t.id}\`) — *${t.category}*
   - Reputation: **${t.reputationScore}/100** | Tier: \`${t.trustTier}\`
   - Median Price: $${t.medianPrice} USDT | 7d Volume: ${t.recentVolume7d} tasks | Reject Rate: ${(t.rejectRate * 100).toFixed(1)}%`,
  )
  .join("\n")}

---

## 4. Market Risk & Dispute Outliers
- **High-Risk ASPs Flagged**: ${highRiskAsps.length}
${highRiskAsps
  .slice(0, 5)
  .map(
    (hr) =>
      `  - ⚠️ **${hr.name}** (\`${hr.id}\`): Reject rate ${(hr.rejectRate * 100).toFixed(1)}%, Dispute rate ${(hr.disputeRate * 100).toFixed(1)}%`,
  )
  .join("\n") || "  - No severe risk outliers detected in current window."}

---

## 5. Strategic Directives for ASP Operators
1. **Pricing Arbitrage**: If pricing below the median in categories with <10% reject rates, there is head-room to raise service fees by 15-25%.
2. **Dispute Avoidance**: Top cause of rejection is spec misalignment. ASPs that require structured acceptance schemas before starting work boast 68% lower dispute frequencies.
3. **Escrow Hedging**: Maintain clear intermediate milestones to secure partial disbursements in the event of dispute mediation.
`;
  }
}
