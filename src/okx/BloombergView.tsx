import { useState, useMemo } from "react";
import {
  Activity,
  Filter,
  Search,
} from "lucide-react";
import { cn } from "@/lib/cn";

export interface AspItem {
  id: string;
  name: string;
  category: string;
  reputationScore: number;
  medianPrice: number;
  tasksCompleted: number;
  rejectRate: number;
  disputeRate: number;
  recentVolume7d: number;
  trendingRank?: number;
  trustTier: "elite" | "verified" | "neutral" | "high_risk";
}

export interface CategoryMetric {
  category: string;
  aspCount: number;
  averagePrice: number;
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  averageRejectRate: number;
  totalTasks7d: number;
}

export interface BloombergViewProps {
  asps?: AspItem[];
  benchmarks?: CategoryMetric[];
  totalVolume24h?: number;
  activeAsps24h?: number;
  overallRejectRate?: number;
  onSelectAsp?: (asp: AspItem) => void;
  className?: string;
}

const DEFAULT_ASPS: AspItem[] = [
  {
    id: "asp-sol-audit-01",
    name: "Alpha Solidity Sentinel",
    category: "audit",
    reputationScore: 98,
    medianPrice: 120,
    tasksCompleted: 86,
    rejectRate: 0.02,
    disputeRate: 0.01,
    recentVolume7d: 34,
    trendingRank: 1,
    trustTier: "elite",
  },
  {
    id: "asp-data-indexer-02",
    name: "X Layer Mempool Streamer",
    category: "data",
    reputationScore: 91,
    medianPrice: 45,
    tasksCompleted: 142,
    rejectRate: 0.04,
    disputeRate: 0.02,
    recentVolume7d: 58,
    trendingRank: 2,
    trustTier: "elite",
  },
  {
    id: "asp-contract-fuzzer-03",
    name: "Echovault Invariant Fuzzer",
    category: "audit",
    reputationScore: 84,
    medianPrice: 85,
    tasksCompleted: 42,
    rejectRate: 0.09,
    disputeRate: 0.05,
    recentVolume7d: 19,
    trendingRank: 3,
    trustTier: "verified",
  },
  {
    id: "asp-market-arbiter-04",
    name: "DEX Flash Arb Scout",
    category: "trading",
    reputationScore: 78,
    medianPrice: 150,
    tasksCompleted: 30,
    rejectRate: 0.11,
    disputeRate: 0.07,
    recentVolume7d: 12,
    trendingRank: 4,
    trustTier: "verified",
  },
  {
    id: "asp-raw-scraper-05",
    name: "Bulk Metadata Scraper",
    category: "data",
    reputationScore: 52,
    medianPrice: 15,
    tasksCompleted: 24,
    rejectRate: 0.28,
    disputeRate: 0.18,
    recentVolume7d: 8,
    trendingRank: 5,
    trustTier: "high_risk",
  },
];

