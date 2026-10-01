import { useState, useMemo } from "react";
import { Activity, Filter, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { Frame } from "@/components/ui/frame";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { Input } from "@/components/ui/field";
import { Eyebrow } from "@/components/ui/eyebrow";

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

const TIER_TONES: Record<AspItem["trustTier"], "success" | "cyan" | "danger" | "neutral"> = {
  elite: "success",
  verified: "cyan",
  high_risk: "danger",
  neutral: "neutral",
};

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

  return (
    <div className={cn("flex flex-col h-full overflow-y-auto bg-app text-ink", className)}>
      {/* View Header */}
      <header className="h-11 shrink-0 frame-rule-below bg-app px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Activity className="size-4 text-ink-secondary shrink-0" />
          <h1 className="text-sm font-medium text-ink truncate">Bloomberg for OKX Agents</h1>
          <span aria-hidden className="h-3 w-px bg-hairline" />
          <span className="label-mono text-ink-secondary truncate hidden md:inline">
            Live marketplace intelligence, pricing benchmarks, and friction diagnostics
          </span>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* KPI Strip of Frames */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Frame surface="app" className="bg-card p-3">
            <div className="label-mono text-ink-secondary">Active ASPs</div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">{activeAsps24h}</div>
          </Frame>
          <Frame surface="app" className="bg-card p-3">
            <div className="label-mono text-ink-secondary">24h Est. Volume</div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-accent">
              ${totalVolume24h.toLocaleString()}
            </div>
          </Frame>
          <Frame surface="app" className="bg-card p-3">
            <div className="label-mono text-ink-secondary">Market Reject Rate</div>
            <div
              className={cn(
                "mt-1 font-mono text-2xl font-semibold tabular-nums",
                overallRejectRate > 0.1 ? "text-danger" : "text-success",
              )}
            >
              {(overallRejectRate * 100).toFixed(1)}%
            </div>
          </Frame>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            <Filter size={13} className="text-ink-secondary mr-1 shrink-0" />
            {categories.map((cat) => {
              const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
              return (
                <Button
                  key={cat}
                  variant={isSelected ? "primary" : "secondary"}
                  size="xs"
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </Button>
              );
            })}
          </div>

          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search size={14} className="absolute left-2.5 top-2.5 text-ink-secondary pointer-events-none" />
            <Input
              type="text"
              placeholder="Search ASPs or categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-3 text-xs"
            />
          </div>
        </div>

        {/* ASP Leaderboard Table */}
        <Frame title="ASP LEADERBOARD" index="01" surface="app" className="bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="label-mono text-ink-secondary frame-rule-below bg-raised/30">
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
              <tbody className="divide-y divide-hairline">
                {filteredAsps.map((asp, idx) => (
                  <tr
                    key={asp.id}
                    onClick={() => onSelectAsp?.(asp)}
                    className="frame-rule-below hover:bg-raised-hover cursor-pointer transition-colors duration-150"
                  >
                    <td className="px-3.5 py-2.5 font-mono text-ink-secondary tabular-nums">
                      {asp.trendingRank ? `#${asp.trendingRank}` : `#${idx + 1}`}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <div className="font-medium text-ink">{asp.name}</div>
                      <div className="font-mono text-[10px] text-ink-secondary">{asp.id}</div>
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-xs uppercase text-ink-secondary">
                      {asp.category}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <Tag tone={TIER_TONES[asp.trustTier] ?? "neutral"} variant="soft" size="sm">
                        {asp.trustTier.replace("_", " ")}
                      </Tag>
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <Tag
                        tone={
                          asp.reputationScore >= 90
                            ? "success"
                            : asp.reputationScore >= 75
                              ? "accent"
                              : "danger"
                        }
                        variant="soft"
                        size="sm"
                      >
                        {asp.reputationScore}/100
                      </Tag>
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-[12px] text-ink">
                      ${asp.medianPrice} USDT
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-[12px] text-ink-secondary">
                      {asp.recentVolume7d}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-[12px]">
                      <span
                        className={
                          asp.rejectRate > 0.15 ? "text-danger font-medium" : "text-ink"
                        }
                      >
                        {(asp.rejectRate * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredAsps.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-xs text-ink-secondary">
                      No ASP providers match the selected criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Frame>

        {/* Category Benchmark Insights */}
        {benchmarks.length > 0 && (
          <div className="space-y-3 pt-2">
            <Eyebrow index="02">Category Friction & Pricing Distributions</Eyebrow>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {benchmarks.map((b) => (
                <Frame key={b.category} surface="app" className="bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-xs capitalize text-ink">{b.category}</span>
                    <Tag tone="neutral" variant="soft" size="sm">
                      {b.aspCount} ASPs
                    </Tag>
                  </div>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-ink-secondary">Price Range:</span>
                    <span className="font-mono tabular-nums text-ink">
                      ${b.minPrice} - ${b.maxPrice} USDT
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-ink-secondary">Median Price:</span>
                    <span className="font-mono tabular-nums font-semibold text-accent">
                      ${b.medianPrice} USDT
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-ink-secondary">Avg Reject Rate:</span>
                    <span
                      className={cn(
                        "font-mono tabular-nums font-semibold",
                        b.averageRejectRate > 0.12 ? "text-danger" : "text-success",
                      )}
                    >
                      {(b.averageRejectRate * 100).toFixed(1)}%
                    </span>
                  </div>
                </Frame>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
