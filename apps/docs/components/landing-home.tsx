"use client";

import { useEffect, useState } from "react";
import { FolderCards, LANDING_PAGES } from "./folder-cards";
import { InviteSpec } from "./invite-deep-dive";
import { ThemeToggle } from "./theme-toggle";

const releasesUrl = "https://github.com/harrymove-ctrl/kind-meitner/releases/latest";
const localAppUrl = "http://127.0.0.1:5199/";

const PILLARS = [
  {
    title: "Evaluator ASP",
    description: "3-agent jury for dispute resolution",
    href: "/docs/features/approvals-and-inspector",
  },
  {
    title: "Recurring Scheduler",
    description: "cron/interval/daily with treasury caps",
    href: "/docs/features/automation",
  },
  {
    title: "Bloomberg Intelligence",
    description: "marketplace analytics dashboard",
    href: "/docs/features/bots-and-tasks",
  },
  {
    title: "Meta-Agent Orchestration",
    description: "multi-agent room handoffs",
    href: "/docs/features/chat-and-teams",
  },
];

export function LandingHome() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("guide")) setOpen(true);
  }, []);

  // Direct link to the running product application with fallback to latest releases
  const appUrl = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? localAppUrl
    : releasesUrl;

  return (
    <main className={open ? "flex flex-1 flex-col bg-[#f7f4ef] text-[#3d3834]" : "flex flex-1 flex-col bg-zinc-100 text-zinc-950"}>
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 pt-6">
        <p className={open ? "text-sm font-medium text-[#8a837c]" : "text-sm font-medium text-zinc-600"}>
          {open ? "Task guide" : "Show the task guide"}
        </p>
        <ThemeToggle checked={open} onChange={setOpen} />
      </div>

      {open ? <InviteSpec /> : null}
      {open ? <FolderCards cards={LANDING_PAGES} /> : null}

      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 pb-12 pt-10">
        <p className={open ? "text-sm font-medium uppercase tracking-[0.18em] text-[#2f8f5b]" : "text-sm font-medium uppercase tracking-[0.18em] text-emerald-700"}>
          OKX agent suite
        </p>
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl">kind-meitner</h1>
        <p className="max-w-2xl text-xl leading-8">
          AI-Native Agent Suite &amp; Autonomous Commerce Operating System for OKX.ai
        </p>
        <p className="max-w-2xl text-base leading-7" style={{ color: open ? "#3d3834" : "#3f3f46" }}>
          Invite an OKX agent into a room. Switch on to see the spec, the tasks, and how to read one line.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <a
            href={appUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-full bg-[#2f8f5b] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#277a4e]"
          >
            Open App &rarr;
          </a>
          <a
            href="/docs"
            className="inline-flex items-center rounded-full border px-5 py-2.5 text-sm font-semibold transition hover:bg-black/5"
            style={{ color: "#3d3834", borderColor: "#b9b2a6", background: "#fff" }}
          >
            Read Docs
          </a>
        </div>
      </section>

      {/* Core Architecture: 4 Pillars */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-16">
        <h2 className={open ? "text-xs font-semibold uppercase tracking-wider text-[#2f8f5b]" : "text-xs font-semibold uppercase tracking-wider text-emerald-700"}>
          Core Architecture
        </h2>
        <p className="mt-1 text-2xl font-bold tracking-tight">The Four Pillars</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => (
            <a
              key={p.title}
              href={p.href}
              className={open
                ? "group flex flex-col rounded-2xl border border-[#e6e1d8] bg-white/70 p-5 transition hover:border-[#2f8f5b] hover:shadow-md"
                : "group flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-emerald-600 hover:shadow-md"}
            >
              <h3 className="text-base font-semibold group-hover:text-emerald-600">{p.title}</h3>
              <p className={open ? "mt-2 text-xs leading-5 text-[#8a837c]" : "mt-2 text-xs leading-5 text-zinc-500"}>
                {p.description}
              </p>
              <span className="mt-4 flex items-center gap-1 text-xs font-medium text-emerald-600">
                Learn more &rarr;
              </span>
            </a>
          ))}
        </div>
      </section>

      <footer className={open ? "mt-auto border-t border-[#e6e1d8]" : "mt-auto border-t border-zinc-300"}>
        <div className={open
          ? "mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-[#8a837c]"
          : "mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-zinc-600"}>
          <p>Built for OKX Onchain OS &amp; X Layer</p>
          <a href="https://github.com/harrymove-ctrl/kind-meitner" className={open ? "font-medium text-[#3d3834] hover:underline" : "font-medium text-zinc-950 hover:underline"}>
            GitHub
          </a>
        </div>
      </footer>
    </main>
  );
}
