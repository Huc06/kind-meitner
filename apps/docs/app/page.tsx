import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: { absolute: 'kind-meitner' },
  description: 'AI-Native Agent Suite & Autonomous Commerce Operating System for OKX.ai',
};

const PILLARS = [
  {
    title: 'Evaluator ASP',
    description: '3-agent jury for dispute resolution',
    href: '/docs/features/approvals-and-inspector',
  },
  {
    title: 'Recurring Scheduler',
    description: 'cron/interval/daily with treasury caps',
    href: '/docs/features/automation',
  },
  {
    title: 'Bloomberg Intelligence',
    description: 'marketplace analytics dashboard',
    href: '/docs/features/bots-and-tasks',
  },
  {
    title: 'Meta-Agent Orchestration',
    description: 'multi-agent room handoffs',
    href: '/docs/features/chat-and-teams',
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-zinc-950 text-zinc-100">
      {/* 1. Hero */}
      <header className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-20 text-center">
        <div className="inline-flex self-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold tracking-wide text-emerald-400">
          OKX Onchain OS &amp; X Layer
        </div>
        <h1 className="mt-6 text-5xl font-bold tracking-tight text-white sm:text-7xl">
          kind-meitner
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-xl leading-relaxed text-zinc-400 sm:text-2xl">
          AI-Native Agent Suite &amp; Autonomous Commerce Operating System for OKX.ai
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-500">
          The 4-pillar agent platform that turns OKX into a living, autonomous trading and commerce system.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
          >
            Open App
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/80 px-6 py-3.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
          >
            Read Docs
          </Link>
        </div>
      </header>

      {/* 2. Four Pillars */}
      <section className="border-t border-zinc-900 bg-zinc-900/30 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Core Architecture
            </h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-white">
              The Four Pillars
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((pillar) => (
              <Link
                key={pillar.title}
                href={pillar.href}
                className="group relative flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 transition duration-200 hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-800/80 hover:shadow-lg hover:shadow-emerald-950/20"
              >
                <h3 className="text-base font-semibold text-white group-hover:text-emerald-400">
                  {pillar.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  {pillar.description}
                </p>
                <div className="mt-4 flex items-center gap-1 text-xs font-medium text-emerald-400">
                  <span>Explore pillar</span>
                  <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">&rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Footer */}
      <footer className="mt-auto border-t border-zinc-900 bg-zinc-950 py-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 text-sm text-zinc-500">
          <p>Built for OKX Onchain OS &amp; X Layer</p>
          <a
            href="https://github.com/harrymove-ctrl/kind-meitner"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-zinc-400 transition hover:text-white hover:underline"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
