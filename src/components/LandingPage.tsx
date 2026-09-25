import { useEffect, useState } from "react";
import { ArrowRight, Network, Scale, Calendar, TrendingUp, Code, Terminal } from "lucide-react";
import { useStore } from "@/state/store";
import { ThemeToggle } from "./landing/theme-toggle";
import { InviteSpec } from "./landing/invite-deep-dive";
import { FolderCards, LANDING_PAGES } from "./landing/folder-cards";
import { WordTiles } from "./landing/word-tiles";
import { MausAvatar } from "@/components/Avatar";

const PILLARS = [
  {
    number: "01",
    title: "Evaluator ASP",
    description: "3-agent jury for dispute resolution and autonomous arbitration.",
    icon: <Scale className="size-5 text-accent" />,
    badge: "Dispute Arbitration",
    action: "showEvaluator" as const,
  },
  {
    number: "02",
    title: "Recurring Scheduler",
    description: "Automated cron/interval routines with local treasury budget controls.",
    icon: <Calendar className="size-5 text-emerald-500" />,
    badge: "Automation",
    action: "showRoutines" as const,
  },
  {
    number: "03",
    title: "Bloomberg Intelligence",
    description: "Marketplace intelligence, ASP reputation scores, and trust cards.",
    icon: <TrendingUp className="size-5 text-amber-500" />,
    badge: "Market Analytics",
    action: "showBloomberg" as const,
  },
  {
    number: "04",
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
      {/* Top Header - Nymspace minimalist style with Mascot Brand Logo */}
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b px-6 backdrop-blur-md transition-colors duration-300 sm:px-12"
        style={{ borderColor: open ? "#e6e1d8" : "rgba(0,0,0,0.08)", background: open ? "rgba(247,244,239,0.94)" : "rgba(244,244,245,0.94)" }}>
        
        {/* Brand: Mascot Avatar Logo + Nymspace uppercase mono title */}
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 shadow-sm overflow-hidden">
            <MausAvatar
              color="green"
              bodyId="cursor"
              size={30}
              animated={true}
              state="happy"
              label="kind-meitner mascot"
            />
          </div>
          <span className="font-mono text-xs uppercase tracking-[0.2em] font-semibold text-zinc-700">
            kind meitner
          </span>
          <span className="rounded-full bg-black/5 px-2 py-0.5 font-mono text-[10px] text-zinc-500">
            OKX.ai
          </span>
        </div>

        {/* Right actions: Console link, ThemeToggle switch */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleOpenApp}
            className="hidden text-xs font-mono font-medium text-zinc-600 underline underline-offset-4 hover:text-zinc-950 sm:inline-flex transition"
          >
            Console
          </button>

          <button
            type="button"
            onClick={handleOpenTeamMap}
            className="hidden rounded-full border px-3.5 py-1 text-xs font-semibold sm:inline-flex transition hover:bg-black/5"
            style={{ borderColor: open ? "#b9b2a6" : "#d4d4d8", color: open ? "#3d3834" : "#18181b" }}
          >
            Team map
          </button>

          {/* Physical 12-pin Tactile Switch */}
          <div className="flex items-center gap-2">
            <span className={open ? "text-xs font-medium text-[#8a837c]" : "text-xs font-medium text-zinc-600"}>
              {open ? "Deep dive ON" : "Deep dive"}
            </span>
            <ThemeToggle checked={open} onChange={setOpen} />
          </div>
        </div>
      </header>

      {/* Hero Section with Mechanical WordTiles */}
      <section className="mx-auto flex w-full max-w-5xl flex-col items-center px-6 pt-16 pb-12 text-center sm:pt-24">
        <p className={open
          ? "font-mono text-xs uppercase tracking-[0.25em] text-[#2f8f5b] font-semibold mb-6"
          : "font-mono text-xs uppercase tracking-[0.25em] text-emerald-700 font-semibold mb-6"}>
          OKX Onchain OS &amp; X Layer
        </p>

        {/* Interactive Mechanical WordTiles */}
        <div className="my-2">
          <WordTiles sentence="kind meitner is the autonomous agent suite" />
        </div>

        <p className="mt-8 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg" style={{ color: open ? "#5c554e" : "#52525b" }}>
          Autonomous Commerce Operating System &amp; 4-Pillar Multi-Agent Suite for OKX.ai. Pre-listing readiness gates, pre-spend trust audits, audit-to-hire routines, and spatial team orchestration.
        </p>

        {/* Nymspace style action buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          <button
            type="button"
            onClick={handleOpenApp}
            className="inline-flex items-center gap-2 rounded-full bg-[#2f8f5b] px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#277a4e] cursor-pointer"
          >
            <Terminal size={15} />
            <span>Launch Workspace</span>
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

      {/* Deep Dive Mode: Interactive Pastel FolderCards & Spec */}
      {open && (
        <section className="mx-auto w-full max-w-5xl px-6 pb-12 animate-in fade-in duration-300">
          <div className="mb-4 text-center">
            <span className="font-mono text-xs uppercase tracking-wider text-[#2f8f5b] font-semibold">
              Interactive Dossier
            </span>
            <p className="text-sm text-zinc-500">Hover and flip cards to inspect CRT telemetry.</p>
          </div>
          <FolderCards cards={LANDING_PAGES} />
          <div className="mt-8">
            <InviteSpec />
          </div>
        </section>
      )}

      {/* The Four Pillars - Nymspace Clean Grid */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-20 pt-4">
        <div className="text-center mb-8">
          <span className={open ? "font-mono text-xs uppercase tracking-wider text-[#2f8f5b] font-semibold" : "font-mono text-xs uppercase tracking-wider text-emerald-700 font-semibold"}>
            Core Architecture
          </span>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">The Four Pillars of Autonomous Commerce</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className={open
                ? "group flex flex-col justify-between rounded-2xl border border-[#e6e1d8] bg-white/80 p-5 shadow-sm transition hover:border-[#2f8f5b] hover:shadow-md"
                : "group flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-emerald-600 hover:shadow-md"}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-zinc-400">{p.number}</span>
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
                className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
              >
                <span>Launch component</span>
                <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">&rarr;</span>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className={open ? "mt-auto border-t border-[#e6e1d8] py-8" : "mt-auto border-t border-zinc-300 py-8"}>
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="font-mono uppercase tracking-wider font-semibold">kind meitner</span>
            <span>·</span>
            <span>Built for OKX Onchain OS &amp; X Layer</span>
          </div>
          <div className="flex items-center gap-4">
            <button type="button" onClick={handleOpenApp} className="hover:underline cursor-pointer">
              Console
            </button>
            <button type="button" onClick={handleOpenTeamMap} className="hover:underline cursor-pointer">
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
