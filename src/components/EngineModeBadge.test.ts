import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EngineModeBadge, resolveEngineModeState } from "./EngineModeBadge";
import type { Bot, InstanceInfo, Message } from "@/state/store";

describe("EngineModeBadge", () => {
  const simulatedInstance: InstanceInfo = {
    instanceId: "claude-simulated",
    driverKind: "claudeAgent",
    displayName: "Simulated Claude",
    simulated: true,
    testEngine: true,
    snapshot: {
      state: "available",
      simulated: true,
      testEngine: true,
    },
    models: { default: "claude-test", options: [] },
  };

  const liveInstance: InstanceInfo = {
    instanceId: "claude-live",
    driverKind: "claudeAgent",
    displayName: "Real Claude",
    snapshot: {
      state: "available",
    },
    models: { default: "claude-sonnet-5", options: [] },
  };

  const unavailableInstance: InstanceInfo = {
    instanceId: "claude-offline",
    driverKind: "claudeAgent",
    displayName: "Offline Claude",
    snapshot: {
      state: "unavailable",
      reason: "CLI not found",
    },
    models: { default: "", options: [] },
  };

  describe("badge states: simulated, unavailable, live", () => {
    it("renders simulated state with Test engine or Simulated response", () => {
      const tagHtml = renderToStaticMarkup(
        createElement(EngineModeBadge, { mode: "simulated", variant: "tag" })
      );
      expect(tagHtml).toContain("Simulated response");
      expect(tagHtml).toContain('data-state="simulated"');

      const statusHtml = renderToStaticMarkup(
        createElement(EngineModeBadge, { mode: "simulated", variant: "status" })
      );
      expect(statusHtml).toContain("Test engine");
      expect(statusHtml).toContain('data-state="simulated"');
    });

    it("renders unavailable state with Offline and configuration reason", () => {
      const html = renderToStaticMarkup(
        createElement(EngineModeBadge, { mode: "unavailable" })
      );
      expect(html).toContain("Offline");
      expect(html).toContain("No AI engine or OKX Gateway connection configured.");
      expect(html).toContain('data-state="unavailable"');
    });

    it("renders live state with Live indicator", () => {
      const html = renderToStaticMarkup(
        createElement(EngineModeBadge, { mode: "live" })
      );
      expect(html).toContain("Live");
      expect(html).toContain('data-state="live"');
    });
  });

  describe("engine provenance resolution", () => {
    it("resolves simulated from explicit message flag", () => {
      const msg: Message = {
        id: "msg-1",
        at: Date.now(),
        role: "bot",
        kind: "text",
        text: "hello from fake claude",
        simulated: true,
      };

      expect(resolveEngineModeState({ message: msg })).toBe("simulated");

      const html = renderToStaticMarkup(
        createElement(EngineModeBadge, { message: msg })
      );
      expect(html).toContain("Simulated response");
    });

    it("derives simulated state from bot's configured engine instance", () => {
      const bot = {
        id: "bot-1",
        name: "Markets Scout",
        color: "blue",
        threadId: "t-1",
        modelSelection: { instanceId: "claude-simulated", model: "test" },
      } as unknown as Bot;

      const instances = [simulatedInstance, liveInstance];

      expect(resolveEngineModeState({ bot, instances })).toBe("simulated");

      const msg: Message = {
        id: "msg-2",
        at: Date.now(),
        role: "bot",
        kind: "text",
        text: "analyzing markets...",
      };

      const html = renderToStaticMarkup(
        createElement(EngineModeBadge, { message: msg, bot, instances })
      );
      expect(html).toContain("Simulated response");
    });

    it("derives unavailable state when bot has no available engine instance", () => {
      const bot = {
        id: "bot-2",
        name: "Orphan Agent",
        color: "green",
        threadId: "t-2",
        modelSelection: { instanceId: "claude-offline", model: "none" },
      } as unknown as Bot;

      const instances = [unavailableInstance];

      expect(resolveEngineModeState({ bot, instances })).toBe("unavailable");

      const html = renderToStaticMarkup(
        createElement(EngineModeBadge, { bot, instances, variant: "status" })
      );
      expect(html).toContain("Offline");
      expect(html).toContain("No AI engine or OKX Gateway connection configured.");
    });

    it("derives live state when bot is connected to a live engine", () => {
      const bot = {
        id: "bot-3",
        name: "Live Agent",
        color: "amber",
        threadId: "t-3",
        modelSelection: { instanceId: "claude-live", model: "claude-sonnet-5" },
      } as unknown as Bot;

      const instances = [liveInstance];

      expect(resolveEngineModeState({ bot, instances })).toBe("live");

      // In status mode, renders Live
      const statusHtml = renderToStaticMarkup(
        createElement(EngineModeBadge, { bot, instances, variant: "status" })
      );
      expect(statusHtml).toContain("Live");

      // In message mode without explicit mode, omits tag for normal live messages
      const msg: Message = {
        id: "msg-3",
        at: Date.now(),
        role: "bot",
        kind: "text",
        text: "live reply",
      };
      const msgHtml = renderToStaticMarkup(
        createElement(EngineModeBadge, { message: msg, bot, instances })
      );
      expect(msgHtml).toBe("");
    });
  });
});
