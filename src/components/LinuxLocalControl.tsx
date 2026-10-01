import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MonitorCog,
  Power,
  RotateCcw,
} from "lucide-react";

import { t } from "@/lib/i18n";
import { useDesktopCapabilities } from "./DesktopCapabilities";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
const LINUX_GUIDE_URL =
  "https://github.com/harrymove-ctrl/kind-meitner/blob/main/docs/linux-desktop.md#enable-local-control";

export function LinuxLocalControl() {
  const { capabilities } = useDesktopCapabilities();
  const local = capabilities.localComputer;
  const [pending, setPending] = useState<"enable" | "disable" | "retry" | null>(null);
  const [error, setError] = useState<string | { key: "computer.linux.stopFailed" } | null>(null);

  if (capabilities.host.platform !== "linux") return null;
  const busy = pending !== null || local.status === "checking" || local.status === "starting";
  const ready = local.available;
  const waylandSafetyBlocked = local.reasonCode === "linux-wayland-seat-safety-blocked";
  const wayland = capabilities.host.session === "wayland";
  const bundledDriver = local.driverSource === "bundled";

  const run = async (action: "enable" | "disable" | "retry") => {
    if (!window.ogb?.localControl) return;
    setPending(action);
    setError(null);
    try {
      if (action === "disable" || action === "retry") {
        const response = await fetch("/api/local-computer/interrupt", { method: "POST" });
        if (!response.ok) {
          setError({ key: "computer.linux.stopFailed" });
          return;
        }
      }
      await window.ogb.localControl[action]();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setPending(null);
    }
  };

  return (
    <section className="mt-4 border border-hairline bg-card p-4" aria-labelledby="linux-local-control-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div id="linux-local-control-title" className="flex items-center gap-2 text-[14px] font-medium text-ink">
            <MonitorCog size={16} className={ready ? "text-success" : "text-ink-secondary"} />
            {t("computer.linux.title")}
          </div>
          <div className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
            {t("computer.linux.meta", { session: wayland ? "Wayland" : "Xorg" })}
          </div>
        </div>
        <Tag
          tone={ready ? "success" : waylandSafetyBlocked ? "danger" : local.enabled ? "warning" : "neutral"}
          size="sm"
        >
          {ready
            ? t("computer.linux.ready")
            : waylandSafetyBlocked
              ? t("computer.linux.waylandBadge")
              : local.enabled
                ? t("vm.state.attention")
                : t("vm.dest.off")}
        </Tag>
      </div>

      {waylandSafetyBlocked ? (
        <div className="mt-3 border border-danger/40 bg-card p-3">
          <div className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-secondary">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-danger" />
            <div>
              <span>
                {t("computer.linux.waylandBefore")}{" "}
                <strong className="font-medium text-ink">{t("computer.linux.waylandXorg")}</strong>
                {" "}{t("computer.linux.waylandAfter")}
              </span>
            </div>
          </div>
        </div>
      ) : !local.enabled ? (
        <div className="mt-3 border border-warning/40 bg-card p-3">
          <div className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-secondary">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" />
            <div>
              <span>
                {t("computer.linux.enableBefore")}{" "}
                <strong className="font-medium text-ink">{t("vm.dest.local")}</strong>{" "}
                {t("computer.linux.enableAfter")}
                {wayland && ` ${t("computer.linux.waylandInput")}`}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 border border-hairline bg-inset p-3 text-[12px] text-ink-secondary">
          <div className="flex items-start gap-2">
            {ready ? (
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" />
            ) : busy ? (
              <Loader2 size={15} className="mt-0.5 shrink-0 animate-spin text-ink-secondary" />
            ) : (
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" />
            )}
            <span aria-live="polite">
              {ready
                ? t("computer.linux.readyMsg")
                : local.message ?? t("computer.linux.checking")}
            </span>
          </div>
          {local.driverPath && (
            <div className="mt-2 break-all font-mono text-[10px] text-ink-secondary" title={local.driverPath}>
              {bundledDriver ? t("computer.linux.bundledDriver") : local.driverPath}
              {local.driverVersion ? ` · ${local.driverVersion}` : ""}
            </div>
          )}
        </div>
      )}

      {error && <div className="mt-2 font-mono text-[12px] text-danger">{typeof error === "string" ? error : t(error.key)}</div>}

      {!waylandSafetyBlocked && (
        <div className="mt-3 flex gap-2">
          {!local.enabled ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={busy}
              onClick={() => void run("enable")}
              className="flex-1"
            >
              {pending === "enable" ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
              {t("computer.linux.enable")}
            </Button>
          ) : (
            <>
              {!ready && (
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  disabled={busy}
                  onClick={() => void run("retry")}
                  className="flex-1"
                >
                  {pending === "retry" ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  {t("computer.linux.tryAgain")}
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                size="md"
                disabled={pending !== null}
                onClick={() => void run("disable")}
                className="flex-1"
              >
                {pending === "disable" ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
                {t("computer.linux.disable")}
              </Button>
            </>
          )}
        </div>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => window.open(LINUX_GUIDE_URL, "_blank", "noopener,noreferrer")}
        className="mt-2 w-full text-[11px]"
      >
        {capabilities.host.packaged ? t("computer.linux.guide") : t("computer.linux.driverSetup")}{" "}
        <ExternalLink size={11} />
      </Button>
    </section>
  );
}
