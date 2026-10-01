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
        "flex flex-wrap items-center justify-between gap-2.5 frame-rule-below bg-app px-6 py-1.5 text-[12px] text-ink",
        className,
      )}
    >
      {/* Left: View Switcher (Board vs Map) */}
      <div className="flex items-center gap-2">
        <div className="flex items-center border border-hairline bg-inset p-0.5" role="group" aria-label="View mode">
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === "board"}
            onClick={() => onViewModeChange("board")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] font-mono uppercase tracking-[0.06em] transition-colors outline-none",
              viewMode === "board"
                ? "bg-raised text-ink font-semibold"
                : "text-ink-secondary hover:text-ink",
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
              "flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] font-mono uppercase tracking-[0.06em] transition-colors outline-none",
              viewMode === "map"
                ? "bg-raised text-ink font-semibold"
                : "text-ink-secondary hover:text-ink",
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
            "flex items-center gap-1.5 border px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.06em] transition-colors outline-none",
            onlyNeedsAttention
              ? "border-danger bg-danger/15 text-danger font-semibold"
              : "border-hairline bg-transparent text-ink-secondary hover:border-ink hover:text-ink",
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
          <Search size={13} className="pointer-events-none absolute left-2.5 text-ink-secondary" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search agents or tasks…"
            aria-label="Search agents or tasks"
            className="h-8 w-44 border border-hairline bg-inset pl-8 pr-7 text-[12px] text-ink placeholder:text-ink-secondary/60 focus:border-ink focus:outline-none sm:w-56"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onSearchChange("")}
              className="absolute right-2 p-0.5 text-ink-secondary hover:text-ink"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Status Filter Dropdown */}
        <div className="flex items-center gap-1.5">
          <Filter size={12} className="text-ink-secondary" aria-hidden="true" />
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            aria-label="Filter by status"
            className="h-8 border border-hairline bg-inset px-2 font-mono text-[11.5px] text-ink focus:border-ink focus:outline-none [color-scheme:inherit]"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id} className="bg-menu text-ink">
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
            className="text-[11px] font-mono text-ink underline hover:text-ink-secondary"
          >
            Clear filters
          </button>
        )}

        {/* Spatial Map Viewport controls (Only in Map mode) */}
        {viewMode === "map" && (
          <div className="flex items-center gap-1 border-l border-hairline pl-2.5">
            {onFitView && (
              <button
                type="button"
                aria-label="Fit all teams to view"
                onClick={onFitView}
                className="flex h-7 items-center gap-1 border border-hairline bg-transparent px-2 font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-secondary hover:border-ink hover:text-ink"
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
                className="flex size-7 items-center justify-center border border-hairline bg-transparent text-ink-secondary hover:border-ink hover:text-ink"
              >
                <Minus size={13} aria-hidden="true" />
              </button>
            )}
            {onResetZoom && (
              <button
                type="button"
                aria-label="Reset zoom scale"
                onClick={onResetZoom}
                className="h-7 px-1.5 font-mono text-[11px] tabular-nums text-ink-secondary hover:text-ink"
              >
                {Math.round(zoomPercent)}%
              </button>
            )}
            {onZoomIn && (
              <button
                type="button"
                aria-label="Zoom in"
                onClick={onZoomIn}
                className="flex size-7 items-center justify-center border border-hairline bg-transparent text-ink-secondary hover:border-ink hover:text-ink"
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
