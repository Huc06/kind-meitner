import { afterEach, describe, expect, it } from "vitest";
import {
  clearWelcomeDismissal,
  dismissWelcome,
  isWelcomeDismissed,
  shouldShowFirstConversationWelcome,
  welcomeConversationKey,
} from "./welcome-dismissals";

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
});

describe("shouldShowFirstConversationWelcome", () => {
  it("shows only for an idle empty thread that was not dismissed", () => {
    expect(shouldShowFirstConversationWelcome({ messageCount: 0, busy: false, dismissed: false })).toBe(true);
    expect(shouldShowFirstConversationWelcome({ messageCount: 1, busy: false, dismissed: false })).toBe(false);
    expect(shouldShowFirstConversationWelcome({ messageCount: 0, busy: true, dismissed: false })).toBe(false);
    expect(shouldShowFirstConversationWelcome({ messageCount: 0, busy: false, dismissed: true })).toBe(false);
  });
});

describe("welcome dismiss persistence", () => {
  it("keys dismissals per bot/thread like composer drafts", () => {
    expect(welcomeConversationKey("bot", "t1")).toBe("bot:bot:t1");
  });

  it("survives a reload for one conversation without affecting another", () => {
    const store = memoryStorage();
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: store });

    const a = welcomeConversationKey("pepper", "main");
    const b = welcomeConversationKey("pepper", "other");
    expect(isWelcomeDismissed(a)).toBe(false);
    dismissWelcome(a);
    expect(isWelcomeDismissed(a)).toBe(true);
    expect(isWelcomeDismissed(b)).toBe(false);

    // Simulate a cold start: drop the in-memory map by using a fresh storage
    // object that still holds the serialized dismissals.
    const restarted = memoryStorage();
    restarted.setItem("kind-meitner-welcome-dismissed", store.getItem("kind-meitner-welcome-dismissed")!);
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: restarted });
    expect(isWelcomeDismissed(a)).toBe(true);
    expect(isWelcomeDismissed(b)).toBe(false);

    clearWelcomeDismissal(a);
    expect(isWelcomeDismissed(a)).toBe(false);
  });

  it("treats storage failures as not dismissed rather than throwing", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: () => { throw new Error("blocked"); },
        setItem: () => { throw new Error("blocked"); },
      },
    });
    expect(isWelcomeDismissed("bot:x:y")).toBe(false);
    expect(() => dismissWelcome("bot:x:y")).not.toThrow();
  });
});
