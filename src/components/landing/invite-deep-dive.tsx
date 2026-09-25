"use client";

import "./neat-annotations.css";

function Brace({ label }: { label: string }) {
  return (
    <div className="hidden w-20 shrink-0 items-center gap-1.5 text-[#8a837c] lg:flex" aria-hidden="true">
      <svg viewBox="0 0 24 100" preserveAspectRatio="none" width="16" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" className="h-full w-4">
        <path d="M5 2 C17 2 17 18 17 34 C17 43 20 48 23 50 C20 52 17 57 17 66 C17 82 17 98 5 98" />
      </svg>
      <span className="-rotate-2 whitespace-nowrap text-base">{label}</span>
    </div>
  );
}

export function InviteSpec() {
  return (
    <section
      className="mx-auto w-full max-w-5xl px-6 pb-16 text-[#3d3834]"
      style={{ ["--ann-font" as string]: "var(--font-shantell), cursive" }}
      aria-label="Spec and tasks"
    >
      <div className="flex items-stretch gap-3 font-mono text-[14px] leading-7">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold"># Invite</p>
          <p className="mt-2 text-[#8a837c]">Open a room that is not a direct message.</p>
          <p className="text-[#8a837c]">Channel 1 is created once. Invite lives on that header.</p>
          <p className="text-[#8a837c]">Markets, Listing Coach, and Spend Scout are Free · read-only.</p>
        </div>
        <Brace label="spec" />
      </div>

      <div className="mt-8 flex items-stretch gap-3 font-mono text-[14px] leading-7">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold"># Tasks</p>
          <p className="mt-2">
            <a href="/docs/getting-started/first-bot" className="hover:text-[#2f8f5b]">- [x] INV-001 Invite an OKX agent #invite</a>
          </p>
          <p className="pl-6 text-[#8a837c]">Open Channel 1 and choose Invite OKX agent.</p>
          <p>
            <a href="/docs/okx/agents" className="hover:text-[#2f8f5b]">- [x] INV-002 Open the catalog #catalog</a>
          </p>
          <p className="pl-6 text-[#8a837c]">The catalog is local. It is not the live Portal.</p>
          <p>
            <a href="/docs/okx/rooms" className="hover:text-[#2f8f5b]">- [x] INV-003 Use a room #rooms</a>
          </p>
          <p className="pl-6 text-[#8a837c]">A direct message cannot take an invite.</p>
          <p className="mt-3 text-[#8a837c]">- [ ] INV-005 Ship Bloomberg #bloomberg !high @blocked_by:INV-004</p>
          <p className="pl-6 text-[#8a837c]">Sample figures. No page.</p>
          <p className="text-[#8a837c]">- [ ] INV-006 Open the scheduler #scheduler !high</p>
          <p className="pl-6 text-[#8a837c]">No sidebar control. No page.</p>
        </div>
        <Brace label="tasks" />
      </div>

    </section>
  );
}
