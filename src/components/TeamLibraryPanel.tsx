import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { teamImportPreview, type PendingTeamImport } from "@/lib/team-import";
import type { Routine } from "@/lib/routines";
import { api, useStore, type Bot, type Group } from "@/state/store";
import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  Check,
  Compass,
  Crown,
  ExternalLink,
  FolderOpen,
  Github,
  Loader2,
  MessageSquare,
  Plug,
  Search,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

import { MAX_TEAM_BACKUP_BYTES, TEAM_BACKUP_EXCLUSIONS } from "../../shared/team-backup";
import { takeImportName } from "../../shared/import-name";
const COMMUNITY_TEAMS_REPOSITORY = "https://github.com/harrymove-ctrl/kind-meitner-teams";
interface TeamCatalogEntry {
  slug: string;
  name: string;
  summary: string;
  category: string;
  outcome?: string;
  setupMinutes?: number;
  featured?: boolean;
  package?: string;
  manifest: string;
  readme: string;
  members: number;
  skills: string[];
  requires: { apps: string[] };
}

interface TeamCatalog {
  repositoryUrl: string;
  teams: TeamCatalogEntry[];
}

export interface TeamImportResult {
  name: string;
  members: number;
}

type ImportSource = "library" | "file" | "github";
type TeamTab = "explore" | "import" | "scout";

/** the scout endpoint's answer, as far as this panel renders it — the
 * manifest itself stays opaque and goes back to the server verbatim */
interface ScoutResult {
  profile: { name: string; summary: string; stacks: string[] };
  suggestion: {
    roomName: string;
    manifest: {
      team: { members: Array<{ key: string; name: string; title: string; description: string; appearance: { color: string } }> };
    };
    reasons: Record<string, string>;
  };
}

interface DirectoryCandidate {
  slug: string;
  name: string;
  category: string;
  integrations: string[];
  prompt: string;
  detailUrl: string;
  matched: string[];
}

/** appearance colors for community bots folded into a scouted team */
const DIRECTORY_COLORS = ["cyan", "red", "purple", "green", "orange"] as const;

const TEAM_GLYPHS = [
  "border border-tile-violet/40 bg-tile-violet/15 text-tile-violet",
  "border border-tile-cyan/40 bg-tile-cyan/15 text-tile-cyan",
  "border border-tile-orange/40 bg-tile-orange/15 text-tile-orange",
  "border border-tile-green/40 bg-tile-green/15 text-tile-green",
] as const;

async function openExternal(url: string): Promise<void> {
  if (window.ogb?.openExternal) {
    await window.ogb.openExternal(url);
    return;
  }
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (opened) opened.opener = null;
}

function TeamGlyph({ index }: { index: number }) {
  return (
    <div className={cn("flex size-10 shrink-0 items-center justify-center border", TEAM_GLYPHS[index % TEAM_GLYPHS.length])}>
      <Users size={18} />
    </div>
  );
}

