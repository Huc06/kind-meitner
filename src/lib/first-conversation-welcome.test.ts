import { afterEach, describe, expect, it, vi } from "vitest";
import { getDraft } from "./drafts";
import {
  applyWelcomeSuggestion,
  WELCOME_SUGGESTIONS,
  welcomeSuggestionDraft,
} from "./first-conversation-welcome";

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

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.unstubAllGlobals();
});

describe("welcome suggestion drafts", () => {
  it("fills the composer draft without dispatching a send", () => {
    const store = memoryStorage();
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: store });
    const focus = vi.fn();
    const textarea = {
      disabled: false,
      value: "",
      focus,
      setSelectionRange: vi.fn(),
    };
    vi.stubGlobal("document", {
      querySelector: (sel: string) => (sel.includes("composer") ? textarea : null),
    });
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });

    const draftId = "bot:pepper:t1";
    const suggestion = WELCOME_SUGGESTIONS[0]!;
    const filled = applyWelcomeSuggestion(draftId, suggestion);

    expect(filled).toBe(welcomeSuggestionDraft(suggestion));
    expect(getDraft(store, draftId)).toBe(filled);
    expect(filled.toLowerCase()).toContain("inbox");
    // Capability-honest: no claim that mail is already connected or auto-fetched.
    expect(filled.toLowerCase()).not.toContain("i already");
    expect(filled.toLowerCase()).not.toContain("connected to your");
    expect(focus).toHaveBeenCalled();
  });

  it("keeps every suggestion editable and free of background-routine claims", () => {
    for (const suggestion of WELCOME_SUGGESTIONS) {
      const draft = welcomeSuggestionDraft(suggestion);
      expect(draft.trim().length).toBeGreaterThan(10);
      expect(draft.toLowerCase()).not.toContain("every morning automatically");
      expect(draft.toLowerCase()).not.toContain("i will open your computer");
      expect(draft.toLowerCase()).not.toContain("without asking");
    }
  });
});
