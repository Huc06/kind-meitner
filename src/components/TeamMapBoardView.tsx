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
            className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#13161C]/50 backdrop-blur-md shadow-lg"
          >
            {/* Team Container Header */}
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.08] px-4">
              <div className="flex items-center gap-2 truncate">
                <Users size={14} className="shrink-0 text-white/40" aria-hidden="true" />
                <h3 className="truncate text-[14px] font-semibold text-white/90">
                  {section.name}
                </h3>
                <span className="flex h-4 min-w-4 items-center justify-center rounded-[6px] bg-white/[0.08] px-1.5 font-mono text-[10.5px] font-medium text-white/60">
                  {count}
                </span>
              </div>

              {attentionCount > 0 && (
                <span className="flex items-center gap-1 rounded-[6px] bg-danger/15 px-2 py-0.5 text-[10.5px] font-bold text-danger">
                  <AlertCircle size={11} aria-hidden="true" />
                  <span>{attentionCount} issue</span>
                </span>
              )}
            </div>

            {/* Team Bot List */}
            <div className="flex-1 space-y-2.5 overflow-y-auto p-3.5">
              {section.bots.length === 0 ? (
                <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-white/[0.08] p-4 text-center text-[12px] text-white/40">
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

                  return (
                    <button
                      key={bot.id}
                      type="button"
                      onClick={() => onSelectBot(bot.id)}
                      className={cn(
                        "group relative flex w-full flex-col rounded-xl border p-3 text-left outline-none transition-all cursor-pointer backdrop-blur-md shadow-md",
                        isBlocked
                          ? "border-danger/80 bg-danger/15 ring-1 ring-danger/40"
                          : isReviewing
                            ? "border-accent/80 bg-accent/15 ring-1 ring-accent/30 shadow-[0_0_12px_rgba(99,102,241,0.2)]"
                            : isWorking
                              ? "border-accent/80 bg-[#191D24]/80 shadow-[0_0_14px_rgba(99,102,241,0.2)]"
                              : isSelected || isHighlighted
                                ? "border-accent bg-[#20252E]/90 ring-2 ring-accent/40 shadow-lg"
                                : "border-white/[0.08] bg-[#191D24]/70 hover:border-white/[0.18] hover:bg-[#20252E]/85",
                        "focus-visible:ring-2 focus-visible:ring-accent",
                      )}
                    >
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
                            <span className="truncate text-[13px] font-semibold text-white/95">
                              {bot.name}
                            </span>
                            {bot.chiefOfStaff && (
                              <Crown size={12} className="shrink-0 text-warning" aria-label="Chief of staff" />
                            )}
                          </div>
                          <span className="block truncate text-[11px] text-white/50">
                            {bot.okxImport?.kind === "okx-catalog"
                              ? `${bot.title || "OKX.ai Agent"} · Free · read-only`
                              : bot.title || "Bot"}
                          </span>
                        </div>

                        {/* Status dot / label */}
                        <div className="flex shrink-0 items-center gap-1">
                          <span
                            className={cn(
                              "size-2 rounded-full",
                              isBlocked
                                ? "bg-danger animate-pulse"
                                : isWorking
                                  ? "bg-success"
                                  : isReviewing
                                    ? "bg-accent"
                                    : "bg-white/30",
                            )}
                            aria-hidden="true"
                          />
                          <span className="text-[10px] capitalize text-white/60">
                            {wf?.presence ?? (bot.busy ? "working" : "ready")}
                          </span>
                        </div>
                      </div>

                      {/* Active Task (1 readable line) & Progress bar */}
                      {wf?.taskTitle && (
                        <div className="mt-2 w-full rounded-lg bg-black/30 px-2 py-1.5 text-[11px]">
                          <div className="flex items-center justify-between gap-1 truncate">
                            <span className="truncate font-medium text-white/85">
                              {wf.taskTitle}
                            </span>
                            {wf.progress !== undefined && (
                              <span className="shrink-0 font-mono text-[10px] text-white/50 tabular-nums">
                                {wf.progress}%
                              </span>
                            )}
                          </div>

                          {wf.progress !== undefined && wf.progress > 0 && wf.progress < 100 && (
                            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
                              <div
                                className="h-full bg-accent transition-all duration-300"
                                style={{ width: `${wf.progress}%` }}
                              />
                            </div>
                          )}

                          {wf.waitingReason && (
                            <p className="mt-1 truncate text-[10px] font-medium text-danger">
                              {wf.waitingReason}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Badges for Help & Review */}
                      <div className="mt-2 flex items-center justify-between text-[10.5px]">
                        <div className="flex items-center gap-1.5">
                          {wf?.hasIncomingHelp && (
                            <span className="rounded-[5px] bg-warning/20 px-1.5 py-0.5 font-semibold text-warning">
                              Help requested
                            </span>
                          )}
                          {wf?.reviewRequested && (
                            <span className="rounded-[5px] bg-accent/20 px-1.5 py-0.5 font-semibold text-accent">
                              Review pending
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] text-white/40 group-hover:text-white/70">
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
