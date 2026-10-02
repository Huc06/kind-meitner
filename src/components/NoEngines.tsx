// Shown instead of a chat when nothing on this machine can run a bot.
//
// The alternative — which is what used to happen — is a chat that looks
// completely functional until the first message, then fails with a raw spawn
// error. Every engine unavailable is a setup state, not an error state, so it
// gets a screen that says what to do rather than a bot that can't answer.
import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/state/store";
import { EngineGroupLabel } from "@/components/EngineGroupLabel";
import { EngineSetup, installCommandFor } from "@/components/EngineSetup";
import { ProviderMark } from "@/components/ProviderIcons";
import { splitEngineRail } from "@/lib/engine-rail";
import { t } from "@/lib/i18n";
import { brand } from "../lib/brand";
import { Frame } from "@/components/ui/frame";
import { Button } from "@/components/ui/button";
export function NoEngines() {
  const { state, refreshInstances } = useStore();
  const remoteClient = window.ogb?.remoteClient?.active === true;
  const [rechecking, setRechecking] = useState(false);
  const recheck = async () => {
    setRechecking(true);
    try {
      await refreshInstances();
    } finally {
      setRechecking(false);
    }
  };

  if (remoteClient) {
    return (
      <main className="flex h-full min-w-0 flex-1 items-center justify-center bg-app p-6">
        <Frame title="NO ENGINES" surface="app" className="max-w-[480px] bg-card p-6 text-center">
          <h1 className="text-[16px] font-semibold text-ink">The host needs an agent engine</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-secondary">
            Configure Claude, ACP, or another supported engine in kind-meitner on the host computer, then return here.
          </p>
          <div className="mt-5 flex justify-center">
            <Button onClick={() => void recheck()} disabled={rechecking} variant="secondary" size="md">
              {rechecking ? "Checking…" : "Check again"}
            </Button>
          </div>
        </Frame>
      </main>
    );
  }

  // Only things you actually install belong on a "get started" screen. The
  // Box cloud runner also reports unavailable here, but it's configured with
  // a token in settings rather than installed, so listing it would just be a
  // dead end alongside the real options.
  const engines = state.instances
    .filter((i) => i.install)
    // An engine with a command for this platform is one the user can act on
    // right now; the rest (GUI downloads, POSIX-only installers on Windows)
    // sort below so the actionable path is the obvious one.
    .sort((a, b) => {
      const aCmd = installCommandFor(a.install) ? 0 : 1;
      const bCmd = installCommandFor(b.install) ? 0 : 1;
      return aCmd - bCmd;
    });

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto bg-app">
      <div className="mx-auto w-full max-w-[560px] px-6 py-12">
        <div className="label-mono text-ink-secondary mb-1.5">[ 01 · SETUP ]</div>
        <h1 className="text-[20px] font-semibold text-ink">{t("noEngines.title")}</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
          {t("noEngines.intro", { app: brand().name })}
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          {(() => {
            const { subscription, custom } = splitEngineRail(engines);
            const card = (instance: (typeof engines)[number]) => (
              <div key={instance.instanceId} className="border border-hairline bg-card p-3.5">
                <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
                  <ProviderMark driverKind={instance.driverKind} size={15} />
                  {instance.displayName}
                </div>
                <EngineSetup
                  instance={instance}
                  intent={instance.access === "custom" ? "inject" : "cloud"}
                  className="mt-0.5"
                />
              </div>
            );
            return (
              <>
                {subscription.length > 0 && <EngineGroupLabel className="px-0.5">{t("engines.cloud")}</EngineGroupLabel>}
                {subscription.map(card)}
                {custom.length > 0 && <EngineGroupLabel className="px-0.5 pt-1.5">{t("engines.local")}</EngineGroupLabel>}
                {custom.map(card)}
              </>
            );
          })()}
        </div>

        <div className="mt-6">
          <Button
            onClick={recheck}
            disabled={rechecking}
            variant="secondary"
            size="md"
          >
            {rechecking ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {rechecking ? t("common.checking") : t("common.checkAgain")}
          </Button>
        </div>
      </div>
    </main>
  );
}
