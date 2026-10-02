// Auto-update popup — a small card floating bottom-left, driven by the
// preload's updater bridge. Renders nothing in the browser/dev (no bridge)
// and while idle/checking; appears only when actionable: an update to
// download, a download in progress, a restart to apply, or an error.
import { useEffect, useState } from "react";
import { ArrowDownToLine, Loader2, PackageOpen, RefreshCw, Sparkles, X } from "lucide-react";
import { useUpdaterState } from "@/lib/updater";
import { cn } from "@/lib/cn";
import { brand } from "../lib/brand";
import { Button } from "@/components/ui/button";
// electron-updater surfaces failures as a whole HTTP dump — status line,
// every response header, stack trace. That is unreadable in a 300px popup,
// so name the two cases that actually happen and clip anything else to its
// first line.
function friendlyError(message?: string): string {
  if (!message) return "Something went wrong.";
  if (/cannot find .*\.yml|404/i.test(message))
    return "No update has been published for this platform yet.";
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|net::/i.test(message))
    return "Couldn't reach the update server.";
  return message.split("\n")[0].slice(0, 140);
}

export function UpdateBanner() {
  const s = useUpdaterState();
  // dismissal is per status+version, so the popup returns for the next
  // update (and when an available one finishes downloading)
  const [dismissed, setDismissed] = useState<string | null>(null);
  // A click has to go renderer → main → broadcast before the real status
  // arrives. Latch the pressed button as busy on the same frame so it greys
  // out immediately; the incoming status clears the latch.
  const [pending, setPending] = useState<"download" | "install" | "check" | null>(null);
  const status = s?.status;
  useEffect(() => setPending(null), [status]);

  if (!s || s.status === "idle" || s.status === "checking") return null;
  const key = `${s.status}:${s.version ?? ""}`;
  if (dismissed === key) return null;
  const updater = window.ogb!.updater!;

  // while busy the card owns the moment: no dismissing, no second click
  const installing = s.status === "installing";
  const preparing = s.status === "preparing";
  const busy = s.status === "downloading" || preparing || installing;
  // Ubuntu system packages can't be swapped under a running app, so the
  // command is copied and a terminal opens; the user finishes there.
  // Nothing restarts, and the card has to stop promising that it will.
  const handoff = s.installMode === "handoff";

  const title =
    s.status === "available"
      ? `${brand().name} ${s.version} is available`
      : s.status === "downloading"
        ? `Downloading ${s.version ?? "update"}…`
        : preparing
          ? "Preparing update…"
          : s.status === "downloaded"
            ? `${s.version} is ready`
            : installing
              ? handoff
                ? "Opening a terminal…"
                : "Restarting to update…"
              : s.status === "handed-off"
                ? "Finish in a terminal"
                : "Update failed";
  const subtitle =
    s.status === "available"
      ? "A newer version is ready to download."
      : s.status === "downloading"
        ? // no percent yet means the transfer hasn't reported in — don't imply 0
          s.percent == null
          ? "Starting download…"
          : `${Math.round(s.percent)}%`
        : preparing
          ? "Download complete. macOS is preparing the update."
          : s.status === "downloaded"
            ? handoff
              ? "Copy the install command and open a terminal."
              : "Restart to finish updating."
            : installing
              ? handoff
                ? "Copying the command…"
                : s.message || `${brand().name} will reopen in a moment.`
              : s.status === "handed-off"
                ? s.terminalOpened
                  ? "Command copied — paste it in the terminal that opened."
                  : "Command copied — paste it in a terminal to finish."
                : s.retryable === false
                  ? `${friendlyError(s.message?.split(" Quit and reopen ")[0])} Quit and reopen ${brand().name} before trying the update again.`
                  : friendlyError(s.message);

  return (
    <div className="animate-view-enter fixed bottom-4 left-4 z-50 w-[320px] border border-hairline bg-panel p-3.5 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.6)]">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center border border-hairline bg-card text-ink">
          <Sparkles size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="label-mono text-[12px] text-ink">{title}</div>
          <div className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary" title={subtitle}>
            {subtitle}
          </div>
        </div>
        {!busy && (
          <button
            type="button"
            onClick={() => setDismissed(key)}
            className="shrink-0 p-1 text-ink-secondary hover:bg-raised-hover hover:text-ink"
            title="Dismiss"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {s.status === "handed-off" && s.command && (
        <code className="mt-2.5 block overflow-x-auto border border-hairline bg-inset px-2 py-1.5 font-mono text-[11px] whitespace-pre text-ink-secondary">
          {s.command}
        </code>
      )}

      {s.status === "downloading" && (
        <div className="mt-2.5 h-1.5 overflow-hidden border border-hairline bg-inset">
          <div
            className={cn(
              "h-full bg-accent transition-[width]",
              // before the first progress report, a sliver that breathes beats
              // a zero-width bar that looks stalled
              s.percent == null && "w-1/4 animate-pulse",
            )}
            style={s.percent == null ? undefined : { width: `${Math.min(100, Math.max(0, s.percent))}%` }}
          />
        </div>
      )}

      {(preparing || installing) && (
        <div className="mt-2.5 flex gap-2">
          <Button
            disabled
            variant="secondary"
            size="sm"
            className="flex-1 text-ink-secondary"
          >
            <Loader2 size={13} className="animate-spin" /> {preparing ? "Preparing…" : handoff ? "Opening…" : "Restarting…"}
          </Button>
        </div>
      )}

      {!busy && (
        <div className="mt-2.5 flex gap-2">
          {s.status === "available" && (
            <Button
              onClick={() => {
                setPending("download");
                void updater.download();
              }}
              disabled={pending !== null}
              variant="primary"
              size="sm"
              className="flex-1"
            >
              {pending === "download" ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Starting…
                </>
              ) : (
                <>
                  <ArrowDownToLine size={13} /> Download
                </>
              )}
            </Button>
          )}
          {s.status === "downloaded" && (
            <Button
              onClick={() => {
                setPending("install");
                void updater.install();
              }}
              disabled={pending !== null}
              variant="primary"
              size="sm"
              className="flex-1"
            >
              {pending === "install" ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> {handoff ? "Opening…" : "Restarting…"}
                </>
              ) : handoff ? (
                <>
                  <PackageOpen size={13} /> Install
                </>
              ) : (
                <>
                  <RefreshCw size={13} /> Restart to update
                </>
              )}
            </Button>
          )}
          {s.status === "error" && s.retryable !== false && (
            <Button
              onClick={() => {
                setPending("check");
                void updater.check();
              }}
              disabled={pending !== null}
              variant="secondary"
              size="sm"
              className="flex-1"
            >
              {pending === "check" ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Checking…
                </>
              ) : (
                "Try again"
              )}
            </Button>
          )}
          <Button
            onClick={() => setDismissed(key)}
            disabled={pending !== null}
            variant="ghost"
            size="sm"
          >
            {/* after a hand-off there is nothing left to postpone */}
            {s.status === "handed-off" || s.retryable === false ? "Dismiss" : "Later"}
          </Button>
        </div>
      )}
    </div>
  );
}
