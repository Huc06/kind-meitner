import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { api, ApiError, type Group } from "@/state/store";
import { importHubAgent } from "@/lib/agent-hub";
import { ChartAvatar } from "./Avatar";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
export interface OkxCatalogAgent {
  id: string;
  name: string;
  description: string;
  provider: string;
  avatar: string;
  capabilities: string[];
  status: string;
}

type OkxCatalogResponse = { agents: OkxCatalogAgent[] };

type RecordValue = Record<string, unknown>;

function asRecord(value: unknown): RecordValue | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
}

function asAgent(value: unknown): OkxCatalogAgent | null {
  const record = asRecord(value);
  if (!record) return null;
  const { id, name, description, provider, avatar, capabilities, status } = record;
  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof description !== "string" ||
    typeof provider !== "string" ||
    typeof avatar !== "string" ||
    typeof status !== "string" ||
    !Array.isArray(capabilities) ||
    !capabilities.every((capability) => typeof capability === "string")
  ) return null;
  return { id, name, description, provider, avatar, capabilities, status };
}

/** Accept only the display-only catalog fields the client actually uses. */
export function parseOkxCatalog(value: unknown): OkxCatalogResponse | null {
  const record = asRecord(value);
  if (!record || !Array.isArray(record.agents)) return null;
  const agents = record.agents.map(asAgent);
  return agents.every((agent): agent is OkxCatalogAgent => agent !== null) ? { agents } : null;
}

export function canInviteOkxAgent(group: Pick<Group, "dm">, remoteClient: boolean): boolean {
  return !remoteClient && !group.dm;
}


export function OkxCatalogInviteDetails({ agent }: { agent: OkxCatalogAgent }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <ChartAvatar color="cyan" size={28} label={`${agent.name}, OKX.AI catalog agent`} />
      <div className="min-w-0">
        <h2 className="text-[13px] font-medium text-ink">{agent.name}</h2>
        <p className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary">{agent.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-secondary">
          <Tag tone="neutral" variant="soft" size="sm">Free · read-only</Tag>
          <span className="label-mono">OKX.AI CATALOG</span>
        </div>
      </div>
    </div>
  );
}

export function OkxAgentInvite({
  roomId,
  importedExternalAgentIds = new Set<string>(),
  label = "Invite agent",
}: {
  roomId: string;
  importedExternalAgentIds?: ReadonlySet<string>;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<OkxCatalogAgent[] | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [requestedId, setRequestedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    setError(null);
    try {
      const body = await api("/api/okx/agents");
      const parsed = parseOkxCatalog(body);
      if (!parsed) throw new Error("The OKX agent catalog returned an invalid response.");
      setCatalog(parsed.agents);
    } catch (reason) {
      setError(reason instanceof ApiError || reason instanceof Error ? reason.message : "Could not load OKX agents.");
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  const toggleOpen = useCallback(() => {
    if (!open && catalog === null && !loadingCatalog) void loadCatalog();
    setOpen((wasOpen) => !wasOpen);
  }, [catalog, loadCatalog, loadingCatalog, open]);

  // Dismiss the flyout on an outside click or the Escape key, matching the
  // app's other popovers. Listeners are attached only while open.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const importAgent = useCallback(async (agent: OkxCatalogAgent) => {
    setImportingId(agent.id);
    setError(null);
    try {
      const result = await importHubAgent(agent.id, roomId);
      if (result.kind === "added" || result.kind === "already") {
        // Do not patch the room or bot list here. The normal group/bot stream
        // owns membership and activity updates, including an idempotent import.
        setRequestedId(agent.id);
      } else {
        setError(result.message ?? `Could not invite ${agent.name}.`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Could not invite ${agent.name}.`);
    } finally {
      setImportingId(null);
    }
  }, [roomId]);

  return (
    <div className="relative" data-testid="okx-agent-invite" ref={containerRef}>
      <Button
        variant="secondary"
        size="sm"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-controls="okx-agent-invite-panel"
      >
        {label}
      </Button>
      {open ? (
        <section
          id="okx-agent-invite-panel"
          aria-label="Invite an OKX agent"
          className="absolute right-0 top-full z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] border border-hairline bg-menu p-3 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.6)]"
        >
          <p className="text-[12px] leading-relaxed text-ink-secondary">Invite an OKX.ai intelligence agent to this room.</p>
          {loadingCatalog ? (
            <p role="status" aria-live="polite" className="mt-3 flex items-center gap-2 font-mono text-[11.5px] text-ink-secondary">
              <Loader2 size={13} className="animate-spin" /> Loading OKX agents…
            </p>
          ) : null}
          {error ? <p role="alert" className="mt-3 font-mono text-[11.5px] text-danger">{error}</p> : null}
          {catalog?.map((agent) => {
            const inRoom = importedExternalAgentIds.has(agent.id);
            const requested = requestedId === agent.id;
            const importing = importingId === agent.id;
            return (
              <article key={agent.id} className="mt-2.5 border border-hairline bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <OkxCatalogInviteDetails agent={agent} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  {inRoom ? (
                    <span role="status" className="flex items-center gap-1 font-mono text-[11px] text-success">
                      <Check size={12} /> In this room
                    </span>
                  ) : requested ? (
                    <span role="status" aria-live="polite" className="font-mono text-[11px] text-ink-secondary">
                      Waiting for room update…
                    </span>
                  ) : (
                    <span />
                  )}
                  <Button
                    variant="primary"
                    size="xs"
                    onClick={() => void importAgent(agent)}
                    disabled={inRoom || requested || importing || agent.status !== "available"}
                  >
                    {importing ? <Loader2 size={11} className="animate-spin" /> : null}
                    {importing ? "Inviting…" : inRoom ? "Added" : requested ? "Invited" : "Invite"}
                  </Button>
                </div>
              </article>
            );
          })}
          {catalog && catalog.length === 0 ? <p role="status" className="mt-3 font-mono text-[11.5px] text-ink-secondary">No OKX agents are available.</p> : null}
          {error && catalog === null ? <button type="button" onClick={() => void loadCatalog()} className="mt-3 font-mono text-[11.5px] text-ink underline hover:text-ink-secondary">Try again</button> : null}
        </section>
      ) : null}
    </div>
  );
}
