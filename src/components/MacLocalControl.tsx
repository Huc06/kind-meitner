import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Shield } from "lucide-react";
import { useDesktopCapabilities } from "./DesktopCapabilities";
import { Button } from "@/components/ui/button";
import { Frame } from "@/components/ui/frame";
import { Tag } from "@/components/ui/tag";
export function MacLocalControl() {
  const { capabilities } = useDesktopCapabilities();
  const [pending, setPending] = useState(false);
  const [awaitingGrant, setAwaitingGrant] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retry = async () => {
    setPending(true);
    setError(null);
    try {
      await window.ogb?.localControl?.retry();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setPending(false);
    }
  };

  const openSettings = async () => {
    setError(null);
    setAwaitingGrant(true);
    try {
      await window.ogb?.permOpenSettings?.("accessibility");
      await window.ogb?.permOpenSettings?.("screen");
    } catch (reason) {
      setAwaitingGrant(false);
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  useEffect(() => {
    if (!awaitingGrant) return;
    let used = false;
    const onFocus = () => {
      if (used) return;
      if (document.visibilityState !== "visible") return;
      used = true;
      setAwaitingGrant(false);
      void retry();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [awaitingGrant]);

  if (capabilities.host.platform !== "darwin") return null;
  if (capabilities.localComputer.available) return null;

  return (
    <Frame surface="panel" corners className="mt-4 border border-warning/40 bg-card p-4">
      <div className="flex items-start gap-3">
        <Shield size={16} className="mt-0.5 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Tag tone="warning" size="sm">PERMISSION</Tag>
            <span className="text-[13.5px] font-medium text-ink">Allow control of this computer</span>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-secondary">
            kind-meitner needs Accessibility and Screen Recording in System Settings before a bot can
            use this Mac. After you grant both, click Retry — macOS may still ask you to relaunch the app.
          </p>
          {error && (
            <div className="mt-2 flex items-center gap-1.5 text-[12px] text-danger">
              <AlertTriangle size={13} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void openSettings()}
              disabled={pending}
            >
              Open System Settings
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void retry()}
              disabled={pending}
            >
              {pending && <Loader2 size={13} className="animate-spin" />}
              Retry
            </Button>
          </div>
        </div>
      </div>
    </Frame>
  );
}
