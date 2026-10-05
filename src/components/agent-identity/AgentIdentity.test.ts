import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentIdentity } from "./AgentIdentity";
import { AgentMark } from "./AgentMark";
import type { BotIdentityLike, EngineInstanceStateLike } from "@/lib/agent-identity";

describe("AgentIdentity rendering", () => {
  const availableEngine: EngineInstanceStateLike = {
    instances: [
      {
        instanceId: "inst-1",
        snapshot: { state: "available" },
      },
    ],
  };

  const unavailableEngine: EngineInstanceStateLike = {
    instances: [
      {
        instanceId: "inst-1",
        snapshot: { state: "unavailable" },
      },
    ],
  };

  const okxBot: BotIdentityLike = {
    id: "okx-markets",
    name: "Markets",
    modelSelection: { instanceId: "inst-1" },
    okxImport: {
      kind: "okx-catalog",
      externalAgentId: "okx-market-scout-v1",
      provider: "OKX.ai",
      capabilities: ["chat", "market-intelligence"],
    },
  };

  const localBot: BotIdentityLike = {
    id: "local-tuli",
    name: "Tuli",
    modelSelection: { instanceId: "inst-1" },
  };

  it("OKX catalog shows 'OKX.AI catalog', 'Imported agent', capabilities, status", () => {
    const html = renderToStaticMarkup(
      createElement(AgentIdentity, {
        bot: okxBot,
        state: availableEngine,
        variant: "card",
      }),
    );

    expect(html).toContain("OKX.AI catalog");
    expect(html).toContain("Imported agent");
    expect(html).toContain("chat");
    expect(html).toContain("market-intelligence");
    expect(html).toContain("Available");
    expect(html).toContain('data-agent-mark="okx"');
  });
  it("uninvited catalog agent shows 'OKX.AI catalog' and does NOT show 'Imported agent'", () => {
    const uninvitedAgent: BotIdentityLike = {
      id: "okx-market-scout-v1",
      name: "Markets",
      modelSelection: { instanceId: "inst-1" },
      okxImport: {
        kind: "okx-catalog",
        externalAgentId: "okx-market-scout-v1",
        provider: "OKX.ai",
      },
      isImported: false,
    };
    const html = renderToStaticMarkup(
      createElement(AgentIdentity, {
        bot: uninvitedAgent,
        state: availableEngine,
        variant: "card",
        isImported: false,
      }),
    );
    expect(html).toContain("OKX.AI catalog");
    expect(html).not.toContain("Imported agent");
    expect(html).toContain("Markets");
    expect(html).toContain('title="Markets"');
  });

  it("in-room agent shows 'In this room' badge instead of 'Imported agent'", () => {
    const html = renderToStaticMarkup(
      createElement(AgentIdentity, {
        bot: okxBot,
        state: availableEngine,
        variant: "card",
        inRoom: true,
      }),
    );
    expect(html).toContain("In this room");
    expect(html).not.toContain("Imported agent");
  });


  it("local shows 'Local workspace agent' and does not claim imported agent", () => {
    const html = renderToStaticMarkup(
      createElement(AgentIdentity, {
        bot: localBot,
        state: availableEngine,
        variant: "card",
      }),
    );

    expect(html).toContain("Local workspace agent");
    expect(html).not.toContain("Imported agent");
    expect(html).toContain("Available");
    expect(html).toContain('data-agent-mark="local"');
    expect(html).toContain("T"); // initial letter
  });

  it("local agent never shows 'Imported agent' even if isImported is passed as true", () => {
    const htmlNotMember = renderToStaticMarkup(
      createElement(AgentIdentity, {
        bot: localBot,
        state: availableEngine,
        variant: "card",
        isImported: true,
      }),
    );
    expect(htmlNotMember).not.toContain("Imported agent");
    expect(htmlNotMember).not.toContain("In this room");

    const htmlInRoom = renderToStaticMarkup(
      createElement(AgentIdentity, {
        bot: localBot,
        state: availableEngine,
        variant: "card",
        inRoom: true,
        isImported: true,
      }),
    );
    expect(htmlInRoom).toContain("In this room");
    expect(htmlInRoom).not.toContain("Imported agent");
  });

  it("shows engine mode only for actual workspace bots, never for uninvited catalog entries", () => {
    const simulatedEngine: EngineInstanceStateLike = {
      instances: [
        {
          instanceId: "inst-test",
          simulated: true,
          testEngine: true,
          snapshot: { state: "available", simulated: true },
        },
      ],
    };

    const uninvitedAgent: BotIdentityLike = {
      id: "okx-market-scout-v1",
      name: "Markets",
      okxImport: {
        kind: "okx-catalog",
        externalAgentId: "okx-market-scout-v1",
      },
      isImported: false,
    };

    // 1. Uninvited catalog entry shows Available, never Test engine
    const catalogHtml = renderToStaticMarkup(
      createElement(AgentIdentity, {
        bot: uninvitedAgent,
        state: simulatedEngine,
        variant: "card",
        isImported: false,
      }),
    );
    expect(catalogHtml).toContain("Available");
    expect(catalogHtml).not.toContain("Test engine");

    // 2. Imported bot in workspace shows Test engine
    const importedHtml = renderToStaticMarkup(
      createElement(AgentIdentity, {
        bot: { ...uninvitedAgent, isImported: true },
        state: simulatedEngine,
        variant: "card",
        isImported: true,
      }),
    );
    expect(importedHtml).toContain("Test engine");

    // 3. Local workspace bot shows Test engine
    const localHtml = renderToStaticMarkup(
      createElement(AgentIdentity, {
        bot: { ...localBot, modelSelection: { instanceId: "inst-test" } },
        state: simulatedEngine,
        variant: "card",
      }),
    );
    expect(localHtml).toContain("Test engine");
  });

  it("renders offline state text when engine is unavailable or unconfigured", () => {
    const html = renderToStaticMarkup(
      createElement(AgentIdentity, {
        bot: okxBot,
        state: unavailableEngine,
        variant: "card",
      }),
    );

    expect(html).toContain("Offline");
    expect(html).toContain("No AI engine or OKX Gateway connection configured.");
    expect(html).toContain("Markets is offline.");
  });

  it("renders accessible sr-only full sentence in all variants", () => {
    const rowHtml = renderToStaticMarkup(
      createElement(AgentIdentity, {
        bot: okxBot,
        state: availableEngine,
        variant: "row",
      }),
    );
    expect(rowHtml).toContain("sr-only");
    expect(rowHtml).toContain("Markets, OKX.AI catalog. Imported agent. Status: Available. Capabilities: chat, market-intelligence.");

    const compactHtml = renderToStaticMarkup(
      createElement(AgentIdentity, {
        bot: localBot,
        state: availableEngine,
        variant: "compact",
      }),
    );
    expect(compactHtml).toContain("sr-only");
    expect(compactHtml).toContain("Tuli, Local workspace agent. Status: Available.");
  });

  it("renders working status when bot is active", () => {
    const workingOkxBot: BotIdentityLike = {
      ...okxBot,
      activity: "working",
    };
    const html = renderToStaticMarkup(
      createElement(AgentIdentity, {
        bot: workingOkxBot,
        state: availableEngine,
        variant: "row",
      }),
    );
    expect(html).toContain("Working");
  });
});

describe("AgentMark mascot", () => {
  it("renders catalog agents with their distinct logos", () => {
    const markets = renderToStaticMarkup(createElement(AgentMark, { bot: { id: "b1", name: "Markets", okxImport: { kind: "okx-catalog", externalAgentId: "okx-market-scout-v1" } } }));
    const spend = renderToStaticMarkup(createElement(AgentMark, { bot: { id: "b2", name: "Spend Scout", okxImport: { kind: "okx-catalog", externalAgentId: "okx-spend-scout" } } }));
    expect(markets).toContain('data-agent-logo="star"');
    expect(spend).toContain('data-agent-logo="shield"');
  });
});

