import { ExternalLink, LogOut, Wifi, WifiOff } from "lucide-react";
import { OKX_DEMO_IDENTITY, type OkxDemoStatus } from "../../../shared/okx-demo-identity";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";

export function DemoHeader({
  status,
  statusLoading,
  lastCheckTime,
  onExit,
}: {
  status: OkxDemoStatus | null;
  statusLoading: boolean;
  lastCheckTime: string | null;
  onExit: () => void;
}) {
  const isConnected = !statusLoading && Boolean(status?.ok);
  const toolCount = status?.tools?.length ?? 0;

  return (
    <header className="border-b border-hairline bg-surface px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-lg font-semibold tracking-tight text-ink sm:text-xl">
              {t("demo.header.title")}
            </h1>
            <Tag tone="neutral" size="sm" variant="outline" className="font-mono text-[11px]">
              {t("demo.header.agentFact", { agentId: OKX_DEMO_IDENTITY.agentId })}
            </Tag>
            <Tag tone="neutral" size="sm" variant="outline" className="font-mono text-[11px]">
              {t("demo.header.access")}
            </Tag>
          </div>
          <p className="mt-1 font-mono text-[12.5px] text-ink-secondary">
            {t("demo.header.tagline")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={OKX_DEMO_IDENTITY.listingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded border border-hairline bg-raised px-2.5 py-1 font-mono text-[12px] text-ink transition-colors hover:bg-raised-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
          >
            <ExternalLink size={13} aria-hidden="true" />
            <span>{t("demo.header.listingLink")}</span>
          </a>
          <Button
            variant="secondary"
            size="sm"
            onClick={onExit}
            aria-label={t("demo.nav.exit")}
            className="font-mono text-[12px]"
          >
            <LogOut size={13} aria-hidden="true" />
            <span>{t("demo.nav.exit")}</span>
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-hairline pt-2.5 font-mono text-[11.5px] text-ink-secondary">
        <div className="flex items-center gap-1.5">
          {statusLoading ? (
            <span className="flex items-center gap-1 text-ink-secondary">
              <span className="size-2 animate-pulse rounded-full bg-ink-secondary" />
              <span>Connecting…</span>
            </span>
          ) : isConnected ? (
            <span className="flex items-center gap-1 text-success">
              <span className="size-2 rounded-full bg-success" />
              <Wifi size={13} aria-hidden="true" />
              <span>{t("demo.header.connected", { count: toolCount })}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-danger">
              <span className="size-2 rounded-full bg-danger" />
              <WifiOff size={13} aria-hidden="true" />
              <span>
                {t("demo.header.unavailable", {
                  message: status?.safeMessage ?? "Offline",
                })}
              </span>
            </span>
          )}
        </div>

        <div className="text-hairline">·</div>

        <div>
          {lastCheckTime
            ? t("demo.header.lastCheck", { time: lastCheckTime })
            : t("demo.header.neverChecked")}
        </div>
      </div>
    </header>
  );
}
