// App settings, as a real modal with sections rather than one long panel.
// Per-bot settings (persona, model, computer) live in BotSettingsDialog — this
// is the stuff shared by every bot: who you are, your keys, and the
// machine your bots can borrow.
import { useEffect, useRef, useState } from "react";
import { KeyRound, Palette, Search, Terminal, User, X } from "lucide-react";
import { api, useStore, type AppSettingsSection, type ConfigStatus } from "@/state/store";
import { analyticsEnabled, setAnalyticsEnabled } from "@/lib/analytics";
import { showToolCallsEnabled } from "@/lib/feature-flags";
import { localeChoices, type LocaleKey } from "@/locales";
import { t } from "@/lib/i18n";
import { withTourReset } from "@/lib/guided-tour";
import { completionPatch } from "@/lib/onboarding";
import { ApiKeyRow } from "./ApiKeys";
import { useUpdaterState } from "@/lib/updater";
import { EnginesSettings } from "./EnginesSettings";
import { Card, SettingRow, Switch } from "./SettingsPrimitives";
import { shortcutLabel } from "./ShortcutHint";
import { SkinPicker } from "./SkinPicker";
import { RoomTurnTimeoutSettings } from "./RoomTurnTimeoutSettings";
import { ThreadConcurrencySettings } from "./ThreadConcurrencySettings";
import { cn } from "@/lib/cn";
import { setShowThreads, useShowThreads } from "@/lib/thread-preferences";

// `labelKey`, not a label: t() reads the active pack when it is called, so a
// label resolved here at module scope would freeze the language the app booted
// in. The English keywords stay untranslated — they are a search index, and a
// pack that omits them still matches what people type.
const SECTIONS: Array<{
  id: AppSettingsSection;
  labelKey: LocaleKey;
  icon: typeof User;
  keywords: string[];
}> = [
  { id: "general", labelKey: "settings.section.general", icon: User, keywords: ["profile", "name", "email", "analytics", "updates", "threads", "parallel", "concurrency"] },
  { id: "appearance", labelKey: "settings.section.appearance", icon: Palette, keywords: ["skin", "theme", "appearance", "tools", "tool calls", "threads", "show threads", "hide threads", "sidebar", "display"] },
  { id: "connections", labelKey: "settings.section.connections", icon: KeyRound, keywords: ["keys", "api", "anthropic", "xai"] },
  { id: "engines", labelKey: "settings.section.engines", icon: Terminal, keywords: ["models", "claude", "grok", "providers", "cli"] },
];

function sectionMatches(section: (typeof SECTIONS)[number], query: string): boolean {
  if (!query) return true;
  return [t(section.labelKey), ...section.keywords].some((part) => part.toLowerCase().includes(query));
}

/** Name + email, persisted to /api/config {profile} on blur. */
function ProfileFields() {
  const { state, dispatch } = useStore();
  const [name, setName] = useState(state.config?.profile?.name ?? "");
  const [email, setEmail] = useState(state.config?.profile?.email ?? "");
  useEffect(() => {
    setName(state.config?.profile?.name ?? "");
    setEmail(state.config?.profile?.email ?? "");
  }, [state.config?.profile?.name, state.config?.profile?.email]);

  const save = () => {
    void fetch("/api/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: { name: name.trim(), email: email.trim().toLowerCase() } }),
    })
      .then((r) => r.json())
      .then((config) => dispatch({ type: "configStatus", config }))
      .catch(() => {});
  };

  const inputClass =
    "w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[14px] text-ink placeholder:text-ink-secondary focus:border-hairline focus:outline-none";
  return (
    <div className="flex flex-col gap-3">
      <input aria-label={t("settings.profile.name")} value={name} onChange={(e) => setName(e.target.value)} onBlur={save} placeholder={t("settings.profile.name")} className={inputClass} />
      <input
        type="email"
        aria-label={t("phone.signIn.email")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={save}
        placeholder="you@example.com"
        className={inputClass}
      />
    </div>
  );
}

