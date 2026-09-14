import { describe, expect, it } from "vitest";
import { applyWorkspaceClientState, collectWorkspaceClientState } from "./workspace-backup-client";

function memory(values: Record<string, string>) {
  const entries = new Map(Object.entries(values));
  return { entries, getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); }, removeItem: (key: string) => { entries.delete(key); } };
}

describe("full-backup browser state", () => {
  it("exports exact app drafts/preferences, never saved webhook credentials or auth/cache keys", () => {
    const storage = memory({ "kind-meitner-drafts": "draft", "kind-meitner-webhook-credentials": "private URL", "kind-meitner-skin": "daylight", "auth-token": "secret", "kind-meitner-connected-apps": "cached accounts", "kind-meitner-email-gate": "identity", "kind-meitner-pending-workspace-restore": "old" });
    expect(collectWorkspaceClientState(storage)).toEqual({ "kind-meitner-drafts": "draft", "kind-meitner-skin": "daylight" });
  });

  it("replaces only allowlisted keys and clears old drafts absent from the backup", () => {
    const storage = memory({ "kind-meitner-drafts": "old", "kind-meitner-draft-attachments": "old attachment", "auth-token": "keep", "kind-meitner-webhook-credentials": "destination URL" });
    applyWorkspaceClientState({ "kind-meitner-drafts": "restored", "kind-meitner-show-threads": "false" }, storage);
    expect(Object.fromEntries(storage.entries)).toEqual({ "kind-meitner-drafts": "restored", "kind-meitner-show-threads": "false", "auth-token": "keep", "kind-meitner-webhook-credentials": "destination URL" });
  });

  it.each([null, [], { "auth-token": "injected" }, { "kind-meitner-webhook-credentials": "source URL" }, { "kind-meitner-drafts": 1 }])("rejects invalid client state before clearing anything (%j)", (value) => {
    const storage = memory({ "kind-meitner-drafts": "old", "auth-token": "keep" });
    expect(() => applyWorkspaceClientState(value, storage)).toThrow("Invalid backup browser state");
    expect(Object.fromEntries(storage.entries)).toEqual({ "kind-meitner-drafts": "old", "auth-token": "keep" });
  });

  it("rolls browser state back if restored values exceed storage quota", () => {
    const storage = memory({ "kind-meitner-drafts": "old", "kind-meitner-skin": "daylight", "auth-token": "keep" });
    const original = storage.setItem;
    storage.setItem = (key, value) => { if (value === "too large") throw new Error("quota"); original(key, value); };
    expect(() => applyWorkspaceClientState({ "kind-meitner-drafts": "too large" }, storage)).toThrow("quota");
    expect(Object.fromEntries(storage.entries)).toEqual({ "kind-meitner-drafts": "old", "kind-meitner-skin": "daylight", "auth-token": "keep" });
  });
});
