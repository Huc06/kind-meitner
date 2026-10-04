import { useEffect, useState } from "react";
import {
  ArrowRight,
  Network,
  Scale,
  Calendar,
  TrendingUp,
  Code,
  Terminal,
} from "lucide-react";
import { ThemeToggle } from "./landing/theme-toggle";
import { InviteSpec } from "./landing/invite-deep-dive";
import { FolderCards, LANDING_PAGES } from "./landing/folder-cards";
import { WordTiles } from "@/components/ui/word-tiles";
import { Frame } from "@/components/ui/frame";
import { Button, buttonClass } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { tileFor, TILE_FILL } from "@/components/ui/tile";
import { AgentMark } from "@/components/agent-identity/AgentMark";
import { cn } from "@/lib/cn";

const PILLARS = [
  {
    number: "01",
    id: "evaluator",
    title: "Evaluator ASP",
    description: "3-agent jury for dispute resolution and autonomous arbitration.",
    icon: <Scale className="size-4" />,
    badge: "Dispute Arbitration",
    action: "showEvaluator" as const,
  },
  {
    number: "02",
    id: "routines",
    title: "Recurring Scheduler",
    description: "Automated cron/interval routines with local treasury budget controls.",
    icon: <Calendar className="size-4" />,
    badge: "Automation",
    action: "showRoutines" as const,
  },
  {
    number: "03",
    id: "bloomberg",
    title: "Bloomberg Intelligence",
    description: "Marketplace intelligence, ASP reputation scores, and trust cards.",
    icon: <TrendingUp className="size-4" />,
    badge: "Market Analytics",
    action: "showBloomberg" as const,
  },
  {
    number: "04",
    id: "team-map",
    title: "Meta-Agent Orchestration",
    description: "Multi-agent room handoffs and interactive spatial team workflows.",
    icon: <Network className="size-4" />,
    badge: "Team Map 2.0",
    action: "showTeamMap" as const,
  },
];

export type LandingTarget = "demo" | "workspace" | (typeof PILLARS)[number]["action"];

const STEPS = [
  {
    n: "1",
    title: "Check an endpoint",
    body: "Paste a Free MCP endpoint. Get PASS, WARN or FAIL with every check and the exact fix, before you list it.",
  },
  {
    n: "2",
    title: "Check an agent",
    body: "Enter an OKX.AI agent ID. See GO, CAUTION or NO_GO, the evidence found, and what was not checked.",
  },
  {
    n: "3",
    title: "Call it from your agent",
    body: "The same checks are MCP tools on a public endpoint. No sign-in, no wallet, no payment.",
  },
] as const;

/** Navigation is passed in: the signed-in app maps targets to views, and the
 * public shell sends anything but the demo to sign-in. */
