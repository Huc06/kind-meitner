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

      <div className="mt-16 overflow-visible rounded-2xl border border-[#e6e1d8] bg-white" style={{ colorScheme: "light" }}>
        <div className="flex items-center gap-2 border-b border-[#e6e1d8] px-4 py-2">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <p className="ml-2 font-mono text-[12px] text-[#8a837c]">docs/okx/invite.md</p>
        </div>
        <div className="overflow-x-auto px-8 pb-28 pt-24 font-mono text-[15px] leading-8 text-[#3d3834]">
          <p className="whitespace-nowrap">
            - <span className="ann ann-n ann-amber" data-note="open task">[ ]</span>{" "}
            <span className="ann ann-s ann-blue" data-note="stable ID">INV-004</span>
            <span> Ship Evaluator </span>
            <span className="ann ann-se ann-green" data-note="tag">#evaluator</span>{" "}
            <span className="ann ann-sw ann-red" data-note="priority">!high</span>{" "}
            <span className="ann ann-nw ann-purple" data-note="custom field">@blocked_by:INV-001</span>
          </p>
          <p className="mt-4 pl-6">
            <span className="ann ann-n" data-note="description">Sample screen. No page.</span>
          </p>
        </div>
      </div>
      <p className="mt-6 max-w-2xl text-sm italic text-[#8a837c]">
        @blocked_by is a custom field. That open line is not a link.
      </p>
    </section>
  );
}
