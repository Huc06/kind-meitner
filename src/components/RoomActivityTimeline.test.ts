import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  deriveRoomTimelineEvents,
  RoomActivityTimeline,
} from "./RoomActivityTimeline";
import { StoreProvider, type Bot, type Group, type Message } from "@/state/store";

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
    okxImport: {
      kind: "okx-catalog",
      externalAgentId: "okx-market-scout-v1",
      provider: "OKX.ai",
      capabilities: ["market-intelligence"],
    },
  },
];

const mockGroup: Group = {
  id: "room-1",
  name: "War Room",
  threadId: "thread-1",
  memberIds: ["bot-markets"],
  defaultResponder: { kind: "member", botId: "bot-markets" },
  bulletin: "",
  unread: false,
  messages: [],
  createdAt: 1000,
};

describe("RoomActivityTimeline derivation", () => {
  it("derives join activity from activity messages", () => {
    const messages: Message[] = [
      {
        id: "msg-join",
        role: "bot",
        kind: "activity",
        at: 1000,
        tool: { name: "Markets joined #dev-day-gate from OKX.ai.", system: true, ok: true },
      },
    ];

    const events = deriveRoomTimelineEvents(messages, mockBots);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "join",
      actor: "Markets",
      action: "Markets joined #dev-day-gate from OKX.ai.",
      statusText: "Joined",
      statusTone: "neutral",
    });
  });

  it("derives user tasks from user messages", () => {
    const messages: Message[] = [
      {
        id: "msg-task",
        role: "user",
        kind: "text",
        at: 2000,
        text: "Inspect ASP endpoint and check readiness",
      },
    ];

    const events = deriveRoomTimelineEvents(messages, mockBots);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "task",
      actor: "You",
      action: "Inspect ASP endpoint and check readiness",
      statusText: "Task",
      statusTone: "accent",
    });
  });

  it("derives OKX scan readiness tool calls with PASS/FAIL status from okx-action-cards", () => {
    const readinessPayload = {
      data: {
        endpointUrl: "https://demo.vercel.app/api/okx/free-mcp",
        verdict: "PASS",
        checks: [{ id: "https_scheme", status: "pass", detail: "HTTPS OK" }],
        remediation: [],
      },
    };

    const messages: Message[] = [
      {
        id: "msg-scan",
        role: "bot",
        kind: "activity",
        at: 3000,
        from: { botId: "bot-markets", name: "Markets", color: "cyan" },
        tool: {
          name: "scan_free_mcp_readiness",
          ok: true,
          output: JSON.stringify(readinessPayload),
        },
      },
    ];

    const events = deriveRoomTimelineEvents(messages, mockBots);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "tool",
      actor: "Markets",
      statusText: "PASS",
      statusTone: "success",
    });
    expect(events[0].action).toContain("https://demo.vercel.app/api/okx/free-mcp");
  });

  it("derives OKX trust tool calls with GO/NO_GO status from okx-action-cards", () => {
    const trustPayload = {
      data: {
        agentId: "13851",
        decision: "GO",
        summary: "Reputable agent",
        signals: [],
        notChecked: [],
        remediation: [],
        safeNextStep: "Proceed",
      },
    };

    const messages: Message[] = [
      {
        id: "msg-trust",
        role: "bot",
        kind: "activity",
        at: 4000,
        from: { botId: "bot-markets", name: "Markets", color: "cyan" },
        tool: {
          name: "get_asp_trust_card",
          ok: true,
          output: JSON.stringify(trustPayload),
        },
      },
    ];

    const events = deriveRoomTimelineEvents(messages, mockBots);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "tool",
      actor: "Markets",
      statusText: "GO",
      statusTone: "success",
    });
    expect(events[0].action).toContain("Agent 13851");
  });

  it("derives completed and failed agent replies", () => {
    const messages: Message[] = [
      {
        id: "msg-reply-ok",
        role: "bot",
        kind: "text",
        at: 5000,
        from: { botId: "bot-markets", name: "Markets", color: "cyan" },
        text: "The ASP readiness scan succeeded with 7/7 checks.",
      },
      {
        id: "msg-reply-err",
        role: "bot",
        kind: "text",
        at: 6000,
        from: { botId: "bot-markets", name: "Markets", color: "cyan" },
        text: "Connection failed.",
        error: "Engine instance connection lost",
      } as Message,
    ];

    const events = deriveRoomTimelineEvents(messages, mockBots);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      kind: "reply",
      actor: "Markets",
      statusText: "Completed",
      statusTone: "success",
    });
    expect(events[1]).toMatchObject({
      kind: "reply",
      actor: "Markets",
      statusText: "Failed",
      statusTone: "danger",
    });
  });
  it("orders tool steps before the reply it preceded even when timestamps tie or input is out-of-order", () => {
    const messages: Message[] = [
      {
        id: "msg-reply",
        role: "bot",
        kind: "text",
        at: 2000,
        text: "Command finished",
        turnId: "turn-1",
        turnTerminal: true,
        from: { botId: "bot-markets", name: "Markets", color: "cyan" },
      },
      {
        id: "msg-tool",
        role: "bot",
        kind: "activity",
        at: 2000,
        turnId: "turn-1",
        turnTerminal: false,
        from: { botId: "bot-markets", name: "Markets", color: "cyan" },
        tool: { name: "bash", ok: true, summary: "echo hi", input: "echo hi", output: "hi\n" },
      },
      {
        id: "msg-task",
        role: "user",
        kind: "text",
        at: 1000,
        text: "run echo",
      },
    ];

    const events = deriveRoomTimelineEvents(messages, mockBots);
    expect(events.map((e) => e.kind)).toEqual(["task", "tool", "reply"]);
    expect(events[1]?.action).toBe("echo hi");
    expect(events[2]?.action).toBe("Command finished");
  });

  it("sets hasEvidence true only for events with tool evidence or artifacts", () => {
    const messages: Message[] = [
      { id: "m1", role: "user", kind: "text", at: 1000, text: "plain task" },
      { id: "m2", role: "bot", kind: "activity", at: 1100, tool: { name: "echo", ok: true, output: "done" } },
      { id: "m3", role: "bot", kind: "text", at: 1200, text: "plain reply" },
    ];

    const events = deriveRoomTimelineEvents(messages, mockBots);
    expect(events[0]?.hasEvidence).toBe(false);
    expect(events[1]?.hasEvidence).toBe(true);
    expect(events[2]?.hasEvidence).toBe(false);
  });
});

