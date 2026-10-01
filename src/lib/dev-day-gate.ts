import { setComposerDraft } from "./drafts";

export const DEV_DAY_GATE_NAME = "#dev-day-gate";
export const DEV_DAY_GATE_SECTION = "Dev Day";
export const DEV_DAY_GATE_BULLETIN = "Gate before list. Gate before spend. Free MCP only.";
export const DEV_DAY_GATE_FREE_MCP_URL = "https://kind-meitner-production.up.railway.app/api/okx/free-mcp";

export interface DevDayGateStarter {
  id: string;
  label: string;
  prompt?: string;
  action: "fill" | "hub";
}

export const DEV_DAY_GATE_STARTERS: readonly DevDayGateStarter[] = [
  {
    id: "scan-asp",
    label: "Scan an ASP endpoint",
    prompt: `@Markets run scan_free_mcp_readiness for ${DEV_DAY_GATE_FREE_MCP_URL}`,
    action: "fill",
  },
  {
    id: "trust-spend",
    label: "Check trust before spend",
    prompt: `@Markets run get_asp_trust_card for agentId 13851 with endpointUrl ${DEV_DAY_GATE_FREE_MCP_URL}`,
    action: "fill",
  },
  {
    id: "trending-asps",
    label: "Discover trending ASPs",
    prompt: "@Markets run get_trending_asps",
    action: "fill",
  },
  {
    id: "invite-agent",
    label: "Invite an OKX agent",
    action: "hub",
  },
  {
    id: "a2mcp-checklist",
    label: "View the Free A2MCP checklist",
    prompt: "@Markets run get_free_a2mcp_launch_checklist",
    action: "fill",
  },
] as const;

export function isDevDayGate(group: Pick<{ name: string; section?: string }, "name" | "section">): boolean {
  return group.section === DEV_DAY_GATE_SECTION && group.name.trim().replace(/^#/, "").toLowerCase() === "dev-day-gate";
}

/** Fill the active room composer only; starters never create an automatic turn. */
export function fillDevDayGateStarter(composerDraftId: string, prompt: string): void {
  setComposerDraft(composerDraftId, prompt);
}