export function LandingPage({ onNavigate }: { onNavigate: (target: LandingTarget) => void }) {
  const [deepDiveOpen, setDeepDiveOpen] = useState(false);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("guide")
    ) {
      setDeepDiveOpen(true);
    }
  }, []);

  const handleOpenApp = () => onNavigate("workspace");
  const handleOpenTeamMap = () => onNavigate("showTeamMap");
  const handleTryDemo = () => onNavigate("demo");

  return (
    <main className="flex min-h-screen flex-1 flex-col overflow-y-auto bg-app text-ink">
      {/* Top Header - Nymspace Console Header */}
      <header className="sticky top-0 z-30 flex h-11 shrink-0 items-center justify-between border-b border-hairline bg-app px-4 sm:px-8">
        {/* Brand: Mascot Avatar Logo + Nymspace mono brand + OKX.ai Tag */}
        <div className="flex items-center gap-3">
          <div className="flex size-7 shrink-0 items-center justify-center border border-hairline bg-raised overflow-hidden">
            <AgentMark
              bot={{ id: "kind-meitner", name: "kind meitner" }}
              size={24}
            />
          </div>
          <span className="font-mono text-xs uppercase tracking-[0.2em] font-semibold text-ink">
            kind meitner
          </span>
          <Tag tone="neutral" variant="outline" size="sm">
            OKX.ai
          </Tag>
        </div>

        {/* Right actions: nav items using nav-link + tactile ThemeToggle */}
        <div className="flex items-center gap-4 sm:gap-6">
          <nav className="flex items-center gap-3 sm:gap-5" aria-label="Main navigation">
            <button
              type="button"
              onClick={handleTryDemo}
              className="nav-link font-mono text-xs text-ink-secondary hover:text-ink cursor-pointer"
            >
              Live demo
            </button>

            <button
              type="button"
              onClick={handleOpenApp}
              className="nav-link font-mono text-xs text-ink-secondary hover:text-ink cursor-pointer"
            >
              Workspace
            </button>

            <button
              type="button"
              onClick={() => setDeepDiveOpen((v) => !v)}
              data-active={deepDiveOpen ? "true" : undefined}
              className="nav-link font-mono text-xs text-ink-secondary hover:text-ink cursor-pointer"
            >
              Deep dive
            </button>
          </nav>

          <div className="h-4 w-px bg-hairline" aria-hidden="true" />

          {/* Physical 12-pin Tactile Switch rewired to flip skins */}
          <ThemeToggle />
        </div>
      </header>

      {/* Hero: the one thing a visitor can try right now */}
      <section className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 pt-12 pb-8 text-center sm:pt-20">
        <span className="label-mono text-ink-secondary mb-4 tracking-[0.25em]">
          KIND MEITNER MARKETS · ASP #13851 ON OKX.AI
        </span>

        <div className="my-2 flex max-w-full justify-center py-2">
          <WordTiles sentence="check before you list" />
        </div>

        <p className="mt-6 max-w-2xl text-sm sm:text-base leading-relaxed text-ink-secondary">
          Builders check a Free MCP endpoint before listing it. Callers see what trust evidence exists before using an agent. Free and read-only. No sign-in, wallet or payment.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button variant="primary" size="lg" onClick={handleTryDemo}>
            <Terminal className="size-4" aria-hidden="true" />
            <span>Try the live demo</span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>

          <Button variant="secondary" size="lg" onClick={handleOpenApp}>
            <span>Open workspace</span>
          </Button>

          <a
            href="https://github.com/Huc06/kind-meitner"
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass({ variant: "ghost", size: "lg" })}
          >
            <Code className="size-4" aria-hidden="true" />
            <span>GitHub</span>
          </a>
        </div>
        <p className="mt-3 font-mono text-[11px] text-ink-secondary">
          The workspace needs sign-in. The demo doesn&rsquo;t.
        </p>
      </section>

      {/* Onboarding: how it works in three steps, each leading to the demo */}
      <section aria-labelledby="how-it-works" className="mx-auto w-full max-w-5xl px-4 pb-4">
        <h2 id="how-it-works" className="label-mono mb-3 text-ink-secondary">How it works</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n} className="flex flex-col justify-between border border-hairline bg-card p-4">
              <div>
                <span className="font-mono text-[11px] text-ink-secondary">STEP {step.n}</span>
                <h3 className="mt-1 text-[15px] font-semibold text-ink">{step.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">{step.body}</p>
              </div>
              {step.n === "3" ? (
                <code className="mt-3 block break-all border border-hairline bg-inset p-2 font-mono text-[10.5px] text-ink">
                  POST https://kind-meitner-production.up.railway.app/api/okx/free-mcp
                </code>
              ) : (
                <Button variant="secondary" size="sm" className="mt-3 w-full justify-between" onClick={handleTryDemo}>
                  <span>Try it</span>
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-3 font-mono text-[11px] text-ink-secondary">
          Not an OKX endorsement or a safety guarantee. Every result lists what was not checked.
        </p>
      </section>

      {/* [ 01 · THE LOOP ] Console Strip - Demo Story in 4 Steps */}
      <section className="mx-auto w-full max-w-5xl px-4 py-8">
        <Frame title="THE LOOP" index="01" surface="app" className="bg-card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
            <div className="flex items-center gap-2">
              <span className="label-mono text-ink font-semibold">DEMO LIFECYCLE</span>
              <span className="text-xs text-ink-secondary">·</span>
              <span className="text-xs text-ink-secondary">
                Pre-Listing Audit to Autonomous Operations
              </span>
            </div>
            <Tag tone="accent" variant="solid" size="sm">
              2-LOOP WORKBENCH
            </Tag>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Step 1: Gate before list (readiness FAIL -> PASS) */}
            <div className="flex flex-col justify-between border border-hairline bg-inset p-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="label-mono text-ink-secondary">01 · READINESS</span>
                  <div className="flex items-center gap-1 font-mono text-xs">
                    <Tag tone="danger" variant="solid" size="sm">
                      FAIL
                    </Tag>
                    <span className="text-ink-secondary">→</span>
                    <Tag tone="success" variant="solid" size="sm">
                      PASS
                    </Tag>
                  </div>
                </div>
                <h3 className="mt-3 font-sans text-sm font-semibold text-ink">
                  Gate before list
                </h3>
                <p className="mt-1.5 text-xs text-ink-secondary leading-relaxed">
                  scan_free_mcp_readiness checks 7 endpoint criteria before listing. Catches host pitfalls (like Vercel endpoint shape) before review.
                </p>
              </div>
              <div className="mt-3 pt-2.5 frame-rule-above font-mono text-[10.5px] text-ink-secondary">
                Remediation → 7/7 PASS
              </div>
            </div>

            {/* Step 2: Gate before spend (trust NO_GO -> GO) */}
            <div className="flex flex-col justify-between border border-hairline bg-inset p-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="label-mono text-ink-secondary">02 · TRUST</span>
                  <div className="flex items-center gap-1 font-mono text-xs">
                    <Tag tone="danger" variant="solid" size="sm">
                      NO_GO
                    </Tag>
                    <span className="text-ink-secondary">→</span>
                    <Tag tone="success" variant="solid" size="sm">
                      GO
                    </Tag>
                  </div>
                </div>
                <h3 className="mt-3 font-sans text-sm font-semibold text-ink">
                  Gate before spend
                </h3>
                <p className="mt-1.5 text-xs text-ink-secondary leading-relaxed">
                  get_asp_trust_card audits reachability. Dead endpoints yield NO_GO with Block Spend; canonical ASP #13851 yields GO.
                </p>
              </div>
              <div className="mt-3 pt-2.5 frame-rule-above font-mono text-[10.5px] text-ink-secondary">
                Surfaces honest notChecked limits
              </div>
            </div>

            {/* Step 3: Clone to team */}
            <div className="flex flex-col justify-between border border-hairline bg-inset p-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="label-mono text-ink-secondary">03 · HIRE</span>
                  <Tag tone="accent" variant="solid" size="sm">
                    + CLONE
                  </Tag>
                </div>
                <h3 className="mt-3 font-sans text-sm font-semibold text-ink">
                  Clone to team
                </h3>
                <p className="mt-1.5 text-xs text-ink-secondary leading-relaxed">
                  Audit-to-Hire: 1-click recruitment from room Trust Cards. Mounts in-process MCP (ASP #13851) or provisions OKX Onchain OS dynamic proxies.
                </p>
              </div>
              <div className="mt-3 pt-2.5 frame-rule-above font-mono text-[10.5px] text-ink-secondary">
                Immediate team recruitment
              </div>
            </div>

            {/* Step 4: Run as a routine */}
            <div className="flex flex-col justify-between border border-hairline bg-inset p-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="label-mono text-ink-secondary">04 · OPERATE</span>
                  <Tag tone="cyan" variant="solid" size="sm">
                    ROUTINE
                  </Tag>
                </div>
                <h3 className="mt-3 font-sans text-sm font-semibold text-ink">
                  Run as a routine
                </h3>
                <p className="mt-1.5 text-xs text-ink-secondary leading-relaxed">
                  Interactive date/time scheduler in composer automates recurring operations with auto-approved permissions and treasury controls.
                </p>
              </div>
              <div className="mt-3 pt-2.5 frame-rule-above font-mono text-[10.5px] text-ink-secondary">
                Autonomous scheduled execution
              </div>
            </div>
          </div>
        </Frame>
      </section>

      {/* The Four Pillars - Indexed Frames with Tile Identity Marks */}
      <section className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
          <div>
            <span className="label-mono text-ink-secondary">CORE ARCHITECTURE</span>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink sm:text-xl">
              The Four Pillars of Autonomous Commerce
            </h2>
          </div>
          <Tag tone="neutral" variant="outline" size="sm">
            BUILD A COMPANY TRACK
          </Tag>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => {
            const tone = tileFor(p.id);
            return (
              <Frame
                key={p.title}
                title={p.title}
                index={p.number}
                surface="app"
                className="bg-card p-4 flex flex-col justify-between hover:bg-raised transition-colors group"
              >
                <div>
                  {/* Card Header: Tile mark, badge, icon */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn("size-2.5 shrink-0", TILE_FILL[tone])}
                        aria-hidden="true"
                      />
                      <span className="label-mono text-ink-secondary">{p.badge}</span>
                    </div>
                    <div className="text-ink-secondary group-hover:text-ink transition-colors">
                      {p.icon}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="mt-3 text-sm font-semibold tracking-tight text-ink">
                    {p.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                    {p.description}
                  </p>

                  {/* Console Mini Telemetry Widget */}
                  {p.number === "01" && (
                    <div className="my-3 border border-hairline bg-inset p-2.5 font-mono text-[10.5px]">
                      <div className="flex items-center justify-between text-ink-secondary">
                        <span>3-Agent Jury Quorum</span>
                        <span className="text-success font-semibold">100% Consensus</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-1 text-[9px]">
                        <Tag tone="accent" variant="soft" size="sm">
                          Jury A
                        </Tag>
                        <Tag tone="accent" variant="soft" size="sm">
                          Jury B
                        </Tag>
                        <Tag tone="success" variant="solid" size="sm">
                          PASS 3/3
                        </Tag>
                      </div>
                    </div>
                  )}

                  {p.number === "02" && (
                    <div className="my-3 border border-hairline bg-inset p-2.5 font-mono text-[10.5px]">
                      <div className="flex items-center justify-between text-ink-secondary">
                        <span>Next: 2h 14m</span>
                        <span className="text-ink font-medium">0 */4 * * *</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[9.5px]">
                        <span className="text-ink-secondary">Cap: 105k USDT</span>
                        <Tag tone="success" variant="soft" size="sm">
                          Auto-approved
                        </Tag>
                      </div>
                    </div>
                  )}

                  {p.number === "03" && (
                    <div className="my-3 border border-hairline bg-inset p-2.5 font-mono text-[10.5px]">
                      <div className="flex items-center justify-between text-ink-secondary">
                        <span>ASP #13851</span>
                        <Tag tone="success" variant="solid" size="sm">
                          GO · 7/7
                        </Tag>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[9.5px] text-ink-secondary">
                        <span>Reputation: 98.4%</span>
                        <span className="text-ink font-medium">Free A2MCP</span>
                      </div>
                    </div>
                  )}

                  {p.number === "04" && (
                    <div className="my-3 border border-hairline bg-inset p-2.5 font-mono text-[10.5px]">
                      <div className="flex items-center justify-between text-ink-secondary">
                        <span>Spatial Graph</span>
                        <span className="text-ink font-medium">1.80x Speedup</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[9.5px]">
                        <span className="text-ink-secondary">Markets → Coach → Atlas</span>
                        <Tag tone="cyan" variant="soft" size="sm">
                          Live
                        </Tag>
                      </div>
                    </div>
                  )}
                </div>

                {/* Launch Action Button */}
                <div className="mt-3 pt-3 frame-rule-above">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-between"
                    onClick={() => onNavigate(p.action)}
                  >
                    <span>Launch {p.badge}</span>
                    <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                      &rarr;
                    </span>
                  </Button>
                </div>
              </Frame>
            );
          })}
        </div>
      </section>

      {/* Deep Dive Mode: Dossier FolderCards & Spec */}
      {deepDiveOpen && (
        <section className="mx-auto w-full max-w-5xl px-4 py-8 animate-view-enter">
          <div className="mb-4 text-center">
            <span className="label-mono text-ink-secondary">INTERACTIVE DOSSIER</span>
            <p className="mt-1 text-xs text-ink-secondary">
              Architectural dossiers and task specifications for the OKX multichat workbench.
            </p>
          </div>
          <FolderCards cards={LANDING_PAGES} />
          <div className="mt-4">
            <InviteSpec />
          </div>
        </section>
      )}

      {/* Console Footer */}
      <footer className="mt-auto border-t border-hairline py-8 bg-app">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4">
          {/* Top row: Brand & navigation */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wider font-semibold text-ink">
                kind meitner
              </span>
              <span className="text-ink-secondary">·</span>
              <span className="font-mono text-xs text-ink-secondary">
                OKX DEV DAY 2026 BENCHMARK
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <button
                type="button"
                onClick={handleOpenApp}
                className="text-ink-secondary hover:text-ink hover:underline cursor-pointer"
              >
                Console
              </button>
              <button
                type="button"
                onClick={handleOpenTeamMap}
                className="text-ink-secondary hover:text-ink hover:underline cursor-pointer"
              >
                Team map
              </button>
            </div>
          </div>

          {/* Middle row: Live endpoints as mono links */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-hairline py-3 font-mono text-[11px]">
            <span className="label-mono text-ink-secondary">ENDPOINTS:</span>
            <a
              href="https://kind-meitner-production.up.railway.app/api/okx/free-mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink hover:underline"
            >
              POST /api/okx/free-mcp
            </a>
            <a
              href="https://www.okx.ai/agents/13851"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink hover:underline"
            >
              ASP #13851 (OKX.AI)
            </a>
            <a
              href="https://github.com/Huc06/kind-meitner"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink hover:underline"
            >
              GitHub Repository
            </a>
          </div>

          {/* Bottom row: Honest claim line */}
          <p className="font-mono text-[11px] text-ink-secondary">
            Free, read-only, paymentless — no wallet, custody, mainnet settlement or OKX endorsement.
          </p>
        </div>
      </footer>
    </main>
  );
}

export default LandingPage;