export function BloombergView({
  asps = DEFAULT_ASPS,
  benchmarks = [],
  totalVolume24h = 42500,
  activeAsps24h = 38,
  overallRejectRate = 0.068,
  onSelectAsp,
  className,
}: BloombergViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const a of asps) {
      if (a.category) {
        set.add(a.category.toLowerCase());
      }
    }
    return ["all", ...Array.from(set)];
  }, [asps]);

  const filteredAsps = useMemo(() => {
    return asps.filter((asp) => {
      if (
        selectedCategory.toLowerCase() !== "all" &&
        asp.category.toLowerCase() !== selectedCategory.toLowerCase()
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          asp.name.toLowerCase().includes(q) ||
          asp.id.toLowerCase().includes(q) ||
          asp.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [asps, selectedCategory, searchQuery]);

  const tierBadge = (tier: AspItem["trustTier"]) => {
    switch (tier) {
      case "elite":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "verified":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      case "high_risk":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20";
    }
  };

  return (
    <div className={cn("flex flex-col h-full overflow-y-auto p-4 space-y-4 bg-panel text-ink", className)}>
      {/* Header Snapshot Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline/40 pb-3">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Activity className="text-accent" size={18} />
            Bloomberg for OKX Agents
          </h2>
          <p className="text-xs text-ink-secondary">
            Live marketplace intelligence, pricing benchmarks, and friction diagnostics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-hairline/40 bg-card px-3 py-1.5 text-center">
            <div className="text-[10px] uppercase font-semibold text-ink-secondary">Active ASPs</div>
            <div className="text-sm font-bold text-ink">{activeAsps24h}</div>
          </div>
          <div className="rounded-lg border border-hairline/40 bg-card px-3 py-1.5 text-center">
            <div className="text-[10px] uppercase font-semibold text-ink-secondary">24h Est. Volume</div>
            <div className="text-sm font-bold text-accent">${totalVolume24h.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-hairline/40 bg-card px-3 py-1.5 text-center">
            <div className="text-[10px] uppercase font-semibold text-ink-secondary">Market Reject Rate</div>
            <div className={cn("text-sm font-bold", overallRejectRate > 0.1 ? "text-danger" : "text-emerald-500")}>
              {(overallRejectRate * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <Filter size={14} className="text-ink-secondary mr-1 shrink-0" />
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                selectedCategory.toLowerCase() === cat.toLowerCase()
                  ? "bg-accent text-ink"
                  : "bg-raised text-ink-secondary hover:text-ink",
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search size={14} className="absolute left-2.5 top-2.5 text-ink-secondary" />
          <input
            type="text"
            placeholder="Search ASPs or categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-hairline/50 bg-inset py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-ink-secondary/60 focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      {/* ASP Leaderboard Table */}
      <div className="rounded-xl border border-hairline/40 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-hairline/40 bg-raised/50 text-[11px] font-semibold text-ink-secondary uppercase">
                <th className="px-3.5 py-2.5">Rank</th>
                <th className="px-3.5 py-2.5">ASP Agent</th>
                <th className="px-3.5 py-2.5">Category</th>
                <th className="px-3.5 py-2.5">Trust Tier</th>
                <th className="px-3.5 py-2.5 text-right">Reputation</th>
                <th className="px-3.5 py-2.5 text-right">Median Price</th>
                <th className="px-3.5 py-2.5 text-right">7d Volume</th>
                <th className="px-3.5 py-2.5 text-right">Reject Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline/30">
              {filteredAsps.map((asp, idx) => (
                <tr
                  key={asp.id}
                  onClick={() => onSelectAsp?.(asp)}
                  className="hover:bg-raised/40 cursor-pointer transition-colors"
                >
                  <td className="px-3.5 py-2.5 font-mono text-ink-secondary">
                    {asp.trendingRank ? `#${asp.trendingRank}` : `#${idx + 1}`}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <div className="font-medium text-ink">{asp.name}</div>
                    <div className="font-mono text-[10px] text-ink-secondary">{asp.id}</div>
                  </td>
                  <td className="px-3.5 py-2.5 capitalize text-ink-secondary">{asp.category}</td>
                  <td className="px-3.5 py-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize",
                        tierBadge(asp.trustTier),
                      )}
                    >
                      {asp.trustTier.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-semibold">
                    <span
                      className={
                        asp.reputationScore >= 90
                          ? "text-emerald-500"
                          : asp.reputationScore >= 75
                            ? "text-accent"
                            : "text-rose-500"
                      }
                    >
                      {asp.reputationScore}/100
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono">${asp.medianPrice} USDT</td>
                  <td className="px-3.5 py-2.5 text-right font-mono">{asp.recentVolume7d}</td>
                  <td className="px-3.5 py-2.5 text-right font-mono">
                    <span className={asp.rejectRate > 0.15 ? "text-danger font-semibold" : "text-ink"}>
                      {(asp.rejectRate * 100).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
              {filteredAsps.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-ink-secondary">
                    No ASP providers match the selected criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Benchmark Insights */}
      {benchmarks.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
            Category Friction & Pricing Distributions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {benchmarks.map((b) => (
              <div key={b.category} className="rounded-xl border border-hairline/40 bg-card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs capitalize text-ink">{b.category}</span>
                  <span className="text-[10px] text-ink-secondary">{b.aspCount} ASPs</span>
                </div>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-ink-secondary">Price Range:</span>
                  <span className="font-mono text-ink">
                    ${b.minPrice} - ${b.maxPrice} USDT
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-ink-secondary">Median Price:</span>
                  <span className="font-mono font-semibold text-accent">${b.medianPrice} USDT</span>
                </div>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-ink-secondary">Avg Reject Rate:</span>
                  <span
                    className={cn(
                      "font-mono font-semibold",
                      b.averageRejectRate > 0.12 ? "text-danger" : "text-emerald-500",
                    )}
                  >
                    {(b.averageRejectRate * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
