import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Composer } from "./Composer";
import { StoreProvider, type Bot, type Group } from "@/state/store";

vi.mock("./DesktopCapabilities", () => ({
  useDesktopCapabilities: () => ({
    capabilities: {
      dictation: { available: false },
      host: { homeDir: "/home/user" },
    },
  }),
}));

const mockBots: Bot[] = [
  {
    id: "bot-markets",
    name: "Markets",
    threadId: "t-markets",
    title: "Market Intelligence",
    description: "",
    notifications: false,
    unread: false,
    color: "cyan",
    messages: [],
    modelSelection: { instanceId: "inst-1", model: "claude" },
  },
  {
    id: "bot-scout",
    name: "Scout",
    threadId: "t-scout",
    title: "Scout Agent",
    description: "",
    notifications: false,
    unread: false,
    color: "green",
    messages: [],
    modelSelection: { instanceId: "inst-1", model: "claude" },
  },
];

const mockGroup: Group = {
  id: "room-test",
  name: "Testing Room",
  threadId: "thread-test",
  memberIds: ["bot-markets", "bot-scout"],
  defaultResponder: { kind: "member", botId: "bot-markets" },
  bulletin: "",
  unread: false,
  messages: [],
  createdAt: 1000,
};

describe("Composer in a Room", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { ogb: undefined });
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders room placeholder, responding agent, agent selector, and Enter hint", () => {
    const markup = renderToStaticMarkup(
      createElement(
        StoreProvider,
        null,
        createElement(Composer, {
          group: mockGroup,
          members: mockBots,
        }),
      ),
    );

    // Placeholder
    expect(markup).toContain("Ask an agent to inspect an ASP, check readiness, or coordinate a task…");

    // Responding agent
    expect(markup).toContain("Responding agent: Markets");

    // Agent selector (DefaultResponderSelect)
    expect(markup).toContain("<select");
    expect(markup).toContain("Markets");
    expect(markup).toContain("Scout");
    expect(markup).toContain("Everyone responds");
    expect(markup).toContain("Only when mentioned");

    // Enter hint
    expect(markup).toContain("Enter to send · Shift+Enter for a new line");

    // Mention mirror metrics preserved
    expect(markup).toContain("mention-editor-mirror");

    // Default view hides GOAL chip, exposes secondary Options control
    expect(markup).not.toContain(">Goal</button>");
    expect(markup).not.toContain(">/goal</button>");
    expect(markup).toContain("Options");
  });

  it("shows 'Responding: mentioned agents' when room default responder is mentions", () => {
    const mentionsGroup: Group = {
      ...mockGroup,
      defaultResponder: { kind: "mentions" },
    };

    const markup = renderToStaticMarkup(
      createElement(
        StoreProvider,
        null,
        createElement(Composer, {
          group: mentionsGroup,
          members: mockBots,
        }),
      ),
    );

    expect(markup).toContain("Responding: mentioned agents");
  });
});