export function TeamLibraryPanel({
  onClose,
  onImported,
  returnFocusRef,
  initialUrl,
}: {
  onClose: () => void;
  onImported: (result: TeamImportResult) => void;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
  initialUrl?: string;
}) {
  const { state, dispatch } = useStore();
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<TeamTab>("explore");
  const [catalog, setCatalog] = useState<TeamCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingTeamImport | null>(null);
  const [source, setSource] = useState<ImportSource>("file");
  const [githubUrl, setGithubUrl] = useState("");
  const [githubLoading, setGithubLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [scoutFolder, setScoutFolder] = useState("");
  const [scouting, setScouting] = useState(false);
  const [scouted, setScouted] = useState<ScoutResult | null>(null);
  // the folder the current `scouted` result was actually read from — the
  // import must pin the room to THIS, not to whatever the input says now
  const [scoutedFolder, setScoutedFolder] = useState("");
  // null = not asked yet or still loading; [] = asked, nothing (or offline)
  const [directory, setDirectory] = useState<DirectoryCandidate[] | null>(null);
  const [pickedDirectory, setPickedDirectory] = useState<Set<string>>(new Set());
  const [roomName, setRoomName] = useState("");
  const [creating, setCreating] = useState(false);
  // monotonically increasing scout token: a late response from an older
  // scout (including its lazy directory call) must never overwrite state
  // that belongs to a newer one
  const scoutRequest = useRef(0);

  const currentBotCount = state.bots.filter((bot) => !bot.hidden).length;
  const takenNames = new Set(state.bots.map((bot) => bot.name.trim().toLowerCase()));
  const importedNames = pending?.members.map((member) => takeImportName(member.name, takenNames)) ?? [];

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError("");
    try {
      // SAFETY: this endpoint is owned by the app and returns TeamCatalog.
      setCatalog((await api("/api/team-library/catalog")) as TeamCatalog);
    } catch (cause) {
      setCatalogError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    dialogRef.current?.focus();
    return () => returnFocusRef.current?.focus();
  }, [returnFocusRef]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !importing) {
        event.preventDefault();
        event.stopPropagation();
        if (pending) setPending(null);
        else onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      const items = Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (!dialog || items.length === 0) return;
      const first = items[0]!;
      const last = items.at(-1)!;
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [importing, onClose, pending]);

  const previewManifest = (preview: PendingTeamImport, nextSource: ImportSource) => {
    setPending(preview);
    setSource(nextSource);
    setError("");
  };

  const readFile = async (file: File) => {
    if (file.size > MAX_TEAM_BACKUP_BYTES) throw new Error("That file exceeds the 50 MB import limit.");
    const raw = await file.text();
    let manifest: unknown = raw;
    if (!file.name.toLowerCase().endsWith(".md")) {
      try {
        manifest = JSON.parse(raw);
      } catch (cause) {
        if (cause instanceof SyntaxError) throw new Error("That backup or team file is not valid JSON.");
        throw cause;
      }
    }
    previewManifest(teamImportPreview(manifest), "file");
  };

  const loadLibraryTeam = async (entry: TeamCatalogEntry) => {
    setBusySlug(entry.slug);
    setError("");
    try {
      previewManifest(teamImportPreview(await api(`/api/team-library/teams/${entry.slug}`)), "library");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusySlug(null);
    }
  };

  const loadGithubTeam = async () => {
    await loadGithubUrl(githubUrl);
  };

  const loadGithubUrl = async (requestedUrl: string) => {
    if (!requestedUrl.trim()) return;
    setGithubLoading(true);
    setError("");
    try {
      const manifest = await api("/api/team-library/github", {
        method: "POST",
        body: JSON.stringify({ url: requestedUrl.trim() }),
      });
      previewManifest(teamImportPreview(manifest), "github");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setGithubLoading(false);
    }
  };

  useEffect(() => {
    if (!initialUrl) return;
    setTab("import");
    setGithubUrl(initialUrl);
    void loadGithubUrl(initialUrl);
    // A deep link is immutable for this panel instance; reloading it on
    // every callback identity change would duplicate the preview request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl]);

  const importTeam = async () => {
    if (!pending) return;
    setImporting(true);
    setError("");
    try {
      // SAFETY: this endpoint is owned by the app and returns imported bots.
      const response = (await api("/api/teams/import?mode=add", {
        method: "POST",
        body: JSON.stringify(pending.manifest),
      })) as {
        bots: Bot[];
        groups?: Group[];
        routines?: Routine[];
      };
      for (const bot of response.bots) dispatch({ type: "botAdded", bot });
      for (const group of response.groups ?? []) dispatch({ type: "groupPatched", group });
      for (const routine of response.routines ?? []) dispatch({ type: "routinePatched", routine });
      const first = response.bots.find((bot) => !bot.hidden);
      if (first) dispatch({ type: "select", id: first.id });
      track("team_imported", { members: response.bots.length, source, mode: "add", format: pending.kind });
      onImported({
        name: pending.name,
        members: response.bots.length,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setImporting(false);
    }
  };

  const scoutTarget = scoutFolder.trim();

  const runScout = async (folder: string) => {
    const request = ++scoutRequest.current;
    setScouting(true);
    setError("");
    setScouted(null);
    setDirectory(null);
    setPickedDirectory(new Set());
    try {
      // SAFETY: this endpoint is owned by the app and returns ScoutResult.
      const result = (await api(`/api/teams/scout?cwd=${encodeURIComponent(folder)}`)) as ScoutResult;
      if (request !== scoutRequest.current) return;
      setScouted(result);
      setScoutedFolder(folder);
      setRoomName(result.suggestion.roomName);
      track("team_scouted", { signals: result.suggestion.manifest.team.members.length - 1 });
      // community candidates arrive lazily; an unreachable directory just
      // leaves this section empty
      void api(`/api/teams/scout/directory?cwd=${encodeURIComponent(folder)}`)
        // SAFETY: this endpoint is owned by the app and returns candidates.
        .then((extra) => {
          if (request === scoutRequest.current) setDirectory((extra as { directory: DirectoryCandidate[] }).directory);
        })
        .catch(() => {
          if (request === scoutRequest.current) setDirectory([]);
        });
    } catch (cause) {
      if (request !== scoutRequest.current) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (request === scoutRequest.current) setScouting(false);
    }
  };

  const pickScoutFolder = async () => {
    const chosen = await window.ogb?.pickFolder?.(scoutTarget || undefined);
    if (!chosen) return;
    setScoutFolder(chosen);
    await runScout(chosen);
  };

  const createProject = async () => {
    if (!scouted || creating) return;
    setCreating(true);
    setError("");
    try {
      // the confirmed suggestion, plus any community bots the user ticked —
      // folded in as ordinary manifest members so the import boundary
      // (persona only, no grants) applies to them like to everything else
      const extras = (directory ?? [])
        .filter((candidate) => pickedDirectory.has(candidate.slug))
        .map((candidate, index) => ({
          key: `dir-${candidate.slug}`,
          name: candidate.name,
          title: candidate.category || "Community bot",
          description: candidate.prompt,
          appearance: { color: DIRECTORY_COLORS[index % DIRECTORY_COLORS.length] },
        }));
      const manifest = {
        ...scouted.suggestion.manifest,
        team: {
          ...scouted.suggestion.manifest.team,
          members: [...scouted.suggestion.manifest.team.members, ...extras],
        },
      };
      const room = roomName.trim() || scouted.suggestion.roomName;
      // SAFETY: this endpoint is owned by the app and returns imported bots.
      const response = (await api(
        `/api/teams/import?mode=project&cwd=${encodeURIComponent(scoutedFolder)}&room=${encodeURIComponent(room)}`,
        { method: "POST", body: JSON.stringify(manifest) },
      )) as { bots: Bot[]; group?: Group };
      for (const bot of response.bots) dispatch({ type: "botAdded", bot });
      if (response.group) {
        // upsert now instead of waiting for the SSE frame, then land in the room
        dispatch({ type: "groupPatched", group: { ...response.group, messages: [] } });
        dispatch({ type: "select", id: response.group.id });
      }
      track("team_imported", { members: response.bots.length, source: "scout", mode: "project" });
      onImported({
        name: room,
        members: response.bots.length,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setCreating(false);
    }
  };

  const normalizedSearch = search.trim().toLowerCase();
  const visibleTeams = (catalog?.teams ?? []).filter((entry) => {
    if (!normalizedSearch) return true;
    return `${entry.name} ${entry.summary} ${entry.category} ${entry.skills.join(" ")} ${entry.requires.apps.join(" ")}`
      .toLowerCase()
      .includes(normalizedSearch);
  });

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6"
      onMouseDown={(event) => event.target === event.currentTarget && !importing && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-library-title"
        tabIndex={-1}
        className="animate-pop-in flex h-[min(780px,calc(100dvh-2rem))] w-full max-w-[1040px] flex-col overflow-hidden border border-hairline bg-panel shadow-2xl outline-none"
      >
        <header className="flex items-start justify-between gap-4 frame-rule-below px-6 pb-3 pt-5 sm:px-8 sm:pt-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {pending && (
                <button
                  onClick={() => {
                    setPending(null);
                    setError("");
                  }}
                  disabled={importing}
                  className="p-1.5 text-ink-secondary hover:text-ink disabled:opacity-50"
                  aria-label="Back to templates"
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <h2 id="team-library-title" className="label-mono truncate text-[14px] font-semibold text-ink">
                [ {pending ? pending.name.toUpperCase() : "TEMPLATES"} ]
              </h2>
            </div>
            <p className={cn("mt-1 text-[12px] text-ink-secondary", pending && "ml-9")}>
                {pending
                  ? pending.kind === "backup"
                    ? `${pending.members.length} ${pending.members.length === 1 ? "bot" : "bots"} · ${pending.conversations} ${pending.conversations === 1 ? "conversation" : "conversations"} · portable backup`
                    : pending.kind === "package"
                    ? `${pending.members.length} bots · portable Markdown playbook`
                    : `${pending.members.length} ready-to-load bots`
                  : "Start with a complete playbook or bring your own."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!pending && (
              <button
                onClick={() => void openExternal(catalog?.repositoryUrl ?? COMMUNITY_TEAMS_REPOSITORY)}
                className="flex items-center gap-1.5 border border-hairline bg-inset px-2.5 py-1.5 font-mono text-[11px] text-ink-secondary hover:border-ink hover:text-ink"
                title="Open the community templates repository"
              >
                <Github size={14} />
                <span className="max-sm:hidden">Community repo</span>
                <ExternalLink size={11} />
              </button>
            )}
            <button
              onClick={onClose}
              disabled={importing}
              className="p-1.5 text-ink-secondary hover:text-ink disabled:opacity-50"
              aria-label="Close templates"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {pending ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-6 sm:px-8">
              {pending.description && (
                <p className="max-w-2xl text-[13.5px] leading-relaxed text-ink-secondary">{pending.description}</p>
              )}
              {Boolean(pending.warnings?.length) && <div className="mt-4 border border-warning/40 bg-warning/10 px-4 py-3 font-mono text-[11.5px] text-warning">
                <div className="mb-2 font-semibold">Backup notes</div>
                {pending.warnings?.map((warning, index) => <p key={index}>{warning}</p>)}
              </div>}
              {(pending.kind === "package" || pending.kind === "backup") && (
                <div className="mt-5 flex flex-wrap gap-2 font-mono text-[11px] text-ink-secondary">
                  {pending.chiefOfStaff && <span className="flex items-center gap-1.5 border border-hairline bg-inset px-2.5 py-1"><Crown size={12} />{pending.chiefOfStaff} leads</span>}
                  <span className="flex items-center gap-1.5 border border-hairline bg-inset px-2.5 py-1"><MessageSquare size={12} />{pending.rooms} {pending.rooms === 1 ? "group chat" : "group chats"}</span>
                  <span className="flex items-center gap-1.5 border border-hairline bg-inset px-2.5 py-1"><BookOpen size={12} />{pending.playbooks} playbooks</span>
                  <span className="flex items-center gap-1.5 border border-hairline bg-inset px-2.5 py-1"><CalendarClock size={12} />{pending.routines} paused routines</span>
                  {pending.kind === "package" && <span className="flex items-center gap-1.5 border border-hairline bg-inset px-2.5 py-1"><Plug size={12} />{pending.apps.length} connections</span>}
                </div>
              )}
              {Boolean(pending.skills?.length) && (
                <div className="mt-4 border border-hairline bg-card px-4 py-3 text-[12px] text-ink-secondary">
                  <div className="font-semibold text-ink">Included skills — disabled on import</div>
                  <p className="mt-1 break-words">{pending.skills?.join(", ")}</p>
                  <p className="mt-1">Review each skill in its bot profile before enabling it. Imported instructions do not run automatically.</p>
                </div>
              )}
              <div className="mt-6 label-mono text-[11px] text-ink-secondary">Team members</div>
              <div className="mt-2 grid grid-cols-1 gap-x-10 md:grid-cols-2">
                {pending.members.map((member, index) => (
                  <div key={`${member.name}-${index}`} className="flex min-h-[64px] items-center gap-3 frame-rule-below px-1 py-3">
                    <div className={cn("flex size-9 shrink-0 items-center justify-center border font-mono text-[13px] font-semibold", TEAM_GLYPHS[index % TEAM_GLYPHS.length])}>
                      {member.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-semibold text-ink">{importedNames[index]}</div>
                      {importedNames[index] !== member.name && <div className="text-[11px] text-ink-secondary">New copy of {member.name}</div>}
                      <div className="mt-0.5 truncate text-[12px] text-ink-secondary">{member.title || "General assistant"}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-start gap-2.5 border border-hairline bg-card px-4 py-3 text-[12px] leading-relaxed text-ink-secondary">
                <Check size={14} className="mt-0.5 shrink-0 text-success" />
                <p>
                  {pending.kind === "backup"
                    ? `${TEAM_BACKUP_EXCLUSIONS} ${pending.archivedBots ? `${pending.archivedBots} archived bots will remain archived.` : ""}`
                    : pending.kind === "package"
                    ? "Bots, Chief of Staff, group chats, and reviewed playbooks are loaded. Suggested routines arrive paused, and connected apps stay off until you approve them. Conversations, credentials, permissions, and computer access stay private."
                    : "Only roles and appearance are loaded. Your conversations, account connections, permissions, and computer access stay private."}
                </p>
              </div>
              {error && <div role="alert" className="mt-4 border border-danger/40 bg-danger/10 px-3 py-2 font-mono text-[11.5px] text-danger">{error}</div>}
            </div>

            <footer className="flex flex-col gap-3 frame-rule-above px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <div className="text-[12px] text-ink-secondary">
                Your {currentBotCount > 0 ? `${currentBotCount} existing ${currentBotCount === 1 ? "bot and its" : "bots and their"}` : "existing"} conversations stay unchanged.
                {" "}{pending.kind === "backup"
                  ? t("teamImport.backupCopies")
                  : t("teamImport.newSection", { name: pending.name })}
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={() => void importTeam()}
                disabled={importing}
              >
                {importing && <Loader2 size={14} className="animate-spin" />}
                {importing
                  ? "Importing…"
                  : pending.kind === "backup" ? "Import backup" : "Add team"}
              </Button>
            </footer>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-3 frame-rule-below px-6 pb-3 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <div className="flex w-fit border border-hairline bg-inset p-0.5" role="tablist" aria-label="Template source">
                <button
                  role="tab"
                  aria-selected={tab === "explore"}
                  onClick={() => {
                    setTab("explore");
                    setError("");
                  }}
                  className={cn(
                    "px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors",
                    tab === "explore" ? "bg-raised text-ink font-semibold" : "text-ink-secondary hover:text-ink",
                  )}
                >
                  Explore
                </button>
                <button
                  role="tab"
                  aria-selected={tab === "import"}
                  onClick={() => {
                    setTab("import");
                    setError("");
                  }}
                  className={cn(
                    "px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors",
                    tab === "import" ? "bg-raised text-ink font-semibold" : "text-ink-secondary hover:text-ink",
                  )}
                >
                  Import
                </button>
                <button
                  role="tab"
                  aria-selected={tab === "scout"}
                  onClick={() => {
                    setTab("scout");
                    setError("");
                  }}
                  className={cn(
                    "px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors",
                    tab === "scout" ? "bg-raised text-ink font-semibold" : "text-ink-secondary hover:text-ink",
                  )}
                >
                  From a folder
                </button>
              </div>
              {tab === "explore" && (
                <label className="flex h-9 w-full items-center gap-2 border border-hairline bg-inset px-3 sm:w-[300px]">
                  <Search size={15} className="shrink-0 text-ink-secondary" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search templates"
                    aria-label="Search templates"
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-secondary/60 focus:outline-none"
                  />
                </label>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-7 pt-5 sm:px-8">
              {tab === "explore" && (
                <div>
                  <div className="mb-3 label-mono text-[11px] text-ink-secondary">
                    {search ? "Search results" : "Community templates"}
                  </div>
                  {catalogLoading && (
                    <div className="flex items-center justify-center gap-2 py-24 font-mono text-[12px] text-ink-secondary">
                      <Loader2 size={14} className="animate-spin" /> Loading templates…
                    </div>
                  )}
                  {!catalogLoading && catalogError && (
                    <div className="border border-danger/40 bg-danger/10 p-4 text-[12.5px] text-danger">
                      <p>{catalogError}</p>
                      <Button variant="secondary" size="sm" onClick={() => void loadCatalog()} className="mt-3">Try again</Button>
                    </div>
                  )}
                  {!catalogLoading && catalog && (
                    <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
                      {visibleTeams.map((entry, index) => (
                        <article key={entry.slug} className="flex min-h-[96px] items-center gap-3 frame-rule-below px-1 py-3.5">
                          <TeamGlyph index={index} />
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-[13.5px] font-semibold text-ink">{entry.name}</h3>
                            <p className="mt-0.5 truncate text-[12px] text-ink-secondary">{entry.outcome ?? entry.summary}</p>
                            <p className="mt-1 truncate font-mono text-[11px] text-ink-secondary/80">
                              {entry.members} bots · {entry.skills.length} playbooks
                              {entry.requires.apps.length > 0 && ` · ${entry.requires.apps.join(", ")}`}
                              {entry.setupMinutes && ` · ~${entry.setupMinutes} min`}
                            </p>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void loadLibraryTeam(entry)}
                            disabled={busySlug !== null}
                          >
                            {busySlug === entry.slug && <Loader2 size={12} className="animate-spin" />}
                            {busySlug === entry.slug ? "Loading" : "Load"}
                          </Button>
                        </article>
                      ))}
                    </div>
                  )}
                  {!catalogLoading && catalog && visibleTeams.length === 0 && (
                    <div className="flex min-h-56 flex-col items-center justify-center text-center">
                      <div className="label-mono text-[13px] font-semibold text-ink">No templates found</div>
                      <div className="mt-1 text-[12px] text-ink-secondary">Try a different search.</div>
                    </div>
                  )}
                </div>
              )}

              {tab === "import" && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md,.json,.mausbackup.json,.mausteam.json,text/markdown,application/json"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      if (!file) return;
                      void readFile(file).catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
                    }}
                  />
                  <div className="mb-3 label-mono text-[11px] text-ink-secondary">Bring your own team</div>
                  <div className="grid gap-5 md:grid-cols-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      onDragEnter={(event) => {
                        event.preventDefault();
                        setDragging(true);
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDragging(false);
                        const file = event.dataTransfer.files[0];
                        if (file) void readFile(file).catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
                      }}
                      className={cn(
                        "flex min-h-56 flex-col items-center justify-center border border-dashed px-6 text-center transition-colors cursor-pointer",
                        dragging ? "border-ink bg-raised" : "border-hairline bg-card hover:border-ink hover:bg-raised-hover",
                      )}
                    >
                      <UploadCloud size={24} className="text-ink-secondary" />
                      <span className="mt-3 text-[13.5px] font-semibold text-ink">Choose a backup or team file</span>
                      <span className="mt-1 text-[12px] text-ink-secondary">Drop a .mausbackup.json, BotMRR .md or legacy .mausteam.json here. You’ll preview it before anything is added.</span>
                    </button>

                    <div className="flex min-h-56 flex-col justify-center border border-hairline bg-card px-6">
                      <Github size={22} className="text-ink-secondary" />
                      <h3 className="mt-3 text-[13.5px] font-semibold text-ink">Load from GitHub</h3>
                      <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">Paste a public repo or a direct team JSON link.</p>
                      <div className="mt-4 flex gap-2">
                        <input
                          value={githubUrl}
                          onChange={(event) => setGithubUrl(event.target.value)}
                          onKeyDown={(event) => event.key === "Enter" && void loadGithubTeam()}
                          placeholder="github.com/owner/repo"
                          aria-label="GitHub team URL"
                          className="min-w-0 flex-1 border border-hairline bg-inset px-3 py-2 text-[13px] text-ink placeholder:text-ink-secondary/60 focus:border-ink focus:outline-none"
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => void loadGithubTeam()}
                          disabled={!githubUrl.trim() || githubLoading}
                        >
                          {githubLoading && <Loader2 size={12} className="animate-spin" />}
                          Load
                        </Button>
                      </div>
                    </div>
                  </div>
                  {error && <div role="alert" className="mt-4 border border-danger/40 bg-danger/10 px-3 py-2 font-mono text-[11.5px] text-danger">{error}</div>}
                </div>
              )}

              {tab === "scout" && (
                <div>
                  <div className="mb-3 label-mono text-[11px] text-ink-secondary">Start from a project folder</div>
                  <p className="max-w-2xl text-[12.5px] leading-relaxed text-ink-secondary">
                    Point the scout at a folder. It reads what&apos;s in there — README, dependencies, layout — and
                    suggests a team for it. Nothing is created until you say so.
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={scoutFolder}
                      onChange={(event) => setScoutFolder(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && scoutTarget && void runScout(scoutTarget)}
                      placeholder="/path/to/your/project"
                      aria-label="Project folder to scout"
                      className="min-w-0 flex-1 border border-hairline bg-inset px-3 py-2 text-[13px] text-ink placeholder:text-ink-secondary/60 focus:border-ink focus:outline-none"
                    />
                    {Boolean(window.ogb?.pickFolder) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void pickScoutFolder()}
                        disabled={scouting}
                      >
                        <FolderOpen size={14} />
                        Browse
                      </Button>
                    )}
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => void runScout(scoutTarget)}
                      disabled={!scoutTarget || scouting}
                    >
                      {scouting ? <Loader2 size={14} className="animate-spin" /> : <Compass size={14} />}
                      {scouting ? "Scouting…" : "Scout"}
                    </Button>
                  </div>

                  {scouted && (
                    <div className="mt-6">
                      <div className="border border-hairline bg-card p-4">
                        <div className="text-[14px] font-semibold text-ink">{scouted.profile.name}</div>
                        {scouted.profile.summary && (
                          <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">{scouted.profile.summary}</p>
                        )}
                        {scouted.profile.stacks.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {scouted.profile.stacks.map((stack) => (
                              <span key={stack} className="border border-hairline bg-inset px-2 py-0.5 font-mono text-[10.5px] text-ink-secondary">
                                {stack}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-5 label-mono text-[11px] text-ink-secondary">Suggested team</div>
                      <div className="mt-1 grid grid-cols-1 gap-x-10 md:grid-cols-2">
                        {scouted.suggestion.manifest.team.members.map((member, index) => (
                          <div key={member.key} className="flex min-h-[64px] items-center gap-3 frame-rule-below px-1 py-3">
                            <div className={cn("flex size-9 shrink-0 items-center justify-center border font-mono text-[13px] font-semibold", TEAM_GLYPHS[index % TEAM_GLYPHS.length])}>
                              {member.name.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-[13.5px] font-semibold text-ink">
                                {member.name} <span className="font-normal text-ink-secondary">· {member.title}</span>
                              </div>
                              <div className="mt-0.5 truncate text-[11.5px] text-ink-secondary">
                                {scouted.suggestion.reasons[member.key] ?? ""}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {directory && directory.length > 0 && (
                        <>
                          <div className="mt-5 label-mono text-[11px] text-ink-secondary">From the community directory — tick to add</div>
                          <div className="mt-1 flex flex-col">
                            {directory.map((candidate) => (
                              <div key={candidate.slug} className="flex items-center gap-3 frame-rule-below px-1 py-3">
                                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={pickedDirectory.has(candidate.slug)}
                                    onChange={() =>
                                      setPickedDirectory((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(candidate.slug)) next.delete(candidate.slug);
                                        else next.add(candidate.slug);
                                        return next;
                                      })
                                    }
                                    className="size-4 accent-accent"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-[13px] font-semibold text-ink">
                                      {candidate.name}
                                      {candidate.category && <span className="font-normal text-ink-secondary"> · {candidate.category}</span>}
                                    </div>
                                    <div className="mt-0.5 truncate text-[11.5px] text-ink-secondary">
                                      Matches {candidate.matched.join(", ")}
                                    </div>
                                  </div>
                                </label>
                                <button
                                  onClick={() => void openExternal(candidate.detailUrl)}
                                  aria-label={`Open ${candidate.name} on botdirectory.ai`}
                                  title="Read this bot's page before adding it"
                                  className="p-1.5 text-ink-secondary hover:text-ink"
                                >
                                  <ExternalLink size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <input
                          value={roomName}
                          onChange={(event) => setRoomName(event.target.value)}
                          aria-label="Group chat name"
                          className="min-w-0 flex-1 border border-hairline bg-inset px-3 py-2 text-[13px] text-ink placeholder:text-ink-secondary/60 focus:border-ink focus:outline-none"
                        />
                        <Button
                          variant="primary"
                          size="md"
                          onClick={() => void createProject()}
                          disabled={creating}
                        >
                          {creating && <Loader2 size={14} className="animate-spin" />}
                          {creating ? "Creating…" : "Create group chat"}
                        </Button>
                      </div>
                      <p className="mt-2 text-[11.5px] text-ink-secondary">
                        Creates the team as new bots, opens a group chat for them, and points its working folder here.
                      </p>
                    </div>
                  )}
                  {error && <div role="alert" className="mt-4 border border-danger/40 bg-danger/10 px-3 py-2 font-mono text-[11.5px] text-danger">{error}</div>}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
