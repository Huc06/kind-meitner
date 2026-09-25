import { useEffect, useState } from "react";
import { ArrowRight, Network, Sparkles, Scale, Calendar, TrendingUp, Code } from "lucide-react";
import { useStore } from "@/state/store";
import { ThemeToggle } from "./landing/theme-toggle";
import { InviteSpec } from "./landing/invite-deep-dive";
import { FolderCards, LANDING_PAGES } from "./landing/folder-cards";

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
    icon: <Calendar className="size-5 text-emerald-500" />,
    badge: "Automation",
    action: "showRoutines" as const,
  },
  {
    title: "Bloomberg Intelligence",
    description: "Marketplace intelligence, ASP reputation scores, and trust cards.",
    icon: <TrendingUp className="size-5 text-amber-500" />,
    badge: "Market Analytics",
    action: "showBloomberg" as const,
  },
  {
    title: "Meta-Agent Orchestration",
    description: "Multi-agent room handoffs and interactive spatial team workflows.",
    icon: <Network className="size-5 text-violet-500" />,
    badge: "Team Map 2.0",
    action: "showTeamMap" as const,
  },
];

export function LandingPage() {
  const { dispatch } = useStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("guide")) {
      setOpen(true);
    }
  }, []);

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
    <main className={open
      ? "flex min-h-screen flex-1 flex-col overflow-y-auto bg-[#f7f4ef] text-[#3d3834] transition-colors duration-300"
      : "flex min-h-screen flex-1 flex-col overflow-y-auto bg-zinc-100 text-zinc-950 transition-colors duration-300"}>
      {/* Top Header with Tactile ThemeToggle (12 metal pins) */}
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b px-6 backdrop-blur-md transition-colors duration-300 sm:px-10"
        style={{ borderColor: open ? "#e6e1d8" : "rgba(0,0,0,0.08)", background: open ? "rgba(247,244,239,0.92)" : "rgba(244,244,245,0.92)" }}>
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[#2f8f5b]/10 text-[#2f8f5b] border border-[#2f8f5b]/20">
            <Sparkles size={14} aria-hidden="true" />
          </div>
          <span className="text-[15px] font-bold tracking-tight">kind-meitner</span>
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10.5px] font-medium text-zinc-600">
            OKX.ai
          </span>
        </div>

        {/* Toggle Mode Switch + Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={open ? "text-xs font-medium text-[#8a837c]" : "text-xs font-medium text-zinc-600"}>
              {open ? "Task guide ON" : "Show task guide"}
            </span>
            <ThemeToggle checked={open} onChange={setOpen} />
          </div>

          <button
            type="button"
            onClick={handleOpenTeamMap}
            className="hidden rounded-full border px-3.5 py-1.5 text-xs font-semibold sm:inline-flex transition hover:bg-black/5"
            style={{ borderColor: open ? "#b9b2a6" : "#d4d4d8", color: open ? "#3d3834" : "#18181b" }}
          >
            Team map
          </button>

          <button
            type="button"
            onClick={handleOpenApp}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#2f8f5b] px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#277a4e]"
          >
            <span>Open App</span>
            <ArrowRight size={13} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* When Toggle Mode is ON: Reveal InviteSpec & Interactive FolderCards */}
      {open && (
        <div className="animate-in fade-in duration-300">
          <InviteSpec />
          <FolderCards cards={LANDING_PAGES} />
        </div>
      )}

      {/* Hero Section */}
      <section className="mx-auto flex w-full max-w-5xl flex-col items-center px-6 pt-16 pb-12 text-center sm:pt-24">
        <p className={open
          ? "text-sm font-medium uppercase tracking-[0.18em] text-[#2f8f5b]"
          : "text-sm font-medium uppercase tracking-[0.18em] text-emerald-700"}>
          OKX agent suite
        </p>

        <h1 className="mt-4 max-w-3xl text-5xl font-extrabold tracking-tight sm:text-7xl">
          kind-meitner
        </h1>

        <p className="mt-6 max-w-2xl text-xl leading-8 sm:text-2xl">
          AI-Native Agent Suite &amp; Autonomous Commerce Operating System for OKX.ai
        </p>

        <p className="mt-4 max-w-2xl text-base leading-7" style={{ color: open ? "#5c554e" : "#52525b" }}>
          Invite an OKX agent into a room. Switch on the toggle above to explore the spec, the tasks, and interactive folder cards.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleOpenApp}
            className="inline-flex items-center gap-2 rounded-full bg-[#2f8f5b] px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#277a4e] cursor-pointer"
          >
            <span>Open App Workspace</span>
            <ArrowRight size={15} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={handleOpenTeamMap}
            className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition hover:bg-black/5 cursor-pointer"
            style={{ color: open ? "#3d3834" : "#18181b", borderColor: open ? "#b9b2a6" : "#d4d4d8", background: "#fff" }}
          >
            <Network size={15} className="text-emerald-700" />
            <span>Team Map 2.0</span>
          </button>

          <a
            href="https://github.com/Huc06/kind-meitner"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-medium transition hover:bg-black/5"
            style={{ borderColor: open ? "#b9b2a6" : "#d4d4d8", color: open ? "#5c554e" : "#71717a" }}
          >
            <Code size={15} />
            <span>GitHub</span>
          </a>
        </div>
      </section>

      {/* The Four Pillars */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-20">
        <h2 className={open ? "text-xs font-semibold uppercase tracking-wider text-[#2f8f5b]" : "text-xs font-semibold uppercase tracking-wider text-emerald-700"}>
          Core Architecture
        </h2>
        <p className="mt-1 text-2xl font-bold tracking-tight">The Four Pillars</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className={open
                ? "group flex flex-col justify-between rounded-2xl border border-[#e6e1d8] bg-white/80 p-5 shadow-sm transition hover:border-[#2f8f5b] hover:shadow-md"
                : "group flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-emerald-600 hover:shadow-md"}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-black/5">
                    {p.icon}
                  </div>
                  <span className="rounded-full bg-black/5 px-2 py-0.5 font-mono text-[10px]" style={{ color: open ? "#8a837c" : "#71717a" }}>
                    {p.badge}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold transition-colors group-hover:text-emerald-600">
                  {p.title}
                </h3>
                <p className="mt-2 text-xs leading-5" style={{ color: open ? "#8a837c" : "#71717a" }}>
                  {p.description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => dispatch({ type: p.action })}
                className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
              >
                <span>Launch component</span>
                <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">&rarr;</span>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className={open ? "mt-auto border-t border-[#e6e1d8]" : "mt-auto border-t border-zinc-300"}>
        <div className={open
          ? "mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-[#8a837c]"
          : "mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-zinc-600"}>
          <p>Built for OKX Onchain OS &amp; X Layer · OKX Dev Day 2026</p>
          <div className="flex items-center gap-4">
            <button type="button" onClick={handleOpenApp} className="hover:underline">
              Chat Workspace
            </button>
            <button type="button" onClick={handleOpenTeamMap} className="hover:underline">
              Team Map
            </button>
            <a
              href="https://github.com/Huc06/kind-meitner"
              target="_blank"
              rel="noopener noreferrer"
              className={open ? "font-medium text-[#3d3834] hover:underline" : "font-medium text-zinc-950 hover:underline"}
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
export default LandingPage;
