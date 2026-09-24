import { describe, expect, it } from "vitest";

import {
  DEMO_AGENT_AVATARS,
  hashSeed,
  presenceToBotAvatarState,
  resolveDemoAgentAvatar,
} from "./team-map-avatars";
import { DEMO_AGENTS } from "./team-map-demo";

describe("team-map-avatars", () => {
  it("resolves all six demo agents", () => {
    for (const agent of DEMO_AGENTS) {
      const spec = resolveDemoAgentAvatar(agent.id);
      expect(spec).toEqual(DEMO_AGENT_AVATARS[agent.id]);
      expect(agent.avatarHint).toBe(spec.type);
    }
  });

  it("maps presence to bot-avatar states", () => {
    expect(presenceToBotAvatarState("working")).toBe("working");
    expect(presenceToBotAvatarState("reviewing")).toBe("working");
    expect(presenceToBotAvatarState("completed")).toBe("sleeping");
    expect(presenceToBotAvatarState("offline")).toBe("sleeping");
    expect(presenceToBotAvatarState("idle")).toBe("default");
    expect(presenceToBotAvatarState("waiting")).toBe("default");
    expect(presenceToBotAvatarState("blocked")).toBe("default");
  });

  it("uses unique types across the roster", () => {
    const types = Object.values(DEMO_AGENT_AVATARS).map((s) => s.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it("falls back to blob with stable hash seed for unknown agents", () => {
    const a = resolveDemoAgentAvatar("unknown-agent-x");
    const b = resolveDemoAgentAvatar("unknown-agent-x");
    expect(a.type).toBe("blob");
    expect(a.face).toBe("eyes");
    expect(a.seed).toBe(b.seed);
    expect(a.seed).toBe(hashSeed("unknown-agent-x"));
    expect(a.seed).toBeGreaterThanOrEqual(0);
    expect(a.seed).toBeLessThan(1);
  });
});
