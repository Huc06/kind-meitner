"use client";

import { useEffect, useState } from "react";
import { FolderCards, LANDING_PAGES } from "./folder-cards";
import { InviteSpec } from "./invite-deep-dive";
import { ThemeToggle } from "./theme-toggle";

const releasesUrl = "https://github.com/harrymove-ctrl/kind-meitner/releases/latest";

export function LandingHome() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("guide")) setOpen(true);
  }, []);

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

      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 pb-16 pt-10">
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
        <div className="mt-2 flex flex-wrap gap-3">
          <a
            href={releasesUrl}
            className="inline-flex items-center rounded-full bg-[#2f8f5b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#277a4e]"
          >
            Open App
          </a>
          <a
            href="/docs/getting-started/first-bot"
            className="inline-flex items-center rounded-full border px-5 py-2.5 text-sm font-semibold"
            style={{ color: "#3d3834", borderColor: "#b9b2a6", background: "#fff" }}
          >
            Read Docs
          </a>
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