function UpdatesRow() {
  const s = useUpdaterState();
  if (!window.ogb?.updater) return null;
  const updater = window.ogb.updater;
  const label =
    s?.status === "checking"
      ? t("settings.updates.checking")
      : s?.status === "available"
        ? t("settings.updates.available", { version: s.version ?? "" })
        : s?.status === "downloading"
          ? s.percent == null
            ? t("settings.updates.startingDownload")
            : t("settings.updates.downloading", { percent: Math.round(s.percent) })
          : s?.status === "preparing"
            ? t("settings.updates.preparing")
            : s?.status === "downloaded"
              ? s.installMode === "handoff"
                ? t("settings.updates.readyInstall", { version: s.version ?? "" })
                : t("settings.updates.ready", { version: s.version ?? "" })
              : s?.status === "installing"
                ? s.message ||
                  (s.installMode === "handoff"
                    ? t("settings.updates.openingTerminal")
                    : t("settings.updates.restarting"))
                : s?.status === "handed-off"
                  ? t("settings.updates.handedOff")
                  : s?.status === "error"
                    ? t("settings.updates.failed", { message: s.message ?? t("settings.updates.unknownError") })
                    : t("settings.updates.latest");
  return (
    <SettingRow title={t("settings.updates.title")} subtitle={label}>
      <button
        onClick={() => {
          if (s?.status === "available") return void updater.download();
          if (s?.status === "downloaded") return void updater.install();
          void updater.check();
        }}
        disabled={
          s?.status === "checking" || s?.status === "downloading" || s?.status === "preparing" ||
          s?.status === "installing" || s?.retryable === false
        }
        className="ui-button"
      >
        {s?.retryable === false
          ? t("settings.updates.quitReopen")
          : s?.status === "available"
            ? t("settings.updates.download")
            : s?.status === "downloaded"
              ? s.installMode === "handoff"
                ? t("settings.updates.install")
                : t("settings.updates.restart")
              : s?.status === "preparing"
                ? t("settings.updates.preparingShort")
                : s?.status === "installing"
                  ? s.installMode === "handoff"
                    ? t("settings.updates.opening")
                    : t("settings.updates.restartingShort")
                  : t("settings.updates.check")}
      </button>
    </SettingRow>
  );
}

/** Usage analytics, on by default and switchable here. Naming what is sent
 * matters more than the switch: people who cannot see the scope assume the
 * worst, and the worst — conversation text — is exactly what this never
 * sends (autocapture is off; see lib/analytics.ts). */
function AnalyticsRow() {
  const [on, setOn] = useState(analyticsEnabled);
  return (
    <SettingRow title={t("settings.analytics.title")} subtitle={t("settings.analytics.subtitle")}>
      <Switch
        checked={on}
        aria-label={t("settings.analytics.aria")}
        onClick={() => {
          const next = !on;
          setAnalyticsEnabled(next);
          setOn(next);
        }}
      />
    </SettingRow>
  );
}

/** Clears the tour's steps and opens it again on the live interface. */
function ReplayAppTourButton() {
  const { state, dispatch } = useStore();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div>
      <button
        disabled={saving}
        onClick={() => {
          setSaving(true);
          setFailed(false);
          void api("/api/config", {
            method: "PUT",
            body: JSON.stringify({ onboarding: {
              // Upgraded users may have completed only the legacy browser gate.
              ...(!state.config?.onboarding?.completedAt ? completionPatch().onboarding : {}),
              hintsSeen: withTourReset(state.config?.onboarding),
            } }),
            signal: AbortSignal.timeout(10_000),
          })
            .then((config) => {
              dispatch({ type: "configStatus", config });
              dispatch({ type: "toggleTour", open: true });
            })
            .catch(() => setFailed(true))
            .finally(() => setSaving(false));
        }}
        className="ui-button"
      >
        {t("settings.welcome.appTour")}
      </button>
      {failed && <p role="alert" className="mt-2 text-[13px] text-danger">{t("onboarding.tour.error")}</p>}
    </div>
  );
}

function ReplayTourRow() {
  const { dispatch } = useStore();
  return (
    <SettingRow title={t("settings.welcome.title")} subtitle={t("settings.welcome.subtitle")}>
      <div className="flex flex-wrap gap-2">
        <ReplayAppTourButton />
        <button
          onClick={() => dispatch({ type: "toggleWelcome", open: true })}
          className="ui-button"
        >
          {t("settings.welcome.replay")}
        </button>
      </div>
    </SettingRow>
  );
}

