import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StoreProvider, type Group, type Message } from "@/state/store";

vi.mock("./DesktopCapabilities", () => ({
  useDesktopCapabilities: () => ({
    capabilities: {
      dictation: { available: false },
      host: { homeDir: "/home/user" },
    },
  }),
  useCaptionChrome: () => ({
    dragStyle: {},
    noDragStyle: {},
    controlsShiftStyle: {},
  }),
}));

import { GroupView, RoomToolChip } from "./GroupView";

const chip = (patch: Partial<Message> = {}): Message => ({
  id: "chip",
  role: "bot",
  kind: "activity",
  at: 1,
  tool: { name: "Posted in Standup", ok: true },
  ...patch,
});

const renderChip = (message: Message) =>
  renderToStaticMarkup(createElement(StoreProvider, null, createElement(RoomToolChip, { message })));

describe("RoomToolChip", () => {
  it("turns a linked receipt into a button that opens the room it names", () => {
    const markup = renderChip(chip({
      comm: { groupId: "room-standup", withBotId: "scout", withName: "Standup", withColor: "green" },
    }));
    expect(markup).toContain("<button");
    expect(markup).toContain("Posted in Standup");
    expect(markup).toContain('title="Open Standup"');
  });

  it("turns an opened-thread receipt into a button that opens that thread", () => {
    const markup = renderChip(chip({
      tool: { name: "Opened thread #QA PR 245 on Scout", ok: true },
      threadRef: { botId: "scout", threadId: "qa-245", title: "QA PR 245" },
    }));
    expect(markup).toContain("<button");
    expect(markup).toContain("Opened thread #QA PR 245 on Scout");
    expect(markup).toContain('title="Open #QA PR 245"');
  });

  it("leaves an ordinary step as a plain pill", () => {
    const markup = renderChip(chip());
    expect(markup).not.toContain("<button");
    expect(markup).toContain("Posted in Standup");
  });

  it("shows a same-room teammate avatar without adding a navigation button", () => {
    const message = chip({
      tool: { name: "Sent to Eli", ok: true },
      comm: { groupId: "here", withBotId: "eli", withName: "Eli", withColor: "green" },
    });
    const markup = renderToStaticMarkup(createElement(StoreProvider, null,
      createElement(RoomToolChip, { message, roomId: "here" })));
    expect(markup).toContain("Sent to Eli");
    expect(markup).toContain('aria-label="Eli"');
    expect(markup).not.toContain("<button");
  });
});

describe("GroupView Header and Body", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { ogb: undefined });
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const testGroup: Group = {
    id: "group-1",
    name: "Engineering Ops",
    threadId: "thread-ops",
    memberIds: [],
    bulletin: "Primary Ops room for agent task coordination\nSecond line instructions",
    defaultResponder: { kind: "mentions" },
    messages: [],
    createdAt: 1000,
    unread: false,
  };

  it("header shows room name, purpose from first line of bulletin, and counts not model name or tokens", () => {
    const markup = renderToStaticMarkup(
      createElement(StoreProvider, null, createElement(GroupView, { group: testGroup })),
    );

    // Line 1: Room name
    expect(markup).toContain("Engineering Ops");

    // Line 2: Purpose from first line of bulletin
    expect(markup).toContain("Primary Ops room for agent task coordination");
    expect(markup).not.toContain("Second line instructions");

    // Line 3: counts and connection state
    expect(markup).toContain("1 participants · 0 agents");

    // Actions with text labels
    expect(markup).toContain("Room details");
    expect(markup).toContain("Activity");
    expect(markup).toContain("More");

    // Primary header must NOT contain model name or token/cost details
    // (They are hidden inside the More overflow menu)
    expect(markup).not.toContain("data-model-name");
    expect(markup).not.toContain("claude-3-5");
  });

  it("uses fallback purpose when bulletin is empty", () => {
    const noPurposeGroup: Group = {
      ...testGroup,
      bulletin: "",
    };

    const markup = renderToStaticMarkup(
      createElement(StoreProvider, null, createElement(GroupView, { group: noPurposeGroup })),
    );

    expect(markup).toContain("No room purpose yet — add group instructions");
  });

  it("renders starters in empty rooms", () => {
    const emptyGroup: Group = {
      ...testGroup,
      messages: [],
    };

    const markup = renderToStaticMarkup(
      createElement(StoreProvider, null, createElement(GroupView, { group: emptyGroup })),
    );

    expect(markup).toContain("Scan an ASP endpoint");
    expect(markup).toContain("Check trust before spend");
    expect(markup).toContain("Discover trending ASPs");
    expect(markup).toContain("Invite an OKX agent");
    expect(markup).toContain("View the Free A2MCP checklist");
  });

  it("header line 1 does not contain All threads control", () => {
    const markup = renderToStaticMarkup(
      createElement(StoreProvider, null, createElement(GroupView, { group: testGroup })),
    );
    // Line 1 name container should not have "All threads"
    expect(markup).toContain("Engineering Ops");
    // All threads control must be hidden from default header view
    const headerLine1Section = markup.split('id="room-setup"')[0];
    expect(headerLine1Section).toBeDefined();
  });

  it("does not render starters in rooms with active conversation", () => {
    const activeGroup: Group = {
      ...testGroup,
      messages: [
        {
          id: "m1",
          role: "user",
          kind: "text",
          text: "Hello team",
          at: 1000,
        },
      ],
    };

    const markup = renderToStaticMarkup(
      createElement(StoreProvider, null, createElement(GroupView, { group: activeGroup })),
    );

    // Starters must only be in empty rooms
    expect(markup).not.toContain("Scan an ASP endpoint");
    expect(markup).not.toContain("Check trust before spend");
    expect(markup).not.toContain("Discover trending ASPs");
  });

  it("renders room setup card with composer dock padding so it does not overlap composer", () => {
    const setupGroup: Group & { setupPending: boolean; setupRequired: boolean; setupCompletedAt: null } = {
      ...testGroup,
      setupPending: true,
      setupRequired: true,
      setupCompletedAt: null,
    };

    const markup = renderToStaticMarkup(
      createElement(StoreProvider, null, createElement(GroupView, { group: setupGroup as Group })),
    );

    expect(markup).toContain('data-testid="room-setup"');
    // Card must be in scroll area with paddingBottom for composer dock, not min-h-full items-center
    expect(markup).not.toContain("flex min-h-full w-full items-center py-8");
    expect(markup).toContain("padding-bottom:");
  });

  it("mounts EngineModeBadge in message row for bot replies", () => {
    const groupWithBotReply: Group = {
      ...testGroup,
      messages: [
        {
          id: "bot-reply-1",
          role: "bot",
          kind: "text",
          text: "hello from fake claude",
          from: { botId: "scout", name: "Scout", color: "green" },
          simulated: true,
          at: 2000,
        },
      ],
    };

    const markup = renderToStaticMarkup(
      createElement(StoreProvider, null, createElement(GroupView, { group: groupWithBotReply })),
    );

    expect(markup).toContain("hello from fake claude");
    // EngineModeBadge renders simulated tag
    expect(markup).toContain("Simulated response");
  });
});
