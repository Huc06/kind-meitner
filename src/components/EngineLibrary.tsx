import { useState, type ReactNode } from "react";
import { ArrowUpRight, Check, ChevronDown, RefreshCw } from "lucide-react";
import { useStore, type InstanceInfo } from "@/state/store";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { ProviderMark } from "./ProviderIcons";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { Eyebrow } from "@/components/ui/eyebrow";
export function engineReady(instance: InstanceInfo): boolean {
  return instance.snapshot.state === "available" &&
    (instance.access === "custom" || instance.snapshot.authenticated !== false);
}

const providers: Record<string, string> = {
  claudeAgent: "Anthropic", grok: "xAI", grokAgent: "xAI",
};

/** One disclosure, not a second settings dialog. Keep its children mounted so
 * closing a card does not abandon an in-progress sign-in or a CLI path draft. */
export function EngineCard({ instance, children }: { instance: InstanceInfo; children: ReactNode }) {
  const ready = engineReady(instance);
  const email = instance.snapshot.authenticated === true ? instance.snapshot.account?.email : undefined;
  const subtitle = email ?? (instance.access === "custom"
    ? t("engines.library.custom")
    : providers[instance.driverKind] ?? instance.driverKind);
  // Some CLIs return their executable name rather than a version. Do not show
  // duplicated labels such as “Grok · grok”; retain the raw value in details.
  const version = instance.snapshot.version?.match(/\d+\.\d+(?:\.\d+)?(?:[-+][\w.-]+)?/)?.[0];
  return (
    <details data-engine-card={instance.instanceId} className="group/engine min-w-0 border border-hairline bg-card transition-colors open:col-span-full">
      <summary className="cursor-pointer list-none p-4 outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center border border-hairline bg-panel">
            <ProviderMark driverKind={instance.driverKind} size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold tracking-tight text-ink" title={instance.displayName}>{instance.displayName}</div>
            <div className="mt-0.5 truncate font-mono text-[11.5px] text-ink-secondary" title={subtitle}>{subtitle}</div>
          </div>
          <ChevronDown size={15} aria-hidden="true" className="shrink-0 text-ink-secondary transition-transform group-open/engine:rotate-180 motion-reduce:transition-none" />
        </div>
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
          <Tag tone={ready ? "success" : "neutral"} size="sm">
            {ready ? <Check size={11} aria-hidden="true" /> : <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />}
            {ready ? t("onboarding.engines.ready") : t("onboarding.engines.needsSetup")}
          </Tag>
          {ready ? (
            <span className="font-mono text-[11px] tabular-nums text-ink-secondary">{version ? `v${version}` : t("engines.library.manage")}</span>
          ) : (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase text-ink">
              {t("engines.library.setup")}<ArrowUpRight size={12} aria-hidden="true" />
            </span>
          )}
        </div>
      </summary>
      <div className="min-w-0 border-t border-hairline p-4">{children}</div>
    </details>
  );
}

export function EngineSections({ instances, renderEngine }: {
  instances: InstanceInfo[];
  renderEngine: (instance: InstanceInfo) => ReactNode;
}) {
  // Flat, instance-keyed siblings keep forms and sign-in state alive when a
  // refreshed status moves a card between groups. Separate section parents
  // would remount it and discard unsaved input.
  return <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] items-start gap-3">
    {[true, false].flatMap((ready) => {
      const rows = instances.filter((instance) => engineReady(instance) === ready);
      if (!rows.length) return [];
      const label = t(ready ? "onboarding.engines.ready" : "onboarding.engines.needsSetup");
      return [
        <div key={`heading-${ready}`} className={cn("col-span-full flex items-center justify-between gap-3", !ready && instances.some(engineReady) && "mt-4")}>
          <Eyebrow>{label}</Eyebrow>
          <span className="font-mono text-[11px] tabular-nums text-ink-secondary">{t(rows.length === 1 ? "engines.library.countOne" : "engines.library.count", { count: rows.length })}</span>
        </div>,
        ...rows.map((instance) => <div key={instance.instanceId} className="contents">{renderEngine(instance)}</div>),
      ];
    })}
    {instances.length === 0 && <p className="col-span-full py-4 text-[13px] text-ink-secondary">{t("engines.none")}</p>}
  </div>;
}

export function RefreshEngines() {
  const { refreshInstances } = useStore();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try { await refreshInstances(); } finally { setBusy(false); }
      }}
    >
      <RefreshCw size={12} aria-hidden="true" className={cn(busy && "animate-spin")} />
      {busy ? t("common.checking") : t("engines.library.refresh")}
    </Button>
  );
}