function LanguageRow() {
  const { state, dispatch } = useStore();
  const current = state.config?.language ?? "";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async (language: string) => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const config: ConfigStatus = await api("/api/config", {
        method: "PATCH",
        body: JSON.stringify({ language }),
      });
      dispatch({ type: "configStatus", config });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("settings.language.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingRow
      title={t("settings.language.title")}
      subtitle={t("settings.language.subtitle")}
      message={error ? <p role="alert" className="text-danger">{error}</p> : null}
    >
      <select
        value={current}
        disabled={saving}
        aria-label={t("settings.language.aria")}
        onChange={(event) => void save(event.target.value)}
        className="min-h-8 w-full max-w-[240px] rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-[13px] text-ink focus:border-focus disabled:cursor-wait disabled:opacity-50"
      >
        <option value="">{t("settings.language.system")}</option>
        {localeChoices.map(({ code, label }) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
    </SettingRow>
  );
}

function ShowThreadsRow() {
  const enabled = useShowThreads();
  return (
    <SettingRow title={t("settings.threadDisplay.title")} subtitle={t("settings.threadDisplay.subtitle")}>
      <Switch
        checked={enabled}
        aria-label={t("settings.threadDisplay.show")}
        onClick={() => setShowThreads(!enabled)}
      />
    </SettingRow>
  );
}

function ToolCallsRow() {
  const { state, dispatch } = useStore();
  const enabled = showToolCallsEnabled(state.config);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggle = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const config: ConfigStatus = await api("/api/config", {
        method: "PATCH",
        body: JSON.stringify({ features: { showToolCalls: !enabled } }),
      });
      dispatch({ type: "configStatus", config });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("settings.toolCalls.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingRow
      title={t("settings.toolCalls.title")}
      subtitle={<>{t("settings.toolCalls.subtitle")} {t("settings.toolCalls.detail")}</>}
      message={error ? <p role="alert" className="text-danger">{error}</p> : null}
    >
      <Switch
        checked={enabled}
        aria-label={t("settings.toolCalls.aria")}
        disabled={saving}
        onClick={() => void toggle()}
        className="disabled:cursor-wait disabled:opacity-50"
      />
    </SettingRow>
  );
}

/** Writes a redacted diagnostics file to a location the user picks. The
 * report holds versions, configured-or-not booleans and the server.log tail —
 * never credential values (the desktop shell does not read secret fields). */
function DiagnosticsRow() {
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const exportDiagnostics = async () => {
    if (!window.ogb?.exportDiagnostics || exporting) return;
    setExporting(true);
    setResult(null);
    try {
      const path = await window.ogb.exportDiagnostics();
      if (path) setResult({ kind: "success", message: t("settings.diagnostics.saved", { path }) });
    } catch (e) {
      setResult({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setExporting(false);
    }
  };

  return (
    <SettingRow
      title={t("settings.diagnostics.title")}
      subtitle={t("settings.diagnostics.subtitle")}
      message={result ? (
        <p role={result.kind === "error" ? "alert" : "status"} className={cn("break-all", result.kind === "error" ? "text-danger" : "text-success")}>
          {result.message}
        </p>
      ) : null}
    >
      <button
        onClick={() => void exportDiagnostics()}
        disabled={exporting}
        aria-label={t("settings.diagnostics.aria")}
        className="ui-button"
      >
        {exporting ? t("settings.diagnostics.exporting") : t("settings.diagnostics.export")}
      </button>
    </SettingRow>
  );
}

export function SettingsModal() {
  const { state, dispatch } = useStore();
  const remoteActive = window.ogb?.remoteClient?.active === true;
  const section: AppSettingsSection = state.appSettingsSection;
  const dialogRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  useEffect(() => window.ogb?.environments?.onOpenSettings?.(() => setQuery("")), []);
  const q = query.trim().toLowerCase();
  const availableSections = SECTIONS;
  const visibleSections = availableSections.filter((entry) => sectionMatches(entry, q));
  const sectionLabelKey = SECTIONS.find((entry) => entry.id === section)?.labelKey;
  const nextVisibleSection = visibleSections.some((entry) => entry.id === section) ? undefined : visibleSections[0]?.id;

  useEffect(() => {
    // Translated matches can change without the query changing. Follow the
    // rendered results instead of a second filter with stale effect inputs.
    if (nextVisibleSection) dispatch({ type: "toggleAppSettings", open: true, section: nextVisibleSection });
  }, [dispatch, nextVisibleSection]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const search = dialog?.querySelector<HTMLInputElement>("[data-settings-search]");
    if (search?.checkVisibility()) search.focus();
    else dialog?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dispatch({ type: "toggleAppSettings", open: false });
        return;
      }
      if (event.key !== "Tab" || !dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.checkVisibility());
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [dispatch]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && dispatch({ type: "toggleAppSettings", open: false })}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-settings-title"
        tabIndex={-1}
        className={cn("flex max-h-[calc(100dvh-24px)] w-full overflow-hidden rounded-2xl border border-hairline/50 bg-panel shadow-2xl outline-none", section === "engines" ? "h-[720px] max-w-[1040px]" : "h-[560px] max-w-[860px]")}
      >
        {/* section nav */}
        <span id="app-settings-title" className="sr-only">{t("settings.title")}</span>
        <nav className="hidden min-h-0 w-[190px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-hairline/40 bg-app/30 p-3 sm:flex">
          <div className="shrink-0 px-2 py-3 text-[15px] font-semibold text-ink">
            {t("settings.title")}
          </div>
          <div className="mb-2 mt-1 flex min-h-8 shrink-0 items-center gap-2 rounded-lg border border-transparent bg-control/70 px-2.5 py-2 focus-within:border-focus">
            <Search size={14} className="shrink-0 text-ink-secondary" />
            <input
              data-settings-search
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Escape") return;
                e.stopPropagation();
                if (query) setQuery("");
                else dispatch({ type: "toggleAppSettings", open: false });
              }}
              placeholder={t("settings.search")}
              aria-label={t("settings.searchAria")}
              className="w-full bg-transparent text-[13px] text-ink placeholder:text-ink-secondary focus:outline-none"
            />
          </div>
          {visibleSections.length === 0 && (
            <div className="px-2.5 py-4 text-[12.5px] leading-relaxed text-ink-secondary">
              {t("settings.noMatch", { query: query.trim() })}
            </div>
          )}
          {visibleSections.map(({ id, labelKey, icon: Icon }) => (
            <button
              key={id}
              onClick={() => dispatch({ type: "toggleAppSettings", open: true, section: id })}
              aria-current={section === id ? "page" : undefined}
              className={cn(
                "flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors motion-reduce:transition-none",
                section === id ? "bg-control text-ink" : "text-ink-secondary hover:bg-control/50 hover:text-ink",
              )}
            >
              <Icon size={15} className="shrink-0" />
              {t(labelKey)}
            </button>
          ))}
        </nav>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline/30 px-3 py-3 sm:px-5">
            <select
              aria-label={t("settings.title")}
              value={section}
              onChange={(event) => {
                setQuery("");
                dispatch({ type: "toggleAppSettings", open: true, section: event.target.value as AppSettingsSection });
              }}
              className="min-w-0 rounded-lg bg-control px-3 py-2 text-[14px] text-ink sm:hidden"
            >
              {availableSections.map(({ id, labelKey }) => (
                <option key={id} value={id}>{t(labelKey)}</option>
              ))}
            </select>
            <span className="hidden text-[15px] font-semibold text-ink sm:block">
              {sectionLabelKey ? t(sectionLabelKey) : null}
            </span>
            <button
              onClick={() => dispatch({ type: "toggleAppSettings", open: false })}
              aria-label={t("settings.close")}
              title={`${t("settings.close")} (${shortcutLabel("close-panel")})`}
              className="ui-icon-button shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4 sm:px-5 sm:pb-5">
            {section === "general" && (
              <>
                <Card title={t("settings.profile.title")} subtitle={t("settings.profile.subtitle")}>
                  <ProfileFields />
                </Card>
                <div>
                  <LanguageRow />
                  <AnalyticsRow />
                </div>
                <Card title={t("settings.roomTurns.title")} subtitle={t("settings.roomTurns.subtitle")}>
                  <RoomTurnTimeoutSettings />
                </Card>
                <ThreadConcurrencySettings />
                <div>
                  {!remoteActive && <ReplayTourRow />}
                  <UpdatesRow />
                  <DiagnosticsRow />
                </div>
              </>
            )}

            {section === "appearance" && (
              <>
                <Card title={t("settings.skin.title")} subtitle={t("settings.skin.subtitle")}>
                  <SkinPicker />
                </Card>
                <div>
                  <ShowThreadsRow />
                  {!remoteActive && <ToolCallsRow />}
                </div>
              </>
            )}

            {section === "connections" && (
              <Card
                title={t("settings.connections.title")}
                subtitle={t("settings.connections.subtitle")}
              >
                <div className="flex flex-col gap-4">
                  <div className="text-[11.5px] font-medium uppercase tracking-wide text-ink-secondary">{t("keys.providers.title")}</div>
                  <p className="-mt-3 text-[12px] leading-relaxed text-ink-secondary">{t("keys.providers.subtitle")}</p>
                  <ApiKeyRow section="anthropic" testProvider="anthropic" />
                  <ApiKeyRow section="xai" testProvider="xai" />
                </div>
              </Card>
            )}

            {section === "engines" && (
              <EnginesSettings />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
