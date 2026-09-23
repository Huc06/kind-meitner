import { setComposerDraft } from "./drafts";

export const DEV_DAY_GATE_NAME = "#dev-day-gate";
export const DEV_DAY_GATE_SECTION = "Dev Day";
export const DEV_DAY_GATE_BULLETIN = "Gate before list. Gate before spend. Free MCP only.";
export const DEV_DAY_GATE_FREE_MCP_URL = "https://kind-meitner-production.up.railway.app/api/okx/free-mcp";

export const DEV_DAY_GATE_STARTERS = [
  {
    id: "scan-vercel",
    label: "Scan a vercel URL",
    prompt: "@Markets run scan_free_mcp_readiness for https://demo.vercel.app/api/okx/free-mcp",
  },
  {
    id: "scan-railway",
    label: "Scan our Railway Free MCP",
    prompt: `@Markets run scan_free_mcp_readiness for ${DEV_DAY_GATE_FREE_MCP_URL}`,
  },
  {
    id: "trust-99999",
    label: "Trust agent 99999",
    prompt: "@Markets run get_asp_trust_card for agentId 99999",
  },
  {
    id: "trust-13837",
    label: "Trust agent 13837",
    prompt: `@Markets run get_asp_trust_card for agentId 13837 with endpointUrl ${DEV_DAY_GATE_FREE_MCP_URL}`,
  },
] as const;

export function isDevDayGate(group: Pick<{ name: string; section?: string }, "name" | "section">): boolean {
  return group.section === DEV_DAY_GATE_SECTION && group.name.trim().replace(/^#/, "").toLowerCase() === "dev-day-gate";
}

/** Fill the active room composer only; starters never create an automatic turn. */
export function fillDevDayGateStarter(composerDraftId: string, prompt: string): void {
  setComposerDraft(composerDraftId, prompt);
}
