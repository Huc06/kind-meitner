import { useState } from "react";
import { ArrowRight, Calendar, Network, Scale, Sparkles, TrendingUp, Code } from "lucide-react";
import { useStore } from "@/state/store";

const PILLARS = [
  {
    title: "Evaluator ASP",
    description: "3-agent jury for dispute resolution and autonomous arbitration.",
    icon: <Scale className="size-5 text-accent" />,
    badge: "Dispute Arbitration",
    action: "showEvaluator" as const,
  },
  {
    title: "Recurring Scheduler",
    description: "Automated cron/interval routines with local treasury budget controls.",
    icon: <Calendar className="size-5 text-emerald-400" />,
    badge: "Automation",
    action: "showRoutines" as const,
  },
  {
    title: "Bloomberg Intelligence",
    description: "Marketplace intelligence, ASP reputation scores, and trust cards.",
    icon: <TrendingUp className="size-5 text-amber-400" />,
    badge: "Market Analytics",
    action: "showBloomberg" as const,
  },
  {
    title: "Meta-Agent Orchestration",
    description: "Multi-agent room handoffs and interactive spatial team workflows.",
    icon: <Network className="size-5 text-violet-400" />,
    badge: "Team Map 2.0",
    action: "showTeamMap" as const,
  },
];

export function LandingPage() {
  const { dispatch } = useStore();
  const [guideOpen, setGuideOpen] = useState(false);

  const handleOpenApp = () => {
    try {
      sessionStorage.setItem("kind-meitner:entered-app", "1");
    } catch {
      // Ignore sessionStorage errors
    }
    dispatch({ type: "showChat" });
  };

  const handleOpenTeamMap = () => {
    dispatch({ type: "showTeamMap" });
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col overflow-y-auto bg-[#0B0C0E] text-zinc-100">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#0E1014]/90 px-6 backdrop-blur-xl sm:px-10">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Sparkles size={14} aria-hidden="true" />
          </div>
          <span className="text-[15px] font-bold tracking-tight text-white">kind-meitner</span>
          <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10.5px] font-medium text-white/60">
            OKX.ai
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setGuideOpen((v) => !v)}
            className="hidden text-[12px] font-medium text-white/60 hover:text-white sm:block transition"
          >
            {guideOpen ? "Hide task guide" : "Show task guide"}
          </button>
          <button
            type="button"
            onClick={handleOpenTeamMap}
            className="hidden rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-white/80 hover:bg-white/[0.08] hover:text-white sm:inline-flex transition"
          >
            Team map
          </button>
          <button
            type="button"
            onClick={handleOpenApp}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-emerald-500"
          >
            <span>Open App</span>
            <ArrowRight size={13} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Task Guide Drawer / Banner (if toggled) */}
      {guideOpen && (
        <section className="border-b border-white/[0.08] bg-[#12151A] px-6 py-6 sm:px-10 animate-in fade-in duration-150">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                Dev Day Task Guide &amp; Integration Roster
              </span>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="text-[11px] text-white/40 hover:text-white"
              >
                Close guide ✕
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3 text-[12px]">
              <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3.5">
                <span className="font-semibold text-white">1. Pre-Listing Gate</span>
                <p className="mt-1 text-white/50 text-[11.5px] leading-relaxed">
                  Call <code className="text-emerald-400">scan_free_mcp_readiness</code> to catch Vercel host shape and DNS issues before listing.
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3.5">
                <span className="font-semibold text-white">2. Pre-Spend Trust</span>
                <p className="mt-1 text-white/50 text-[11.5px] leading-relaxed">
                  Spend Scout inspects <code className="text-accent">get_asp_trust_card</code> with explicit notChecked boundaries before funding.
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3.5">
                <span className="font-semibold text-white">3. Audit-to-Hire</span>
                <p className="mt-1 text-white/50 text-[11.5px] leading-relaxed">
                  Clone audited agents via <code className="text-violet-400">[+ Clone to Team]</code> and schedule automated routines.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Hero Section */}
      <section className="mx-auto flex w-full max-w-5xl flex-col items-center px-6 pt-20 pb-16 text-center sm:pt-28">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>OKX Onchain OS &amp; X Layer</span>
        </div>

        <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-white sm:text-7xl">
          kind-meitner
        </h1>

        <p className="mt-6 max-w-3xl text-xl leading-relaxed text-zinc-400 sm:text-2xl">
          AI-Native Agent Suite &amp; Autonomous Commerce Operating System for OKX.ai
        </p>

        <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-500">
          The 4-pillar agent platform that turns OKX into a living, autonomous trading and commerce system: pre-listing readiness, pre-spend trust, audit-to-hire workflows, and spatial team orchestration.
        </p>

        {/* Primary CTAs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3.5">
          <button
            type="button"
            onClick={handleOpenApp}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
          >
            <span>Open App Workspace</span>
            <ArrowRight size={15} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={handleOpenTeamMap}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-[#16191E] px-5 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-[#1C2026] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
          >
            <Network size={15} className="text-accent" />
            <span>Explore Team Map 2.0</span>
          </button>

          <a
            href="https://github.com/Huc06/kind-meitner"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-transparent px-4 text-sm font-medium text-zinc-400 transition hover:bg-white/[0.04] hover:text-white"
          >
            <Code size={15} />
            <span>GitHub</span>
          </a>
        </div>
      </section>

      {/* The Four Pillars Grid */}
      <section className="border-t border-white/[0.06] bg-[#0E1013]/60 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Core Architecture
            </span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              The Four Pillars of Autonomous Commerce
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Architected specifically for the OKX Dev Day 2026 Build a Company track.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((p) => (
              <div
                key={p.title}
                className="group flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#14171C]/90 p-5 transition hover:border-white/[0.18] hover:bg-[#181C22] shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06]">
                      {p.icon}
                    </div>
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-white/50">
                      {p.badge}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-white group-hover:text-emerald-400 transition-colors">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-[12px] leading-relaxed text-zinc-400">
                    {p.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => dispatch({ type: p.action })}
                  className="mt-5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-400 hover:text-emerald-300 transition"
                >
                  <span>Launch component</span>
                  <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">&rarr;</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/[0.06] bg-[#0A0C0E] py-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 text-xs text-zinc-500">
          <p>Built for OKX Onchain OS &amp; X Layer · OKX Dev Day 2026</p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleOpenApp}
              className="hover:text-zinc-300 transition"
            >
              Chat Workspace
            </button>
            <button
              type="button"
              onClick={handleOpenTeamMap}
              className="hover:text-zinc-300 transition"
            >
              Team Map
            </button>
            <a
              href="https://github.com/Huc06/kind-meitner"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 transition"
            >
              GitHub Repo
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
