import { describe, expect, it } from "vitest";
import {
  agentCapabilities,
  agentOfflineReason,
  agentOfflineTitle,
  agentSource,
  agentSourceLabel,
  agentStatus,
  agentStatusLabel,
  type BotIdentityLike,
  type EngineInstanceStateLike,
} from "./agent-identity";

describe("agentSource", () => {
  it("detects OKX catalog agents from okxImport descriptor", () => {
    const okxBot: BotIdentityLike = {
      id: "bot-okx",
      name: "Markets",
      okxImport: {
        kind: "okx-catalog",
        externalAgentId: "okx-market-scout-v1",
        provider: "OKX.ai",
        capabilities: ["chat", "market-intelligence"],
      },
    };
    expect(agentSource(okxBot)).toBe("okx-catalog");
    expect(agentSourceLabel(okxBot)).toBe("OKX.AI catalog");
  });

  it("detects local workspace agents when okxImport is absent", () => {
    const localBot: BotIdentityLike = {
      id: "bot-local",
      name: "Tuli",
    };
    expect(agentSource(localBot)).toBe("local");
    expect(agentSourceLabel(localBot)).toBe("Local workspace agent");
  });

  it("handles null or undefined safely as local", () => {
    expect(agentSource(null)).toBe("local");
    expect(agentSource(undefined)).toBe("local");
  });
});

describe("agentCapabilities", () => {
  it("extracts capabilities from okxImport", () => {
    const bot: BotIdentityLike = {
      id: "bot-1",
      okxImport: {
        capabilities: ["chat", "market-intelligence"],
      },
    };
    expect(agentCapabilities(bot)).toEqual(["chat", "market-intelligence"]);
  });

  it("returns empty array when capabilities are missing or bot is local", () => {
    expect(agentCapabilities({ id: "local-bot" })).toEqual([]);
    expect(agentCapabilities({ id: "okx-bot", okxImport: {} })).toEqual([]);
    expect(agentCapabilities(null)).toEqual([]);
  });
});

describe("agentStatus offline detection", () => {
  const availableEngine: EngineInstanceStateLike = {
    instances: [
      {
        instanceId: "inst-claude",
        snapshot: { state: "available" },
      },
    ],
  };

  const unavailableEngine: EngineInstanceStateLike = {
    instances: [
      {
        instanceId: "inst-claude",
        snapshot: { state: "unavailable", reason: "CLI not found" },
      },
    ],
  };

  it("returns available when matching instance is available", () => {
    const bot: BotIdentityLike = {
      id: "bot-1",
      modelSelection: { instanceId: "inst-claude" },
    };
    expect(agentStatus(bot, availableEngine)).toBe("available");
    expect(agentStatusLabel(agentStatus(bot, availableEngine))).toBe("Available");
  });

  it("returns offline when matching instance is unavailable", () => {
    const bot: BotIdentityLike = {
      id: "bot-1",
      modelSelection: { instanceId: "inst-claude" },
    };
    expect(agentStatus(bot, unavailableEngine)).toBe("offline");
    expect(agentStatusLabel(agentStatus(bot, unavailableEngine))).toBe("Offline");
  });

  it("returns offline when instanceId is not found in instances", () => {
    const bot: BotIdentityLike = {
      id: "bot-1",
      modelSelection: { instanceId: "missing-engine" },
    };
    expect(agentStatus(bot, availableEngine)).toBe("offline");
  });

  it("returns offline when state has no instances or is undefined", () => {
    const bot: BotIdentityLike = {
      id: "bot-1",
      modelSelection: { instanceId: "inst-claude" },
    };
    expect(agentStatus(bot, { instances: [] })).toBe("offline");
    expect(agentStatus(bot, undefined)).toBe("offline");
    expect(agentStatus(bot, null)).toBe("offline");
  });

  it("returns working when bot is busy or working and engine is available", () => {
    const workingBot: BotIdentityLike = {
      id: "bot-1",
      activity: "working",
      modelSelection: { instanceId: "inst-claude" },
    };
    expect(agentStatus(workingBot, availableEngine)).toBe("working");
    expect(agentStatusLabel(agentStatus(workingBot, availableEngine))).toBe("Working");

    const busyBot: BotIdentityLike = {
      id: "bot-2",
      busy: true,
      modelSelection: { instanceId: "inst-claude" },
    };
    expect(agentStatus(busyBot, availableEngine)).toBe("working");
  });

  it("returns offline when engine is unavailable even if bot is busy", () => {
    const busyBot: BotIdentityLike = {
      id: "bot-1",
      busy: true,
      activity: "working",
      modelSelection: { instanceId: "inst-claude" },
    };
    expect(agentStatus(busyBot, unavailableEngine)).toBe("offline");
  });

  it("detects engine instance via direct instanceId field", () => {
    const bot: BotIdentityLike = {
      id: "bot-1",
      instanceId: "inst-claude",
    };
    expect(agentStatus(bot, availableEngine)).toBe("available");
    expect(agentStatus(bot, unavailableEngine)).toBe("offline");
  });

  it("falls back to any available engine when bot has no instance preference", () => {
    const unconfiguredBot: BotIdentityLike = {
      id: "bot-catalog",
      name: "Markets",
    };
    expect(agentStatus(unconfiguredBot, availableEngine)).toBe("available");
    expect(agentStatus(unconfiguredBot, unavailableEngine)).toBe("offline");
  });
});

describe("offline state copy", () => {
  it("provides localized offline title with bot name", () => {
    expect(agentOfflineTitle({ name: "Markets" })).toBe("Markets is offline.");
    expect(agentOfflineTitle(null)).toBe("Agent is offline.");
  });

  it("provides localized offline reason", () => {
    expect(agentOfflineReason()).toBe(
      "No AI engine or OKX Gateway connection configured.",
    );
  });
});
