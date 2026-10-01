import { Frame } from "@/components/ui/frame";
import { Tag } from "@/components/ui/tag";

/**
 * Restyled console specification and operational task breakdown.
 * Styled in the Nymspace register using Frame and token colors.
 */
export function InviteSpec() {
  return (
    <section className="w-full py-4 text-ink" aria-label="Spec and tasks">
      <Frame title="DOSSIER SPECIFICATION &amp; TASKS" index="02" surface="app" className="bg-card p-6">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Spec Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="label-mono text-ink-secondary">// SPECIFICATION</span>
              <Tag tone="cyan" variant="outline" size="sm">
                A2MCP
              </Tag>
            </div>
            <div className="space-y-2 font-mono text-[13px] leading-relaxed text-ink-secondary">
              <p className="font-medium text-ink"># Agent Invocation Protocol</p>
              <p>• Open a room that is not a direct message.</p>
              <p>• Channel 1 is created once. Invite lives on that header.</p>
              <p>• Markets, Listing Coach, and Spend Scout are Free · read-only.</p>
              <p>• Two-tier architecture: In-process tool mount (ASP #13851) + OKX Onchain OS dynamic proxy router.</p>
            </div>
          </div>

          {/* Tasks Column */}
          <div className="space-y-4 border-t border-hairline pt-6 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0">
            <div className="flex items-center gap-2">
              <span className="label-mono text-ink-secondary">// OPERATIONAL TASKS</span>
              <Tag tone="success" variant="outline" size="sm">
                ROUTINES
              </Tag>
            </div>
            <div className="space-y-2.5 font-mono text-[13px] leading-relaxed">
              <div>
                <a
                  href="/docs/getting-started/first-bot"
                  className="flex items-center gap-1.5 text-ink hover:underline"
                >
                  <span className="font-bold text-success">[x]</span>
                  <span>INV-001 Invite an OKX agent #invite</span>
                </a>
                <p className="pl-6 text-xs text-ink-secondary">Open Channel 1 and choose Invite OKX agent.</p>
              </div>

              <div>
                <a
                  href="/docs/okx/agents"
                  className="flex items-center gap-1.5 text-ink hover:underline"
                >
                  <span className="font-bold text-success">[x]</span>
                  <span>INV-002 Open the catalog #catalog</span>
                </a>
                <p className="pl-6 text-xs text-ink-secondary">The catalog is local. It is not the live Portal.</p>
              </div>

              <div>
                <a
                  href="/docs/okx/rooms"
                  className="flex items-center gap-1.5 text-ink hover:underline"
                >
                  <span className="font-bold text-success">[x]</span>
                  <span>INV-003 Use a room #rooms</span>
                </a>
                <p className="pl-6 text-xs text-ink-secondary">A direct message cannot take an invite.</p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-ink-secondary">
                  <span className="font-bold text-ink-secondary">[ ]</span>
                  <span>INV-005 Ship Bloomberg #bloomberg !high</span>
                </div>
                <p className="pl-6 text-xs text-ink-secondary">Sample figures. Evaluator jury and market stats.</p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-ink-secondary">
                  <span className="font-bold text-ink-secondary">[ ]</span>
                  <span>INV-006 Open the scheduler #scheduler !high</span>
                </div>
                <p className="pl-6 text-xs text-ink-secondary">Autonomous cron/interval routines with treasury controls.</p>
              </div>
            </div>
          </div>
        </div>
      </Frame>
    </section>
  );
}

export default InviteSpec;
