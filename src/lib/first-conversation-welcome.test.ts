import { afterEach, describe, expect, it, vi } from "vitest";
import { getDraft } from "./drafts";
import {
  applyWelcomeSuggestion,
  isOkxCatalogAgent,
  OKX_WELCOME_SUGGESTIONS,
  WELCOME_SUGGESTIONS,
  welcomeSuggestionDraft,
  welcomeSuggestionsForBot,
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

  it("returns capability-specific starters for OKX catalog agents", () => {
    const markets = { name: "Markets", okxImport: { kind: "okx-catalog" } };
    const suggestions = welcomeSuggestionsForBot(markets);
    expect(suggestions).toBe(OKX_WELCOME_SUGGESTIONS);
    expect(suggestions.map((s) => s.id)).toEqual(["readiness", "trust", "trending"]);
    expect(isOkxCatalogAgent(markets)).toBe(true);
    expect(isOkxCatalogAgent({ name: "Pepper" })).toBe(false);
    expect(welcomeSuggestionsForBot({ name: "Pepper" })).toBe(WELCOME_SUGGESTIONS);
  });

  it("ensures OKX starters have capability-honest drafts", () => {
    for (const suggestion of OKX_WELCOME_SUGGESTIONS) {
      const draft = welcomeSuggestionDraft(suggestion);
      expect(draft.trim().length).toBeGreaterThan(10);
      expect(draft).toMatch(/run|scan|trust|trending/i);
    }
  });
});
