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

describe("AgentMark icon mapping", () => {
  it("maps catalog avatar 'chart' to LineChart", () => {
    const bot: BotIdentityLike = {
      id: "bot-chart",
      name: "Chart Bot",
      okxImport: {
        kind: "okx-catalog",
        avatar: "chart",
      },
    };
    const html = renderToStaticMarkup(createElement(AgentMark, { bot }));
    expect(html).toContain('data-agent-mark="okx"');
    expect(html).toMatch(/lucide-(line-chart|chart-line)/);
  });

  it("maps catalog id 'okx-market-scout-v1' to Radar", () => {
    const bot: BotIdentityLike = {
      id: "bot-scout",
      okxImport: {
        kind: "okx-catalog",
        externalAgentId: "okx-market-scout-v1",
      },
    };
    const html = renderToStaticMarkup(createElement(AgentMark, { bot }));
    expect(html).toContain('data-agent-mark="okx"');
    expect(html).toContain("lucide-radar");
  });

  it("maps catalog id 'okx-spend-scout' to ShieldCheck", () => {
    const bot: BotIdentityLike = {
      id: "bot-spend",
      okxImport: {
        kind: "okx-catalog",
        externalAgentId: "okx-spend-scout",
      },
    };
    const html = renderToStaticMarkup(createElement(AgentMark, { bot }));
    expect(html).toContain('data-agent-mark="okx"');
    expect(html).toContain("lucide-shield-check");
  });

  it("maps catalog id 'okx-listing-coach' to Compass", () => {
    const bot: BotIdentityLike = {
      id: "bot-coach",
      okxImport: {
        kind: "okx-catalog",
        externalAgentId: "okx-listing-coach",
      },
    };
    const html = renderToStaticMarkup(createElement(AgentMark, { bot }));
    expect(html).toContain('data-agent-mark="okx"');
    expect(html).toContain("lucide-compass");
  });

  it("maps other catalog agents to Network fallback", () => {
    const bot: BotIdentityLike = {
      id: "bot-generic",
      okxImport: {
        kind: "okx-catalog",
        externalAgentId: "custom-generic-agent",
      },
    };
    const html = renderToStaticMarkup(createElement(AgentMark, { bot }));
    expect(html).toContain('data-agent-mark="okx"');
    expect(html).toContain("lucide-network");
  });

  it("renders local bot with initial letter and tile left bar, never a mascot", () => {
    const bot: BotIdentityLike = {
      id: "atlas",
      name: "Atlas",
    };
    const html = renderToStaticMarkup(createElement(AgentMark, { bot }));
    expect(html).toContain('data-agent-mark="local"');
    expect(html).toContain("A");
    expect(html).toContain("font-mono");
    expect(html).toContain("w-[2px]");
    expect(html).not.toContain("canvas");
    expect(html).not.toContain("mascot");
  });
});
