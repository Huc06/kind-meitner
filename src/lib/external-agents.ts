// Client side of external A2A agents. The server owns endpoints, credentials
// and protocol; the browser sees only safe metadata (host, path, status,
// `credentialsConfigured`). External agents are room participants, never
// model choices: nothing here touches engine/model selection.
import { useEffect, useState } from "react";
import { api } from "@/state/store";
import { t } from "@/lib/i18n";

export type ExternalAgent = {
  id: string;
  displayName: string;
  provider: string;
  transport: "direct" | "zroute";
  protocol: "a2a";
  endpointHost: string;
  endpointPath: string;
  routeId?: string;
  upstreamAgentId?: string;
  reportedName?: string;
  reportedUpstream?: { agentId?: string; name?: string; provider?: string };
  capabilities: string[];
  status: "draft" | "checking" | "ready" | "offline" | "revoked" | "error";
  provenance: "direct-endpoint" | "zroute-proxy" | "local-catalog";
  credentialsConfigured: boolean;
  lastCheckedAt?: string;
  lastLatencyMs?: number;
  readOnly: true;
};

export type ConnectionCheck = {
  ok: boolean;
  status: "ready" | "offline" | "invalid" | "unauthorized" | "timeout" | "error";
  safeMessage: string;
  latencyMs?: number;
};

export type NewExternalAgent = {
  transport: "direct" | "zroute";
  displayName: string;
  provider?: string;
  endpointUrl: string;
  routeId?: string;
  upstreamAgentId?: string;
  capabilities?: string[];
  credentialEnv?: string;
};

let cache: ExternalAgent[] = [];
const listeners = new Set<(agents: ExternalAgent[]) => void>();
function publish(agents: ExternalAgent[]) {
  cache = agents;
  for (const listener of listeners) listener(agents);
}

export async function refreshExternalAgents(): Promise<ExternalAgent[]> {
  const body = (await api("/api/external-agents")) as { agents: ExternalAgent[] };
  publish(body.agents);
  return body.agents;
}

/** Shared list for the Hub and the room responder menu. */
export function useExternalAgents(): ExternalAgent[] {
  const [agents, setAgents] = useState(cache);
  useEffect(() => {
    listeners.add(setAgents);
    void refreshExternalAgents().catch(() => {});
    return () => {
      listeners.delete(setAgents);
    };
  }, []);
  return agents;
}

export async function createExternalAgent(input: NewExternalAgent): Promise<ExternalAgent> {
  const body = (await api("/api/external-agents", { method: "POST", body: JSON.stringify({ ...input, protocol: "a2a" }) })) as { agent: ExternalAgent };
  await refreshExternalAgents();
  return body.agent;
}

export async function checkExternalAgent(id: string): Promise<ConnectionCheck> {
  const body = (await api(`/api/external-agents/${id}/check`, { method: "POST" })) as { check: ConnectionCheck };
  await refreshExternalAgents();
  return body.check;
}

export async function removeExternalAgent(id: string): Promise<void> {
  await api(`/api/external-agents/${id}`, { method: "DELETE" });
  await refreshExternalAgents();
}

export async function inviteExternalAgent(roomId: string, connectionId: string): Promise<"added" | "already"> {
  const body = (await api(`/api/groups/${roomId}/external-agents`, { method: "POST", body: JSON.stringify({ connectionId }) })) as { status: "added" | "already" };
  return body.status;
}

export async function setExternalResponder(roomId: string, connectionId: string | null): Promise<void> {
  await api(`/api/groups/${roomId}/external-responder`, { method: "PUT", body: JSON.stringify({ connectionId }) });
}

/** "Research Agent · direct endpoint" / "Research Agent · zroute proxy → Provider Agent". */
export function externalSourceLabel(agent: { displayName: string; transport: "direct" | "zroute"; upstreamName?: string; upstreamAgentId?: string }): string {
  return agent.transport === "zroute"
    ? t("external.source.zroute", { name: agent.displayName, upstream: agent.upstreamName ?? agent.upstreamAgentId ?? t("external.upstreamUnknown") })
    : t("external.source.direct", { name: agent.displayName });
}
