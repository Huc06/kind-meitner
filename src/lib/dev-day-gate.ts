import { setComposerDraft } from "./drafts";
import { OKX_DEMO_IDENTITY, OKX_DEMO_TOOLS } from "../../shared/okx-demo-identity";

export const DEV_DAY_GATE_NAME = "#dev-day-gate";
export const DEV_DAY_GATE_SECTION = "Dev Day";
export const DEV_DAY_GATE_BULLETIN = "Gate before list. Gate before spend. Free MCP only.";

export interface DevDayGateStarter {
  id: string;
  label: string;
  prompt?: string;
  action: "fill" | "hub";
  capability?: string;
}

export const DEV_DAY_GATE_STARTERS: readonly DevDayGateStarter[] = [
  {
    id: "scan-asp",
    label: "Scan an ASP endpoint",
    prompt: `@Markets run ${OKX_DEMO_TOOLS.endpoint} for ${OKX_DEMO_IDENTITY.endpointUrl}`,
    action: "fill",
    capability: "readiness",
  },
  {
    id: "trust-spend",
    label: "Check trust before spend",
    prompt: `@Markets run ${OKX_DEMO_TOOLS.agent} for agentId ${OKX_DEMO_IDENTITY.agentId} with endpointUrl ${OKX_DEMO_IDENTITY.endpointUrl}`,
    action: "fill",
    capability: "trust",
  },
  {
    id: "trending-asps",
    label: "Discover trending ASPs",
    prompt: "@Markets run get_trending_asps",
    action: "fill",
    capability: "discovery",
  },
  {
    id: "invite-agent",
    label: "Invite an OKX agent",
    action: "hub",
    capability: "invite",
  },
  {
    id: "a2mcp-checklist",
    label: "View the Free A2MCP checklist",
    prompt: "@Markets run get_free_a2mcp_launch_checklist",
    action: "fill",
    capability: "checklist",
  },
] as const;

export function isDevDayGate(group: Pick<{ name: string; section?: string }, "name" | "section">): boolean {
  return group.section === DEV_DAY_GATE_SECTION && group.name.trim().replace(/^#/, "").toLowerCase() === "dev-day-gate";
}

/** Fill the active room composer only; starters never create an automatic turn. */
export function fillDevDayGateStarter(composerDraftId: string, prompt: string): void {
  setComposerDraft(composerDraftId, prompt);
}
