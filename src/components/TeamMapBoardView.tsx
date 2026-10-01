import { useMemo } from "react";
import {
  Users,
  Crown,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { TeamMapSection } from "@/lib/team-map";
import type { Bot } from "@/state/store";
import type { BotWorkflowInfo } from "./TeamCanvas";
import { BotAvatar } from "./Avatar";
import { Tag } from "@/components/ui/tag";
import { tileFor, TILE_FILL } from "@/components/ui/tile";
export interface TeamMapBoardViewProps {
  sections: TeamMapSection<Bot>[];
  workflowMap?: Record<string, BotWorkflowInfo>;
  highlightBotIds?: string[];
  selectedBotId?: string | null;
  onSelectBot: (botId: string) => void;
  searchQuery?: string;
  statusFilter?: string;
  onlyNeedsAttention?: boolean;
  className?: string;
}

export function TeamMapBoardView({
  sections,
  workflowMap = {},
  highlightBotIds = [],
  selectedBotId,
  onSelectBot,
  searchQuery = "",
  statusFilter = "all",
  onlyNeedsAttention = false,
  className,
}: TeamMapBoardViewProps) {
  const query = searchQuery.trim().toLowerCase();

  // Filter sections and bots according to active toolbar filters
  const filteredSections = useMemo(() => {
    return sections.map((sec) => {
      const allBots = [...sec.chiefs, ...sec.members];
      const matchedBots = allBots.filter((bot) => {
        const wf = workflowMap[bot.id];

        // 1. Search Query match
        if (query) {
          const matchName = bot.name.toLowerCase().includes(query);
          const matchTitle = (bot.title || "").toLowerCase().includes(query);
          const matchTask = (wf?.taskTitle || "").toLowerCase().includes(query);
          if (!matchName && !matchTitle && !matchTask) return false;
        }

        // 2. Needs Attention Filter
        if (onlyNeedsAttention) {
          const isBlocked = wf?.presence === "blocked" || wf?.taskState === "blocked";
          const isWaiting = wf?.presence === "waiting" || wf?.taskState === "waiting" || bot.activity === "waiting-on-you";
          const isReview = wf?.presence === "reviewing" || wf?.taskState === "reviewing";
          if (!isBlocked && !isWaiting && !isReview) return false;
        }

        // 3. Status Filter
        if (statusFilter !== "all") {
          const currentPresence = wf?.presence ?? (bot.busy ? "working" : "ready");
          if (currentPresence.toLowerCase() !== statusFilter.toLowerCase()) return false;
        }

        return true;
      });

      return {
        ...sec,
        bots: matchedBots,
      };
    });
  }, [sections, workflowMap, query, statusFilter, onlyNeedsAttention]);

  return (
    <div
      role="region"
      aria-label="Team Board"
      className={cn(
        "grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      {filteredSections.map((section) => {
        const count = section.bots.length;
        const attentionCount = section.bots.filter((b) => {
          const wf = workflowMap[b.id];
          return wf?.presence === "blocked" || wf?.presence === "waiting" || b.activity === "waiting-on-you";
        }).length;

        return (
          <section
            key={section.key}
            aria-label={`${section.name} team`}
            className="flex flex-col border border-hairline bg-panel shadow-sm"
          >
            {/* Team Container Header */}
            <div className="flex h-11 shrink-0 items-center justify-between frame-rule-below px-3.5">
              <div className="flex items-center gap-2 truncate">
                <Users size={13} className="shrink-0 text-ink-secondary" aria-hidden="true" />
                <h3 className="truncate label-mono text-[12px] font-semibold text-ink">
                  {section.name}
                </h3>
                <span className="flex h-4 min-w-4 items-center justify-center border border-hairline bg-inset px-1 font-mono text-[10.5px] tabular-nums text-ink-secondary">
                  {count}
                </span>
              </div>

              {attentionCount > 0 && (
                <Tag tone="danger" variant="solid" size="sm">
                  <AlertCircle size={10} aria-hidden="true" />
                  <span>{attentionCount} issue</span>
                </Tag>
              )}
            </div>

            {/* Team Bot List */}
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {section.bots.length === 0 ? (
                <div className="flex h-24 items-center justify-center frame-edge p-4 text-center label-mono text-[11px] text-ink-secondary">
                  No agents match this view in {section.name}
                </div>
              ) : (
                section.bots.map((bot) => {
                  const wf = workflowMap[bot.id];
                  const isSelected = selectedBotId === bot.id;
                  const isHighlighted = highlightBotIds.includes(bot.id);
                  const isBlocked = wf?.presence === "blocked" || wf?.taskState === "blocked";
                  const isWorking = wf?.presence === "working" || bot.busy;
                  const isReviewing = wf?.presence === "reviewing" || wf?.taskState === "reviewing";
                  const tileTone = tileFor(bot.id);
                  const tileBg = TILE_FILL[tileTone].split(" ")[0];

                  return (
                    <button
                      key={bot.id}
                      type="button"
                      onClick={() => onSelectBot(bot.id)}
                      className={cn(
                        "group relative flex w-full flex-col border p-2.5 pl-3.5 text-left outline-none transition-colors cursor-pointer",
                        isBlocked
                          ? "border-danger bg-card ring-1 ring-danger/40"
                          : isReviewing
                            ? "border-warning bg-card ring-1 ring-warning/30"
                            : isWorking
                              ? "border-hairline bg-card hover:border-ink-secondary"
                              : isSelected || isHighlighted
                                ? "border-ink ring-1 ring-ink bg-raised"
                                : "border-hairline bg-card hover:border-ink-secondary hover:bg-raised-hover",
                      )}
                    >
                      {/* 3px Tile bar for agent identity */}
                      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px]", tileBg)} aria-hidden="true" />

                      {/* Top: Avatar, Name & Chief */}
                      <div className="flex w-full items-start gap-2.5">
                        <BotAvatar
                          bot={bot}
                          size={32}
                          motion="none"
                          motionKey={0}
                          interactive={false}
                          animated={isWorking}
                          state={isBlocked ? "sad" : isWorking ? "working" : "happy"}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="truncate text-[13px] font-semibold text-ink">
                              {bot.name}
                            </span>
                            {bot.chiefOfStaff && (
                              <Crown size={12} className="shrink-0 text-warning" aria-label="Chief of staff" />
                            )}
                          </div>
                          <span className="block truncate text-[11px] text-ink-secondary">
                            {bot.okxImport?.kind === "okx-catalog"
                              ? `${bot.title || "OKX.ai Agent"} · Free · read-only`
                              : bot.title || "Bot"}
                          </span>
                        </div>

                        {/* Status dot / label */}
                        <div className="flex shrink-0 items-center gap-1">
                          <span
                            className={cn(
                              "size-1.5 rounded-full shrink-0",
                              isBlocked
                                ? "bg-danger animate-pulse"
                                : isWorking
                                  ? "bg-success"
                                  : isReviewing
                                    ? "bg-warning"
                                    : "bg-ink-secondary/40",
                            )}
                            aria-hidden="true"
                          />
                          <span className="font-mono text-[10.5px] capitalize text-ink-secondary">
                            {wf?.presence ?? (bot.busy ? "working" : "ready")}
                          </span>
                        </div>
                      </div>

                      {/* Active Task & Progress bar */}
                      {wf?.taskTitle && (
                        <div className="mt-2 w-full border border-hairline bg-inset p-1.5 text-[11px]">
                          <div className="flex items-center justify-between gap-1 truncate">
                            <span className="truncate font-medium text-ink">
                              {wf.taskTitle}
                            </span>
                            {wf.progress !== undefined && (
                              <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-ink-secondary">
                                {wf.progress}%
                              </span>
                            )}
                          </div>

                          {wf.progress !== undefined && wf.progress > 0 && wf.progress < 100 && (
                            <div className="mt-1 h-1.5 w-full overflow-hidden border border-hairline bg-inset">
                              <div
                                className={cn("h-full transition-all duration-300", isBlocked ? "bg-danger" : "bg-accent")}
                                style={{ width: `${wf.progress}%` }}
                              />
                            </div>
                          )}

                          {wf.waitingReason && (
                            <p className="mt-1 truncate font-mono text-[10.5px] text-danger">
                              {wf.waitingReason}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Badges for Help & Review */}
                      <div className="mt-2 flex items-center justify-between text-[10.5px]">
                        <div className="flex items-center gap-1.5">
                          {wf?.hasIncomingHelp && (
                            <Tag tone="warning" size="sm">
                              Help requested
                            </Tag>
                          )}
                          {wf?.reviewRequested && (
                            <Tag tone="accent" size="sm">
                              Review pending
                            </Tag>
                          )}
                        </div>

                        <span className="font-mono text-[10.5px] text-ink-secondary group-hover:text-ink">
                          Inspect details →
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
