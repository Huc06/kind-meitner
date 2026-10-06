import { afterEach, describe, expect, it } from "vitest";

import {
  DEV_DAY_GATE_BULLETIN,
  DEV_DAY_GATE_NAME,
  DEV_DAY_GATE_SECTION,
  DEV_DAY_GATE_STARTERS,
  fillDevDayGateStarter,
  isDevDayGate,
} from "./dev-day-gate";
import { getDraft, getDraftAttachments, getDraftChannelMode, setDraft, setDraftAttachments, setDraftChannelMode } from "./drafts";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

afterEach(() => Reflect.deleteProperty(globalThis, "localStorage"));

describe("Dev Day Gate starters", () => {
  it("defines the 5 exact starters with @Markets tool prompts and hub action", () => {
    expect({ name: DEV_DAY_GATE_NAME, section: DEV_DAY_GATE_SECTION }).toEqual({ name: "#dev-day-gate", section: "Dev Day" });
    expect(DEV_DAY_GATE_BULLETIN).toContain("Gate before list");
    expect(DEV_DAY_GATE_STARTERS).toHaveLength(5);
    
    expect(DEV_DAY_GATE_STARTERS.map((s) => s.label)).toEqual([
      "Scan an ASP endpoint",
      "Check trust before spend",
      "Discover trending ASPs",
      "Invite an OKX agent",
      "View the Free A2MCP checklist",
    ]);

    const fillPrompts = DEV_DAY_GATE_STARTERS.filter((s) => s.action === "fill").map((s) => s.prompt);
    expect(fillPrompts).toHaveLength(4);
    expect(fillPrompts.join("\n")).toContain("scan_free_mcp_readiness");
    expect(fillPrompts.join("\n")).toContain("check_agent_listing_and_connection");
    expect(fillPrompts.join("\n")).toContain("get_trending_asps");
    expect(fillPrompts.join("\n")).toContain("get_free_a2mcp_launch_checklist");
    for (const prompt of fillPrompts) {
      expect(prompt).toContain("@Markets");
    }

    const inviteStarter = DEV_DAY_GATE_STARTERS.find((s) => s.label === "Invite an OKX agent");
    expect(inviteStarter?.action).toBe("hub");

    expect(isDevDayGate({ name: "dev-day-gate", section: "Dev Day" })).toBe(true);
    expect(isDevDayGate({ name: "#dev-day-gate", section: "Elsewhere" })).toBe(false);
  });

  it("replaces the composer draft without sending or discarding composer metadata", () => {
    const store = memoryStorage();
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: store });
    const draftId = "group:dev-day:thread";
    const attachment = { kind: "file" as const, id: "proof", path: "/tmp/proof.txt", name: "proof.txt", size: 12 };
    setDraft(store, draftId, "Do not append this text.");
    setDraftAttachments(store, draftId, [attachment]);
    setDraftChannelMode(store, draftId, "goal");

    fillDevDayGateStarter(draftId, DEV_DAY_GATE_STARTERS[0].prompt!);

    expect(getDraft(store, draftId)).toBe(DEV_DAY_GATE_STARTERS[0].prompt);
    expect(getDraftAttachments(store, draftId)).toEqual([attachment]);
    expect(getDraftChannelMode(store, draftId)).toBe("goal");
  });
});
