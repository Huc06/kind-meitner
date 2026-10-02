import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, EllipsisVertical, Globe, Hand, Loader2, Maximize2, Plus, RotateCw, UserRound, X } from "lucide-react";
import { browserUnavailableReason } from "@/lib/feature-flags";
import { api, useStore, type Bot } from "@/state/store";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Frame } from "@/components/ui/frame";
import { BrowserProfilesManager } from "./BrowserProfilesManager";
import { BrowserViewport, type BrowserFrame } from "./BrowserViewport";
import { createBrowserInputQueue } from "@/lib/browser-input-queue";

interface BrowserTab { tabId: string; title: string; url: string; active: boolean }
type ViewerFrame = BrowserFrame & { viewerId: string; generation: number };
/** Closing a panel releases its lease. A new connection never silently
 * restores permission to type, and never replays old browser frames. */
export function LiveBrowser({ bot }: { bot: Bot }) {
  const { state } = useStore();
  const [attempt, setAttempt] = useState(0);
  const [frame, setFrame] = useState<ViewerFrame | null>(null);
  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [address, setAddress] = useState("");
  const [connected, setConnected] = useState(false);
  const [control, setControl] = useState({ held: false, controlling: false, owned: false });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [showProfiles, setShowProfiles] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [viewport, setViewport] = useState({ width: 1280, height: 720 });
  const viewer = useRef("");
  const generation = useRef(0);
  const pendingOperation = useRef<number | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const addressInput = useRef<HTMLInputElement>(null);
  const profilesDialog = useRef<HTMLDialogElement>(null);
  const typingDialog = useRef<HTMLDialogElement>(null);
  const inputQueue = useRef<ReturnType<typeof createBrowserInputQueue> | null>(null);
  const urlEditing = useRef(false);
  const profileName = bot.browserProfile === "guest" ? "Temporary browser"
    : state.config?.browserProfiles?.find((profile) => profile.id === bot.browserProfile)?.name ?? `${bot.name}’s own browser`;
  useEffect(() => { if (showProfiles) profilesDialog.current?.showModal(); else profilesDialog.current?.close(); }, [showProfiles]);
  useEffect(() => { if (showTyping) typingDialog.current?.showModal(); else typingDialog.current?.close(); }, [showTyping]);

  const action = useCallback(async (body: Record<string, unknown>, expected = viewer.current) => {
    if (!expected) throw new Error("Open the browser connection first.");
    return api(`/api/bots/${bot.id}/browser/action`, { method: "POST", body: JSON.stringify({ ...body, viewerId: expected }) });
  }, [bot.id]);
  const input = useCallback((body: Record<string, unknown>) => {
    inputQueue.current?.enqueue(body);
  }, []);
  const reconnect = useCallback(() => {
    // Invalidate synchronously: an old request may finish before React runs
    // the effect cleanup for this reconnect.
    generation.current++;
    viewer.current = "";
    inputQueue.current?.clear(); inputQueue.current = null;
    pendingOperation.current = null;
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const current = ++generation.current;
    const ownsConnection = () => generation.current === current;
    let stopped = false;
    viewer.current = ""; pendingOperation.current = null;
    setFrame(null); setTabs([]); setAddress(""); setConnected(false); setError("");
    setControl({ held: false, controlling: false, owned: false }); setPending(false);
    const source = new EventSource(`/api/bots/${bot.id}/browser/live`);
    const listen = (name: string, handler: (data: any) => void) => source.addEventListener(name, (event) => {
      if (stopped || !ownsConnection()) return;
      try { handler(JSON.parse((event as MessageEvent).data)); } catch { /* Malformed events are not rendered. */ }
    });
    listen("ready", (data) => {
      const expected = String(data.viewerId);
      viewer.current = expected;
      inputQueue.current = createBrowserInputQueue(async (body) => {
        if (ownsConnection() && viewer.current === expected) await action(body, expected);
      }, (cause) => { if (ownsConnection() && viewer.current === expected) setError(cause instanceof Error ? cause.message : String(cause)); });
      setConnected(true);
    });
    listen("frame", (data) => { if (viewer.current) setFrame({ ...data, viewerId: viewer.current, generation: current }); });
    listen("tabs", (data) => {
      setTabs(data.tabs);
      const active = data.tabs.find((tab: BrowserTab) => tab.active);
      if (active && !urlEditing.current) setAddress(active.url === "about:blank" ? "" : active.url);
    });
    listen("url", (data) => { if (!urlEditing.current) setAddress(data.url === "about:blank" ? "" : data.url); });
    listen("status", (data) => {
      if (data.viewportWidth > 0 && data.viewportHeight > 0) setViewport({ width: data.viewportWidth, height: data.viewportHeight });
    });
    listen("control", (data) => {
      setControl(data);
      if (data.held && !data.controlling) { setFrame(null); setTabs([]); setAddress(""); }
    });
    source.addEventListener("error", (event) => {
      // A closed source may still deliver its queued error after a profile
      // switch or reconnect. It must not clear the replacement viewer/input.
      if (stopped || !ownsConnection()) return;
      stopped = true;
      let message = "Browser connection ended. Reconnect to continue watching.";
      if (event instanceof MessageEvent) { try { message = JSON.parse(event.data).message || message; } catch { /* Network error fallback. */ } }
      setError(message); setConnected(false); setFrame(null); setControl({ held: false, controlling: false, owned: false });
      // Keep this generation alive: a successful restart closes its stream
      // before the action reply arrives, and must still reconnect afterward.
      viewer.current = ""; inputQueue.current?.clear(); inputQueue.current = null; source.close();
    });
    return () => {
      stopped = true;
      if (ownsConnection()) {
        generation.current++; viewer.current = ""; pendingOperation.current = null;
        inputQueue.current?.clear(); inputQueue.current = null;
      }
      source.close();
    };
  }, [bot.id, bot.browserProfile, attempt, action]);

  const execute = async (body: Record<string, unknown>) => {
    if (pendingOperation.current !== null) return;
    const expected = viewer.current;
    const current = generation.current;
    const queue = inputQueue.current;
    pendingOperation.current = current;
    setPending(true); setError("");
    try {
      await queue?.drain();
      if (generation.current !== current || viewer.current !== expected) return;
      await action(body, expected);
      if (generation.current === current && body.type === "restart") reconnect();
    }
    catch (cause) { if (generation.current === current) setError(cause instanceof Error ? cause.message : String(cause)); }
    finally {
      if (generation.current === current && pendingOperation.current === current) {
        pendingOperation.current = null; setPending(false);
      }
    }
  };
  const driving = control.controlling && connected && !pending;
  return (
    <div ref={panel} className="flex min-h-0 flex-1 flex-col border border-hairline bg-panel text-ink">
      <div className="flex min-h-10 items-center gap-1 frame-rule-below bg-app px-2 py-1">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {tabs.length ? (
            tabs.map((tab) => (
              <div
                key={tab.tabId}
                data-active={tab.active ? "" : undefined}
                className={cn(
                  "nav-link flex max-w-52 shrink-0 items-center gap-1 px-2 py-1 font-mono text-[11px]",
                  tab.active ? "bg-raised text-ink" : "text-ink-secondary hover:text-ink",
                )}
              >
                <Globe size={12} className="shrink-0 opacity-70" />
                <button
                  className="truncate text-left disabled:cursor-default"
                  disabled={!driving}
                  onClick={() => void execute({ type: "tab-select", tabId: tab.tabId })}
                  title={tab.title || tab.url}
                >
                  {tab.title || "New tab"}
                </button>
                <button
                  className="p-0.5 text-ink-secondary hover:bg-raised-hover hover:text-ink disabled:opacity-40"
                  aria-label={`Close ${tab.title || "tab"}`}
                  disabled={!driving}
                  onClick={() => void execute({ type: "tab-close", tabId: tab.tabId })}
                >
                  <X size={12} />
                </button>
              </div>
            ))
          ) : (
            <div className="nav-link flex items-center gap-1.5 px-2 py-1 font-mono text-[11px] text-ink-secondary" data-active="">
              <Globe size={12} />New tab
            </div>
          )}
          <Button
            variant="ghost"
            icon
            size="xs"
            disabled={!driving}
            aria-label="New tab"
            title="New tab"
            onClick={() => void execute({ type: "tab-new" })}
          >
            <Plus size={14} />
          </Button>
        </div>
        <Button
          variant="ghost"
          icon
          size="xs"
          title="Full screen"
          aria-label="Full screen"
          onClick={() => { void panel.current?.requestFullscreen().catch(() => setError("Full screen is unavailable in this browser.")); }}
        >
          <Maximize2 size={13} />
        </Button>
        <Button
          variant="ghost"
          icon
          size="xs"
          title={`Browser profile: ${profileName}`}
          aria-label="Browser profiles"
          aria-expanded={showProfiles}
          onClick={() => setShowProfiles(true)}
        >
          <UserRound size={13} />
        </Button>
      </div>
      <form className="flex h-11 items-center gap-1.5 frame-rule-below bg-app px-2" onSubmit={(e) => { e.preventDefault(); if (driving && address.trim()) void execute({ type: "navigate", url: /^https?:\/\//i.test(address.trim()) ? address.trim() : `https://${address.trim()}` }); }}>
        <div className="flex shrink-0 items-center">
          <Button type="button" variant="ghost" icon size="xs" disabled={!driving} aria-label="Back" onClick={() => void execute({ type: "back" })}><ArrowLeft size={14} /></Button>
          <Button type="button" variant="ghost" icon size="xs" disabled={!driving} aria-label="Forward" onClick={() => void execute({ type: "forward" })}><ArrowRight size={14} /></Button>
          <Button type="button" variant="ghost" icon size="xs" disabled={!driving} aria-label="Reload page" onClick={() => void execute({ type: "reload" })}><RotateCw size={14} /></Button>
        </div>
        <input
          ref={addressInput}
          aria-label="Browser address"
          readOnly={!driving}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onFocus={(e) => { urlEditing.current = true; if (driving) e.target.select(); }}
          onBlur={() => { urlEditing.current = false; }}
          placeholder={connected ? "about:blank" : "Connecting…"}
          spellCheck={false}
          className="mx-1 h-7 min-w-0 flex-1 border border-hairline bg-inset px-2.5 font-mono text-[11px] text-ink outline-none placeholder:text-ink-secondary focus:border-ink"
        />
        <Button
          type="button"
          variant={control.owned ? "secondary" : "primary"}
          size="sm"
          disabled={!connected || pending || (control.held && !control.owned)}
          onClick={() => void execute({ type: control.owned ? "release" : "take" })}
          title={control.owned ? "Return to bot — browser tools are paused while you control this profile" : control.held ? "This profile is controlled in another window" : "Take control to click, type, or sign in"}
          aria-label={control.owned ? "Return to bot" : "Take control"}
          aria-pressed={control.owned}
          className="shrink-0"
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Hand size={13} className="hidden sm:block" />}
          <span>{control.owned ? "Return to bot" : "Take control"}</span>
        </Button>
        <details className="relative shrink-0">
          <summary className="inline-flex size-7 cursor-pointer list-none items-center justify-center border border-transparent text-ink-secondary hover:bg-raised-hover hover:text-ink [&::-webkit-details-marker]:hidden" aria-label="Browser menu" title="Browser menu"><EllipsisVertical size={14} /></summary>
          <div className="absolute right-0 top-full z-20 mt-1 flex w-44 flex-col border border-hairline bg-menu p-1 text-[12px] shadow-[0_16px_40px_-16px_rgb(0_0_0/0.6)]">
            <button type="button" className="h-8 px-2.5 text-left text-[13px] hover:bg-raised-hover disabled:opacity-40" disabled={!driving} onClick={(e) => { e.currentTarget.closest("details")?.removeAttribute("open"); setShowTyping(true); }}>Type or paste text…</button>
            <button type="button" className="h-8 px-2.5 text-left text-[13px] hover:bg-raised-hover" onClick={(e) => { e.currentTarget.closest("details")?.removeAttribute("open"); reconnect(); }}>Reconnect view</button>
            <button type="button" className="h-8 px-2.5 text-left text-[13px] hover:bg-raised-hover disabled:opacity-40" disabled={!connected || pending} onClick={(e) => {
              e.currentTarget.closest("details")?.removeAttribute("open");
              if (!window.confirm("Restart this profile’s browser? Open tabs will close. Saved logins are kept. Stop any bots using it first.")) return;
              void execute({ type: "restart" });
            }}>Restart browser…</button>
          </div>
        </details>
      </form>
      {error && (
        <div role="alert" className="flex items-center justify-between gap-2 border-b border-danger/40 bg-card px-3 py-2 text-[12px] text-danger">
          <div className="flex items-center gap-1.5">
            <span>{error}</span>
          </div>
          {!connected && (
            <Button variant="ghost" size="xs" onClick={reconnect}>
              Reconnect
            </Button>
          )}
        </div>
      )}
      <Frame surface="panel" corners className="min-h-0 flex-1 overflow-hidden bg-inset/40">
        {frame ? (
          <BrowserViewport
            frame={frame}
            {...viewport}
            driving={driving}
            input={input}
            onReturnToToolbar={() => addressInput.current?.focus()}
            acknowledge={(seq) => {
              if (generation.current === frame.generation && viewer.current === frame.viewerId)
                void action({ type: "ack", seq }, frame.viewerId).catch(() => {});
            }}
            onDecodeError={() => {
              if (generation.current === frame.generation && viewer.current === frame.viewerId)
                setError("A browser frame could not be decoded. Close and reopen the panel to reconnect.");
            }}
          />
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center text-ink-secondary">
            {connected && control.held ? (
              <Hand size={24} className="text-warning" />
            ) : error ? (
              <Globe size={24} className="text-ink-secondary" />
            ) : (
              <Loader2 size={24} className="animate-spin text-ink-secondary" />
            )}
            <span className="font-mono text-[12px] uppercase tracking-wider">
              {control.held
                ? "Live view paused for human control"
                : error
                  ? "Browser disconnected"
                  : "Opening the live browser…"}
            </span>
          </div>
        )}
      </Frame>
      <dialog ref={profilesDialog} onClose={() => setShowProfiles(false)} onClick={(e) => { if (e.target === e.currentTarget) setShowProfiles(false); }} className="m-auto max-h-[80vh] w-[min(420px,calc(100%-32px))] overflow-auto border border-hairline bg-card p-5 text-ink shadow-[0_16px_40px_-16px_rgb(0_0_0/0.6)] backdrop:bg-black/50">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="label-mono uppercase text-ink">Browser profiles</h2>
          <Button variant="ghost" icon size="xs" aria-label="Close browser profiles" onClick={() => setShowProfiles(false)}><X size={14} /></Button>
        </div>
        <BrowserProfilesManager bot={bot} disabled={pending || control.held} onProfileChanged={() => { setShowProfiles(false); reconnect(); }} />
      </dialog>
      <dialog ref={typingDialog} onClose={() => setShowTyping(false)} className="m-auto w-[min(420px,calc(100%-32px))] border border-hairline bg-card p-5 text-ink shadow-[0_16px_40px_-16px_rgb(0_0_0/0.6)] backdrop:bg-black/50">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="label-mono uppercase text-ink">Type into the selected page field</h2>
          <Button variant="ghost" icon size="xs" aria-label="Close typing" onClick={() => setShowTyping(false)}><X size={14} /></Button>
        </div>
        <form className="flex flex-col gap-3" onSubmit={(e) => {
          e.preventDefault(); const field = e.currentTarget.elements.namedItem("pageText") as HTMLInputElement;
          if (driving && field.value) { input({ type: "input_keyboard", eventType: "char", text: field.value }); field.value = ""; setShowTyping(false); }
        }}>
          <input name="pageText" aria-label="Text for the page" autoComplete="off" maxLength={4096} placeholder="Type or paste text" className="border border-hairline bg-inset px-3 py-2 font-mono text-[12px] text-ink outline-none focus:border-ink" />
          <Button variant="primary" size="sm" disabled={!driving} className="self-end">Type</Button>
        </form>
      </dialog>
    </div>
  );
}

export function BrowserPanel({ bot }: { bot: Bot }) {
  const { state } = useStore();
  const engine = state.config?.browserEngine;
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [admin, setAdmin] = useState<boolean | null>(null);
  useEffect(() => { let active = true; void api("/api/auth/session").then((session) => { if (active) setAdmin(session.scopes.includes("admin")); }).catch(() => { if (active) setAdmin(false); }); return () => { active = false; }; }, []);
  const installing = requested || engine?.installing === true;
  const install = async () => {
    setError(null); setRequested(true);
    try { await api("/api/browser-engine/install", { method: "POST" }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setRequested(false); }
  };
  if (admin === false) return <div className="p-5 text-[13px] text-ink-secondary">Only workspace administrators can view or control saved browser sessions.</div>;
  if (bot.browser === false) return <div className="p-5 text-[13px] text-ink-secondary">Enable the browser in this bot’s profile to use it.</div>;
  if (engine?.kind === "engine" && !installing && !engine.installError) return admin === null
    ? <div className="p-5 text-[13px] text-ink-secondary">Loading browser…</div>
    : <LiveBrowser key={bot.id} bot={bot} />;
  return (
    <div className="flex min-h-0 flex-1 flex-col items-start justify-center gap-3 border border-hairline bg-card p-5">
      <div className="label-mono uppercase text-ink">{engine?.kind === "engine" ? "Browser installation incomplete" : "Browser engine not installed"}</div>
      <p className="text-[13px] leading-relaxed text-ink-secondary">{engine?.kind === "engine" ? "agent-browser is installed, but Chrome setup has not finished. Retry the browser installation." : browserUnavailableReason(state.config)}</p>
      {engine?.installable || engine?.kind === "engine" ? (
        <Button type="button" variant="primary" size="md" onClick={() => void install()} disabled={installing || admin !== true}>
          {installing ? "Installing… (a one-time download of about 160 MB)" : engine?.kind === "engine" ? "Retry browser installation" : "Install the browser engine"}
        </Button>
      ) : null}
      {(engine?.installError || error) && <p role="alert" className="font-mono text-[12px] text-danger">{error ?? engine?.installError}</p>}
    </div>
  );
}
