import {
  LayoutGrid,
  Map as MapIcon,
  Search,
  Filter,
  Maximize2,
  Minus,
  Plus,
  X,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/cn";

export interface TeamMapToolbarProps {
  viewMode: "board" | "map";
  onViewModeChange: (mode: "board" | "map") => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onlyNeedsAttention: boolean;
  onToggleOnlyAttention: () => void;
  onFitView?: () => void;
  onResetZoom?: () => void;
  zoomPercent?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  className?: string;
}

const STATUS_OPTIONS = [
  { id: "all", label: "All status" },
  { id: "working", label: "Working" },
  { id: "blocked", label: "Blocked" },
  { id: "waiting", label: "Waiting" },
  { id: "reviewing", label: "Reviewing" },
  { id: "ready", label: "Ready" },
];

export function TeamMapToolbar({
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onlyNeedsAttention,
  onToggleOnlyAttention,
  onFitView,
  onResetZoom,
  zoomPercent = 100,
  onZoomIn,
  onZoomOut,
  className,
}: TeamMapToolbarProps) {
  const hasActiveFilters = searchQuery.length > 0 || statusFilter !== "all" || onlyNeedsAttention;

  return (
    <div
      role="toolbar"
      aria-label="Team Map controls"
      className={cn(
        "flex flex-wrap items-center justify-between gap-2.5 border-b border-white/[0.08] bg-[#121519] px-6 py-1.5 text-[12px]",
        className,
      )}
    >
      {/* Left: View Switcher (Board vs Map) */}
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-md border border-white/[0.1] bg-black/40 p-0.5" role="group" aria-label="View mode">
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === "board"}
            onClick={() => onViewModeChange("board")}
            className={cn(
              "flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-[11.5px] font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent",
              viewMode === "board"
                ? "bg-white/[0.12] text-white shadow-sm"
                : "text-white/60 hover:text-white/90",
            )}
          >
            <LayoutGrid size={12} aria-hidden="true" />
            <span>Board</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === "map"}
            onClick={() => onViewModeChange("map")}
            className={cn(
              "flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-[11.5px] font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent",
              viewMode === "map"
                ? "bg-white/[0.12] text-white shadow-sm"
                : "text-white/60 hover:text-white/90",
            )}
          >
            <MapIcon size={12} aria-hidden="true" />
            <span>Spatial map</span>
          </button>
        </div>

        {/* Needs attention quick toggle */}
        <button
          type="button"
          aria-pressed={onlyNeedsAttention}
          onClick={onToggleOnlyAttention}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent",
            onlyNeedsAttention
              ? "border-danger/60 bg-danger/15 text-danger font-semibold"
              : "border-white/[0.08] bg-white/[0.03] text-white/60 hover:bg-white/[0.06] hover:text-white",
          )}
        >
          <AlertCircle size={12} aria-hidden="true" />
          <span>Needs attention</span>
        </button>
      </div>

      {/* Middle/Right: Search, Filters, Zoom Controls */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Search Input */}
        <div className="relative flex items-center">
          <Search size={13} className="pointer-events-none absolute left-2.5 text-white/40" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search agents or tasks…"
            aria-label="Search agents or tasks"
            className="h-8 w-44 rounded-lg border border-white/[0.1] bg-black/30 pl-8 pr-7 text-[12px] text-white/90 placeholder:text-white/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent sm:w-56"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onSearchChange("")}
              className="absolute right-2 rounded p-0.5 text-white/40 hover:text-white"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Status Filter Dropdown */}
        <div className="flex items-center gap-1.5">
          <Filter size={12} className="text-white/40" aria-hidden="true" />
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            aria-label="Filter by status"
            className="h-8 rounded-lg border border-white/[0.1] bg-black/30 px-2 text-[12px] text-white/80 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id} className="bg-[#15171A] text-white">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Clear all active filters */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              onSearchChange("");
              onStatusFilterChange("all");
              if (onlyNeedsAttention) onToggleOnlyAttention();
            }}
            className="text-[11px] text-accent hover:underline"
          >
            Clear filters
          </button>
        )}

        {/* Spatial Map Viewport controls (Only in Map mode) */}
        {viewMode === "map" && (
          <div className="flex items-center gap-1 border-l border-white/[0.08] pl-2.5">
            {onFitView && (
              <button
                type="button"
                aria-label="Fit all teams to view"
                onClick={onFitView}
                className="flex h-7 items-center gap-1 rounded-md border border-white/[0.1] bg-white/[0.04] px-2 text-[11px] text-white/70 hover:bg-white/[0.08] hover:text-white"
              >
                <Maximize2 size={12} aria-hidden="true" />
                <span>Fit</span>
              </button>
            )}
            {onZoomOut && (
              <button
                type="button"
                aria-label="Zoom out"
                onClick={onZoomOut}
                className="flex size-7 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
              >
                <Minus size={13} aria-hidden="true" />
              </button>
            )}
            {onResetZoom && (
              <button
                type="button"
                aria-label="Reset zoom scale"
                onClick={onResetZoom}
                className="h-7 px-1.5 font-mono text-[11px] text-white/70 hover:text-white"
              >
                {Math.round(zoomPercent)}%
              </button>
            )}
            {onZoomIn && (
              <button
                type="button"
                aria-label="Zoom in"
                onClick={onZoomIn}
                className="flex size-7 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
              >
                <Plus size={13} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
