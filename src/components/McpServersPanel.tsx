import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  CirclePower,
  ClipboardPaste,
  FlaskConical,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ServerCog,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import type { LocaleKey } from "@/locales";
import { updateMcpServers } from "@/lib/mcp-servers";
import { api } from "@/state/store";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input, Textarea } from "@/components/ui/field";
import { Tag } from "@/components/ui/tag";

export interface McpServerListing {
  name: string;
  command: string;
  args: string[];
  envKeys: string[];
  enabled: boolean;
}

interface McpDraft {
  name: string;
  command: string;
  args: string;
  env: string;
}

interface ProbeResult {
  ok: boolean;
  tools?: Array<{ name: string; description?: string }>;
  error?: string;
}

interface McpMessage {
  key: LocaleKey;
  params?: Record<string, string | number>;
}

const EMPTY_DRAFT: McpDraft = { name: "", command: "", args: "", env: "" };
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseMcpArguments(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function parseMcpEnvironment(
  value: string,
  savedKeys: readonly string[] = [],
): { ok: true; env: Record<string, string | true> } | { ok: false; error: McpMessage } {
  const saved = new Set(savedKeys);
  const env: Record<string, string | true> = {};
  for (const original of value.split(/\r?\n/)) {
    const line = original.trim();
    if (!line) continue;
    const equals = line.indexOf("=");
    if (equals <= 0) return { ok: false, error: { key: "mcp.env.useKeyValue", params: { line } } };
    const key = line.slice(0, equals).trim();
    const secret = line.slice(equals + 1);
    if (!ENV_NAME.test(key)) return { ok: false, error: { key: "mcp.env.invalidName", params: { key } } };
    if (Object.hasOwn(env, key)) return { ok: false, error: { key: "mcp.env.duplicate", params: { key } } };
    env[key] = secret === "" && saved.has(key) ? true : secret;
  }
  return { ok: true, env };
}

function probeToolsLabel(tools: ProbeResult["tools"]): string {
  if (!tools?.length) return t("mcp.probe.noTools");
  const names = tools.map((tool) => tool.name).join(", ");
  return tools.length === 1
    ? t("mcp.probe.toolsOne", { names })
    : t("mcp.probe.toolsMany", { count: tools.length, names });
}

function draftFor(server: McpServerListing): McpDraft {
  return {
    name: server.name,
    command: server.command,
    args: server.args.join("\n"),
    // Values are intentionally never returned by the server. A blank value
    // beside an existing key is a write-only “keep saved value” placeholder.
    env: server.envKeys.map((key) => `${key}=`).join("\n"),
  };
}

export function McpServersPanel() {
  const [servers, setServers] = useState<McpServerListing[] | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<McpDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | McpMessage | null>(null);
  const [notice, setNotice] = useState<(McpMessage & { stateKey?: LocaleKey }) | null>(null);
  const [probe, setProbe] = useState<Record<string, ProbeResult>>({});
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const loadGeneration = useRef(0);

  // Paste-to-add: the same block Claude Code, Cursor and Claude Desktop
  // write. The server applies the form's rules and adds them switched off.
  const importServers = async () => {
    if (!importText.trim()) return;
    const generation = ++loadGeneration.current;
    setBusy("import");
    setError(null);
    setNotice(null);
    try {
      const result = await api("/api/mcp/servers/import", {
        method: "POST",
        body: JSON.stringify({ json: importText }),
      });
      updateMcpServers(result.servers ?? []);
      if (generation !== loadGeneration.current) return;
      setServers(result.servers ?? []);
      setNotice({ key: "mcp.imported", params: { names: (result.added ?? []).join(", ") } });
      setImportText("");
      setImportOpen(false);
    } catch (cause) {
      if (generation === loadGeneration.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (generation === loadGeneration.current) setBusy(null);
    }
  };

  const load = useCallback(() => {
    const generation = ++loadGeneration.current;
    setBusy("load");
    setError(null);
    return api("/api/mcp/servers")
      .then((result) => {
        if (generation === loadGeneration.current) {
          setServers(result.servers ?? []);
          updateMcpServers(result.servers ?? []);
        }
      })
      .catch((cause) => {
        if (generation === loadGeneration.current) setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (generation === loadGeneration.current) setBusy(null);
      });
  }, []);

  useEffect(() => {
    void load();
    return () => { loadGeneration.current += 1; };
  }, [load]);

  const closeEditor = () => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
  };

  const save = async () => {
    const name = draft.name.trim();
    const command = draft.command.trim();
    if (!name || !command) {
      setError({ key: "mcp.err.nameAndCommand" });
      return;
    }
    const existing = editing === "new" ? undefined : servers?.find((server) => server.name === editing);
    const parsedEnv = parseMcpEnvironment(draft.env, existing?.envKeys);
    if (!parsedEnv.ok) {
      setError(parsedEnv.error);
      return;
    }
    setBusy("save");
    loadGeneration.current += 1;
    setError(null);
    setNotice(null);
    try {
      const result = await api(
        editing === "new" ? "/api/mcp/servers" : `/api/mcp/servers/${encodeURIComponent(name)}`,
        {
          method: editing === "new" ? "POST" : "PUT",
          body: JSON.stringify({
            ...(editing === "new" ? { name } : {}),
            command,
            args: parseMcpArguments(draft.args),
            env: parsedEnv.env,
            ...(existing ? { enabled: existing.enabled } : {}),
          }),
        },
      );
      setServers(result.servers ?? []);
      updateMcpServers(result.servers ?? []);
      setNotice({ key: editing === "new" ? "mcp.saved" : "mcp.updated", params: { name } });
      closeEditor();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (server: McpServerListing) => {
    setBusy(`toggle:${server.name}`);
    loadGeneration.current += 1;
    setError(null);
    try {
      const result = await api(`/api/mcp/servers/${server.name}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !server.enabled }),
      });
      setServers(result.servers ?? []);
      updateMcpServers(result.servers ?? []);
      setNotice({
        key: "mcp.toggled",
        params: { name: server.name },
        stateKey: server.enabled ? "mcp.state.off" : "mcp.state.on",
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  const test = async (server: McpServerListing) => {
    setBusy(`test:${server.name}`);
    loadGeneration.current += 1;
    setError(null);
    setProbe((current) => {
      const next = { ...current };
      delete next[server.name];
      return next;
    });
    try {
      const result: ProbeResult = await api(`/api/mcp/servers/${server.name}/test`, { method: "POST" });
      setProbe((current) => ({ ...current, [server.name]: result }));
    } catch (cause) {
      setProbe((current) => ({
        ...current,
        [server.name]: { ok: false, error: cause instanceof Error ? cause.message : String(cause) },
      }));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (server: McpServerListing) => {
    if (!window.confirm(t("mcp.removeConfirm", { name: server.name }))) return;
    setBusy(`delete:${server.name}`);
    loadGeneration.current += 1;
    setError(null);
    try {
      const result = await api(`/api/mcp/servers/${server.name}`, { method: "DELETE" });
      setServers(result.servers ?? []);
      updateMcpServers(result.servers ?? []);
      setProbe((current) => {
        const next = { ...current };
        delete next[server.name];
        return next;
      });
      if (editing === server.name) closeEditor();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-7 pt-5 sm:px-8">
      <div className="mx-auto max-w-[840px]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-ink">{t("mcp.title")}</h3>
            <p className="mt-1 max-w-[610px] text-[12.5px] leading-relaxed text-ink-secondary">
              {t("mcp.subtitle")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon
              type="button"
              onClick={() => void load()}
              disabled={busy !== null}
              aria-label={t("mcp.refreshAria")}
            >
              <RefreshCw size={14} className={cn(busy === "load" && "animate-spin")} />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              disabled={busy !== null}
              onClick={() => {
                setImportOpen((open) => !open);
                setError(null);
                setNotice(null);
              }}
            >
              <ClipboardPaste size={13} /> {t("mcp.import")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="button"
              disabled={busy !== null}
              onClick={() => {
                setEditing("new");
                setDraft(EMPTY_DRAFT);
                setError(null);
                setNotice(null);
              }}
            >
              <Plus size={13} /> {t("mcp.addServer")}
            </Button>
          </div>
        </div>

        {importOpen && (
          <div className="mt-4 border border-hairline bg-card p-4 sm:p-5">
            <div className="text-[14px] font-medium text-ink">{t("mcp.import")}</div>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">{t("mcp.importHint")}</p>
            <Textarea
              autoFocus
              aria-label={t("mcp.import")}
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              spellCheck={false}
              rows={8}
              placeholder={'{\n  "mcpServers": {\n    "notes": { "command": "npx", "args": ["-y", "@example/notes-mcp"], "env": { "NOTES_TOKEN": "…" } }\n  }\n}'}
              className="mt-3 font-mono text-[12px]"
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                disabled={busy === "import"}
                onClick={() => {
                  setImportOpen(false);
                  setImportText("");
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="button"
                disabled={busy !== null || !importText.trim()}
                onClick={() => void importServers()}
              >
                {t("mcp.importAction")}
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 border border-hairline bg-inset px-4 py-3 text-[12px] leading-relaxed text-ink-secondary">
          {t("mcp.trustNotice")}
        </div>

        {error && <div role="alert" className="mt-3 border border-danger bg-card px-3 py-2 text-[12px] text-danger">{typeof error === "string" ? error : t(error.key, error.params)}</div>}
        {notice && <div role="status" className="mt-3 border border-hairline bg-card px-3 py-2 text-[12px] text-success">{t(notice.key, {
          ...notice.params,
          ...(notice.stateKey ? { state: t(notice.stateKey) } : {})
        })}</div>}

        {editing && (
          <div className="mt-4 border border-hairline bg-card p-4 sm:p-5">
            <div className="text-[14px] font-medium text-ink">{editing === "new" ? t("mcp.editorNew") : t("mcp.editorEdit", { name: editing })}</div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <FieldLabel>{t("mcp.field.name")}</FieldLabel>
                <Input
                  autoFocus={editing === "new"}
                  disabled={editing !== "new"}
                  value={draft.name}
                  maxLength={32}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value.toLowerCase() }))}
                  placeholder="github"
                />
              </label>
              <label className="block">
                <FieldLabel>{t("mcp.field.command")}</FieldLabel>
                <Input
                  autoFocus={editing !== "new"}
                  value={draft.command}
                  onChange={(event) => setDraft((current) => ({ ...current, command: event.target.value }))}
                  placeholder="npx"
                />
              </label>
              <label className="block">
                <FieldLabel>{t("mcp.field.args")}</FieldLabel>
                <Textarea
                  value={draft.args}
                  onChange={(event) => setDraft((current) => ({ ...current, args: event.target.value }))}
                  placeholder={"-y\n@modelcontextprotocol/server-github"}
                  rows={5}
                  className="font-mono text-[12px]"
                />
              </label>
              <label className="block">
                <FieldLabel>{t("mcp.field.env")}</FieldLabel>
                <Textarea
                  value={draft.env}
                  onChange={(event) => setDraft((current) => ({ ...current, env: event.target.value }))}
                  placeholder="GITHUB_TOKEN=…"
                  rows={5}
                  className="font-mono text-[12px]"
                />
                {editing !== "new" && <span className="mt-1.5 block text-[11px] text-ink-secondary">{t("mcp.envHint")}</span>}
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={closeEditor}>{t("mcp.cancel")}</Button>
              <Button
                variant="primary"
                size="sm"
                type="button"
                disabled={busy !== null}
                onClick={() => void save()}
              >
                {busy === "save" && <Loader2 size={13} className="animate-spin" />} {t("mcp.save")}
              </Button>
            </div>
          </div>
        )}

        {servers === null ? (
          <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-ink-secondary"><Loader2 size={14} className="animate-spin" /> {t("mcp.loading")}</div>
        ) : servers.length === 0 && !editing ? (
          <div className="mt-5 flex min-h-64 flex-col items-center justify-center border border-dashed border-hairline text-center p-6">
            <div className="flex size-11 items-center justify-center border border-hairline bg-raised text-ink-secondary"><ServerCog size={20} /></div>
            <div className="mt-3 text-[14px] font-medium text-ink">{t("mcp.empty.title")}</div>
            <div className="mt-1 max-w-sm text-[12.5px] text-ink-secondary">{t("mcp.empty.desc")}</div>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {servers.map((server) => {
              const result = probe[server.name];
              return (
                <div key={server.name} className="border border-hairline bg-card p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className={cn("flex size-10 shrink-0 items-center justify-center border border-hairline", server.enabled ? "bg-card text-success" : "bg-raised text-ink-secondary")}>
                      <ServerCog size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-medium text-ink">{server.name}</span>
                        <Tag tone={server.enabled ? "success" : "neutral"} size="sm">{t(server.enabled ? "mcp.badge.on" : "mcp.badge.off")}</Tag>
                      </div>
                      <div className="mt-1 truncate font-mono text-[11.5px] text-ink-secondary">{[server.command, ...server.args].join(" ")}</div>
                      {server.envKeys.length > 0 && <div className="mt-1 truncate font-mono text-[11px] text-ink-secondary">{t("mcp.secretsSaved", { keys: server.envKeys.join(", ") })}</div>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button variant="secondary" size="xs" type="button" disabled={busy !== null} onClick={() => void test(server)}>
                        {busy === `test:${server.name}` ? <Loader2 size={13} className="animate-spin" /> : <FlaskConical size={13} />} {t("mcp.test")}
                      </Button>
                      <Button variant="secondary" size="xs" type="button" disabled={busy !== null} onClick={() => void toggle(server)} aria-label={t("mcp.toggleAria", {
                        name: server.name,
                        state: t(server.enabled ? "mcp.state.off" : "mcp.state.on"),
                      })}>
                        {busy === `toggle:${server.name}` ? <Loader2 size={13} className="animate-spin" /> : <CirclePower size={13} />} {t(server.enabled ? "mcp.turnOff" : "mcp.turnOn")}
                      </Button>
                      <Button variant="ghost" size="xs" icon type="button" disabled={busy !== null} onClick={() => { setEditing(server.name); setDraft(draftFor(server)); setError(null); setNotice(null); }} aria-label={t("mcp.editAria", { name: server.name })}><Pencil size={13} /></Button>
                      <Button variant="ghost" size="xs" icon type="button" disabled={busy !== null} onClick={() => void remove(server)} aria-label={t("mcp.removeAria", { name: server.name })}><Trash2 size={13} className="text-danger" /></Button>
                    </div>
                  </div>
                  {result && (
                    <div role="status" className={cn("mt-3 border px-3 py-2 font-mono text-[12px]", result.ok ? "border-hairline bg-inset text-success" : "border-danger bg-card text-danger")}>
                      {result.ok ? (
                        <span className="flex items-start gap-2"><CheckCircle2 size={14} className="mt-px shrink-0" /> {t("mcp.probe.connected")} {probeToolsLabel(result.tools)}</span>
                      ) : result.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