describe("RoomActivityTimeline component", () => {
  it("renders side panel with aria-live polite and evidence jump buttons", () => {
    const messages: Message[] = [
      {
        id: "msg-1",
        role: "user",
        kind: "text",
        at: 1000,
        text: "Task request",
      },
      {
        id: "msg-2",
        role: "bot",
        kind: "activity",
        at: 2000,
        from: { botId: "bot-markets", name: "Markets", color: "cyan" },
        tool: { name: "scan_free_mcp_readiness", ok: true, output: JSON.stringify({ data: { verdict: "PASS", endpointUrl: "https://free-mcp.org", checks: [] } }) },
      },
    ];

    const markup = renderToStaticMarkup(
      createElement(
        StoreProvider,
        null,
        createElement(RoomActivityTimeline, {
          group: mockGroup,
          messages,
          bots: mockBots,
          onClose: () => undefined,
        }),
      ),
    );

    expect(markup).toContain('aria-label="Room Activity Timeline"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("[ ACTIVITY ]");
    expect(markup).toContain("Markets");
    expect(markup).toContain("PASS");
    expect(markup).toContain("View evidence");
    expect(markup).toContain("Show technical details");
  });
  it("renders 'View evidence' only for tool/evidence events and not plain tasks or plain replies", () => {
    const messages: Message[] = [
      { id: "task-1", role: "user", kind: "text", at: 1000, text: "Task only" },
      { id: "tool-1", role: "bot", kind: "activity", at: 2000, tool: { name: "bash", ok: true, output: "result" } },
      { id: "reply-1", role: "bot", kind: "text", at: 3000, text: "Plain reply without evidence" },
    ];

    const markup = renderToStaticMarkup(
      createElement(
        StoreProvider,
        null,
        createElement(RoomActivityTimeline, {
          group: mockGroup,
          messages,
          bots: mockBots,
          onClose: () => undefined,
        }),
      ),
    );

    const matches = markup.match(/<button[^>]*>View evidence<\/button>/g) || [];
    expect(matches).toHaveLength(1);
    expect(markup).toContain("room-activity-timeline-drawer");
  });
});
