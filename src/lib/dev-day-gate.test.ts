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
  it("defines one normalized Dev Day room and four literal tool-ready prompts", () => {
    expect({ name: DEV_DAY_GATE_NAME, section: DEV_DAY_GATE_SECTION }).toEqual({ name: "#dev-day-gate", section: "Dev Day" });
    expect(DEV_DAY_GATE_BULLETIN).toContain("Gate before list");
    expect(DEV_DAY_GATE_STARTERS).toHaveLength(4);
    expect(DEV_DAY_GATE_STARTERS.map((starter) => starter.prompt).join("\n")).toContain("https://demo.vercel.app/api/okx/free-mcp");
    expect(DEV_DAY_GATE_STARTERS.map((starter) => starter.prompt).join("\n")).toContain("agentId 99999");
    expect(DEV_DAY_GATE_STARTERS.map((starter) => starter.prompt).join("\n")).toContain("agentId 13851");
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

    fillDevDayGateStarter(draftId, DEV_DAY_GATE_STARTERS[0].prompt);

    expect(getDraft(store, draftId)).toBe(DEV_DAY_GATE_STARTERS[0].prompt);
    expect(getDraftAttachments(store, draftId)).toEqual([attachment]);
    expect(getDraftChannelMode(store, draftId)).toBe("goal");
  });
});
