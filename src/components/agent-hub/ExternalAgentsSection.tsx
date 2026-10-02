import { useState, type FormEvent } from "react";
import { Globe, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { t } from "@/lib/i18n";
import {
  checkExternalAgent,
  createExternalAgent,
  inviteExternalAgent,
  removeExternalAgent,
  useExternalAgents,
  type ExternalAgent,
  type NewExternalAgent,
} from "@/lib/external-agents";
import type { Group } from "@/state/store";

const inputClass = "h-8 w-full min-w-0 border border-hairline bg-inset px-2 font-mono text-[12px] text-ink outline-none focus:border-ink";

/** Connected external A2A agents (direct and through zroute). Read-only:
 * no wallet, payment or signing controls exist in this milestone. */
export function ExternalAgentsSection({ currentRoom }: { currentRoom: Group | null }) {
  const agents = useExternalAgents().filter((agent) => agent.status !== "revoked");
  const [adding, setAdding] = useState(false);
  const direct = agents.filter((agent) => agent.transport === "direct");
  const zroute = agents.filter((agent) => agent.transport === "zroute");
  return (
    <div className="flex flex-col gap-4" data-testid="external-agents">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="label-mono text-ink">[ {t("external.hub.title")} ]</div>
        <Button size="sm" variant="secondary" onClick={() => setAdding((open) => !open)} aria-expanded={adding}>
          {t("external.hub.add")}
        </Button>
      </div>
      {adding && <AddExternalAgentForm onDone={() => setAdding(false)} />}
      <ExternalGroup title={t("external.hub.direct")} agents={direct} currentRoom={currentRoom} />
      <ExternalGroup title={t("external.hub.zroute")} agents={zroute} currentRoom={currentRoom} />
    </div>
  );
}

function ExternalGroup({ title, agents, currentRoom }: { title: string; agents: ExternalAgent[]; currentRoom: Group | null }) {
  return (
    <div>
      <div className="mb-2 label-mono text-[10.5px] text-ink-secondary">{title}</div>
      {agents.length === 0 ? (
        <p className="font-mono text-[11.5px] text-ink-secondary">{t("external.hub.none")}</p>
      ) : (
        <div className="grid grid-cols-1 @[34rem]/hub:grid-cols-2 gap-3">
          {agents.map((agent) => (
            <ExternalAgentCard key={agent.id} agent={agent} currentRoom={currentRoom} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExternalAgentCard({ agent, currentRoom }: { agent: ExternalAgent; currentRoom: Group | null }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const inRoom = Boolean(currentRoom?.externalAgentIds?.includes(agent.id));
  const run = async (action: () => Promise<{ ok: boolean; text: string } | void>) => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await action();
      if (result) setNotice(result);
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : t("external.error.generic") });
    } finally {
      setBusy(false);
    }
  };
  const upstream = agent.transport === "zroute" ? agent.reportedUpstream?.name ?? agent.upstreamAgentId : agent.reportedName;
  const Icon = agent.transport === "zroute" ? Route : Globe;
  return (
    <div className="flex min-w-0 flex-col gap-2.5 border border-hairline bg-card p-4" data-testid={`external-agent-${agent.id}`}>
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center border border-hairline bg-inset text-ink-secondary" aria-hidden="true">
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-ink" title={agent.displayName}>{agent.displayName}</div>
          <div className="truncate font-mono text-[11px] text-ink-secondary">
            {agent.transport === "zroute" ? t("external.transport.zroute") : `${agent.provider} · ${t("external.transport.direct")}`}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Tag tone={agent.status === "ready" ? "success" : agent.status === "draft" ? "neutral" : "danger"} variant="soft" size="sm">
              {t(`external.status.${agent.status}`)}
            </Tag>
            {inRoom && <Tag tone="neutral" variant="soft" size="sm">{t("agent.type.inRoom")}</Tag>}
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 font-mono text-[11px]">
        <dt className="text-ink-secondary">{t("external.field.endpoint")}</dt>
        <dd className="truncate text-ink" title={`${agent.endpointHost}${agent.endpointPath}`}>{agent.endpointHost}{agent.endpointPath}</dd>
        {upstream && (
          <>
            <dt className="text-ink-secondary">{t("external.field.upstream")}</dt>
            <dd className="truncate text-ink">{upstream}</dd>
          </>
        )}
        {agent.routeId && (
          <>
            <dt className="text-ink-secondary">{t("external.field.route")}</dt>
            <dd className="truncate text-ink">{agent.routeId}</dd>
          </>
        )}
        <dt className="text-ink-secondary">{t("external.field.capabilities")}</dt>
        <dd className="truncate text-ink">{agent.capabilities.join(", ")}</dd>
        <dt className="text-ink-secondary">{t("external.field.provenance")}</dt>
        <dd className="truncate text-ink">{t(`external.provenance.${agent.provenance}`)}</dd>
        <dt className="text-ink-secondary">{t("external.field.credentials")}</dt>
        <dd className="text-ink">{agent.credentialsConfigured ? t("external.credentials.configured") : t("external.credentials.none")}</dd>
        <dt className="text-ink-secondary">{t("external.field.lastChecked")}</dt>
        <dd className="text-ink">
          {agent.lastCheckedAt ? new Date(agent.lastCheckedAt).toLocaleString() : t("external.notChecked")}
          {agent.lastLatencyMs !== undefined ? ` · ${t("external.latency", { ms: agent.lastLatencyMs })}` : ""}
        </dd>
      </dl>
      <div className="flex flex-wrap gap-1.5" aria-label={t("external.safety.aria")}>
        <Tag tone="neutral" variant="outline" size="sm">{t("external.readOnly")}</Tag>
        <Tag tone="neutral" variant="outline" size="sm">{t("external.noWallet")}</Tag>
        <Tag tone="neutral" variant="outline" size="sm">{t("external.noPayment")}</Tag>
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-hairline pt-2.5">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void run(async () => {
          const check = await checkExternalAgent(agent.id);
          return { ok: check.ok, text: check.safeMessage };
        })}>
          {t("external.action.test")}
        </Button>
        {currentRoom && !inRoom && (
          <Button size="sm" variant="secondary" disabled={busy || agent.status !== "ready"} title={agent.status !== "ready" ? t("external.inviteNeedsCheck") : undefined} onClick={() => void run(async () => {
            const status = await inviteExternalAgent(currentRoom.id, agent.id);
            return { ok: true, text: status === "already" ? t("agent.type.inRoom") : t("external.invited", { room: currentRoom.name }) };
          })}>
            {t("okxHub.inviteToRoom")}
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(async () => {
          await removeExternalAgent(agent.id);
        })}>
          {t("external.action.remove")}
        </Button>
      </div>
      {notice && (
        <p role="status" aria-live="polite" className={`font-mono text-[11px] ${notice.ok ? "text-success" : "text-danger"}`}>
          {notice.text}
        </p>
      )}
    </div>
  );
}

function AddExternalAgentForm({ onDone }: { onDone: () => void }) {
  const [transport, setTransport] = useState<"direct" | "zroute">("direct");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const field = (name: string) => String(data.get(name) ?? "").trim();
    const input: NewExternalAgent = {
      transport,
      displayName: field("displayName"),
      endpointUrl: field("endpointUrl"),
      ...(transport === "direct" && field("provider") ? { provider: field("provider") } : {}),
      ...(field("upstreamAgentId") ? { upstreamAgentId: field("upstreamAgentId") } : {}),
      ...(transport === "zroute" && field("routeId") ? { routeId: field("routeId") } : {}),
      ...(field("credentialEnv") ? { credentialEnv: field("credentialEnv") } : {}),
      capabilities: field("capabilities").split(",").map((cap) => cap.trim()).filter(Boolean),
    };
    setSaving(true);
    setError(null);
    try {
      const agent = await createExternalAgent(input);
      await checkExternalAgent(agent.id);
      onDone();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("external.error.generic"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3 border border-hairline bg-inset p-4" aria-label={t("external.hub.add")}>
      <fieldset className="flex flex-wrap gap-3 font-mono text-[12px] text-ink">
        <legend className="mb-1 label-mono text-[10.5px] text-ink-secondary">{t("external.form.transport")}</legend>
        {(["direct", "zroute"] as const).map((value) => (
          <label key={value} className="flex items-center gap-1.5">
            <input type="radio" name="transport" checked={transport === value} onChange={() => setTransport(value)} />
            {value === "direct" ? t("external.transport.direct") : t("external.transport.zroute")}
          </label>
        ))}
      </fieldset>
      <div className="grid grid-cols-1 @[34rem]/hub:grid-cols-2 gap-3">
        <Field label={t("external.form.name")}><input name="displayName" required maxLength={80} className={inputClass} /></Field>
        {transport === "direct" ? (
          <Field label={t("external.form.provider")}><input name="provider" maxLength={80} className={inputClass} /></Field>
        ) : (
          <Field label={t("external.form.provider")}><input value={t("external.transport.zroute")} readOnly className={inputClass} /></Field>
        )}
        <Field label={transport === "zroute" ? t("external.form.zrouteEndpoint") : t("external.form.endpoint")}>
          <input name="endpointUrl" required type="url" placeholder="https://" className={inputClass} />
        </Field>
        <Field label={t("external.form.protocol")}><input value="A2A (JSON-RPC)" readOnly className={inputClass} /></Field>
        {transport === "zroute" && (
          <Field label={t("external.form.routeId")}><input name="routeId" maxLength={120} className={inputClass} /></Field>
        )}
        <Field label={transport === "zroute" ? t("external.form.upstreamRequired") : t("external.form.agentId")}>
          <input name="upstreamAgentId" required={transport === "zroute"} maxLength={120} className={inputClass} />
        </Field>
        <Field label={t("external.form.capabilities")}><input name="capabilities" placeholder="chat, research" className={inputClass} /></Field>
        <Field label={t("external.form.credentialEnv")}>
          <input name="credentialEnv" placeholder="KIND_MEITNER_EXT_NAME" pattern="KIND_MEITNER_EXT_[A-Z0-9_]+" className={inputClass} />
        </Field>
      </div>
      <p className="font-mono text-[10.5px] leading-relaxed text-ink-secondary">{t("external.form.credentialNote")}</p>
      {error && <p role="alert" className="font-mono text-[11px] text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>{saving ? t("external.form.saving") : t("external.form.save")}</Button>
        <Button size="sm" variant="ghost" onClick={onDone}>{t("external.form.cancel")}</Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 font-mono text-[10.5px] text-ink-secondary">
      {label}
      {children}
    </label>
  );
}
