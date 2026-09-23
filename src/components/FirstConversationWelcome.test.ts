import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import type { Bot } from "@/state/store";
import { t } from "@/lib/i18n";
import { dismissWelcome, welcomeConversationKey } from "@/lib/welcome-dismissals";
import { getDraft } from "@/lib/drafts";
import { WELCOME_SUGGESTIONS, welcomeSuggestionDraft } from "@/lib/first-conversation-welcome";

const fixture = vi.hoisted(() => {
  vi.stubGlobal("window", {});
  const store = (() => {
    const values = new Map<string, string>();
    return {
      get length() { return values.size; },
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      removeItem: (key: string) => { values.delete(key); },
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
  })();
  vi.stubGlobal("localStorage", store);
  return { dispatch: vi.fn(), store };
});

vi.mock("@/state/store", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/state/store")>();
  return {
    ...original,
    useStore: () => ({ state: original.initialState, dispatch: fixture.dispatch }),
  };
});

const { FirstConversationWelcome } = await import("./FirstConversationWelcome");
afterAll(() => vi.unstubAllGlobals());
afterEach(() => {
  fixture.dispatch.mockClear();
  fixture.store.clear();
});

const bot: Bot = {
  id: "bot",
  threadId: "t1",
  name: "Pepper",
  title: "",
  description: "",
  color: "green",
  notifications: true,
  unread: false,
  busy: false,
  messages: [],
  modelSelection: { instanceId: "test", model: "profile-default" },
};

function render(node: ReactElement): string {
  return renderToStaticMarkup(node);
}

describe("FirstConversationWelcome", () => {
  it("renders the suggestion card on an empty idle thread", () => {
    const markup = render(createElement(FirstConversationWelcome, { bot, messageCount: 0 }));
    expect(markup).toContain('data-tour="first-conversation-welcome"');
    expect(markup).toContain(t("chat.welcome.heading"));
    // renderToStaticMarkup escapes apostrophes; match the label without relying on raw quotes.
    expect(markup).toContain("Draft replies to what");
    expect(markup).toContain('placeholder="Type your own answer"');
    expect(fixture.dispatch).not.toHaveBeenCalled();
  });

  it("hides the card when the thread already has messages or the bot is busy", () => {
    expect(render(createElement(FirstConversationWelcome, { bot, messageCount: 2 }))).not.toContain(
      'data-tour="first-conversation-welcome"',
    );
    expect(
      render(createElement(FirstConversationWelcome, { bot: { ...bot, busy: true }, messageCount: 0 })),
    ).not.toContain('data-tour="first-conversation-welcome"');
  });

  it("hides the card after a persisted dismiss for that conversation key", () => {
    dismissWelcome(welcomeConversationKey(bot.id, bot.threadId), fixture.store);
    const markup = render(createElement(FirstConversationWelcome, { bot, messageCount: 0 }));
    expect(markup).not.toContain('data-tour="first-conversation-welcome"');
    expect(markup).toContain(t("chat.emptyPrompt"));
  });
});

describe("welcome suggestion fill (no send)", () => {
  it("writes the editable request into the draft store without sending", async () => {
    const { applyWelcomeSuggestion } = await import("@/lib/first-conversation-welcome");
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    vi.stubGlobal("document", { querySelector: () => null });

    const draftId = welcomeConversationKey(bot.id, bot.threadId);
    const suggestion = WELCOME_SUGGESTIONS[3]!;
    applyWelcomeSuggestion(draftId, suggestion);
    expect(getDraft(fixture.store, draftId)).toBe(welcomeSuggestionDraft(suggestion));
    expect(fixture.dispatch).not.toHaveBeenCalled();
  });
});
